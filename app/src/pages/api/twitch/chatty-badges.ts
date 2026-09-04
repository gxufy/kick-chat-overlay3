import type { NextApiRequest, NextApiResponse } from 'next';

const CHATTY_BADGES_URL = 'https://tduva.com/res/badges';
const REQUEST_TIMEOUT_MS = 5_000;
const GENERIC_ERROR = { error: 'Unable to load Chatty badges.' };

type ChattyBadge = {
  id: string;
  title: string;
  url: string;
  users: string[];
  usernames: string[];
  color?: string;
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

function parseBadges(value: unknown): ChattyBadge[] | null {
  if (!Array.isArray(value)) return null;
  const badges: ChattyBadge[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    const baseId = stringValue(raw.id) || 'chatty';
    const version = stringValue(raw.version);
    const id = version ? `${baseId}-${version}` : baseId;
    const title = stringValue(raw.meta_title) || baseId;
    const url = safeHttpsUrl(raw.image_url_2) ?? safeHttpsUrl(raw.image_url);
    const users = stringList(raw.userids);
    const usernames = stringList(raw.usernames);
    const color = stringValue(raw.color);
    if (!url || (!users.length && !usernames.length)) continue;
    badges.push({
      id,
      title,
      url,
      users,
      usernames,
      ...(/^#[0-9a-f]{6}$/i.test(color) ? { color } : {}),
    });
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
    const response = await fetch(CHATTY_BADGES_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
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
