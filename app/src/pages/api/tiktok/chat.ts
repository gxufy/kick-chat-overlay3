/* GET /api/tiktok/chat?user=<uniqueId>&since=<overlayStartMs> — Server-Sent Events stream.
 *
 * Thin subscriber onto the shared TikTok hub (lib/tiktokHub): ONE upstream
 * TikTok connection per unique channel regardless of how many overlays watch
 * it, with a 30s linger after the last viewer disconnects. Requires a long-lived
 * Node process (`next start`) — not serverless-compatible.
 *
 * `since` moves startup-history filtering to the server boundary. The hub may
 * replay its short recovery buffer, but an overlay only receives rows from its
 * own browser-source lifetime. Reconnects reuse the same timestamp, so unseen
 * post-start rows can still be recovered without shipping old chat to OBS.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
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
  const user = (req.query.user as string || '').trim().replace(/^@/, '');
  if (!user || !/^[A-Za-z0-9._]{1,50}$/.test(user)) {
    return res.status(400).json({ error: 'invalid user' });
  }
  const since = tikTokSseSince(req.query.since);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const send = (data: object) => {
    if (!shouldSendTikTokSseEvent(data, since)) return;
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const keepalive = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { /* noop */ }
  }, 15000);

  const unsubscribe = subscribe(user.toLowerCase(), send);

  req.on('close', () => {
    clearInterval(keepalive);
    unsubscribe();
    try { res.end(); } catch { /* already closed */ }
  });
}
