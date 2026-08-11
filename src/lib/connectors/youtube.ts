/* YouTube Live chat connector (no OAuth).
 *
 * Bootstraps via /api/youtube/live (handle → live videoId + InnerTube
 * key/version/continuation scraped server-side), then polls
 * /api/youtube/chat with continuation tokens. Poll floor 800ms,
 * respects timeoutMs (unified-chat-lite youtube.py behavior).
 * Offline recheck every 60s.
 *
 * Pins: addBannerToLiveChatCommand → liveChatBannerRenderer wraps a
 * liveChatTextMessageRenderer; removeBannerForLiveChatCommand unpins.
 */
import type { Connector, ConnectorCallbacks, UnifiedBadge, UnifiedEmote, UnifiedMessage } from '../types';

const OFFLINE_RECHECK_MS = 60_000;
const POLL_FLOOR_MS = 800;
/** Slightly above the canonical page flush so consecutive releases cannot share it. */
export const YOUTUBE_DELIVERY_INTERVAL_MS = 210;
const YOUTUBE_MAX_DELIVERY_BATCHES = 5;

interface Bootstrap { videoId: string; apiKey: string; clientVersion: string; continuation: string }
interface ParsedRuns { text: string; emotes: UnifiedEmote[] }

function codepointLength(value: string): number {
  return Array.from(value).length;
}

function normalizeImageUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const url = value.startsWith('//') ? `https:${value}` : value;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : undefined;
  } catch {
    return undefined;
  }
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
  if (!avatar) return undefined;
  return avatar.replace(/=s\d+(?=-|$)/, '=s160');
}

/** Flatten InnerTube runs[] → text + emote char-offsets. */
export function parseRuns(runs: any[]): ParsedRuns {
  let text = '';
  const emotes: UnifiedEmote[] = [];
  for (const run of Array.isArray(runs) ? runs : []) {
    if (typeof run?.text === 'string') {
      text += run.text;
      continue;
    }
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
    if (url) {
      emotes.push({ begin, end: begin + codepointLength(name), text: name, url });
    }
  }
  return { text, emotes };
}

function parseText(value: any): ParsedRuns {
  if (Array.isArray(value?.runs)) return parseRuns(value.runs);
  return { text: typeof value?.simpleText === 'string' ? value.simpleText : '', emotes: [] };
}

function appendText(target: ParsedRuns, value: string): void {
  target.text += value;
}

function appendRuns(target: ParsedRuns, value: ParsedRuns): void {
  const shift = codepointLength(target.text);
  target.text += value.text;
  target.emotes.push(...value.emotes.map((emote) => ({
    ...emote,
    begin: emote.begin + shift,
    end: emote.end + shift,
  })));
}

function canonicalBadgeType(renderer: any, hasThumbnail: boolean): string | null {
  if (hasThumbnail) return 'subscriber';
  const value = `${renderer?.icon?.iconType ?? ''} ${renderer?.tooltip ?? ''}`.trim().toLowerCase();
  if (/\b(owner|channel owner)\b/.test(value)) return 'owner';
  if (/\b(moderator|moderator wrench)\b/.test(value)) return 'moderator';
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

function authorName(renderer: any): string {
  return parseText(renderer?.authorName).text;
}

function timestamp(renderer: any): number {
  const usec = Number(renderer?.timestampUsec);
  return Number.isFinite(usec) && usec > 0 ? Math.floor(usec / 1000) : Date.now();
}

function buildMessage(renderer: any): UnifiedMessage | null {
  if (!renderer?.id) return null;
  const { text, emotes } = parseText(renderer.message);
  return {
    platform: 'youtube',
    id: renderer.id,
    senderId: renderer.authorExternalChannelId ?? '',
    username: authorName(renderer),
    color: '',
    badges: authorBadges(renderer),
    text,
    emotes,
    timestamp: timestamp(renderer),
    kind: 'chat',
    avatar: authorAvatar(renderer),
  };
}

/** Paid/membership renderers → normalized system messages. */
function buildSystemMessage(item: any): UnifiedMessage | null {
  const paid = item.liveChatPaidMessageRenderer;
  const sticker = item.liveChatPaidStickerRenderer;
  const member = item.liveChatMembershipItemRenderer;
  const gift = item.liveChatSponsorshipsGiftPurchaseAnnouncementRenderer;
  const renderer = paid ?? sticker ?? member ?? (gift ? gift.header?.liveChatSponsorshipsHeaderRenderer : null);
  const id = paid?.id ?? sticker?.id ?? member?.id ?? gift?.id;
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
    platform: 'youtube',
    id,
    senderId: renderer.authorExternalChannelId ?? '',
    username: author,
    color: '',
    badges: authorBadges(renderer),
    text: content.text,
    emotes: content.emotes,
    timestamp: timestamp(renderer),
    kind: 'system',
    category,
    avatar: authorAvatar(renderer),
  };
}

export interface YouTubeConnectorOpts extends ConnectorCallbacks {
  channel: string;
}

