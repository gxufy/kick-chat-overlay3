from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"expected text not found in {path}: {old[:180]!r}")
    p.write_text(text.replace(old, new, 1))


# ---------------------------------------------------------------------------
# Unified model: Kick replies are presentation data, not provider-specific DOM.
# ---------------------------------------------------------------------------
replace_once(
    'src/lib/types.ts',
    "export interface TwitchSourceChannel {\n",
    "export interface UnifiedReply {\n"
    "  /** Provider message id of the parent, when available. */\n"
    "  messageId?: string;\n"
    "  /** Provider user id of the parent author, when available. */\n"
    "  senderId?: string;\n"
    "  username: string;\n"
    "  text: string;\n"
    "}\n\n"
    "export interface TwitchSourceChannel {\n",
)
replace_once(
    'src/lib/types.ts',
    "  /** avatar URL — yt/tiktok only (StreamNook: other platforms don't carry one) */\n  avatar?: string;\n",
    "  /** avatar URL — yt/tiktok only (StreamNook: other platforms don't carry one) */\n  avatar?: string;\n"
    "  /** Provider-native reply preview (currently Kick). */\n"
    "  reply?: UnifiedReply;\n",
)

# ---------------------------------------------------------------------------
# Kick channel helpers: use our same-origin backend first, then direct Kick.
# 7TV calls YouTube GOOGLE; expose a friendly 'youtube' option to callers.
# ---------------------------------------------------------------------------
replace_once(
    'src/lib/kick.ts',
    "export async function getKickChannel(channel: string, signal?: AbortSignal): Promise<KickChannel | null> {\n"
    "  try {\n"
    "    const res = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(channel)}`, {\n"
    "      headers: { 'Accept': 'application/json' },\n"
    "      signal,\n"
    "    });\n"
    "    if (!res.ok) return null;\n"
    "    return parseKickChannel(await res.json());\n"
    "  } catch (error) {\n"
    "    if (error instanceof DOMException && error.name === 'AbortError') throw error;\n"
    "    return null;\n"
    "  }\n"
    "}\n",
    "export async function getKickChannel(channel: string, signal?: AbortSignal): Promise<KickChannel | null> {\n"
    "  const clean = channel.replace(/^@/, '').trim();\n"
    "  const urls = [\n"
    "    `/api/kick/channel?channel=${encodeURIComponent(clean)}`,\n"
    "    `https://kick.com/api/v2/channels/${encodeURIComponent(clean)}`,\n"
    "  ];\n"
    "  for (const url of urls) {\n"
    "    try {\n"
    "      const res = await fetch(url, { headers: { Accept: 'application/json' }, signal, cache: 'no-store' });\n"
    "      if (!res.ok) continue;\n"
    "      const parsed = parseKickChannel(await res.json());\n"
    "      if (parsed) return parsed;\n"
    "    } catch (error) {\n"
    "      if (error instanceof DOMException && error.name === 'AbortError') throw error;\n"
    "    }\n"
    "  }\n"
    "  return null;\n"
    "}\n",
)
replace_once(
    'src/lib/kick.ts',
    "export async function getSevenTVChannelEmotes(userId: string, platform: 'kick' | 'twitch' = 'kick'): Promise<{ emotes: SevenTVEmote[]; setId: string | null; stvUserId: string | null }> {\n"
    "  try {\n"
    "    const res = await fetch(`https://7tv.io/v3/users/${platform}/${userId}`);",
    "export async function getSevenTVChannelEmotes(userId: string, platform: 'kick' | 'twitch' | 'youtube' = 'kick'): Promise<{ emotes: SevenTVEmote[]; setId: string | null; stvUserId: string | null }> {\n"
    "  try {\n"
    "    // 7TV's public platform name for YouTube accounts is GOOGLE.\n"
    "    const endpointPlatform = platform === 'youtube' ? 'google' : platform;\n"
    "    const res = await fetch(`https://7tv.io/v3/users/${endpointPlatform}/${userId}`);",
)
replace_once(
    'src/lib/kick.ts',
    "  /** Twitch Shared Chat source streamer, distinct from the author. */\n  sourceChannel?: TwitchSourceChannel;\n",
    "  /** Twitch Shared Chat source streamer, distinct from the author. */\n  sourceChannel?: TwitchSourceChannel;\n"
    "  /** Provider-native reply preview. */\n"
    "  reply?: { username: string; text: string; messageId?: string; senderId?: string };\n",
)

