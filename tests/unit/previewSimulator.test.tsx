/* The continuous Chat preview feed.
 *
 * Two layers are asserted separately, because they fail for different reasons:
 *
 *   - the generator (`lib/tools/multichat/previewSimulator`) is a pure function of
 *     a sequence number, a source selection and a `RandomSource`. Its claims —
 *     the interval band, the id namespace, the history bound, which platforms are
 *     reachable — are facts about values, so they are asserted directly against a
 *     seeded source rather than scraped out of markup;
 *   - the hook (`components/classic/useChatPreviewSimulator`) owns the timer, and
 *     every claim about it is about *lifecycle*: one scheduler under Strict Mode,
 *     nothing left armed after unmount, a pause that really stops the chain.
 *
 * Every test here supplies its own seeded random source. That is the whole reason
 * the module takes one: a suite that let `Math.random` decide would assert "all
 * four platforms appear within N draws" as a probability rather than a fact, and
 * would eventually fail on someone else's machine for no reason they could act on.
 *
 * No test here counts timer *identities*, only that advancing the clock past the
 * band produces exactly one more message. Vitest's fake timers reuse ids, so an
 * id-counting test would pass against a genuinely doubled chain.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import {
  CHAT_HISTORY_MAX,
  CHAT_INTERVAL_MAX_MS,
  CHAT_INTERVAL_MIN_MS,
  PIN_EVERY_MAX,
  PIN_EVERY_MIN,
  PREVIEW_SOURCES,
  PREVIEW_SOURCE_HINT,
  PREVIEW_SOURCE_LABEL,
  PREVIEW_SPEEDS,
  allSourcesEnabled,
  appendBounded,
  availablePool,
  chatDelayBounds,
  generateMessage,
  nextChatDelay,
  nextPinGap,
  noSourcesEnabled,
  randomSources,
  seededRandom,
  type PreviewSourceState,
  type PreviewSpeed,
} from '@/lib/tools/multichat/previewSimulator';
import {
  useChatPreviewSimulator,
  type ChatSimulatorOptions,
  type ChatSimulatorState,
} from '@/components/classic/useChatPreviewSimulator';
import { SAMPLE_EPOCH, SAMPLE_MESSAGES } from '@/lib/tools/multichat/samples';
import type { Platform } from '@/lib/types';

/* ------------------------------------------------------------------ */
/* Harness                                                            */
/* ------------------------------------------------------------------ */

/** Mount the hook and expose its latest state without rendering a preview. */
function mountSimulator(options: ChatSimulatorOptions = {}) {
  const seen: ChatSimulatorState[] = [];
  function Probe() {
    seen.push(useChatPreviewSimulator(options));
    return null;
  }
  const view = render(<Probe />);
  return {
    ...view,
    /** The most recent hook return. Read fresh after every act(). */
    get state() {
      return seen[seen.length - 1]!;
    },
    /** Every render's state, for asserting how many effects ran. */
    renders: seen,
  };
}

/**
 * Deliver exactly `times` messages, one timer at a time.
 *
 * Deliberately not `advanceTimersByTime(max + 1)`: the tick re-arms itself with a
 * freshly drawn delay, and that replacement frequently lands inside the same
 * window — so one such call delivers two or three messages depending on the seed,
 * and every count in this suite would be a function of the random stream. Firing
 * the next timer and only the next timer makes "one interval, one message" the
 * thing being asserted rather than an accident of the draw.
 */
function advance(times = 1) {
  for (let i = 0; i < times; i += 1) {
    act(() => void vi.advanceTimersToNextTimer());
  }
}

/** Force `document.visibilityState` and fire the event the hook listens for. */
function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  act(() => void document.dispatchEvent(new Event('visibilitychange')));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  setVisibility('visible');
});

/* ------------------------------------------------------------------ */
/* The generator                                                      */
/* ------------------------------------------------------------------ */

