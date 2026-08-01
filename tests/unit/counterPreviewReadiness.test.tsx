/* The Viewer Counter preview never goes blank.
 *
 * Two independent blank windows used to stack once a channel became valid: the
 * live frame's 350 ms debounce, and then the embedded /counter document, which
 * renders nothing until its first viewer poll commits. The generator swapped the
 * sample preview out at the start of the first and only had signals for the end
 * of it — so the surface was empty for the debounce plus a network round trip.
 *
 * The fix keeps the samples on screen until the frame itself says its first poll
 * for the current channel has committed. These tests pin that signal down: what
 * counts as one, what does not, and what happens on either side of it. The
 * negative cases are the point — a readiness check that accepts a message from
 * any origin, any window, or any channel is how a preview starts showing one
 * channel's number under another channel's name.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import ClassicGenerator from '@/components/classic/ClassicGenerator';
import { PREVIEW_DEBOUNCE_MS } from '@/components/workspace/OverlayPreviewFrame';
import {
  COUNTER_LOADING_MESSAGE,
  COUNTER_READY_MESSAGE,
  counterUrlPollKey,
} from '@/lib/counterPreviewReadiness';

vi.mock('next/head', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mount = () => render(<ClassicGenerator />);

const panel = (selector: string) => {
  const el = document.querySelector(selector);
  expect(el, `${selector} is missing`).not.toBeNull();
  return el as HTMLElement;
};

const counterUrl = () =>
  within(panel('.panel-counter-output')).getByLabelText(
    'Generated viewer counter URL',
  ).textContent ?? '';

/** The live overlay frame. Distinguished from the fixture frame by title: only
 *  this one has a src, and only this one is the readiness message's source. */
const liveFrame = () =>
  document.querySelector<HTMLIFrameElement>(
    'iframe[title="Live viewer counter preview"]',
  );

/** The sample preview, rendered through the production counter renderer. */
const samples = () => document.querySelector('[data-testid="counter-fixture-preview"]');

const loadingText = () =>
  document.querySelector('.panel-counter-output .preview-loading')?.textContent ?? '';

const settle = (ms = PREVIEW_DEBOUNCE_MS + 10) =>
  act(() => void vi.advanceTimersByTime(ms));

const typeChannel = (platform: string, value: string) =>
  fireEvent.change(document.getElementById(`channel-${platform}`)!, {
    target: { value },
  });

/** Deliver a message to the generator's listener the way the browser would, with
 *  every field it validates settable per test. Defaults are the trusted case:
 *  this origin, the live frame's own window, and the current channel's key. */
function postToParent(
  overrides: {
    data?: unknown;
    origin?: string;
    source?: MessageEventSource | null;
  } = {},
) {
  const frame = liveFrame();
  const data =
    'data' in overrides
      ? overrides.data
      : { type: COUNTER_READY_MESSAGE, pollKey: counterUrlPollKey(counterUrl()) };

  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data,
        origin: overrides.origin ?? window.location.origin,
        source:
          'source' in overrides ? overrides.source : frame?.contentWindow ?? null,
      }),
    );
  });
}

/** A valid channel typed, the debounce elapsed, the frame mounted and loaded —
 *  everything short of a committed poll. This is the state that used to be blank. */
function configuredAndLoaded() {
  mount();
  typeChannel('twitch', 'shroud');
  settle();
  const frame = liveFrame();
  expect(frame, 'live frame should be mounted after the debounce').not.toBeNull();
  act(() => void fireEvent.load(frame!));
  return frame!;
}

