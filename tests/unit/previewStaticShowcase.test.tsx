/**
 * THE DEFAULT PREVIEW STANDS STILL, AT THE GENERATOR LEVEL.
 *
 * `previewSimulator.test.tsx` asserts the same property one layer down, against the
 * hook in isolation. This suite asserts it against the mounted generator, which is
 * the only place the wiring between them is observable: a hook that defaults to off
 * is worth nothing if the generator passes `enabled: true`, and that argument is
 * exactly the kind of thing a refactor reinstates without noticing.
 *
 * WHAT WENT WRONG BEFORE, since these tests exist because of it. An earlier revision
 * shipped a preview that autostarted its simulator and held only the first generated
 * message back, for nine seconds. Every automated check passed. In a browser the
 * curated showcase â€” the 7TV paint, the stacked Twitch badges, the provider emotes â€”
 * was gone by the tenth second, because ChatOverlay's list is `bottom: 0` with
 * `overflow: hidden` and every appended row evicts one from the top. The lesson is
 * that "the fixtures are correct" and "the fixtures are on screen" are different
 * claims, and only the second one is what a visitor gets.
 *
 * So the assertions here are about time and about counts, not about content: nothing
 * appears that nobody asked for, and what painted first is still painted later.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import ClassicGenerator from '@/components/classic/ClassicGenerator';
import {
  CHAT_INTERVAL_MAX_MS,
  PREVIEW_SOURCES,
} from '@/features/multichat/previewSimulator';
import { SAMPLE_MESSAGES } from '@/features/multichat/samples';

vi.mock('next/head', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

/* The overlay is portalled into the sample frame's own document, so every query
   starts there rather than at `screen`. */
const previewDoc = () =>
  document.querySelector<HTMLIFrameElement>('iframe[title="MultiChat sample preview"]')!
    .contentDocument!;
const preview = () => previewDoc().body;

/** Message bodies inside the list, which is the region the frame clips. */
const bodies = () =>
  Array.from(preview().querySelectorAll('#chat_container .ck-body')).map(
    (el) => el.textContent ?? '',
  );

/** The whole rendered list, for byte-comparing one moment against another. */
const listHtml = () => preview().querySelector('#chat_container')!.innerHTML;

const feedSwitch = () => document.getElementById('preview-feed-enabled') as HTMLInputElement;
const button = (name: string) => screen.getByRole('button', { name });

/** Advance fake time by `ms` inside act, so React flushes what it schedules. */
const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

/**
 * Step time forward until the list grows, and answer how long that took.
 *
 * A single `wait(CHAT_INTERVAL_MAX_MS)` is the wrong instrument here. The generator
 * owns unrelated timers, the delay is drawn per tick from an unseeded band, and each
 * delivery needs a React commit to become a row â€” so one bulk advance can straddle a
 * re-arm and land nothing. Stepping in slices and reporting elapsed fake time lets a
 * test assert what it actually cares about: a message arrived, and it did not take
 * anything like the nine-second hold this revision removed. The precise
 * first-delay-is-in-band claim is asserted deterministically against the hook, in
 * `previewSimulator.test.tsx`, where a seeded random makes it exact.
 */
const waitForGrowth = (from: number, capMs: number) => {
  let elapsed = 0;
  const slice = 250;
  while (elapsed < capMs && bodies().length <= from) {
    wait(slice);
    elapsed += slice;
  }
  return elapsed;
};

/**
 * Step timer to timer until the list grows, and answer the fake milliseconds spent.
 *
 * `advanceTimersToNextTimer` fires whatever is due next regardless of its delay, so a
 * simulator tick cannot be missed by a slice that straddles it. The fake clock is then
 * the measurement, which is what a cadence claim is actually about.
 */
const stepUntilGrowth = (from: number, maxSteps: number) => {
  const started = Date.now();
  for (let step = 0; step < maxSteps && bodies().length <= from; step += 1) {
    act(() => void vi.advanceTimersToNextTimer());
  }
  return Date.now() - started;
};

beforeEach(() => {
  vi.useFakeTimers();
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.sessionStorage.clear();
});

