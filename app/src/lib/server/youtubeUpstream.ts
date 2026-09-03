import { normalizeChatChannel } from '../channelValidation';

const API_KEY_RE = /"INNERTUBE_API_KEY":"([^"]+)"/;
const CLIENT_VERSION_RE = /"INNERTUBE_CONTEXT_CLIENT_VERSION":"([^"]+)"/;
const CONTINUATION_RE = /"continuation":"([^"]+)"/;
const CHANNEL_ID_RE = /"channelId"\s*:\s*"(UC[A-Za-z0-9_-]{22})"/;

const CANONICAL_WATCH_RE =
  /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})[^"']*["']/i;
const OG_WATCH_RE =
  /<meta[^>]+property=["']og:url["'][^>]+content=["']https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})[^"']*["']/i;
const VIDEO_DETAILS_RE =
  /"videoDetails"\s*:\s*\{[\s\S]{0,10000}?"videoId"\s*:\s*"([\w-]{11})"/;
const VIEW_COUNT_SIGNAL_RE =
  /"viewCount"\s*:\s*\{"runs":\[\{"text":"[\d,.\s\u00a0]+"/i;
const WATCHING_NOW_RE = /[\d,.]+\s+watching now/i;
const LIVE_FLAG_RE = /"isLiveNow"\s*:\s*true|"isLiveContent"\s*:\s*true/i;

/* YouTube can expose a separate live broadcast in the Shorts shelf while
 * /@handle/live points at the featured long-form stream. */
const SHORTS_ITEM_RE = /"shortsLockupViewModel":\{"entityId":"shorts-shelf-item-([\w-]{11})"/g;
const SHORTS_LIVE_RE = /"liveBadgeText"|"badgeStyle":"THUMBNAIL_OVERLAY_BADGE_STYLE_LIVE"/;
const SHORTS_BLOCK_WINDOW = 4_000;

export const YOUTUBE_OFFLINE_RECHECK_MS = 60_000;
export const YOUTUBE_POLL_FLOOR_MS = 800;

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  Cookie: 'SOCS=CAI; CONSENT=YES+cb',
};

export interface YouTubeLiveDiscovery {
  videoIds: string[];
  featuredVideoId: string | null;
  liveShortVideoId: string | null;
}

export interface YouTubeChatBootstrap {
  videoId: string;
  apiKey: string;
  clientVersion: string;
  continuation: string;
  channelId?: string;
}

function abortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function extractAssignedJson(html: string, marker: string): any | null {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return null;
  const start = html.indexOf('{', markerIndex + marker.length);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < html.length; index += 1) {
    const char = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') { inString = true; continue; }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        try { return JSON.parse(html.slice(start, index + 1)); }
        catch { return null; }
      }
    }
  }
  return null;
}

export function liveViewContinuation(initialData: any): string | null {
  const items = initialData?.contents?.liveChatRenderer?.header?.liveChatHeaderRenderer
    ?.viewSelector?.sortFilterSubMenuRenderer?.subMenuItems;
  if (!Array.isArray(items)) return null;
  const live = items.find((item: any) =>
    typeof item?.title === 'string' && !item.title.toLowerCase().includes('top'));
  const continuation = live?.continuation?.reloadContinuationData?.continuation;
  return typeof continuation === 'string' && continuation ? continuation : null;
}

export function liveShortVideoIdFromHtml(html: string): string | null {
  const matches = [...html.matchAll(SHORTS_ITEM_RE)];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const start = match.index ?? 0;
    let end = Math.min(html.length, start + SHORTS_BLOCK_WINDOW);
    const nextStart = matches[index + 1]?.index;
    if (typeof nextStart === 'number') end = Math.min(end, nextStart);
    if (SHORTS_LIVE_RE.test(html.slice(start, end))) return match[1];
  }
  return null;
}

export function mergeYouTubeLiveVideoIds(
  featuredVideoId: string | null,
  liveShortVideoId: string | null,
): string[] {
  return [...new Set([featuredVideoId, liveShortVideoId].filter((value): value is string => Boolean(value)))];
}

function videoIdFromUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (
      (url.hostname === 'youtube.com' || url.hostname === 'www.youtube.com') &&
      url.pathname === '/watch'
    ) {
      const id = url.searchParams.get('v');
      if (id && /^[\w-]{11}$/.test(id)) return id;
    }
  } catch {
    // Ignore malformed upstream URLs.
  }
  return null;
}

function videoIdNearestSignal(html: string, signalIndex: number): string | null {
  const before = html.slice(Math.max(0, signalIndex - 50_000), signalIndex);
  const idRe = /"videoId"\s*:\s*"([\w-]{11})"/g;
  let match: RegExpExecArray | null;
  let nearest: string | null = null;
  while ((match = idRe.exec(before)) !== null) nearest = match[1];
  if (nearest) return nearest;
  const after = html.slice(signalIndex, Math.min(html.length, signalIndex + 50_000));
  return after.match(/"videoId"\s*:\s*"([\w-]{11})"/)?.[1] ?? null;
}

