import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchState = vi.hoisted(() => vi.fn());
vi.mock('@/lib/twitchHypeTrainClient', () => ({
  fetchTwitchHypeTrain: fetchState,
}));

import {
  HYPE_TRAIN_ERROR_BACKOFF_MAX_MS,
  HYPE_TRAIN_INACTIVE_INTERVAL_MS,
  startTwitchHypeTrainPoller,
} from '@/lib/twitchHypeTrainPoller';
import { resetRuntimeEventVisibility } from '@/lib/multichatEventRuntime';

beforeEach(() => {
  vi.useFakeTimers();
  fetchState.mockReset();
  resetRuntimeEventVisibility();
});

afterEach(() => {
  resetRuntimeEventVisibility();
  vi.useRealTimers();
});

describe('Twitch Hype Train failure backoff', () => {
  it('doubles repeated failure delays instead of hammering Twitch indefinitely', async () => {
    fetchState.mockRejectedValue(new Error('upstream down'));
    const stop = startTwitchHypeTrainPoller({ login: 'streamer', onState: vi.fn() });

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchState).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(HYPE_TRAIN_INACTIVE_INTERVAL_MS - 1);
    expect(fetchState).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchState).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync((HYPE_TRAIN_INACTIVE_INTERVAL_MS * 2) - 1);
    expect(fetchState).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchState).toHaveBeenCalledTimes(3);

    expect(HYPE_TRAIN_ERROR_BACKOFF_MAX_MS).toBe(600_000);
    stop();
  });
});
