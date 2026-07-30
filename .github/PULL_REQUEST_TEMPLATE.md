## Summary

What this change does and why.

## Changes

-

## Testing

- [ ] `npm run check` passes (typecheck + full test suite)
- [ ] `npm run build` succeeds
- [ ] Added or updated tests for the change

## Checklist

- [ ] No `src/lib/server/**` import from client code (components, features, or
      client pages) — enforced by `tests/integration/importBoundaries.test.ts`
- [ ] No new App Router files without an explicit reason (Pages Router is the
      default; see `CLAUDE.md`)
- [ ] Channel-carrying `/multichat` and `/counter` behaviour is unchanged
      (those URLs are permanent in viewers' scene collections)
- [ ] No secrets, tokens, or `.env` values committed or logged
