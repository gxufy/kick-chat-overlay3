import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BURST_PRESENT_INTERVAL_MS,
  drainBurstPresentationQueue,
  startBurstPresentationTicker,
} from '@/lib/chatBurstPresentation';
import {
  AUTO_ANIMATION_BYPASS_BATCH_SIZE,
  resetRuntimeAnimationState,
  runtimeEntranceAnimationEnabled,
  setRuntimeAnimationMode,
} from '@/lib/multichatAnimationRuntime';

beforeEach(() => resetRuntimeAnimationState());
afterEach(() => {
  resetRuntimeAnimationState();
  vi.useRealTimers();
});

describe('chat burst presentation buckets', () => {
  it('uses the ChatIS 200ms presentation cadence', () => {
    expect(BURST_PRESENT_INTERVAL_MS).toBe(200);
  });

  it('runs one permanent phase-locked metronome instead of per-burst delays', () => {
    vi.useFakeTimers();
    const flush = vi.fn();
    const stop = startBurstPresentationTicker(flush);

    vi.advanceTimersByTime(199);
    expect(flush).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(1);
    expect(flush).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(200);
    expect(flush).toHaveBeenCalledTimes(2);

    stop();
    vi.advanceTimersByTime(400);
    expect(flush).toHaveBeenCalledTimes(2);
  });

  it('commits every message accumulated in one bucket at once', () => {
    const pending = Array.from({ length: 20 }, (_, index) => `message-${index}`);
    const batch = drainBurstPresentationQueue(pending);
    expect(batch).toHaveLength(20);
    expect(batch[0]).toBe('message-0');
    expect(batch[19]).toBe('message-19');
    expect(pending).toEqual([]);
  });

  it('keeps later arrivals for the next independent bucket', () => {
    const pending = ['a', 'b', 'c'];
    expect(drainBurstPresentationQueue(pending)).toEqual(['a', 'b', 'c']);
    pending.push('d', 'e');
    expect(drainBurstPresentationQueue(pending)).toEqual(['d', 'e']);
    expect(pending).toEqual([]);
  });

  it('uses the exact drained batch as auto-mode traffic pressure', () => {
    setRuntimeAnimationMode('auto');
    const pending = Array.from({ length: AUTO_ANIMATION_BYPASS_BATCH_SIZE }, (_, index) => index);
    drainBurstPresentationQueue(pending);
    expect(runtimeEntranceAnimationEnabled()).toBe(false);
  });

  it('does not let an empty metronome tick overwrite the last real batch decision', () => {
    setRuntimeAnimationMode('auto');
    const heavy = Array.from({ length: AUTO_ANIMATION_BYPASS_BATCH_SIZE }, (_, index) => index);
    drainBurstPresentationQueue(heavy);
    expect(runtimeEntranceAnimationEnabled()).toBe(false);

    drainBurstPresentationQueue([]);
    expect(runtimeEntranceAnimationEnabled()).toBe(false);
  });
});