describe('the generator paints the curated showcase and leaves it alone', () => {
  it('renders the six curated rows on first paint', () => {
    render(<ClassicGenerator />);
    expect(bodies()).toHaveLength(SAMPLE_MESSAGES.length);
    expect(bodies()).toHaveLength(6);
  });

  it('offers the Live preview feed switch in the off position', () => {
    render(<ClassicGenerator />);
    expect(feedSwitch().checked).toBe(false);
  });

  it('says so in the status line, and still reports the source count', () => {
    /* Off is the default, so this sentence is what most visitors read. The source
       summary rides along with it because the picker is live while the feed is
       off â€” it decides what the next generated message will draw from. */
    render(<ClassicGenerator />);
    const status = document.querySelector('.preview-chat-feed .preview-feed-status')!;
    expect(status.textContent).toContain('Live preview feed off.');
    expect(status.textContent).toContain(
      `${PREVIEW_SOURCES.length} of ${PREVIEW_SOURCES.length}`,
    );
  });

  it('adds nothing after fifteen seconds', () => {
    /* The first of the three moments the manual browser check looks at. Also past
       the nine-second hold the previous revision relied on: at this point that
       implementation had already begun dismantling its own showcase. */
    render(<ClassicGenerator />);
    const painted = listHtml();
    wait(15_000);
    expect(bodies()).toHaveLength(6);
    expect(listHtml()).toBe(painted);
  });

  it('adds nothing after sixty seconds', () => {
    render(<ClassicGenerator />);
    const painted = listHtml();
    wait(60_000);
    expect(bodies()).toHaveLength(6);
    expect(listHtml()).toBe(painted);
  });

  it('adds nothing after ten minutes', () => {
    /* "Unlimited" is not testable; two orders of magnitude past the old hold is. */
    render(<ClassicGenerator />);
    const painted = listHtml();
    wait(600_000);
    expect(listHtml()).toBe(painted);
  });

  it('holds byte-identical markup across a long run of small steps', () => {
    /* Stepping rather than one long jump, because a timer chain re-arming itself
       would be invisible to a single advance that overshot the whole chain. */
    render(<ClassicGenerator />);
    const painted = listHtml();
    for (let i = 0; i < 60; i += 1) {
      wait(CHAT_INTERVAL_MAX_MS);
      expect(listHtml(), `step ${i}`).toBe(painted);
    }
  });

  it('draws no pin banner over the showcase', () => {
    /* The banner is opaque, top-anchored and about three of the six rows tall. */
    render(<ClassicGenerator />);
    wait(60_000);
    expect(preview().textContent ?? '').not.toContain('Pinned by');
    expect(preview().textContent ?? '').not.toContain('Pinned Message');
  });

  it('draws no event card in the default viewport', () => {
    render(<ClassicGenerator />);
    wait(60_000);
    const text = preview().textContent ?? '';
    expect(text).not.toContain('Super Chat');
    expect(text).not.toContain('ðŸ’°');
    expect(text).not.toContain('ðŸŽ');
  });

  it('keeps the rich showcase visible the whole time, not merely stable', () => {
    /* Stability alone could be satisfied by six empty rows. This is the content
       half: the badges, the paint and the emotes are all still there at sixty
       seconds, which is what the browser check is looking for. */
    render(<ClassicGenerator />);
    wait(60_000);
    const alts = Array.from(
      preview().querySelectorAll<HTMLImageElement>('img.ck-badge-img'),
    ).map((img) => img.getAttribute('alt') ?? '');
    for (const badge of ['broadcaster', 'moderator', 'vip', 'subscriber', '7tv badge']) {
      expect(alts, badge).toContain(badge);
    }
    const emotes = Array.from(
      preview().querySelectorAll<HTMLImageElement>('img.ck-emote'),
    ).map((img) => img.getAttribute('alt') ?? '');
    for (const token of ['OMEGALUL', 'RainTime', 'catJAM', 'PepeLaugh', 'Kappa']) {
      expect(emotes, token).toContain(token);
    }
  });
});

