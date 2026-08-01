/* The Viewer Counter preview never goes blank — and never lies about whose
 * numbers are on screen.
 *
 * Two independent blank windows used to stack once a channel became valid: the
 * live frame's 350 ms debounce, and then the embedded /counter document, which
 * renders nothing until its first viewer poll commits. The generator swapped the
 * sample preview out at the start of the first and only had signals for the end
 * of it — so the surface was empty for the debounce plus a network round trip.
 *
 * Keeping the *samples* up across that window fixed the blankness and introduced
 * a worse problem: a Twitch-only counter sat under "Loading live viewer count…"
 * showing a TikTok pill and a four-digit count, none of which had anything to do
 * with the channel that had just been typed. So there are now two distinct
 * fallbacks, and which one is on screen is itself the assertion throughout this
 * file: samples before anything is configured, and a loading fallback built from
 * the configured platforms alone once something is.
 *
 * These tests pin the readiness signal down: what counts as one, what does not,
 * and what happens on either side of it. The negative cases are the point — a
 * readiness check that accepts a message from any origin, any window, or any
 * channel is how a preview starts showing one channel's number under another
 * channel's name.
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

/** The configured channel's loading fallback. Mutually exclusive with `samples`:
 *  the two are separate branches, so asserting on the right one is what
 *  distinguishes "not blank" from "not misleading". */
const loadingFallback = () =>
  document.querySelector('[data-testid="counter-loading-preview"]');

/** Whichever fallback is up, if either. What "never blank" actually means. */
const anyFallback = () => samples() ?? loadingFallback();

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
  it('keeps a fallback up in the same tick a valid channel is typed', () => {
    mount();
    typeChannel('twitch', 'shroud');
    expect(anyFallback()).not.toBeNull();
  });

  it('switches to the loading fallback in that same tick, not the samples', () => {
    mount();
    expect(samples()).not.toBeNull();
    typeChannel('twitch', 'shroud');
    expect(samples()).toBeNull();
    expect(loadingFallback()).not.toBeNull();
  });

  it('has not mounted the live frame yet at that point, so the fallback is all there is', () => {
    mount();
    typeChannel('twitch', 'shroud');
    expect(liveFrame()).toBeNull();
    expect(loadingFallback()).not.toBeNull();
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

  it('labels the loading window as loading, not as preview data', () => {
    configuredAndLoaded();
    const output = within(panel('.panel-counter-output'));
    expect(output.getByText('Loading live data')).toBeTruthy();
    /* The old wording. It described sample counts, and there are none here — the
       badge saying "Preview data" over a real channel's pills was half of what
       made the state misleading. */
    expect(output.queryByText('Preview data')).toBeNull();
  });

  it('still marks the numbers as preview data before any channel is entered', () => {
    mount();
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

  it('keeps the loading fallback up once the frame has merely mounted', () => {
    mount();
    typeChannel('twitch', 'shroud');
    settle();
    expect(liveFrame()).not.toBeNull();
    expect(loadingFallback()).not.toBeNull();
  });

  it('keeps the loading fallback up after the frame fires load', () => {
    configuredAndLoaded();
    expect(loadingFallback()).not.toBeNull();
  });

  it('keeps the live layer hidden after load alone', () => {
    const frame = configuredAndLoaded();
    expect(frame.closest('.preview-swap-live')?.getAttribute('data-live-ready')).toBe(
      'false',
    );
  });

  /* Every untrusted message, with the same expectation: the frame stays hidden
     and the loading fallback stays up. Rejection has to leave the preview in the
     loading state specifically — falling back to the *samples* on a bad message
     would put an unconfigured platform's invented count back on screen, which is
     exactly the outcome the origin and pollKey checks exist to prevent. */
  const untrusted: Array<[string, Parameters<typeof postToParent>[0]]> = [
    ['from another origin', { origin: 'https://evil.example' }],
    ['from a window that is not the live frame', { source: window }],
    ['with no source at all', { source: null }],
    ['that is an unrelated message from the frame', { data: { type: 'something-else', pollKey: '' } }],
    ['that is a bare string', { data: 'ready' }],
    ['carrying no pollKey', { data: { type: COUNTER_READY_MESSAGE } }],
    [
      'for a different channel',
      { data: { type: COUNTER_READY_MESSAGE, pollKey: 'twitch:someoneelse' } },
    ],
  ];

  for (const [label, overrides] of untrusted) {
    it(`ignores a ready message ${label}`, () => {
      const frame = configuredAndLoaded();
      postToParent(overrides);
      expect(loadingFallback()).not.toBeNull();
      expect(samples()).toBeNull();
      expect(frame.closest('.preview-swap-live')?.getAttribute('data-live-ready')).toBe(
        'false',
      );
    });
  }
});

describe('the readiness message itself', () => {
  it('reveals the live frame', () => {
    const frame = configuredAndLoaded();
    postToParent();
    expect(frame.closest('.preview-swap-live')?.getAttribute('data-live-ready')).toBe(
      'true',
    );
  });

  it('removes the loading fallback, leaving the real result alone on the surface', () => {
    configuredAndLoaded();
    postToParent();
    expect(loadingFallback()).toBeNull();
    expect(samples()).toBeNull();
  });

  it('clears the loading message', () => {
    configuredAndLoaded();
    postToParent();
    expect(loadingText()).toBe('');
  });

  it('drops both markers, because the numbers are now real', () => {
    configuredAndLoaded();
    postToParent();
    const output = within(panel('.panel-counter-output'));
    expect(output.queryByText('Preview data')).toBeNull();
    expect(output.queryByText('Loading live data')).toBeNull();
  });

  it('leaves the frame mounted at the same URL it was already loading', () => {
    configuredAndLoaded();
    const src = liveFrame()?.getAttribute('src');
    postToParent();
    expect(liveFrame()?.getAttribute('src')).toBe(src);
  });
});

describe('changing the configuration', () => {
  it('returns to the loading fallback when the channel changes, not to the samples', () => {
    configuredAndLoaded();
    postToParent();
    expect(loadingFallback()).toBeNull();

    typeChannel('twitch', 'lirik');
    expect(loadingFallback()).not.toBeNull();
    /* A channel is still configured, so samples would be as wrong here as they
       were for the first one. */
    expect(samples()).toBeNull();
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
    expect(loadingFallback()).not.toBeNull();
  });

  it('reveals the new channel once its own poll commits', () => {
    configuredAndLoaded();
    postToParent();
    typeChannel('twitch', 'lirik');
    settle();
    act(() => void fireEvent.load(liveFrame()!));
    postToParent();
    expect(anyFallback()).toBeNull();
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
    expect(loadingFallback()).toBeNull();
    expect(
      within(panel('.panel-counter-output')).getByText('Preview data'),
    ).toBeTruthy();
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
