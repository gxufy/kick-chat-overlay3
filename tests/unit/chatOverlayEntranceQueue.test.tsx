import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const rows = this.querySelectorAll('.ck-body').length;
    const height = rows * 40;
    return { x: 0, y: 0, width: 500, height, top: 0, right: 500, bottom: height, left: 0, toJSON: () => ({}) };
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('shared ChatIS batch entrance', () => {
  it.each(['twitch', 'kick', 'tiktok'] as const)('uses one aggregate SlideGroup for one %s flush', (platform) => {
    const messages = [parsed(platform, 'one'), parsed(platform, 'two'), parsed(platform, 'three')];
    const { container } = render(<ChatOverlay {...props('slide', platform)} messages={messages} />);
    const ghosts = container.querySelectorAll('[data-slide-ghost]');
    expect(ghosts).toHaveLength(1);
    expect((ghosts[0] as HTMLElement).style.height).toBe('120px');

    act(() => vi.advanceTimersByTime(149));
    expect(container.querySelectorAll('[data-slide-ghost]')).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1));
    expect(container.querySelectorAll('[data-slide-ghost]')).toHaveLength(0);
    expect(Array.from(container.querySelectorAll('.ck-body')).map(node => node.textContent)).toEqual(['one', 'two', 'three']);
  });

  it('repaints a same-ID row without adding another entrance batch', () => {
    const before = parsed('twitch', 'stable', 'before');
    const { container, rerender } = render(<ChatOverlay {...props('slide')} messages={[before]} />);
    act(() => vi.advanceTimersByTime(150));
    expect(container.querySelectorAll('[data-slide-ghost]')).toHaveLength(0);
    rerender(<ChatOverlay {...props('slide')} messages={[parsed('twitch', 'stable', 'after')]} />);
    expect(container.querySelectorAll('[data-slide-ghost]')).toHaveLength(0);
    expect(container.textContent).toContain('after');
  });

  it('removes a deleted member without replaying the surviving batch', () => {
    const one = parsed('twitch', 'one');
    const two = parsed('twitch', 'two');
    const { container, rerender } = render(<ChatOverlay {...props('slide')} messages={[one, two]} />);
    act(() => vi.advanceTimersByTime(150));
    rerender(<ChatOverlay {...props('slide')} messages={[one]} />);
    expect(container.querySelectorAll('[data-slide-ghost]')).toHaveLength(0);
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
