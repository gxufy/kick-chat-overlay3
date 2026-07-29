/* Safe local check of the Twitch OAuth configuration contract.
 *
 * WHAT THIS IS FOR
 *
 * Before a human completes the OAuth round trip by hand, this answers one
 * question locally: is every variable the flow needs present, and does the
 * redirect URI have the shape Twitch will accept? It is the command a spec asks
 * an operator to run, not a route the app serves — there is deliberately no
 * endpoint that reports which secrets are set, because that is exactly the thing
 * an attacker would like to probe. A CLI the operator runs on their own machine
 * discloses to no one but them.
 *
 * WHAT IT WILL NOT DO
 *
 *   - It never prints a value from the environment. Not truncated, not a length,
 *     not a prefix. It prints variable *names* and a present/missing verdict,
 *     which is what an operator needs and what no attacker can use — the same
 *     split lib/server/oauthConfig.ts already draws for the server logs.
 *   - It never reads .env.local, or any file. It inspects process.env only. To
 *     check the values in a local env file, let Node load it for you — the
 *     runtime does the reading, this script does not:
 *
 *         node --env-file=.env.local scripts/verify-oauth-config.mts
 *
 *     Without --env-file it checks whatever is already exported in the shell,
 *     which is how you would verify a CI or hosting environment.
 *   - It does not talk to Twitch or Supabase, and it proves nothing about
 *     whether the credentials are *correct* — only that they are present and
 *     shaped plausibly. Do not read a pass here as "production OAuth works":
 *     that is only ever established by a human completing the flow.
 *
 * It reuses the one authoritative contract (REQUIRED_TWITCH_OAUTH_ENV and the
 * inspection helpers) rather than restating the list, so this can never drift
 * from what the OAuth routes actually require.
 *
 * Exit status: 0 when the contract is satisfied and the redirect path is right;
 * 1 otherwise, so it can gate a deploy step.
 */
import {
  REQUIRED_TWITCH_OAUTH_ENV,
  TWITCH_OAUTH_CALLBACK_PATH,
  TWITCH_OAUTH_LOCAL_CALLBACK,
  TWITCH_OAUTH_PRODUCTION_CALLBACK,
  missingTwitchOAuthEnv,
  twitchRedirectUriPathLooksWrong,
} from '../lib/server/oauthConfig.ts';

/* Presence, one line per variable. Deriving the missing set once and testing
   membership keeps this in step with missingTwitchOAuthEnv()'s own rules —
   crucially, that a whitespace-only value counts as absent. */
const missing = new Set<string>(missingTwitchOAuthEnv());
const pathLooksWrong = twitchRedirectUriPathLooksWrong();

console.log('Twitch OAuth configuration check');
console.log('================================');
console.log('(variable names and a present/absent verdict only — no values are read out)');
console.log('');

for (const key of REQUIRED_TWITCH_OAUTH_ENV) {
  const present = !missing.has(key);
  /* A tick or a cross and the name. Never process.env[key]. */
  console.log(`  ${present ? 'present ' : 'MISSING '} ${key}`);
}

console.log('');

if (pathLooksWrong) {
  /* The value is not printed; only the rule it broke and the fix. */
  console.log(
    `  warning  TWITCH_REDIRECT_URI is set but does not end with ${TWITCH_OAUTH_CALLBACK_PATH}.`,
  );
  console.log(
    '           It must equal the OAuth Redirect URL registered on the Twitch application.',
  );
  console.log('');
}

/* The callback URLs are public constants, not secrets — showing them is the
   point: they are what the operator pastes into the Twitch developer console,
   and TWITCH_REDIRECT_URI must equal one of them byte for byte. */
console.log('Register one of these as the OAuth Redirect URL on the Twitch application,');
console.log('and set TWITCH_REDIRECT_URI to the same value:');
console.log(`  production  ${TWITCH_OAUTH_PRODUCTION_CALLBACK}`);
console.log(`  local       ${TWITCH_OAUTH_LOCAL_CALLBACK}`);
console.log('');

const missingList = REQUIRED_TWITCH_OAUTH_ENV.filter((key) => missing.has(key));

if (missingList.length === 0 && !pathLooksWrong) {
  console.log('Result: all required variables are present and the redirect path is well formed.');
  console.log('This does NOT confirm the credentials are valid — only a human completing the');
  console.log('OAuth flow can establish that.');
  process.exit(0);
}

if (missingList.length > 0) {
  console.log(`Result: ${missingList.length} required variable(s) absent: ${missingList.join(', ')}`);
}
if (pathLooksWrong) {
  console.log('Result: TWITCH_REDIRECT_URI has the wrong path (see the warning above).');
}
process.exit(1);
