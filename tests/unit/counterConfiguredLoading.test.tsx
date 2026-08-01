/* What the Viewer Counter preview shows between a channel being typed and its
 * first real poll landing.
 *
 * The readiness suite next door asserts *which* fallback is mounted. This one
 * asserts what is inside it, because that is where the reported bug actually
 * lived: the fallback was mounted, non-blank, and accompanied by the words
 * "Loading live viewer count…", and it was showing a TikTok icon beside 842
 * viewers for a Twitch channel called silky. Nothing was broken in a way a
 * mounted-or-not check could see.
 *
 * So the assertions here are about honesty rather than presence:
 *   - only configured platforms may appear;
 *   - no digits may appear anywhere in the fallback;
 *   - the neutral mark stands in for the value that has not arrived;
 *   - and the sample rotation cannot change any of it.
 *
 * The counts asserted absent are the fixture ones. They are what leaked, so they
 * are what is checked for by value.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import ClassicGenerator from '@/components/classic/ClassicGenerator';
import { PREVIEW_DEBOUNCE_MS } from '@/components/workspace/OverlayPreviewFrame';
import { COUNTER_LOADING_MESSAGE } from '@/lib/counterPreviewReadiness';
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

const loadingFallback = () =>
  document.querySelector<HTMLElement>('[data-testid="counter-loading-preview"]');

const samples = () =>
  document.querySelector<HTMLElement>('[data-testid="counter-fixture-preview"]');

/* The renderer is portalled into the frame's own document, so every content
   assertion has to start there. Querying the wrapper instead finds an empty
   subtree and passes for the wrong reason — a "no sample counts appear" check
   that reads the wrong document would pass even with the bug present. */
function frameBody(wrapper: HTMLElement): HTMLElement {
  const frame = wrapper.querySelector('iframe') as HTMLIFrameElement | null;
  expect(frame, 'the fallback should contain an isolation frame').not.toBeNull();
  const body = frame!.contentDocument?.body;
  expect(body, 'the frame should have a written document').toBeTruthy();
  return body!;
}

/* The renderer's own pill row, not the frame body.
   The body also holds the overlay's `<style>` — @font-face and @keyframes, whose
   text contains digits like 700 and 0.85. Asserting "no digits appear" against
   the body would fail on CSS while saying nothing about the counter, so the
   queries below start at the row: body > the inset wrapper > the flex row. */
const row = (wrapper: HTMLElement): HTMLElement => {
  const inset = frameBody(wrapper).querySelector('div');
  expect(inset, 'the inset wrapper should be present').not.toBeNull();
  const flex = inset!.querySelector('div');
  expect(flex, 'the renderer row should be present').not.toBeNull();
  return flex as HTMLElement;
};

/** The loading fallback's rendered text, from inside its frame. */
const loadingText = () => row(loadingFallback()!).textContent ?? '';

const settle = (ms = PREVIEW_DEBOUNCE_MS + 10) =>
  act(() => void vi.advanceTimersByTime(ms));

const typeChannel = (platform: string, value: string) =>
  fireEvent.change(document.getElementById(`channel-${platform}`)!, {
    target: { value },
  });

/** Turn off the combined total, leaving one pill per platform. */
const separateMode = () =>
  fireEvent.click(document.getElementById('vc-combined')!);

/** The counter rotation's own live region, scoped away from the chat feed's. */
const simStatus = () =>
  document.querySelector('.preview-counter-feed .preview-feed-status')?.textContent ??
  '';

/* Which platform an icon belongs to, by the marker the production renderer
   already emits for it. Two are <img> with a platform-specific src and two are
   inline <svg> identified by their brand fill — the icons carry empty alt text,
   being decorative beside their own count, so there is no label to read. These
   markers are asserted rather than chosen: they are the production visuals, and
   this file must not change them. */
