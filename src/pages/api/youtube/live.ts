/* GET /api/youtube/live?channel=<handle|name>
 *
 * Resolves a YouTube channel to its current livestream and bootstraps
 * anonymous InnerTube live chat.
 *
 * YouTube serves different /live HTML to residential browsers and
 * datacenter/server IPs, so live detection must not depend on one
 * canonical-link shape.
 */

import type { NextApiRequest, NextApiResponse } from 'next';

const API_KEY_RE = /"INNERTUBE_API_KEY":"([^"]+)"/;
const CLIENT_VERSION_RE = /"INNERTUBE_CONTEXT_CLIENT_VERSION":"([^"]+)"/;
const CONTINUATION_RE = /"continuation":"([^"]+)"/;

const CANONICAL_WATCH_RE =
  /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})[^"']*["']/i;

const OG_WATCH_RE =
  /<meta[^>]+property=["']og:url["'][^>]+content=["']https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})[^"']*["']/i;

const VIDEO_DETAILS_RE =
  /"videoDetails"\s*:\s*\{\s*"videoId"\s*:\s*"([\w-]{11})"/;

const CURRENT_VIDEO_RE =
  /"currentVideoEndpoint"\s*:\s*\{\s*"watchEndpoint"\s*:\s*\{\s*"videoId"\s*:\s*"([\w-]{11})"/;

const LIVE_SIGNAL_RE =
  /"isLiveNow"\s*:\s*true|"isLiveContent"\s*:\s*true|"viewCount"\s*:\s*\{"runs":\[\{"text":"[\d,.\s\u00a0]+"/i;

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
      if (id && /^[\w-]{11}$/.test(id)) return id;
    }
  } catch {
    // Ignore malformed upstream URLs.
  }

  return null;
}

function videoIdFromHtml(html: string): string | null {
  const canonical = html.match(CANONICAL_WATCH_RE)?.[1];
  if (canonical) return canonical;

  const og = html.match(OG_WATCH_RE)?.[1];
  if (og) return og;

  /*
   * Server/datacenter IPs can receive YouTube's reduced "bot-lite"
   * page where canonical and isLiveNow are missing. A live-view-count
   * or other live marker lets us safely use the page's player video ID.
   */
  if (!LIVE_SIGNAL_RE.test(html)) return null;

  return (
    html.match(VIDEO_DETAILS_RE)?.[1] ??
    html.match(CURRENT_VIDEO_RE)?.[1] ??
    null
  );
}

async function findLiveVideo(name: string): Promise<string | null> {
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

      if (!response.ok) continue;

      /*
       * Best signal: YouTube actually redirected /live to /watch?v=...
       */
      const redirectedId = videoIdFromUrl(response.url);
      if (redirectedId) return redirectedId;

      const html = await response.text();

      /*
       * Fall back to canonical/OG/player data for YouTube's alternate
       * server-side HTML variants.
       */
      const htmlId = videoIdFromHtml(html);
      if (htmlId) return htmlId;
    } catch {
      // Try the next channel URL form.
    }
  }

  return null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader('Cache-Control', 'no-store');

  const channel = (req.query.channel as string || '').trim();

  if (!channel || !/^@?[A-Za-z0-9._-]{1,50}$/.test(channel)) {
    return res.status(400).json({ error: 'invalid channel' });
  }

  const videoId = await findLiveVideo(channel);

  if (!videoId) {
    return res.status(200).json({ offline: true });
  }

  const chatUrl =
    `https://www.youtube.com/live_chat?is_popout=1&v=${videoId}`;

  const response = await fetch(chatUrl, {
    headers: HEADERS,
    redirect: 'follow',
  });

  if (!response.ok) {
    return res
      .status(502)
      .json({ error: `live_chat page: ${response.status}` });
  }

  const html = await response.text();

  const apiKey = html.match(API_KEY_RE)?.[1];
  const clientVersion = html.match(CLIENT_VERSION_RE)?.[1];
  const continuation = html.match(CONTINUATION_RE)?.[1];

  if (!apiKey || !clientVersion || !continuation) {
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
  });
}