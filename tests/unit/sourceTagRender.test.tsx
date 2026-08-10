/* Source-tag rendering, at the DOM level.
 *
 * The Batch 4 manual test found that /multichat?twitch=…&sourceTag=dot|label|none
 * all rendered identically. lib/render.tsx's sourceTag() was fine; ChatOverlay
 * discarded cfg.sourceTag whenever fewer than two platforms were configured and
 * forced 'none'. These tests assert the rendered markup, not config values, so a
 * regression to that gate fails here rather than in a screenshot.
 *
 * Markers are found by data-source-tag, which only sourceTag() emits. Badges are
 * never treated as markers — a dedicated test proves the two are independent.
 */
import { describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { afterEach } from 'vitest';
import ChatOverlay from '@/components/overlay/ChatOverlay';
import { PROVIDERS, sourceTag, type SourceTagMode } from '@/lib/render';
import { MULTICHAT_SOURCE_TAGS, MultichatQuerySchema } from '@/lib/multichatConfig';
import type { ParsedMessage } from '@/lib/kick';
import type { Platform } from '@/lib/types';

afterEach(cleanup);

const PLATFORMS: readonly Platform[] = ['kick', 'twitch', 'youtube', 'tiktok'];

/**
 * A plain chat message from one platform.
 *
 * Badges are marked with data-test-badge so a test can find them without
 * pretending a badge is a source marker — the real badge nodes come from the
 * connectors as opaque React nodes.
 */
function msg(
  platform: Platform,
  opts: { id?: string; badges?: boolean; kind?: 'chat' | 'system'; category?: string } = {},
): ParsedMessage {
  return {
    id: opts.id ?? `${platform}-1`,
    platform,
    kind: opts.kind ?? 'chat',
    ...(opts.category ? { category: opts.category } : {}),
    identity: {
      username: 'somebody',
      color: '#ffffff',
      background: '',
      filter: '',
      badges: opts.badges
        ? [<span key="b" data-test-badge="moderator">MOD</span>]
        : [],
    },
    message: ['hello'],
  };
}

/** Render one marker in isolation and hand back its root element. */
function renderTag(platform: Platform, mode: SourceTagMode) {
  const { container } = render(<div>{sourceTag(platform, mode)}</div>);
  return {
    container,
    marker: container.querySelector('[data-source-tag]'),
    markers: container.querySelectorAll('[data-source-tag]'),
  };
}

describe('source marker per mode', () => {
  it('renders nothing for none', () => {
    for (const platform of PLATFORMS) {
      const { marker, container } = renderTag(platform, 'none');
      expect(marker).toBeNull();
      expect(container.textContent).toBe('');
      cleanup();
    }
  });

  it('renders exactly one marker for icon, dot, and label', () => {
    for (const platform of PLATFORMS) {
      for (const mode of ['icon', 'dot', 'label'] as const) {
        const { markers } = renderTag(platform, mode);
        expect(markers).toHaveLength(1);
        expect(markers[0].getAttribute('data-source-tag')).toBe(mode);
        cleanup();
      }
    }
  });

  it('renders a visible platform icon for icon, with no dot or label', () => {
    const { marker, container } = renderTag('twitch', 'icon');
    expect(marker?.getAttribute('data-source-tag')).toBe('icon');
    /* An actual graphic, not an empty span. */
    expect(container.querySelector('img, svg')).not.toBeNull();
    expect(container.querySelector('[data-source-tag="dot"]')).toBeNull();
    expect(container.querySelector('[data-source-tag="label"]')).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('renders a visibly colored dot for dot, with no icon or label', () => {
    const { marker, container } = renderTag('twitch', 'dot');
    expect(marker?.getAttribute('data-source-tag')).toBe('dot');
    /* Present but invisible is the failure mode worth guarding: assert it has
       real dimensions and a background color, not just that it exists. */
    const style = (marker as HTMLElement).style;
    expect(style.width).toBe('0.5em');
    expect(style.height).toBe('0.5em');
    expect(style.backgroundColor).not.toBe('');
    expect(style.display).toBe('inline-block');
    expect(container.querySelector('img, svg')).toBeNull();
    expect(container.querySelector('[data-source-tag="label"]')).toBeNull();
  });

  it('renders visible platform text for label, with no icon or dot', () => {
    const { marker, container } = renderTag('twitch', 'label');
    expect(marker?.getAttribute('data-source-tag')).toBe('label');
    expect(marker?.textContent).toBe('Twitch');
    expect(container.querySelector('img, svg')).toBeNull();
    expect(container.querySelector('[data-source-tag="dot"]')).toBeNull();
  });

  it('gives every mode a distinct DOM, per platform', () => {
    for (const platform of PLATFORMS) {
      const html = MULTICHAT_SOURCE_TAGS.map((mode) => {
        const { container } = render(<div>{sourceTag(platform, mode)}</div>);
        const inner = container.innerHTML;
        cleanup();
        return inner;
      });
      /* Four modes, four different renderings — the exact thing the manual test
         found broken, where all four were identical. */
      expect(new Set(html).size).toBe(MULTICHAT_SOURCE_TAGS.length);
    }
  });
});

describe('marker is derived from the message platform', () => {
  it('labels each platform with its own name', () => {
    for (const platform of PLATFORMS) {
      const { marker } = renderTag(platform, 'label');
      expect(marker?.textContent).toBe(PROVIDERS[platform].label);
      expect(marker?.getAttribute('data-platform')).toBe(platform);
      cleanup();
    }
    /* Not all Twitch — the four labels are genuinely different. */
    expect(PLATFORMS.map((p) => PROVIDERS[p].label)).toEqual([
      'Kick',
      'Twitch',
      'YouTube',
      'TikTok',
    ]);
  });

  it('colors each platform dot with its own brand color', () => {
    const colors = PLATFORMS.map((platform) => {
      const { marker } = renderTag(platform, 'dot');
      const color = (marker as HTMLElement).style.backgroundColor;
      cleanup();
      return color;
    });
    expect(new Set(colors).size).toBe(PLATFORMS.length);
    for (const color of colors) expect(color).not.toBe('');
  });

  it('gives each platform a distinct icon', () => {
    const icons = PLATFORMS.map((platform) => {
      const { container } = render(<div>{sourceTag(platform, 'icon')}</div>);
      const html = container.innerHTML;
      cleanup();
      return html;
    });
    expect(new Set(icons).size).toBe(PLATFORMS.length);
  });

  it('tags every marker with the platform it came from', () => {
    for (const platform of PLATFORMS) {
      for (const mode of ['icon', 'dot', 'label'] as const) {
        const { marker } = renderTag(platform, mode);
        expect(marker?.getAttribute('data-platform')).toBe(platform);
        cleanup();
      }
    }
  });
});

/* The bug site. These render the real ChatOverlay with a parsed config, which is
   what the failing URLs exercised. */
describe('ChatOverlay honours sourceTag', () => {
  const overlay = (query: Record<string, string>, msgs = [msg('twitch')]) => {
    const config = MultichatQuerySchema.parse(query);
    const { container } = render(
      <ChatOverlay
        config={config}
        messages={msgs}
        fadingIds={new Set()}
        pinnedMessage={null}
        showLoader={false}
        sourceTagExplicit={query.sourceTag !== undefined}
      />,
    );
    return {
      container,
      markers: container.querySelectorAll('[data-source-tag]'),
      mode: container.querySelector('[data-source-tag]')?.getAttribute('data-source-tag'),
    };
  };

  it('keeps no marker when sourceTag is omitted on one non-YouTube platform', () => {
    for (const [platform, channel] of [['twitch', 'hatecaps'], ['kick', 'xqc'], ['tiktok', 'somebody']] as const) {
      const { markers } = overlay({ [platform]: channel }, [msg(platform)]);
      expect(markers).toHaveLength(0);
      cleanup();
    }
  });

  it('renders the shared icon when sourceTag is omitted on YouTube only', () => {
    const { markers, mode } = overlay({ youtube: 'IShowSpeed' }, [msg('youtube')]);
    expect(markers).toHaveLength(1);
    expect(mode).toBe('icon');
    expect(markers[0].getAttribute('data-platform')).toBe('youtube');
  });

  it('still honours explicit none on YouTube only', () => {
    const { markers } = overlay({ youtube: 'IShowSpeed', sourceTag: 'none' }, [msg('youtube')]);
    expect(markers).toHaveLength(0);
  });

  it('renders icons when sourceTag is omitted on multiple platforms', () => {
    const { mode } = overlay({ twitch: 'hatecaps', kick: 'xqc' });
    expect(mode).toBe('icon');
  });

  it('honours each explicit value on a single platform', () => {
    /* Exactly the four URLs from the manual test. */
    expect(overlay({ twitch: 'hatecaps', sourceTag: 'icon' }).mode).toBe('icon');
    expect(overlay({ twitch: 'hatecaps', sourceTag: 'dot' }).mode).toBe('dot');
    expect(overlay({ twitch: 'hatecaps', sourceTag: 'label' }).mode).toBe('label');
    expect(overlay({ twitch: 'hatecaps', sourceTag: 'none' }).markers).toHaveLength(0);
  });

  it('produces four visibly different DOMs for the four failing URLs', () => {
    const html = MULTICHAT_SOURCE_TAGS.map((tag) => {
      const { container } = overlay({ twitch: 'hatecaps', sourceTag: tag });
      const inner = container.innerHTML;
      cleanup();
      return inner;
    });
    expect(new Set(html).size).toBe(MULTICHAT_SOURCE_TAGS.length);
  });

  it('honours explicit values for every platform, one at a time', () => {
    for (const platform of PLATFORMS) {
      for (const mode of ['icon', 'dot', 'label'] as const) {
        const { mode: rendered, markers } = overlay(
          { [platform]: 'somebody', sourceTag: mode },
          [msg(platform)],
        );
        expect(rendered).toBe(mode);
        expect(markers[0].getAttribute('data-platform')).toBe(platform);
        cleanup();
      }
      const { markers } = overlay({ [platform]: 'somebody', sourceTag: 'none' }, [
        msg(platform),
      ]);
      expect(markers).toHaveLength(0);
      cleanup();
    }
  });

  it('gives each message its own marker when platforms are mixed', () => {
    const { markers } = overlay(
      {
        kick: 'k', twitch: 't', youtube: 'y', tiktok: 'tt',
        sourceTag: 'label',
      },
      PLATFORMS.map((platform) => msg(platform)),
    );
    expect(markers).toHaveLength(4);
    /* Each marker reports its own message's platform, in message order — not the
       first configured channel applied to everything. */
    expect(Array.from(markers).map((m) => m.getAttribute('data-platform'))).toEqual([
      'kick',
      'twitch',
      'youtube',
      'tiktok',
    ]);
    expect(Array.from(markers).map((m) => m.textContent)).toEqual([
      'Kick',
      'Twitch',
      'YouTube',
      'TikTok',
    ]);
  });

  it('mixes dots per platform too, with four distinct colors', () => {
    const { markers } = overlay(
      { kick: 'k', twitch: 't', youtube: 'y', tiktok: 'tt', sourceTag: 'dot' },
      PLATFORMS.map((platform) => msg(platform)),
    );
    expect(markers).toHaveLength(4);
    const colors = Array.from(markers).map((m) => (m as HTMLElement).style.backgroundColor);
    expect(new Set(colors).size).toBe(4);
  });

  it('renders exactly one marker per message, never duplicated', () => {
    for (const mode of ['icon', 'dot', 'label'] as const) {
      const { markers } = overlay({ twitch: 'hatecaps', sourceTag: mode }, [
        msg('twitch'),
        msg('twitch', { id: 'm2' }),
      ]);
      expect(markers).toHaveLength(2);
      cleanup();
    }
  });

  it('renders one marker on an event card, not two', () => {
    const { markers } = overlay({ twitch: 'hatecaps', sourceTag: 'label' }, [
      msg('twitch', { kind: 'system', category: 'subscription' }),
    ]);
    expect(markers).toHaveLength(1);
  });

  it('renders no marker on an event card under none', () => {
    const { markers } = overlay({ twitch: 'hatecaps', sourceTag: 'none' }, [
      msg('twitch', { kind: 'system', category: 'subscription' }),
    ]);
    expect(markers).toHaveLength(0);
  });

  /* The pin banner used to hardcode tagMode="icon", so sourceTag=none still left
     a marker there. It now follows the overlay's mode. */
  it('applies the mode to the pin banner too', () => {
    const pinned = { msg: msg('twitch', { id: 'pin-1' }) };
    const renderPinned = (sourceTag: string) => {
      const config = MultichatQuerySchema.parse({
        twitch: 'hatecaps', showPinEnabled: 'true', sourceTag,
      });
      const { container } = render(
        <ChatOverlay
          config={config}
          messages={[]}
          fadingIds={new Set()}
          pinnedMessage={pinned}
          showLoader={false}
          sourceTagExplicit
        />,
      );
      const markers = container.querySelectorAll('[data-source-tag]');
      return markers;
    };
    expect(renderPinned('label')[0]?.getAttribute('data-source-tag')).toBe('label');
    cleanup();
    expect(renderPinned('dot')[0]?.getAttribute('data-source-tag')).toBe('dot');
    cleanup();
    expect(renderPinned('none')).toHaveLength(0);
  });
});

describe('badge independence', () => {
  const withBadges = (query: Record<string, string>) => {
    const config = MultichatQuerySchema.parse(query);
    const { container } = render(
      <ChatOverlay
        config={config}
        messages={[msg('twitch', { badges: true })]}
        fadingIds={new Set()}
        pinnedMessage={null}
        showLoader={false}
        sourceTagExplicit={query.sourceTag !== undefined}
      />,
    );
    return {
      markers: container.querySelectorAll('[data-source-tag]'),
      badges: container.querySelectorAll('[data-test-badge]'),
    };
  };

  it('keeps user badges under sourceTag=none', () => {
    const { markers, badges } = withBadges({ twitch: 'hatecaps', sourceTag: 'none' });
    expect(markers).toHaveLength(0);
    expect(badges.length).toBeGreaterThan(0);
  });

  it('keeps the source label while badges are present', () => {
    const { markers, badges } = withBadges({ twitch: 'hatecaps', sourceTag: 'label' });
    expect(markers).toHaveLength(1);
    expect(badges.length).toBeGreaterThan(0);
  });

  it('shows dot and badges together', () => {
    const { markers, badges } = withBadges({ twitch: 'hatecaps', sourceTag: 'dot' });
    expect(markers[0].getAttribute('data-source-tag')).toBe('dot');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('never counts a badge as a source marker', () => {
    const { markers, badges } = withBadges({ twitch: 'hatecaps', sourceTag: 'none' });
    expect(badges.length).toBeGreaterThan(0);
    /* Badges carry no data-source-tag, so 'none' empties the markers while the
       badge row is untouched. */
    expect(markers).toHaveLength(0);
    for (const badge of Array.from(badges)) {
      expect(badge.getAttribute('data-source-tag')).toBeNull();
    }
  });
});

describe('accessibility', () => {
  it('hides the decorative icon and dot from assistive tech', () => {
    for (const mode of ['icon', 'dot'] as const) {
      const { marker } = renderTag('twitch', mode);
      expect(marker?.getAttribute('aria-hidden')).toBe('true');
      cleanup();
    }
  });

  it('leaves the label readable, without duplicating its visible text', () => {
    const { marker } = renderTag('twitch', 'label');
    expect(marker?.getAttribute('aria-hidden')).toBeNull();
    expect(marker?.textContent).toBe('Twitch');
    /* No aria-label repeating what is already on screen. */
    expect(marker?.getAttribute('aria-label')).toBeNull();
  });
});
