/* The counter preview's readiness protocol, shared by both sides of the iframe.
 *
 * WHY IT EXISTS. The generator's counter preview used to swap its sample counts
 * out for the live `/counter` frame the moment a channel became valid. Two
 * separate waits followed, and the surface was empty across both: the frame's
 * own 350 ms URL debounce, and then the embedded page's deliberate refusal to
 * render anything until its first poll has settled — because a fabricated zero
 * on stream is worse than an empty frame. So the preview went blank for a
 * debounce plus a network round trip, which reads as a broken counter rather
 * than as a loading one.
 *
 * Neither the frame's mount nor the iframe's `load` event can close that
 * window: both happen before the embedded page has asked any provider
 * anything. The only signal that means "there are real numbers on screen now"
 * comes from the page that committed them, so the page sends it.
 *
 * WHAT CROSSES THE BOUNDARY. One message, in one direction, carrying a type and
 * a channel identity. No counts, no channel names, no configuration: the parent
 * already knows all of that — it generated the URL. The message answers exactly
 * one question, which is whether the document now in the frame has committed a
 * poll for the configuration the parent currently displays.
 *
 * Both sides import this module, so the message shape and the key derivation
 * exist once rather than as two agreeing copies.
 *
 * Browser-safe: no server-only imports, and nothing here reads or writes state.
 */
import {
  channelPollKey,
  parseViewerCounterConfig,
} from './viewerCounterConfig';

/**
 * The message type. Namespaced because the generator's window receives
 * messages it did not ask for — extensions, dev tooling, and other embedded
 * documents all post into it — and a bare `'ready'` would be a name collision
 * waiting to happen.
 */
export const COUNTER_READY_MESSAGE = 'gxufy:counter-poll-committed';

/** What the preview says while the live counter is still preparing. */
export const COUNTER_LOADING_MESSAGE = 'Loading live viewer count…';

/** The one message `/counter` sends to an embedding generator. */
export type CounterReadyMessage = {
  type: typeof COUNTER_READY_MESSAGE;
  /** Which channel configuration the committed poll was for. */
  pollKey: string;
};

/** Build the readiness message for a committed poll. */
export function counterReadyMessage(pollKey: string): CounterReadyMessage {
  return { type: COUNTER_READY_MESSAGE, pollKey };
}

/**
 * Whether an arbitrary `MessageEvent.data` is this protocol's message.
 *
 * Validated at the boundary like every other untrusted input, and for the same
 * reason: `event.data` is whatever the sender chose to structured-clone. A
 * caller that has already checked origin and source still cannot assume shape,
 * because the frame's own document could post anything.
 */
export function isCounterReadyMessage(
  data: unknown,
): data is CounterReadyMessage {
  if (!data || typeof data !== 'object') return false;
  const { type, pollKey } = data as { type?: unknown; pollKey?: unknown };
  return type === COUNTER_READY_MESSAGE && typeof pollKey === 'string';
}

/**
 * The channel identity of a generated counter URL.
 *
 * Deliberately derived from the URL rather than from generator state, and
 * through the overlay's own parser and key builder rather than a second reading
 * of the same parameters. The embedded page computes its `pollKey` from the
 * query string it was loaded with; this computes the same key from the same
 * string, so the two cannot disagree about what counts as a channel change —
 * including about normalization, which only the parser knows.
 */
export function counterUrlPollKey(url: string): string {
  /* Fragment first: the counter never carries one, but a key that silently
     absorbed one would be wrong rather than merely unused. */
  const withoutHash = url.split('#')[0] ?? '';
  const start = withoutHash.indexOf('?');
  const raw = start === -1 ? '' : withoutHash.slice(start + 1);
  const params = Object.fromEntries(new URLSearchParams(raw).entries());
  return channelPollKey(parseViewerCounterConfig(params).channels);
}
