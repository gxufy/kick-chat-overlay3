/**
 * Presentation cadence used by the overlay ingress queue.
 *
 * ChatIS does not drip a busy backlog through a fixed-size packet cap.
 * It collects everything that arrived during the interval and commits
 * that whole bucket together. Keeping the cadence and drain operation in
 * one tiny module makes that behavior explicit and regression-testable.
 */
export const BURST_PRESENT_INTERVAL_MS = 200;

/** Drain every message accumulated for the current presentation bucket. */
export function drainBurstPresentationQueue<T>(pending: T[]): T[] {
  return pending.splice(0);
}
