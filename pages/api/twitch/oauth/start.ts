/* GET /api/twitch/oauth/start — begin Twitch OAuth authorization.
 *
 * Generates a cryptographically random state, stores it in an HttpOnly cookie
 * alongside the validated return destination, and redirects the browser to
 * Twitch's OAuth authorization endpoint using the Authorization Code Grant Flow.
 *
 * The client secret is intentionally omitted from this route. It is used only
 * server-side during the authorization-code exchange in the callback route.
 *
 * `returnTo` selects which generator the browser comes back to. It is matched
 * against an exact allowlist here and again in the callback, and it travels in an
 * HttpOnly cookie rather than through Twitch, so neither a crafted start URL nor
 * a crafted callback URL can redirect anywhere but an internal page. An absent or
 * refused value falls back to the workspace; it is never echoed back to the
 * client, so nothing unvalidated is reflected.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import {
  buildOAuthCookies,
  generateOAuthState,
} from '../../../../lib/server/oauthCookies';
import { resolveReturnDestination } from '../../../../lib/oauthReturn';

const TWITCH_SCOPE = 'moderator:read:chat_messages';
const TWITCH_AUTHORIZE = 'https://id.twitch.tv/oauth2/authorize';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): void {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const redirectUri = process.env.TWITCH_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    res.status(500).json({ error: 'server misconfiguration' });
    return;
  }

  const state = generateOAuthState();
  /* Anything not exactly an allowlisted internal path becomes the default. A
     repeated ?returnTo= arrives as an array and is refused by the same rule. */
  const returnTo = resolveReturnDestination(req.query['returnTo']);

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Set-Cookie', buildOAuthCookies(state, returnTo));

  const authorizationUrl = new URL(TWITCH_AUTHORIZE);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('client_id', clientId);
  authorizationUrl.searchParams.set('redirect_uri', redirectUri);
  authorizationUrl.searchParams.set('scope', TWITCH_SCOPE);
  authorizationUrl.searchParams.set('state', state);

  res.redirect(302, authorizationUrl.toString());
}