# ---------------------------------------------------------------------------
# Kick connector: combined ordered badges, recent context, live/history dedupe,
# reply metadata, provider timestamps, and defensive double-encoded payloads.
# ---------------------------------------------------------------------------
Path('src/lib/connectors/kick.ts').write_text(r'''import Pusher from 'pusher-js';
import { getKickChannel, type KickChannel } from '../kick';
import type { Connector, ConnectorCallbacks, UnifiedBadge, UnifiedEmote, UnifiedMessage } from '../types';

const KICK_EMOTE_RE = /\[(?:emote|emoji):(\w+):([^\]]*)\]/g;
export const KICK_HISTORY_MAX = 40;
const KICK_HISTORY_TIMEOUT_MS = 2_500;
const KICK_SEEN_MAX = 512;

function decodeKickPayload(value: any): any {
  if (typeof value !== 'string') return value ?? {};
  try { return JSON.parse(value); } catch { return {}; }
}

function finiteNumber(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function safeImage(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** Replace Kick's native emote tokens while recording codepoint offsets. */
export function parseKickEmotes(content: string): { text: string; emotes: UnifiedEmote[] } {
  const emotes: UnifiedEmote[] = [];
  let text = '';
  let last = 0;
  for (const match of content.matchAll(KICK_EMOTE_RE)) {
    text += content.slice(last, match.index);
    const name = match[2] || 'emote';
    const begin = Array.from(text).length;
    emotes.push({
      begin,
      end: begin + Array.from(name).length,
      text: name,
      url: `https://files.kick.com/emotes/${match[1]}/fullsize`,
    });
    text += name;
    last = match.index! + match[0].length;
  }
  text += content.slice(last);
  return { text, emotes };
}

function plainKickText(content: unknown): string {
  return parseKickEmotes(typeof content === 'string' ? content : '').text;
}

/** Merge legacy role badges and image-backed badges by Kick's own sort_order. */
export function buildKickBadges(rawMsg: any): UnifiedBadge[] {
  const identity = rawMsg?.sender?.identity ?? {};
  const ordered: Array<{ order: number; index: number; badge: UnifiedBadge }> = [];
  let index = 0;

  for (const badge of Array.isArray(identity.badges) ? identity.badges : []) {
    if (typeof badge?.type !== 'string' || !badge.type) continue;
    const count = finiteNumber(badge.count ?? badge.rank);
    const order = finiteNumber(badge.sort_order) ?? 1_000;
    ordered.push({
      order,
      index: index++,
      badge: {
        type: badge.type,
        ...(count !== undefined ? { count, version: String(count) } : {}),
      },
    });
  }

  for (const badge of Array.isArray(identity.badges_v2) ? identity.badges_v2 : []) {
    const url = safeImage(badge?.image_url);
    if (!url) continue;
    const level = finiteNumber(badge?.metadata?.level);
    const order = finiteNumber(badge?.sort_order) ?? 1_000;
    ordered.push({
      order,
      index: index++,
      badge: {
        type: typeof badge?.name === 'string' && badge.name ? badge.name : 'v2',
        url,
        ...(level !== undefined ? { count: level, version: String(level) } : {}),
      },
    });
  }

  ordered.sort((a, b) => a.order - b.order || a.index - b.index);
  return ordered.map((entry) => entry.badge);
}

function kickTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

export function buildKickMessage(input: any): UnifiedMessage {
  const rawMsg = decodeKickPayload(input);
  const { text, emotes } = parseKickEmotes(typeof rawMsg.content === 'string' ? rawMsg.content : '');
  const sender = rawMsg.sender ?? {};
  const metadata = rawMsg.type === 'reply' ? rawMsg.metadata : null;
  const parentSender = metadata?.original_sender;
  const parentMessage = metadata?.original_message;
  const reply = metadata && parentSender && parentMessage
    ? {
        username: String(parentSender.username ?? parentSender.slug ?? 'Unknown'),
        text: plainKickText(parentMessage.content),
        ...(parentMessage.id ? { messageId: String(parentMessage.id) } : {}),
        ...(parentSender.id !== undefined ? { senderId: String(parentSender.id) } : {}),
      }
    : undefined;

  return {
    platform: 'kick',
    id: String(rawMsg.id ?? `kick-${Date.now()}-${Math.random().toString(36).slice(2)}`),
    senderId: sender.id?.toString() ?? '',
    username: sender.username ?? sender.slug ?? '',
    color: sender.identity?.color || '#ffffff',
    badges: buildKickBadges(rawMsg),
    text,
    emotes,
    timestamp: kickTimestamp(rawMsg.created_at ?? rawMsg.timestamp),
    kind: 'chat',
    ...(reply ? { reply } : {}),
  };
}

async function historyResponse(channelId: number, signal?: AbortSignal): Promise<any | null> {
  const urls = [
    `/api/kick/history?channelId=${encodeURIComponent(String(channelId))}`,
    `https://kick.com/api/v2/channels/${channelId}/messages`,
  ];
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal,
        cache: 'no-store',
      });
      if (response.ok) return await response.json();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
    }
  }
  return null;
}

/** Seed recent Kick context oldest-to-newest using the same parser as live rows. */
export async function fetchKickHistory(channel: KickChannel, signal?: AbortSignal): Promise<UnifiedMessage[]> {
  const body = await historyResponse(channel.id, signal);
  const rows = body?.data?.messages;
  if (!Array.isArray(rows)) return [];
  return rows
    .slice(0, KICK_HISTORY_MAX)
    .reverse()
    .map(buildKickMessage)
    .filter((message) => Boolean(message.id));
}

export interface KickConnectorOpts extends ConnectorCallbacks {
  channel: string;
  onChannelInfo?(channel: KickChannel): void;
}

export function createKickConnector(opts: KickConnectorOpts): Connector {
  let pusher: Pusher | null = null;
  let watchdog: ReturnType<typeof setInterval> | null = null;
  let historyAbort: AbortController | null = null;
  let stopped = false;
  let bootstrappingHistory = true;
  const pendingLive: UnifiedMessage[] = [];
  const seen = new Set<string>();
  const seenOrder: string[] = [];

  function remember(id: string): boolean {
    if (seen.has(id)) return false;
    seen.add(id);
    seenOrder.push(id);
    while (seenOrder.length > KICK_SEEN_MAX) {
      const old = seenOrder.shift();
      if (old) seen.delete(old);
    }
    return true;
  }

  function deliver(message: UnifiedMessage): void {
    if (!message.id || !remember(message.id)) return;
    opts.onMessage(message);
  }

  function deliverLive(message: UnifiedMessage): void {
    if (bootstrappingHistory) pendingLive.push(message);
    else deliver(message);
  }

  function systemMessage(text: string, username: string, category: UnifiedMessage['category']) {
    opts.onMessage({
      platform: 'kick',
      id: `sys-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      senderId: '',
      username,
      color: '',
      badges: [],
      text,
      emotes: [],
      timestamp: Date.now(),
      kind: 'system',
      category,
    });
  }

  async function start() {
    opts.onStatus('connecting');
    const channel = await getKickChannel(opts.channel);
    if (!channel) {
      opts.onStatus('error', `Could not find Kick channel: "${opts.channel}"`);
      return;
    }
    if (stopped) return;
    opts.onChannelInfo?.(channel);

    pusher = new Pusher('32cbd69e4b950bf97679', {
      cluster: 'us2',
      disableStats: true,
      activityTimeout: 20_000,
      pongTimeout: 8_000,
    });

    const chatroomName = `chatrooms.${channel.chatroom.id}.v2`;
    const channelId = channel.id;

    function bindChannel() {
      if (!pusher) return;
      const chat = pusher.subscribe(chatroomName);
      chat.bind('App\\Events\\ChatMessageEvent', (data: any) => {
        const raw = decodeKickPayload(data);
        const message = buildKickMessage(raw);
        if (raw.type === 'celebration' || raw.metadata?.celebration || raw.metadata?.reward) {
          message.redeem = raw.metadata?.reward?.title ?? 'celebration';
        }
        deliverLive(message);
      });
      chat.bind('App\\Events\\RewardRedeemedEvent', (data: any) => {
        const d = decodeKickPayload(data);
        opts.onMessage({
          platform: 'kick',
          id: `redeem-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          senderId: d.user_id?.toString() ?? '',
          username: d.username ?? 'Someone',
          color: '', badges: [], emotes: [], timestamp: Date.now(), kind: 'chat',
          text: d.user_input ? `${d.reward_title}: ${d.user_input}` : (d.reward_title ?? 'redeemed a reward'),
          redeem: d.reward_title ?? 'reward',
        });
      });
      chat.bind('App\\Events\\MessageDeletedEvent', (data: any) => {
        const d = decodeKickPayload(data);
        const id = d.message?.id ?? d.message_id;
        if (id) opts.onDelete({ id: String(id) });
      });
      chat.bind('App\\Events\\UserBannedEvent', (data: any) => {
        const d = decodeKickPayload(data);
        const senderId = d.user?.id?.toString();
        const username = d.user?.username;
        opts.onDelete({ ...(senderId ? { senderId } : {}), ...(username ? { username } : {}) });
      });
      chat.bind('App\\Events\\ChatroomClearEvent', () => opts.onDelete({}));
      chat.bind('App\\Events\\PinnedMessageCreatedEvent', (data: any) => {
        const d = decodeKickPayload(data);
        if (d?.message) opts.onPin({ message: buildKickMessage(d.message), pinnedBy: d.pinnedBy?.username });
      });
      chat.bind('App\\Events\\PinnedMessageDeletedEvent', () => opts.onPin(null));
      chat.bind('App\\Events\\SubscriptionEvent', (data: any) => {
        const d = decodeKickPayload(data);
        const months = Number(d.months ?? 0);
        const username = d.username ?? d.user?.username ?? '';
        systemMessage(`${username} subscribed!${months > 1 ? ` (${months} months)` : ''}`, username, 'subscription');
      });
      chat.bind('App\\Events\\GiftedSubscriptionsEvent', (data: any) => {
        const d = decodeKickPayload(data);
        const count = Array.isArray(d.gifted_usernames) ? d.gifted_usernames.length : Number(d.count ?? 1);
        const username = d.gifter_username ?? d.gifter?.username ?? '';
        systemMessage(`${username} gifted ${count} subscription${count === 1 ? '' : 's'}!`, username, 'gift');
      });
      chat.bind('App\\Events\\StreamHostEvent', (data: any) => {
        const d = decodeKickPayload(data);
        const username = d.host_username ?? d.host?.username ?? '';
        systemMessage(`${username} is hosting with ${d.number_viewers ?? '?'} viewers!`, username, 'raid');
      });

      const kicksHandler = (data: any) => {
        const d = decodeKickPayload(data);
        const sender = d?.sender?.username ?? 'Someone';
        const gift = d?.gift;
        if (!gift) return;
        systemMessage(`${sender} sent ${gift.name ?? 'a gift'} (${gift.amount ?? '?'} Kicks)`, sender, 'cheer');
      };
      pusher.subscribe(`channel.${channelId}`).bind('KicksGifted', kicksHandler);
      pusher.subscribe(`channel_${channelId}`).bind('KicksGifted', kicksHandler);
    }

    bindChannel();

    pusher.connection.bind('connected', () => {
      opts.onStatus('connected');
      if (pusher && !pusher.channel(chatroomName)) bindChannel();
    });
    pusher.connection.bind('state_change', ({ current }: { current: string }) => {
      if (current === 'disconnected' && !stopped) setTimeout(() => pusher?.connect(), 2_000);
    });
    watchdog = setInterval(() => {
      const state = pusher?.connection.state;
      if (state === 'unavailable' || state === 'failed') {
        pusher?.disconnect();
        setTimeout(() => pusher?.connect(), 2_000);
      }
    }, 10_000);

    historyAbort = new AbortController();
    const historyTimeout = setTimeout(() => historyAbort?.abort(), KICK_HISTORY_TIMEOUT_MS);
    try {
      const history = await fetchKickHistory(channel, historyAbort.signal);
      if (!stopped) history.forEach(deliver);
    } catch {
      // History is optional context; the live socket remains authoritative.
    } finally {
      clearTimeout(historyTimeout);
      historyAbort = null;
      bootstrappingHistory = false;
      if (!stopped) pendingLive.splice(0).forEach(deliver);
    }
  }

  return {
    start() { void start(); },
    stop() {
      stopped = true;
      historyAbort?.abort();
      if (watchdog) clearInterval(watchdog);
      pusher?.disconnect();
      pendingLive.length = 0;
    },
  };
}
''')

