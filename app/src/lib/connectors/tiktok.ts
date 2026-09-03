/* TikTok Live connector — thin EventSource client over /api/tiktok/chat SSE.
 * The persistent websocket lives server-side (tiktok-live-connector).
 * TikTok has no colors/emotes; moderator/subscriber flags become badges.
 */
import type { Connector, ConnectorCallbacks, UnifiedMessage } from '../types';
import { isMessageFromCurrentOverlaySession } from '../startupMessageBaseline';

const TIKTOK_SEEN_MAX = 512;

export interface TikTokConnectorOpts extends ConnectorCallbacks {
  channel: string;
}

export function createTikTokConnector(opts: TikTokConnectorOpts): Connector {
  let es: EventSource | null = null;
  let stopped = false;
  const startedAt = Date.now();
  const seen = new Set<string>();
  const seenOrder: string[] = [];

  /* The server hub intentionally replays a short recent-event window to every
   * new SSE subscriber. Rows from before this browser-source instance started are
   * startup context, not new chat, so they are remembered but never emitted.
   * Reconnect replay still recovers genuinely missed rows from after startedAt,
   * while the id gate prevents rows already shown from appearing twice. */
  function remember(id: unknown): boolean {
    if (id === null || id === undefined || id === '') return true;
    const key = String(id);
    if (seen.has(key)) return false;
    seen.add(key);
    seenOrder.push(key);
    while (seenOrder.length > TIKTOK_SEEN_MAX) {
      const oldest = seenOrder.shift();
      if (oldest !== undefined) seen.delete(oldest);
    }
    return true;
  }

  function toMessage(d: any, kind: 'chat' | 'system'): UnifiedMessage {
    const badges: UnifiedMessage['badges'] = [];
    // real TikTok badge art (top gifter, sub, fan-club) from badgeList
    for (const url of d.badgeUrls ?? []) badges.push({ type: 'tiktok', url });
    if (d.moderator) badges.push({ type: 'moderator' });
    if (d.subscriber && !(d.badgeUrls?.length)) badges.push({ type: 'subscriber' });

    let text: string = d.text ?? '';
    const emotes: UnifiedMessage['emotes'] = [];
    if (d.giftIcon) {
      const token = 'gift';
      const begin = Array.from(text).length + 1;
      emotes.push({ begin, end: begin + token.length, text: token, url: d.giftIcon });
      text = `${text} ${token}`;
    }
    return {
      platform: 'tiktok',
      id: d.id === null || d.id === undefined ? '' : String(d.id),
      senderId: d.senderId ?? '',
      username: d.username ?? '',
      color: '',
      badges,
      text,
      emotes,
      timestamp: d.timestamp ?? Date.now(),
      kind,
      category: d.type === 'gift' ? 'gift'
        : d.type === 'sub' ? 'subscription'
        : (d.type === 'follow' || d.type === 'share') ? 'follow'
        : undefined,
      avatar: d.avatar,
    };
  }

  function emitMessage(d: any, kind: 'chat' | 'system'): void {
    if (!remember(d.id)) return;
    const message = toMessage(d, kind);
    if (!isMessageFromCurrentOverlaySession(message.timestamp, startedAt)) return;
    opts.onMessage(message);
  }

  function connect() {
    if (stopped) return;
    opts.onStatus('connecting');
    es = new EventSource(`/api/tiktok/chat?user=${encodeURIComponent(opts.channel)}`);
    es.onmessage = (e) => {
      let d: any;
      try { d = JSON.parse(e.data); } catch { return; }
      switch (d.type) {
        case 'status': opts.onStatus(d.status, d.detail); break;
        case 'chat':   emitMessage(d, 'chat'); break;
        case 'gift':
        case 'sub':
        case 'follow':
        case 'share':  emitMessage(d, 'system'); break;
        case 'delete': opts.onDelete(d.senderId ? { senderId: d.senderId } : { id: d.id }); break;
        case 'pin':    opts.onPin({ message: toMessage(d, 'chat') }); break;
        case 'unpin':  opts.onPin(null); break;
      }
    };
    es.onerror = () => {
      es?.close();
      if (!stopped) setTimeout(connect, 5000); // SSE drop → reconnect
    };
  }

  return {
    start() { connect(); },
    stop() {
      stopped = true;
      es?.close();
    },
  };
}
