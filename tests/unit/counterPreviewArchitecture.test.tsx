/* What the Viewer Counter preview is, and what it is not.
 *
 * It is a thin wrapper around the real /counter route: with a channel configured
 * the preview *is* the overlay, at the URL Copy hands out, in an iframe, after a
 * debounce. With no channel it is the production renderer over fixtures.
 *
 * Those are the only two states. There is deliberately no third one, and this
 * file exists because a third one was added and had to be removed. That revision
 * mounted the live frame but held it invisible until the embedded document posted
 * a readiness message to the generator, keeping a fallback on screen meanwhile —
 * so the real counter was loaded, polling, and hidden, and every appearance
 * change re-hid it. The assertions below are therefore mostly *negative*: no
 * second counter preview once a channel is configured, no dependency on any
 * message, and no fabricated status standing in for a count.
 *
 * The positive claims are the baseline ones: samples until a channel is valid,
 * nothing at all fetched before then, the live frame after the debounce, and its
 * src equal to the copied URL.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import ClassicGenerator from '@/components/classic/ClassicGenerator';
import { PREVIEW_DEBOUNCE_MS } from '@/components/workspace/OverlayPreviewFrame';
import { SAMPLE_COUNTER_COUNTS } from '@/features/counter/samples';

vi.mock('next/head', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mount = () => render(<ClassicGenerator />);

const samples = () =>
  document.querySelector<HTMLElement>('[data-testid="counter-fixture-preview"]');

/** The live counter frame, identified by the title the generator gives it. */
const liveFrame = () =>
  document.querySelector<HTMLIFrameElement>(
    'iframe[title="Live viewer counter preview"]',
  );

/** The generated counter URL as displayed, which is also what Copy writes. */
const counterUrl = () =>
  document
    .querySelector('.panel-counter-output')!
    .querySelector<HTMLElement>('[aria-label="Generated viewer counter URL"]')
    ?.textContent ?? '';

const settle = (ms = PREVIEW_DEBOUNCE_MS + 10) =>
  act(() => void vi.advanceTimersByTime(ms));

const typeChannel = (platform: string, value: string) =>
  fireEvent.change(document.getElementById(`channel-${platform}`)!, {
    target: { value },
  });

/** Every counter-preview root on screen, live or sampled. */
const counterPreviews = () => {
  const panel = document.querySelector('.panel-counter-output')!;
  return [
    ...panel.querySelectorAll('[data-testid="counter-fixture-preview"]'),
    ...panel.querySelectorAll('iframe[title="Live viewer counter preview"]'),
  ];
};