# ---------------------------------------------------------------------------
# YouTube connector: Live-chat backlog semantics, bounded replay suppression,
# 150ms-or-faster live pacing, action aliases, gift redemption, and channel id.
# ---------------------------------------------------------------------------
Path('src/lib/connectors/youtube.ts').write_text(r'''import type { Connector, ConnectorCallbacks, UnifiedBadge, UnifiedEmote, UnifiedMessage } from '../types';

const OFFLINE_RECHECK_MS = 60_000;
const POLL_FLOOR_MS = 800;
export const YOUTUBE_DELIVERY_INTERVAL_MS = 150;
export const YOUTUBE_BACKLOG_KEEP = 30;
const YOUTUBE_SEEN_MAX = 512;
const RETRY_START_MS = 3_000;
const RETRY_MAX_MS = 12_000;

interface Bootstrap {
  videoId: string;
  apiKey: string;
  clientVersion: string;
  continuation: string;
  channelId?: string;
}
interface ParsedRuns { text: string; emotes: UnifiedEmote[] }

function codepointLength(value: string): number { return Array.from(value).length; }

function normalizeImageUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const raw = value.startsWith('//') ? `https:${value}` : value;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch { return undefined; }
}

function bestThumbnail(thumbnails: any): string | undefined {
  if (!Array.isArray(thumbnails)) return undefined;
  return thumbnails
    .map((thumbnail, index) => ({
      url: normalizeImageUrl(thumbnail?.url),
      area: Number(thumbnail?.width || 0) * Number(thumbnail?.height || 0),
      index,
    }))
    .filter((thumbnail): thumbnail is { url: string; area: number; index: number } => Boolean(thumbnail.url))
    .sort((a, b) => b.area - a.area || b.index - a.index)[0]?.url;
}

function authorAvatar(renderer: any): string | undefined {
  const avatar = bestThumbnail(renderer?.authorPhoto?.thumbnails);
  return avatar?.replace(/=s\d+(?=-|$)/, '=s160');
}

/** Flatten InnerTube runs into fallback text plus native image-emote offsets. */
export function parseRuns(runs: any[]): ParsedRuns {
  let text = '';
  const emotes: UnifiedEmote[] = [];
  for (const run of Array.isArray(runs) ? runs : []) {
    if (typeof run?.text === 'string') { text += run.text; continue; }
    const emoji = run?.emoji;
    if (!emoji) continue;
    if (!emoji.isCustomEmoji) {
      if (typeof emoji.emojiId === 'string') text += emoji.emojiId;
      continue;
    }
    const shortcut = Array.isArray(emoji.shortcuts)
      ? emoji.shortcuts.find((candidate: unknown) => typeof candidate === 'string' && candidate.length)
      : undefined;
    const rawName = shortcut ?? (typeof emoji.emojiId === 'string' ? emoji.emojiId : 'emote');
    const name = rawName.replace(/^:+|:+$/g, '') || 'emote';
    const begin = codepointLength(text);
    text += name;
    const url = bestThumbnail(emoji.image?.thumbnails);
    if (url) emotes.push({ begin, end: begin + codepointLength(name), text: name, url });
  }
  return { text, emotes };
}

function parseText(value: any): ParsedRuns {
  if (Array.isArray(value?.runs)) return parseRuns(value.runs);
  return { text: typeof value?.simpleText === 'string' ? value.simpleText : '', emotes: [] };
}
function appendText(target: ParsedRuns, value: string) { target.text += value; }
function appendRuns(target: ParsedRuns, value: ParsedRuns) {
  const shift = codepointLength(target.text);
  target.text += value.text;
  target.emotes.push(...value.emotes.map((emote) => ({ ...emote, begin: emote.begin + shift, end: emote.end + shift })));
}

function canonicalBadgeType(renderer: any, hasThumbnail: boolean): string | null {
  if (hasThumbnail) return 'subscriber';
  const value = `${renderer?.icon?.iconType ?? ''} ${renderer?.tooltip ?? ''}`.trim().toLowerCase();
  if (/\b(owner|channel owner)\b/.test(value)) return 'owner';
  if (/\bmoderator\b/.test(value)) return 'moderator';
  if (/\bverified\b/.test(value)) return 'verified';
  return null;
}

function authorBadges(renderer: any): UnifiedBadge[] {
  const badges: UnifiedBadge[] = [];
  for (const value of Array.isArray(renderer?.authorBadges) ? renderer.authorBadges : []) {
    const badge = value?.liveChatAuthorBadgeRenderer;
    if (!badge) continue;
    const url = bestThumbnail(badge.customThumbnail?.thumbnails);
    const type = canonicalBadgeType(badge, Boolean(url));
    if (type) badges.push({ type, ...(url ? { url } : {}) });
  }
  return badges;
}
function authorName(renderer: any): string { return parseText(renderer?.authorName).text; }
function timestamp(renderer: any): number {
  const usec = Number(renderer?.timestampUsec);
  return Number.isFinite(usec) && usec > 0 ? Math.floor(usec / 1000) : Date.now();
}

function buildMessage(renderer: any): UnifiedMessage | null {
  if (!renderer?.id) return null;
  const { text, emotes } = parseText(renderer.message);
  return {
    platform: 'youtube', id: renderer.id,
    senderId: renderer.authorExternalChannelId ?? '', username: authorName(renderer), color: '',
    badges: authorBadges(renderer), text, emotes, timestamp: timestamp(renderer), kind: 'chat',
    avatar: authorAvatar(renderer),
  };
}

function buildModeMessage(renderer: any): UnifiedMessage | null {
  if (!renderer?.id) return null;
  const visible = parseText(renderer.text ?? renderer.message ?? renderer.subtext ?? renderer.primaryText);
  if (!visible.text) return null;
  return {
    platform: 'youtube', id: renderer.id, senderId: '', username: 'YouTube', color: '', badges: [],
    text: visible.text, emotes: visible.emotes, timestamp: timestamp(renderer), kind: 'system', category: 'announcement',
  };
}

/** Paid, membership and membership-gift renderers -> normalized event rows. */
function buildSystemMessage(item: any): UnifiedMessage | null {
  const paid = item.liveChatPaidMessageRenderer;
  const sticker = item.liveChatPaidStickerRenderer;
  const member = item.liveChatMembershipItemRenderer;
  const gift = item.liveChatSponsorshipsGiftPurchaseAnnouncementRenderer;
  const redemption = item.liveChatSponsorshipsGiftRedemptionAnnouncementRenderer;
  if (item.liveChatModeChangeMessageRenderer) return buildModeMessage(item.liveChatModeChangeMessageRenderer);

  const renderer = paid ?? sticker ?? member
    ?? (gift ? gift.header?.liveChatSponsorshipsHeaderRenderer : null)
    ?? redemption;
  const id = paid?.id ?? sticker?.id ?? member?.id ?? gift?.id ?? redemption?.id;
  if (!renderer || !id) return null;

  const author = authorName(renderer) || 'Someone';
  const displayAuthor = author.replace(/^@/, '');
  const content: ParsedRuns = { text: '', emotes: [] };
  let category: UnifiedMessage['category'];

  if (paid) {
    appendText(content, `${displayAuthor} sent a ${parseText(paid.purchaseAmountText).text} Super Chat`);
    const body = parseText(paid.message);
    if (body.text) appendText(content, ': ');
    appendRuns(content, body);
    category = 'cheer';
  } else if (sticker) {
    appendText(content, `${displayAuthor} sent a ${parseText(sticker.purchaseAmountText).text} Super Sticker!`);
    const stickerUrl = bestThumbnail(sticker.sticker?.thumbnails);
    if (stickerUrl) {
      const label = parseText(sticker.stickerDisplayText).text || 'Super Sticker';
      appendText(content, ' ');
      const begin = codepointLength(content.text);
      appendText(content, label);
      content.emotes.push({ begin, end: begin + codepointLength(label), text: label, url: stickerUrl });
    }
    category = 'cheer';
  } else if (gift) {
    appendText(content, `${displayAuthor} `);
    const primary = parseText(renderer.primaryText);
    appendRuns(content, primary.text ? primary : { text: 'gifted memberships!', emotes: [] });
    category = 'gift';
  } else if (redemption) {
    appendText(content, `${displayAuthor} `);
    const body = parseText(redemption.message ?? redemption.primaryText ?? redemption.subtext);
    appendRuns(content, body.text ? body : { text: 'received a gifted membership!', emotes: [] });
    category = 'gift';
  } else {
    appendText(content, `${displayAuthor} `);
    const header = parseText(member.headerSubtext);
    appendRuns(content, header.text ? header : { text: 'became a member!', emotes: [] });
    const body = parseText(member.message);
    if (body.text) appendText(content, ': ');
    appendRuns(content, body);
    category = 'subscription';
  }

  return {
    platform: 'youtube', id, senderId: renderer.authorExternalChannelId ?? '', username: author, color: '',
    badges: authorBadges(renderer), text: content.text, emotes: content.emotes,
    timestamp: timestamp(renderer), kind: 'system', category, avatar: authorAvatar(renderer),
  };
}

function itemId(item: any): string | null {
  if (!item || typeof item !== 'object') return null;
  for (const renderer of Object.values(item) as any[]) {
    if (renderer && typeof renderer.id === 'string') return renderer.id;
  }
  return null;
}

function itemSenderId(item: any): string | null {
  if (!item || typeof item !== 'object') return null;
  for (const renderer of Object.values(item) as any[]) {
    const id = renderer?.authorExternalChannelId
      ?? renderer?.header?.liveChatSponsorshipsHeaderRenderer?.authorExternalChannelId;
    if (typeof id === 'string' && id) return id;
  }
  return null;
}

export interface YouTubeConnectorOpts extends ConnectorCallbacks {
  channel: string;
  onChannelInfo?(info: { channelId: string; videoId: string }): void;
}

export function createYouTubeConnector(opts: YouTubeConnectorOpts): Connector {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let deliveryTimer: ReturnType<typeof setTimeout> | null = null;
  let deliveryDelay = YOUTUBE_DELIVERY_INTERVAL_MS;
  let firstBatch = true;
  let backoff = RETRY_START_MS;
  const deliveryQueue: UnifiedMessage[] = [];
  const seen = new Set<string>();
  const seenOrder: string[] = [];

  function remember(id: string): boolean {
    if (seen.has(id)) return false;
    seen.add(id);
    seenOrder.push(id);
    while (seenOrder.length > YOUTUBE_SEEN_MAX) {
      const old = seenOrder.shift();
      if (old) seen.delete(old);
    }
    return true;
  }

  function schedule(fn: () => void, ms: number) {
    if (!stopped) timer = setTimeout(fn, ms);
  }

  function releaseMessage() {
    deliveryTimer = null;
    if (stopped) return;
    const message = deliveryQueue.shift();
    if (message) opts.onMessage(message);
    if (deliveryQueue.length) deliveryTimer = setTimeout(releaseMessage, deliveryDelay);
  }

  function emitMessage(message: UnifiedMessage, immediate: boolean, delayMs: number): void {
    if (!remember(message.id)) return;
    if (immediate) {
      opts.onMessage(message);
      return;
    }
    deliveryQueue.push(message);
    deliveryDelay = Math.max(0, Math.min(YOUTUBE_DELIVERY_INTERVAL_MS, delayMs));
    if (!deliveryTimer) deliveryTimer = setTimeout(releaseMessage, 0);
  }

  function deleteQueued(target: { id?: string; senderId?: string }): void {
    for (let index = deliveryQueue.length - 1; index >= 0; index -= 1) {
      const message = deliveryQueue[index];
      if (target.id === message.id || (target.senderId && target.senderId === message.senderId)) {
        deliveryQueue.splice(index, 1);
      }
    }
    opts.onDelete(target);
  }

  async function bootstrap() {
    if (stopped) return;
    opts.onStatus('connecting');
    try {
      const response = await fetch(`/api/youtube/live?channel=${encodeURIComponent(opts.channel)}`);
      const data = await response.json();
      if (data.offline) {
        opts.onStatus('offline', 'Channel is not live');
        schedule(bootstrap, OFFLINE_RECHECK_MS);
        return;
      }
      if (!response.ok || data.error) {
        opts.onStatus('error', data.error ?? `HTTP ${response.status}`);
        schedule(bootstrap, OFFLINE_RECHECK_MS);
        return;
      }
      const boot = data as Bootstrap;
      if (boot.channelId) opts.onChannelInfo?.({ channelId: boot.channelId, videoId: boot.videoId });
      opts.onStatus('connected');
      poll(boot, boot.continuation, 1_000);
    } catch (error: any) {
      opts.onStatus('error', error?.message);
      schedule(bootstrap, OFFLINE_RECHECK_MS);
    }
  }

  function nextContinuation(cont: any): { continuation: string | null; timeoutMs: number } {
    for (const value of cont?.continuations ?? []) {
      const data = value.invalidationContinuationData ?? value.timedContinuationData ?? value.reloadContinuationData;
      if (data?.continuation) {
        const raw = typeof data.timeoutMs === 'number' ? data.timeoutMs : 2_000;
        return { continuation: data.continuation, timeoutMs: Math.min(Math.max(raw, 1_000), 2_000) };
      }
    }
    return { continuation: null, timeoutMs: 2_000 };
  }

  async function poll(boot: Bootstrap, continuation: string, delayMs: number) {
    schedule(async () => {
      try {
        const response = await fetch('/api/youtube/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: boot.apiKey, clientVersion: boot.clientVersion, continuation }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        backoff = RETRY_START_MS;
        const cont = data?.continuationContents?.liveChatContinuation;
        if (!cont) {
          opts.onStatus('offline', 'Stream ended');
          schedule(bootstrap, OFFLINE_RECHECK_MS);
          return;
        }

        const next = nextContinuation(cont);
        const actions: any[] = Array.isArray(cont.actions) ? cont.actions : [];
        const additions = actions.filter((action) => action?.addChatItemAction?.item);
        const backlogKeep = new Set(firstBatch ? additions.slice(-YOUTUBE_BACKLOG_KEEP) : additions);
        const deletedIds = new Set<string>();
        const deletedAuthors = new Set<string>();
        for (const action of actions) {
          const id = action.markChatItemAsDeletedAction?.targetItemId ?? action.removeChatItemAction?.targetItemId;
          if (id) deletedIds.add(String(id));
          const author = action.markChatItemsByAuthorAsDeletedAction?.externalChannelId
            ?? action.removeChatItemByAuthorAction?.externalChannelId;
          if (author) deletedAuthors.add(String(author));
        }
        const pace = Math.min(
          YOUTUBE_DELIVERY_INTERVAL_MS,
          Math.max(0, Math.floor(next.timeoutMs / Math.max(1, additions.length))),
        );

        for (const action of actions) {
          const item = action?.addChatItemAction?.item;
          if (item && firstBatch && !backlogKeep.has(action)) {
            const skippedId = itemId(item);
            if (skippedId) remember(skippedId);
            continue;
          }
          handleAction(action, firstBatch, pace, deletedIds, deletedAuthors);
        }
        firstBatch = false;

        if (!next.continuation) {
          opts.onStatus('offline', 'Stream ended');
          schedule(bootstrap, OFFLINE_RECHECK_MS);
          return;
        }
        poll(boot, next.continuation, Math.max(next.timeoutMs, POLL_FLOOR_MS));
      } catch (error: any) {
        opts.onStatus('error', error?.message);
        const wait = backoff;
        backoff = Math.min(backoff * 2, RETRY_MAX_MS);
        poll(boot, continuation, wait);
      }
    }, delayMs);
  }

  function handleAction(
    action: any,
    immediate: boolean,
    paceMs: number,
    deletedIds: Set<string>,
    deletedAuthors: Set<string>,
  ) {
    const item = action.addChatItemAction?.item;
    if (item) {
      const id = itemId(item);
      const senderId = itemSenderId(item);
      if ((id && deletedIds.has(id)) || (senderId && deletedAuthors.has(senderId))) {
        if (id) remember(id);
        return;
      }
      const message = item.liveChatTextMessageRenderer
        ? buildMessage(item.liveChatTextMessageRenderer)
        : buildSystemMessage(item);
      if (message) emitMessage(message, immediate, paceMs);
      return;
    }

    const deleteId = action.markChatItemAsDeletedAction?.targetItemId ?? action.removeChatItemAction?.targetItemId;
    if (deleteId) { deleteQueued({ id: String(deleteId) }); return; }
    const banned = action.markChatItemsByAuthorAsDeletedAction?.externalChannelId
      ?? action.removeChatItemByAuthorAction?.externalChannelId;
    if (banned) { deleteQueued({ senderId: String(banned) }); return; }

    const banner = action.addBannerToLiveChatCommand?.bannerRenderer?.liveChatBannerRenderer;
    if (banner) {
      const inner = banner.contents?.liveChatTextMessageRenderer;
      const message = inner ? buildMessage(inner) : null;
      if (message) opts.onPin({ message });
      return;
    }
    if (action.removeBannerForLiveChatCommand) opts.onPin(null);
  }

  return {
    start() { void bootstrap(); },
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (deliveryTimer) clearTimeout(deliveryTimer);
      deliveryQueue.length = 0;
    },
  };
}
''')

