import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';
import { normalizeChatChannel } from './channelValidation';

type HubData = Record<string, any>;
type Send = (data: HubData, serialized: string) => void;

type BufferedEvent = {
  data: HubData;
  serialized: string;
};

interface Channel {
  conn: TikTokLiveConnection;
  subs: Set<Send>;
  recent: BufferedEvent[];
  status: BufferedEvent | null;
  lingerTimer: ReturnType<typeof setTimeout> | null;
  backoff: number;
  closed: boolean;
  seenIds: Set<string>;
}

const channels = new Map<string, Channel>();
const LINGER_MS = 30_000;
export const TIKTOK_RECENT_MAX = 100;

const metrics = {
  broadcasts: 0,
  subscriberDeliveries: 0,
  reconnects: 0,
  upstreamErrors: 0,
};

function serialize(data: HubData): string | null {
  try { return JSON.stringify(data); }
  catch { return null; }
}

function broadcast(ch: Channel, data: HubData, buffer = true) {
  const serialized = serialize(data);
  if (!serialized) return;
  metrics.broadcasts += 1;
  if (buffer) {
    ch.recent.push({ data, serialized });
    while (ch.recent.length > TIKTOK_RECENT_MAX) ch.recent.shift();
  }
  for (const send of ch.subs) {
    try {
      send(data, serialized);
      metrics.subscriberDeliveries += 1;
    } catch {
      // The SSE request-close handler removes dead subscribers.
    }
  }
}

function setStatus(ch: Channel, status: HubData) {
  const serialized = serialize(status);
  if (!serialized) return;
  ch.status = { data: status, serialized };
  for (const send of ch.subs) {
    try {
      send(status, serialized);
      metrics.subscriberDeliveries += 1;
    } catch {
      // The SSE request-close handler removes dead subscribers.
    }
  }
}

export function tikTokBufferedEventMatchesDelete(
  event: HubData,
  deletion: { id?: string; senderId?: string },
): boolean {
  if (deletion.id && event.id !== undefined && String(event.id) === deletion.id) return true;
  if (deletion.senderId && event.senderId !== undefined && String(event.senderId) === deletion.senderId) return true;
  return false;
}

function applyDeleteToRecovery(ch: Channel, deletion: { id?: string; senderId?: string }) {
  ch.recent = ch.recent.filter((entry) => !tikTokBufferedEventMatchesDelete(entry.data, deletion));
}

function extractBadges(user: any): string[] {
  const urls: string[] = [];
  const push = (u?: string) => { if (u && !urls.includes(u)) urls.push(u); };
  for (const b of user?.badgeList ?? []) {
    push(b?.image?.image?.urlList?.[0] ?? b?.combine?.icon?.urlList?.[0]);
  }
  if (!urls.length) {
    for (const img of user?.badgeImageList ?? []) push(img?.urlList?.[0]);
  }
  return urls;
}

