/* GET /api/twitch/oauth/callback — finish Twitch OAuth authorization.
 *
 * Verifies the OAuth state parameter, exchanges the authorization code
 * for tokens, validates the access token against Twitch, retrieves the
 * user profile, cross-checks the profile against the validation result,
 * and persists the encrypted connection.
 *
 * All errors are generic — no tokens, codes, state, or Twitch responses
 * are ever logged or returned to the client.
 */

import crypto from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import {
  exchangeTwitchAuthorizationCode,
} from '../../../../lib/server/twitchOAuth';
import {
  validateTwitchAccessToken,
} from '../../../../lib/server/twitchTokenValidation';
import {
  getTwitchUserProfile,
} from '../../../../lib/server/twitchUserProfile';
import {
  saveTwitchConnection,
} from '../../../../lib/server/twitchConnectionStore';

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const STATE_COOKIE_NAME = 'twitch_oauth_state';
const STATE_COOKIE_PATH = '/api/twitch/oauth';
const GENERIC_ERR = 'Twitch connection failed.';
const AUTH_ERR = 'Twitch authorization was not completed.';

/* ------------------------------------------------------------------ */
/* Cookie helpers                                                      */
/* ------------------------------------------------------------------ */

/** Build a Set-Cookie header that clears the OAuth state cookie. */
function buildClearStateCookie(): string {
  const parts = [
    `${STATE_COOKIE_NAME}=`,
    `Path=${STATE_COOKIE_PATH}`,
    'Max-Age=0',
    'SameSite=Lax',
    'HttpOnly',
  ];

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

/**
 * Extract a single string value for a query parameter.
 *
 * Returns undefined when the key is absent, empty, or represented as
 * an array (repeated parameters are rejected as invalid).
 */
function extractQueryParam(
  req: NextApiRequest,
  key: string,
): string | undefined {
  const raw = req.query[key];
  if (Array.isArray(raw)) return undefined;
  if (typeof raw !== 'string') return undefined;
  if (raw.length === 0) return undefined;
  return raw;
}

/* ------------------------------------------------------------------ */
/* State validation                                                    */
/* ------------------------------------------------------------------ */

/**
 * Validate the OAuth state cookie against the query `state` parameter
 * using constant-time comparison.
 *
 * Returns true only when both values are non-empty and match.
 */
function validateState(
  queryState: string,
  cookieState: string,
): boolean {
  const queryBuf = Buffer.from(queryState, 'utf-8');
  const cookieBuf = Buffer.from(cookieState, 'utf-8');

  if (queryBuf.length !== cookieBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(queryBuf, cookieBuf);
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  /* --- Every response is uncacheable -------------------------------- */
  res.setHeader('Cache-Control', 'no-store');

  /* --- Method check ------------------------------------------------ */
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  /* --- Clear the OAuth state cookie --------------------------------- */
  res.setHeader('Set-Cookie', buildClearStateCookie());

  /* --- Reject array-valued parameters before extracting query values */
  if (
    Array.isArray(req.query['code']) ||
    Array.isArray(req.query['state']) ||
    Array.isArray(req.query['error']) ||
    Array.isArray(req.query['error_description'])
  ) {
    res.status(400).json({ error: AUTH_ERR });
    return;
  }

  /* --- Read and validate query parameters --------------------------- */
  const code = extractQueryParam(req, 'code');
  const state = extractQueryParam(req, 'state');
  const queryError = extractQueryParam(req, 'error');
  /* error_description is accepted but NEVER returned, logged, or exposed */

  /* Twitch returned an error (key present), or code/state are
     missing/invalid/arrays ------------------------------------ */
  const hasErrorKey = Object.prototype.hasOwnProperty.call(req.query, 'error');

  if (
    hasErrorKey ||
    queryError !== undefined ||
    code === undefined ||
    state === undefined
  ) {
    res.status(400).json({ error: AUTH_ERR });
    return;
  }

  /* --- Require a non-empty state cookie ----------------------------- */
  const rawCookie = req.headers.cookie;
  if (!rawCookie || rawCookie.length === 0) {
    res.status(400).json({ error: AUTH_ERR });
    return;
  }

  /* Parse the cookie to extract the OAuth state value */
  const cookies = rawCookie
    .split(';')
    .map((c) => c.trim());

  let cookieState: string | undefined;
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.split('=');
    if (name === STATE_COOKIE_NAME) {
      cookieState = rest.join('=');
      break;
    }
  }

  if (!cookieState || cookieState.length === 0) {
    res.status(400).json({ error: AUTH_ERR });
    return;
  }

  /* --- Constant-time state comparison -------------------------------- */
  if (!validateState(state, cookieState)) {
    res.status(400).json({ error: AUTH_ERR });
    return;
  }

  /* --- Exchange code, validate, fetch profile, store ----------------- */
  try {
    const tokenGrant = await exchangeTwitchAuthorizationCode(code);
    const validation = await validateTwitchAccessToken(tokenGrant.accessToken);
    const profile = await getTwitchUserProfile(
      tokenGrant.accessToken,
      validation.userId,
    );

    /* Cross-check profile against validation result */
    if (profile.userId !== validation.userId) {
      throw new Error(GENERIC_ERR);
    }
    if (profile.login !== validation.login) {
      throw new Error(GENERIC_ERR);
    }

    const saved = await saveTwitchConnection({
      twitchUserId: validation.userId,
      twitchLogin: validation.login,
      twitchDisplayName: profile.displayName,
      accessToken: tokenGrant.accessToken,
      refreshToken: tokenGrant.refreshToken,
      expiresIn: validation.expiresIn,
      scopes: validation.scopes,
    });

    res.status(200).json({ connectionId: saved.connectionId });
  } catch {
    /* All helper, configuration, encryption, and database errors */
    res.status(500).json({ error: GENERIC_ERR });
  }
}
