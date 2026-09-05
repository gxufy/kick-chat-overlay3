/* /counter — combined live viewer-count overlay for an OBS browser source.
 *
 * Query parameters, defaults, and validation all live in
 * lib/viewerCounterConfig.ts; rendering lives in ViewerCounterDisplay, which
 * the generator preview shares. This file is only the data lifecycle.
 *
 * Counts: the selected server endpoint for Twitch/YouTube/TikTok (server-cached),
 * plus Kick fetched directly from the browser — Kick's API allows browsers but
 * blocks server IPs. The normal /counter page keeps the legacy /api/viewers path;
 * the neutral /audience embed uses /api/audience so third-party widget hosts do
 * not depend on blocker-prone counter/viewer URL names.
 *
 * Every number shown is a concurrent-viewer metric. A platform that is live
 * but whose count cannot be determined shows an unavailable marker and is
 * excluded from the combined total rather than counted as zero.
 */
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import ViewerCounterDisplay from '../components/overlay/ViewerCounterDisplay';
import {
  SERVER_PLATFORMS,
  channelPollKey,
  parseChannelPollKey,
  parseViewerCounterConfig,
  type PlatformCountStatus,
  type PlatformStatuses,
  type ViewerPlatform,
} from '../lib/viewerCounterConfig';
import {
  readCounterBackgroundControl,
  subscribeCounterBackgroundControl,
} from '../lib/multichatControlBus';

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

/** Delay between polls, measured from when the previous poll settles. */
const COUNTER_POLL_INTERVAL_MS = 10_000;

/** How long a previously good value survives consecutive failures. */
const STALE_WINDOW_MS = 60_000;

/**
 * How long one poll cycle may spend waiting on providers before committing
 * whatever it has. Bounded so the first cycle always reaches a value, and so
 * `COUNTER_POLL_INTERVAL_MS` is measured from a settlement that actually
 * happens.
 */
const REQUEST_TIMEOUT_MS = 8_000;

/** A good status plus when it was measured, for staleness bounding. */
type TimedStatus = { status: PlatformCountStatus; at: number };

