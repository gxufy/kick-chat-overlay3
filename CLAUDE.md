# CLAUDE.md

## Stack and routing

- **Pages Router, Next 14, TypeScript strict.** New API routes go in `pages/api/` as `NextApiHandler`.
- The sole exception is `app/api/twitch/pins/route.ts`, which uses App Router conventions. Do not add more App Router files without an explicit reason.
- `@/*` resolves to the project root (`tsconfig.json` paths).

## Server-only code

- `lib/server/**` is server-only. Never import it from a component or from any client-side `lib/` module.
- Secrets (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `TWITCH_CLIENT_ID`, etc.) are read via `process.env` lazily inside functions, never at module top level.

## Error design

- Server helpers throw one opaque generic error per module. Tokens, connection IDs, user IDs, and raw Twitch response bodies are never logged or returned to clients.
- Preserve this design when editing any file in `lib/server/`.

## Validation

- Validate at every boundary, including our own API responses. `lib/twitchPinClient.ts` shows the pattern for browser-side validation.

## OAuth scope

- `moderator:read:chat_messages` is confirmed correct for the Twitch Get Pinned Chat Message endpoint (`GET /helix/chat/pins`). Do not change it.

## Commit style

- One logical helper per commit. Imperative subject line, no scope prefixes. Match the existing commit history style.

## Verification — required before declaring implementation work complete

```bash
npx tsc --noEmit
npm run build
git diff --check
```

## Hard rules

- Never read, display, or modify `.env.local`.
- Never commit or push automatically. Commits and pushes require explicit user instruction.
- Do not commit SQL containing real project credentials or connection strings.
