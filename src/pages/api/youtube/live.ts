/* GET /api/youtube/live?channel=<handle|name>
 *
 * Resolves a YouTube channel to its current livestream and bootstraps
 * anonymous InnerTube live chat.
 */

import type { NextApiRequest, NextApiResponse } from 'next';

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

const WATCHING_NOW_RE =
  /[\d,.]+\s+watching now/i;

const LIVE_FLAG_RE =
  /"isLiveNow"\s*:\s*true|"isLiveContent"\s*:\s*true/i;

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

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  Cookie: 'SOCS=CAI; CONSENT=YES+cb',
};

function videoIdFromUrl(raw: string): string | null {
  try {
    const url = new URL(raw);

    if (
      (url.hostname === 'youtube.com' ||
        url.hostname === 'www.youtube.com') &&
      url.pathname === '/watch'
    ) {
      const id = url.searchParams.get('v');

      if (id && /^[\w-]{11}$/.test(id)) {
        return id;
      }
    }
  } catch {
    // Ignore malformed upstream URLs.
  }

  return null;
}

function videoIdNearestSignal(
  html: string,
  signalIndex: number,
): string | null {
  /*
   * YouTube's server/datacenter HTML often contains the live viewer-count
   * renderer but omits canonical URLs. The corresponding videoId appears
   * near that renderer inside the same initial-data structure.
   */
  const before = html.slice(
    Math.max(0, signalIndex - 50000),
    signalIndex,
  );

  const idRe = /"videoId"\s*:\s*"([\w-]{11})"/g;

  let match: RegExpExecArray | null;
  let nearest: string | null = null;

  while ((match = idRe.exec(before)) !== null) {
    nearest = match[1];
  }

  if (nearest) {
    return nearest;
  }

  const after = html.slice(
    signalIndex,
    Math.min(html.length, signalIndex + 50000),
  );

  return (
    after.match(/"videoId"\s*:\s*"([\w-]{11})"/)?.[1] ??
    null
  );
}

function videoIdFromHtml(html: string): string | null {
  const canonical = html.match(CANONICAL_WATCH_RE)?.[1];

  if (canonical) {
    return canonical;
  }

  const og = html.match(OG_WATCH_RE)?.[1];

  if (og) {
    return og;
  }

  const details = html.match(VIDEO_DETAILS_RE)?.[1];

  if (details) {
    return details;
  }

  /*
   * Vercel/datacenter IPs may receive YouTube's reduced bot-lite page.
   * We already know this variant exposes the live viewer-count renderer,
   * because /api/viewers successfully detects the live stream from it.
   */
  const signal =
    VIEW_COUNT_SIGNAL_RE.exec(html) ??
    WATCHING_NOW_RE.exec(html) ??
    LIVE_FLAG_RE.exec(html);

  if (!signal) {
    return null;
  }

  return videoIdNearestSignal(html, signal.index);
}

async function findLiveVideo(
  name: string,
): Promise<string | null> {
  const clean = name.replace(/^@/, '');

  const urls = [
    `https://www.youtube.com/@${clean}/live`,
    `https://www.youtube.com/c/${clean}/live`,
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: HEADERS,
        redirect: 'follow',
      });

      if (!response.ok) {
        continue;
      }

      const redirectedId = videoIdFromUrl(response.url);

      if (redirectedId) {
        return redirectedId;
      }

      const html = await response.text();
      const htmlId = videoIdFromHtml(html);

      if (htmlId) {
        return htmlId;
      }
    } catch {
      // Try the next channel URL form.
    }
  }

  return null;
}

async function findVideoChannelId(videoId: string): Promise<string | null> {
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: HEADERS,
      redirect: 'follow',
    });
    if (!response.ok) return null;
    const html = await response.text();
    const player = extractAssignedJson(html, 'ytInitialPlayerResponse');
    const channelId = player?.videoDetails?.channelId;
    if (typeof channelId === 'string' && /^UC[A-Za-z0-9_-]{22}$/.test(channelId)) return channelId;
    return html.match(CHANNEL_ID_RE)?.[1] ?? null;
  } catch {
    return null;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader('Cache-Control', 'no-store');

  const channel =
    (req.query.channel as string || '').trim();

  if (
    !channel ||
    !/^@?[A-Za-z0-9._-]{1,50}$/.test(channel)
  ) {
    return res.status(400).json({
      error: 'invalid channel',
    });
  }

  const videoId = await findLiveVideo(channel);

  if (!videoId) {
    return res.status(200).json({
      offline: true,
    });
  }

  const chatUrl =
    `https://www.youtube.com/live_chat?is_popout=1&v=${videoId}`;

  const channelIdPromise = findVideoChannelId(videoId);

  const response = await fetch(chatUrl, {
    headers: HEADERS,
    redirect: 'follow',
  });

  if (!response.ok) {
    return res.status(502).json({
      error: `live_chat page: ${response.status}`,
      videoId,
    });
  }

  const html = await response.text();

  const apiKey =
    html.match(API_KEY_RE)?.[1];

  const clientVersion =
    html.match(CLIENT_VERSION_RE)?.[1];

  const initialData = extractAssignedJson(html, 'ytInitialData');
  const continuation = liveViewContinuation(initialData) ?? html.match(CONTINUATION_RE)?.[1];
  const channelId = await channelIdPromise;

  if (
    !apiKey ||
    !clientVersion ||
    !continuation
  ) {
    return res.status(502).json({
      error: 'could not bootstrap live chat',
      videoId,
    });
  }

  return res.status(200).json({
    videoId,
    apiKey,
    clientVersion,
    continuation,
    ...(channelId ? { channelId } : {}),
  });
}