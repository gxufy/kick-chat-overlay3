

/**
 * Google Fonts `family=` specifications, keyed by `font=` value.
 *
 * Each spec is copied verbatim from the combined stylesheet the generator page
 * already requests, so a face renders identically in the overlay and in the
 * generator preview. The overlay draws messages at weight 400 or 800, both of
 * which every spec below covers.
 */
export const OVERLAY_FONT_SPECS: Readonly<Record<string, string>> = {
  baloo: 'Baloo+Tammudu+2:wght@400;500;600;700;800',
  roboto: 'Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,400',
  lato: 'Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,400',
  noto: 'Noto+Sans+JP:wght@100;300;400;500;700;900',
  sourcecode:
    'Source+Code+Pro:ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;0,900;1,400',
  comfortaa: 'Comfortaa:wght@300;400;500;600;700',
  dancing: 'Dancing+Script:wght@400;500;600;700',
  indieflower: 'Indie+Flower',
  opensans: 'Open+Sans:ital,wght@0,300..800;1,300..800',
};

/**
 * `family=` specs for the faces our own UI is set in, as opposed to the faces an
 * overlay can be configured to draw chat in. Kept beside the overlay specs so
 * one file describes every Google face the site requests.
 */
export const UI_FONT_SPECS: Readonly<Record<string, string>> = {
  montserrat: 'Montserrat:wght@400;500;600;700;800',
  robotomono: 'Roboto+Mono:ital,wght@0,100..700;1,100..700',
};

/** Self-hosted faces shared by the generator and direct overlay routes. */
export const LOCAL_OVERLAY_FONT_CSS = `
@font-face {
  font-family: Geist;
  src: url('/fonts/Geist-wght.woff2') format('woff2');
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
}`;

/** Build a Google Fonts CSS2 URL for one or more `family=` specs. */
export function googleFontsUrl(specs: readonly string[]): string {
  const families = specs.map((spec) => `family=${spec}`).join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

/**
 * A Google Fonts request as an `@import` rule for an inline `<style>`.
 *
 * `<link rel="stylesheet">` inside `next/head` is unsupported — Next warns "Do
 * not add stylesheets using next/head" on every render in development. The
 * fonts each route needs differ (the homepage wants one UI face, the Classic
 * generator additionally wants all nine picker faces, an overlay wants only the
 * one family its URL selected), so there is no single global set to hoist into
 * `_document`, and hoisting the union would make every overlay fetch nine faces
 * it never draws. An `@import` in an inline style requests exactly the same
 * sheet through a mechanism `next/head` does support. Pair it with the
 * preconnects below so the extra hop costs no extra connection setup.
 */
export function googleFontsImportCss(specs: readonly string[]): string {
  return `@import url('${googleFontsUrl(specs)}');`;
}

/**
 * The stylesheet URL the overlay needs for a given `font=` value, or `null`.
 *
 * Only the selected family is requested rather than all nine, so an overlay
 * fetches one face instead of a combined sheet it will not use. `null` means the
 * family needs no network request at all — see the module header for the three
 * cases that covers.
 */
export function overlayFontUrl(font: string | undefined): string | null {
  const spec = font === undefined ? undefined : OVERLAY_FONT_SPECS[font];
  return spec === undefined ? null : googleFontsUrl([spec]);
}

/**
 * The same request as `overlayFontUrl`, as CSS for an inline `<style>`, or
 * `null` when the family needs no network request. See `googleFontsImportCss`
 * for why the overlay emits a style rule rather than a stylesheet link.
 */
export function overlayFontCss(font: string | undefined): string | null {
  const spec = font === undefined ? undefined : OVERLAY_FONT_SPECS[font];
  return spec === undefined ? null : googleFontsImportCss([spec]);
}
