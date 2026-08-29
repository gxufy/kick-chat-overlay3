export type MultichatRuntimeAnimationMode = 'on' | 'off' | 'auto';

/**
 * MultiChat presents connector traffic on a fixed 200 ms clock. Four messages in
 * one presentation tick is roughly a 20 msg/s burst, where entrance animation
 * starts competing with readability instead of helping it.
 *
 * This is intentionally our own tuning value. The public UChat source does not
 * expose an equivalent numeric entrance-animation threshold, so do not present it
 * as a copied bChat constant.
 */
export const AUTO_ANIMATION_BYPASS_BATCH_SIZE = 4;

/**
 * Keep bypass active briefly after a heavy tick so adjacent burst batches do not
 * alternate between animated and instant presentation every 200 ms.
 */
export const AUTO_ANIMATION_BYPASS_HOLD_MS = 1_000;

let runtimeMode: MultichatRuntimeAnimationMode = 'on';
let autoBypassUntil = 0;

export function setRuntimeAnimationMode(mode: MultichatRuntimeAnimationMode): void {
  runtimeMode = mode;
  if (mode !== 'auto') autoBypassUntil = 0;
}

export function getRuntimeAnimationMode(): MultichatRuntimeAnimationMode {
  return runtimeMode;
}

/**
 * Record one actual presentation batch and return whether its entrance should be
 * animated. The decision is sampled by ChatOverlay when it creates the matching
 * immutable render batch, so later mode changes never replay old animations.
 */
export function recordRuntimeAnimationBatch(
  batchSize: number,
  now = Date.now(),
): boolean {
  if (runtimeMode === 'off') return false;
  if (runtimeMode === 'on') return true;

  if (batchSize >= AUTO_ANIMATION_BYPASS_BATCH_SIZE) {
    autoBypassUntil = Math.max(autoBypassUntil, now + AUTO_ANIMATION_BYPASS_HOLD_MS);
    return false;
  }

  return now >= autoBypassUntil;
}

/**
 * Read the decision for the batch most recently presented by the 200 ms ticker.
 * `recordRuntimeAnimationBatch` runs before React receives that batch.
 */
export function runtimeEntranceAnimationEnabled(now = Date.now()): boolean {
  if (runtimeMode === 'off') return false;
  if (runtimeMode === 'on') return true;
  return now >= autoBypassUntil;
}

/** Test-only reset helper; a browser-source reload naturally resets the module. */
export function resetRuntimeAnimationState(): void {
  runtimeMode = 'on';
  autoBypassUntil = 0;
}
