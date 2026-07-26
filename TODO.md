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

## 8. Viewer Counter

### Baseline that already existed before this batch

- [x] `/counter` standalone overlay page reachable as an OBS browser source.
- [x] `/api/viewers` server route for Twitch, YouTube, and TikTok counts.
- [x] Kick counts fetched browser-side (its API blocks server IPs).
- [x] Generator counter tab at `/multichat?tab=counter`, auto-opened from the homepage card.
- [x] Permanent Copy action — the counter tab never had a separate Generate step.
- [x] Combined-total and per-platform layouts, platform icons, pill background, shadow/stroke controls.

### Shipped in this batch

- [x] `components/ViewerCounterDisplay.tsx` — single shared renderer used by both the overlay and the generator preview, ending the duplicated presentation logic.
- [x] `lib/viewerCounterConfig.ts` — shared parameter types, defaults, enums, validation, URL serialization, and the availability model.
- [x] `CounterPreview` reduced to a thin live-preview wrapper: it embeds the real same-origin `/counter` route in an iframe using the exact URL the Copy button provides. No synthetic counts, no drift timers, no duplicated platform logic.
- [x] Four-state availability model (offline / live / live-unknown / unavailable) so an undeterminable count is never displayed or summed as zero.
- [x] Bounded 60s stale window: a failed refresh retains the last good value, then drops it.
- [x] YouTube `originalViewCount` fallback removed — it is cumulative views, not concurrent viewers. Live-but-unparseable now reports live/unknown.
- [x] Non-overlapping polling: the next poll is scheduled only after the previous one settles, with one `AbortController` per cycle aborted on unmount and on channel change.
- [x] Polling keyed on a stable primitive channel key, so restyling never restarts polling.
- [x] API cache TTL lowered from 12s to 8s, below the 10s client cadence, plus process-local in-flight Promise coalescing with generation-safe cleanup.
- [x] Bounded per-source upstream timeouts.
- [x] Dead `metric` parameter and unused `peak`/`sum`/`samples` state removed, along with the header comment that claimed average/peak support.
- [x] New generator control: alignment — backward compatible.
- [x] Process-local cache bounded to 500 entries with least-recently-written eviction; a refresh moves its key to the newest position.
- [x] Preview shows real viewer data: because it embeds `/counter`, it inherits the live counts, the availability model, the 10s cadence, and the offline behaviour exactly. Live-but-unknown shows an em dash; confirmed-offline platforms are absent; no channels renders no iframe at all.
- [x] Preview URL changes debounced by 350 ms with cleanup on every change and on unmount, so typing a channel reloads the iframe once at the pause rather than on every keystroke.
- [x] Font-face rules live in the shared renderer so the overlay and preview load the same face, declared at its real source weight (DejaVuSans-Bold 700).
- [x] Counter controls kept: configured platform channels, combined vs per-platform, platform icons, pill background, alignment, text shadow, stroke.
- [x] Shadow and stroke moved onto counter-specific state, read only from the counter query/config. They no longer share MultiChat's shadow and stroke state, so restyling chat cannot change a generated counter URL.

The counter has a fixed font (DejaVu Sans Bold), fixed size (34 px), and fixed
weight (700) — deliberately not configurable. Typography is independent of the
MultiChat overlay so restyling chat never affects an already generated counter
URL. A font-weight control was built and then removed before commit: only one
weight file exists per family, so the selector could not represent real distinct
weights. `font`, `textSize`, `label`, `showLabel`, and `weight` query parameters
from older builds are harmlessly ignored.

### Generator workspace — batch 1 (implemented, browser testing outstanding)

Additive only. `/multichat`, `/counter`, the existing Viewer Counter generator
tab, and every already-copied overlay URL are untouched, and nothing redirects
to the new route.