export function createYouTubeConnector(opts: YouTubeConnectorOpts): Connector {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let deliveryTimer: ReturnType<typeof setTimeout> | null = null;
  let deliveryBatchesRemaining = 0;
  const deliveryQueue: UnifiedMessage[] = [];

  function schedule(fn: () => void, ms: number) {
    if (stopped) return;
    timer = setTimeout(fn, ms);
  }

  function releaseMessages(): void {
    deliveryTimer = null;
    if (stopped) return;
    const batchSize = Math.max(1, Math.ceil(deliveryQueue.length / Math.max(1, deliveryBatchesRemaining)));
    let released = 0;
    while (deliveryQueue.length && released < batchSize) {
      const message = deliveryQueue.shift()!;
      opts.onMessage(message);
      released += 1;
    }
    deliveryBatchesRemaining = Math.max(0, deliveryBatchesRemaining - 1);
    if (deliveryQueue.length) deliveryTimer = setTimeout(releaseMessages, YOUTUBE_DELIVERY_INTERVAL_MS);
  }

  function enqueueMessage(message: UnifiedMessage): void {
    deliveryQueue.push(message);
    /* Defer the first release to the next task so every action in this InnerTube
       continuation is known before the bounded batch size is chosen. */
    if (!deliveryTimer) {
      deliveryBatchesRemaining = YOUTUBE_MAX_DELIVERY_BATCHES;
      deliveryTimer = setTimeout(releaseMessages, 0);
    }
  }

  function deleteQueued(optsToDelete: { id?: string; senderId?: string }): void {
    for (let index = deliveryQueue.length - 1; index >= 0; index -= 1) {
      const message = deliveryQueue[index];
      if (optsToDelete.id === message.id || (optsToDelete.senderId && optsToDelete.senderId === message.senderId)) {
        deliveryQueue.splice(index, 1);
      }
    }
    opts.onDelete(optsToDelete);
  }

  async function bootstrap() {
    if (stopped) return;
    opts.onStatus('connecting');
    try {
      const r = await fetch(`/api/youtube/live?channel=${encodeURIComponent(opts.channel)}`);
      const data = await r.json();
      if (data.offline) {
        opts.onStatus('offline', 'Channel is not live');
        schedule(bootstrap, OFFLINE_RECHECK_MS);
        return;
      }
      if (!r.ok || data.error) {
        opts.onStatus('error', data.error ?? `HTTP ${r.status}`);
        schedule(bootstrap, OFFLINE_RECHECK_MS);
        return;
      }
      opts.onStatus('connected');
      poll(data as Bootstrap, data.continuation, 1000);
    } catch (e: any) {
      opts.onStatus('error', e?.message);
      schedule(bootstrap, OFFLINE_RECHECK_MS);
    }
  }

  let backoff = 5000;

  async function poll(boot: Bootstrap, continuation: string, delayMs: number) {
    schedule(async () => {
      try {
        const r = await fetch('/api/youtube/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: boot.apiKey, clientVersion: boot.clientVersion, continuation }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        backoff = 5000;

        const cont = data?.continuationContents?.liveChatContinuation;
        if (!cont) {
          opts.onStatus('offline', 'Stream ended');
          schedule(bootstrap, OFFLINE_RECHECK_MS);
          return;
        }

        for (const action of cont.actions ?? []) {
          handleAction(action);
        }

        // next continuation + timeout: invalidation > timed > reload.
        // StreamNook clamps timeoutMs to 1000..2000 — YouTube sometimes
        // returns 10s+ values that make chat lurch.
        let next: string | null = null;
        let timeoutMs = 2000;
        for (const c of cont.continuations ?? []) {
          const d = c.invalidationContinuationData ?? c.timedContinuationData ?? c.reloadContinuationData;
          if (d?.continuation) {
            next = d.continuation;
            if (typeof d.timeoutMs === 'number') timeoutMs = Math.min(Math.max(d.timeoutMs, 1000), 2000);
            break;
          }
        }
        if (!next) {
          opts.onStatus('offline', 'Stream ended');
          schedule(bootstrap, OFFLINE_RECHECK_MS);
          return;
        }
        poll(boot, next, Math.max(timeoutMs, POLL_FLOOR_MS));
      } catch (e: any) {
        opts.onStatus('error', e?.message);
        const wait = backoff;
        backoff = Math.min(backoff * 2, 60_000);
        poll(boot, continuation, wait);
      }
    }, delayMs);
  }

  function handleAction(action: any) {
    const item = action.addChatItemAction?.item;
    if (item) {
      if (item.liveChatTextMessageRenderer) {
        const msg = buildMessage(item.liveChatTextMessageRenderer);
        if (msg) enqueueMessage(msg);
      } else {
        const sys = buildSystemMessage(item);
        if (sys) enqueueMessage(sys);
      }
      return;
    }
    const delId = action.markChatItemAsDeletedAction?.targetItemId;
    if (delId) { deleteQueued({ id: delId }); return; }
    // ban/timeout: remove all messages from that channel id (StreamNook)
    const banned = action.markChatItemsByAuthorAsDeletedAction?.externalChannelId;
    if (banned) { deleteQueued({ senderId: banned }); return; }

    // Pinned message banner (not implemented in either reference repo;
    // shape: addBannerToLiveChatCommand.bannerRenderer.liveChatBannerRenderer
    //        .contents.liveChatTextMessageRenderer)
    const banner = action.addBannerToLiveChatCommand?.bannerRenderer?.liveChatBannerRenderer;
    if (banner) {
      const inner = banner.contents?.liveChatTextMessageRenderer;
      const msg = inner ? buildMessage(inner) : null;
      if (msg) opts.onPin({ message: msg });
      return;
    }
    if (action.removeBannerForLiveChatCommand) {
      opts.onPin(null);
    }
  }

  return {
    start() { bootstrap(); },
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (deliveryTimer) clearTimeout(deliveryTimer);
      deliveryQueue.length = 0;
    },
  };
}
