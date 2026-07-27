/* Where OAuth is allowed to send the browser back to.
 *
 * Deliberately outside lib/server: both generators need these path constants to
 * name their own return route, and the module is pure data plus string equality
 * with no Node imports, so it costs the client bundle nothing. The security
 * property does not depend on secrecy — the allowlist is a fixed set of internal
 * paths, and the enforcement that matters happens server-side in the callback.
 *
 * The callback used to hardcode `/multichat`. Now that two pages can start a
 * connection, it needs a destination — and a destination that travels through an
 * OAuth round trip is the classic shape of an open redirect. So this module is
 * an exact-match allowlist, not a validator: a candidate is compared against a
 * fixed set of internal paths and anything not identical is refused.
 *
 * Exact matching is what makes the dangerous cases uninteresting. Absolute URLs,
 * protocol-relative paths, encoded hosts, traversal, backslashes, and
 * whitespace-padded variants all fail for the same reason — they are not in the
 * set. There is no parsing to outsmart and no normalization step whose edge
 * cases have to be enumerated.
 *
 * The destination is never taken from the callback's own query string. It is
 * bound at start time into an HttpOnly cookie, so a crafted callback URL cannot
 * choose it, and it is revalidated on the way out in case the cookie was
 * tampered with.
 */

/** The workspace generator — the canonical destination. */
export const OAUTH_RETURN_WORKSPACE = '/tools/multichat';

/** The classic generator, kept reachable for rollback and troubleshooting. */
export const OAUTH_RETURN_CLASSIC = '/classic/multichat';

/**
 * The legacy generator path.
 *
 * Allowed because it is where every connection started before this change came
 * back to, and one can be in flight across the deploy: a browser that began
 * authorizing against the old code will present this destination, and refusing
 * it would fail that authorization for no benefit.
 *
 * With no configured channel this path renders the original generator, which
 * reads the fragment itself — so a return here still completes normally.
 */
export const OAUTH_RETURN_LEGACY = '/multichat';

/**
 * Every destination OAuth may return to, matched exactly.
 *
 * Adding an entry here is the only way to add a destination. Nothing derives a
 * path from user input.
 */
export const OAUTH_RETURN_ALLOWLIST: readonly string[] = [
  OAUTH_RETURN_WORKSPACE,
  OAUTH_RETURN_CLASSIC,
  OAUTH_RETURN_LEGACY,
];

/** Used when no destination was requested, or the requested one was refused. */
export const OAUTH_RETURN_DEFAULT = OAUTH_RETURN_WORKSPACE;

/**
 * Return the candidate only if it is exactly an allowlisted internal path.
 *
 * Rejects arrays (a repeated query parameter), non-strings, and everything not
 * character-for-character equal to an allowlist entry. No trimming, no case
 * folding, no decoding: each would turn one accepted spelling into many.
 */
export function validateReturnDestination(candidate: unknown): string | null {
  if (typeof candidate !== 'string') return null;
  for (const allowed of OAUTH_RETURN_ALLOWLIST) {
    if (candidate === allowed) return allowed;
  }
  return null;
}

/** The validated destination, or the safe default. Never returns null. */
export function resolveReturnDestination(candidate: unknown): string {
  return validateReturnDestination(candidate) ?? OAUTH_RETURN_DEFAULT;
}