- [x] `/tools/counter` — three-column workspace: tool navigation, catalog-driven appearance settings, and a live preview column holding channel inputs and the overlay URL.
- [x] `lib/tools/settingTypes.ts` — setting descriptor types. Toggle and select only; colour, slider, number, and multi-select are not implemented.
- [x] `lib/tools/registry.ts` + `lib/tools/counter/{config,settings}.ts` — tool descriptor and the Viewer Counter control catalog. `lib/viewerCounterConfig.ts` remains the authoritative implementation; the descriptor calls its serializer, so workspace and existing-generator URLs are identical for the same inputs.
- [x] `components/workspace/OverlayPreviewFrame.tsx` — one shared preview implementation. `CounterPreview` is now a thin wrapper around it with unchanged behaviour.
- [x] One derived URL string feeds the preview iframe, the readonly URL field, Copy, and Open. The workspace never writes to the address bar.
- [x] Preview-background selector (transparent / dark / light) as workspace-only state: applied to the container that wraps the iframe, never added to the URL, never injected into the overlay document.
- [x] Copy and Open stay visible when unconfigured and explain why in an inline live region instead of copying a channel-less URL or firing `alert()`.
- [x] Vitest + jsdom + React Testing Library, `npm test` / `npm run test:watch`, 70 unit tests across config, catalog, channel detection, and preview debounce/teardown.

Deliberately not in this batch: no `postMessage` protocol (an appearance change
navigates the iframe), no test-message composer, no overlay-to-parent status
protocol, no hidden settings, no feature flag, no paste-link channel
extraction, no design-gallery route, no MultiChat migration, and no MultiChat
parser tests — those arrive when that parser is extracted.

- [ ] Manual browser verification of `/tools/counter` at 1920 / 1024 / 375 px.
- [ ] Manual keyboard and screen-reader pass on the workspace; no automated accessibility tooling is installed, so axe/CI accessibility checks remain outstanding.
- [ ] Manual confirmation that leaving `/tools/counter` stops the preview overlay's polling.

### MultiChat migration — batch 1: config extraction (implemented)

Behaviour-preserving refactor only. No route, visual, overlay, generator
control, OAuth, or Twitch-pin change. Every already-copied overlay URL parses
and renders exactly as before.

- [x] `lib/multichatConfig.ts` — the authoritative MultiChat parser and
      serializer. The zod schema moved verbatim out of `pages/multichat.tsx`,
      and the `URLSearchParams` assembly moved verbatim out of
      `components/LandingPage.tsx`.
- [x] **Two deliberately separate default sets, not reconciled.**
      `MULTICHAT_OVERLAY_DEFAULTS` is what an omitted parameter resolves to on
      a `/multichat` URL — `textShadow` is `large` there, and changing it would
      restyle existing overlay URLs. `MULTICHAT_GENERATOR_DEFAULTS` is where
      the generator's controls begin — `textShadow` is `small` there. The
      generator always writes the parameter explicitly, so the two never have
      to agree. Neither value is a bug and neither was changed.
- [x] Preserved exactly: every parameter, enum, numeric alias
      (`textSize` 1–3, `textShadow` 1–4, `animation` 1–3, `stroke` 1–5,
      `font` 1–12), boolean coercion, `parseInt` fade and `parseFloat`
      emoteScale semantics, bare-hex colour handling, `pinPlatforms`
      absent/empty/partial distinction, array-valued parameter rejection,
      unknown-key stripping, and overlay-versus-generator mode detection.
- [x] Preserved serializer quirks, deliberately not cleaned up: `kick` keeps a
      leading `@` while the other three strip it, a channel-less state emits
      the `kick=yourchannel` placeholder, `hideNames` is always emitted,
      `pinPlatforms` is omitted at all four and empty at none, and parameter
      order and percent-encoding are unchanged.
- [x] `LandingPage` now delegates to `buildMultichatQuery`. Its state
      declarations, initial values, controls, preview, Viewer Counter tab,
      OAuth fragment handling, connect/disconnect behaviour, styling, and
      layout are untouched.
