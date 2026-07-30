/* Generator-only preview asset catalog: local, offline, repo-owned art.
 *
 * WHY THIS EXISTS. The built-in preview once declared its 7TV cosmetic badge and
 * its 7TV emotes as absolute `https://cdn.7tv.app/...` URLs built from retired
 * base32 ids. 7TV migrated to hex ObjectIds and those URLs now 404, so the base
 * preview rendered a broken-image icon beside the entitled name and the emote
 * word-swaps failed — before anyone typed a channel or refreshed anything. A
 * preview that depends on a third-party CDN being up is not a reliable preview.
 *
 * So every image a preview *fixture* owns lives here as a data URI or a
 * repository-served path, and nothing here reaches the network. This is the one
 * typed place that art is declared; `samples.tsx` and `previewSimulator.ts`
 * reference these names rather than writing URLs of their own.
 *
 * WHAT THIS IS NOT. This changes nothing about how a real OBS overlay resolves
 * live provider badges and emotes — `lib/render.tsx`, `lib/cosmetics.ts` and
 * `lib/twitchEmotes.ts` still fetch the genuine CDN art at runtime. This catalog
 * is generator-only, for the fixtures the preview invents.
 *
 * THE ARTWORK. Every glyph below is original, generic MultiChat-owned SVG: a gem,
 * plain laughing faces, raindrops, a note, a grin. None imitates a 7TV, BTTV,
 * FFZ or Twitch logo — the point is to demonstrate that the production renderer
 * draws normalized badge/emote/paint metadata, not to reproduce a provider mark.
 *
 * Browser-safe — no server-only imports, no secrets, no network.
 */

/**
 * Wrap raw inner SVG markup as a UTF-8 data URI.
 *
 * `encodeURIComponent` so '#' in a fill and the spaces in path data survive the
 * `src` attribute. Matches the inline-SVG form already used for the YouTube badge
 * art in lib/render.tsx, so the preview and the renderer speak the same dialect.
 */
