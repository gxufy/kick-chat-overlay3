import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ChatOverlay from '@/components/overlay/ChatOverlay';
import { MultichatQuerySchema } from '@/lib/multichatConfig';
import type { ParsedMessage } from '@/lib/kick';
import type { Platform } from '@/lib/types';

const parsed = (platform: Platform, id: string, body = id): ParsedMessage => ({
  id: `${platform}:${id}`,
  platform,
  kind: 'chat',
  identity: { username: id, color: '#fff', background: '', filter: '', badges: [] },
  message: [body],
});

const props = (animation: 'slide' | 'fade' | 'none', platform: Platform = 'twitch') => ({
  config: MultichatQuerySchema.parse({ [platform]: 'channel', animation }),
  fadingIds: new Set<string>(),
  pinnedMessage: null,
  showLoader: false as const,
  sourceTagExplicit: true,
});

afterEach(cleanup);

describe('shared batch entrance', () => {
  it.each(['twitch', 'kick', 'tiktok'] as const)('uses one CSS-only SlideGroup for one %s flush', (platform) => {
    const messages = [parsed(platform, 'one'), parsed(platform, 'two'), parsed(platform, 'three')];
    const { container } = render(<ChatOverlay {...props('slide', platform)} messages={messages} />);
    const groups = container.querySelectorAll('.gx-slide-group');
    expect(groups).toHaveLength(1);
    expect(groups[0].querySelectorAll('.ck-body')).toHaveLength(3);
    expect(container.querySelectorAll('[data-slide-ghost]')).toHaveLength(0);
    expect(container.innerHTML).not.toContain('-9999px');
  });

  it('repaints a same-ID row without adding another entrance batch', () => {
    const before = parsed('twitch', 'stable', 'before');
    const { container, rerender } = render(<ChatOverlay {...props('slide')} messages={[before]} />);
    expect(container.querySelectorAll('.gx-slide-group')).toHaveLength(1);
    rerender(<ChatOverlay {...props('slide')} messages={[parsed('twitch', 'stable', 'after')]} />);
    expect(container.querySelectorAll('.gx-slide-group')).toHaveLength(1);
    expect(container.textContent).toContain('after');
  });

  it('removes a deleted member without replaying or duplicating the surviving batch', () => {
    const one = parsed('twitch', 'one');
    const two = parsed('twitch', 'two');
    const { container, rerender } = render(<ChatOverlay {...props('slide')} messages={[one, two]} />);
    rerender(<ChatOverlay {...props('slide')} messages={[one]} />);
    expect(container.querySelectorAll('.gx-slide-group')).toHaveLength(1);
    expect(container.textContent).toContain('one');
    expect(container.textContent).not.toContain('two');
  });

  it.each(['fade', 'none'] as const)('%s preserves one immediate shared batch', (animation) => {
    const messages = [parsed('twitch', 'one'), parsed('twitch', 'two')];
    const { container } = render(<ChatOverlay {...props(animation)} messages={messages} />);
    expect(container.querySelectorAll('.ck-body')).toHaveLength(2);
    expect(container.querySelectorAll('[data-slide-ghost]')).toHaveLength(0);
  });
});
