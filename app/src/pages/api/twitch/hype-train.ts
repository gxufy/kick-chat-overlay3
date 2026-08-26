import type { NextApiHandler } from 'next';

const ERROR = 'Unable to load Twitch Hype Train.';
const CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
const CACHE_TTL_MS = 8_000;
const CACHE_MAX_ENTRIES = 500;
const TIMEOUT_MS = 4_000;

export type TwitchHypeTrainSnapshot =
  | { active: false }
  | { active: true; level: number; progression: number; goal: number };

const cache = new Map<string, { at: number; value: TwitchHypeTrainSnapshot }>();
const inFlight = new Map<string, Promise<TwitchHypeTrainSnapshot>>();

function parseSnapshot(value: unknown): TwitchHypeTrainSnapshot | null {
  const execution = (value as any)?.data?.user?.channel?.hypeTrain?.execution;
  if (execution === null || execution?.isActive === false) return { active: false };
  if (!execution) return null;
  const progress = execution.progress;
  const level = progress?.level?.value;
  const progression = progress?.progression;
  const goal = progress?.goal;
  if (execution.isActive !== true || ![level, progression, goal].every(Number.isFinite)) return null;
  if (level < 1 || progression < 0 || goal <= 0) return null;
  return { active: true, level, progression, goal };
}

async function lookup(login: string): Promise<TwitchHypeTrainSnapshot> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch('https://gql.twitch.tv/gql', {
      method: 'POST',
      headers: { 'Client-ID': CLIENT_ID, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'query($login: String!) { user(login: $login) { channel { hypeTrain { execution { isActive progress { goal progression level { value } } } } } } }',
        variables: { login },
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(ERROR);
    const parsed = parseSnapshot(await response.json());
    if (!parsed) throw new Error(ERROR);
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

async function cached(login: string): Promise<TwitchHypeTrainSnapshot> {
  const hit = cache.get(login);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const existing = inFlight.get(login);
  if (existing) return existing;
  const promise = lookup(login);
  inFlight.set(login, promise);
  try {
    const value = await promise;
    cache.delete(login);
    cache.set(login, { at: Date.now(), value });
    while (cache.size > CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value!);
    return value;
  } finally {
    if (inFlight.get(login) === promise) inFlight.delete(login);
  }
}

const handler: NextApiHandler = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: ERROR });
  const raw = typeof req.query.channel === 'string' ? req.query.channel.trim().toLowerCase() : '';
  if (!/^[a-z0-9_]{1,25}$/.test(raw)) return res.status(400).json({ error: ERROR });
  try {
    return res.status(200).json(await cached(raw));
  } catch {
    return res.status(502).json({ error: ERROR });
  }
};

export default handler;
