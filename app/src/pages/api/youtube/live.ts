/* GET /api/youtube/live?channel=<handle|name>
 *
 * Compatibility bootstrap for direct-polling clients. Production MultiChat
 * browsers use /api/youtube/stream so one server upstream can fan out to every
 * overlay, but this endpoint remains available for older/browser fallback use.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { normalizeChatChannel } from '../../../lib/channelValidation';
import {
  bootstrapYouTubeChat,
  discoverYouTubeLiveVideos,
} from '../../../lib/server/youtubeUpstream';

export { extractAssignedJson, liveViewContinuation } from '../../../lib/server/youtubeUpstream';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const channel = normalizeChatChannel('youtube', req.query.channel);
  if (!channel) return res.status(400).json({ error: 'invalid channel' });

  try {
    const discovery = await discoverYouTubeLiveVideos(channel);
    const videoId = discovery.featuredVideoId ?? discovery.videoIds[0];
    if (!videoId) return res.status(200).json({ offline: true });

    const bootstrap = await bootstrapYouTubeChat(videoId);
    if (!bootstrap) {
      return res.status(502).json({
        error: 'could not bootstrap live chat',
        videoId,
        videoIds: discovery.videoIds,
      });
    }

    return res.status(200).json({
      ...bootstrap,
      videoIds: discovery.videoIds,
      ...(discovery.liveShortVideoId ? { liveShortVideoId: discovery.liveShortVideoId } : {}),
    });
  } catch (error: any) {
    return res.status(502).json({ error: error?.message ?? 'YouTube live lookup failed' });
  }
}
