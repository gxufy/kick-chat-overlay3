# Privacy and data handling

This documents what the application stores and how it treats sensitive data.
It is an engineering reference, not a legal privacy policy.

## What is stored

The only persisted data is a single Supabase table, `twitch_connections`, used
by the optional Twitch pinned-message feature. It holds a connection `id` and an
**encrypted** Twitch OAuth token (`access_token_encrypted`), plus its refresh
counterpart. No chat messages, viewer identities, or overlay content are ever
persisted — chat is proxied live and rendered, never stored.

If you do not configure Twitch OAuth, no database is used at all; every other
feature works without it.

## How tokens are protected

- Twitch OAuth tokens are encrypted at rest with **AES-256-GCM**, using a fresh
  random 12-byte IV per encryption (`src/lib/server/twitchTokenCrypto.ts`).
- The encryption key comes from `TWITCH_TOKEN_ENCRYPTION_KEY`, read from the
  environment lazily inside functions — never hard-coded, never logged.
- Tokens are decrypted only server-side, only when a request needs them. They
  are never sent to the browser.
- Disconnecting revokes the token with Twitch and removes the row
  (`twitchConnectionRevoker.ts`, `twitchTokenRevocation.ts`).

## Secret hygiene

- All secrets (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `TWITCH_CLIENT_ID`,
  `TWITCH_CLIENT_SECRET`, `TWITCH_REDIRECT_URI`, `TWITCH_TOKEN_ENCRYPTION_KEY`)
  are read via `process.env` at call time, never at module top level.
- Server helpers throw one opaque error per module. Tokens, connection IDs,
  user IDs, and raw Twitch response bodies are never logged or returned to
  clients.
- `src/lib/server/**` is server-only and may not be imported by client code;
  this is enforced by `tests/integration/importBoundaries.test.ts`.

## Verifying configuration

```bash
npm run verify:oauth        # checks required OAuth env vars are present
npm run verify:oauth:local  # same, for local development
```

See [DEPLOY.md](DEPLOY.md) for the full `twitch_connections` schema and
environment-variable setup.
