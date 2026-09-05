import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const upstream = vi.hoisted(() => ({
  discover: vi.fn(),
  bootstrap: vi.fn(),
  fetchChat: vi.fn(),
  next: vi.fn(),
}));

vi.mock('@/lib/server/youtubeUpstream', () => ({
  YOUTUBE_OFFLINE_RECHECK_MS: 60_000,
  discoverYouTubeLiveVideos: upstream.discover,
  bootstrapYouTubeChat: upstream.bootstrap,
  fetchYouTubeChat: upstream.fetchChat,
  nextYouTubeContinuation: upstream.next,
}));

import {
  resetYouTubeHubForTests,
  subscribeYouTube,
  youtubeHubAggregateStats,
} from '@/lib/server/youtubeHub';

beforeEach(() => {
  vi.useFakeTimers();
  resetYouTubeHubForTests();
  upstream.discover.mockReset().mockResolvedValue({
    videoIds: ['AAAAAAAAAAA'],
    featuredVideoId: 'AAAAAAAAAAA',
    liveShortVideoId: null,
  });
  upstream.bootstrap.mockReset().mockResolvedValue({
    videoId: 'AAAAAAAAAAA',
    apiKey: 'key',
    clientVersion: '1',
    continuation: 'c0',
    channelId: 'UC1234567890123456789012',
  });
  upstream.fetchChat.mockReset().mockResolvedValue({
    continuationContents: {
      liveChatContinuation: {
        actions: [{ addChatItemAction: { item: { liveChatTextMessageRenderer: { id: 'm1' } } } }],
        continuations: [],
      },
    },
  });
  upstream.next.mockReset().mockReturnValue({ continuation: null, timeoutMs: 0 });
});

afterEach(() => {
  resetYouTubeHubForTests();
  vi.useRealTimers();
});

describe('shared YouTube hub', () => {
  it('uses one discovery/bootstrap/poll upstream for multiple subscribers of the same channel', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = subscribeYouTube('@Streamer', first);
    const unsubscribeSecond = subscribeYouTube('streamer', second);

    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    await Promise.resolve();

    expect(upstream.discover).toHaveBeenCalledTimes(1);
    expect(upstream.bootstrap).toHaveBeenCalledTimes(1);
    expect(upstream.fetchChat).toHaveBeenCalledTimes(1);
    expect(first.mock.calls.some(([event]) => event.type === 'actions')).toBe(true);
    expect(second.mock.calls.some(([event]) => event.type === 'actions')).toBe(true);
    const stats = youtubeHubAggregateStats();
    expect(stats.subscribers).toBe(2);
    expect(stats.actionBatches).toBe(1);
    expect(stats.lastActionBatchSize).toBe(1);
    expect(stats.maxActionBatchSize).toBe(1);
    expect(stats.recentActionBatchSizes).toEqual([1]);
    expect(stats.lastDeliverySpanMs).toBe(0);

    unsubscribeFirst();
    unsubscribeSecond();
  });

  it('reports batch size, provider lag, and planned pacing without changing the overlay', async () => {
    vi.setSystemTime(20_000);
    upstream.fetchChat.mockResolvedValue({
      continuationContents: {
        liveChatContinuation: {
          actions: [
            { addChatItemAction: { item: { liveChatTextMessageRenderer: { id: 'm1', timestampUsec: '19000000' } } } },
            { addChatItemAction: { item: { liveChatTextMessageRenderer: { id: 'm2', timestampUsec: '19000000' } } } },
            { addChatItemAction: { item: { liveChatTextMessageRenderer: { id: 'm3', timestampUsec: '19000000' } } } },
          ],
          continuations: [],
        },
      },
    });

    const unsubscribe = subscribeYouTube('streamer', vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    await Promise.resolve();

    const stats = youtubeHubAggregateStats();
    expect(stats.actionBatches).toBe(1);
    expect(stats.actions).toBe(3);
    expect(stats.averageActionBatchSize).toBe(3);
    expect(stats.lastActionBatchSize).toBe(3);
    expect(stats.maxActionBatchSize).toBe(3);
    expect(stats.recentActionBatchSizes).toEqual([3]);
    expect(stats.providerLagSamples).toBe(3);
    expect(stats.averageProviderLagMs).toBe(1000);
    expect(stats.lastProviderLagMs).toBe(1000);
    expect(stats.lastDeliveryGapMs).toBe(150);
    expect(stats.lastDeliverySpanMs).toBe(300);
    unsubscribe();
  });

  it('starts one independent upstream chat for each simultaneous regular live and live Short', async () => {
    upstream.discover.mockResolvedValue({
      videoIds: ['AAAAAAAAAAA', 'BBBBBBBBBBB'],
      featuredVideoId: 'AAAAAAAAAAA',
      liveShortVideoId: 'BBBBBBBBBBB',
    });
    upstream.bootstrap.mockImplementation(async (videoId: string) => ({
      videoId,
      apiKey: `key-${videoId}`,
      clientVersion: '1',
      continuation: `c-${videoId}`,
      channelId: 'UC1234567890123456789012',
    }));

    const unsubscribe = subscribeYouTube('streamer', vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    await Promise.resolve();

    expect(upstream.discover).toHaveBeenCalledTimes(1);
    expect(upstream.bootstrap).toHaveBeenCalledTimes(2);
    expect(new Set(upstream.bootstrap.mock.calls.map(([videoId]) => videoId)))
      .toEqual(new Set(['AAAAAAAAAAA', 'BBBBBBBBBBB']));
    unsubscribe();
  });
});
