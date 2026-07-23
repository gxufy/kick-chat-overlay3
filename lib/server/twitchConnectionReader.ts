/* Server-only helper: load an active Twitch connection from Supabase
 * and decrypt its OAuth tokens.
 *
 * All failures surface as a single opaque Error so tokens and DB
 * details are never leaked to calling code or logs.
 */
import { getSupabaseAdmin } from './supabaseAdmin';
import { decryptTwitchToken } from './twitchTokenCrypto';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/**
 * A Twitch connection with decrypted OAuth tokens and metadata.
 *
 * Fields use camelCase for application-level convenience.
 */
export type StoredTwitchConnection = {
  connectionId: string;
  twitchUserId: string;
  twitchLogin: string;
  twitchDisplayName: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string;
  scopes: string[];
};

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const LOOKUP_FAILED = 'Twitch connection lookup failed.';

/** UUID regex — stricter than a bare regex; matches the standard 8-4-4-4-12 format. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Required moderator scope. */
const REQUIRED_SCOPE = 'moderator:read:chat_messages';

/** Columns returned from the database. */
const COLUMNS =
  'id, twitch_user_id, twitch_login, twitch_display_name, access_token_encrypted, refresh_token_encrypted, token_expires_at, scopes';

/* ------------------------------------------------------------------ */
/* Internal helpers                                                    */
/* ------------------------------------------------------------------ */

/** Validate that `connectionId` is an acceptable UUID string. */
function validateInput(connectionId: string): void {
  if (typeof connectionId !== 'string' || connectionId.trim().length === 0) {
    throw new Error(LOOKUP_FAILED);
  }
  if (!UUID_RE.test(connectionId)) {
    throw new Error(LOOKUP_FAILED);
  }
}

/**
 * Strictly validate a raw database row before decryption.
 *
 * Throws on any structural or semantic defect.
 */
function validateRow(
  row: Record<string, unknown>,
  expectedId: string,
): void {
  // All scalar fields must be non-empty strings.
  const scalars = [
    row.id,
    row.twitch_user_id,
    row.twitch_login,
    row.twitch_display_name,
    row.access_token_encrypted,
    row.refresh_token_encrypted,
    row.token_expires_at,
  ];

  for (const val of scalars) {
    if (typeof val !== 'string' || val.length === 0) {
      throw new Error(LOOKUP_FAILED);
    }
  }

  // id must match what we queried for.
  if (row.id !== expectedId) {
    throw new Error(LOOKUP_FAILED);
  }

  // token_expires_at must parse as a valid date.
  const ts = new Date(row.token_expires_at as string).getTime();
  if (Number.isNaN(ts)) {
    throw new Error(LOOKUP_FAILED);
  }

  // scopes must be a non-empty-string array containing the required scope.
  const scopes = row.scopes;
  if (!Array.isArray(scopes)) {
    throw new Error(LOOKUP_FAILED);
  }
  if (
    !scopes.every(
      (s): s is string => typeof s === 'string' && s.trim().length > 0,
    )
  ) {
    throw new Error(LOOKUP_FAILED);
  }
  if (!scopes.includes(REQUIRED_SCOPE)) {
    throw new Error(LOOKUP_FAILED);
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Load an active (non-revoked) Twitch connection by its opaque
 * connection ID, decrypt its OAuth tokens, and return a plain object.
 *
 * Throws `LOOKUP_FAILED` for **every** failure path: invalid input,
 * missing config, DB errors, missing/revoked rows, malformed data,
 * or decryption failure.
 */
export async function getTwitchConnection(
  connectionId: string,
): Promise<StoredTwitchConnection> {
  // --- input validation ---
  validateInput(connectionId);

  // --- database query ---
  let row: {
    id: string;
    twitch_user_id: string;
    twitch_login: string;
    twitch_display_name: string;
    access_token_encrypted: string;
    refresh_token_encrypted: string;
    token_expires_at: string;
    scopes: string[];
  } | null = null;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('twitch_connections')
      .select(COLUMNS)
      .eq('id', connectionId)
      .is('revoked_at', null)
      .single();

    if (error || !data) {
      throw new Error(LOOKUP_FAILED);
    }

    row = data;
  } catch {
    throw new Error(LOOKUP_FAILED);
  }

  // --- structural validation ---
  try {
    validateRow(row, connectionId);
  } catch {
    throw new Error(LOOKUP_FAILED);
  }

  // --- decrypt tokens ---
  let accessToken: string;
  let refreshToken: string;

  try {
    accessToken = decryptTwitchToken(row.access_token_encrypted);
    refreshToken = decryptTwitchToken(row.refresh_token_encrypted);
  } catch {
    throw new Error(LOOKUP_FAILED);
  }

  // --- post-decryption validation ---
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new Error(LOOKUP_FAILED);
  }
  if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
    throw new Error(LOOKUP_FAILED);
  }

  // --- assemble & return ---
  return {
    connectionId: row.id,
    twitchUserId: row.twitch_user_id,
    twitchLogin: row.twitch_login,
    twitchDisplayName: row.twitch_display_name,
    accessToken,
    refreshToken,
    tokenExpiresAt: row.token_expires_at,
    scopes: row.scopes,
  };
}
