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
import {
  buildConnectionFragment,
  readConnectionFromFragment,
} from './twitchConnection';

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

/**
 * Serve the overlay, or forward to a canonical generator route.
 *
 * `hash` is the fragment to carry to the destination, already validated and
 * rebuilt from its recognized fields — never the caller's raw hash. It is '' for
 * every route that has no connection to preserve, so a caller can always
 * concatenate it without checking.
 */
export type LegacyMultichatRoute =
  | { readonly kind: 'overlay' }
  | {
      readonly kind: 'redirect';
      readonly pathname: string;
      readonly hash: string;
    };

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
 * Three cases, in this order, and the order is the whole safety property:
 *
 * 1. Channel parameters win outright. An overlay URL that happens to carry
 *    `tab=counter`, an OAuth fragment, or any other generator-shaped input still
 *    renders chat, so no scene that works today can be redirected out from under
 *    itself. This is checked first precisely so nothing added later can preempt
 *    it.
 *
 * 2. A valid OAuth fragment on a channel-less visit forwards to the MultiChat
 *    workspace *with the fragment preserved*. This is the compatibility path for
 *    an authorization that began before the callback destination moved: the user
 *    is mid-flow, holding a connection the workspace can still adopt, and
 *    dropping the fragment would force them to authorize again. It outranks
 *    `tab=counter` because a pending MultiChat connection is a stronger
 *    statement of intent than a stale tab parameter.
 *
 * 3. Otherwise the query decides, and no fragment is carried.
 *
 * `hash` is passed in rather than read from `window`, so this stays a pure
 * function usable during server rendering. Pass '' when there is no hash.
 */
export function resolveLegacyMultichatRoute(
  query: ParsedUrlQuery,
  hash = '',
): LegacyMultichatRoute {
  if (hasChannelParam(query)) return { kind: 'overlay' };

  /* Validated by the authoritative parser, then re-serialized from just the two
     recognized fields. An arbitrary, malformed, or duplicate-keyed fragment
     yields null here and is dropped before canonical routing continues — it is
     never forwarded, and never converted into a query parameter. */
  const connection = readConnectionFromFragment(hash);
  if (connection) {
    return {
      kind: 'redirect',
      pathname: CANONICAL_MULTICHAT_ROUTE,
      hash: buildConnectionFragment(connection),
    };
  }

  if (wantsCounterTab(query)) {
    return { kind: 'redirect', pathname: CANONICAL_COUNTER_ROUTE, hash: '' };
  }
  return { kind: 'redirect', pathname: CANONICAL_MULTICHAT_ROUTE, hash: '' };
}

/** The full destination to hand `router.replace`, fragment included. */
export function legacyRedirectTarget(route: LegacyMultichatRoute): string {
  return route.kind === 'redirect' ? `${route.pathname}${route.hash}` : '';
}