# ---------------------------------------------------------------------------
# Message conversion: allow YouTube 7TV text substitution and carry replies.
# ---------------------------------------------------------------------------
replace_once(
    'src/lib/multichatMessageModel.tsx',
    "  Record<Extract<Platform, 'kick' | 'twitch'>, SevenTVEmote[]>\n",
    "  Record<Extract<Platform, 'kick' | 'twitch' | 'youtube'>, SevenTVEmote[]>\n",
)
replace_once(
    'src/lib/multichatMessageModel.tsx',
    "    avatar: um.avatar,\n    sourceChannel: um.sourceChannel,\n",
    "    avatar: um.avatar,\n    sourceChannel: um.sourceChannel,\n    reply: um.reply,\n",
)
replace_once(
    'src/lib/multichatMessageModel.tsx',
    "    // kick + twitch both get third-party emote word-swaps in text gaps\n    message: renderMessageText(\n      um,\n      (um.platform === 'kick' || um.platform === 'twitch') && cfg.sevenTVEmotesEnabled\n        ? cosmetics.emotes[um.platform] ?? []\n        : [],\n",
    "    // Kick, Twitch and YouTube can all carry a platform-scoped 7TV set.\n    message: renderMessageText(\n      um,\n      (um.platform === 'kick' || um.platform === 'twitch' || um.platform === 'youtube') && cfg.sevenTVEmotesEnabled\n        ? cosmetics.emotes[um.platform] ?? []\n        : [],\n",
)

