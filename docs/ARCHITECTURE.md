# Architecture

All application code lives under `src/`. The `@/*` TypeScript path alias
resolves to `src/*`, so `@/lib/kick` is `src/lib/kick.ts`. Tests live outside
`src/`, in `tests/`.

```
src/
  pages/        Next.js Pages Router: routes + pages/api handlers
  app/          One App Router route (api/twitch/pins) — the sole exception
  components/   React components
    overlay/      production OBS renderers (ChatOverlay, ViewerCounterDisplay)
    classic/      the generator UI
    workspace/    shared preview frame + background
    ui/inputs/    reusable form inputs
  features/     per-tool catalogs composed through registry.ts
    multichat/    MultiChat tool catalog + preview simulators
    counter/      Viewer Counter tool catalog
  lib/          non-UI logic
    server/       server-only: token crypto, Supabase, OAuth secrets
    connectors/   browser chat connectors (kick, twitch, youtube, tiktok)
    tools/        generic tool framework (settingTypes, toolContext, …)
    render/       overlay render helpers
  styles/       global CSS
```

## Layers and dependency direction

Dependencies point downward only:

```
pages / app          route entry points
   │
components            overlay renderers + generator UI
   │
features              tool catalogs (compose via features/registry.ts)
   │
lib                   connectors, framework, server helpers, shared logic
```

`features` may import `lib`; `lib` never imports `features`. The tool framework
(`lib/tools`) holds only generic pieces; the two concrete tool catalogs and
their composition root (`registry.ts`) live in `features/`, so the framework
never depends on a specific tool.

## Enforced boundaries

Three boundaries are load-bearing and enforced by
`tests/integration/importBoundaries.test.ts` (a static import-string check, run
as part of `npm test`):

1. **`lib/server` is server-only.** No component, feature, or client-rendered
   page may import it. A client import would risk pulling a secret (token
   encryption key, Supabase service key, OAuth client secret) into a browser
   bundle. API routes under `pages/api` and `app/api` are server-executed and
   may import it freely.

2. **The OBS overlay stays minimal.** `components/overlay` (the two renderers an
   OBS browser source loads) must not import the generator UI
   (`components/classic`) or the feature preview simulators. Those exist only to
   power the generator page and must not inflate the overlay bundle.

3. **The Viewer Counter never reaches the Twitch pin path.** The counter feature,
   its renderer, and the `/counter` page must not import `twitchPinPoller` or
   `twitchPinClient`.

A fourth guard keeps the two features (`multichat`, `counter`) from importing
each other directly — they compose only through `features/registry.ts`.

Each guard is mutation-checked: a deliberately-introduced violating import makes
the corresponding test fail, so the guards cannot pass vacuously.

## Routing invariant

`/multichat` **with a channel parameter** is the overlay OBS loads and must never
redirect — those URLs live in scene collections nobody edits. A channel-less
visit is the canonical generator. See `CLAUDE.md` and `src/lib/multichatRouting.ts`.

## Related docs

- [DEPLOY.md](DEPLOY.md) — VPS deploy, Caddy, environment variables, Supabase schema
- [TESTING.md](TESTING.md) — how the test suite is organized and run
- [PRIVACY.md](PRIVACY.md) — what data the app stores and how tokens are handled
- [../README.md](../README.md) — features, routes, commands
- [../CLAUDE.md](../CLAUDE.md) — invariants for anyone editing the code