describe('the Live preview feed switch, from the generator', () => {
  it('starts generating once it is turned on', () => {
    render(<ClassicGenerator />);
    act(() => void fireEvent.click(feedSwitch()));
    expect(feedSwitch().checked).toBe(true);
    wait(CHAT_INTERVAL_MAX_MS);
    expect(bodies().length).toBeGreaterThan(6);
  });

  it('uses the ordinary cadence rather than a hold', () => {
    /* One drawn delay is enough to produce the first message. The nine-second hold
       this replaced would leave the count at six here. */
    render(<ClassicGenerator />);
    act(() => void fireEvent.click(feedSwitch()));
    wait(CHAT_INTERVAL_MAX_MS);
    expect(bodies().length).toBeGreaterThanOrEqual(7);
  });

  it('stops adding messages when it is turned off again', () => {
    render(<ClassicGenerator />);
    act(() => void fireEvent.click(feedSwitch()));
    wait(CHAT_INTERVAL_MAX_MS * 3);
    const delivered = bodies().length;
    expect(delivered).toBeGreaterThan(6);
    act(() => void fireEvent.click(feedSwitch()));
    expect(feedSwitch().checked).toBe(false);
    wait(300_000);
    expect(bodies()).toHaveLength(delivered);
  });

  it('does not silently turn itself back on', () => {
    render(<ClassicGenerator />);
    act(() => void fireEvent.click(feedSwitch()));
    act(() => void fireEvent.click(feedSwitch()));
    wait(600_000);
    expect(feedSwitch().checked).toBe(false);
    expect(bodies()).toHaveLength(6);
  });

  it('does not double its rate after being cycled off and on', () => {
    /* A duplicated timer chain is the failure mode of an enable path whose cleanup
       does not run, and it shows up as a feed going at twice the cadence. Measured
       as a rate over a fixed window rather than by counting timers: the generator
       owns a URL debounce as well, so a raw timer count is not the feed's alone.

       The bound is the arithmetic: a window of eight maximum-length intervals can
       hold at most eight messages from one chain, and it holds well over eight from
       two — the minimum delay is a third of the maximum, so a doubled chain would
       deliver in the twenties. Twelve leaves room for the draw landing short
       without leaving room for a second chain. */
    render(<ClassicGenerator />);
    act(() => void fireEvent.click(feedSwitch()));
    act(() => void fireEvent.click(feedSwitch()));
    act(() => void fireEvent.click(feedSwitch()));
    wait(CHAT_INTERVAL_MAX_MS * 8);
    const generated = bodies().length - 6;
    expect(generated).toBeGreaterThan(0);
    expect(generated).toBeLessThanOrEqual(12);
  });

  it('pauses and resumes without losing what is on screen', () => {
    render(<ClassicGenerator />);
    act(() => void fireEvent.click(feedSwitch()));
    wait(CHAT_INTERVAL_MAX_MS * 2);
    const delivered = bodies().length;
    act(() => void fireEvent.click(button('Pause')));
    wait(300_000);
    expect(bodies()).toHaveLength(delivered);
    act(() => void fireEvent.click(button('Resume')));
    wait(CHAT_INTERVAL_MAX_MS);
    expect(bodies().length).toBeGreaterThan(delivered);
  });
});

describe('Reset feed returns the curated showcase', () => {
  it('restores the six rows exactly, from a running feed', () => {
    render(<ClassicGenerator />);
    const painted = listHtml();
    act(() => void fireEvent.click(feedSwitch()));
    wait(CHAT_INTERVAL_MAX_MS * 4);
    expect(bodies().length).toBeGreaterThan(6);
    act(() => void fireEvent.click(button('Reset feed')));
    expect(bodies()).toHaveLength(6);
    expect(listHtml()).toBe(painted);
  });

  it('leaves the switch where it was, so a running feed keeps running', () => {
    /* Reset restores content. Someone who turned the feed on and then reset it
       asked to start the run over, not to end it. */
    render(<ClassicGenerator />);
    act(() => void fireEvent.click(feedSwitch()));
    wait(CHAT_INTERVAL_MAX_MS * 2);
    act(() => void fireEvent.click(button('Reset feed')));
    expect(feedSwitch().checked).toBe(true);
    expect(bodies()).toHaveLength(6);
    waitForGrowth(6, CHAT_INTERVAL_MAX_MS * 4);
    expect(bodies().length).toBeGreaterThan(6);
  });

  it('keeps delivering after a reset, without needing to be re-enabled', () => {
    /* This asserts that the reset re-arms at all. The exact "first delay after a reset
       is a draw from the ordinary band, not a hold" claim is asserted against the hook
       in `previewSimulator.test.tsx`, where a seeded random makes the delay an exact
       number; the generator supplies its own randomness and owns unrelated timers, so
       measuring a millisecond band through it would be a race rather than a check. */
    render(<ClassicGenerator />);
    act(() => void fireEvent.click(feedSwitch()));
    wait(CHAT_INTERVAL_MAX_MS * 2);
    act(() => void fireEvent.click(button('Reset feed')));
    expect(bodies()).toHaveLength(6);
    stepUntilGrowth(6, 40);
    expect(bodies().length).toBeGreaterThanOrEqual(7);
  });

  it('works while the feed is off, and schedules nothing', () => {
    render(<ClassicGenerator />);
    const painted = listHtml();
    act(() => void fireEvent.click(button('Reset feed')));
    expect(feedSwitch().checked).toBe(false);
    expect(listHtml()).toBe(painted);
    wait(300_000);
    expect(bodies()).toHaveLength(6);
    expect(listHtml()).toBe(painted);
  });

  it('drops composed messages along with generated ones', () => {
    render(<ClassicGenerator />);
    const painted = listHtml();
    fireEvent.change(document.getElementById('compose-text')!, {
      target: { value: 'composed and then reset' },
    });
    act(() => void fireEvent.click(button('Add preview message')));
    expect(bodies()).toHaveLength(7);
    act(() => void fireEvent.click(button('Reset preview')));
    expect(bodies()).toHaveLength(6);
    expect(listHtml()).toBe(painted);
  });
});
