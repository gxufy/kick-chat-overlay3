# TODO.md

## 1. Twitch native pin polling (next implementation)

- [ ] Add `lib/twitchPinPoller.ts` — wraps `fetchTwitchChannelPin` in a poll interval with a single in-flight request, `AbortController` on stop, and backoff that backs off on `lookup-failed` and stops permanently on `invalid-request` / `channel-not-found`.
- [ ] Update `pages/multichat.tsx`: read `twitchConnectionId` from the URL hash, add `'twitch'` to the `pinPlatforms` whitelist, start the poller inside the existing `useEffect` cleanup array, map `TwitchPinApiMessage` to `PinnedState`.
- [ ] Update `components/LandingPage.tsx` line 638: revise the tooltip that says Twitch pins are not supported.

**Baseline check before building the poller:** POST once to `/api/twitch/pins` with a real `connectionId` (from a Connect flow on your own channel, with a message pinned). A 200 with a populated `pin` confirms the full server chain works.

## 2. Documentation and schema (later)

- [ ] Document the `twitch_connections` Supabase table schema in `DEPLOY.md` (columns, types, constraints, RLS policy, indexes).
- [ ] Document all required environment variables in `DEPLOY.md`: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_REDIRECT_URI`, `TWITCH_TOKEN_ENCRYPTION_KEY`.
- [ ] Commit a migration SQL file for `twitch_connections`.

## 3. App Router / Pages Router consistency (later)

- [ ] Decide whether `app/api/twitch/pins/route.ts` should be ported to `pages/api/` as a `NextApiHandler`, or stay as the sole App Router route. Document the decision.

## 4. Connection lifecycle (later)

- [ ] Add a disconnect / revoke path. `revoked_at` is read as a filter in `twitchConnectionReader.ts` but nothing ever sets it. No UI exists to disconnect a Twitch account.

## 5. Pre-existing (unrelated to Twitch pins)

- [ ] Deduplicate TikTok server connections per channel (noted in `DEPLOY.md`).
