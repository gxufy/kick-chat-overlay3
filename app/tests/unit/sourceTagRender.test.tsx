/* Source-tag rendering at the production DOM boundary. */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import ChatOverlay from '@/components/overlay/ChatOverlay';
import { PROVIDERS, sourceTag, type SourceTagMode } from '@/lib/render';
import { MULTICHAT_SOURCE_TAGS, MultichatQuerySchema } from '@/lib/multichatConfig';
import type { ParsedMessage } from '@/lib/kick';
import type { Platform } from '@/lib/types';

const PLATFORMS: readonly Platform[] = ['kick', 'twitch', 'youtube', 'tiktok'];
afterEach(cleanup);

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

function renderTag(platform: Platform, mode: SourceTagMode) {
  const { container } = render(<div>{sourceTag(platform, mode)}</div>);
  return {
    container,
    marker: container.querySelector('[data-source-tag]'),
    markers: container.querySelectorAll('[data-source-tag]'),
  };
}

function overlay(query: Record<string, string>, messages = [msg('twitch')]) {
  const config = MultichatQuerySchema.parse(query);
  const { container } = render(
    <ChatOverlay
      config={config}
      messages={messages}
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
}

describe('source marker primitive', () => {
  it('renders nothing for none and one marker for the other modes', () => {
    for (const platform of PLATFORMS) {
      expect(renderTag(platform, 'none').markers).toHaveLength(0);
      cleanup();
      for (const mode of ['icon', 'dot', 'label'] as const) {
        const { markers } = renderTag(platform, mode);
        expect(markers).toHaveLength(1);
        expect(markers[0].getAttribute('data-source-tag')).toBe(mode);
        expect(markers[0].getAttribute('data-platform')).toBe(platform);
        cleanup();
      }
    }
  });

  it('renders the provider name for label mode', () => {
    for (const platform of PLATFORMS) {
      const { marker } = renderTag(platform, 'label');
      expect(marker?.textContent).toBe(PROVIDERS[platform].label);
      cleanup();
    }
  });

  it('produces distinct DOM for all four modes', () => {
    for (const platform of PLATFORMS) {
      const html = MULTICHAT_SOURCE_TAGS.map((mode) => {
        const { container } = render(<div>{sourceTag(platform, mode)}</div>);
        const value = container.innerHTML;
        cleanup();
        return value;
      });
      expect(new Set(html).size).toBe(MULTICHAT_SOURCE_TAGS.length);
    }
  });
});

describe('ChatOverlay sourceTag behavior', () => {
  it('keeps single Twitch, Kick, and TikTok marker-free when sourceTag is omitted', () => {
    for (const platform of ['twitch', 'kick', 'tiktok'] as const) {
      const { markers } = overlay({ [platform]: 'someone' }, [msg(platform)]);
      expect(markers).toHaveLength(0);
      cleanup();
    }
  });

  it('uses the icon by default for YouTube-only and multi-platform overlays', () => {
    expect(overlay({ youtube: 'someone' }, [msg('youtube')]).mode).toBe('icon');
    cleanup();
    expect(
      overlay({ twitch: 'a', kick: 'b' }, [msg('twitch'), msg('kick')]).mode,
    ).toBe('icon');
  });

  it('honors every explicit sourceTag on a single platform', () => {
    for (const mode of ['icon', 'dot', 'label'] as const) {
      expect(overlay({ twitch: 'someone', sourceTag: mode }).mode).toBe(mode);
      cleanup();
    }
    expect(overlay({ twitch: 'someone', sourceTag: 'none' }).markers).toHaveLength(0);
  });

  it('gives mixed-platform messages their own label markers', () => {
    const { markers } = overlay(
      { kick: 'k', twitch: 't', youtube: 'y', tiktok: 'tt', sourceTag: 'label' },
      PLATFORMS.map((platform) => msg(platform)),
    );
    expect(Array.from(markers).map((marker) => marker.getAttribute('data-platform')))
      .toEqual(['kick', 'twitch', 'youtube', 'tiktok']);
    expect(Array.from(markers).map((marker) => marker.textContent))
      .toEqual(['Kick', 'Twitch', 'YouTube', 'TikTok']);
  });

  it('keeps user badges independent from source markers', () => {
    const { container, markers } = overlay(
      { twitch: 'someone', sourceTag: 'none' },
      [msg('twitch', { badges: true })],
    );
    expect(markers).toHaveLength(0);
    expect(container.querySelectorAll('[data-test-badge]')).toHaveLength(1);
  });
});

describe('retired pin banner', () => {
  it('parser forces legacy showPinEnabled=true back to false', () => {
    expect(
      MultichatQuerySchema.parse({ twitch: 'someone', showPinEnabled: 'true' })
        .showPinEnabled,
    ).toBe(false);
  });

  it('does not render a supplied pinned message from a legacy pin URL', () => {
    const config = MultichatQuerySchema.parse({
      twitch: 'someone',
      showPinEnabled: 'true',
      pinPlatforms: 'twitch',
      sourceTag: 'label',
    });
    const { container } = render(
      <ChatOverlay
        config={config}
        messages={[]}
        fadingIds={new Set()}
        pinnedMessage={{ msg: msg('twitch', { id: 'pin-1' }) }}
        showLoader={false}
        sourceTagExplicit
      />,
    );
    expect(container.textContent).not.toContain('Pinned Message');
    expect(container.querySelectorAll('[data-source-tag]')).toHaveLength(0);
  });
});
