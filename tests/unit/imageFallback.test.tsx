/* The failed-image safety net.
 *
 * The real fix for a broken preview image is valid fixture data, which the
 * asset-catalog suite guards. This asserts the runtime net that catches the
 * images the renderer cannot vouch for — a live badge CDN, a channel's emote —
 * so a single 404 hides one image rather than dropping a broken glyph into a
 * chat line. The rules under test are exactly the ones the handler promises:
 * hide only the failure, leave no gap, never retry, log once per URL, and never
 * spill a data URI's body into the console.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { handleAssetError, resetAssetErrorLog } from '@/lib/render/imageFallback';
import * as previewAssets from '@/features/multichat/previewAssets';

/** Fire a native error event at an <img>, as a failed load would. */
function failLoad(img: HTMLImageElement) {
  img.dispatchEvent(new Event('error'));
}

describe('the failed-image handler', () => {
  afterEach(() => {
    resetAssetErrorLog();
    vi.restoreAllMocks();
  });

  /** An <img> wired with the production handler, mounted in the document. */
  const mountImg = (src: string) => {
    const { container } = render(<img src={src} alt="badge" onError={handleAssetError} />);
    return container.querySelector('img')!;
  };

  it('hides the failed image and leaves no layout box', () => {
    const img = mountImg('https://cdn.example/badge.png');
    failLoad(img);
    /* display:none removes the box entirely — no broken glyph, no gap. */
    expect(img.style.display).toBe('none');
    expect(img.getAttribute('data-asset-failed')).toBe('true');
  });

  it('never retries — the handler detaches after the first failure', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const img = mountImg('https://cdn.example/lost.png');
    failLoad(img);
    /* onerror is cleared, so a src that keeps failing cannot re-enter. */
    expect(img.onerror).toBeNull();
    failLoad(img);
    failLoad(img);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('logs each distinct URL at most once across the session', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    failLoad(mountImg('https://cdn.example/a.png'));
    failLoad(mountImg('https://cdn.example/a.png')); // same URL, second element
    failLoad(mountImg('https://cdn.example/b.png')); // different URL
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('logs a data URI by mime type only, never its body', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const body = 'PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnPjwvc3ZnPg==';
    failLoad(mountImg(`data:image/svg+xml;base64,${body}`));
    const logged = warn.mock.calls[0]?.join(' ') ?? '';
    expect(logged).toContain('data:image/svg+xml');
    expect(logged).not.toContain(body);
    expect(logged).toContain('<data omitted>');
  });

  it('resets its log so one test cannot silence the next', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    failLoad(mountImg('https://cdn.example/shared.png'));
    expect(warn).toHaveBeenCalledTimes(1);
    resetAssetErrorLog();
    failLoad(mountImg('https://cdn.example/shared.png'));
    /* Logged again only because the session log was cleared — proof the reset
       the suites rely on actually empties the state. */
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe('ARCHITECTURE: the preview asset catalog is local, data-only and browser-safe', () => {
  const ASSETS_SOURCE = readFileSync(
    join(process.cwd(), 'src', 'features', 'multichat', 'previewAssets.ts'),
    'utf8',
  );

  /** Every exported string value the catalog ships as art. */
  const exportedStrings = () =>
    Object.values(previewAssets).filter((value): value is string => typeof value === 'string');

  it('exports only local sources — data URIs or app-served paths, never a remote host', () => {
    const strings = exportedStrings();
    expect(strings.length).toBeGreaterThan(0);
    for (const value of strings) {
      expect(value, value).not.toMatch(/^https?:/i);
      expect(value, value).not.toMatch(/^\/\//);
      const local = value.startsWith('data:image/') || value.startsWith('/');
      expect(local, value).toBe(true);
    }
  });

  it('reaches no network and touches no server-only API', () => {
    /* Read from source, so this stays true however the module is bundled: a
       catalog of fixtures must not fetch, must not read the filesystem, and must
       not carry a secret. It is imported into a browser preview. */
    for (const forbidden of ['fetch(', 'require(', 'readFileSync', 'process.env', 'node:fs']) {
      expect(ASSETS_SOURCE, forbidden).not.toContain(forbidden);
    }
  });

  it('is the single source for the FFZ and TikTok fixture art the simulator uses', () => {
    /* Guards against a second copy drifting back in: the simulator now imports
       these, so the strings must be defined here, not duplicated there. */
    expect(typeof previewAssets.PREVIEW_FFZ_MOD_BADGE).toBe('string');
    expect(typeof previewAssets.PREVIEW_FFZ_VIP_BADGE).toBe('string');
    expect(previewAssets.PREVIEW_TIKTOK_MOD_BADGE).toBe('/badges/moderator.svg');
  });
});