beforeEach(() => {
  vi.useFakeTimers();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('with no channel configured', () => {
  it('shows the sample preview', () => {
    mount();
    expect(samples()).not.toBeNull();
  });

  it('mounts no live frame, so nothing requests a viewer count', () => {
    mount();
    settle();
    /* Not merely "no frame yet": the debounce has run. A channel-less URL is
       never settled, so waiting longer cannot produce one. */
    expect(liveFrame()).toBeNull();
  });

  it('keeps the sample count editor and rotation controls available', () => {
    mount();
    expect(document.getElementById('sample-count-twitch')).not.toBeNull();
    expect(document.getElementById('counter-sim-enabled')).not.toBeNull();
  });

  it('marks the samples as preview data', () => {
    mount();
    const panel = document.querySelector('.panel-counter-output')!;
    expect(panel.textContent).toContain('Preview Data');
  });
});

describe('once a channel is configured', () => {
  it('stops showing sample data in the same tick', () => {
    mount();
    typeChannel('twitch', 'silky');
    /* Before the debounce, so this is the window the removed revision filled
       with a fallback. It is now empty on purpose: the samples are gone and the
       frame has not arrived. */
    expect(samples()).toBeNull();
  });

  it('mounts no frame until the debounce has elapsed', () => {
    mount();
    typeChannel('twitch', 'silky');
    act(() => void vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS - 20));
    expect(liveFrame()).toBeNull();
  });

  it('mounts the live frame after the debounce', () => {
    mount();
    typeChannel('twitch', 'silky');
    settle();
    expect(liveFrame()).not.toBeNull();
  });

  it('loads the frame at exactly the URL Copy and Open hand out', () => {
    mount();
    typeChannel('twitch', 'silky');
    settle();
    expect(liveFrame()!.getAttribute('src')).toBe(counterUrl());
  });

  it('is the only counter preview on screen', () => {
    mount();
    typeChannel('twitch', 'silky');
    settle();
    /* One preview, and it is the live one. The regression this replaces had two:
       the real overlay, hidden, plus a fallback in front of it. */
    expect(counterPreviews()).toHaveLength(1);
    expect(samples()).toBeNull();
  });
});

describe('the preview depends on no message from the overlay', () => {
  /* The frame's document is not loaded under jsdom, so nothing inside it can
     post anything — which is precisely the condition these assert under. If the
     preview needed a message it would never appear here at all. */
  it('is visible with no message ever received', () => {
    mount();
    typeChannel('twitch', 'silky');
    settle();
    const frame = liveFrame()!;
    expect(frame.style.visibility).not.toBe('hidden');
    expect(frame.closest('[data-live-ready]')).toBeNull();
  });

  it('stays visible across an appearance change', () => {
    mount();
    typeChannel('twitch', 'silky');
    settle();
    /* Restyling navigates the frame to a new URL. The removed gate reset on
       every URL change, so this is where a working counter went blank again. */
    fireEvent.click(document.getElementById('vc-combined')!);
    settle();
    expect(liveFrame()).not.toBeNull();
    expect(liveFrame()!.getAttribute('src')).toBe(counterUrl());
    expect(counterPreviews()).toHaveLength(1);
  });

  it('shows no loading placeholder over the live frame', () => {
    mount();
    typeChannel('twitch', 'silky');
    settle();
    const panel = document.querySelector('.panel-counter-output')!;
    expect(panel.textContent).not.toContain('Loading live');
    expect(panel.querySelector('.preview-loading')).toBeNull();
    expect(panel.querySelector('.preview-swap')).toBeNull();
  });

  it('invents no status to stand in for a count', () => {
    mount();
    typeChannel('twitch', 'silky');
    settle();
    /* Whatever the count is, it comes from the embedded document. No sample
       number and no em-dash stand-in is rendered by the generator itself. */
    const panel = document.querySelector('.panel-counter-output')!;
    for (const value of Object.values(SAMPLE_COUNTER_COUNTS)) {
      expect(panel.querySelector('iframe')!.textContent ?? '').not.toContain(
        String(value),
      );
    }
    expect(document.querySelector('[data-testid="counter-loading-preview"]')).toBeNull();
  });
});

describe('channel changes', () => {
  it('navigates the frame after the debounce, not on every keystroke', () => {
    mount();
    typeChannel('twitch', 'silky');
    settle();
    const first = liveFrame()!.getAttribute('src');

    typeChannel('kick', 'cuffem');
    /* Mid-typing: still the previous document. Navigating per keystroke would
       reload the overlay, and each reload starts its polling over. */
    expect(liveFrame()!.getAttribute('src')).toBe(first);

    settle();
    const next = liveFrame()!.getAttribute('src');
    expect(next).not.toBe(first);
    expect(next).toBe(counterUrl());
  });

  it('serves both platforms from one frame at one URL', () => {
    mount();
    typeChannel('twitch', 'silky');
    typeChannel('kick', 'cuffem');
    settle();
    expect(counterPreviews()).toHaveLength(1);
    const src = liveFrame()!.getAttribute('src')!;
    expect(src).toBe(counterUrl());
    expect(src).toContain('silky');
    expect(src).toContain('cuffem');
  });

  it('removes the frame immediately when the last channel is cleared', () => {
    mount();
    typeChannel('twitch', 'silky');
    settle();
    expect(liveFrame()).not.toBeNull();

    typeChannel('twitch', '');
    /* No debounce on the way out: `configured` is read during render, so the
       overlay stops polling as soon as it stops being configured rather than
       350 ms later. */
    expect(liveFrame()).toBeNull();
    expect(samples()).not.toBeNull();
  });
});
