/* /counter — combined live viewer-count overlay for an OBS browser source.
 *
 * Query parameters, defaults, and validation all live in
 * lib/viewerCounterConfig.ts; rendering lives in ViewerCounterDisplay, which
 * the generator preview shares. This file is only the data lifecycle.
 *
 * Counts: /api/viewers for Twitch/YouTube/TikTok (server-cached), plus Kick
 * fetched directly from the browser — Kick's API allows browsers but blocks
 * server IPs.
 *
 * Every number shown is a concurrent-viewer metric. A platform that is live
 * but whose count cannot be determined shows an unavailable marker and is
 * excluded from the combined total rather than counted as zero.
 */
import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import ViewerCounterDisplay from '../components/overlay/ViewerCounterDisplay';
import { counterReadyMessage } from '../lib/counterPreviewReadiness';
import {
  SERVER_PLATFORMS,
  channelPollKey,
  parseChannelPollKey,
  parseViewerCounterConfig,
  type PlatformCountStatus,
  type PlatformStatuses,
  type ViewerPlatform,
} from '../lib/viewerCounterConfig';

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

/** Delay between polls, measured from when the previous poll settles. */
const COUNTER_POLL_INTERVAL_MS = 10_000;

/** How long a previously good value survives consecutive failures. */
const STALE_WINDOW_MS = 60_000;

/** Client-side timeout for one platform request. */
const REQUEST_TIMEOUT_MS = 8_000;

/** A good status plus when it was measured, for staleness bounding. */
type TimedStatus = { status: PlatformCountStatus; at: number };

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Counter() {
  const router = useRouter();
  const [statuses, setStatuses] = useState<PlatformStatuses>({});
  const [started, setStarted] = useState(false);

  const config = router.isReady
    ? parseViewerCounterConfig(router.query as Record<string, unknown>)
    : null;

  /* A stable primitive: changes only when a channel actually changes, so
     restyling never restarts polling. */
  const pollKey = config ? channelPollKey(config.channels) : '';

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
    let controller: AbortController | null = null;
    /* Whether this effect run has already announced itself. The readiness
       signal describes the first commit for this pollKey, so later polls in the
       same run are not re-announced — the parent has long since revealed the
       frame, and a message per poll would be noise on the generator's window
       every ten seconds for as long as the tab is open. */
    let announced = false;

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
      controller = new AbortController();
      const signal = controller.signal;
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
          fetch(`/api/viewers?${serverParams}`, { signal })
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

      if (cancelled) return;
      commit(fresh);
      setStarted(true);

      /* There are real numbers on screen now, so an embedding generator may
       * stop showing its samples. Sent here rather than on mount or on load
       * because those both happen before any provider has been asked anything —
       * that is the whole reason a message exists instead of an iframe event.
       *
       * Narrow on purpose:
       *   - nothing is sent unless this document is actually framed, so the
       *     ordinary OBS and browser cases post nothing at all;
       *   - the target origin is our own, so a cross-origin embedder — anyone
       *     who put this URL in their own page — receives nothing rather than a
       *     message describing someone's stream;
       *   - the pollKey travels with it, so a parent can tell a commit for the
       *     configuration it currently displays from one belonging to a channel
       *     it has already moved on from.
       *
       * The parent validates all of it again on arrival. This is a hint that
       * data has committed, not a channel the parent trusts. */
      if (!announced && typeof window !== 'undefined' && window.parent !== window) {
        announced = true;
        try {
          window.parent.postMessage(
            counterReadyMessage(pollKey),
            window.location.origin,
          );
        } catch {
          /* A frame whose parent has gone away, or an origin the browser
             refuses to post to. The overlay's own rendering does not depend on
             this succeeding, so there is nothing to recover and nothing worth
             logging. */
        }
      }

      // Schedule the next poll only now that this one has settled, so polls
      // can never overlap.
      timer = setTimeout(poll, COUNTER_POLL_INTERVAL_MS);
    }

    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      // Aborting after `cancelled` is set means the rejection handlers above
      // are no-ops, and no state update can follow.
      if (controller) controller.abort();
    };
  }, [router.isReady, pollKey]);

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
          <ViewerCounterDisplay statuses={statuses} style={config.style} />
        )}
      </div>
    </>
  );
}
