/* GET /api/tiktok/chat?user=<uniqueId>&since=<overlayStartMs> — Server-Sent Events stream.
 *
 * Thin subscriber onto the shared TikTok hub: one upstream connection per
 * unique channel, a 30s linger, delete-aware recovery, and a serialized payload
 * shared across every subscriber instead of JSON-stringifying per overlay.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { normalizeChatChannel } from '../../../lib/channelValidation';
import { subscribe } from '../../../lib/tiktokHub';

export const config = { api: { responseLimit: false } };

export function tikTokSseSince(value: unknown): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function shouldSendTikTokSseEvent(data: object, since: number | null): boolean {
  if (since === null) return true;
  const timestamp = Number((data as { timestamp?: unknown }).timestamp);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return true;
  return timestamp >= since;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = normalizeChatChannel('tiktok', req.query.user);
  if (!user) return res.status(400).json({ error: 'invalid user' });
  const since = tikTokSseSince(req.query.since);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const send = (data: object, serialized: string) => {
    if (!shouldSendTikTokSseEvent(data, since)) return;
    res.write(`data: ${serialized}\n\n`);
  };

  const keepalive = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { /* request close handles cleanup */ }
  }, 15_000);

  const unsubscribe = subscribe(user, send);
  req.on('close', () => {
    clearInterval(keepalive);
    unsubscribe();
    try { res.end(); } catch { /* already closed */ }
  });
}
