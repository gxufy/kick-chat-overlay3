import {
  recordPerformanceBatch,
  resetPerformanceRuntimeForTests,
  runtimeVisualEffectsReduced,
} from './multichatPerformanceRuntime';

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

/* Auto is now the production default: normal traffic keeps the configured
 * entrance effect, while provider bursts and actual slow browser frames shed
 * only that expensive visual work. `animation on` remains an explicit force-on
 * override for streamers who want the old always-animate behavior. */
let runtimeMode: MultichatRuntimeAnimationMode = 'auto';
let autoBypassUntil = 0;
let lastBatchAnimationEnabled = true;

export function setRuntimeAnimationMode(mode: MultichatRuntimeAnimationMode): void {
  runtimeMode = mode;
  if (mode !== 'auto') autoBypassUntil = 0;
  if (mode === 'on') lastBatchAnimationEnabled = true;
  if (mode === 'off') lastBatchAnimationEnabled = false;
}

export function getRuntimeAnimationMode(): MultichatRuntimeAnimationMode {
  return runtimeMode;
}

/**
 * Record one actual non-empty presentation batch and return whether its entrance
 * should be animated. The result is retained verbatim for ChatOverlay to stamp on
 * the matching immutable render batch. That matters under load: React can render
 * late, but a batch that was classified as a burst never becomes animated merely
 * because the hold timer elapsed before its effect ran.
 */
export function recordRuntimeAnimationBatch(
  batchSize: number,
  now = Date.now(),
): boolean {
  let animate: boolean;

  if (runtimeMode === 'off') {
    animate = false;
  } else if (runtimeMode === 'on') {
    animate = true;
  } else if (batchSize >= AUTO_ANIMATION_BYPASS_BATCH_SIZE) {
    autoBypassUntil = Math.max(autoBypassUntil, now + AUTO_ANIMATION_BYPASS_HOLD_MS);
    animate = false;
  } else if (runtimeVisualEffectsReduced(now)) {
    /* Actual Chromium/OBS frame pressure is a stronger signal than message count:
       keep content current and temporarily skip entrance work until frames recover. */
    autoBypassUntil = Math.max(autoBypassUntil, now + AUTO_ANIMATION_BYPASS_HOLD_MS);
    animate = false;
  } else {
    animate = now >= autoBypassUntil;
  }

  lastBatchAnimationEnabled = animate;
  recordPerformanceBatch(batchSize, runtimeMode, animate);
  return animate;
}

/**
 * Read the immutable decision for the most recently presented non-empty batch.
 * `recordRuntimeAnimationBatch` runs before React receives that batch.
 */
export function runtimeEntranceAnimationEnabled(): boolean {
  if (runtimeMode === 'off') return false;
  if (runtimeMode === 'on') return true;
  return lastBatchAnimationEnabled;
}

/** Test-only reset helper; a browser-source reload naturally resets the module. */
export function resetRuntimeAnimationState(): void {
  runtimeMode = 'auto';
  autoBypassUntil = 0;
  lastBatchAnimationEnabled = true;
  resetPerformanceRuntimeForTests();
}
