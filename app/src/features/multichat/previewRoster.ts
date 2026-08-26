import type { PreviewIdentityTemplate } from '@/components/classic/useChatPreviewSimulator';
import {
  mergePreviewIdentityBadgeMaps,
  type PreviewIdentityResponse,
} from '@/features/multichat/previewIdentity';
import type { Platform, UnifiedBadge } from '@/lib/types';

export type PreviewRosterEntry = {
  readonly login: string;
  readonly displayName: string;
  readonly fallbackText: string;
};

export const PREVIEW_MESSAGES = [
  'Alright',
  '!vanish peepoVanish',
  'Thats a real jammer ShoulderDance RaveTime',
  'aga life is like a box of chocolate, you never know when im gonna eat them all catEat',
  'Pog chat overlay with better zero width emotes catJAM WideRaveTime ALERT',
  '@uniiDev yugi61',
  'gżegżółka bah',
  "I'm thinking Miku, Miku Ooh-ee-ooh",
] as const;

export const PREVIEW_ROSTER = [
  { login: 'gxufy', displayName: 'gxufy', fallbackText: PREVIEW_MESSAGES[0] },
  { login: 'blu01_', displayName: 'blu01_', fallbackText: PREVIEW_MESSAGES[1] },
  { login: 'uniidev', displayName: 'uniiDev', fallbackText: PREVIEW_MESSAGES[2] },
  { login: 'xslash58', displayName: 'Xslash58', fallbackText: PREVIEW_MESSAGES[3] },
  { login: 'moltobenne_', displayName: 'moltobenne_', fallbackText: PREVIEW_MESSAGES[4] },
  { login: 'said', displayName: 'Said', fallbackText: PREVIEW_MESSAGES[5] },
  { login: 'slaiqe', displayName: 'slaiqe', fallbackText: PREVIEW_MESSAGES[6] },
  { login: 'wtwfrxsty', displayName: 'wtwfrxsty', fallbackText: PREVIEW_MESSAGES[7] },
] as const satisfies readonly PreviewRosterEntry[];

export const PREVIEW_ROSTER_CONCURRENCY = 3;
export const PREVIEW_PLATFORM_SEQUENCE = [
  'twitch', 'youtube', 'kick', 'tiktok', 'youtube', 'twitch', 'kick',
  'youtube', 'tiktok', 'kick', 'twitch', 'tiktok', 'youtube', 'kick',
] as const satisfies readonly Platform[];

function visualPlatform(index: number, page: number): Platform {
  return PREVIEW_PLATFORM_SEQUENCE[(page * PREVIEW_ROSTER.length + index) % PREVIEW_PLATFORM_SEQUENCE.length]!;
}

function badgeFromDescriptor(descriptor: string, image: string): UnifiedBadge {
  const separator = descriptor.indexOf('/');
  return {
    type: descriptor.slice(0, separator),
    version: descriptor.slice(separator + 1),
    url: image,
  };
}

export function curatedBadges(
  _entry: PreviewRosterEntry,
  response: PreviewIdentityResponse | undefined,
  _page: number,
): UnifiedBadge[] {
  if (!response) return [];

  const artwork = mergePreviewIdentityBadgeMaps(response.providers);
  const seenUrl = new Set<string>();
  const badges: UnifiedBadge[] = [];

  for (const [descriptor, image] of Object.entries(artwork)) {
    if (!descriptor.startsWith('community:') || seenUrl.has(image)) continue;
    seenUrl.add(image);
    badges.push(badgeFromDescriptor(descriptor, image));
  }

  const owned = [
    ...(response.providers.BTTV?.resources.ownedBadges ?? []),
    ...(response.providers.FFZ?.resources.ownedBadges ?? []),
  ];
  for (const badge of owned) {
    if (seenUrl.has(badge.image)) continue;
    seenUrl.add(badge.image);
    badges.push({ type: badge.id, url: badge.image });
  }

  return badges;
}

function template(
  entry: PreviewRosterEntry,
  index: number,
  page: number,
  response: PreviewIdentityResponse | undefined,
  text: string,
  suffix = '',
): PreviewIdentityTemplate {
  return {
    templateId: `roster-${entry.login}${suffix}`,
    platform: 'twitch',
    displayPlatform: visualPlatform(index, page),
    senderId: response?.identity.userId ?? `preview-roster-${entry.login}`,
    username: entry.displayName,
    color: '#a970ff',
    badges: curatedBadges(entry, response, page),
    text,
    emotes: [],
    kind: 'chat',
  };
}

export function fallbackRosterTemplate(entry: PreviewRosterEntry, index = 0, page = 0): PreviewIdentityTemplate {
  return template(entry, index, page, undefined, entry.fallbackText, '-fallback');
}

export function rosterTemplates(
  responses: ReadonlyMap<string, PreviewIdentityResponse>,
  page: number,
): readonly PreviewIdentityTemplate[] {
  return PREVIEW_ROSTER.map((entry, index) => template(
    entry,
    index,
    page,
    responses.get(entry.login),
    PREVIEW_MESSAGES[(index + page) % PREVIEW_MESSAGES.length]!,
  ));
}

export function rosterFeedTemplates(
  responses: ReadonlyMap<string, PreviewIdentityResponse>,
  page: number,
): readonly PreviewIdentityTemplate[] {
  const visible = rosterTemplates(responses, page);
  const second = template(
    PREVIEW_ROSTER[0],
    PREVIEW_ROSTER.length,
    page,
    responses.get(PREVIEW_ROSTER[0].login),
    PREVIEW_MESSAGES[(PREVIEW_ROSTER.length + page) % PREVIEW_MESSAGES.length]!,
    '-second',
  );
  return [...visible, second];
}
