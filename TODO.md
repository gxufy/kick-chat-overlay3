# TODO.md

## 1. Twitch native pin polling (shipped)

- [x] Add `lib/twitchPinPoller.ts` — wraps `fetchTwitchChannelPin` in a poll interval with a single in-flight request, `AbortController` on stop, and backoff that backs off on `lookup-failed` and stops permanently on `invalid-request` / `channel-not-found`.
- [x] Update `pages/multichat.tsx`: read `twitchConnectionId` from the URL hash, add `'twitch'` to the `pinPlatforms` whitelist, start the poller inside the existing `useEffect` cleanup array, map `TwitchPinApiMessage` to `PinnedState`.
- [x] Update `components/LandingPage.tsx`: Twitch pin controls plus a corrected tooltip (the old "not supported" wording is gone; the disabled state now explains that a connected, matching Twitch account is required).

**Baseline API checks — both completed.** POST to `/api/twitch/pins` with a real `connectionId`:

- [x] `pin: null` returned successfully for a channel with nothing pinned.
- [x] Populated real `pin` returned successfully with a message pinned.

### Verified end to end (browser)

- [x] The OAuth connection fragment reaches the overlay.
- [x] A populated native Twitch pin appears.
- [x] `pin: null` clears the Twitch pin this poller owns.
- [x] Unchanged pins do not reappear on every poll.
- [x] The same message can appear again after a confirmed unpin.
- [x] Different pinned messages appear correctly.
- [x] Cross-platform ownership-safe clearing remains intact (a Twitch null does not clear a Kick pin).

### Shipped enhancements

- [x] Five-second successful polling cadence (`TWITCH_PIN_INTERVAL_MS`, the poller's own `MIN_INTERVAL_MS` floor).
- [x] Twitch pin-author `senderUserId` plumbed through the server parser, `/api/twitch/pins`, `TwitchPinApiMessage`, `toUnifiedTwitchPin`, and `UnifiedMessage.senderId`.
- [x] 7TV emote word substitution in pinned messages.
- [x] 7TV paint for pin authors, via the existing cosmetics fetcher and entitlement store.
- [x] 7TV badge for pin authors, via the same path.
- [x] Native Twitch username color, resolved server-side through Helix `GET /chat/color`.
- [x] Process-local username-color cache (10-minute positive TTL, 30-second negative cache, 500-entry oldest-first eviction) with per-sender in-flight request deduplication.

## 2. Twitch pin work still unfinished

- [ ] Native Twitch subscriber / moderator / VIP / broadcaster badges on pinned messages. The pins API payload carries no badge assignments, so this needs a separate source.
- [ ] Native Twitch emote-fragment rendering in pinned messages. The payload carries no emote offsets; only 7TV word substitution works today.

**Known limitation, not a defect.** If the first username-color lookup for an author fails, the unchanged-pin dedupe guard prevents a later successful poll from repainting that pin, and the banner has hidden by then. The pin still renders with the deterministic `fallbackColor`.

## 3. Twitch disconnect and revocation (shipped)

- [x] `POST /api/twitch/oauth/disconnect` — Pages Router endpoint, JSON only, opaque errors, idempotent, no id-enumeration oracle.
- [x] `lib/server/twitchConnectionRevoker.ts` — sets `revoked_at` and `updated_at` in one atomic update/select. Never deletes the row.
- [x] `lib/server/twitchTokenRevocation.ts` — best-effort `POST https://id.twitch.tv/oauth2/revoke`, 2s timeout, HTTP 200 only counts as success.
- [x] Best-effort clearing of the encrypted token columns after revocation, isolated so it cannot abort the revocation.
- [x] Generator Disconnect control with a pending state, visible even when the typed channel no longer matches the connected account.
- [x] `isTwitchConnectionActive` liveness probe plus pin-route classification, so an overlay left open on a disconnected connection stops polling instead of retrying forever.
- [x] Confirmed by inspection that every reader and the token updater filter `revoked_at IS NULL`, so a refresh cannot reactivate a revoked row.

## 4. Documentation and schema (shipped)

- [x] Document the `twitch_connections` Supabase table schema in `DEPLOY.md` (columns, types, constraints, RLS expectations, indexes).
- [x] Document all required environment variables in `DEPLOY.md`: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_REDIRECT_URI`, `TWITCH_TOKEN_ENCRYPTION_KEY`. Names and formats only, no values.
- [x] Document the encryption-key format and generation command, the OAuth callback URLs for local and production, the required scope, deployment order, and build/verification commands.
- [x] Idempotent schema SQL recorded in `DEPLOY.md` instead of a migration file — no migration tooling exists in this repository and none was introduced for this batch.

**Still manual.** Applying the schema SQL in the Supabase console is a human step; there is no automated migration path.

## 5. App Router / Pages Router consistency (later)

- [ ] Decide whether `app/api/twitch/pins/route.ts` should be ported to `pages/api/` as a `NextApiHandler`, or stay as the sole App Router route. Document the decision.

The disconnect batch did **not** settle this. `disconnect.ts` was written as a
Pages Router handler per `CLAUDE.md`, and no existing route was migrated.

## 6. Connection lifecycle (remaining)

- [ ] Persist the generator's connected-account state across a browser refresh. `twitchConnId` lives in React state only, so reloading the generator forgets the connection (the row stays active and the overlay URL keeps working).
- [ ] Surface a clear overlay-side signal when a connection has been disconnected. Today the Twitch poller simply stops.

## 7. Pre-existing (unrelated to Twitch pins)

- [ ] Deduplicate TikTok server connections per channel (noted in `DEPLOY.md`).

## 8. Explicitly out of scope — not started, not claimed

None of the following were touched, and none are shipped:

- Native Twitch subscriber / moderator / VIP / broadcaster badges (tracked in section 2).
- Native Twitch emote-fragment rendering (tracked in section 2).
- The App Router versus Pages Router migration decision (tracked in section 5).
- Applying the Supabase schema SQL — documented, but a manual human step (section 4).
- Viewer counter, TikTok features beyond the dedup note, preview parity, responsive layout, and homepage/navigation work. Not tracked as roadmap items anywhere in the repository; listed only to record that the Twitch work did not address them.
