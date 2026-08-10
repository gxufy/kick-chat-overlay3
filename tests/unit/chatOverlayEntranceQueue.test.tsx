import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatOverlay from '@/components/overlay/ChatOverlay';
import { MultichatQuerySchema } from '@/lib/multichatConfig';
import type { ParsedMessage } from '@/lib/kick';

const parsed = (id: string): ParsedMessage => ({
  id: `youtube:${id}`,
  platform: 'youtube',
  kind: id.startsWith('paid') ? 'system' : 'chat',
  category: id.startsWith('paid') ? 'cheer' : undefined,
  identity: { username: id, color: '#fff', background: '', filter: '', badges: [] },
  message: [id],
});

const props = (animation: 'slide' | 'fade' | 'none') => ({
  config: MultichatQuerySchema.parse({ youtube: 'channel', animation }),
  fadingIds: new Set<string>(),
  pinnedMessage: null,
  showLoader: false as const,
  sourceTagExplicit: true,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, width: 500, height: 40, top: 0, right: 500, bottom: 40, left: 0,
    toJSON: () => ({}),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('ChatOverlay per-row entrance queue', () => {
  it('keeps ordinary arrivals on the normal 150ms launch cadence', () => {
    const { container, rerender } = render(<ChatOverlay {...props('slide')} messages={[parsed('one')]} />);
    expect(container.querySelectorAll('[data-slide-ghost]')).toHaveLength(1);

    rerender(<ChatOverlay {...props('slide')} messages={[parsed('one'), parsed('two'), parsed('paid-three')]} />);
    expect(container.querySelectorAll('[data-slide-ghost]')).toHaveLength(2);
    act(() => vi.advanceTimersByTime(149));
    expect(container.querySelectorAll('[data-slide-ghost]')).toHaveLength(2);
    act(() => vi.advanceTimersByTime(1));
    expect(container.querySelectorAll('[data-slide-ghost]')).toHaveLength(1);
    expect(container.textContent).toContain('paid-three');
  });

  it('drains a 20-row poll burst in order with bounded staggered catch-up', () => {
    const messages = Array.from({ length: 20 }, (_, index) => parsed(`row-${String(index).padStart(2, '0')}`));
    const { container } = render(<ChatOverlay {...props('slide')} messages={messages} />);

    expect(container.querySelectorAll('[data-slide-ghost]')).toHaveLength(1);
    expect(container.querySelectorAll('.ck-body')).toHaveLength(20);
    for (let elapsed = 0; elapsed < 1_200; elapsed += 25) {
      act(() => vi.advanceTimersByTime(25));
    }

    for (const message of messages) expect(container.textContent).toContain(message.identity.username);
    const rows = Array.from(container.querySelectorAll('.ck-body')).map((node) => node.textContent);
    expect(rows).toEqual(messages.map((message) => message.identity.username));
    expect(container.querySelectorAll('[data-slide-ghost]')).toHaveLength(0);
  });

  it('skips a row deleted while it is pending', () => {
    const one = parsed('one');
    const two = parsed('two');
    const three = parsed('three');
    const { container, rerender } = render(<ChatOverlay {...props('slide')} messages={[one, two, three]} />);
    rerender(<ChatOverlay {...props('slide')} messages={[one, three]} />);
    act(() => vi.advanceTimersByTime(400));
    expect(container.textContent).toContain('one');
    expect(container.textContent).toContain('three');
    expect(container.textContent).not.toContain('two');
  });

  it.each(['fade', 'none'] as const)('%s presents a synchronous burst immediately', (animation) => {
    const messages = [parsed('one'), parsed('two'), parsed('paid-three')];
    const { container } = render(<ChatOverlay {...props(animation)} messages={messages} />);
    expect(container.querySelectorAll('.ck-body')).toHaveLength(3);
    expect(container.querySelectorAll('[data-slide-ghost]')).toHaveLength(0);
  });
});
