import type { NextApiRequest, NextApiResponse } from 'next';
import { runtimeProcessStats } from '../../../lib/server/runtimeMetrics';
import { tiktokHubAggregateStats } from '../../../lib/tiktokHub';
import { youtubeHubAggregateStats, youtubeHubChannelStats } from '../../../lib/server/youtubeHub';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  res.setHeader('Cache-Control', 'no-store');
  const youtubeQuery = Array.isArray(req.query.youtube) ? req.query.youtube[0] : req.query.youtube;
  const youtube = youtubeHubAggregateStats();
  return res.status(200).json({
    status: 'ok',
    process: runtimeProcessStats(),
    hubs: {
      tiktok: tiktokHubAggregateStats(),
      youtube: youtubeQuery
        ? { ...youtube, selectedChannel: youtubeHubChannelStats(youtubeQuery) }
        : youtube,
    },
  });
}
