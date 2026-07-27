/* What a visit to the legacy /multichat URL should actually do.
 *
 * `/multichat` has carried two jobs since the beginning: it is the overlay OBS
 * loads, and it was also the generator page. Those are now split — the generator
 * is the workspace at /tools/multichat, and the original UI stays reachable at
 * /classic/multichat — but the overlay half can never move. URLs with channel
 * parameters are sitting in OBS scene collections that nobody will edit, so
 * serving the overlay for them is a permanent commitment, not a migration step.
 *
 * The rule is therefore one-directional: a channel parameter means overlay, and
 * only a visit with no channel at all is a generator visit worth forwarding.
 * Deciding it here, as a pure function of the query, keeps the page from
 * expressing it as a chain of conditions that a later edit could reorder.
 */
import type { ParsedUrlQuery } from 'querystring';

/** Every parameter that names a channel. `channel` is the legacy Kick alias. */
export const MULTICHAT_CHANNEL_PARAMS = [
  'channel',
  'kick',
  'twitch',
  'youtube',
  'tiktok',
] as const;

/** The canonical generator routes the legacy path forwards to. */
export const CANONICAL_MULTICHAT_ROUTE = '/tools/multichat';
export const CANONICAL_COUNTER_ROUTE = '/tools/counter';

/** Serve the overlay, or forward to a canonical generator route. */
export type LegacyMultichatRoute =
  | { readonly kind: 'overlay' }
  | { readonly kind: 'redirect'; readonly pathname: string };

/**
 * Whether a query value names a channel.
 *
 * An empty value does not: `?kick=` is what an unfilled generator field
 * produces, and treating it as a channel would serve an overlay that can never
 * connect to anything. Repeated parameters arrive as an array and count if any
 * entry is non-empty, so `?kick=&kick=name` is still an overlay request.
 */
function namesChannel(value: string | string[] | undefined): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.some((entry) => entry.trim().length > 0);
  return false;
}

/** True when this query configures at least one channel. */
export function hasChannelParam(query: ParsedUrlQuery): boolean {
  return MULTICHAT_CHANNEL_PARAMS.some((param) => namesChannel(query[param]));
}

/**
 * Whether `?tab=counter` was asked for.
 *
 * Matched exactly on a single string value. A repeated `tab` is not honoured:
 * it is ambiguous, and the safe reading of an ambiguous generator request is the
 * MultiChat workspace, which is where an unrecognized tab already goes.
 */
function wantsCounterTab(query: ParsedUrlQuery): boolean {
  return query['tab'] === 'counter';
}

/**
 * What a `/multichat` visit resolves to.
 *
 * Channel parameters are checked first and win outright. That ordering is the
 * whole safety property: an overlay URL that happens to carry `tab=counter` —
 * or any other generator-shaped parameter — still renders chat, so no scene
 * that works today can be redirected out from under itself.
 */
export function resolveLegacyMultichatRoute(
  query: ParsedUrlQuery,
): LegacyMultichatRoute {
  if (hasChannelParam(query)) return { kind: 'overlay' };
  if (wantsCounterTab(query)) {
    return { kind: 'redirect', pathname: CANONICAL_COUNTER_ROUTE };
  }
  return { kind: 'redirect', pathname: CANONICAL_MULTICHAT_ROUTE };
}
