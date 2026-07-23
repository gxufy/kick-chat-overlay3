/* GET /api/twitch/oauth/start — begin Twitch OAuth authorization.
 *
 * Generates a cryptographically random state, stores it in an HttpOnly
 * cookie, and redirects the browser to Twitch's OAuth authorization endpoint
 * using the Authorization Code Grant Flow.
 *
 * The client secret is intentionally omitted from this route. It is used only
 * server-side during the authorization-code exchange in the callback route.
 */

import crypto from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';

const STATE_BYTES = 32;
const TWITCH_SCOPE = 'moderator:read:chat_messages';
const TWITCH_AUTHORIZE = 'https://id.twitch.tv/oauth2/authorize';

const STATE_COOKIE_NAME = 'twitch_oauth_state';
const STATE_COOKIE_PATH = '/api/twitch/oauth';
const STATE_COOKIE_MAX_AGE = 600;

function buildStateCookie(state: string): string {
  const parts = [
    `${STATE_COOKIE_NAME}=${state}`,
    `Path=${STATE_COOKIE_PATH}`,
    `Max-Age=${STATE_COOKIE_MAX_AGE}`,
    'SameSite=Lax',
    'HttpOnly',
  ];

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

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

  const state = crypto.randomBytes(STATE_BYTES).toString('hex');

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Set-Cookie', buildStateCookie(state));

  const authorizationUrl = new URL(TWITCH_AUTHORIZE);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('client_id', clientId);
  authorizationUrl.searchParams.set('redirect_uri', redirectUri);
  authorizationUrl.searchParams.set('scope', TWITCH_SCOPE);
  authorizationUrl.searchParams.set('state', state);

  res.redirect(302, authorizationUrl.toString());
}