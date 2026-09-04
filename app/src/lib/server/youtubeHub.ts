import { normalizeChatChannel } from '../channelValidation';
import {
  bootstrapYouTubeChat,
  discoverYouTubeLiveVideos,
  fetchYouTubeChat,
  nextYouTubeContinuation,
  YOUTUBE_OFFLINE_RECHECK_MS,
} from './youtubeUpstream';

type HubStatus = 'connecting' | 'connected' | 'offline' | 'error';

type YouTubeHubEvent =
  | {
      type: 'status';
      status: HubStatus;
      detail?: string;
      videoId?: string;
      channelId?: string;
      liveCount?: number;
    }
  | {
      type: 'actions';
      videoId: string;
      actions: any[];
      timestamp: number;
    };

type Send = (data: YouTubeHubEvent, serialized: string) => void;

type BufferedEvent = {
  data: YouTubeHubEvent;
  serialized: string;
};

type ChatState = {
  videoId: string;
  abort: AbortController;
  healthy: boolean;
};

type ChannelState = {
  channel: string;
  subs: Set<Send>;
  recent: BufferedEvent[];
  status: BufferedEvent | null;
  chats: Map<string, ChatState>;
  featuredVideoId: string | null;
  discoveryTimer: ReturnType<typeof setTimeout> | null;
  discoveryAbort: AbortController | null;
  lingerTimer: ReturnType<typeof setTimeout> | null;
  closed: boolean;
};

const channels = new Map<string, ChannelState>();
const LINGER_MS = 30_000;
export const YOUTUBE_HUB_RECENT_MAX = 100;
const CHAT_RETRY_START_MS = 5_000;
const CHAT_RETRY_MAX_MS = 60_000;

const metrics = {
  startedAt: Date.now(),
  discoveries: 0,
  actionBatches: 0,
  actions: 0,
  upstreamReconnects: 0,
  upstreamErrors: 0,
  subscriberDeliveries: 0,
};

function serialize(data: YouTubeHubEvent): string | null {
  try { return JSON.stringify(data); }
  catch { return null; }
}

function fanOut(ch: ChannelState, data: YouTubeHubEvent, buffer: boolean): void {
  const serialized = serialize(data);
  if (!serialized) return;
  if (buffer) {
    ch.recent.push({ data, serialized });
    while (ch.recent.length > YOUTUBE_HUB_RECENT_MAX) ch.recent.shift();
  }
  for (const send of ch.subs) {
    try {
      send(data, serialized);
      metrics.subscriberDeliveries += 1;
    } catch {
      // The route removes dead subscribers when the request closes.
    }
  }
}

function setStatus(ch: ChannelState, data: Omit<Extract<YouTubeHubEvent, { type: 'status' }>, 'type'>): void {
  const event: YouTubeHubEvent = { type: 'status', ...data };
  const serialized = serialize(event);
  if (!serialized) return;
  ch.status = { data: event, serialized };
  for (const send of ch.subs) {
    try {
      send(event, serialized);
      metrics.subscriberDeliveries += 1;
    } catch {
      // Request-close cleanup owns subscriber removal.
    }
  }
}