describe('the seeded random source', () => {
  it('gives the same stream twice for one seed, and a different one per seed', () => {
    const draw = (seed: number) => {
      const random = seededRandom(seed);
      return Array.from({ length: 8 }, () => random());
    };
    expect(draw(1)).toEqual(draw(1));
    expect(draw(1)).not.toEqual(draw(2));
  });

  it('stays inside [0, 1)', () => {
    const random = seededRandom(99);
    for (let i = 0; i < 500; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('the message interval', () => {
  it('draws a fresh delay per message rather than one fixed period', () => {
    const random = seededRandom(4);
    const delays = Array.from({ length: 40 }, () => nextChatDelay(random, 'normal'));
    /* The claim is that the delay varies, not that any particular value appears:
       a single repeated number would mean one interval was chosen once and reused,
       which is the thing the spec rules out. */
    expect(new Set(delays).size).toBeGreaterThan(5);
  });

  it('stays inside the documented 1.2s–3.5s band at Normal speed', () => {
    const random = seededRandom(7);
    for (let i = 0; i < 400; i += 1) {
      const delay = nextChatDelay(random, 'normal');
      expect(delay).toBeGreaterThanOrEqual(CHAT_INTERVAL_MIN_MS);
      expect(delay).toBeLessThanOrEqual(CHAT_INTERVAL_MAX_MS);
    }
    expect(CHAT_INTERVAL_MIN_MS).toBe(1200);
    expect(CHAT_INTERVAL_MAX_MS).toBe(3500);
  });

  it('keeps every speed inside its own band, widest to narrowest', () => {
    for (const speed of PREVIEW_SPEEDS) {
      const bounds = chatDelayBounds(speed);
      const random = seededRandom(11);
      for (let i = 0; i < 200; i += 1) {
        const delay = nextChatDelay(random, speed);
        expect(delay).toBeGreaterThanOrEqual(bounds.min);
        expect(delay).toBeLessThanOrEqual(bounds.max);
      }
    }
    expect(chatDelayBounds('slow').min).toBeGreaterThan(chatDelayBounds('normal').min);
    expect(chatDelayBounds('fast').max).toBeLessThan(chatDelayBounds('normal').max);
  });

  it('never schedules soon enough to land inside a synchronous test', () => {
    /* Load-bearing beyond pacing. Three existing suites mount the whole generator
       on real timers and assert synchronously; a first delay of a few milliseconds
       would update those trees mid-assertion or after unmount. */
    const fastest = Math.min(...PREVIEW_SPEEDS.map((speed) => chatDelayBounds(speed).min));
    expect(fastest).toBeGreaterThanOrEqual(500);
  });
});

describe('a generated message', () => {
  const sources = allSourcesEnabled();

  it('is a normalized UnifiedMessage, not a pre-rendered line', () => {
    const message = generateMessage(1, sources, seededRandom(3));
    expect(typeof message.platform).toBe('string');
    expect(typeof message.username).toBe('string');
    expect(typeof message.text).toBe('string');
    expect(Array.isArray(message.badges)).toBe(true);
    expect(Array.isArray(message.emotes)).toBe(true);
    expect(typeof message.timestamp).toBe('number');
    /* No markup fields: the renderer is what draws this, and a message carrying
       its own HTML would mean a second renderer had appeared. */
    expect(message).not.toHaveProperty('html');
    expect(message).not.toHaveProperty('node');
  });

  it('takes its id from the sequence alone, so no two are keyed alike', () => {
    const random = seededRandom(5);
    const ids = Array.from({ length: 200 }, (_, i) => generateMessage(i + 1, sources, random).id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe('sim-1');
  });

  it('keeps its ids clear of the fixture and composer namespaces', () => {
    /* buildParsedMessage keys React on `${platform}:${id}`, so an overlap with a
       fixture id would make React reuse the wrong node for a different message. */
    const fixtureIds = new Set(SAMPLE_MESSAGES.map((entry) => entry.message.id));
    expect(fixtureIds.size).toBe(SAMPLE_MESSAGES.length);
    const random = seededRandom(6);
    for (let i = 1; i <= 100; i += 1) {
      const { id } = generateMessage(i, sources, random);
      expect(fixtureIds.has(id)).toBe(false);
      expect(id.startsWith('sim-')).toBe(true);
      expect(id.startsWith('custom-')).toBe(false);
    }
  });

  it('reads no clock — the timestamp is derived from the sequence', () => {
    const now = vi.spyOn(Date, 'now');
    const message = generateMessage(4, sources, seededRandom(8));
    expect(now).not.toHaveBeenCalled();
    expect(message.timestamp).toBe(SAMPLE_EPOCH + 60_000 + 4000);
  });

  it('calls no global random source of its own', () => {
    const random = vi.spyOn(Math, 'random');
    generateMessage(1, sources, seededRandom(9));
    expect(random).not.toHaveBeenCalled();
  });

  it('is identical for one seed and one sequence number', () => {
    const first = generateMessage(12, sources, seededRandom(21));
    const second = generateMessage(12, sources, seededRandom(21));
    expect(first).toEqual(second);
  });

  it('reaches all four platforms', () => {
    const random = seededRandom(13);
    const platforms = new Set<Platform>();
    for (let i = 1; i <= 300; i += 1) {
      platforms.add(generateMessage(i, sources, random).platform);
    }
    expect([...platforms].sort()).toEqual(['kick', 'tiktok', 'twitch', 'youtube']);
  });

  it('varies its shape — short lines, multiline runs, mentions and Unicode', () => {
    const random = seededRandom(17);
    const texts = Array.from({ length: 300 }, (_, i) => generateMessage(i + 1, sources, random).text);
    expect(texts.some((text) => text.length <= 12)).toBe(true);
    expect(texts.some((text) => text.length >= 80)).toBe(true);
    expect(texts.some((text) => text.includes('@'))).toBe(true);
    /* Astral-plane content specifically: a surrogate pair is where naive
       length-based truncation in the renderer would show up as a broken glyph. */
    expect(texts.some((text) => /[^\u0000-\u00FF]/u.test(text))).toBe(true);
    expect(texts.some((text) => [...text].some((ch) => ch.codePointAt(0)! > 0xffff))).toBe(true);
  });

  it('emits event cards occasionally, as system messages with a category', () => {
    const random = seededRandom(19);
    const events = [];
    for (let i = 1; i <= 300; i += 1) {
      const message = generateMessage(i, sources, random);
      if (message.kind === 'system') events.push(message);
    }
    expect(events.length).toBeGreaterThan(0);
    /* Rare rather than typical — a feed that is mostly event cards is not chat. */
    expect(events.length).toBeLessThan(150);
    for (const event of events) expect(typeof event.category).toBe('string');
  });

  it('produces both painted and unpainted senders', () => {
    const random = seededRandom(23);
    const senders = new Set<string>();
    for (let i = 1; i <= 300; i += 1) {
      senders.add(generateMessage(i, sources, random).senderId ?? '');
    }
    /* The entitled sender id is shared by every painted entry — that is what makes
       the paint attach — while everything else is per message. */
    expect(senders.has('sample-paint-sender')).toBe(true);
    expect(senders.size).toBeGreaterThan(2);
  });

  it('carries badge art the repository owns, never a remote host', () => {
    /* The claim is about *where the bytes come from*, not about one encoding. A
       data URI needs no request at all and a root-relative path is served from
       public/ by this app — both are repository-owned, which is what keeps the
       preview from depending on a third-party CDN being up. An absolute URL to
       someone else's host is the thing that must never appear, and the existing
       fixtures already hold that line the same way. */
    const random = seededRandom(29);
    let seenData = 0;
    let seenLocal = 0;
    for (let i = 1; i <= 300; i += 1) {
      for (const badge of generateMessage(i, sources, random).badges) {
        if (!badge.url) continue;
        expect(badge.url).not.toMatch(/^https?:/i);
        expect(badge.url).not.toMatch(/^\/\//);
        if (badge.url.startsWith('data:image/svg+xml')) seenData += 1;
        else {
          expect(badge.url.startsWith('/badges/')).toBe(true);
          seenLocal += 1;
        }
      }
    }
    /* Both kinds actually occur, so neither branch above is vacuous. */
    expect(seenData).toBeGreaterThan(0);
    expect(seenLocal).toBeGreaterThan(0);
  });
});

describe('the fixture source selection', () => {
  it('offers a label and a hint for every source, with no duplicates', () => {
    const labels = PREVIEW_SOURCES.map((source) => PREVIEW_SOURCE_LABEL[source]);
    expect(new Set(labels).size).toBe(PREVIEW_SOURCES.length);
    for (const source of PREVIEW_SOURCES) {
      expect(PREVIEW_SOURCE_LABEL[source].length).toBeGreaterThan(0);
      expect(PREVIEW_SOURCE_HINT[source].length).toBeGreaterThan(0);
    }
  });

  it('says which chat setting gates each source that one gates', () => {
    /* The picker chooses identities; the settings decide whether they render. A
       chip promising paints while paints are switched off looks broken unless it
       says so, so the hint has to name the gate. */
    expect(PREVIEW_SOURCE_HINT.sevenTVPaints).toMatch(/7TV cosmetics/i);
    expect(PREVIEW_SOURCE_HINT.sevenTVCosmetics).toMatch(/7TV cosmetics/i);
    expect(PREVIEW_SOURCE_HINT.bttvEmotes).toMatch(/7TV emotes/i);
  });

  it('turns everything on and everything off', () => {
    const all = allSourcesEnabled();
    const none = noSourcesEnabled();
    for (const source of PREVIEW_SOURCES) {
      expect(all[source]).toBe(true);
      expect(none[source]).toBe(false);
    }
  });

  it('randomizes to a varied subset that always keeps at least one source on', () => {
    const shapes = new Set<string>();
    for (let seed = 1; seed <= 60; seed += 1) {
      const state = randomSources(seededRandom(seed));
      expect(PREVIEW_SOURCES.some((source) => state[source])).toBe(true);
      shapes.add(PREVIEW_SOURCES.map((source) => (state[source] ? '1' : '0')).join(''));
    }
    expect(shapes.size).toBeGreaterThan(20);
  });

  it('narrows the pool as sources switch off, and never empties it', () => {
    const all = availablePool(allSourcesEnabled());
    const none = availablePool(noSourcesEnabled());
    expect(none.length).toBeGreaterThan(0);
    expect(none.length).toBeLessThan(all.length);
    for (const entry of none) expect(entry.needs ?? []).toHaveLength(0);
  });

  it('still generates messages with every source off', () => {
    const random = seededRandom(31);
    const off = noSourcesEnabled();
    for (let i = 1; i <= 40; i += 1) {
      const message = generateMessage(i, off, random);
      expect(message.text.length).toBeGreaterThan(0);
      expect(message.badges).toHaveLength(0);
    }
  });

  it('drops the entries a disabled source owns', () => {
    const withoutPaints: PreviewSourceState = { ...allSourcesEnabled(), sevenTVPaints: false };
    const painted = availablePool(withoutPaints).filter((entry) =>
      (entry.needs ?? []).includes('sevenTVPaints'),
    );
    expect(painted).toHaveLength(0);
    expect(
      availablePool(allSourcesEnabled()).some((entry) =>
        (entry.needs ?? []).includes('sevenTVPaints'),
      ),
    ).toBe(true);
  });
});

describe('the history bound', () => {
  it('keeps the newest CHAT_HISTORY_MAX messages and drops from the front', () => {
    expect(CHAT_HISTORY_MAX).toBeGreaterThanOrEqual(20);
    expect(CHAT_HISTORY_MAX).toBeLessThanOrEqual(30);
    const random = seededRandom(37);
    let history: readonly ReturnType<typeof generateMessage>[] = [];
    for (let i = 1; i <= CHAT_HISTORY_MAX + 25; i += 1) {
      history = appendBounded(history, generateMessage(i, allSourcesEnabled(), random));
    }
    expect(history).toHaveLength(CHAT_HISTORY_MAX);
    expect(history[history.length - 1]!.id).toBe(`sim-${CHAT_HISTORY_MAX + 25}`);
    expect(history[0]!.id).toBe(`sim-26`);
  });

  it('never mutates the array it was given', () => {
    const random = seededRandom(41);
    const original = [generateMessage(1, allSourcesEnabled(), random)];
    const frozen = [...original];
    appendBounded(original, generateMessage(2, allSourcesEnabled(), random), 1);
    expect(original).toEqual(frozen);
  });
});

describe('the pin cadence', () => {
  it('leaves several messages between pins rather than replacing it each time', () => {
    const random = seededRandom(43);
    for (let i = 0; i < 200; i += 1) {
      const gap = nextPinGap(random);
      expect(gap).toBeGreaterThanOrEqual(PIN_EVERY_MIN);
      expect(gap).toBeLessThanOrEqual(PIN_EVERY_MAX);
    }
    expect(PIN_EVERY_MIN).toBeGreaterThan(1);
  });
});

/* ------------------------------------------------------------------ */
/* The hook                                                           */
/* ------------------------------------------------------------------ */

describe('the feed hook', () => {
  it('starts armed, with the switch on and nothing generated yet', () => {
    const view = mountSimulator({ random: seededRandom(2) });
    expect(view.state.enabled).toBe(true);
    expect(view.state.paused).toBe(false);
    expect(view.state.running).toBe(true);
    expect(view.state.messages).toHaveLength(0);
  });

  it('appends a message per interval without being asked', () => {
    const view = mountSimulator({ random: seededRandom(2) });
    advance(3);
    expect(view.state.messages).toHaveLength(3);
    expect(view.state.messages.map((message) => message.id)).toEqual([
      'sim-1',
      'sim-2',
      'sim-3',
    ]);
  });

  it("appends nothing before the band's lower bound has passed", () => {
    const view = mountSimulator({ random: seededRandom(2) });
    act(() => void vi.advanceTimersByTime(CHAT_INTERVAL_MIN_MS - 1));
    expect(view.state.messages).toHaveLength(0);
  });

  it('bounds its own history at CHAT_HISTORY_MAX', () => {
    const view = mountSimulator({ random: seededRandom(2) });
    advance(CHAT_HISTORY_MAX + 8);
    expect(view.state.messages).toHaveLength(CHAT_HISTORY_MAX);
    expect(view.state.messages[view.state.messages.length - 1]!.id).toBe(
      `sim-${CHAT_HISTORY_MAX + 8}`,
    );
  });

  it('never repeats a key, even after the history has rolled over', () => {
    const view = mountSimulator({ random: seededRandom(2) });
    advance(CHAT_HISTORY_MAX + 20);
    const keys = view.state.messages.map((message) => `${message.platform}:${message.id}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('stops on pause and continues from where it left off on resume', () => {
    const view = mountSimulator({ random: seededRandom(2) });
    advance(2);
    act(() => void view.state.togglePaused());
    expect(view.state.paused).toBe(true);
    expect(view.state.running).toBe(false);
    advance(5);
    expect(view.state.messages).toHaveLength(2);

    act(() => void view.state.togglePaused());
    expect(view.state.running).toBe(true);
    advance(1);
    expect(view.state.messages).toHaveLength(3);
    expect(view.state.messages[2]!.id).toBe('sim-3');
  });

  it('disarms entirely when the switch goes off', () => {
    const view = mountSimulator({ random: seededRandom(2) });
    act(() => void view.state.setEnabled(false));
    expect(view.state.running).toBe(false);
    advance(6);
    expect(view.state.messages).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('paces itself by the selected speed', () => {
    const view = mountSimulator({ random: seededRandom(2) });
    act(() => void view.state.setSpeed('slow'));
    expect(view.state.speed).toBe('slow');
    /* Past Normal's ceiling but short of Slow's floor: a feed still running at the
       old cadence would have appended by now. */
    act(() => void vi.advanceTimersByTime(chatDelayBounds('slow').min - 1));
    expect(view.state.messages).toHaveLength(0);
    advance(1);
    expect(view.state.messages).toHaveLength(1);
  });

  it('runs faster on Fast than on Slow over the same elapsed time', () => {
    const window = 20_000;
    const count = (speed: PreviewSpeed) => {
      const view = mountSimulator({ random: seededRandom(2) });
      act(() => void view.state.setSpeed(speed));
      act(() => void vi.advanceTimersByTime(window));
      const total = view.state.messages.length;
      cleanup();
      return total;
    };
    expect(count('fast')).toBeGreaterThan(count('slow'));
  });

  it('pauses while the tab is hidden and re-arms when it comes back', () => {
    const view = mountSimulator({ random: seededRandom(2) });
    advance(1);
    setVisibility('hidden');
    expect(view.state.running).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    advance(5);
    expect(view.state.messages).toHaveLength(1);

    setVisibility('visible');
    expect(view.state.running).toBe(true);
    advance(1);
    expect(view.state.messages).toHaveLength(2);
  });

  it("reports the background pause without flipping the user's own switch", () => {
    const view = mountSimulator({ random: seededRandom(2) });
    setVisibility('hidden');
    /* `enabled` is the user's intent and `paused` is their button. Neither should
       change because the tab lost focus, or coming back would leave the control
       lying about its own state. */
    expect(view.state.enabled).toBe(true);
    expect(view.state.paused).toBe(false);
    expect(view.state.running).toBe(false);
  });

  it('drops the generated messages and re-arms on reset', () => {
    const view = mountSimulator({ random: seededRandom(2) });
    advance(4);
    expect(view.state.messages).toHaveLength(4);
    act(() => void view.state.reset());
    expect(view.state.messages).toHaveLength(0);
    /* The pin fixture is offered again, which is what "restores the built-in
       fixture set" means from the hook's side: the preview shows the fixtures
       whenever nothing generated is present. */
    expect(view.state.pinVisible).toBe(true);
    advance(1);
    expect(view.state.messages.map((message) => message.id)).toEqual(['sim-1']);
  });

  it('arms exactly one scheduler under Strict Mode', () => {
    /* Strict Mode mounts effects, tears them down and mounts them again. A timer
       created without a matching cleanup survives that and the feed then runs at
       double rate — the classic symptom of this bug. */
    function Probe() {
      useChatPreviewSimulator({ random: seededRandom(2) });
      return null;
    }
    render(
      <StrictMode>
        <Probe />
      </StrictMode>,
    );
    expect(vi.getTimerCount()).toBe(1);
  });

  it('appends one message per interval under Strict Mode, not two', () => {
    const seen: ChatSimulatorState[] = [];
    function Probe() {
      seen.push(useChatPreviewSimulator({ random: seededRandom(2) }));
      return null;
    }
    render(
      <StrictMode>
        <Probe />
      </StrictMode>,
    );
    advance(3);
    expect(seen[seen.length - 1]!.messages).toHaveLength(3);
  });

  it('leaves no timer behind on unmount', () => {
    const view = mountSimulator({ random: seededRandom(2) });
    advance(2);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('removes its visibility listener on unmount', () => {
    const remove = vi.spyOn(document, 'removeEventListener');
    const view = mountSimulator({ random: seededRandom(2) });
    view.unmount();
    expect(
      remove.mock.calls.some(([type]) => type === 'visibilitychange'),
    ).toBe(true);
  });

  it('appends nothing after unmount even with the clock running', () => {
    const view = mountSimulator({ random: seededRandom(2) });
    advance(1);
    const before = view.state.messages.length;
    view.unmount();
    act(() => void vi.advanceTimersByTime(120_000));
    expect(view.state.messages).toHaveLength(before);
  });

  it('does not restart the feed when a fixture source is toggled', () => {
    /* Sources are read through a ref precisely so this holds: a settings change
       that re-armed the timer would reset the wait, and holding a chip down would
       stop the feed entirely. */
    const view = mountSimulator({ random: seededRandom(2) });
    act(() => void vi.advanceTimersByTime(CHAT_INTERVAL_MIN_MS));
    act(() => void view.state.toggleSource('kickBadges'));
    expect(view.state.sources.kickBadges).toBe(false);
    /* Still inside the original wait, so the pending message must still land. */
    act(() => void vi.advanceTimersByTime(CHAT_INTERVAL_MAX_MS - CHAT_INTERVAL_MIN_MS + 1));
    expect(view.state.messages.length).toBeGreaterThan(0);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('applies a source change to the next message, not to the ones on screen', () => {
    const view = mountSimulator({ random: seededRandom(2) });
    advance(4);
    const before = view.state.messages.map((message) => message.id);
    act(() => void view.state.disableAllSources());
    expect(view.state.messages.map((message) => message.id)).toEqual(before);
    advance(4);
    for (const message of view.state.messages.slice(before.length)) {
      expect(message.badges).toHaveLength(0);
    }
  });

  it('exposes every badge action, each landing on the state', () => {
    const view = mountSimulator({ random: seededRandom(2) });
    act(() => void view.state.disableAllSources());
    expect(PREVIEW_SOURCES.every((source) => !view.state.sources[source])).toBe(true);

    act(() => void view.state.enableAllSources());
    expect(PREVIEW_SOURCES.every((source) => view.state.sources[source])).toBe(true);

    act(() => void view.state.toggleSource('twitchBadges'));
    expect(view.state.sources.twitchBadges).toBe(false);

    act(() => void view.state.randomizeSources());
    expect(PREVIEW_SOURCES.some((source) => view.state.sources[source])).toBe(true);

    act(() => void view.state.resetSources());
    expect(PREVIEW_SOURCES.every((source) => view.state.sources[source])).toBe(true);
  });

  it('keeps the pin still for several messages rather than replacing it', () => {
    const view = mountSimulator({ random: seededRandom(2) });
    const states: boolean[] = [view.state.pinVisible];
    for (let i = 0; i < 40; i += 1) {
      advance(1);
      states.push(view.state.pinVisible);
    }
    /* It has to change at least once — a pin that never moves is a fixture, not a
       simulation — and it must not change on every message. */
    const flips = states.filter((value, index) => index > 0 && value !== states[index - 1]).length;
    expect(flips).toBeGreaterThan(0);
    expect(flips).toBeLessThan(states.length / PIN_EVERY_MIN);
  });

  it('opens no socket, fetches nothing and polls no pin', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const socket = vi.fn();
    vi.stubGlobal('WebSocket', socket);
    vi.stubGlobal('EventSource', socket);
    const view = mountSimulator({ random: seededRandom(2) });
    advance(10);
    expect(view.state.messages).toHaveLength(10);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(socket).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('leaves the URL and session storage untouched', () => {
    /* Storage is read back rather than spied on. `vi.spyOn` against
       `window.sessionStorage` schedules a jsdom timer of its own, and this suite
       steps one timer at a time — so the spy would silently consume the step
       meant for the first message and every count below would be off by one.
       Comparing contents is also the stronger claim: it fails on a write made
       through any path, not only through the method that happened to be wrapped. */
    const href = window.location.href;
    window.sessionStorage.clear();
    const view = mountSimulator({ random: seededRandom(2) });
    advance(10);
    expect(view.state.messages).toHaveLength(10);
    expect(window.location.href).toBe(href);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('honours an explicit disabled start, for a caller that wants to arm by hand', () => {
    const view = mountSimulator({ random: seededRandom(2), enabled: false });
    expect(view.state.enabled).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    act(() => void view.state.setEnabled(true));
    advance(1);
    expect(view.state.messages).toHaveLength(1);
  });

  it('produces the same feed twice for one seed', () => {
    const run = () => {
      const view = mountSimulator({ random: seededRandom(77) });
      advance(12);
      const ids = view.state.messages.map((message) => `${message.platform}:${message.text}`);
      cleanup();
      return ids;
    };
    expect(run()).toEqual(run());
  });
});
