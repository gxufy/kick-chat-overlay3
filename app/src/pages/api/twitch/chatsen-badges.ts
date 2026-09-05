import type { NextApiRequest, NextApiResponse } from 'next';

const CHATSEN_BADGES_URL = 'https://api.chatsen.app/account/badges';
const REQUEST_TIMEOUT_MS = 5_000;
const GENERIC_ERROR = { error: 'Unable to load Chatsen badges.' };
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36';

type ChatsenBadge = {
  id: string;
  title: string;
  url: string;
  users: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.map(stringValue).filter(Boolean))]
    : [];
}

function safeHttpsUrl(value: unknown): string | null {
  const raw = stringValue(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function parseBadges(value: unknown): ChatsenBadge[] | null {
  if (!Array.isArray(value)) return null;
  const badges: ChatsenBadge[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    const id = stringValue(raw.id);
    const title = stringValue(raw.name) || id || 'Chatsen';
    const users = stringList(raw.users);
    const mipmap = Array.isArray(raw.mipmap) ? raw.mipmap : [];
    const url = [...mipmap].reverse().map(safeHttpsUrl).find(Boolean) ?? null;
    if (!id || !url || !users.length) continue;
    badges.push({ id, title, url, users });
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
    const response = await fetch(CHATSEN_BADGES_URL, {
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
