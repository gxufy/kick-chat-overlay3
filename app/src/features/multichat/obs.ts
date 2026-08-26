/* MultiChat browser-source sizes, in one place.
 *
 * Two "recommended" values existed: the generator's own OBS setup step said
 * 680 × 280, README.md said 830 × 230. Both render correctly — the overlay has
 * no fixed dimensions and reflows at any size — so neither was a bug, but two
 * recommendations with no stated difference was.
 *
 * Resolved by making 680 × 280 canonical, because it is what the in-app setup
 * step beside the tool has always shown and what the descriptor already used for
 * its preview height, and by documenting 830 × 230 as the wider, shorter
 * alternative it actually is. Nothing about the overlay changed.
 */

/** Canonical size: the descriptor's OBS hint and preview viewport height. */
export const MULTICHAT_OBS_SIZE = { width: 680, height: 280 } as const;

/** Wider and shorter — fewer visible messages, less vertical scene space. */
export const MULTICHAT_OBS_ALTERNATE = { width: 830, height: 230 } as const;
