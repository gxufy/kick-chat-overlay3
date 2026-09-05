import type { UnifiedBadge } from './types';

type ProviderName =
  | 'uchat'
  | 'chatterino'
  | 'homies'
  | 'custom-homies'
  | 'moltorino'
  | 'bluzyrino'
  | 'ffz'
  | 'bttv'
  | 'turteg'
  | 'polandbot'
  | 'bchat'
  | 'folhinha'
  | 'dankchat'
  | 'chatty'
  | 'chatsen';

type Assignment = {
  provider: ProviderName;
  id: string;
  title: string;
  url: string;
  userIds: string[];
  usernames: string[];
  backgroundColor?: string;
};

type Registry = {
  byUserId: Map<string, Assignment[]>;
  byUsername: Map<string, Assignment[]>;
  partial: boolean;
};

const SUCCESS_TTL_MS = 30 * 60_000;
const PARTIAL_TTL_MS = 5 * 60_000;
const REQUEST_TIMEOUT_MS = 5_000;

/* StreamNook's current chat-client badge set. We already support every one of
   these providers; keeping the set explicit also lets us apply the same
   cross-provider title de-duplication they use for re-hosted client badges. */
const STREAMNOOK_CHAT_CLIENT_PROVIDERS = new Set<ProviderName>([
  'ffz',
  'bttv',
  'chatterino',
  'homies',
  'chatsen',
  'chatty',
  'dankchat',
]);

let cachedRegistry: Registry | null = null;
let cachedAt = 0;
let inFlight: Promise<Registry> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asId(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return asString(value);
}

function httpsUrl(value: unknown): string {
  const raw = asString(value);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'badge';
}

function badgeBackgroundColor(value: unknown): string {
  const raw = asString(value);
  return /^#[0-9a-f]{6}$/i.test(raw) ? raw : '';
}

