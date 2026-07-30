/* The authoritative Twitch OAuth configuration contract.
 *
 * Every environment variable the OAuth round trip needs is named here once, and
 * every OAuth route asks this module rather than reading process.env itself. The
 * list is not a guess: it is the union of what the modules on the path actually
 * read —
 *
 *   TWITCH_CLIENT_ID              lib/server/twitchOAuth.ts, twitchTokenRefresh,
 *                                 twitchTokenRevocation, twitchTokenValidation,
 *                                 twitchUserProfile, twitchPinnedMessage, …
 *   TWITCH_CLIENT_SECRET          lib/server/twitchOAuth.ts, twitchTokenRefresh
 *   TWITCH_REDIRECT_URI           lib/server/twitchOAuth.ts (code exchange) and
 *                                 the authorize redirect built by the start route
 *   TWITCH_TOKEN_ENCRYPTION_KEY   lib/server/twitchTokenCrypto.ts
 *   SUPABASE_URL                  lib/server/supabaseAdmin.ts
 *   SUPABASE_SECRET_KEY           lib/server/supabaseAdmin.ts
 *
 * All six are required *before* authorization begins, not only where they are
 * first dereferenced. A deployment missing the encryption key or the Supabase
 * credentials can send a user to Twitch and take their consent, and then fail on
 * the way back with nothing to show for it. Checking the whole contract at the
 * start route turns that into one refusal, before the user leaves the site.
 *
 * WHAT IS AND IS NOT SAID OUT LOUD
 *
 * Clients get a stable, non-secret code — `oauth_not_configured` — and nothing
 * else. Server logs get the *names* of the absent keys, which is what an operator
 * needs and what no attacker can use. No value from process.env is ever logged or
 * returned, not truncated, not fingerprinted, not length-reported.
 *
 * Every read is lazy, inside a function, so importing this module does nothing and
 * a missing variable cannot break a static build.
 */

/* ------------------------------------------------------------------ */
/* Public error code                                                   */
/* ------------------------------------------------------------------ */

/**
 * The stable machine-readable code returned when the OAuth configuration is
 * incomplete.
 *
 * Deliberately not a sentence: it is contract, so support can be told to look for
 * exactly this string, and it can be asserted in a test without pinning prose.
 * It names no variable and reveals no value.
 */
export const OAUTH_NOT_CONFIGURED = 'oauth_not_configured';

/* ------------------------------------------------------------------ */
/* The contract                                                        */
/* ------------------------------------------------------------------ */

/**
 * Every variable the Twitch OAuth flow requires, in the order an operator would
 * most usefully be told about them: the Twitch application first, then the token
 * store.
 */
export const REQUIRED_TWITCH_OAUTH_ENV = [
  'TWITCH_CLIENT_ID',
  'TWITCH_CLIENT_SECRET',
  'TWITCH_REDIRECT_URI',
  'TWITCH_TOKEN_ENCRYPTION_KEY',
  'SUPABASE_URL',
  'SUPABASE_SECRET_KEY',
] as const;

export type TwitchOAuthEnvKey = (typeof REQUIRED_TWITCH_OAUTH_ENV)[number];

/* ------------------------------------------------------------------ */
/* Callback URL — one definition, shared by code, tests, and docs       */
/* ------------------------------------------------------------------ */

/**
 * The path Twitch redirects back to, which is `pages/api/twitch/oauth/callback`.
 *
 * A constant rather than a literal in three places, because the value has to
 * agree with the file layout, with `TWITCH_REDIRECT_URI`, and with the entry
 * registered in the Twitch developer console. Twitch compares byte for byte.
 */
export const TWITCH_OAUTH_CALLBACK_PATH = '/api/twitch/oauth/callback';

/** The canonical production origin. */
export const TWITCH_OAUTH_PRODUCTION_ORIGIN = 'https://multichat-gxufy.com';

/** The development origin `npm run dev` serves. */
export const TWITCH_OAUTH_LOCAL_ORIGIN = 'http://localhost:3000';

/** The callback URL for an origin, with any trailing slash removed. */
export function twitchOAuthCallbackUrl(origin: string): string {
  return `${origin.replace(/\/+$/, '')}${TWITCH_OAUTH_CALLBACK_PATH}`;
}

/**
 * What `TWITCH_REDIRECT_URI` must be in production, and what has to be
 * registered in the Twitch developer console for the live site.
 */
