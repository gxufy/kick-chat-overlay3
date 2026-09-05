import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatOverlay from '@/components/overlay/ChatOverlay';
import { MultichatQuerySchema } from '@/lib/multichatConfig';
import { parseTwitchHypeTrainState } from '@/lib/twitchHypeTrainClient';
import { HYPE_TRAIN_ACTIVE_INTERVAL_MS, HYPE_TRAIN_INACTIVE_INTERVAL_MS, startTwitchHypeTrainPoller } from '@/lib/twitchHypeTrainPoller';
import {
  resetRuntimeEventVisibility,
  setRuntimeEventFeatureVisible,
} from '@/lib/multichatEventRuntime';

const fetchState = vi.hoisted(() => vi.fn());
vi.mock('@/lib/twitchHypeTrainClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/twitchHypeTrainClient')>();
  return { ...actual, fetchTwitchHypeTrain: fetchState };
});

beforeEach(() => {
  vi.useFakeTimers();
  fetchState.mockReset();
  resetRuntimeEventVisibility();
});
afterEach(() => {
  resetRuntimeEventVisibility();
  cleanup();
  vi.useRealTimers();
});

describe('Twitch Hype Train response validation', () => {
  it('accepts inactive and normalized active snapshots', () => {
    expect(parseTwitchHypeTrainState({ active: false })).toEqual({ active: false });
    expect(parseTwitchHypeTrainState({ active: true, level: 3, progression: 250, goal: 500 }))
      .toEqual({ active: true, level: 3, progression: 250, goal: 500 });
  });
  it.each([null, [], {}, { active: true, level: 0, progression: 1, goal: 2 }, { active: true, level: 1, progression: 2, goal: 0 }])('rejects malformed %j', (value) => {
    expect(parseTwitchHypeTrainState(value)).toBeNull();
  });
});

describe('Twitch Hype Train poller', () => {
  it('uses inactive and active cadence, emits updates, and does not invent an end on failure', async () => {
    const onState = vi.fn();
    fetchState
      .mockResolvedValueOnce({ active: false })
      .mockResolvedValueOnce({ active: true, level: 1, progression: 25, goal: 100 })
      .mockResolvedValueOnce({ active: true, level: 2, progression: 10, goal: 200 })
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce({ active: false });
    const stop = startTwitchHypeTrainPoller({ login: 'streamer', onState });
    await vi.advanceTimersByTimeAsync(0);
    expect(onState).toHaveBeenLastCalledWith({ active: false });
    await vi.advanceTimersByTimeAsync(HYPE_TRAIN_INACTIVE_INTERVAL_MS);
    expect(onState).toHaveBeenLastCalledWith(expect.objectContaining({ active: true, level: 1 }));
    await vi.advanceTimersByTimeAsync(HYPE_TRAIN_ACTIVE_INTERVAL_MS);
    expect(onState).toHaveBeenLastCalledWith(expect.objectContaining({ active: true, level: 2 }));
    const beforeFailure = onState.mock.calls.length;
    await vi.advanceTimersByTimeAsync(HYPE_TRAIN_ACTIVE_INTERVAL_MS);
    expect(onState).toHaveBeenCalledTimes(beforeFailure);
    await vi.advanceTimersByTimeAsync(HYPE_TRAIN_ACTIVE_INTERVAL_MS);
    expect(onState).toHaveBeenLastCalledWith({ active: false });
    stop();
  });

  it('pauses immediately while the runtime Hype Train feature is off and resumes on command', async () => {
    const onState = vi.fn();
    fetchState
      .mockResolvedValueOnce({ active: true, level: 1, progression: 10, goal: 100 })
      .mockResolvedValueOnce({ active: true, level: 2, progression: 20, goal: 200 });

    const stop = startTwitchHypeTrainPoller({ login: 'streamer', onState });
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchState).toHaveBeenCalledTimes(1);
    expect(onState).toHaveBeenLastCalledWith(expect.objectContaining({ active: true, level: 1 }));

    setRuntimeEventFeatureVisible('hypetrain', false);
    expect(onState).toHaveBeenLastCalledWith({ active: false });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetchState).toHaveBeenCalledTimes(1);

    setRuntimeEventFeatureVisible('hypetrain', true);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchState).toHaveBeenCalledTimes(2);
    expect(onState).toHaveBeenLastCalledWith(expect.objectContaining({ active: true, level: 2 }));
    stop();
  });

  it('aborts and leaves no scheduled request after stop', async () => {
    let signal: AbortSignal | undefined;
    fetchState.mockImplementation((_login: string, incoming: AbortSignal) => {
      signal = incoming;
      return new Promise(() => {});
    });
    const stop = startTwitchHypeTrainPoller({ login: 'streamer', onState: vi.fn() });
    await vi.advanceTimersByTimeAsync(0);
    stop();
    expect(signal?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetchState).toHaveBeenCalledTimes(1);
  });
});

describe('Twitch Hype Train renderer', () => {
  it('shows level, progression, clamped percentage, and end fade', () => {
    const config = MultichatQuerySchema.parse({ twitch: 'streamer', animation: 'none' });
    const common = { config, messages: [], fadingIds: new Set<string>(), pinnedMessage: null, showLoader: false as const };
    const state = { active: true as const, level: 4, progression: 750, goal: 500 };
    const { getByTestId, rerender } = render(<ChatOverlay {...common} hypeTrain={state} />);
    expect(getByTestId('twitch-hype-train').textContent).toContain('Level 4');
    expect(getByTestId('twitch-hype-train').textContent).toContain('750 / 500 (100%)');
    expect((getByTestId('twitch-hype-train-progress') as HTMLElement).style.width).toBe('100%');
    rerender(<ChatOverlay {...common} hypeTrain={state} hypeTrainEnding />);
    expect((getByTestId('twitch-hype-train') as HTMLElement).style.opacity).toBe('0');
  });
});