function strings(value: unknown): string[] {
  return asArray(value).map(asId).filter(Boolean);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function assignment(
  provider: ProviderName,
  id: string,
  title: string,
  url: string,
  userIds: string[] = [],
  usernames: string[] = [],
  backgroundColor = '',
): Assignment | null {
  const image = httpsUrl(url);
  if (!image) return null;
  const normalizedBackgroundColor = badgeBackgroundColor(backgroundColor);
  return {
    provider,
    id: id || slug(title),
    title: title || id || provider,
    url: image,
    userIds: unique(userIds),
    usernames: unique(usernames.map((name) => name.toLowerCase())),
    ...(normalizedBackgroundColor ? { backgroundColor: normalizedBackgroundColor } : {}),
  };
}

async function requestJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function chatterinoLike(provider: ProviderName, body: unknown): Assignment[] {
  const badges = isRecord(body) ? asArray(body.badges) : [];
  return badges.flatMap((raw) => {
    if (!isRecord(raw)) return [];
    const title = asString(raw.tooltip) || asString(raw.title) || asString(raw.id) || provider;
    const item = assignment(
      provider,
      asString(raw.id) || slug(title),
      title,
      asString(raw.image3) || asString(raw.image2) || asString(raw.image1),
      strings(raw.users),
    );
    return item ? [item] : [];
  });
}

async function loadUChat(): Promise<Assignment[]> {
  const body = await requestJson('https://unii.molto.lol/badges');
  if (!isRecord(body)) return [];
  const badges = [...asArray(body.UChat), ...asArray(body.YAUTC)];
  return badges.flatMap((raw) => {
    if (!isRecord(raw)) return [];
    const id = asString(raw.id) || 'uchat';
    const title = asString(raw.title) || id;
    const animated = isRecord(raw.imgs) && isRecord(raw.imgs.animated) ? raw.imgs.animated : null;
    const staticImgs = isRecord(raw.imgs) && isRecord(raw.imgs.static) ? raw.imgs.static : null;
    const urls = isRecord(raw.urls) ? raw.urls : (animated ?? staticImgs ?? {});
    const image = asString(urls['4x']) || asString(urls['3x']) || asString(urls['2x']) || asString(urls['1x']);
    const rawUsers = raw.users;
    const userIds = Array.isArray(rawUsers)
      ? strings(rawUsers)
      : isRecord(rawUsers)
        ? [...strings(rawUsers.twitch), ...strings(rawUsers.TWITCH)]
        : [];
    const item = assignment('uchat', id, title, image, userIds);
    return item ? [item] : [];
  });
}

async function loadChatterino(): Promise<Assignment[]> {
  return chatterinoLike('chatterino', await requestJson('https://api.chatterino.com/badges'));
}

async function loadLegacyHomies(): Promise<Assignment[]> {
  const [one, two] = await Promise.allSettled([
    requestJson('https://itzalex.github.io/badges'),
    requestJson('https://itzalex.github.io/badges2'),
  ]);
  const out: Assignment[] = [];
  if (one.status === 'fulfilled') out.push(...chatterinoLike('homies', one.value));
  if (two.status === 'fulfilled') out.push(...chatterinoLike('homies', two.value));
  return out;
}

async function loadCustomHomies(): Promise<Assignment[]> {
  const body = await requestJson('https://chatterinohomies.com/api/badges/list');
  const badges = isRecord(body) ? asArray(body.badges) : [];
  return badges.flatMap((raw, index) => {
    if (!isRecord(raw)) return [];
    const title = asString(raw.tooltip) || 'Custom Homies Badge';
    const item = assignment(
      'custom-homies',
      asString(raw.badgeId) || `custom-homies-${index}`,
      title,
      asString(raw.image3) || asString(raw.image2) || asString(raw.image1),
      [asId(raw.userId)].filter(Boolean),
      [asString(raw.username)].filter(Boolean),
    );
    return item ? [item] : [];
  });
}

async function loadMoltorino(): Promise<Assignment[]> {
  const body = await requestJson('https://api.moltorino.com/badges');
  const badges = isRecord(body) ? asArray(body.badges) : [];
  return badges.flatMap((raw) => {
    if (!isRecord(raw)) return [];
    const users = asArray(raw.users).filter(isRecord);
    const images = isRecord(raw.images) ? raw.images : {};
    const title = asString(raw.tooltip) || asString(raw.id) || 'Moltorino';
    const item = assignment(
      'moltorino',
      asString(raw.id) || slug(title),
      title,
      asString(images['3x']) || asString(images['2x']) || asString(images['1x']),
      users.map((user) => asId(user.id)).filter(Boolean),
      users.map((user) => asString(user.username)).filter(Boolean),
    );
    return item ? [item] : [];
  });
}

async function loadBluzyrino(): Promise<Assignment[]> {
  const body = await requestJson('https://bluzyrino-badge-registry.blu901-55.workers.dev/v1/badges');
  const bchat = isRecord(body) && isRecord(body.bchat) ? body.bchat : {};
  const badges = asArray(bchat.badges);
  return badges.flatMap((raw) => {
    if (!isRecord(raw)) return [];
    const users = asArray(raw.users).filter(isRecord);
    const title = asString(raw.tooltip) || asString(raw.id) || 'Bluzyrino';
    const item = assignment(
      'bluzyrino',
      asString(raw.id) || slug(title),
      title,
      asString(raw.image_url_4x) || asString(raw.image_url_2x) || asString(raw.image_url_1x),
      users.map((user) => asId(user.id)).filter(Boolean),
      users.map((user) => asString(user.login)).filter(Boolean),
    );
    return item ? [item] : [];
  });
}

function parseFFZ(body: unknown, ownersAreIds: boolean): Assignment[] {
  if (!isRecord(body)) return [];
  const badges = asArray(body.badges);
  const users = isRecord(body.users) ? body.users : {};
  return badges.flatMap((raw) => {
    if (!isRecord(raw)) return [];
    const id = asId(raw.id);
    const urls = isRecord(raw.urls) ? raw.urls : {};
    const image = asString(urls['4']) || asString(urls['3']) || asString(urls['2']) || asString(urls['1']);
    const title = asString(raw.title) || asString(raw.name) || `FFZ ${id}`;
    const owners = id ? strings(users[id]) : [];
    const item = assignment(
      'ffz',
      id || slug(title),
      title,
      image,
      ownersAreIds ? owners : [],
      ownersAreIds ? [] : owners,
      asString(raw.color),
    );
    return item ? [item] : [];
  });
}

async function loadFFZ(): Promise<Assignment[]> {
  /* StreamNook uses /badges/ids because it maps directly to Twitch user IDs.
     Prefer that stronger identity source, but retain the older username feed as
     a compatibility fallback in case the IDs endpoint is temporarily unavailable. */
  try {
    const byId = parseFFZ(await requestJson('https://api.frankerfacez.com/v1/badges/ids'), true);
    if (byId.length) return byId;
  } catch { /* fall through */ }
  return parseFFZ(await requestJson('https://api.frankerfacez.com/v1/badges'), false);
}

function parseBTTV(body: unknown): Assignment[] {
  return asArray(body).flatMap((raw, index) => {
    if (!isRecord(raw)) return [];
    const badge = isRecord(raw.badge) ? raw.badge : {};
    const title = asString(badge.description) || asString(raw.title) || 'BTTV';
    const item = assignment(
      'bttv',
      asString(raw.id) || `bttv-${index}`,
      title,
      asString(badge.svg) || asString(raw.url),
      [asId(raw.providerId)].filter(Boolean),
    );
    return item ? [item] : [];
  });
}

async function loadBTTV(): Promise<Assignment[]> {
  /* Match StreamNook's current cached-badges endpoint, with the old /twitch
     route retained only as a fallback for provider-side compatibility. */
  try {
    const current = parseBTTV(await requestJson('https://api.betterttv.net/3/cached/badges'));
    if (current.length) return current;
  } catch { /* fall through */ }
  return parseBTTV(await requestJson('https://api.betterttv.net/3/cached/badges/twitch'));
}

async function loadTurteg(): Promise<Assignment[]> {
  const body = await requestJson('https://turteg-api.xslash.ovh/v1/ffz/badges');
  const badges = isRecord(body) ? asArray(body.badges) : [];
  return badges.flatMap((raw, index) => {
    if (!isRecord(raw)) return [];
    const urls = isRecord(raw.urls) ? raw.urls : {};
    const title = asString(raw.title) || 'Turteg';
    const item = assignment(
      'turteg',
      asId(raw.id) || `turteg-${index}`,
      title,
      asString(raw.image) || asString(urls['4']) || asString(urls['3']) || asString(urls['2']) || asString(urls['1']),
      strings(raw.users),
    );
    return item ? [item] : [];
  });
}

async function loadPolandBot(): Promise<Assignment[]> {
  const body = await requestJson('https://devpoland.xyz/api/roles');
  if (!isRecord(body)) return [];
  return Object.entries(body).flatMap(([role, rawUsers]) => {
    const item = assignment(
      'polandbot',
      role,
      role,
      `https://devpoland.xyz/badges/${encodeURIComponent(role)}.avif`,
      strings(rawUsers),
    );
    return item ? [item] : [];
  });
}

async function loadBChat(): Promise<Assignment[]> {
  const body = await requestJson('https://www.itsbr0dyy.dev/api/badges');
  const badges = isRecord(body) && isRecord(body.badges) ? body.badges : {};
  return Object.entries(badges).flatMap(([id, raw]) => {
    if (!isRecord(raw)) return [];
    const images = isRecord(raw.images) ? raw.images : {};
    const title = asString(raw.title) || id;
    const item = assignment(
      'bchat',
      id,
      title,
      asString(images['4x']) || asString(images['2x']) || asString(images['1x']),
      strings(raw.users),
    );
    return item ? [item] : [];
  });
}

async function loadFolhinha(): Promise<Assignment[]> {
  const body = await requestJson('https://api.folhinhabot.com/plus');
  if (!isRecord(body)) return [];
  const badges = isRecord(body.badges) ? body.badges : {};
  const imageFor = (role: string): string => {
    const raw = badges[role];
    if (!isRecord(raw)) return '';
    return asString(raw['4']) || asString(raw['3']) || asString(raw['2']) || asString(raw['1']);
  };
  const definitions = [
    { list: body.devs, role: 'dev', imageRole: 'dev', title: 'Folhinha Developer' },
    { list: body.admins, role: 'admin', imageRole: 'admin', title: 'Folhinha Admin' },
    { list: body.plus, role: 'founder', imageRole: 'founder', title: 'Folhinha Founder' },
    { list: body.supporters, role: 'supporter', imageRole: 'sub', title: 'Folhinha Supporter' },
  ] as const;
  return definitions.flatMap((definition) => {
    const image = imageFor(definition.imageRole);
    return asArray(definition.list).flatMap((raw, index) => {
      if (!isRecord(raw)) return [];
      const item = assignment(
        'folhinha',
        `${definition.role}-${asId(raw.id) || index}`,
        definition.title,
        image,
        [asId(raw.userId) || asId(raw.userid)].filter(Boolean),
        [asString(raw.currAlias)].filter(Boolean),
      );
      return item ? [item] : [];
    });
  });
}

async function loadDankChat(): Promise<Assignment[]> {
  const body = await requestJson('/api/twitch/dankchat-badges');
  return asArray(body).flatMap((raw, index) => {
    if (!isRecord(raw)) return [];
    const title = asString(raw.type) || 'DankChat';
    const item = assignment(
      'dankchat',
      `dankchat-${index}`,
      title,
      asString(raw.url),
      strings(raw.users),
    );
    return item ? [item] : [];
  });
}

async function loadChatty(): Promise<Assignment[]> {
  const body = await requestJson('/api/twitch/chatty-badges');
  return asArray(body).flatMap((raw, index) => {
    if (!isRecord(raw)) return [];
    const title = asString(raw.title) || 'Chatty';
    const item = assignment(
      'chatty',
      asString(raw.id) || `chatty-${index}`,
      title,
      asString(raw.url),
      strings(raw.users),
      strings(raw.usernames),
      asString(raw.color),
    );
    return item ? [item] : [];
  });
}

async function loadChatsen(): Promise<Assignment[]> {
  const body = await requestJson('/api/twitch/chatsen-badges');
  return asArray(body).flatMap((raw, index) => {
    if (!isRecord(raw)) return [];
    const title = asString(raw.title) || 'Chatsen';
    const item = assignment(
      'chatsen',
      asString(raw.id) || `chatsen-${index}`,
      title,
      asString(raw.url),
      strings(raw.users),
    );
    return item ? [item] : [];
  });
}

const PROVIDERS: ReadonlyArray<() => Promise<Assignment[]>> = [
  loadUChat,
  loadChatterino,
  loadLegacyHomies,
  loadCustomHomies,
  loadMoltorino,
  loadBluzyrino,
  loadFFZ,
  loadBTTV,
  loadTurteg,
  loadPolandBot,
  loadBChat,
  loadFolhinha,
  loadDankChat,
  loadChatty,
  loadChatsen,
];

function addToIndex(map: Map<string, Assignment[]>, key: string, badge: Assignment): void {
  if (!key) return;
  const list = map.get(key) ?? [];
  list.push(badge);
  map.set(key, list);
}

async function buildRegistry(): Promise<Registry> {
  const results = await Promise.allSettled(PROVIDERS.map((provider) => provider()));
  const byUserId = new Map<string, Assignment[]>();
  const byUsername = new Map<string, Assignment[]>();
  let partial = false;

  for (const result of results) {
    if (result.status !== 'fulfilled') {
      partial = true;
      continue;
    }
    for (const badge of result.value) {
      for (const userId of badge.userIds) addToIndex(byUserId, userId, badge);
      for (const username of badge.usernames) addToIndex(byUsername, username.toLowerCase(), badge);
    }
  }

  return { byUserId, byUsername, partial };
}

async function registry(): Promise<Registry> {
  const now = Date.now();
  const ttl = cachedRegistry?.partial ? PARTIAL_TTL_MS : SUCCESS_TTL_MS;
  if (cachedRegistry && now - cachedAt < ttl) return cachedRegistry;
  if (inFlight) return inFlight;

  inFlight = buildRegistry().then((value) => {
    cachedRegistry = value;
    cachedAt = Date.now();
    inFlight = null;
    return value;
  }, (error) => {
    inFlight = null;
    throw error;
  });
  return inFlight;
}

function dedupe(assignments: Assignment[]): Assignment[] {
  const seen = new Set<string>();
  const out: Assignment[] = [];
  for (const badge of assignments) {
    const key = `${badge.provider}:${badge.id}:${badge.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(badge);
  }
  return out;
}

function normalizedTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

function dedupeStreamNookClientMirrors(assignments: Assignment[]): Assignment[] {
  const seenTitles = new Set<string>();
  const out: Assignment[] = [];

  for (const badge of assignments) {
    if (!STREAMNOOK_CHAT_CLIENT_PROVIDERS.has(badge.provider)) {
      out.push(badge);
      continue;
    }

    const title = normalizedTitle(badge.title);
    if (title && seenTitles.has(title)) continue;
    if (title) seenTitles.add(title);
    out.push(badge);
  }

  return out;
}

function applyProviderMultiplicity(assignments: Assignment[]): Assignment[] {
  let out = dedupeStreamNookClientMirrors(assignments);

  const blue = out.filter((badge) => badge.provider === 'bluzyrino');
  if (blue.length > 1) {
    const keep = blue[blue.length - 1];
    out = out.filter((badge) => badge.provider !== 'bluzyrino' || badge === keep);
  }

  /* Turteg mirrors the FFZ family. The official FFZ feed stays canonical and
     only one FFZ-family badge is emitted for a chatter. Chatty re-hosts FFZ
     badges too; the title de-duplication above removes that duplicate first. */
  const officialFfz = out.filter((badge) => badge.provider === 'ffz');
  const mirroredFfz = out.filter((badge) => badge.provider === 'turteg');
  if (officialFfz.length || mirroredFfz.length) {
    const keep = officialFfz[officialFfz.length - 1]
      ?? mirroredFfz[mirroredFfz.length - 1];
    out = out.filter(
      (badge) => (badge.provider !== 'ffz' && badge.provider !== 'turteg') || badge === keep,
    );
  }

  return out;
}

export async function resolveTwitchCommunityBadges(
  userId: string,
  username: string,
): Promise<UnifiedBadge[]> {
  if (!userId && !username) return [];
  let loaded: Registry;
  try {
    loaded = await registry();
  } catch {
    return [];
  }

  const matches = [
    ...(userId ? loaded.byUserId.get(userId) ?? [] : []),
    ...(username ? loaded.byUsername.get(username.toLowerCase()) ?? [] : []),
  ];

  return applyProviderMultiplicity(dedupe(matches)).map((badge) => ({
    type: `community:${badge.provider}:${slug(badge.id)}`,
    url: badge.url,
    ...(badge.backgroundColor ? { backgroundColor: badge.backgroundColor } : {}),
  }));
}

export function __resetCommunityBadgeCache(): void {
  cachedRegistry = null;
  cachedAt = 0;
  inFlight = null;
}
