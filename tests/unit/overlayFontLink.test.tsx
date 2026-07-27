/* The font stylesheet must actually be emitted by the overlay.
 *
 * Companion to overlayFonts.test.ts, which covers the key→spec mapping. This one
 * renders the real ChatOverlay and asserts the <link> elements it hands to
 * next/head, because that is the actual defect: /multichat prerendered with no
 * font stylesheet at all, so `font=roboto` named a family the page never fetched
 * and OBS drew generic sans-serif — while the generator preview, which loads
 * these faces for its own UI, showed the real one.
 *
 * next/head is mocked to render its children inline. In jsdom the real one
 * flushes to document.head asynchronously via its side channel, so asserting on
 * document.head yields an empty list for *every* font — which would make the
 * negative cases below pass vacuously even with the feature entirely removed.
 * The mock is the honest boundary: it proves ChatOverlay emits the right links.
 * Whether next/head hoists them into <head> is Next's own behaviour, and the
 * other pages' prerendered markup already shows that it does.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import ChatOverlay from '@/components/ChatOverlay';
import { MultichatQuerySchema } from '@/lib/multichatConfig';

vi.mock('next/head', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

afterEach(cleanup);

/** A parsed config for one Kick channel with an explicit font. */
const config = (font?: string) =>
  MultichatQuerySchema.parse({ kick: 'somechannel', ...(font ? { font } : {}) });

/** Render the overlay with no messages — only the emitted head matters here. */
function mount(font?: string) {
  return render(
    <ChatOverlay
      config={config(font)}
      messages={[]}
      fadingIds={new Set()}
      pinnedMessage={null}
      showLoader={false}
    />,
  );
}

/** Google Fonts stylesheet hrefs the overlay emitted. */
function fontSheets(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('link[rel="stylesheet"]'))
    .map((el) => el.getAttribute('href') ?? '')
    .filter((href) => href.includes('fonts.googleapis.com'));
}

describe('web font is emitted by the overlay', () => {
  it('loads the default font, which previously loaded nothing', () => {
    // opensans is MULTICHAT_GENERATOR_DEFAULTS.font, so this was the common case.
    const { container } = mount('opensans');
    const sheets = fontSheets(container);
    expect(sheets).toHaveLength(1);
    expect(sheets[0]).toContain('Open+Sans');
  });

  it('loads the face named by an explicit font parameter', () => {
    const { container } = mount('dancing');
    expect(fontSheets(container)[0]).toContain('Dancing+Script');
  });

  it('requests exactly one family, not the whole set', () => {
    const { container } = mount('roboto');
    const sheets = fontSheets(container);
    expect(sheets).toHaveLength(1);
    expect(sheets[0].match(/family=/g)).toHaveLength(1);
    expect(sheets[0]).not.toContain('Open+Sans');
  });

  it('preconnects so the stylesheet request is not serialized', () => {
    const { container } = mount('lato');
    const origins = Array.from(
      container.querySelectorAll('link[rel="preconnect"]'),
    ).map((el) => el.getAttribute('href'));
    expect(origins).toContain('https://fonts.googleapis.com');
    expect(origins).toContain('https://fonts.gstatic.com');
  });
});

describe('no request for faces that need none', () => {
  /* These would pass vacuously against document.head — see the header. Each is
     paired with a positive case above that proves the mechanism does fire. */

  it('adds no stylesheet for a system face', () => {
    const { container } = mount('segoe');
    expect(fontSheets(container)).toEqual([]);
  });

  it('adds no stylesheet for the self-hosted Alsina face', () => {
    // ChatOverlay emits its own @font-face for this one.
    const { container } = mount('alsina');
    expect(fontSheets(container)).toEqual([]);
    expect(container.innerHTML).toContain('font-family:Alsina');
  });

  it('adds no stylesheet for an unrecognized value', () => {
    // An omitted font= parses to 'opensans' via the schema default, so the
    // genuinely fontless case is an unknown value, which the parser passes
    // through verbatim rather than falling back.
    const { container } = mount('not-a-real-font');
    expect(fontSheets(container)).toEqual([]);
  });

  it('emits no preconnect when no stylesheet is needed', () => {
    const { container } = mount('impact');
    expect(container.querySelectorAll('link[rel="preconnect"]')).toHaveLength(0);
  });
});