export const TWITCH_OAUTH_PRODUCTION_CALLBACK = twitchOAuthCallbackUrl(
  TWITCH_OAUTH_PRODUCTION_ORIGIN,
);

/** The same, for local development. Both may be registered on one application. */
export const TWITCH_OAUTH_LOCAL_CALLBACK = twitchOAuthCallbackUrl(
  TWITCH_OAUTH_LOCAL_ORIGIN,
);

/* ------------------------------------------------------------------ */
/* Inspection                                                          */
/* ------------------------------------------------------------------ */

/**
 * Whether a variable is set to something usable.
 *
 * An empty or whitespace-only value counts as absent: a hosting panel that has
 * the key with a blank value is misconfigured in exactly the way a missing key
 * is, and treating them differently would produce a confusing report.
 */
function isPresent(key: TwitchOAuthEnvKey): boolean {
  const raw = process.env[key];
  return typeof raw === 'string' && raw.trim().length > 0;
}

/**
 * The names of every required variable that is absent or empty.
 *
 * Names only — this function never returns a value from the environment, so its
 * result is safe to log. An empty array means the contract is satisfied.
 */
export function missingTwitchOAuthEnv(): TwitchOAuthEnvKey[] {
  return REQUIRED_TWITCH_OAUTH_ENV.filter((key) => !isPresent(key));
}

/**
 * True when `TWITCH_REDIRECT_URI` is set but does not end in the callback path
 * this application actually serves.
 *
 * Not fatal: the value is passed to Twitch, which will refuse a URL that is not
 * registered, and there is no reason for this code to be the one to decide the
 * deployment cannot possibly be right. But it is by far the most likely mistake
 * after a missing variable — a bare origin, or the start path pasted by mistake —
 * and saying so costs nothing and discloses nothing.
 */
export function twitchRedirectUriPathLooksWrong(): boolean {
  const raw = process.env.TWITCH_REDIRECT_URI;
  if (typeof raw !== 'string' || raw.trim().length === 0) return false;
  return !raw.trim().endsWith(TWITCH_OAUTH_CALLBACK_PATH);
}

/**
 * Log which parts of the contract are unsatisfied, by name.
 *
 * The one place in the OAuth flow that writes to the log at all. It prints key
 * names and a fixed sentence — never `process.env` values, never the request, and
 * never anything derived from a value such as a length or a prefix.
 */
export function reportTwitchOAuthMisconfiguration(
  route: string,
  missing: readonly TwitchOAuthEnvKey[],
): void {
  if (missing.length > 0) {
    console.error(
      `[twitch-oauth] ${route}: ${OAUTH_NOT_CONFIGURED} — missing required environment variables: ${missing.join(', ')}`,
    );
  }
  if (twitchRedirectUriPathLooksWrong()) {
    console.error(
      `[twitch-oauth] ${route}: TWITCH_REDIRECT_URI does not end with ${TWITCH_OAUTH_CALLBACK_PATH}; it must equal the OAuth Redirect URL registered on the Twitch application`,
    );
  }
}

/* ------------------------------------------------------------------ */
/* What the start route needs to build the authorize URL               */
/* ------------------------------------------------------------------ */

/**
 * The two public values the authorize redirect carries.
 *
 * The client id is public by protocol — it travels in the authorize URL, which
 * the browser must see. The client secret is deliberately absent from this type:
 * it is read only by the server-side code exchange, and nothing that reaches a
 * redirect should be able to reference it.
 */
export type TwitchOAuthStartConfig = {
  clientId: string;
  redirectUri: string;
};

/**
 * The start route's configuration, or null when the contract is unsatisfied.
 *
 * Returns null on *any* missing key, not only the two it uses, for the fail-early
 * reason in the module header. `missing` is what the caller logs.
 */
export function readTwitchOAuthStartConfig():
  | { ok: true; config: TwitchOAuthStartConfig }
  | { ok: false; missing: TwitchOAuthEnvKey[] } {
  const missing = missingTwitchOAuthEnv();
  if (missing.length > 0) return { ok: false, missing };

  /* Non-null by construction: missingTwitchOAuthEnv() just proved both are
     present and non-empty. Trimmed, because a value pasted with a trailing
     newline would otherwise be sent to Twitch as-is and refused. */
  return {
    ok: true,
    config: {
      clientId: process.env.TWITCH_CLIENT_ID!.trim(),
      redirectUri: process.env.TWITCH_REDIRECT_URI!.trim(),
    },
  };
}
