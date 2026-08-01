/* Deterministic sample viewer counts for the generator's built-in preview.
 *
 * These are `PlatformStatuses` values — the same per-platform shape
 * `/api/viewers` results are folded into before `ViewerCounterDisplay` sees
 * them. The preview therefore feeds the production renderer exactly what the
 * live overlay feeds it, and every counter setting behaves here as it will in
 * OBS because the code deciding that is the same code: combined and separate
 * modes, icons, alignment, the pill background, the text shadow, the outline,
 * and the rolling number's own grouping all come from the renderer.
 *
 * The numbers are formatted by that renderer, not here. `RollingCount` calls
 * `toLocaleString()`, so the thousands separator a user sees in the preview is
 * produced by the authoritative formatter rather than restated by a fixture.
 *
 * DETERMINISM. Fixed literals, no Date.now, no Math.random, no network. The
 * preview paints identically on every render and in every test run.
 *
 * The values are clearly fictional but plausibly shaped, and at least one is
 * large enough to show grouping in both combined and separate modes — a
 * four-figure sample would have hidden whether the separator works at all.
 *
 * Browser-safe — no server-only imports, no secrets.
 */
import { PLATFORM_ORDER, type PlatformStatuses, type ViewerPlatform } from '@/lib/viewerCounterConfig';

/**
 * The built-in sample counts, per platform.
 *
 * Every platform is `live` with a measured number rather than one being left
 * offline or unavailable. Those two states are worth being able to see, and the
 * renderer draws them from the same statuses — but an em dash or a missing pill
 * in the *initial* preview is indistinguishable from the empty frame this
 * replaces, so the default set measures all four. Setting a count to nothing
 * reaches the unavailable presentation from the controls.
 */
export const SAMPLE_COUNTER_COUNTS: Readonly<Record<ViewerPlatform, number>> = {
  twitch: 12_480,
  youtube: 3_907,
  kick: 1_268,
  tiktok: 842,
};

/** Largest value the preview controls accept. Above this, grouping is proven. */
export const COUNTER_COUNT_MAX = 9_999_999;

/**
 * Build statuses from a set of counts.
 *
 * A platform whose count is absent becomes `live-unknown`, which is how the
 * renderer is told "present, but not countable" — the state that draws the em
 * dash. Passing no counts at all yields the built-in set.
 */
/**
 * Statuses for a configured channel whose first poll has not committed yet.
 *
 * The problem this solves is not a blank preview — it is a *dishonest* one. While
 * a real channel's first request was in flight the generator kept showing the
 * sample set, so a Twitch-only counter displayed a TikTok pill with a four-digit
 * count beside the words "Loading live viewer count". Nothing on screen belonged
 * to the channel that had been typed.
 *
 * So the loading state is built from the configured platforms and nothing else,
 * and every one of them carries no measured number. No count is invented, no
 * unconfigured platform can appear, and the fallback stays non-blank. It is
 * deliberately expressed as statuses rather than as a new rendering path: the
 * same `ViewerCounterDisplay` draws it, so combined and separate modes, icons and
 * alignment are whatever the real overlay would do with the same configuration.
 *
 * WHY `live-unknown` AND NOT `unavailable`. The em dash is what both states
 * print, and `unavailable` is the closer name — but it is not the state that
 * *shows* anything. `visiblePlatforms` counts only `live` and `live-unknown`, so
 * a set of `unavailable` statuses draws a combined pill with an em dash and no
 * icons at all, and in separate mode draws nothing whatsoever: a blank frame,
 * which is the original bug back again. `live-unknown` is the one state that
 * yields the required icon-plus-em-dash in both modes through a renderer nobody
 * had to touch. Read as "this platform is being counted, and there is no number
 * yet", which is exactly the loading window.
 *
 * Order follows `PLATFORM_ORDER` rather than the caller's array, so the pills sit
 * where the live result will sit and the reveal is not a reshuffle.
 */
export function loadingCounterStatuses(
  configured: readonly ViewerPlatform[],
): PlatformStatuses {
  const statuses: PlatformStatuses = {};
  for (const platform of PLATFORM_ORDER) {
    if (configured.includes(platform)) statuses[platform] = { state: 'live-unknown' };
  }
  return statuses;
}

export function sampleCounterStatuses(
  counts: Partial<Record<ViewerPlatform, number>> = SAMPLE_COUNTER_COUNTS,
): PlatformStatuses {
  const statuses: PlatformStatuses = {};
  for (const platform of PLATFORM_ORDER) {
    const value = counts[platform];
    statuses[platform] =
      typeof value === 'number' ? { state: 'live', viewers: value } : { state: 'live-unknown' };
  }
  return statuses;
}

/**
 * Parse a typed preview count.
 *
 * Returns the integer, or null for anything that is not a safe non-negative
 * whole number within range — including the empty field, which the controls
 * treat as "not countable" rather than as zero. Deliberately strict about the
 * string form as well as the value: `Number('1e9')` and `Number(' 12 ')` are
 * both finite, and neither is something a person typed into a count field.
 */
export function parseCounterCount(raw: string): number | null {
  if (!/^\d{1,7}$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 && value <= COUNTER_COUNT_MAX ? value : null;
}