function createChannel(user: string): Channel {
  const conn = new TikTokLiveConnection(`@${user}`, {
    ...(process.env.TIKTOK_SIGN_API_KEY ? { signApiKey: process.env.TIKTOK_SIGN_API_KEY } : {}),
  });
  const ch: Channel = {
    conn, subs: new Set(), recent: [], status: null,
    lingerTimer: null, backoff: 5000, closed: false, seenIds: new Set(),
  };

  conn.on(ControlEvent.CONNECTED, () => {
    ch.backoff = 5000;
    setStatus(ch, { type: 'status', status: 'connected' });
  });
  conn.on(ControlEvent.DISCONNECTED, () => {
    if (!ch.closed && ch.subs.size) {
      metrics.reconnects += 1;
      scheduleReconnect();
    }
  });
  conn.on(WebcastEvent.STREAM_END, () => {
    setStatus(ch, { type: 'status', status: 'offline', detail: 'Stream ended' });
  });

  conn.on(WebcastEvent.CHAT, (data: any) => {
    const id = data.common?.msgId?.toString() ?? data.msgId?.toString()
      ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (ch.seenIds.has(id)) return;
    ch.seenIds.add(id);
    if (ch.seenIds.size > 2000) {
      const first = ch.seenIds.values().next().value;
      if (first) ch.seenIds.delete(first);
    }
    broadcast(ch, {
      type: 'chat',
      id,
      senderId: data.user?.userId?.toString() ?? data.user?.id?.toString() ?? '',
      username: data.user?.nickname || data.user?.uniqueId || 'viewer',
      text: data.content ?? data.comment ?? '',
      timestamp: Date.now(),
      moderator: !!(data.user?.isModerator ?? data.userIdentity?.isModeratorOfAnchor),
      subscriber: !!(data.user?.isSubscriber ?? data.userIdentity?.isSubscriberOfAnchor),
      badgeUrls: extractBadges(data.user),
      avatar: data.user?.avatarThumb?.urlList?.[0] ?? data.user?.avatarMedium?.urlList?.[0],
    });
  });

  conn.on(WebcastEvent.IM_DELETE, (data: any) => {
    for (const msgId of data.deleteMsgIdsList ?? []) {
      const deletion = { id: msgId?.toString() };
      if (!deletion.id) continue;
      applyDeleteToRecovery(ch, deletion);
      broadcast(ch, { type: 'delete', ...deletion }, false);
    }
    for (const userId of data.deleteUserIdsList ?? []) {
      const deletion = { senderId: userId?.toString() };
      if (!deletion.senderId) continue;
      applyDeleteToRecovery(ch, deletion);
      broadcast(ch, { type: 'delete', ...deletion }, false);
    }
  });

  conn.on(WebcastEvent.GIFT, (data: any) => {
    if (data.giftType === 1 && data.repeatEnd === false) return;
    const author = data.user?.nickname || data.user?.uniqueId || 'Someone';
    const count = data.repeatCount ?? 1;
    const name = data.giftDetails?.giftName ?? data.giftName ?? 'a gift';
    const diamonds = (data.giftDetails?.diamondCount ?? data.diamondCount ?? 0) * Math.max(count, 1);
    broadcast(ch, {
      type: 'gift',
      id: `gift-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      senderId: data.user?.userId?.toString() ?? data.user?.id?.toString() ?? '',
      username: author,
      text: `${author} sent ${count}x ${name}!${diamonds ? ` (${diamonds} 💎)` : ''}`,
      giftIcon: data.giftDetails?.giftImage?.giftPictureUrl
        ?? data.giftDetails?.icon?.urlList?.[0]
        ?? data.giftImage?.giftPictureUrl,
      timestamp: Date.now(),
    });
  });

  conn.on(WebcastEvent.SUB_NOTIFY, (data: any) => {
    const author = data.user?.nickname || data.user?.uniqueId || 'Someone';
    broadcast(ch, {
      type: 'sub',
      id: `sub-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      senderId: data.user?.userId?.toString() ?? data.user?.id?.toString() ?? '',
      username: author,
      text: `${author} subscribed!`,
      timestamp: Date.now(),
    });
  });
  conn.on(WebcastEvent.FOLLOW, (data: any) => {
    const author = data.user?.nickname || data.user?.uniqueId || 'Someone';
    broadcast(ch, {
      type: 'follow',
      id: `follow-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      senderId: data.user?.userId?.toString() ?? data.user?.id?.toString() ?? '',
      username: author,
      text: `${author} followed!`,
      timestamp: Date.now(),
    });
  });
  conn.on(WebcastEvent.SHARE, (data: any) => {
    const author = data.user?.nickname || data.user?.uniqueId || 'Someone';
    broadcast(ch, {
      type: 'share',
      id: `share-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      senderId: data.user?.userId?.toString() ?? data.user?.id?.toString() ?? '',
      username: author,
      text: `${author} shared the stream!`,
      timestamp: Date.now(),
    });
  });

  conn.on(WebcastEvent.ROOM_PIN, (data: any) => {
    const pinned = data.pinnedMessage ?? data.message ?? data;
    const u = pinned?.user ?? data.user;
    const text = pinned?.content ?? pinned?.comment ?? '';
    if (!text) { broadcast(ch, { type: 'unpin' }); return; }
    broadcast(ch, {
      type: 'pin',
      id: pinned?.common?.msgId?.toString() ?? `pin-${Date.now()}`,
      senderId: u?.userId?.toString() ?? '',
      username: u?.nickname || u?.uniqueId || 'viewer',
      text,
      timestamp: Date.now(),
    });
  });

  function recordConnectError() {
    metrics.upstreamErrors += 1;
  }

  function scheduleReconnect() {
    if (ch.closed) return;
    setStatus(ch, { type: 'status', status: 'connecting' });
    setTimeout(() => {
      if (ch.closed || !ch.subs.size) return;
      conn.connect().catch((err: any) => {
        recordConnectError();
        const name = err?.name ?? '';
        if (name === 'UserOfflineError') {
          setStatus(ch, { type: 'status', status: 'offline', detail: 'User is not live' });
          setTimeout(scheduleReconnect, Math.max(60_000 - ch.backoff, 10_000));
        } else if (name === 'UserNotFoundError') {
          setStatus(ch, { type: 'status', status: 'error', detail: `TikTok user @${user} not found` });
          destroyChannel(user);
        } else {
          setStatus(ch, { type: 'status', status: 'error', detail: err?.message ?? 'connection failed' });
          ch.backoff = Math.min(ch.backoff * 2, 120_000);
          metrics.reconnects += 1;
          scheduleReconnect();
        }
      });
    }, ch.backoff);
  }

  conn.connect().catch((err: any) => {
    recordConnectError();
    const name = err?.name ?? '';
    if (name === 'UserOfflineError') {
      setStatus(ch, { type: 'status', status: 'offline', detail: 'User is not live' });
      setTimeout(scheduleReconnect, 60_000);
    } else if (name === 'UserNotFoundError') {
      setStatus(ch, { type: 'status', status: 'error', detail: `TikTok user @${user} not found` });
      destroyChannel(user);
    } else {
      setStatus(ch, { type: 'status', status: 'error', detail: err?.message ?? 'connection failed' });
      metrics.reconnects += 1;
      scheduleReconnect();
    }
  });

  return ch;
}

