import type { NextApiRequest, NextApiResponse } from 'next';

const HEADERS = {
  Accept: 'application/json,text/plain,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://kick.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const channelId = String(req.query.channelId ?? '').trim();
  if (!/^\d{1,20}$/.test(channelId)) return res.status(400).json({ error: 'invalid channel id' });
  try {
    const upstream = await fetch(`https://kick.com/api/v2/channels/${channelId}/messages`, {
      headers: HEADERS,
      cache: 'no-store',
    });
    if (!upstream.ok) return res.status(upstream.status === 404 ? 404 : 502).json({ error: `Kick ${upstream.status}` });
    return res.status(200).json(await upstream.json());
  } catch {
    return res.status(502).json({ error: 'Kick history lookup failed' });
  }
}
