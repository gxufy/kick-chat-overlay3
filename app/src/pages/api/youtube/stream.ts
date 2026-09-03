import type { NextApiRequest, NextApiResponse } from 'next';
import { normalizeChatChannel } from '../../../lib/channelValidation';
import { subscribeYouTube } from '../../../lib/server/youtubeHub';

export const config = { api: { responseLimit: false } };

export function youtubeSseSince(value: unknown): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function shouldSendYouTubeSseEvent(
  data: { type?: string; timestamp?: unknown },
  since: number | null,
): boolean {
  if (since === null || data.type !== 'actions') return true;
  const timestamp = Number(data.timestamp);
  return !Number.isFinite(timestamp) || timestamp <= 0 || timestamp >= since;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  const channel = normalizeChatChannel('youtube', req.query.channel);
  if (!channel) return res.status(400).json({ error: 'invalid channel' });
  const since = youtubeSseSince(req.query.since);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const send = (data: any, serialized: string) => {
    if (!shouldSendYouTubeSseEvent(data, since)) return;
    res.write(`data: ${serialized}\n\n`);
  };

  const keepalive = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { /* request close handles cleanup */ }
  }, 15_000);

  const unsubscribe = subscribeYouTube(channel, send);
  req.on('close', () => {
    clearInterval(keepalive);
    unsubscribe();
    try { res.end(); } catch { /* already closed */ }
  });
}
