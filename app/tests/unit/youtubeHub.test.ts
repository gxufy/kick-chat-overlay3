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
    expect(youtubeHubAggregateStats().subscribers).toBe(2);

    unsubscribeFirst();
    unsubscribeSecond();
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
