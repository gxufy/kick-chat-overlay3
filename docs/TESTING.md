# Testing

The suite runs on [Vitest](https://vitest.dev) in a jsdom environment. Config is
`vitest.config.ts`; the `@` alias resolves to `src/` there exactly as in
`tsconfig.json`, so tests import application code the same way the app does.

## Running

```bash
npm test          # run everything once
npm run test:watch # re-run on change
npm run typecheck  # tsc --noEmit, no test run
npm run check      # typecheck + test, the pre-push gate
```

## Layout

```
tests/
  unit/          co-located-by-topic unit and component tests
  integration/   cross-cutting guards (e.g. import boundaries)
```

Both directories are picked up by the `include` glob in `vitest.config.ts`.

## What the tests protect

Most tests pin behaviour a refactor could silently break: URL serialization,
command dispatch and access levels, the preview simulators, OAuth config
resolution, and overlay rendering. A recurring pattern is the **source-text
guard** — a test that reads a source file and asserts a property of its text
(no `rel="stylesheet"`, no forbidden import) because that is the only thing that
catches a regression reintroduced by a future edit.

`tests/integration/importBoundaries.test.ts` is the architectural guard: it
enforces the layer boundaries described in [ARCHITECTURE.md](ARCHITECTURE.md).
Each of its checks is mutation-verified, meaning a deliberately-introduced
violating import has been confirmed to make it fail — the guard cannot pass
vacuously.

## Adding tests

- Put a focused unit or component test in `tests/unit/`, named `<topic>.test.ts(x)`.
- Put a cross-cutting or structural guard in `tests/integration/`.
- When a test asserts against source text by path, remember it couples to that
  path: if you move the file, update the test. Prefer the `@` alias for module
  imports so a move needs no test edit.
