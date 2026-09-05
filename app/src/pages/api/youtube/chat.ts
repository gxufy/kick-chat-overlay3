/* POST /api/youtube/chat — compatibility proxy for one get_live_chat poll.
 * Production MultiChat uses the shared SSE hub, but older/direct-polling clients
 * keep this endpoint so existing overlay URLs do not depend on a migration.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchYouTubeChat } from '../../../lib/server/youtubeUpstream';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { apiKey, clientVersion, continuation } = req.body ?? {};
  if (typeof apiKey !== 'string' || typeof clientVersion !== 'string' || typeof continuation !== 'string') {
    return res.status(400).json({ error: 'missing fields' });
  }

  try {
    return res.status(200).json(await fetchYouTubeChat(apiKey, clientVersion, continuation));
  } catch (error: any) {
    return res.status(502).json({ error: error?.message ?? 'YouTube chat poll failed' });
  }
}