- [x] `ChatOverlay` imports `MultichatConfig` from `lib/multichatConfig.ts`
      instead of a type from `pages/multichat.tsx`, and the config intersection
      cast plus the four `(cfg as any)` configuration reads are gone.
- [x] `pages/multichat.tsx` no longer owns a schema; `OverlayConfig` remains
      exported as an alias of `MultichatConfig`.
- [x] 105 unit tests in `tests/unit/multichatConfig.test.ts`, with every
      expected value captured from the pre-extraction implementation at
      `3e111a3` via a throwaway read-only harness and embedded as literals, so
      the suite can genuinely fail. Serialized URLs are asserted as complete
      strings, since order and encoding are part of the compatibility surface.

Compatibility-only parameters, still parsed and read by no runtime code:
`ttsEnabled`, `showAvatars`, `showSystemMsgs`, `showRedeems`. No controls were
added for them and none were removed.

- [ ] Manual browser and OBS confirmation that legacy overlay URLs render
      identically to pre-batch screenshots.

### MultiChat migration — batch 2: generic setting control types (implemented)

`Setting` is now a six-member union: the original `toggle` and `select`, plus
`text`, `color`, `number`, and `multiselect`. Each is generic — no MultiChat
field names, no CSV or bitmask encoding, no colour normalization, no
serialization. `SettingRow` renders all six through an exhaustive switch with a
compile-time `never` branch, and `SettingsList` threads the widened value union
into rows.

- [x] `components/ui/inputs/ColorInput.tsx` — text value plus native swatch, no
      third-party picker, value passed through verbatim.
- [x] `components/ui/inputs/NumberInput.tsx` — finite numbers only, never NaN,
      unit rendered as linked text rather than folded into the value.
- [x] `components/ui/inputs/MultiSelect.tsx` — native checkboxes, each with its
      own label; emitted subsets deduplicated and ordered by declaration.
- [x] Static `disabled` / `disabledReason` on the descriptor base, applied via a
      `display: contents` `<fieldset disabled>` wrapper that only renders when a
      setting declares it.

Not done here, deliberately:

- No MultiChat control catalog and no `/tools/multichat` route.
- No `ToolContext` and no contextual `enabledWhen` predicate. `disabled` is a
  static declaration only; OAuth-aware and sibling-dependent enabling belongs to
  batch 3.
- `/tools/counter` is still the only registered workspace tool, still exactly six
  toggle/select settings, and its markup, defaults, and overlay URLs are
  unchanged.

The whole setting pipeline carries all six value shapes:

```
SettingRow → SettingsList → ToolConfigPanel → GeneratorWorkspace → tool.normalize
```

Every layer's change callback is `(key: keyof S & string, next: SettingValue) => void`
where `SettingValue = boolean | string | number | readonly string[]`. A number
arrives as a number and a multi-select as a `readonly string[]`; nothing is
stringified, CSV-encoded, or guarded away in the generic layer. Turning a value
into a query parameter stays with each tool's own serializer.

- [x] `text` rows use a stacked layout because `TextInput` owns its own
      `<label for>`. `TextInput` gained one optional `describedBy` prop so the
      row's description and disabled reason link to the field; no other change
      to it.

- [ ] Manual browser confirmation of the new controls at 1920 / 1024 / 375 px.

### MultiChat migration — batch 3: shell generalization (implemented)

Infrastructure only. Viewer Counter is still the only registered tool, no new
route exists, and no MultiChat behaviour was added.

- [x] Registry holds many tools. A registered entry hides its descriptor's style
      and platform type parameters behind `use`, because a plain union of
      `OverlayTool<A, PA> | OverlayTool<B, PB>` stops inferring once a second
      tool joins — `normalize` and `serialize` are contravariant. The route
      therefore needs no per-tool branch when batch 4 registers MultiChat. No
      `any`, no cast.