export type CounterRuntimeProps = {
  /** Same-origin endpoint used for Twitch/YouTube/TikTok. */
  serverEndpoint?: '/api/viewers' | '/api/audience';
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function CounterRuntime({ serverEndpoint = '/api/viewers' }: CounterRuntimeProps) {
  const router = useRouter();
  const [statuses, setStatuses] = useState<PlatformStatuses>({});
  const [started, setStarted] = useState(false);
  const [counterBgOverride, setCounterBgOverride] = useState<boolean | null>(null);

  const config = router.isReady
    ? parseViewerCounterConfig(router.query as Record<string, unknown>)
    : null;

  /* A stable primitive: changes only when a channel actually changes, so
     restyling never restarts polling. */
  const pollKey = config ? channelPollKey(config.channels) : '';

  useEffect(() => {
    if (!router.isReady) return;
    const channels = parseChannelPollKey(pollKey);
    setCounterBgOverride(readCounterBackgroundControl(channels));
    return subscribeCounterBackgroundControl(channels, setCounterBgOverride);
  }, [router.isReady, pollKey]);

  useEffect(() => {
    if (!router.isReady) return;

    /* A genuine channel change starts over, visibly.
     *
     * React has already run the previous cleanup by the time this body executes
     * — the old request is aborted and the old timer is cleared — so this is the
     * point at which the previous channel's numbers stop being anything but
     * stale. They are cleared here rather than left until the new poll commits,
     * because leaving them would show one channel's audience under another
     * channel's name for a whole round trip. Nothing renders in their place: the
     * `started` gate below is what the overlay already uses to avoid showing a
     * count it has not measured, and a channel change puts it back in exactly
     * that state.
     *
     * Both setters no-op when there is nothing to clear, so an ordinary first
     * mount costs no extra render. `statuses` is compared by key count rather
     * than by identity — the object is replaced on every commit, so an identity
     * check would always be true and would always re-render. */
    setStatuses((current) => (Object.keys(current).length === 0 ? current : {}));
    setStarted(false);

    const channels = parseChannelPollKey(pollKey);
    const configured = Object.keys(channels) as ViewerPlatform[];
    if (configured.length === 0) return;

    /* Last known good value per platform, used to bound staleness. Local to
       this effect run, so a channel change starts from a clean slate. */
    const lastGood = new Map<ViewerPlatform, TimedStatus>();

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    /* The current cycle's deadline. Held out here so cleanup can clear it: a
       pending abort timer after unmount is a leak whether or not it fires. */
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;

    /** Merge one poll's outcomes with the staleness policy. */
    function commit(fresh: Partial<Record<ViewerPlatform, PlatformCountStatus>>) {
      const now = Date.now();
      const next: PlatformStatuses = {};

      for (const platform of configured) {
        const incoming = fresh[platform];

        if (incoming) {
          // A successful response — including an explicit offline — replaces
          // any retained value immediately.
          lastGood.set(platform, { status: incoming, at: now });
          next[platform] = incoming;
          continue;
        }

        // No usable response this cycle: retain the previous good value only
        // inside the bounded stale window, then drop it.
        const retained = lastGood.get(platform);
        if (retained && now - retained.at < STALE_WINDOW_MS) {
          next[platform] = retained.status;
        } else {
          if (retained) lastGood.delete(platform);
          next[platform] = { state: 'unavailable' };
        }
      }

      if (!cancelled) setStatuses(next);
    }

    /** One poll cycle. Never throws; partial success is preserved. */
    async function poll(): Promise<void> {
      /* One controller serves both reasons a request should stop: the effect
       * tearing down, and this cycle running out of time. Aborting it is what
       * makes REQUEST_TIMEOUT_MS real — without it a provider that accepts a
       * connection and then says nothing leaves `Promise.all` below pending
       * forever, and since the commit, `setStarted` and the readiness message
       * all sit after that await, the overlay never shows a value and an
       * embedding generator never leaves its loading state. Waiting on a socket
       * with no timeout was the whole defect; the constant was declared for this
       * and never wired in.
       *
       * A deadline rather than a race, so timing out also *cancels* the request:
       * a race would commit on time but leave the socket open, and the reply
       * could still land and resolve into a later cycle's `fresh`.
       *
       * No composition helper is needed. AbortSignal.any and AbortSignal.timeout
       * are too new to assume across the browsers OBS ships, and two callers
       * calling `.abort()` on one controller is what they would compose down to
       * anyway — abort is idempotent, and the first reason wins. */
      controller = new AbortController();
      const signal = controller.signal;
      const cycle = controller;
      deadline = setTimeout(() => {
        /* Whatever has already resolved stays in `fresh`; the rest arrive as
           rejections and are swallowed by the per-job catches, so this degrades
           only the platforms that were actually slow. `commit` then applies the
           existing stale-window policy to those, exactly as it does for a
           refusal or a network error — timing out is not a new outcome. */
        cycle.abort();
      }, REQUEST_TIMEOUT_MS);
      const fresh: Partial<Record<ViewerPlatform, PlatformCountStatus>> = {};

      const jobs: Promise<void>[] = [];

      // Twitch / YouTube / TikTok through the shared server cache.
      const serverParams = new URLSearchParams();
      for (const platform of SERVER_PLATFORMS) {
        const name = channels[platform];
        if (name) serverParams.set(platform, name);
      }

      if ([...serverParams].length > 0) {
        jobs.push(
          fetch(`${serverEndpoint}?${serverParams}`, { signal })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              if (!data || typeof data !== 'object') return;
              for (const platform of SERVER_PLATFORMS) {
                if (!channels[platform]) continue;
                const entry = (data as Record<string, unknown>)[platform];
                if (!entry || typeof entry !== 'object') continue;

                const { live, viewers } = entry as {
                  live?: unknown;
                  viewers?: unknown;
                };

                if (live !== true) {
                  fresh[platform] = { state: 'offline' };
                } else if (typeof viewers === 'number' && Number.isFinite(viewers)) {
                  fresh[platform] = { state: 'live', viewers };
                } else {
                  fresh[platform] = { state: 'live-unknown' };
                }
              }
            })
            .catch(() => {
              /* Leave these platforms absent from `fresh` so the staleness
                 policy decides. Aborts land here too and are harmless. */
            }),
        );
      }

      // Kick directly from the browser — only when configured.
      const kick = channels.kick;
      if (kick) {
        jobs.push(
          fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(kick)}`, {
            headers: { Accept: 'application/json' },
            signal,
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              if (!data || typeof data !== 'object') return;
              const stream = (data as { livestream?: unknown }).livestream;

              if (!stream || typeof stream !== 'object') {
                fresh.kick = { state: 'offline' };
                return;
              }

              const count = (stream as { viewer_count?: unknown }).viewer_count;
              fresh.kick =
                typeof count === 'number' && Number.isFinite(count)
                  ? { state: 'live', viewers: count }
                  : { state: 'live-unknown' };
            })
            .catch(() => {
              /* Same policy as above. */
            }),
        );
      }

      await Promise.all(jobs);

      /* Settled, so the deadline has no one left to interrupt. Cleared here as
         well as in cleanup: the next cycle overwrites the variable, and a timer
         still armed against this cycle's controller would abort a controller
         nothing is listening to while keeping the tab's timer alive. */
      clearTimeout(deadline);
      deadline = undefined;

      if (cancelled) return;
      commit(fresh);
      setStarted(true);

      /* This page tells an embedder nothing.
       *
       * It briefly posted a readiness message to its parent, so the generator
       * could keep sample counts up until a real poll had committed and then
       * swap them out. The generator no longer waits for anything: it shows this
       * document as soon as it exists, exactly as it does for the chat overlay,
       * so the message had one consumer and that consumer is gone.
       *
       * Worth not reintroducing. The overlay is the same document in OBS, in a
       * browser tab and in the preview, and a handshake that only matters when
       * framed is a second behaviour for one of those three — which is how the
       * preview and the real overlay drifted apart in the first place. */

      // Schedule the next poll only now that this one has settled, so polls
      // can never overlap.
      timer = setTimeout(poll, COUNTER_POLL_INTERVAL_MS);
    }

    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      /* The in-flight cycle's deadline. Cleared rather than left to fire: the
         abort below already stops the request, so the timer has nothing to do,
         and on a channel change it would otherwise outlive its own effect run.
         Unmount and channel change therefore abort immediately — neither waits
         out the remaining seconds of a timeout. */
      if (deadline) clearTimeout(deadline);
      // Aborting after `cancelled` is set means the rejection handlers above
      // are no-ops, and no state update can follow.
      if (controller) controller.abort();
    };
  }, [router.isReady, pollKey, serverEndpoint]);

  if (!config) return null;

  return (
    <>
      <Head>
        <title>Viewer Counter</title>
        {/* Font faces and the entrance keyframes now come from
            ViewerCounterDisplay, so the preview gets them too. Only
            page-level transparency rules belong here. */}
        <style>{`
          html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
          #__next { display: block; }
          svg { display: block; }
        `}</style>
      </Head>
      <div style={{ padding: 8, boxSizing: 'border-box', width: '100%' }}>
        {/* Render nothing until the first poll settles, so no fabricated
            zero ever flashes on screen. */}
        {started && (
          <ViewerCounterDisplay
            statuses={statuses}
            style={counterBgOverride === null ? config.style : { ...config.style, bg: counterBgOverride }}
          />
        )}
      </div>
    </>
  );
}

export default function Counter() {
  return <CounterRuntime serverEndpoint="/api/viewers" />;
}
