/* GET /api/viewers?twitch=x&youtube=y&tiktok=z
 *
 * Live *concurrent* viewer counts, server-side. Kick is deliberately absent:
 * its API blocks server IPs but allows browsers, so the overlay fetches Kick
 * directly from the client.
 *
 * Per-platform response shape:
 *   { live: false }                 confirmed offline
 *   { live: true, viewers: number } measured concurrent viewers
 *   { live: true, viewers: null }   confirmed live, count not determinable
 * A platform key is omitted entirely when its upstream lookup failed, which
 * the client treats as temporarily unavailable rather than offline.
 *
 * Only concurrent-viewer metrics are ever reported. Followers, subscribers,
 * chatters, connections, and cumulative view totals are never substituted.
 *
 * Caching is process-local only: an in-memory TTL cache plus in-flight
 * Promise coalescing. Nothing is shared across serverless instances or
 * machines, and no distributed cache is involved.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { TikTokLiveConnection } from 'tiktok-live-connector';

/* ------------------------------------------------------------------ */
/* Timing constants                                                    */
/* ------------------------------------------------------------------ */

/**
 * Successful-response cache TTL.
 *
 * Deliberately below the overlay's 10s poll cadence
 * (COUNTER_POLL_INTERVAL_MS in pages/counter.tsx). The previous 12s TTL
 * exceeded that cadence, so roughly every second poll was served a cached
 * value older than its own interval.
 */
const CACHE_TTL_MS = 8_000;

/**
 * Hard cap on cached channel entries.
 *
 * Without this the Map grew for the process lifetime — one entry per distinct
 * channel ever requested. Eviction is least-recently-written first, which a
 * Map gives us for free because it preserves insertion order.
 */
const CACHE_MAX_ENTRIES = 500;

/** Upstream timeouts, per source. */
const TWITCH_TIMEOUT_MS = 4_000;
const YOUTUBE_TIMEOUT_MS = 6_000;
const TIKTOK_TIMEOUT_MS = 6_000;

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** `viewers: null` means live but not determinable. */
interface PlatformCount {
  live: boolean;
  viewers: number | null;
}

/* ------------------------------------------------------------------ */
/* Process-local cache and in-flight coalescing                        */
/* ------------------------------------------------------------------ */

const cache = new Map<string, { at: number; data: PlatformCount }>();

/** One entry per key while a lookup is in flight. */
const inFlight = new Map<string, Promise<PlatformCount>>();

/**
 * The only place a successful result is written to the cache.
 *
 * Deleting before setting makes a refresh move the key to the newest
 * position, so eviction removes the genuinely least-recently-written entry
 * rather than the oldest-first-seen one. Failures never reach this function.
 */
function storeSuccess(key: string, data: PlatformCount): void {
  cache.delete(key);
  cache.set(key, { at: Date.now(), data });

  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
}

/**
 * Resolve `key` through the cache, coalescing concurrent cold lookups so
 * simultaneous identical requests in this process share one upstream call.
 *
 * Returns null when the lookup failed and no fresh cached value exists, so
 * the caller can omit the platform rather than report a fabricated zero.
 */
async function cached(
  key: string,
  fn: () => Promise<PlatformCount>,
): Promise<PlatformCount | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const existing = inFlight.get(key);
  if (existing) {
    try {
      return await existing;
    } catch {
      return null;
    }
  }

  const promise = fn();

  // Store before awaiting so concurrent callers join this same Promise.
  inFlight.set(key, promise);

  promise
    .then((data) => {
      storeSuccess(key, data);
    })
    .catch(() => {
      // Swallowed here; the awaiting caller below reports the failure.
    })
    .finally(() => {
      // Only clear our own entry — a newer Promise for this key must not be
      // deleted by an older one settling late.
      if (inFlight.get(key) === promise) inFlight.delete(key);
    });

  try {
    return await promise;
  } catch {
    return null;
  }
}

/** Fetch with a bounded timeout. Never leaks upstream error detail. */
async function timedFetch(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Platform lookups                                                    */
/* ------------------------------------------------------------------ */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** Twitch: anonymous GQL `stream { viewersCount }` — concurrent viewers. */
async function twitchViewers(login: string): Promise<PlatformCount> {
  const r = await timedFetch(
    'https://gql.twitch.tv/gql',
    {
      method: 'POST',
      headers: {
        'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'query($login: String!) { user(login: $login) { stream { viewersCount } } }',
        variables: { login },
      }),
    },
    TWITCH_TIMEOUT_MS,
  );
  if (!r.ok) throw new Error('upstream');

  const stream = (await r.json())?.data?.user?.stream;
  if (!stream) return { live: false, viewers: null };

  const count = stream.viewersCount;
  return {
    live: true,
    viewers: typeof count === 'number' && Number.isFinite(count) ? count : null,
  };
}

