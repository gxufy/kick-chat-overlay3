import { describe, expect, it } from 'vitest';
import {
  BURST_PRESENT_INTERVAL_MS,
  drainBurstPresentationQueue,
} from '@/lib/chatBurstPresentation';

describe('chat burst presentation buckets', () => {
  it('uses the ChatIS 200ms presentation cadence', () => {
    expect(BURST_PRESENT_INTERVAL_MS).toBe(200);
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
});
