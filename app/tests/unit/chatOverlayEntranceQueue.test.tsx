import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ChatOverlay, { chatisSwing } from '@/components/overlay/ChatOverlay';
import { MultichatQuerySchema } from '@/lib/multichatConfig';
import { MESSAGE_FADE_TRANSITION_MS } from '@/lib/messageFadeScheduler';
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

const rect = (height: number): DOMRect => ({
  x: 0, y: 0, width: 600, height, top: 0, right: 600, bottom: height, left: 0,
  toJSON: () => ({}),
} as DOMRect);

function mockSlideMeasure(height: number) {
  return vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return (this as HTMLElement).classList.contains('gx-slide-measure') ? rect(height) : rect(0);
  });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('literal ChatIS batch entrance', () => {
  it('uses jQuery 1.8.2 swing easing', () => {
    expect(chatisSwing(0)).toBeCloseTo(0);
    expect(chatisSwing(0.5)).toBeCloseTo(0.5);
    expect(chatisSwing(1)).toBeCloseTo(1);
  });

  it.each(['twitch', 'kick', 'tiktok'] as const)('measures one hidden %s bucket, opens empty space, then commits rows atomically', (platform) => {
    vi.useFakeTimers();
    mockSlideMeasure(165);
    const messages = [parsed(platform, 'one'), parsed(platform, 'two'), parsed(platform, 'three')];
    const { container } = render(<ChatOverlay {...props('slide', platform)} messages={messages} />);

    const opening = container.querySelector('.gx-slide-group') as HTMLElement;
    expect(opening).not.toBeNull();
    expect(container.querySelectorAll('[data-slide-ghost]')).toHaveLength(1);
    expect(opening.style.height).toBe('0px');

    act(() => vi.advanceTimersByTime(78));
    const midHeight = parseFloat((container.querySelector('.gx-slide-group') as HTMLElement).style.height);
    expect(midHeight).toBeGreaterThan(0);
    expect(midHeight).toBeLessThan(165);
    expect(container.querySelectorAll('[data-slide-ghost]')).toHaveLength(1);

    act(() => vi.advanceTimersByTime(100));
    expect(container.querySelectorAll('[data-slide-ghost]')).toHaveLength(0);
    expect(container.querySelectorAll('.gx-slide-group')).toHaveLength(0);
    expect(container.querySelectorAll('.ck-body')).toHaveLength(3);
  });

  it('repaints a same-ID row without replaying the spacer entrance', () => {
    vi.useFakeTimers();
    mockSlideMeasure(55);
    const before = parsed('twitch', 'stable', 'before');
    const { container, rerender } = render(<ChatOverlay {...props('slide')} messages={[before]} />);
    act(() => vi.advanceTimersByTime(170));
    expect(container.querySelector('[data-slide-ghost]')).toBeNull();

    rerender(<ChatOverlay {...props('slide')} messages={[parsed('twitch', 'stable', 'after')]} />);
    expect(container.querySelector('[data-slide-ghost]')).toBeNull();
    expect(container.textContent).toContain('after');
  });

  it('removes a deleted member without replaying the surviving batch', () => {
    vi.useFakeTimers();
    mockSlideMeasure(110);
    const one = parsed('twitch', 'one');
    const two = parsed('twitch', 'two');
    const { container, rerender } = render(<ChatOverlay {...props('slide')} messages={[one, two]} />);
    act(() => vi.advanceTimersByTime(170));
    rerender(<ChatOverlay {...props('slide')} messages={[one]} />);
    expect(container.querySelector('[data-slide-ghost]')).toBeNull();
    expect(container.textContent).toContain('one');
    expect(container.textContent).not.toContain('two');
  });

  it.each(['fade', 'none'] as const)('%s preserves one immediate shared batch', (animation) => {
    const messages = [parsed('twitch', 'one'), parsed('twitch', 'two')];
    const { container } = render(<ChatOverlay {...props(animation)} messages={messages} />);
    expect(container.querySelectorAll('.ck-body')).toHaveLength(2);
    expect(container.querySelectorAll('[data-slide-ghost]')).toHaveLength(0);
  });

  it('fades and collapses an expiring row in one eased exit', () => {
    const message = parsed('twitch', 'old');
    const { container, rerender } = render(<ChatOverlay {...props('none')} messages={[message]} />);
    let row = container.querySelector('.gx-message-row') as HTMLElement;
    expect(row.style.gridTemplateRows).toBe('1fr');
    expect(row.style.opacity).toBe('1');

    rerender(
      <ChatOverlay
        {...props('none')}
        fadingIds={new Set([message.id])}
        messages={[message]}
      />,
    );

    row = container.querySelector('.gx-message-row') as HTMLElement;
    expect(row.style.gridTemplateRows).toBe('0fr');
    expect(row.style.opacity).toBe('0');
    expect(row.style.transform).toBe('translate3d(0, -6px, 0)');
    expect(row.style.transition).toContain(`grid-template-rows ${MESSAGE_FADE_TRANSITION_MS}ms`);
    expect(row.style.transition).toContain(`opacity ${MESSAGE_FADE_TRANSITION_MS}ms`);
    expect((row.firstElementChild as HTMLElement).style.overflow).toBe('hidden');
  });
});
