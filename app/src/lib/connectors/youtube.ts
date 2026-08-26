import type { Connector, ConnectorCallbacks, UnifiedBadge, UnifiedEmote, UnifiedMessage } from '../types';

const OFFLINE_RECHECK_MS = 60_000;
const POLL_FLOOR_MS = 800;
/* The overlay's legacy non-smooth render path flushes every 200ms. Keep
 * YouTube deliveries just beyond that boundary so a provider batch cannot
 * collapse multiple rows into the same React render/entrance animation. */
export const YOUTUBE_DELIVERY_INTERVAL_MS = 225;
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
    deliveryDelay = Math.max(YOUTUBE_DELIVERY_INTERVAL_MS, delayMs);
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
          /* bChat's YouTube handler expands a provider batch into individual
           * store additions. Queue the first backlog too so every retained row
           * crosses its own render boundary instead of appearing as one burst. */
          handleAction(action, false, pace, deletedIds, deletedAuthors);
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