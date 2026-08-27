/**
 * Presentation cadence used by the overlay ingress queue.
 *
 * ChatIS owns one always-running 200ms update clock. Messages do not
 * start their own delay window; whatever is waiting when that global
 * clock ticks is committed together.
 */
export const BURST_PRESENT_INTERVAL_MS = 200;

/** Drain every message accumulated for the current presentation bucket. */
export function drainBurstPresentationQueue<T>(pending: T[]): T[] {
  return pending.splice(0);
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