function videoIdFromHtml(html: string): string | null {
  const canonical = html.match(CANONICAL_WATCH_RE)?.[1];
  if (canonical) return canonical;
  const og = html.match(OG_WATCH_RE)?.[1];
  if (og) return og;
  const details = html.match(VIDEO_DETAILS_RE)?.[1];
  if (details) return details;

  const signal = VIEW_COUNT_SIGNAL_RE.exec(html) ?? WATCHING_NOW_RE.exec(html) ?? LIVE_FLAG_RE.exec(html);
  return signal ? videoIdNearestSignal(html, signal.index) : null;
}

async function findFeaturedLiveVideo(
  channel: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const urls = [
    `https://www.youtube.com/@${channel}/live`,
    `https://www.youtube.com/c/${channel}/live`,
  ];
  for (const url of urls) {
    try {
      const response = await fetch(url, { headers: HEADERS, redirect: 'follow', signal });
      if (!response.ok) continue;
      const redirectedId = videoIdFromUrl(response.url);
      if (redirectedId) return redirectedId;
      const htmlId = videoIdFromHtml(await response.text());
      if (htmlId) return htmlId;
    } catch (error) {
      if (abortError(error)) throw error;
    }
  }
  return null;
}

async function findLiveShort(channel: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const response = await fetch(`https://www.youtube.com/@${channel}/shorts`, {
      headers: HEADERS,
      redirect: 'follow',
      signal,
    });
    if (!response.ok) return null;
    return liveShortVideoIdFromHtml(await response.text());
  } catch (error) {
    if (abortError(error)) throw error;
    return null;
  }
}

export async function discoverYouTubeLiveVideos(
  rawChannel: string,
  signal?: AbortSignal,
): Promise<YouTubeLiveDiscovery> {
  const channel = normalizeChatChannel('youtube', rawChannel);
  if (!channel) return { videoIds: [], featuredVideoId: null, liveShortVideoId: null };

  const [featuredVideoId, liveShortVideoId] = await Promise.all([
    findFeaturedLiveVideo(channel, signal),
    findLiveShort(channel, signal),
  ]);
  return {
    videoIds: mergeYouTubeLiveVideoIds(featuredVideoId, liveShortVideoId),
    featuredVideoId,
    liveShortVideoId,
  };
}

async function findVideoChannelId(videoId: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: HEADERS,
      redirect: 'follow',
      signal,
    });
    if (!response.ok) return null;
    const html = await response.text();
    const player = extractAssignedJson(html, 'ytInitialPlayerResponse');
    const channelId = player?.videoDetails?.channelId;
    if (typeof channelId === 'string' && /^UC[A-Za-z0-9_-]{22}$/.test(channelId)) return channelId;
    return html.match(CHANNEL_ID_RE)?.[1] ?? null;
  } catch (error) {
    if (abortError(error)) throw error;
    return null;
  }
}

export async function bootstrapYouTubeChat(
  videoId: string,
  signal?: AbortSignal,
): Promise<YouTubeChatBootstrap | null> {
  if (!/^[\w-]{11}$/.test(videoId)) return null;
  const channelIdPromise = findVideoChannelId(videoId, signal);
  const response = await fetch(`https://www.youtube.com/live_chat?is_popout=1&v=${videoId}`, {
    headers: HEADERS,
    redirect: 'follow',
    signal,
  });
  if (!response.ok) return null;
  const html = await response.text();
  const apiKey = html.match(API_KEY_RE)?.[1];
  const clientVersion = html.match(CLIENT_VERSION_RE)?.[1];
  const initialData = extractAssignedJson(html, 'ytInitialData');
  const continuation = liveViewContinuation(initialData) ?? html.match(CONTINUATION_RE)?.[1];
  if (!apiKey || !clientVersion || !continuation) return null;
  const channelId = await channelIdPromise;
  return {
    videoId,
    apiKey,
    clientVersion,
    continuation,
    ...(channelId ? { channelId } : {}),
  };
}

export async function fetchYouTubeChat(
  apiKey: string,
  clientVersion: string,
  continuation: string,
  signal?: AbortSignal,
): Promise<any> {
  const response = await fetch(
    `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${encodeURIComponent(apiKey)}&prettyPrint=false`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...HEADERS,
      },
      body: JSON.stringify({
        context: { client: { clientName: 'WEB', clientVersion } },
        continuation,
      }),
      signal,
    },
  );
  if (!response.ok) throw new Error(`innertube: ${response.status}`);
  return response.json();
}

export function nextYouTubeContinuation(cont: any): { continuation: string | null; timeoutMs: number } {
  for (const value of cont?.continuations ?? []) {
    const data = value.invalidationContinuationData ?? value.timedContinuationData ?? value.reloadContinuationData;
    if (data?.continuation) {
      const raw = typeof data.timeoutMs === 'number' && Number.isFinite(data.timeoutMs)
        ? data.timeoutMs
        : 2_000;
      return { continuation: data.continuation, timeoutMs: Math.max(raw, YOUTUBE_POLL_FLOOR_MS) };
    }
  }
  return { continuation: null, timeoutMs: 0 };
}