beforeEach(() => {
  vi.useFakeTimers();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('the surface is never blank', () => {
  it('keeps the sample preview up in the same tick a valid channel is typed', () => {
    mount();
    typeChannel('twitch', 'shroud');
    expect(samples()).not.toBeNull();
  });

  it('has not mounted the live frame yet at that point, so samples are all there is', () => {
    mount();
    typeChannel('twitch', 'shroud');
    expect(liveFrame()).toBeNull();
    expect(samples()).not.toBeNull();
  });

  it('announces that the live count is loading', () => {
    mount();
    typeChannel('twitch', 'shroud');
    expect(loadingText()).toBe(COUNTER_LOADING_MESSAGE);
  });

  it('carries the loading message in a live region', () => {
    mount();
    typeChannel('twitch', 'shroud');
    const region = document.querySelector('.panel-counter-output .preview-loading');
    expect(region?.getAttribute('role')).toBe('status');
  });

  it('says nothing about loading before a channel is entered', () => {
    mount();
    expect(loadingText()).toBe('');
  });

  it('still marks the numbers as preview data while the live count loads', () => {
    configuredAndLoaded();
    expect(
      within(panel('.panel-counter-output')).getByText('Preview data'),
    ).toBeTruthy();
  });
});

describe('what does not count as readiness', () => {
  it('holds the frame back for the full debounce', () => {
    mount();
    typeChannel('twitch', 'shroud');
    settle(PREVIEW_DEBOUNCE_MS - 1);
    expect(liveFrame()).toBeNull();
    settle(2);
    expect(liveFrame()).not.toBeNull();
  });

  it('keeps the samples up once the frame has merely mounted', () => {
    mount();
    typeChannel('twitch', 'shroud');
    settle();
    expect(liveFrame()).not.toBeNull();
    expect(samples()).not.toBeNull();
  });

  it('keeps the samples up after the frame fires load', () => {
    configuredAndLoaded();
    expect(samples()).not.toBeNull();
  });

  it('keeps the live layer hidden after load alone', () => {
    const frame = configuredAndLoaded();
    expect(frame.closest('.preview-swap-live')?.getAttribute('data-live-ready')).toBe(
      'false',
    );
  });

  it('ignores a ready message from another origin', () => {
    configuredAndLoaded();
    postToParent({ origin: 'https://evil.example' });
    expect(samples()).not.toBeNull();
  });

  it('ignores a ready message from a window that is not the live frame', () => {
    configuredAndLoaded();
    postToParent({ source: window });
    expect(samples()).not.toBeNull();
  });

  it('ignores a ready message with no source at all', () => {
    configuredAndLoaded();
    postToParent({ source: null });
    expect(samples()).not.toBeNull();
  });

  it('ignores unrelated messages from the frame', () => {
    configuredAndLoaded();
    postToParent({ data: { type: 'something-else', pollKey: '' } });
    expect(samples()).not.toBeNull();
  });

  it('ignores a bare string message', () => {
    configuredAndLoaded();
    postToParent({ data: 'ready' });
    expect(samples()).not.toBeNull();
  });

  it('ignores a ready message carrying no pollKey', () => {
    configuredAndLoaded();
    postToParent({ data: { type: COUNTER_READY_MESSAGE } });
    expect(samples()).not.toBeNull();
  });

  it('ignores a ready message for a different channel', () => {
    configuredAndLoaded();
    postToParent({ data: { type: COUNTER_READY_MESSAGE, pollKey: 'twitch:someoneelse' } });
    expect(samples()).not.toBeNull();
  });
});

describe('the readiness message itself', () => {
  it('reveals the live frame', () => {
    const frame = configuredAndLoaded();
    postToParent();
    expect(frame.closest('.preview-swap-live')?.getAttribute('data-live-ready')).toBe(
      'true',
    );
  });

  it('removes the sample preview', () => {
    configuredAndLoaded();
    postToParent();
    expect(samples()).toBeNull();
  });

  it('clears the loading message', () => {
    configuredAndLoaded();
    postToParent();
    expect(loadingText()).toBe('');
  });

  it('drops the preview-data marker, because the numbers are now real', () => {
    configuredAndLoaded();
    postToParent();
    expect(
      within(panel('.panel-counter-output')).queryByText('Preview data'),
    ).toBeNull();
  });

  it('leaves the frame mounted at the same URL it was already loading', () => {
    configuredAndLoaded();
    const src = liveFrame()?.getAttribute('src');
    postToParent();
    expect(liveFrame()?.getAttribute('src')).toBe(src);
  });
});

describe('changing the configuration', () => {
  it('restores the samples when the channel changes', () => {
    configuredAndLoaded();
    postToParent();
    expect(samples()).toBeNull();

    typeChannel('twitch', 'lirik');
    expect(samples()).not.toBeNull();
  });

  it('announces loading again for the new channel', () => {
    configuredAndLoaded();
    postToParent();
    typeChannel('twitch', 'lirik');
    expect(loadingText()).toBe(COUNTER_LOADING_MESSAGE);
  });

  it('does not accept the old channel’s key again after the change', () => {
    configuredAndLoaded();
    const stale = counterUrlPollKey(counterUrl());
    postToParent();

    typeChannel('twitch', 'lirik');
    settle();
    act(() => void fireEvent.load(liveFrame()!));
    postToParent({ data: { type: COUNTER_READY_MESSAGE, pollKey: stale } });
    expect(samples()).not.toBeNull();
  });

  it('reveals the new channel once its own poll commits', () => {
    configuredAndLoaded();
    postToParent();
    typeChannel('twitch', 'lirik');
    settle();
    act(() => void fireEvent.load(liveFrame()!));
    postToParent();
    expect(samples()).toBeNull();
  });

  it('hides the live layer again while the new channel loads', () => {
    configuredAndLoaded();
    postToParent();
    typeChannel('twitch', 'lirik');
    settle();
    expect(
      liveFrame()?.closest('.preview-swap-live')?.getAttribute('data-live-ready'),
    ).toBe('false');
  });
});

describe('clearing the channel', () => {
  it('removes the live frame in the same tick', () => {
    configuredAndLoaded();
    postToParent();
    typeChannel('twitch', '');
    expect(liveFrame()).toBeNull();
  });

  it('returns to ordinary sample mode', () => {
    configuredAndLoaded();
    postToParent();
    typeChannel('twitch', '');
    expect(samples()).not.toBeNull();
  });

  it('stops announcing a load that is no longer happening', () => {
    configuredAndLoaded();
    typeChannel('twitch', '');
    expect(loadingText()).toBe('');
  });

  it('keeps the live frame gone after the debounce would have elapsed', () => {
    configuredAndLoaded();
    postToParent();
    typeChannel('twitch', '');
    settle();
    expect(liveFrame()).toBeNull();
    expect(samples()).not.toBeNull();
  });
});