function svgDataUri(inner: string): string {
  return (
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${inner}</svg>`,
    )
  );
}

/* ------------------------------------------------------------------ */
/* Badge art                                                          */
/* ------------------------------------------------------------------ */

/** The 7TV cosmetic badge fixture: a plain purple gem, not the 7TV logo. */
export const PREVIEW_SEVENTV_BADGE_IMAGE = svgDataUri(
  '<path fill="#8a5cf6" d="M6 3h12l4 6-10 12L2 9Z"/>' +
    '<path fill="#c4b1fb" d="M6 3h12l-6 6Zm-4 6 4-6 6 6-6 12Z"/>',
);

/* FFZ room-badge overrides, as local data URIs. Production receives these as a
   `url` on a mod or VIP badge resolved from the FFZ CDN at runtime; the preview
   supplies its own generic art through the same field, and `renderBadges` draws
   any badge carrying a `url` directly — so this exercises the real path. */
export const PREVIEW_FFZ_MOD_BADGE = svgDataUri(
  '<path fill="#5c16c5" d="M3 4h18v13a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Z' +
    'm4.6 4.2v7.6h2V12l2.4 2.7 2.4-2.7v3.8h2V8.2h-2L12 11.4 9.6 8.2Z"/>',
);

export const PREVIEW_FFZ_VIP_BADGE = svgDataUri(
  '<path fill="#e005b9" d="M2 6h4l3 9 3-9h4l-6 13H8Zm14 0h4v13h-4Z"/>',
);

/* Fixture-owned platform badge art that renders as a literal `url`, kept as a
   repository-served path (never a remote host). Only the TikTok moderation
   fixture carries one; every other native badge is resolved by `renderBadges`
   from a badge *type* and is not a fixture-owned image. */
export const PREVIEW_TIKTOK_MOD_BADGE = '/badges/moderator.svg';

/* ------------------------------------------------------------------ */
/* Emote art                                                          */
/* ------------------------------------------------------------------ */

/* Original generic faces. Each is one flat glyph, distinguishable at 32px, and
   none reproduces a real emote — the fixture exists to prove the word-swap and
   the zero-width overlay render, not to ship a particular emote's pixels. */

/** A wide open-mouthed laugh — the plain 7TV emote fixture. */
export const PREVIEW_EMOTE_LAUGH = svgDataUri(
  '<circle cx="12" cy="12" r="10" fill="#ffcf3f"/>' +
    '<circle cx="8.5" cy="9.5" r="1.6" fill="#1b1b1b"/>' +
    '<circle cx="15.5" cy="9.5" r="1.6" fill="#1b1b1b"/>' +
    '<path fill="#1b1b1b" d="M6.5 13c1.4 3 9.6 3 11 0Z"/>',
);

/** A squinting grin — the second 7TV emote fixture, so two are distinguishable. */
export const PREVIEW_EMOTE_GRIN = svgDataUri(
  '<circle cx="12" cy="12" r="10" fill="#ffcf3f"/>' +
    '<path fill="none" stroke="#1b1b1b" stroke-width="1.6" d="M6.5 9.5 10 11l-3.5 1.5m11-3L14 11l3.5 1.5"/>' +
    '<path fill="#1b1b1b" d="M7 14c1.4 2.6 8.6 2.6 10 0Z"/>',
);

/** Falling raindrops — the zero-width overlay fixture, meant to sit over another. */
export const PREVIEW_EMOTE_RAIN = svgDataUri(
  '<path fill="#5cc8ff" d="M7 3c2 3 3 4.6 3 6a3 3 0 1 1-6 0c0-1.4 1-3 3-6Z"/>' +
    '<path fill="#5cc8ff" d="M17 8c1.6 2.4 2.4 3.7 2.4 4.8a2.4 2.4 0 1 1-4.8 0c0-1.1.8-2.4 2.4-4.8Z"/>',
);

/** A cheerful cat-ish face — the BTTV emote fixture. */
export const PREVIEW_EMOTE_CAT = svgDataUri(
  '<path fill="#f4a63a" d="M4 5 8 9h8l4-4v14a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3Z"/>' +
    '<circle cx="9" cy="12" r="1.4" fill="#1b1b1b"/>' +
    '<circle cx="15" cy="12" r="1.4" fill="#1b1b1b"/>' +
    '<path fill="none" stroke="#1b1b1b" stroke-width="1.2" d="M10.5 15.5c1 1 2 1 3 0"/>',
);

/** A wide toothy smile — the FFZ emote fixture. */
export const PREVIEW_EMOTE_SMILE = svgDataUri(
  '<circle cx="12" cy="12" r="10" fill="#7fd17f"/>' +
    '<circle cx="8.5" cy="10" r="1.5" fill="#1b1b1b"/>' +
    '<circle cx="15.5" cy="10" r="1.5" fill="#1b1b1b"/>' +
    '<path fill="#1b1b1b" d="M6.5 13.5c1.6 3.4 9.4 3.4 11 0Z"/>' +
    '<path fill="#fff" d="M8 14.2h8c-.9 1.4-7.1 1.4-8 0Z"/>',
);

/** A rounded neutral face — the native Twitch emote fixture (Kappa slot). */
export const PREVIEW_EMOTE_NATIVE = svgDataUri(
  '<rect x="2" y="2" width="20" height="20" rx="4" fill="#d8d3e8"/>' +
    '<circle cx="9" cy="10" r="1.5" fill="#3a3550"/>' +
    '<circle cx="15" cy="10" r="1.5" fill="#3a3550"/>' +
    '<path fill="none" stroke="#3a3550" stroke-width="1.4" d="M8.5 15c1.8 1.4 5.2 1.4 7 0"/>',
);

/* ------------------------------------------------------------------ */
/* Provider provenance                                                */
/* ------------------------------------------------------------------ */

/**
 * The emote-name tokens each provider contributes to the preview.
 *
 * PROVENANCE IS THE NAME, NOT A DISTINCT DRAW. In production `loadTwitchEmotes`
 * merges FFZ, BTTV and 7TV into one `SevenTVEmote[]` and the renderer word-swaps
 * them identically — there is no per-emote provider field and no separate render
 * path. So "which provider" is expressed the only way the data model expresses
 * it: by the token that provider's loader would have produced. The showcase and
 * the sample cosmetics both read these names, so a fixture and the line that
 * demonstrates it can never drift apart, and all three sit behind the single
 * `sevenTVEmotesEnabled` gate exactly as they do live.
 */
export const PREVIEW_EMOTE_TOKENS = {
  sevenTV: 'OMEGALUL',
  sevenTVAlt: 'KEKW',
  sevenTVZeroWidth: 'RainTime',
  bttv: 'catJAM',
  ffz: 'PepeLaugh',
  nativeTwitch: 'Kappa',
} as const;