replace_once(
    'src/lib/render.tsx',
    "    // 7TV word-swap applies to kick AND twitch text gaps\n    if ((msg.platform === 'kick' || msg.platform === 'twitch') && sevenTV.length) {",
    "    // Platform-scoped 7TV word-swap applies to Kick, Twitch and YouTube.\n    if ((msg.platform === 'kick' || msg.platform === 'twitch' || msg.platform === 'youtube') && sevenTV.length) {",
)

# ---------------------------------------------------------------------------
# Overlay alignment: one inline-flex badge row before every provider's username,
# plus compact Kick reply context. Text itself stays baseline-aligned.
# ---------------------------------------------------------------------------
replace_once(
    'src/components/overlay/ChatOverlay.tsx',
    "          /* Badge sizing — exact from size_*.css .badge\n             Targets img AND svg (platform icons) via the bare class,\n             plus the wrapper-child selector for stragglers */\n          .ck-bw img,\n          .ck-bw svg,\n          .ck-badge-img {\n            width:          ${sz.badgeW} !important;\n            height:         ${sz.badgeH} !important;\n            min-width:      ${sz.badgeW} !important;\n            min-height:     ${sz.badgeH} !important;\n            max-width:      ${sz.badgeW} !important;\n            max-height:     ${sz.badgeH} !important;\n            margin-right:   ${sz.badgeMR};\n            margin-bottom:  ${sz.badgeMB};\n            vertical-align: middle;\n            border-radius:  10%;\n            display:        inline-block;\n          }\n          .ck-bw img:last-of-type,\n          .ck-bw svg:last-of-type,\n          .ck-bw .ck-badge-img:last-of-type { margin-right: ${sz.badgeLastMR}; }\n",
    "          /* Provider badge row: flex-centre every badge as one inline unit.\n             This removes image-baseline drift while keeping the ChatIS line height. */\n          .ck-bw {\n            display:        inline-flex;\n            align-items:    center;\n            gap:            ${sz.badgeMR};\n            margin-right:   ${sz.badgeLastMR};\n            vertical-align: middle;\n            line-height:    0;\n          }\n          .ck-bw img,\n          .ck-bw svg,\n          .ck-badge-img {\n            width:          ${sz.badgeW} !important;\n            height:         ${sz.badgeH} !important;\n            min-width:      ${sz.badgeW} !important;\n            min-height:     ${sz.badgeH} !important;\n            max-width:      ${sz.badgeW} !important;\n            max-height:     ${sz.badgeH} !important;\n            margin:         0 !important;\n            vertical-align: middle;\n            border-radius:  10%;\n            display:        block;\n            flex:           0 0 auto;\n          }\n",
)
replace_once(
    'src/components/overlay/ChatOverlay.tsx',
    "          {/* StreamNook: YouTube renders name THEN badges; others badges-first */}\n          {msg.platform === 'youtube'\n            ? <>{nameNode}{badgesNode && <span style={{ marginLeft:'0.25em' }}>{badgesNode}</span>}</>\n            : <>{badgesNode}{nameNode}</>}\n",
    "          {badgesNode}{nameNode}\n",
)
replace_once(
    'src/components/overlay/ChatOverlay.tsx',
    "  const line = (\n    <div style={{ lineHeight:sz.lineHeight, wordBreak:'break-word' }}>\n",
    "  const replyNode = msg.reply ? (\n"
    "    <div style={{\n"
    "      fontSize:'0.6em', lineHeight:1.35, opacity:0.68, marginLeft:'0.35em',\n"
    "      paddingLeft:'0.45em', borderLeft:'2px solid rgba(255,255,255,0.28)',\n"
    "      whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',\n"
    "    }}>\n"
    "      <span aria-hidden=\"true\">↪ </span><strong>{msg.reply.username}</strong>{msg.reply.text ? ` ${msg.reply.text}` : ''}\n"
    "    </div>\n"
    "  ) : null;\n\n"
    "  const messageLine = (\n    <div style={{ lineHeight:sz.lineHeight, wordBreak:'break-word' }}>\n",
)
replace_once(
    'src/components/overlay/ChatOverlay.tsx',
    "  return msg.redeem ? redeemWrap(line) : line;\n",
    "  const line = replyNode ? <div>{replyNode}{messageLine}</div> : messageLine;\n"
    "  return msg.redeem ? redeemWrap(line) : line;\n",
)

