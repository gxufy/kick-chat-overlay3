/* The overlay must actually load the faces it names.
 *
 * `ChatOverlay` resolves `font=` to a CSS family through its own FONT_FAMILIES
 * map. Naming a family loads nothing, and the overlay route shipped no font
 * stylesheet at all, so nine of the twelve options rendered as generic
 * sans-serif in OBS — including `opensans`, the generator's default — while the
 * generator's own preview showed the real face.
 *
 * The load-bearing test reads FONT_FAMILIES out of components/ChatOverlay.tsx
 * and asserts every family that needs a web font has a spec. A hardcoded list
 * would drift the moment a font is added; reading the source cannot. The
 * exemptions are asserted individually below so "needs no stylesheet" always has
 * a stated reason rather than being a silent omission.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  OVERLAY_FONT_SPECS,
  googleFontsUrl,
  overlayFontUrl,
} from '@/lib/overlayFonts';
import { MULTICHAT_FONTS } from '@/lib/multichatConfig';

const OVERLAY_SOURCE = readFileSync(
  join(process.cwd(), 'components', 'ChatOverlay.tsx'),
  'utf8',
);

/** Font keys that deliberately need no Google stylesheet, and why. */
const EXEMPT: Readonly<Record<string, string>> = {
  default: 'resolves to inherit',
  segoe: 'system face',
  impact: 'system face',
  alsina: 'self-hosted @font-face in ChatOverlay',
};

/** `key: "'Family', fallback",` pairs from the overlay's own FONT_FAMILIES. */
const fontFamilyKeys = (): string[] => {
  const start = OVERLAY_SOURCE.indexOf('const FONT_FAMILIES');
  const end = OVERLAY_SOURCE.indexOf('};', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const body = OVERLAY_SOURCE.slice(start, end);
  return Array.from(body.matchAll(/^\s{2}([a-z]+):/gm)).map((m) => m[1]);
};

describe('every named family is either loaded or exempt', () => {
  it('extracts the overlay FONT_FAMILIES keys', () => {
    const keys = fontFamilyKeys();
    // Guards the regex itself: a parse failure must not silently pass the suite.
    expect(keys).toContain('opensans');
    expect(keys.length).toBeGreaterThanOrEqual(MULTICHAT_FONTS.length);
  });

  it('has a spec or a stated exemption for each', () => {
    for (const key of fontFamilyKeys()) {
      const covered = key in OVERLAY_FONT_SPECS || key in EXEMPT;
      expect(covered, `${key} has neither a font spec nor an exemption`).toBe(true);
    }
  });

  it('never both loads and exempts the same family', () => {
    for (const key of Object.keys(EXEMPT)) {
      expect(OVERLAY_FONT_SPECS[key]).toBeUndefined();
    }
  });

  it('covers every selectable font value', () => {
    for (const font of MULTICHAT_FONTS) {
      expect(font in OVERLAY_FONT_SPECS || font in EXEMPT).toBe(true);
    }
  });
});

describe('overlayFontUrl', () => {
  it('returns a stylesheet for the generator default', () => {
    // The regression this whole module exists for: opensans loaded nothing.
    expect(overlayFontUrl('opensans')).toBe(
      googleFontsUrl(['Open+Sans:ital,wght@0,300..800;1,300..800']),
    );
  });

  it('requests only the selected family', () => {
    const url = overlayFontUrl('dancing') ?? '';
    expect(url.match(/family=/g)).toHaveLength(1);
    expect(url).toContain('Dancing+Script');
    expect(url).not.toContain('Open+Sans');
  });

  it('asks for swap so text stays visible while loading', () => {
    expect(overlayFontUrl('roboto')).toContain('display=swap');
  });

  it('returns null for system, inherited, and self-hosted faces', () => {
    for (const key of Object.keys(EXEMPT)) {
      expect(overlayFontUrl(key), key).toBeNull();
    }
  });

  it('returns null for an absent or unknown value', () => {
    expect(overlayFontUrl(undefined)).toBeNull();
    // The parser passes an unrecognized font through verbatim, so this is real.
    expect(overlayFontUrl('not-a-font')).toBeNull();
  });
});

describe('the overlay actually renders the link', () => {
  it('emits a stylesheet link from the resolved href', () => {
    // Pins the wiring, not just the helper: a correct URL that reaches no <link>
    // leaves the original bug in place. Asserted in the DOM by the companion
    // test in overlayFontLink.test.tsx; this guards the source coupling.
    expect(OVERLAY_SOURCE).toContain('overlayFontUrl(cfg.font)');
    expect(OVERLAY_SOURCE).toMatch(/rel="stylesheet"\s+href=\{fontHref\}/);
  });

  it('keeps the self-hosted Alsina face the exemption relies on', () => {
    expect(OVERLAY_SOURCE).toContain('font-family:Alsina');
  });
});
