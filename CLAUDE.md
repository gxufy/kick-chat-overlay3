# CLAUDE.md

## Stack and routing

- **All application code lives under `src/`** (`@/*` resolves to `src/*`). New API routes go in `src/pages/api/` as `NextApiHandler`.
- **Pages Router, Next 14, TypeScript strict.**
- The sole exception is `src/app/api/twitch/pins/route.ts`, which uses App Router conventions. Do not add more App Router files without an explicit reason.
- See `docs/ARCHITECTURE.md` for the full directory layout.
- `@/*` resolves to the project root (`tsconfig.json` paths).

## Routes

There is one generator: `src/components/classic/ClassicGenerator.tsx`, rendering both
tools from their descriptors in `src/features/registry.ts`.

- `/multichat` — **with any channel parameter this is the overlay OBS loads. Never
  redirect a URL with a channel parameter.** Those URLs sit in scene collections
  nobody will edit, so serving the overlay for them is permanent. A channel-*less*
  visit is **the canonical generator** — link this (`src/lib/multichatRouting.ts`).
- `/counter` — the counter overlay, same permanence rule as `/multichat`.
- `/tools/multichat`, `/tools/counter`, `/classic/multichat` — redirect stubs into
  `/multichat`, each carrying a valid OAuth fragment across the forward. Do not
  link them and do not turn them back into generators.

A URL fragment is not in `router.query`. Anything deciding a route from a
fragment must read `window.location.hash` client-side and pass it in, or it will
silently ignore it — this shipped as a bug once.

## Server-only code

- `src/lib/server/**` is server-only. Never import it from a component or from any client-side `src/lib/` module. This is enforced by `tests/integration/importBoundaries.test.ts`.
- Secrets (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `TWITCH_CLIENT_ID`, etc.) are read via `process.env` lazily inside functions, never at module top level.

## Error design

- Server helpers throw one opaque generic error per module. Tokens, connection IDs, user IDs, and raw Twitch response bodies are never logged or returned to clients.
- Preserve this design when editing any file in `src/lib/server/`.

## Validation

- Validate at every boundary, including our own API responses. `src/lib/twitchPinClient.ts` shows the pattern for browser-side validation.

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