# ---------------------------------------------------------------------------
# YouTube live bootstrap: brace-balanced ytInitialData, explicit full-Live view,
# and broadcaster UC id for YouTube's 7TV GOOGLE account lookup.
# ---------------------------------------------------------------------------
replace_once(
    'src/pages/api/youtube/live.ts',
    "const CONTINUATION_RE = /\"continuation\":\"([^\"]+)\"/;\n",
    "const CONTINUATION_RE = /\"continuation\":\"([^\"]+)\"/;\n"
    "const CHANNEL_ID_RE = /\"channelId\"\\s*:\\s*\"(UC[A-Za-z0-9_-]{22})\"/;\n",
)
insert_marker = "const HEADERS = {\n"
helpers = r'''export function extractAssignedJson(html: string, marker: string): any | null {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return null;
  const start = html.indexOf('{', markerIndex + marker.length);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < html.length; index += 1) {
    const char = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') { inString = true; continue; }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        try { return JSON.parse(html.slice(start, index + 1)); }
        catch { return null; }
      }
    }
  }
  return null;
}

export function liveViewContinuation(initialData: any): string | null {
  const items = initialData?.contents?.liveChatRenderer?.header?.liveChatHeaderRenderer
    ?.viewSelector?.sortFilterSubMenuRenderer?.subMenuItems;
  if (!Array.isArray(items)) return null;
  const live = items.find((item: any) =>
    typeof item?.title === 'string' && !item.title.toLowerCase().includes('top'));
  const continuation = live?.continuation?.reloadContinuationData?.continuation;
  return typeof continuation === 'string' && continuation ? continuation : null;
}

'''
replace_once('src/pages/api/youtube/live.ts', insert_marker, helpers + insert_marker)
replace_once(
    'src/pages/api/youtube/live.ts',
    "async function findLiveVideo(\n  name: string,\n): Promise<string | null> {",
    "async function findLiveVideo(\n  name: string,\n): Promise<string | null> {",
)
# Add a robust watch-page channel id helper before the API handler.
replace_once(
    'src/pages/api/youtube/live.ts',
    "export default async function handler(\n",
    r'''async function findVideoChannelId(videoId: string): Promise<string | null> {
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: HEADERS,
      redirect: 'follow',
    });
    if (!response.ok) return null;
    const html = await response.text();
    const player = extractAssignedJson(html, 'ytInitialPlayerResponse');
    const channelId = player?.videoDetails?.channelId;
    if (typeof channelId === 'string' && /^UC[A-Za-z0-9_-]{22}$/.test(channelId)) return channelId;
    return html.match(CHANNEL_ID_RE)?.[1] ?? null;
  } catch {
    return null;
  }
}

export default async function handler(
''',
)
replace_once(
    'src/pages/api/youtube/live.ts',
    "  const chatUrl =\n    `https://www.youtube.com/live_chat?is_popout=1&v=${videoId}`;\n\n  const response = await fetch(chatUrl, {\n",
    "  const chatUrl =\n    `https://www.youtube.com/live_chat?is_popout=1&v=${videoId}`;\n\n"
    "  const channelIdPromise = findVideoChannelId(videoId);\n\n"
    "  const response = await fetch(chatUrl, {\n",
)
replace_once(
    'src/pages/api/youtube/live.ts',
    "  const continuation =\n    html.match(CONTINUATION_RE)?.[1];\n",
    "  const initialData = extractAssignedJson(html, 'ytInitialData');\n"
    "  const continuation = liveViewContinuation(initialData) ?? html.match(CONTINUATION_RE)?.[1];\n"
    "  const channelId = await channelIdPromise;\n",
)
replace_once(
    'src/pages/api/youtube/live.ts',
    "    continuation,\n  });\n",
    "    continuation,\n    ...(channelId ? { channelId } : {}),\n  });\n",
)

