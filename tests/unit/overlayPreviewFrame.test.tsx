/* OverlayPreviewFrame debounce and teardown, with fake timers.
 *
 * These are the properties that keep the preview from ever loading a
 * channel-less overlay URL, from reloading on every keystroke, and from
 * leaving a pending navigation behind after unmount.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import OverlayPreviewFrame, {
  PREVIEW_DEBOUNCE_MS,
} from '@/components/workspace/OverlayPreviewFrame';

const TITLE = 'Live viewer counter preview';

function renderFrame(url: string, configured: boolean) {
  return render(
    <OverlayPreviewFrame
      url={url}
      configured={configured}
      title={TITLE}
      height={80}
    />,
  );
}

const frame = () => document.querySelector('iframe');

/** Advance past the debounce inside act, so state updates are flushed. */
function settle(ms = PREVIEW_DEBOUNCE_MS) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('unconfigured', () => {
  it('renders no iframe at all', () => {
    renderFrame('http://localhost/counter?combined=true', false);
    expect(frame()).toBeNull();
  });

  it('still renders nothing after the debounce elapses', () => {
    renderFrame('http://localhost/counter?combined=true', false);
    settle(PREVIEW_DEBOUNCE_MS * 4);
    expect(frame()).toBeNull();
  });
});

describe('debounce', () => {
  it('waits the full debounce before mounting the first URL', () => {
    renderFrame('http://localhost/counter?twitch=a', true);
    expect(frame()).toBeNull();

    settle(PREVIEW_DEBOUNCE_MS - 1);
    expect(frame()).toBeNull();

    settle(1);
    expect(frame()?.getAttribute('src')).toBe('http://localhost/counter?twitch=a');
  });

  it('rapid changes cancel earlier pending URLs, so only the last one loads', () => {
    const { rerender } = renderFrame('http://localhost/counter?twitch=a', true);

    for (const name of ['ab', 'abc', 'abcd']) {
      settle(PREVIEW_DEBOUNCE_MS - 50);
      expect(frame()).toBeNull();
      rerender(
        <OverlayPreviewFrame
          url={`http://localhost/counter?twitch=${name}`}
          configured
          title={TITLE}
          height={80}
        />,
      );
    }

    settle();
    expect(frame()?.getAttribute('src')).toBe(
      'http://localhost/counter?twitch=abcd',
    );
  });

  it('navigates to the new URL when an appearance change settles', () => {
    const { rerender } = renderFrame('http://localhost/counter?twitch=a&bg=true', true);
    settle();
    expect(frame()?.getAttribute('src')).toContain('bg=true');

    rerender(
      <OverlayPreviewFrame
        url="http://localhost/counter?twitch=a&bg=false"
        configured
        title={TITLE}
        height={80}
      />,
    );
    settle();
    expect(frame()?.getAttribute('src')).toContain('bg=false');
  });
});

describe('clearing configuration', () => {
  it('removes the iframe immediately, without waiting for the debounce', () => {
    const { rerender } = renderFrame('http://localhost/counter?twitch=a', true);
    settle();
    expect(frame()).not.toBeNull();

    rerender(
      <OverlayPreviewFrame
        url="http://localhost/counter?combined=true"
        configured={false}
        title={TITLE}
        height={80}
      />,
    );
    expect(frame()).toBeNull();
  });

  it('no delayed timeout restores a cleared iframe', () => {
    const { rerender } = renderFrame('http://localhost/counter?twitch=a', true);
    settle();

    rerender(
      <OverlayPreviewFrame
        url="http://localhost/counter?combined=true"
        configured={false}
        title={TITLE}
        height={80}
      />,
    );
    settle(PREVIEW_DEBOUNCE_MS * 5);
    expect(frame()).toBeNull();
  });

  it('never mounts a channel-less URL when configuration flips mid-debounce', () => {
    const { rerender } = renderFrame('http://localhost/counter?twitch=a', true);
    settle(PREVIEW_DEBOUNCE_MS - 10);

    rerender(
      <OverlayPreviewFrame
        url="http://localhost/counter?combined=true"
        configured={false}
        title={TITLE}
        height={80}
      />,
    );
    settle(PREVIEW_DEBOUNCE_MS * 3);
    expect(frame()).toBeNull();
  });
});

describe('teardown', () => {
  it('clears the pending timeout on unmount', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { unmount } = renderFrame('http://localhost/counter?twitch=a', true);
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });

  it('leaves no iframe behind after unmount', () => {
    const { unmount } = renderFrame('http://localhost/counter?twitch=a', true);
    settle();
    expect(frame()).not.toBeNull();
    unmount();
    expect(frame()).toBeNull();
  });

  it('does not mount after unmount even if the timer would have fired', () => {
    const { unmount } = renderFrame('http://localhost/counter?twitch=a', true);
    unmount();
    act(() => {
      vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS * 3);
    });
    expect(frame()).toBeNull();
  });
});

describe('iframe attributes', () => {
  it('carries the accessible title and disables scrolling', () => {
    renderFrame('http://localhost/counter?twitch=a', true);
    settle();
    const iframe = frame();
    expect(iframe?.getAttribute('title')).toBe(TITLE);
    expect(iframe?.getAttribute('scrolling')).toBe('no');
  });

  it('is transparent and borderless at the requested height', () => {
    renderFrame('http://localhost/counter?twitch=a', true);
    settle();
    const iframe = frame() as HTMLIFrameElement;
    const inline = iframe.getAttribute('style') ?? '';
    expect(inline).toContain('background: transparent');
    expect(inline).toContain('overflow: hidden');
    expect(iframe.style.height).toBe('80px');
    expect(iframe.style.display).toBe('block');
    /* `border: none` is asserted through the frameBorder-equivalent visual
       check in the browser, not here: jsdom's CSS parser silently drops the
       `border` shorthand when its value is the `none` keyword, so neither
       style.border nor the serialized attribute retains it under jsdom. */
  });
});

describe('no synthetic data', () => {
  it('uses no interval timers and no randomness', () => {
    const intervalSpy = vi.spyOn(globalThis, 'setInterval');
    const randomSpy = vi.spyOn(Math, 'random');
    const { rerender } = renderFrame('http://localhost/counter?twitch=a', true);
    settle();
    rerender(
      <OverlayPreviewFrame
        url="http://localhost/counter?twitch=ab"
        configured
        title={TITLE}
        height={80}
      />,
    );
    settle();
    expect(intervalSpy).not.toHaveBeenCalled();
    expect(randomSpy).not.toHaveBeenCalled();
  });
});