const ICON_MARKERS: ReadonlyArray<[string, string]> = [
  ['Twitch', 'img[src="/platform-twitch.png"]'],
  ['TikTok', 'img[src="/platform-tiktok.png"]'],
  ['Kick', 'svg[fill="#53FC19"]'],
  ['YouTube', 'path[fill="#FF0000"]'],
];

/** Every platform whose icon is currently drawn inside a fallback. */
function platformsIn(wrapper: HTMLElement): string[] {
  const scope = row(wrapper);
  return ICON_MARKERS.filter(([, selector]) => scope.querySelector(selector) !== null).map(
    ([name]) => name,
  );
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

describe('nothing configured', () => {
  it('shows the sample preview and no loading fallback', () => {
    mount();
    expect(samples()).not.toBeNull();
    expect(loadingFallback()).toBeNull();
  });

  it('keeps the sample counts on screen', () => {
    mount();
    /* Combined is the default mode, so the four fixtures arrive as one summed
       pill rather than four. Asserting the sum keeps this about "real numbers are
       present", which is what the samples exist to demonstrate. */
    const total = Object.values(SAMPLE_COUNTER_COUNTS).reduce((a, b) => a + b, 0);
    expect(row(samples()!).textContent ?? '').toContain(total.toLocaleString('en-US'));
  });

  it('keeps the sample count editor available', () => {
    mount();
    expect(document.getElementById('sample-count-twitch')).not.toBeNull();
  });

  it('keeps the simulation controls available', () => {
    mount();
    expect(document.getElementById('counter-sim-enabled')).not.toBeNull();
  });

  it('mounts no live overlay frame, so nothing polls a provider', () => {
    mount();
    settle();
    expect(
      document.querySelector('iframe[title="Live viewer counter preview"]'),
    ).toBeNull();
  });
});

describe('a Twitch-only channel', () => {
  const configure = () => {
    mount();
    typeChannel('twitch', 'silky');
  };

  it('shows the loading fallback immediately, in the same tick', () => {
    configure();
    expect(loadingFallback()).not.toBeNull();
  });

  it('shows only the Twitch icon', () => {
    configure();
    expect(platformsIn(loadingFallback()!)).toEqual(['Twitch']);
  });

  it('shows no icon for any platform that is not configured', () => {
    configure();
    const visible = platformsIn(loadingFallback()!);
    for (const absent of ['TikTok', 'Kick', 'YouTube']) {
      expect(visible).not.toContain(absent);
    }
  });

  it('shows no sample viewer count', () => {
    configure();
    const text = loadingText();
    for (const count of Object.values(SAMPLE_COUNTER_COUNTS)) {
      expect(text).not.toContain(count.toLocaleString('en-US'));
      expect(text).not.toContain(String(count));
    }
  });

  it('shows no digits at all, so no number can read as a viewer count', () => {
    configure();
    expect(loadingText()).not.toMatch(/\d/);
  });

  it('shows the neutral unavailable mark in place of a value', () => {
    configure();
    expect(loadingText()).toContain('—');
  });

  it('announces the load accessibly', () => {
    configure();
    const region = document.querySelector('.panel-counter-output .preview-loading');
    expect(region?.getAttribute('role')).toBe('status');
    expect(region?.textContent).toBe(COUNTER_LOADING_MESSAGE);
  });

  it('describes the fallback as loading rather than as sample data', () => {
    configure();
    expect(loadingFallback()!.getAttribute('aria-label')).toBe(
      'Loading live viewer counts for the configured channels',
    );
  });
});

describe('several configured channels', () => {
  it('shows exactly the configured platforms, in combined mode', () => {
    mount();
    typeChannel('twitch', 'silky');
    typeChannel('youtube', 'somechannel');
    expect(platformsIn(loadingFallback()!)).toEqual(['Twitch', 'YouTube']);
  });

  it('draws one combined pill for them, with a single neutral value', () => {
    mount();
    typeChannel('twitch', 'silky');
    typeChannel('youtube', 'somechannel');
    const pills = Array.from(row(loadingFallback()!).children);
    expect(pills).toHaveLength(1);
    expect(pills[0].textContent).toBe('—');
  });

  it('shows one loading pill per platform in separate mode', () => {
    mount();
    typeChannel('twitch', 'silky');
    typeChannel('youtube', 'somechannel');
    separateMode();

    const pills = Array.from(row(loadingFallback()!).children);
    expect(pills).toHaveLength(2);
    for (const pill of pills) expect(pill.textContent).toBe('—');
    expect(platformsIn(loadingFallback()!)).toEqual(['Twitch', 'YouTube']);
  });

  it('invents no count in either mode', () => {
    mount();
    typeChannel('twitch', 'silky');
    typeChannel('kick', 'someone');
    expect(loadingText()).not.toMatch(/\d/);
    separateMode();
    expect(loadingText()).not.toMatch(/\d/);
  });

  it('drops a platform from the fallback as soon as its channel is cleared', () => {
    mount();
    typeChannel('twitch', 'silky');
    typeChannel('youtube', 'somechannel');
    typeChannel('youtube', '');
    expect(platformsIn(loadingFallback()!)).toEqual(['Twitch']);
  });
});

describe('the sample rotation during configured loading', () => {
  /* The mechanism of the original bug: the simulator kept drawing combinations
     and the fallback kept rendering whatever it drew. Advancing time by minutes
     covers many rotations at any speed the controls offer. */
  it('cannot change the configured loading fallback', () => {
    mount();
    typeChannel('twitch', 'silky');
    const before = platformsIn(loadingFallback()!);
    const textBefore = loadingText();

    act(() => void vi.advanceTimersByTime(120_000));

    expect(platformsIn(loadingFallback()!)).toEqual(before);
    expect(loadingText()).toBe(textBefore);
  });

  it('still shows no unconfigured platform after many rotations', () => {
    mount();
    typeChannel('twitch', 'silky');
    act(() => void vi.advanceTimersByTime(120_000));
    expect(platformsIn(loadingFallback()!)).toEqual(['Twitch']);
  });

  it('never introduces a digit, however long it runs', () => {
    mount();
    typeChannel('twitch', 'silky');
    act(() => void vi.advanceTimersByTime(300_000));
    expect(loadingText()).not.toMatch(/\d/);
  });

  it('offers the simulation controls only while no channel is configured', () => {
    mount();
    expect(simStatus()).toContain('Live counter simulation');
    typeChannel('twitch', 'silky');
    expect(simStatus()).toBe('');
    typeChannel('twitch', '');
    /* Back without the user touching a control: suspension gates the timer only
       and leaves their enabled/paused/speed choices alone. */
    expect(simStatus()).toContain('Live counter simulation');
  });

  /* The rotation's coverage count, from its own live region. Used instead of the
     rendered number because `RollingCount` eases between values with
     requestAnimationFrame, which fake timers do not drive — the pill would hold
     its old text no matter how many combinations had been drawn, so a count read
     from the DOM would report a stalled rotation as convincingly as a suspended
     one. The status line comes straight from the simulator's own state. */
  const shownCount = () => Number(/(\d+) of \d+ platform/.exec(simStatus())?.[1] ?? -1);

  it('draws nothing at all while a channel is configured', () => {
    mount();
    act(() => void vi.advanceTimersByTime(60_000));
    const before = shownCount();
    expect(before).toBeGreaterThan(0);

    typeChannel('twitch', 'silky');
    act(() => void vi.advanceTimersByTime(300_000));
    typeChannel('twitch', '');

    /* Five minutes of suspension advanced the rotation by nothing. */
    expect(shownCount()).toBe(before);
  });

  it('resumes rotating once the last channel is cleared', () => {
    mount();
    typeChannel('twitch', 'silky');
    act(() => void vi.advanceTimersByTime(60_000));
    typeChannel('twitch', '');
    const before = shownCount();

    act(() => void vi.advanceTimersByTime(60_000));
    expect(shownCount()).toBeGreaterThan(before);
  });
});