# ---------------------------------------------------------------------------
# Same-origin Kick read backend. These endpoints deliberately return provider
# JSON unchanged; the client-side parser remains the single schema boundary.
# ---------------------------------------------------------------------------
Path('src/pages/api/kick').mkdir(parents=True, exist_ok=True)
Path('src/pages/api/kick/channel.ts').write_text(r'''import type { NextApiRequest, NextApiResponse } from 'next';

const HEADERS = {
  Accept: 'application/json,text/plain,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://kick.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const channel = String(req.query.channel ?? '').replace(/^@/, '').trim();
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(channel)) return res.status(400).json({ error: 'invalid channel' });
  try {
    const upstream = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(channel)}`, {
      headers: HEADERS,
      cache: 'no-store',
    });
    if (!upstream.ok) return res.status(upstream.status === 404 ? 404 : 502).json({ error: `Kick ${upstream.status}` });
    return res.status(200).json(await upstream.json());
  } catch {
    return res.status(502).json({ error: 'Kick channel lookup failed' });
  }
}
''')
Path('src/pages/api/kick/history.ts').write_text(r'''import type { NextApiRequest, NextApiResponse } from 'next';

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
''')

# ---------------------------------------------------------------------------
# Runtime emote catalogs: add YouTube 7TV (GOOGLE account) without enabling
# Twitch/Kick-only paint entitlement code for YouTube.
# ---------------------------------------------------------------------------
replace_once(
    'src/pages/multichat.tsx',
    "    emotes: { kick: SevenTVEmote[]; twitch: SevenTVEmote[] };\n",
    "    emotes: { kick: SevenTVEmote[]; twitch: SevenTVEmote[]; youtube: SevenTVEmote[] };\n",
)
replace_once(
    'src/pages/multichat.tsx',
    "    emotes: { kick: [], twitch: [] },\n",
    "    emotes: { kick: [], twitch: [], youtube: [] },\n",
)
replace_once(
    'src/pages/multichat.tsx',
    "    let twitchRoomId: string | null = null; // for !multichat refresh emotes\n",
    "    let twitchRoomId: string | null = null; // for !multichat refresh emotes\n"
    "    let youtubeChannelId: string | null = null;\n",
)
replace_once(
    'src/pages/multichat.tsx',
    "        onPin: handlePin,\n        onStatus: (status, detail) => {\n          if (status !== 'connecting') settle('youtube');\n",
    "        onPin: handlePin,\n"
    "        onChannelInfo: async ({ channelId }) => {\n"
    "          youtubeChannelId = channelId;\n"
    "          if (!cfg.sevenTVEmotesEnabled) return;\n"
    "          const global = await getSevenTVGlobalEmotes();\n"
    "          const { emotes: channelEmotes } = await getSevenTVChannelEmotes(channelId, 'youtube');\n"
    "          const merged = new Map(global.map((emote) => [emote.name, emote]));\n"
    "          for (const emote of channelEmotes) merged.set(emote.name, emote);\n"
    "          s.emotes.youtube = [...merged.values()];\n"
    "          let touched = false;\n"
    "          s.messages = s.messages.map((message) => {\n"
    "            if (message.platform !== 'youtube' || !message.raw) return message;\n"
    "            touched = true;\n"
    "            return { ...buildParsed(message.raw as UnifiedMessage), id: message.id, timestamp: message.timestamp };\n"
    "          });\n"
    "          if (touched) markDirty();\n"
    "        },\n"
    "        onStatus: (status, detail) => {\n          if (status !== 'connecting') settle('youtube');\n",
)
replace_once(
    'src/pages/multichat.tsx',
    "        const twitch = twitchRoomId ? await loadTwitchEmotes(twitchRoomId) : [];\n        // Replace both complete catalogs atomically after every provider settles.\n        s.emotes = { kick: [...kick.values()], twitch };\n",
    "        const twitch = twitchRoomId ? await loadTwitchEmotes(twitchRoomId) : [];\n"
    "        const youtube = new Map(global.map((emote) => [emote.name, emote]));\n"
    "        if (youtubeChannelId) {\n"
    "          const { emotes: channelEmotes } = await getSevenTVChannelEmotes(youtubeChannelId, 'youtube');\n"
    "          for (const emote of channelEmotes) youtube.set(emote.name, emote);\n"
    "        }\n"
    "        // Replace complete provider catalogs atomically after every source settles.\n"
    "        s.emotes = { kick: [...kick.values()], twitch, youtube: [...youtube.values()] };\n",
)
replace_once(
    'src/pages/multichat.tsx',
    "          ?? s.emotes.twitch.find((emote) => emote.name === name)?.image\n          ?? null;\n",
    "          ?? s.emotes.twitch.find((emote) => emote.name === name)?.image\n"
    "          ?? s.emotes.youtube.find((emote) => emote.name === name)?.image\n"
    "          ?? null;\n",
)

