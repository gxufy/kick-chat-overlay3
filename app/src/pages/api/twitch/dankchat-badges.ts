import type { NextApiRequest, NextApiResponse } from 'next';

const DANKCHAT_BADGES_URL = 'https://flxrs.com/api/badges';
const REQUEST_TIMEOUT_MS = 5_000;
const GENERIC_ERROR = { error: 'Unable to load DankChat badges.' };
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36';

type DankChatBadge = {
  type: string;
  url: string;
  users: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function parseBadges(value: unknown): DankChatBadge[] | null {
  if (!Array.isArray(value)) return null;
  const badges: DankChatBadge[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    const type = typeof raw.type === 'string' ? raw.type.trim() : '';
    const url = safeHttpsUrl(raw.url);
    const users = Array.isArray(raw.users)
      ? raw.users
          .map((user) => typeof user === 'string' || typeof user === 'number' ? String(user).trim() : '')
          .filter(Boolean)
      : [];
    if (!type || !url || !users.length) continue;
    badges.push({ type, url, users: [...new Set(users)] });
  }
  return badges;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(DANKCHAT_BADGES_URL, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
        'User-Agent': BROWSER_USER_AGENT,
      },
    });
    if (!response.ok) return res.status(502).json(GENERIC_ERROR);

    const badges = parseBadges(await response.json());
    if (badges === null) return res.status(502).json(GENERIC_ERROR);

    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=300');
    return res.status(200).json(badges);
  } catch {
    return res.status(502).json(GENERIC_ERROR);
  } finally {
    clearTimeout(timer);
  }
}
