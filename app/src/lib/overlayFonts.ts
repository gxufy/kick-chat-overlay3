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

/** A Google Fonts request as an `@import` rule for an inline `<style>`. */
export function googleFontsImportCss(specs: readonly string[]): string {
  return `@import url('${googleFontsUrl(specs)}');`;
}

const GOOGLE_FONT_PREFIX = 'google:';
const CUSTOM_FONT_MAX_LENGTH = 80;

/**
 * Normalize a user-entered Google Fonts family without allowing CSS/URL syntax
 * to escape into the inline stylesheet. Family names may contain letters,
 * numbers, spaces, underscores, and hyphens. Diacritics are folded so the same
 * name is used in both the Google request and CSS font-family declaration.
 */
export function normalizeGoogleFontFamily(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized || normalized.length > CUSTOM_FONT_MAX_LENGTH) return null;
  return /^[A-Za-z0-9][A-Za-z0-9 _-]*$/.test(normalized) ? normalized : null;
}

/** Encode a validated custom family into the renderer's internal font value. */
export function googleFontValue(value: unknown): string | null {
  const family = normalizeGoogleFontFamily(value);
  return family ? `${GOOGLE_FONT_PREFIX}${family}` : null;
}

/**
 * Return the explicitly selected Google family represented by `font=`, or null.
 * Legacy unrecognized font values intentionally remain unrecognized so old URLs
 * keep their previous local/Open-Sans fallback and do not suddenly make a new
 * network request.
 */
export function customGoogleFontFamily(font: string | undefined): string | null {
  if (!font?.startsWith(GOOGLE_FONT_PREFIX)) return null;
  return normalizeGoogleFontFamily(font.slice(GOOGLE_FONT_PREFIX.length));
}

function customGoogleFontSpec(family: string): string {
  /* Request the family without forcing a variable/weight axis. Google Fonts
     serves its normal face when available and the browser may synthesize the
     overlay's 400/800 weights when the family does not publish both. */
  return family.replace(/ /g, '+');
}

function quotedCssFamily(family: string): string {
  /* normalizeGoogleFontFamily already rejects quotes/backslashes; keeping this
     separate documents that only validated names reach CSS. */
  return `'${family}', 'Open Sans', Arial, system-ui, sans-serif`;
}

/**
 * The stylesheet URL the overlay needs for a given internal `font` value, or
 * `null`. Presets retain their exact historical specs; only a `google:` value
 * produced from the explicit googleFont= setting can create a free-form request.
 */
export function overlayFontUrl(font: string | undefined): string | null {
  const preset = font === undefined ? undefined : OVERLAY_FONT_SPECS[font];
  if (preset !== undefined) return googleFontsUrl([preset]);
  const custom = customGoogleFontFamily(font);
  return custom ? googleFontsUrl([customGoogleFontSpec(custom)]) : null;
}

/**
 * The same request as `overlayFontUrl`, as CSS for an inline `<style>`, or
 * `null` when the family needs no network request.
 *
 * Custom families also carry a narrowly scoped `!important` declaration. The
 * renderer's inline font-family intentionally falls back for unknown legacy
 * values, so this lets a validated explicit Google family override that inline
 * fallback without changing the preset resolution table or old URLs.
 */
export function overlayFontCss(font: string | undefined): string | null {
  const preset = font === undefined ? undefined : OVERLAY_FONT_SPECS[font];
  if (preset !== undefined) return googleFontsImportCss([preset]);

  const custom = customGoogleFontFamily(font);
  if (!custom) return null;
  const family = quotedCssFamily(custom);
  return `${googleFontsImportCss([customGoogleFontSpec(custom)])}\n#chat_container { font-family: ${family} !important; }\n[data-testid="twitch-hype-train"] { font-family: ${family} !important; }`;
}
