import { recordRuntimeAnimationBatch } from './multichatAnimationRuntime';

/**
 * Presentation cadence used by the overlay ingress queue.
 *
 * ChatIS owns one always-running 200ms update clock. Messages do not
 * start their own delay window; whatever is waiting when that global
 * clock ticks is committed together.
 */
export const BURST_PRESENT_INTERVAL_MS = 200;

/**
 * Drain every message accumulated for the current presentation bucket.
 *
 * This is also the authoritative traffic-pressure sample for the opt-in runtime
 * animation `auto` mode. Sampling here means "heavy" is based on the exact rows
 * about to appear together, not a separate timer or an approximate msg/s counter.
 * Empty metronome ticks deliberately do not overwrite the decision for the last
 * real batch while React is still committing it.
 */
export function drainBurstPresentationQueue<T>(pending: T[]): T[] {
  const batch = pending.splice(0);
  if (batch.length) recordRuntimeAnimationBatch(batch.length);
  return batch;
}

/**
 * Start the same fixed presentation metronome ChatIS uses.
 * The ticker intentionally keeps running with an empty queue so arrival
 * latency stays phase-relative instead of restarting from each first message.
 */
export function startBurstPresentationTicker(
  flush: () => void,
  intervalMs = BURST_PRESENT_INTERVAL_MS,
): () => void {
  const timer = setInterval(flush, intervalMs);
  return () => clearInterval(timer);
}