function destroyChannel(user: string) {
  const ch = channels.get(user);
  if (!ch) return;
  ch.closed = true;
  if (ch.lingerTimer) clearTimeout(ch.lingerTimer);
  try { ch.conn.disconnect(); } catch { /* already down */ }
  channels.delete(user);
}

export function subscribe(rawUser: string, send: Send): () => void {
  const normalized = normalizeChatChannel('tiktok', rawUser);
  if (!normalized) throw new Error('invalid TikTok user');
  const user = normalized.toLowerCase();
  let ch = channels.get(user);
  if (!ch) {
    ch = createChannel(user);
    channels.set(user, ch);
  } else if (ch.lingerTimer) {
    clearTimeout(ch.lingerTimer);
    ch.lingerTimer = null;
  }
  ch.subs.add(send);

  if (ch.status) {
    try { send(ch.status.data, ch.status.serialized); } catch { /* noop */ }
  } else {
    const status = { type: 'status', status: 'connecting' };
    const serialized = JSON.stringify(status);
    try { send(status, serialized); } catch { /* noop */ }
  }
  for (const event of ch.recent) {
    try { send(event.data, event.serialized); } catch { break; }
  }

  return () => {
    const current = channels.get(user);
    if (!current) return;
    current.subs.delete(send);
    if (current.subs.size === 0 && !current.lingerTimer) {
      current.lingerTimer = setTimeout(() => destroyChannel(user), LINGER_MS);
    }
  };
}

export function tiktokHubAggregateStats() {
  let subscribers = 0;
  let lingeringChannels = 0;
  let bufferedEvents = 0;
  for (const ch of channels.values()) {
    subscribers += ch.subs.size;
    bufferedEvents += ch.recent.length;
    if (ch.lingerTimer) lingeringChannels += 1;
  }
  return {
    activeChannels: channels.size,
    subscribers,
    lingeringChannels,
    bufferedEvents,
    broadcasts: metrics.broadcasts,
    subscriberDeliveries: metrics.subscriberDeliveries,
    reconnects: metrics.reconnects,
    upstreamErrors: metrics.upstreamErrors,
  };
}

/** Compatibility export now returns aggregate-only data, never channel names. */
export function hubStats() {
  return tiktokHubAggregateStats();
}

export function resetTikTokHubForTests() {
  for (const user of [...channels.keys()]) destroyChannel(user);
  metrics.broadcasts = 0;
  metrics.subscriberDeliveries = 0;
  metrics.reconnects = 0;
  metrics.upstreamErrors = 0;
}
