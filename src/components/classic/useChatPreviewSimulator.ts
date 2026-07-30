/* The live chat preview feed, as a hook.
 *
 * WHY THIS LIVES ABOVE THE PREVIEW. `ClassicChatPreview` is a pure function of
 * its props, and that is asserted: tests/unit/multichatPreview.test.tsx mounts it
 * twice and compares markup, and the counter's equivalent asserts its preview
 * reads neither `Date.now` nor `Math.random`. Putting a clock or a random source
 * inside either component would break those suites for good reason — a preview
 * that generates its own data cannot be reasoned about from its props. So the
 * simulator sits here, in the generator, and hands finished messages down.
 *
 * WHAT RESTARTS THE FEED, AND WHAT MUST NOT. The scheduling effect depends on
 * exactly two things: whether the feed is running, and how fast. Everything else
 * it reads — the enabled fixture sources, the sequence counter, the pin
 * countdown — is held in a ref, so adjusting a badge chip or any of the
 * twenty-four chat settings leaves the running timer alone. A feed that
 * restarted on every keystroke would reset its own cadence and never reach the
 * slow end of its interval band.
 *
 * ONE SCHEDULER. React Strict Mode double-invokes effects in development. The
 * chain here is a single `setTimeout` re-armed from its own callback, and the
 * cleanup both clears the pending timer and sets a cancelled flag — so the first
 * invocation's chain is dead before the second one arms, and a callback already
 * in flight cannot re-arm after unmount.
 *
 * Browser-safe — no server-only imports, no network, no sockets, no polling.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CHAT_HISTORY_MAX,
  allSourcesEnabled,
  appendBounded,
  generateMessage,
  nextChatDelay,
  nextPinGap,
  noSourcesEnabled,
  randomSources,
  type PreviewSource,
  type PreviewSourceState,
  type PreviewSpeed,
  type RandomSource,
} from '@/features/multichat/previewSimulator';
import type { UnifiedMessage } from '@/lib/types';

/** What the generator hands the hook. All optional — the page passes nothing. */
export type ChatSimulatorOptions = {
  /** Randomness. Defaults to `Math.random`; tests pass a seeded source. */
  random?: RandomSource;
  /** Start running. False in a test that wants to arm the feed by hand. */
  enabled?: boolean;
};

export type ChatSimulatorState = {
  /** Generated messages, oldest first, bounded to CHAT_HISTORY_MAX. */
  readonly messages: readonly UnifiedMessage[];
  /** Whether the pin fixture should currently be offered to the preview. */
  readonly pinVisible: boolean;
  readonly enabled: boolean;
  readonly paused: boolean;
  readonly speed: PreviewSpeed;
  readonly sources: PreviewSourceState;
  /** True while a timer is armed — enabled, not paused, tab visible. */
  readonly running: boolean;
  setEnabled: (next: boolean) => void;
  togglePaused: () => void;
  setSpeed: (next: PreviewSpeed) => void;
  /** Drop every generated message and re-arm from the fixtures. */
  reset: () => void;
  toggleSource: (source: PreviewSource) => void;
  enableAllSources: () => void;
  disableAllSources: () => void;
  randomizeSources: () => void;
  resetSources: () => void;
};

/** Whether the document is currently hidden. Safe before hydration. */
function documentHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

export function useChatPreviewSimulator(
  options: ChatSimulatorOptions = {},
): ChatSimulatorState {
  const { enabled: initialEnabled = true } = options;
  /* `Math.random` is read here rather than defaulted in the signature so the
     identity stays stable across renders — a new function each render would be a
     new effect dependency if it were ever used as one. */
  const random = useMemo<RandomSource>(
    () => options.random ?? (() => Math.random()),
    [options.random],
  );

  const [messages, setMessages] = useState<readonly UnifiedMessage[]>([]);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<PreviewSpeed>('normal');
  const [sources, setSources] = useState<PreviewSourceState>(() => allSourcesEnabled());
  const [pinVisible, setPinVisible] = useState(true);
  const [hidden, setHidden] = useState(false);

  /* Everything the tick reads without wanting to restart the timer. */
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;
  const sequenceRef = useRef(0);
  /* The line just emitted, so the next draw can avoid repeating its identity.
     Held in a ref rather than read from `messages` so the tick stays off the
     state it sets — and so a source toggle, which does not restart the timer,
     never has to re-thread it. Cleared on reset alongside the sequence. */
  const previousRef = useRef<UnifiedMessage | null>(null);
  /* Null until the first tick draws it. Deliberately not seeded during render:
     Strict Mode renders twice, so a draw there would consume two values and the
     two renders would disagree about the gap. */
  const pinCountdownRef = useRef<number | null>(null);

  /* Pause while the tab is in the background. A feed nobody can see still costs
     a timer and a render per message, and coming back to thirty messages that
     all arrived while the tab was hidden is not what the control promises. */
  useEffect(() => {
    const sync = () => setHidden(documentHidden());
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  const running = enabled && !paused && !hidden;

  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = () => {
      /* A callback already queued when cleanup ran must not append or re-arm. */
      if (cancelled) return;
      sequenceRef.current += 1;
      const next = generateMessage(
        sequenceRef.current,
        sourcesRef.current,
        random,
        previousRef.current,
      );
      previousRef.current = next;
      setMessages((current) => appendBounded(current, next, CHAT_HISTORY_MAX));

      /* The pin is offered on a countdown rather than per message: production's
         PinBanner retires itself after five seconds, so a pin replaced on every
         message would never be readable. Hiding it for one tick before the next
         appearance is what lets the banner remount — its timers key on the
         message id, and the id here never changes. */
      const countdown = (pinCountdownRef.current ?? nextPinGap(random)) - 1;
      if (countdown <= 0) {
        pinCountdownRef.current = nextPinGap(random);
        setPinVisible((current) => !current);
      } else {
        pinCountdownRef.current = countdown;
      }

      schedule();
    };

    const schedule = () => {
      timer = setTimeout(tick, nextChatDelay(random, speed));
    };

    schedule();
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [running, speed, random]);

  const reset = useCallback(() => {
    setMessages([]);
    sequenceRef.current = 0;
    /* Cleared so the next tick starts sequence 1 again — restarting the showcase
       from its first step — with no prior line to dedup against. */
    previousRef.current = null;
    pinCountdownRef.current = nextPinGap(random);
    setPinVisible(true);
  }, [random]);

  const toggleSource = useCallback((source: PreviewSource) => {
    setSources((current) => ({ ...current, [source]: !current[source] }));
  }, []);

  const enableAllSources = useCallback(() => setSources(allSourcesEnabled()), []);
  const disableAllSources = useCallback(() => setSources(noSourcesEnabled()), []);
  const randomizeSources = useCallback(() => setSources(randomSources(random)), [random]);
  const resetSources = useCallback(() => setSources(allSourcesEnabled()), []);
  const togglePaused = useCallback(() => setPaused((current) => !current), []);

  return {
    messages,
    pinVisible,
    enabled,
    paused,
    speed,
    sources,
    running,
    setEnabled,
    togglePaused,
    setSpeed,
    reset,
    toggleSource,
    enableAllSources,
    disableAllSources,
    randomizeSources,
    resetSources,
  };
}