/**
 * YouTube: the live watch page's "watching now" renderer — concurrent
 * viewers.
 *
 * There is deliberately no `originalViewCount` fallback: that field is
 * cumulative views, a different metric entirely. When the stream is known
 * live but no concurrent count can be parsed, this reports
 * `{ live: true, viewers: null }` so the overlay can show an unavailable
 * marker instead of a misleading number.
 */
async function youtubeViewers(handle: string): Promise<PlatformCount> {
  const clean = handle.replace(/^@/, '');
  const live = await timedFetch(
    `https://www.youtube.com/@${clean}/live`,
    {
      headers: {
        'User-Agent': UA,
        'Accept-Language': 'en-US,en;q=0.9',
        Cookie: 'SOCS=CAI; CONSENT=YES+cb',
      },
    },
    YOUTUBE_TIMEOUT_MS,
  );
  if (!live.ok) return { live: false, viewers: null };

  const html = await live.text();

  // Try the concurrent count first: datacenter IPs get a bot-lite variant
  // where canonical="undefined" and isLiveNow is absent, but the watching-now
  // renderer is still present — its existence alone means an active stream.
  const m =
    html.match(/"viewCount":\{"runs":\[\{"text":"([\d,.\s ]+)"/) ||
    html.match(/([\d,.]+)\s+watching now/);

  if (m) {
    const parsed = parseInt(m[1].replace(/[^\d]/g, ''), 10);
    return {
      live: true,
      viewers: Number.isFinite(parsed) ? parsed : null,
    };
  }

  // Page-level live signals only — live, but count not determinable.
  const isLive =
    /<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=/.test(html) ||
    /<meta property="og:url" content="https:\/\/www\.youtube\.com\/watch\?v=/.test(html) ||
    /"isLiveNow"\s*:\s*true/.test(html);

  if (!isLive) return { live: false, viewers: null };

  return { live: true, viewers: null };
}

/** TikTok: room info `user_count` — concurrent viewers. */
async function tiktokViewers(user: string): Promise<PlatformCount> {
  const conn = new TikTokLiveConnection(`@${user.replace(/^@/, '')}`, {
    ...(process.env.TIKTOK_SIGN_API_KEY
      ? { signApiKey: process.env.TIKTOK_SIGN_API_KEY }
      : {}),
  });

  const info = (await Promise.race([
    conn.fetchRoomInfo(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), TIKTOK_TIMEOUT_MS),
    ),
  ])) as Record<string, unknown> | undefined;

  const raw =
    (info as { user_count?: unknown })?.user_count ??
    (info as { data?: { user_count?: unknown } })?.data?.user_count;

  const viewers =
    typeof raw === 'number' && Number.isFinite(raw) ? raw : null;

  // status 2 = live, 4 = ended
  const status =
    (info as { status?: unknown })?.status ??
    (info as { data?: { status?: unknown } })?.data?.status;

  const live = status === 2 || (status === undefined && viewers !== null && viewers > 0);

  return { live, viewers: live ? viewers : null };
}

/* ------------------------------------------------------------------ */
/* Handler                                                             */
/* ------------------------------------------------------------------ */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader('Cache-Control', 'no-store');

  /* Accept only the conservative channel charset. Anything else is treated
     as absent — malformed input is never echoed back. */
  const q = (key: string): string => {
    const raw = req.query[key];
    const value = (typeof raw === 'string' ? raw : '').trim();
    return /^@?[A-Za-z0-9._-]{1,50}$/.test(value) ? value : '';
  };

  const twitch = q('twitch');
  const youtube = q('youtube');
  const tiktok = q('tiktok');

  const [tw, yt, tt] = await Promise.all([
    twitch
      ? cached(`tw:${twitch.toLowerCase()}`, () => twitchViewers(twitch.toLowerCase()))
      : null,
    youtube ? cached(`yt:${youtube.toLowerCase()}`, () => youtubeViewers(youtube)) : null,
    tiktok ? cached(`tt:${tiktok.toLowerCase()}`, () => tiktokViewers(tiktok)) : null,
  ]);

  // Failed lookups are omitted so the client can distinguish "temporarily
  // unavailable" from "confirmed offline".
  res.status(200).json({
    ...(tw ? { twitch: tw } : {}),
    ...(yt ? { youtube: yt } : {}),
    ...(tt ? { tiktok: tt } : {}),
  });
}