- [x] `TOOL_IDS` drives `getStaticPaths`; `findTool` returns `undefined` for an
      unknown id, so `/tools/unknown` is still a real 404.
- [x] Platform metadata moved onto the descriptor as `ToolPlatform<P>`: key,
      label, placeholder, normalizer, invalid message. `ChannelPanel` has no
      platform list, no counter import, and no platform names in it.
- [x] Channel state is keyed by the tool's own `P`, so one tool's channels
      cannot be indexed with another tool's platform.
- [x] `lib/tools/toolContext.ts` — an optional `ToolContext` with one optional
      `fragment` field, plus `buildOverlayUrl`, the single place a workspace URL
      is derived. A fragment is normalized to exactly one `#`, an empty one
      emits none, and it is always placed after the query. Nothing here names a
      platform, a provider, or a login concept.
- [x] Counter declares no `context`, so its URL is byte-identical to the old
      concatenation — asserted against `buildViewerCounterQuery` directly.

Counter platform order is `PLATFORM_ORDER` — Twitch, **YouTube, Kick**, TikTok —
derived from `lib/viewerCounterConfig` rather than restated, so display,
serialization, and poll-key order cannot drift. The batch 3 brief listed
Twitch/Kick/YouTube/TikTok; that is not the order the shipped panel has ever
rendered, and preserving current behaviour won.

Not done here, deliberately: no `multichatTool`, no `lib/tools/multichat/**`, no
`/tools/multichat`, no connect/disconnect UI, no fragment parsing, no OAuth
route change, and no `enabledWhen` or dynamic catalog predicate.

- [ ] Manual browser confirmation of `/tools/counter` at 1920 / 1024 / 375 px.

### MultiChat migration — remaining batches (not started)

Nothing below is implemented, and `/tools/multichat` does not exist.
- [ ] Batch 4 — register the MultiChat tool descriptor and control catalog,
      including its platform definitions and its own setting catalog. Still
      pending: nothing about MultiChat is modelled yet.
- [ ] Batch 5 — ship the `/tools/multichat` workspace, including the
      real-overlay iframe preview, the Twitch connect/disconnect panel, and
      whatever OAuth-derived value it supplies through the tool context. Still
      pending: the context added in batch 3 is generic and carries nothing.
- [ ] Batch 6 — route consolidation: forward channel-less `/multichat` visits,
      repoint the OAuth return, update homepage and nav links, and retire the
      legacy generator. `/multichat` stays a working overlay route permanently.

### Verification still outstanding

- [ ] Manual OBS transparent browser-source test at narrow and wide dimensions.
- [ ] Manual multi-platform combined-total test against per-platform mode with real live channels.
- [ ] Manual cleanup/reconnect test confirming no requests continue after navigating away.
- [ ] Manual confirmation that a live YouTube stream with an unparseable count shows the unavailable marker rather than a number.

### Known limitations

- The generator preview is a real `/counter` instance, so it polls the platform APIs like any overlay. An open Counter tab counts as one additional viewer-count consumer, and the preview is empty whenever every configured channel is offline.
- `/api/viewers` deduplication and caching are process-local. Multiple serverless instances or machines each keep their own cache; nothing is shared or distributed.

## 9. Explicitly out of scope — not started, not claimed

None of the following were touched, and none are shipped:

- Native Twitch subscriber / moderator / VIP / broadcaster badges (tracked in section 2).
- Native Twitch emote-fragment rendering (tracked in section 2).
- The App Router versus Pages Router migration decision (tracked in section 5).
- Applying the Supabase schema SQL — documented, but a manual human step (section 4).
- MultiWidget Alerts — not started.
- TikTok features beyond the dedup note (section 7), homepage/navigation redesign, and unrelated responsive-layout work. Not tracked as roadmap items anywhere in the repository; listed only to record that neither the Twitch nor the Viewer Counter work addressed them.
