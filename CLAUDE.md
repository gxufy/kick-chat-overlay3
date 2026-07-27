# CLAUDE.md

## Stack and routing

- **Pages Router, Next 14, TypeScript strict.** New API routes go in `pages/api/` as `NextApiHandler`.
- The sole exception is `app/api/twitch/pins/route.ts`, which uses App Router conventions. Do not add more App Router files without an explicit reason.
- `@/*` resolves to the project root (`tsconfig.json` paths).

## Routes

Generators are one shell (`components/workspace/GeneratorWorkspace.tsx`) driven by
a tool descriptor from `lib/tools/registry.ts`, served by `pages/tools/[tool].tsx`:

- `/tools/multichat`, `/tools/counter` — **canonical generators.** Link these.
- `/multichat` — **the overlay OBS loads. Never redirect a URL with a channel
  parameter.** Those URLs sit in scene collections nobody will edit, so serving
  the overlay for them is permanent. A channel-*less* visit forwards to
  `/tools/multichat`, carrying a valid OAuth fragment across the forward
  (`lib/multichatRouting.ts`).
- `/classic/multichat` — the original generator, `noindex`, kept for rollback.
- `/counter` — the counter overlay, same permanence rule as `/multichat`.

A URL fragment is not in `router.query`. Anything deciding a route from a
fragment must read `window.location.hash` client-side and pass it in, or it will
silently ignore it — this shipped as a bug once.

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
npm test
npx tsc --noEmit
npm run build
git diff --check
```

`npm run build` regenerates `next-env.d.ts`; restore it rather than committing it
(`git restore -- next-env.d.ts`).

## Hard rules

- Never read, display, or modify `.env.local`.
- Never commit or push automatically. Commits and pushes require explicit user instruction.
- Do not commit SQL containing real project credentials or connection strings.