# ---------------------------------------------------------------------------
# Regression tests: update backlog expectations and cover alternate delete shape.
# ---------------------------------------------------------------------------
replace_once(
    'tests/unit/youtubeConnector.test.tsx',
    "import { createYouTubeConnector, parseRuns, YOUTUBE_DELIVERY_INTERVAL_MS } from '@/lib/connectors/youtube';\n",
    "import { createYouTubeConnector, parseRuns } from '@/lib/connectors/youtube';\n",
)
replace_once(
    'tests/unit/youtubeConnector.test.tsx',
    "  it('releases one continuation across bounded canonical presentation cycles in order', async () => {\n"
    "    const fixture = connectFixture();\n"
    "    await vi.advanceTimersByTimeAsync(1200);\n"
    "    /* Six visible actions are split across at most five releases: the first\n"
    "       catch-up batch coalesces two, then later releases stay one per cycle. */\n"
    "    expect(fixture.messages.map(message => message.id)).toEqual(['yt-normal', 'yt-fallback']);\n"
    "    await vi.advanceTimersByTimeAsync(YOUTUBE_DELIVERY_INTERVAL_MS);\n"
    "    expect(fixture.messages.map(message => message.id)).toEqual(['yt-normal', 'yt-fallback', 'yt-super-chat']);\n"
    "    await vi.advanceTimersByTimeAsync(YOUTUBE_DELIVERY_INTERVAL_MS * 3);\n"
    "    expect(fixture.messages.map(message => message.id)).toEqual([\n"
    "      'yt-normal', 'yt-fallback', 'yt-super-chat', 'yt-super-sticker', 'yt-membership', 'yt-gift',\n"
    "    ]);\n"
    "    expect(fixture.messages.some(message => message.kind === 'system')).toBe(true);\n"
    "    fixture.connector.stop();\n"
    "  });\n",
    "  it('publishes the initial backlog immediately in provider order', async () => {\n"
    "    const fixture = connectFixture();\n"
    "    await vi.advanceTimersByTimeAsync(1200);\n"
    "    expect(fixture.messages.map(message => message.id)).toEqual([\n"
    "      'yt-normal', 'yt-fallback', 'yt-super-chat', 'yt-super-sticker', 'yt-membership', 'yt-gift',\n"
    "    ]);\n"
    "    expect(fixture.messages.some(message => message.kind === 'system')).toBe(true);\n"
    "    fixture.connector.stop();\n"
    "  });\n",
)
replace_once(
    'tests/unit/youtubeConnector.test.tsx',
    "            { markChatItemAsDeletedAction: { targetItemId: 'queued-delete' } },\n",
    "            { removeChatItemAction: { targetItemId: 'queued-delete' } },\n",
)

Path('tests/unit/providerChatParity.test.tsx').write_text(r'''import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildKickMessage, fetchKickHistory } from '@/lib/connectors/kick';
import type { KickChannel } from '@/lib/kick';
import { extractAssignedJson, liveViewContinuation } from '@/pages/api/youtube/live';

afterEach(() => vi.unstubAllGlobals());

describe('provider chat parity', () => {
  it('merges Kick role and image badges by sort_order without requiring selected', () => {
    const message = buildKickMessage({
      id: 'm1', content: 'hello', created_at: '2026-08-25T20:00:00Z',
      sender: {
        id: 9, username: 'Chatter', identity: {
          color: '#abcdef',
          badges: [
            { type: 'subscriber', count: 12, sort_order: 30 },
            { type: 'moderator', sort_order: 20 },
          ],
          badges_v2: [
            { name: 'level', image_url: 'https://cdn.example/level.png', sort_order: 10, metadata: { level: 44 } },
          ],
        },
      },
    });
    expect(message.badges).toEqual([
      { type: 'level', url: 'https://cdn.example/level.png', count: 44, version: '44' },
      { type: 'moderator' },
      { type: 'subscriber', count: 12, version: '12' },
    ]);
    expect(message.timestamp).toBe(Date.parse('2026-08-25T20:00:00Z'));
  });

  it('normalizes Kick reply context using readable native-emote fallback text', () => {
    const message = buildKickMessage({
      id: 'reply', type: 'reply', content: 'yep',
      sender: { id: 1, username: 'Replying', identity: {} },
      metadata: {
        original_sender: { id: 2, username: 'Original' },
        original_message: { id: 'parent', content: 'hello [emote:123:Wave]' },
      },
    });
    expect(message.reply).toEqual({
      username: 'Original', senderId: '2', messageId: 'parent', text: 'hello Wave',
    });
  });

  it('loads recent Kick rows newest-first upstream but emits them oldest-first', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { messages: [
        { id: 'new', content: 'new', sender: { id: 1, username: 'U', identity: {} } },
        { id: 'mid', content: 'mid', sender: { id: 1, username: 'U', identity: {} } },
        { id: 'old', content: 'old', sender: { id: 1, username: 'U', identity: {} } },
      ] } }),
    })));
    const channel: KickChannel = {
      id: 10, user_id: 20, slug: 'test', chatroom: { id: 30 }, subscriber_badges: [],
      user: { id: 20, username: 'test' },
    };
    expect((await fetchKickHistory(channel)).map((message) => message.id)).toEqual(['old', 'mid', 'new']);
  });

  it('selects YouTube full Live chat instead of Top chat from ytInitialData', () => {
    const html = `window.ytInitialData = ${JSON.stringify({
      contents: { liveChatRenderer: { header: { liveChatHeaderRenderer: {
        viewSelector: { sortFilterSubMenuRenderer: { subMenuItems: [
          { title: 'Top chat', continuation: { reloadContinuationData: { continuation: 'TOP' } } },
          { title: 'Live chat', continuation: { reloadContinuationData: { continuation: 'LIVE' } } },
        ] } },
      } } } },
    })};`;
    const parsed = extractAssignedJson(html, 'ytInitialData');
    expect(liveViewContinuation(parsed)).toBe('LIVE');
  });
});
''')