function healthyChatCount(ch: ChannelState): number {
  let count = 0;
  for (const chat of ch.chats.values()) if (chat.healthy) count += 1;
  return count;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function chatDetail(ch: ChannelState): string {
  return `Connected to @${ch.channel}${ch.chats.size > 1 ? ' (+ live Short)' : ''}`;
}

async function runChat(ch: ChannelState, state: ChatState): Promise<void> {
  let retry = CHAT_RETRY_START_MS;
  let connectedOnce = false;
  try {
    while (!ch.closed && !state.abort.signal.aborted) {
      try {
        const boot = await bootstrapYouTubeChat(state.videoId, state.abort.signal);
        if (!boot) return;
        state.healthy = true;
        retry = CHAT_RETRY_START_MS;
        setStatus(ch, {
          status: 'connected',
          detail: chatDetail(ch),
          videoId: state.videoId,
          ...(boot.channelId ? { channelId: boot.channelId } : {}),
          liveCount: Math.max(healthyChatCount(ch), 1),
        });
        connectedOnce = true;

        let continuation: string | null = boot.continuation;
        while (continuation && !ch.closed && !state.abort.signal.aborted) {
          const data = await fetchYouTubeChat(
            boot.apiKey,
            boot.clientVersion,
            continuation,
            state.abort.signal,
          );
          const live = data?.continuationContents?.liveChatContinuation;
          if (!live) return;
          const actions = Array.isArray(live.actions) ? live.actions : [];
          if (actions.length) {
            metrics.actionBatches += 1;
            metrics.actions += actions.length;
            fanOut(ch, {
              type: 'actions',
              videoId: state.videoId,
              actions,
              timestamp: Date.now(),
            }, true);
          }
          const next = nextYouTubeContinuation(live);
          continuation = next.continuation;
          if (continuation) await sleep(next.timeoutMs, state.abort.signal);
        }
        return;
      } catch (error) {
        if (isAbort(error) || ch.closed) return;
        state.healthy = false;
        metrics.upstreamErrors += 1;
        if (connectedOnce) metrics.upstreamReconnects += 1;
        if (healthyChatCount(ch) === 0) {
          setStatus(ch, {
            status: 'error',
            detail: `YouTube chat reconnecting in ${Math.round(retry / 1000)}s`,
          });
        }
        await sleep(retry, state.abort.signal);
        retry = Math.min(retry * 2, CHAT_RETRY_MAX_MS);
      }
    }
  } finally {
    const current = ch.chats.get(state.videoId);
    if (current === state) ch.chats.delete(state.videoId);
    if (!ch.closed && ch.chats.size === 0) {
      setStatus(ch, { status: 'offline', detail: 'Live chat ended — rechecking' });
    }
  }
}

function startChat(ch: ChannelState, videoId: string): void {
  if (ch.closed || ch.chats.has(videoId)) return;
  const state: ChatState = { videoId, abort: new AbortController(), healthy: false };
  ch.chats.set(videoId, state);
  void runChat(ch, state);
}

function scheduleDiscovery(ch: ChannelState, delay = YOUTUBE_OFFLINE_RECHECK_MS): void {
  if (ch.closed) return;
  if (ch.discoveryTimer) clearTimeout(ch.discoveryTimer);
  ch.discoveryTimer = setTimeout(() => {
    ch.discoveryTimer = null;
    void discover(ch);
  }, delay);
}

async function discover(ch: ChannelState): Promise<void> {
  if (ch.closed) return;
  ch.discoveryAbort?.abort();
  const controller = new AbortController();
  ch.discoveryAbort = controller;
  metrics.discoveries += 1;
  if (ch.chats.size === 0) setStatus(ch, { status: 'connecting', detail: `Looking up @${ch.channel}…` });

  try {
    const result = await discoverYouTubeLiveVideos(ch.channel, controller.signal);
    if (ch.closed || controller.signal.aborted) return;
    ch.featuredVideoId = result.featuredVideoId;
    for (const videoId of result.videoIds) startChat(ch, videoId);
    if (!result.videoIds.length && ch.chats.size === 0) {
      setStatus(ch, {
        status: 'offline',
        detail: `Not live right now — rechecking every ${Math.round(YOUTUBE_OFFLINE_RECHECK_MS / 1000)}s`,
      });
    }
    scheduleDiscovery(ch);
  } catch (error) {
    if (isAbort(error) || ch.closed) return;
    metrics.upstreamErrors += 1;
    if (ch.chats.size === 0) {
      setStatus(ch, { status: 'error', detail: 'YouTube lookup failed — retrying' });
    }
    scheduleDiscovery(ch, CHAT_RETRY_START_MS);
  } finally {
    if (ch.discoveryAbort === controller) ch.discoveryAbort = null;
  }
}

function destroyChannel(channel: string): void {
  const ch = channels.get(channel);
  if (!ch) return;
  ch.closed = true;
  if (ch.discoveryTimer) clearTimeout(ch.discoveryTimer);
  if (ch.lingerTimer) clearTimeout(ch.lingerTimer);
  ch.discoveryAbort?.abort();
  ch.discoveryAbort = null;
  for (const chat of ch.chats.values()) chat.abort.abort();
  ch.chats.clear();
  channels.delete(channel);
}

function createChannel(channel: string): ChannelState {
  return {
    channel,
    subs: new Set(),
    recent: [],
    status: null,
    chats: new Map(),
    featuredVideoId: null,
    discoveryTimer: null,
    discoveryAbort: null,
    lingerTimer: null,
    closed: false,
  };
}

export function subscribeYouTube(rawChannel: string, send: Send): () => void {
  const channel = normalizeChatChannel('youtube', rawChannel);
  if (!channel) throw new Error('invalid YouTube channel');
  const key = channel.toLowerCase();
  let ch = channels.get(key);
  let created = false;
  if (!ch) {
    ch = createChannel(channel);
    channels.set(key, ch);
    created = true;
  } else if (ch.lingerTimer) {
    clearTimeout(ch.lingerTimer);
    ch.lingerTimer = null;
  }

  ch.subs.add(send);
  if (ch.status) {
    try { send(ch.status.data, ch.status.serialized); } catch { /* noop */ }
  } else {
    const status: YouTubeHubEvent = { type: 'status', status: 'connecting' };
    const serialized = JSON.stringify(status);
    try { send(status, serialized); } catch { /* noop */ }
  }
  for (const event of ch.recent) {
    try { send(event.data, event.serialized); } catch { break; }
  }
  if (created) void discover(ch);

  return () => {
    const current = channels.get(key);
    if (!current) return;
    current.subs.delete(send);
    if (current.subs.size === 0 && !current.lingerTimer) {
      current.lingerTimer = setTimeout(() => destroyChannel(key), LINGER_MS);
    }
  };
}

export function youtubeHubAggregateStats() {
  let subscribers = 0;
  let liveChats = 0;
  let lingeringChannels = 0;
  let bufferedEvents = 0;
  for (const ch of channels.values()) {
    subscribers += ch.subs.size;
    liveChats += ch.chats.size;
    bufferedEvents += ch.recent.length;
    if (ch.lingerTimer) lingeringChannels += 1;
  }
  return {
    activeChannels: channels.size,
    subscribers,
    liveChats,
    lingeringChannels,
    bufferedEvents,
    discoveries: metrics.discoveries,
    actionBatches: metrics.actionBatches,
    actions: metrics.actions,
    upstreamReconnects: metrics.upstreamReconnects,
    upstreamErrors: metrics.upstreamErrors,
    subscriberDeliveries: metrics.subscriberDeliveries,
  };
}

/** Test-only reset; production callers never need to enumerate channel keys. */
export function resetYouTubeHubForTests(): void {
  for (const key of [...channels.keys()]) destroyChannel(key);
  metrics.startedAt = Date.now();
  metrics.discoveries = 0;
  metrics.actionBatches = 0;
  metrics.actions = 0;
  metrics.upstreamReconnects = 0;
  metrics.upstreamErrors = 0;
  metrics.subscriberDeliveries = 0;
}
