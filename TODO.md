# TODO.md

> **Current shape of the product: section 10, "Original Classic generator revamp",
> with the final layout and audit in section 11.**
> The single generator is the revamped original Classic page, served at a
> channel-less `/multichat`, with the Viewer Counter embedded in it. The `/tools`
> generator pages and the Demo interface are gone.
>
> The "Generator workspace" and "MultiChat migration" batches below are kept as a
> build log of how the underlying pieces — catalogs, descriptors, OAuth, pins,
> fonts — were built and verified. Every one of those pieces is still in use. What
> is superseded is only the *interface* they were built behind: the three-column
> `/tools` workspace, its sidebar navigation, and its demo preview. Where a batch
> calls a `/tools` route canonical, read section 10 instead.

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

### MultiChat migration — batch 4: descriptor and catalog (implemented)

The MultiChat tool was modelled here but not rendered: it was absent from
`TOOLS`, so `/tools/multichat` returned 404. **Batch 5A below registers it**, so
the "deliberately not registered" notes in this section are historical.

- [x] `lib/tools/multichat/config.ts` — a `multichatTool` descriptor matching the
      generalized `OverlayTool<MultichatWorkspaceStyle, MultichatPlatform>`.
      Registered as of batch 5A.
- [x] Defaults are `MULTICHAT_WORKSPACE_DEFAULTS` itself, by reference — no
      second defaults object, and the generator's `textShadow: 'small'` is
      preserved against the overlay's omission default of `'large'`.
- [x] `serialize` delegates to `buildMultichatQuery`. It builds no
      `URLSearchParams` of its own, so parameter order, inclusion rules, and
      encoding stay byte-identical to the URL `/multichat` copies today.
- [x] Platform definitions in generator order — **kick, twitch, youtube,
      tiktok** — with the existing placeholders and the existing `@` asymmetry
      intact: kick is trimmed only and keeps a leading `@`, the other three strip
      theirs. The counter's `normalizeChannel` is deliberately not reused; it
      would add character and length validation MultiChat has never had.
- [x] `lib/tools/multichat/settings.ts` — a 24-entry catalog covering every
      `MultichatWorkspaceStyle` field, with no `platformIcons` entry. Option lists
      come from tuples `lib/multichatConfig` now exports; no enum array is copied.
- [x] `lib/multichatConfig.ts` gained exported enum tuples
      (`MULTICHAT_TEXT_SHADOWS`, `MULTICHAT_TEXT_SIZES`, `MULTICHAT_ANIMATIONS`,
      `MULTICHAT_STROKES`, `MULTICHAT_SOURCE_TAGS`, `MULTICHAT_SOURCE_TAG_ORDER`,
      `MULTICHAT_FONTS`) and now
      derives its legacy numeric aliases from them by index. Parsing and
      serialization behaviour is unchanged — all 105 compatibility tests pass.
- [x] The fade pair stays two fields, `fadeEnabled` (toggle) and `fade` (text),
      because emptiness in `fade` independently suppresses the parameter. They
      share `param: 'fade'` since they describe one parameter.
- [x] `pinPlatforms` is a multiselect over the platform tuple, empty selection
      allowed, CSV encoding left entirely to the serializer. No OAuth gating —
      the Twitch chip's connected-account requirement is batch 5C; batch 5A
      states it in the control's description instead.
- [x] The four unread compatibility-only parameters — `ttsEnabled`,
      `showAvatars`, `showSystemMsgs`, `showRedeems` — receive no controls. They
      remain parse-compatible and listed in `MULTICHAT_UNREAD_PARAMS`.

- [x] `sourceTag` is a four-option select over `icon, dot, label, none`, backed
      by an explicit `MultichatWorkspaceStyle` adapter — `MultichatGeneratorStyle`
      with `platformIcons: boolean` replaced by the full enum. The legacy shape is
      untouched and still what LandingPage holds.
- [x] `MULTICHAT_WORKSPACE_DEFAULTS` is derived from
      `MULTICHAT_GENERATOR_DEFAULTS` by spread, swapping only `platformIcons: true`
      for its meaning, `sourceTag: 'icon'`. No second defaults object, no mutation
      of the generator defaults, and `textShadow` stays `small`.
- [x] `buildMultichatQuery` accepts either shape and remains the only MultiChat
      serializer. `icon` omits the parameter (what `platformIcons: true` always
      did), `none` emits `sourceTag=none` (what `false` always did), and `dot` and
      `label` emit in the same slot. Legacy output is byte-identical; nothing
      post-processes the query string.
- [x] OBS dimensions are `680 × 280`, from the generator's own OBS setup step in
      `components/LandingPage.tsx`.

- [x] Runtime fix — `ChatOverlay` discarded `cfg.sourceTag` whenever fewer than
      two platforms were configured, forcing `'none'`, so `icon`, `dot`, `label`,
      and `none` all rendered identically on a single-platform URL. An explicit
      `sourceTag=` is now always honoured; with the parameter omitted the old
      default stands (one platform → no marker, several → icons). The parser
      defaults the field to `'icon'`, so `pages/multichat.tsx` passes a
      `sourceTagExplicit` flag read from the raw query — without it, every
      existing single-platform overlay would have gained an icon it never had.
- [x] The pin banner followed a hardcoded `tagMode="icon"`; it now follows the
      overlay's mode, so `sourceTag=none` leaves no marker there either.
- [x] Markers carry `data-source-tag` and `data-platform`, and the decorative
      icon and dot are `aria-hidden`. The label's platform name stays readable
      with no duplicating `aria-label`.

- [ ] Batch 4 follow-up — `README.md` recommends `830 × 230` for the same browser
      source while the in-app setup step says `680 × 280`. The descriptor follows
      the in-app value. Decide which is right and make them agree.

### MultiChat migration — batch 5A: route registration (implemented)

`/tools/multichat` is registered, prerendered, and reachable. No OAuth surface
was added, and the existing generator at `/multichat` is untouched.

- [x] `multichatTool` registered in `TOOLS`, first, ahead of the counter.
      `TOOL_IDS` is `['multichat', 'counter']`, so `getStaticPaths` emits both
      and the build prerenders `/tools/multichat` and `/tools/counter`.
      `/tools/unknown` still 404s.
- [x] Real `/multichat` iframe preview, at the descriptor's own 280 px height,
      through the same `OverlayPreviewFrame` the counter uses — same 350 ms
      debounce, same immediate teardown when the last channel clears, no
      `setInterval`, no `Math.random`.
- [x] All 24 catalog controls and all four channel fields operational, in
      catalog and descriptor order. No channel field appears in the centre
      settings panel.
- [x] One derived URL feeds the preview iframe, the readonly field, Copy, and
      Open. Asserted as complete strings against `buildMultichatQuery`, not as
      parsed parameter sets.
- [x] `previewNote` moved onto the descriptor. The caption under the preview was
      counter-specific prose hardcoded in `PreviewViewport`; each tool now
      supplies its own sentence, and the counter's rendered text is unchanged.
- [x] Navigation is MultiChat → MultiChat (Classic) → Viewer Counter. The
      classic entry keeps the existing generator reachable and is relabelled so
      no two entries read "MultiChat".
- [x] `sourceTag` copy now explains the one compatibility asymmetry a user can
      observe: `icon` is the legacy omitted-parameter case, so a single
      configured platform shows no marker. Explaining it was the fix; changing
      the serializer would restyle URLs already in OBS scenes.
- [x] `pinPlatforms` copy states plainly that native Twitch pins need a
      connected account. Twitch is absent from the workspace pin defaults.
      *(Superseded by 5B/5C below: the copy no longer points at MultiChat
      (Classic), because the workspace can now connect Twitch itself.)*

**No OAuth in this batch, deliberately.** There is no connect button, no
disconnect button, no connection status, no connection UUID, no OAuth-start
request, and no fragment parser. `multichatTool.context` remains `undefined`, so
every URL this workspace generates is an ordinary `/multichat` URL with no
fragment — verified by asserting no `#` survives anywhere, including when a user
types `#` into a filter field (it is percent-encoded into the query).
*(Batches 5B and 5C below add OAuth. The unconnected-workspace guarantee is kept
and still tested: with no connection, the generated URL is byte-identical.)*

**Deviation from the batch brief.** The brief called for all six control types to
be exercised. The catalog uses five: `toggle`, `select`, `text`, `color`, and
`multiselect`. `number` is unused because `fade` and `emoteScale` are the only
numeric-looking parameters and both must be `text` — an empty string
independently suppresses the parameter, which a number control cannot express.
Forcing `number` on either would change generated URLs. `number` remains
implemented and tested at the control level from batch 2.

- [ ] Manual browser verification of `/tools/multichat` at 1920 / 1024 / 375 px.
- [ ] Manual keyboard and mobile-overflow pass on the new route. *(Landmark and
      heading structure is now covered by `workspaceAccessibility.test.tsx`; the
      keyboard and horizontal-overflow pass is still manual, and no automated
      accessibility tooling is installed.)*
- [ ] Manual confirmation that leaving `/tools/multichat` stops the preview
      overlay's connections.
- [ ] Manual OBS confirmation of a workspace-generated MultiChat URL at
      680 × 280 and 830 × 230.

### MultiChat migration — batches 5B and 5C (implemented, browser testing outstanding)

OAuth return flow, connection state, and contextual pin gating. Delivered
together because they are one rule with three consequences: whether a connection
is usable decides the option's availability, the pin list's contents, and the
URL fragment. Splitting them would have shipped a connect button that gated
nothing.

- [x] `lib/oauthReturn.ts` — exact-match allowlist of OAuth return destinations.
      The callback previously hardcoded `/multichat`; a destination that survives
      an OAuth round trip is the classic open-redirect shape, so it is compared
      against a fixed set of internal paths rather than parsed or normalized.
      Absolute URLs, protocol-relative paths, encoded hosts, traversal, and
      whitespace-padded variants all fail for the same reason: not in the set.
- [x] The destination is bound at start time into an HttpOnly cookie, never read
      from the callback's own query string, and revalidated on the way out. It
      never travels through Twitch, so a crafted callback URL cannot choose it.
- [x] `lib/server/oauthCookies.ts` — state and return cookies in one place,
      cleared on every callback exit path including the refusals.
- [x] `lib/twitchConnection.ts` — connection id and login validation lifted
      verbatim from the classic generator, so two generators consuming one
      callback cannot disagree. A repeated fragment key refuses the whole
      fragment rather than taking the first value.
- [x] `lib/tools/multichat/runtime.ts` — the gating rule, computed once:
      pins need a connection *and* a Twitch channel naming that same account.
      Polling account A while the overlay reads channel B would show pins that
      never appear on screen.
- [x] `components/workspace/multichat/TwitchConnectionPanel.tsx` — the only
      component that names Twitch. Reaches the shell through the descriptor's
      `runtime.Panel`, so `GeneratorWorkspace`, `LivePreviewPanel`, and the
      settings list still mention no platform and no connection.
- [x] Generic runtime support on the descriptor (`initial`, `Panel`, `sync`,
      `fromChannels`, `optionAvailability`) — the shell stores runtime opaquely
      and never inspects it. The counter declares none and is unchanged.
- [x] The connection id reaches exactly one place: the URL fragment, and only
      when pins are enabled, Twitch is selected, and the account matches. Never
      rendered, never logged, never a query parameter, and stripped from the
      address bar on adoption. Disconnect sends it in a POST body.
- [x] `lib/workspaceStorage.ts` — session-scoped draft so channels and settings
      survive the OAuth navigation, and connection persistence across reloads.
      Both revalidate on read, since anything on the origin can rewrite
      sessionStorage; storage being unavailable degrades the feature, not the page.
- [x] Per-option gating in `MultiSelect`, so one unavailable choice does not
      disable the group. The reason is real text linked by `aria-describedby`,
      not a colour-only signal, and an already-checked unavailable option stays
      operable so a user cannot be stuck with a selection they cannot clear.
- [x] `/classic/multichat` — the original generator at its own stable address, so
      it is not withdrawn in the same change that replaces it. Renders the same
      `LandingPage` component, not a copy.
- [x] 703 tests pass; `tsc --noEmit` clean; production build prerenders
      `/classic/multichat`, `/tools/multichat`, and `/tools/counter`.

- [ ] Manual browser verification of the connect → authorize → return round trip
      against a real Twitch account, including the draft surviving it.
- [ ] Manual confirmation that a workspace-generated URL with a fragment shows
      native Twitch pins in OBS.
- [ ] Manual check that the fragment is absent from server access logs.

### MultiChat migration — batch 6: route consolidation (implemented)

`/tools/multichat` and `/tools/counter` are now the canonical generator routes.
`/multichat` keeps serving the overlay **permanently** — that half was never a
migration step, because the URLs are in OBS scene collections nobody will edit.

- [x] `lib/multichatRouting.ts` — one pure rule for what a `/multichat` visit
      resolves to. A query naming any channel (`channel`, `kick`, `twitch`,
      `youtube`, `tiktok`) is an overlay request and is checked **first**, so it
      wins outright: a scene URL that also carries `tab=counter`, or any other
      generator-shaped parameter, still renders chat. Only a channel-less visit
      forwards, and an empty value (`?kick=`, what an unfilled generator field
      submits) counts as channel-less rather than as a dead overlay.
- [x] `pages/multichat.tsx` — forwards a channel-less visit with `replace` (not
      `push`, so Back does not bounce through the path again) and renders nothing
      while in flight, rather than flashing the old generator first.
      `?tab=counter` forwards to `/tools/counter`, everything else to
      `/tools/multichat`.
- [x] Homepage cards and footer link point at the canonical routes directly, so
      the common path has no redirect hop. The `/?kick=...` → `/multichat`
      overlay forward on the homepage is deliberately **unchanged**.
- [x] `tests/unit/multichatRouting.test.ts` + `legacyMultichatPage.test.tsx` —
      the overlay-compatibility boundary, asserted per channel parameter. Both
      files were mutation-checked: disabling the channel-first rule fails exactly
      the overlay cases.

The legacy generator was **not** retired — it stays reachable at
`/classic/multichat` and listed in the workspace nav as "MultiChat (Classic)".

### MultiChat migration — batch 6 follow-up: hardening (implemented)

- [x] `components/workspace/OverlayUrlBar.tsx` — Copy no longer claims success
      unconditionally. The clipboard write is awaited, and an absent API or a
      rejected write reports the failure and names the recovery ("select the URL
      above and copy it manually"). The field is readonly, so someone told
      "copied" when nothing was had no way to notice until pasting into OBS.
- [x] `components/workspace/GeneratorWorkspace.tsx` — added a `main` landmark and
      the page's only `h1` (visually hidden; the layout has no header bar). Both
      panel headings were `h2`s under no root, so heading navigation started
      partway down a hierarchy.
- [x] `components/workspace/multichat/TwitchConnectionPanel.tsx` — the disconnect
      request is now bounded by a 10 s timeout and aborted on unmount. A hung
      request previously left the button disabled reading "Disconnecting…" for
      the life of the page, making the one action the user asked for unreachable.
- [x] `tests/unit/workspaceAccessibility.test.tsx` and
      `tests/unit/counterRegression.test.tsx` — the latter asserts **absence**:
      the counter declares no runtime, no context, no gated options, renders no
      connection surface, and produces URLs byte-identical to
      `buildViewerCounterQuery` with no fragment. Mutation-checked by bolting a
      runtime onto the counter descriptor; four guards fire.

### MultiChat migration — batch 7: fragment preservation and a11y (implemented)

Release-blocking bug found by self-review of batch 6, plus the gaps a read-only
audit of the finished work turned up.

- [x] **`pages/multichat.tsx` dropped OAuth fragments.** A channel-less visit to
      `/multichat#twitchConnectionId=…&twitch=…` forwarded to `/tools/multichat`
      with the fragment discarded, so a completed authorization was silently
      thrown away and the user sent back through Twitch. The route decision only
      saw `router.query`, and fragments never appear there. It now takes the hash
      as an explicit argument, validates it with the authoritative parser
      (`readConnectionFromFragment`), and rebuilds the fragment from only the two
      recognized fields — so a malformed, duplicate-keyed, or arbitrary hash is
      dropped rather than forwarded, and nothing extra rides along. Channel
      parameters are still checked first, so no OBS overlay URL can be captured.
      A valid fragment outranks `tab=counter`.
- [x] The hash is captured in an effect, not during render (reading
      `window.location` while rendering is a hydration mismatch), and the
      redirect waits for it — redirecting before the hash is known *is* the bug.
      `/multichat` still prerenders as static, confirming no render-time `window`.
- [x] **`lib/oauthReturn.ts` comment was false.** It claimed a return to
      `/multichat` still rendered a generator that read the fragment itself. That
      stopped being true in batch 6. Now documents the actual compatibility path.
- [x] **Unconfirmed pins no longer live forever.** Transient lookup failures are
      retried silently, so an API outage after a pin was displayed left the
      overlay asserting that pin indefinitely — including if the streamer
      unpinned during the outage. A displayed pin is now dropped after 60 s
      without a reachable API. Deliberate trade: a removed pin still showing is
      worse than briefly losing one that is still up, and a live pin returns on
      the next successful poll.
- [x] **`PreviewBackground.tsx` was an incomplete ARIA radiogroup** —
      `role="radio"` buttons promise one tab stop and arrow-key navigation, and
      implemented neither. Replaced with native radio inputs, which get both from
      the platform. Same reasoning as MultiSelect's native checkboxes.
- [x] **No skip link.** The nav lists every tool before the settings, so keyboard
      users re-tabbed the whole list on every visit. Added as the first focusable
      element, targeting `<main tabIndex={-1}>` so focus actually lands.
- [x] **`prefers-reduced-motion` unhandled.** The toggle knob was the only
      element that actually moves; it now uses `motion-reduce:transition-none`.
      Colour fades left alone deliberately — a fade is not motion, and removing
      it would lose feedback without helping anyone.
- [x] `tests/unit/twitchPinPoller.test.ts` (new) — the poll loop had **no tests
      at all**; the page test mocks it away. Covers non-overlapping requests, the
      interval floor, non-finite intervals, the backoff ladder and its 60 s
      ceiling, the fatal-versus-transient split, abort on stop, and that a
      consumer fault cannot be read as a transport failure.
- [x] `tests/unit/twitchPinOwnership.test.ts` (new) — the ownership key is built
      from two independent expressions hundreds of lines apart
      (`` `twitch:${message.id}` `` and `` `${platform}:${id}` ``). A drift fails
      silently by never clearing a pin, so the coupling is pinned by reading the
      real source, following `multichatCommands.test.ts`.
- [x] `tests/unit/homepageRoutes.test.tsx` (new) — the homepage card hrefs and the
      classic route's `noindex` were unasserted. Also pins the homepage's own
      legacy overlay forward, which passes `{pathname, query}` so every parameter
      survives.
- [x] Mutation-checked: reverting the redirect to `route.pathname` fails 4 tests;
      removing the hash gate fails 4. The once-only `replace` ref is **not**
      provable in this environment — the hash gate already serializes Strict
      Mode's double mount, so removing the ref changes nothing observable. Kept
      as insurance and commented as unexercised rather than claimed as covered.

#### Documentation corrections

- [x] `README.md` — "Broadcaster has full access; mods have access to most" was
      false. There is one uniform `getAccessLevel(um) < 500` gate before the
      switch; every command has identical requirements. Also added Twitch to the
      pinned-messages feature line, which read as if Twitch pins did not exist.
- [x] `DEPLOY.md` — "open the generator at `/multichat`" was stale; that path
      serves the overlay. Now names `/tools/multichat` and explains the
      compatibility forward.
- [x] `DEPLOY.md` — the scope note said the connected account may be "the
      broadcaster of, **or a moderator in**," the channel. True of the Twitch
      scope, but `twitchPinsAvailable` requires the typed channel to equal the
      connected login, so a moderator authorizes successfully and then finds the
      option still gated. Documented as the broadcaster-only restriction it is.

- [ ] **A moderator cannot generate a pin-enabled overlay for a channel they
      moderate.** `twitchPinsAvailable` compares the typed channel against the
      connected login, which is right for the broadcaster case and excludes a
      legitimate one Twitch's own scope allows. Fixing it needs a way to confirm
      moderator status for a channel before enabling pins; the server already
      checks `broadcaster.login` on every pins request, so the gate is a UX
      restriction rather than the security boundary.

### MultiChat migration — batch 8: the overlay never loaded its fonts (implemented)

- [x] **`/multichat` shipped no font stylesheet at all.** `ChatOverlay`'s
      `FONT_FAMILIES` maps `font=` to families like `'Open Sans'`, `'Roboto'`, and
      `'Baloo Tammudu 2'`, but naming a family does not load it, and the overlay
      route requested none. Confirmed against the prerendered markup, not by
      reading: `.next/server/pages/multichat.html` contained zero
      `fonts.googleapis.com` references while `classic/multichat.html` contained
      two. So nine of the twelve font options rendered as generic sans-serif in
      OBS — including `opensans`, which is `MULTICHAT_GENERATOR_DEFAULTS.font`,
      making the default the broken case. The classic generator loads these faces
      for its own UI, so its inline preview showed the real font and the overlay
      did not: the preview and the overlay disagreed about what a URL renders as.
- [x] `lib/overlayFonts.ts` (new) — the one place a `font=` value maps to the face
      it needs. Specs are copied verbatim from the stylesheet the generator page
      already requests, so a face renders identically in both. Only the selected
      family is fetched, not a combined sheet of all nine.
- [x] Three keys deliberately need no stylesheet, each for a different reason, and
      each is asserted individually rather than silently omitted: `default`
      resolves to `inherit`, `segoe` and `impact` are system faces, and `alsina`
      is self-hosted through the `@font-face` ChatOverlay already emits.
- [x] `preconnect` to both font origins, emitted only when a stylesheet is, plus
      `display=swap` so text stays visible while the face loads.
- [x] No URL, parameter, or default changed. An existing OBS source now renders
      the font its URL already asked for; nothing needs regenerating.
- [x] `tests/unit/overlayFonts.test.ts` (new) — reads `FONT_FAMILIES` out of
      `components/ChatOverlay.tsx` and asserts every family has either a spec or a
      stated exemption, following `multichatCommands.test.ts`. A hardcoded list
      would drift the moment a font is added; reading the source cannot.
- [x] `tests/unit/overlayFontLink.test.tsx` (new) — renders the real overlay and
      asserts the emitted links. `next/head` is mocked to render children inline:
      in jsdom the real one flushes asynchronously, so asserting on
      `document.head` returns an empty list for *every* font, which would make the
      negative cases pass vacuously with the feature entirely removed. Noted in
      the file so the boundary is not mistaken for laziness.
- [x] Mutation-checked in both directions. Removing the `opensans` spec fails 3;
      removing the `<link>` fails 1; pinning `fontHref` to null fails 4; making
      every font emit a sheet fails 6, which is what proves the negative cases are
      not vacuous.

### MultiChat migration — batch 9: undefined Counter URL parameters (implemented)

- [x] **`buildViewerCounterQuery` serialized missing fields as the literal string
      `undefined`.** A real request was observed in a development log:
      `/counter?kick=iceposeidon&combined=undefined&icons=undefined&bg=undefined&textShadow=small&stroke=none&align=undefined`.
      The serializer reproduces that byte for byte, in that exact parameter order,
      from a style missing four fields — the three booleans go through `String()`,
      and `align` passes its `!== DEFAULT_STYLE.align` guard because
      `undefined !== 'left'`. `textShadow` and `stroke` look correct in the
      evidence precisely because they were the two fields present.
- [x] **Not cosmetic.** `parseViewerCounterConfig` reads booleans with
      `boolTrueDefault`, which is `!== 'false'`, so `combined=undefined` parses
      back as **true**. Someone who switched Combined off and copied the URL got
      one that reads as on, with nothing indicating the setting was dropped.
- [x] Fixed at the authoritative boundary: the serializer now normalizes its input
      before emitting, and its parameter type is `Partial<ViewerCounterStyle>` so
      the signature matches what can actually reach it rather than asserting a
      completeness nothing enforced. Normalizing a complete style is a no-op, so
      every existing caller and every already-copied URL serializes identically.
- [x] `normalizeCounterStyle` moved from `lib/tools/counter/config.ts` into
      `lib/viewerCounterConfig.ts` — the serializer cannot import from the tool
      descriptor without a cycle. Re-exported from its old home, so import sites
      and existing tests are unchanged and there is still exactly one set of
      fallbacks rather than a second copy beside the serializer.
- [x] **The current page path could not reproduce it.** `GeneratorWorkspace`
      initializes from `tool.defaults` and routes every change through
      `tool.normalize`, so the live workspace always supplied a complete style,
      and neither committed `LandingPage` revision built a partial one. The
      likely historical source is the era before shadow and stroke were split
      onto counter-specific state, when the counter query was assembled from a
      raw object literal mixing MultiChat's shared `textShadow`/`stroke` with
      counter fields — the exact present/absent split the evidence shows. The
      runtime evidence is not dismissed: it is reproduced as a fixture and
      asserted against, and the defect it proves — an undefended serializer —
      was real regardless of which caller supplied the partial style.
- [x] `tests/unit/counterUndefinedUrl.test.tsx` (new) — page-level, through the
      real shell and the real descriptor, not the serializer alone. Covers the
      initial unconfigured render, entering only a Kick channel, the immediate
      pre-debounce URL, the debounced iframe `src`, a MultiChat→Counter route
      switch, a foreign draft restored from `sessionStorage`, first paint versus
      post-effect state, the clipboard and `window.open` arguments, every
      keystroke of a channel name, and a sweep of every toggle and every option of
      every select. Each asserts the URL contains no `=undefined`, `undefined&`,
      `?undefined`, and no bare `undefined` anywhere.
- [x] The evidence string is itself asserted to be what the pre-fix code produced,
      so the fixture cannot silently drift away from the bug it represents.
- [x] Mutation-checked. Reverting the normalization fails 1 test; combining it with
      partial `tool.defaults` — a plausible future refactor — fails 11, which is
      what shows the page-level tests guard the boundary rather than restating the
      serializer test. With the fix in place, partial defaults pass all 14, so the
      serializer is a sufficient defense on its own.

### MultiChat migration — batch 10: demo preview and card design language (implemented)

- [x] **The workspace could not show what a setting did.** The preview only ever
      embedded the real overlay, which is correctly empty when no configured
      channel is live. Every appearance setting was therefore unverifiable until
      you went live, and this was the largest remaining gap against the classic
      generator, whose preview always rendered something.
- [x] **Demo mode** renders the production `ChatOverlay` over fixed sample
      messages. It is the real renderer, not a mock-up, so appearance behaves
      exactly as it will in OBS. Its config is round-tripped through
      `parseMultichatConfig` — the overlay route's own parser — so the demo cannot
      drift from the route it previews.
- [x] Exactly one mode is mounted. Leaving the Live iframe mounted behind the demo
      would keep a real overlay connected and polling while off screen.
- [x] **Message creator** composes a message with a chosen platform, name, text,
      and badges. Ids derive from a counter, not a clock, so output is
      deterministic.
- [x] **Command simulator** derives its list from `MULTICHAT_COMMANDS`, so it
      cannot document a command the overlay does not implement. Buttons appear only
      for the four commands whose effect it can genuinely reproduce (`hide`,
      `show`, `ping`, `stop`); the rest are listed with an explicit statement that
      they are not being faked, rather than pretending to reload a source or play a
      video.
- [x] `hide` sets `display:none` on the container, matching `setChatVisible` in
      `pages/multichat.tsx`. An earlier attempt emptied the message list instead,
      which was wrong twice over: it misrepresents the command, and `ChatOverlay`
      tracks the ids it has already batched, so a removed message never returns —
      `hide` was permanent and `show` a no-op. Caught by test.
- [x] **No demo state can reach the overlay URL.** Six tests assert the URL is
      byte-identical across entering demo mode, toggling sample groups, composing a
      message, and running a simulated command.
- [x] **Card design language.** `components/workspace/Card.tsx` plus the brand
      chips and accent section headings ported from the classic generator. Applied
      to every panel; `SettingsList` moves to `ws-raised` so it does not flatten
      into the card it now sits inside.
- [x] Platform chip colours are asserted equal to the overlay's own `PROVIDERS`
      values, so the two copies of the four brand colours cannot drift.
      Mutation-checked: drifting `ws-kick` fails the test.
- [x] **Three defects this batch introduced, all caught by tests, all fixed.** A
      duplicate accessible name — the "Overlay URL" card heading collided with the
      field's own label, so `getByLabelText` matched two elements; the card is now
      "OBS browser source", which also says what the URL is for. A decorative chip
      repeating the platform name as a second DOM node; the label itself is now
      styled as the chip, keeping one accessible name per field. And
      `role="radio"` buttons for the mode switch, where this codebase uses native
      inputs — rewritten as a native radio group.
- [x] The background-picker accessibility tests queried every radio on the page
      while naming one group. Scoped to the group each names, since a second
      radiogroup now exists, and the new switch is held to the same assertions
      rather than excluded from them.
- [x] `PreviewBackgroundId` moved to `lib/tools/previewBackground` so the registry
      can type a demo panel's `background` as that union instead of `string`,
      without `lib` importing a type from `components`.
- [x] 88 new tests (982 total, all passing). Typecheck and production build clean.

**Setting parity with the classic generator is exact:** MultiChat 24/24, Viewer
Counter 6/6. The classic's `pinOpacity` is not a missing setting — it is a local
preview animation that never reaches the URL.

#### Accessibility pass over the new surfaces (implemented)

- [x] **Sample-group toggles were focusable with no visible focus.** The `sr-only`
      checkbox was nested inside its label, and Tailwind's `peer` only matches a
      *following sibling*, so `peer-focus-visible` never applied — a keyboard user
      tabbing through the chips could not see which one they were on. Restructured
      to input-then-label, matching `PreviewBackgroundPicker`.
- [x] A test asserts this structurally for every `sr-only` input in the demo, since
      the bug is structural rather than a wrong class name. Scoped to `sr-only`
      inputs: a visible styled input such as the settings `Toggle` carries
      `focus-visible:ring` itself and needs nothing from its label — requiring the
      sibling structure of it would be wrong. Mutation-checked by swapping the
      order, which fails the test with the reason named.
- [x] **The live region announced half the state.** Hiding the container and then
      pinging shows the Pong marker over a hidden container, but the label was a
      ternary chain that returned on `hidden` and never mentioned the ping.
      Composed from both conditions instead.
- [x] The in-preview "Pong!" and "Chat container hidden" markers are `aria-hidden`:
      they explain the view to someone looking at it, and the live region already
      states both in words.
- [x] The demo region is named "Sample chat messages — not a live stream", as the
      Live iframe is named by its `title`. Without it a screen reader reads nine
      lines of invented chat with nothing marking them as samples. A `group`, not a
      `region` — a labelled grouping inside the preview, not a landmark deserving
      its own entry in the landmark list.
- [x] The platform chip beside the composer's select is `aria-hidden`: it restates
      the select's own value, which is already announced. This is the opposite call
      from the channel fields, where the chip *is* the label and so must be read.
- [x] No custom key handling anywhere in the new surfaces — every control is a
      native input, select, or button, so focus order, arrow keys, and group
      semantics come from the platform.

#### Verification still outstanding

- [ ] Manual browser verification of Demo mode at 1920 / 1024 / 375 px.
- [ ] Manual keyboard and screen-reader pass over the mode switch, sample-group
      toggles, message creator, and simulator. No automated accessibility tooling
      is installed, so axe/CI checks remain outstanding for this batch as for
      every earlier one.
- [ ] Manual confirmation that switching to Demo stops the Live overlay's
      polling — asserted in jsdom by the iframe being unmounted, not observed
      against a running network.

### MultiChat migration — batch 11: font loading and Counter polling guard (implemented)

- [x] **Every font request warned at render time.** Next.js emits "Do not add
      stylesheets using next/head" for any `<link rel="stylesheet">` passed to
      `next/head`, once per href, on every development render. Three routes did
      it: the homepage (Montserrat), `/classic/multichat` (two combined sheets),
      and the overlay itself (the batch-8 selected-font link).
- [x] Fixed as an `@import` inside an inline `<style>` — the same request through
      a mechanism `next/head` supports. `pages/_document.tsx` was considered and
      deliberately not added: the three routes need genuinely different faces
      (one UI face, all eleven, or the single family a URL selected), so there is
      no global set to hoist, and hoisting the union would make every OBS overlay
      fetch nine faces it never draws — undoing batch 8.
- [x] **The first attempt shipped broken and was caught by inspecting the served
      HTML, not by the tests.** Passing the CSS as a text child let React escape
      it: `&` became `&amp;` and `'` became `&#x27;`. A `<style>` element is
      raw text and decodes neither, so the `url()` token was invalid and
      `&amp;family=` would have collapsed the Classic generator's eleven families
      to one. Now `dangerouslySetInnerHTML`, asserted on
      `renderToStaticMarkup` output — a jsdom assertion reads `textContent`
      identically either way and would have passed vacuously.
- [x] `UI_FONT_SPECS` and `googleFontsImportCss` added to `lib/overlayFonts.ts`,
      which was already the one place a face is described. The Classic
      generator's sheet is now built from `UI_FONT_SPECS` + `OVERLAY_FONT_SPECS`
      rather than restating nine `family=` specs that were already there.
- [x] No URL, parameter, or default changed, and no font-family name changed.
      `next/font` was rejected for that reason: it renames families to generated
      identifiers, which would mean rewriting the overlay's `FONT_FAMILIES`, the
      picker, and the Classic CSS, and mixing generated names with the
      self-hosted Alsina and the two system faces.
- [x] Verified at runtime, not from build output — the warning is render-time. A
      clean dev server, then `/`, `/classic/multichat`, and `/multichat?kick=xqc`:
      three 200s and an empty warning log. Proven non-vacuous by a throwaway page
      with a stylesheet link, which did warn on the same server.
- [x] A repository-wide test asserts no `rel="stylesheet"` in any file under
      `pages/`, `components/`, or `app/`. Coarse, but it is the only thing that
      catches a fourth route reintroducing it later.
- [x] **The Viewer Counter's no-polling guarantee was only implied.**
      `counterRegression.test.tsx` asserted the descriptor declares no runtime,
      which implies no poller but never observed one not starting. Now asserts
      the request layer directly: no `POST /api/twitch/pins` call across mount,
      configuring a Twitch channel, 30s of timers, and unmount.
- [x] 12 new tests (994 total, all passing). Typecheck and production build clean.

**Verification still outstanding**

- [ ] Manual browser confirmation that the homepage and `/classic/multichat`
      render in Montserrat, and that the Classic font picker still previews each
      option in its own face. The `@import` mechanism is asserted in the served
      HTML, but "the face actually painted" needs eyes.
- [ ] Manual browser-console check of `/multichat?kick=<channel>`. The overlay is
      client-rendered, so any warning it emitted would appear there rather than in
      the dev server log; the source now contains no stylesheet link for one to
      fire on.

### Security review — findings not acted on

A read-only review of the OAuth lifecycle found the flow sound on CSRF state
(256-bit nonce, `timingSafeEqual`, cleared before branching so it is single-use),
cookie flags, open redirect (exact-match allowlist, destination read from the
cookie rather than the query), and error handling (fails closed, no detail
leaked). Three items are **known and deliberately left alone** — each changes
production auth behaviour and needs a decision plus a schema check first:

- [ ] **Connection id is not rotated on reconnect.**
      `lib/server/twitchConnectionStore.ts:125-141` upserts on `twitch_user_id`
      and resets `revoked_at`, so disconnecting and reconnecting reuses the same
      row and the same id. A leaked id therefore becomes valid again on
      reconnect. Fixing it means rotating a primary key on the live table;
      confirm nothing references it by FK first.
- [x] **Connection id entropy confirmed.** `DEPLOY.md:194` documents the schema
      as `default gen_random_uuid()` — v4, cryptographically random. The shape
      validation in every consumer is redundant with respect to entropy, but not
      with respect to correctness. Closed.
- [ ] **No rate limiting** on `oauth/start`, `oauth/callback`, or
      `oauth/disconnect`. Brute force is not realistic (exact state match, full
      UUID), but nothing caps request volume or Twitch API quota burn.

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

## 10. Original Classic generator revamp (implemented)

The `/tools` workspace direction was rejected. The generator is the **original
Classic page**, revamped: the same centred branded header, wordmark, platform
badges, dark gradient, polished cards, compact platform inputs, two-column control
tables, and pill switches — with the modern engine underneath and the Viewer
Counter embedded as a companion panel.

### Routes (final)

| URL | Serves |
|---|---|
| `/multichat?kick=…` (any channel parameter) | The overlay, permanently. Existing OBS URLs are untouched and never redirect. |
| `/multichat` (no channel) | The revamped Classic generator. |
| `/counter?twitch=…` | The Viewer Counter overlay — a separate browser source. |
| `/classic/multichat` | `replace` to `/multichat`, carrying a valid OAuth return fragment across. |
| `/tools/multichat` | `replace` to `/multichat`. No longer a generator. |
| `/tools/counter` | `replace` to `/multichat#viewer-counter`. No longer a generator. |
| `/tools/<anything else>` | Still a real 404 (`getStaticProps` → `notFound`). |
| `/?kick=…` | Legacy root overlay forwarding, unchanged. |

- [x] `components/classic/ClassicGenerator.tsx` — the canonical generator. Controls
      are rendered from the two tool catalogs (24 MultiChat, 6 Counter) rather than
      hand-written selects, so a catalog change cannot silently skip a control.
- [x] `components/classic/ClassicSetting.tsx` — one Classic-styled control per
      descriptor type, honouring `hidden`, `disabled`, and gated-option
      availability. Ids are namespaced (`mc-` / `vc-`) because both catalogs
      contain `stroke` and `textShadow`.
- [x] The Viewer Counter panel uses the **same** `counterTool` descriptor —
      defaults, normalizer, serializer, preview frame, OBS size. There is no second
      Counter implementation, and no second serializer, parser, OAuth path, pin
      path, connection matcher, or overlay renderer anywhere.
- [x] `workspaceRoute` removed from the tool descriptors: it described a route
      that is now a redirect stub and was read only by tests.

### Layout

Superseded by section 11. The chat/counter side-by-side arrangement described
here was replaced by output-left / settings-right rows per tool. What still holds:
DOM order is the mobile order, the desktop arrangement is CSS grid placement over
the same tree, and Commands & help is built from `MULTICHAT_COMMANDS` — the
parser's own list — so it documents the nine real commands and nothing else.

### Removed

- [x] The `/tools` generator pages (workspace shell, sidebar navigation,
      three-column layout) and the tool-switcher.
- [x] The whole Demo interface: Live/Demo switch, demo preview, sample-message
      groups, message creator, command simulator, Test Tools. Every preview is now
      the real overlay at the real URL, empty when the channels are.
- [x] The tests whose only subject was the rejected workspace or the Demo
      interface. The production `ChatOverlay` renderer and the authoritative
      command help were kept.

### Retained from the modern engine

Authoritative parser/serializer and typed settings; Twitch OAuth with the
exact-match return allowlist (now bound to `/multichat`, with the two retired paths
still allowlisted so in-flight authorizations land); per-tool session drafts, so an
OAuth round trip initiated by the chat side restores **both** the chat and the
counter state; connection status, mismatch handling, Use connected channel,
disconnect/reconnect; native Twitch pins with platform gating and bounded stale
behaviour; Kick pins and pin ownership; `sourceTag` icon/dot/label/none independent
of badges; 7TV emotes, cosmetics, paints, paint shadows; BTTV/FFZ; native badges
and emotes; filters; single-family overlay font loading with no `next/head`
stylesheet warning.

- [x] Counter URLs never contain `undefined`, and the Counter never starts Twitch
      pin polling — both asserted at the request layer, not inferred from the
      descriptor.
- [x] Preview background is page-only state on both panels, independent of each
      other, and absent from both URLs.

### Tests

- [x] `tests/unit/classicGenerator.test.tsx` — 51 tests: Classic header, badges,
      cards, compact inputs, two-column tables, pill switches, footer; panel order
      and the mobile counter-before-chat-settings rule; all 24 MultiChat and all 6
      Counter settings reachable; conditional settings appearing with what they
      depend on; both authoritative URLs and preview/URL/Copy/Open identity; OAuth
      preserving both tools' state; independent backgrounds; commands from the
      registry; OBS setup for two sources; the Demo interface absent; skip link,
      single `h1`, section labelling, counter anchor.
- [x] `homepageRoutes.test.tsx` covers all four redirects including OAuth-fragment
      carry-through and the `/tools/unknown` 404; `oauthEndpoints.test.ts` covers
      the canonical destination and the retired-path allowlist.
- [x] No screenshot tests: jsdom computes no layout, and a screenshot would fail on
      a font metric while proving nothing about order or coverage.

### Future — MultiAlert announcement banner (not built, deliberately)

- [ ] Once MultiAlert exists, place a single announcement banner **above** the
      Classic header reading exactly:
      `*NEW* Check out this Multi Alert Overlay powered by Streamer.bot`
      No banner, route, placeholder, or dead link ships until the destination is
      real.

### Verification still outstanding (human eyes required)

- [ ] Visual pass on `/multichat` at 1920 × 1080, 1024 × 768, and 375 × 812:
      Classic look intact, chat left / counter right, no horizontal overflow,
      touch-friendly targets, useful preview heights.
- [ ] Keyboard and screen-reader pass. No automated accessibility tooling is
      installed, so axe/CI checks remain outstanding here as in every earlier
      batch.
- [ ] OBS confirmation that a generated MultiChat URL and a generated Counter URL
      work as two separate browser sources at their stated sizes.
- [ ] OBS confirmation that a pre-existing scene-collection `/multichat?…` URL
      still renders the overlay untouched.

## 11. Final layout and release audit (implemented)

Two changes to the product, then an audit of everything already built. The design,
routes, backend, and homepage were not redesigned.

### Final layout

Each tool is one row: its output on the left (heading, live preview, preview
background control, URL, Copy, Open, fragment note, OBS size) and its settings on
the right. The Chat Overlay and Chat Settings sit **side by side** at desktop
widths; the same holds for the Counter.

- [x] Page order: header → channels → MultiChat row → Counter row → Commands &
      help → OBS setup → footer, in a 1500px container.
- [x] 1920: two columns per row, no oversized gutter, no full-height Copy button.
- [x] 1024: two columns only while both stay usable, then one column — a narrow
      unusable settings column is worse than stacking.
- [x] 390: the nine-item stack order, with the Counter's preview and URL still
      ahead of the chat settings list.
- [x] Segmented pills, the fade and emote-scale sliders, the font select, the pill
      switches, and the pin-platform multiselect all survived the move; they are
      the same `ClassicSetting` renderers.
- [x] `tests/unit/classicGenerator.test.tsx` asserts the pairing structurally —
      each output and its settings panel inside one row container — rather than by
      screenshot, since jsdom computes no layout.

### Command audit

Traced each platform's incoming message into the dispatcher rather than testing
the parser alone.

- [x] `lib/multichatCommandRuntime.ts` — the dispatcher extracted out of the
      overlay effect, taking an injected `CommandHost` (document, timers, speech,
      reload, sessionStorage, `now`). The overlay behaviour is unchanged; it is now
      reachable from a test.
- [x] `tests/unit/multichatCommandDispatch.test.ts` — 121 tests. Fake Pusher,
      WebSocket, EventSource, and `fetch` drive the **real** Kick, Twitch,
      YouTube, and TikTok connectors, so a connector that put the text elsewhere or
      spelled a badge differently would fail. Every command in the registry runs
      from every platform; the registry is the only command list and no alias was
      invented.
- [x] Casing, surrounding whitespace, arguments, and Unicode all dispatch. A
      message that merely mentions a command string does not. One message
      dispatches once, and a reconnect binds no second listener.
- [x] `img` / `yt` accept only `http:` and `https:` via `isSafeMediaUrl`, and a URL
      carrying an `onerror=` payload is rejected as a URL rather than sanitized as
      HTML. `tts` speech is cancelled by `stop`. The 15s reload cooldown holds
      across a reconnect because it lives in `sessionStorage`.

### Permissions

- [x] Documented the rule that exists, not one invented for the audit: a
      broadcaster/owner badge — or, on TikTok, a username matching the configured
      channel — is level 1000; a moderator badge is 500; everything else is 0. All
      nine commands require moderator or above. Missing role metadata yields 0, so
      it fails closed. Recorded in README.

### URLs, lifecycle, accessibility, Counter

- [x] `tests/unit/overlayUrlStrings.test.ts` — literal complete-string regressions
      for both tools. Identity tests would pass while the serializer changed shape;
      these pin the compatibility surface: parameter order, the `kick=yourchannel`
      placeholder, fade-off omission, no `undefined`/`null`/`NaN`, no bare or
      doubled `#`, and the Counter never carrying a fragment.
- [x] `tests/unit/overlayLifecycle.test.tsx` — one connector per configured
      platform and none on a generator visit; unmount stops every connector, poller,
      and timer; React Strict Mode leaves exactly one of each. Pin polling is gated
      on a valid fragment id, pins enabled, and Twitch selected. The connection id
      never reaches the address bar.
- [x] `tests/unit/counterOverlayRuntime.test.tsx` — through `pages/counter`: a
      measured zero is shown, a failed request is not turned into one, staleness is
      bounded and then becomes the em-dash, polls never overlap, and the Counter
      opens no socket and starts no pin poll.
- [x] `tests/unit/generatorAccessibility.test.tsx` — no duplicate ids, every
      `label[for]` and `aria-describedby` resolves, `textShadow` ids namespaced per
      tool, independent radio groups, per-panel copy live regions, one `h1` with no
      skipped heading level, focus visible wherever the outline is suppressed, and
      reduced motion honoured.

### Verification still outstanding (human eyes required)

Nothing below was observed; no visual, screen-reader, OBS, or live-provider check
is claimed anywhere in this section.

- [ ] Visual pass at 1920 × 1080, 1024 × 768, and 390 × 844 confirming the
      side-by-side rows, no horizontal overflow, and usable preview heights.
- [ ] Keyboard and screen-reader pass. No automated accessibility tooling is
      installed.
- [ ] OBS confirmation of both generated URLs as two browser sources.
- [ ] Live-channel confirmation of each command from all four chat platforms,
      including a real moderator and a real non-moderator.

## 12. 7TV v3 split fetch, preview library, and OAuth check (implemented)

Three threads: the 7TV v3 emote-set change and its regression coverage, the two
generator preview additions, and a safe local OAuth configuration check. No
route, URL, default, or overlay behaviour changed; every addition is either a
resilience fix on the emote path or generator-only preview state.

### 7TV v3 split emote-set fetch

- [x] `lib/kick.ts` — `GET /v3/users/:platform/:id` can now return
      `emote_set: null` while `emote_set_id` stays populated, so reading emotes
      off the inline set silently loaded zero channel emotes. The loader prefers
      `emote_set_id`, falls back to the inline set id, and fetches the full set
      from `GET /v3/emote-sets/:id` when the connection carries no inline emotes.
      One emote parser is shared across the global, inline, and by-id sources, and
      the id is preferred when building the `emote_set` SSE subscription so live
      updates survive. (`335239b`)
- [x] `lib/sevenTVEmoteSetCache.ts` — a process-wide cache keyed by emote-set id,
      with shared in-flight requests, a documented positive TTL (10 min) and a
      short negative TTL (1 min) for 404s. Transient failures (network, abort,
      429, 5xx) are never written, so a blip during one load never denies emotes
      to the next. The by-id fetch returns a discriminated outcome so the cache
      distinguishes a genuinely empty set from a missing one from a transient
      error. The `refresh` command clears the cache first so it is never a silent
      no-op under the TTL. (`e98890b`)
- [x] `tests/unit/sevenTVEmoteSetCache.test.ts` (18 tests) — cold ask, warm
      cache, in-flight dedup (three concurrent asks, one fetch), TTL boundaries,
      negative caching and a recreated set, negative TTL shorter than positive,
      transient failure never cached and not wedged, explicit clear, and
      caller-abort (a shared fetch survives one caller's abort; an
      already-aborted signal resolves to `[]` without a request). (`260d618`)
- [x] `tests/unit/sevenTVSplitFetch.test.ts` (9 tests) — drives the real
      `getSevenTVChannelEmotes` against a stubbed `fetch`: inline fast path (one
      request), platform defaulting to kick, the v3 follow-up (two requests),
      `emote_set_id` precedence over the inline set's id, dedup across two
      channels sharing a set, an unregistered user, a 404 follow-up that keeps the
      set id, no set at all, and malformed emotes dropped. (`5956996`)

### Generator preview additions

- [x] `components/classic/ClassicPreviewBadgeLibrary.tsx`,
      `usePreviewBadgeLibrary.ts`, `lib/tools/multichat/previewBadgeLibrary.ts`
      — a browsable badge/cosmetic library beside the source picker, seeded from
      a local catalog and extended by one real 7TV fetch **on click**. It fetches
      nothing on mount, shares one in-flight request under Strict Mode, caches the
      first success per session, and never clears the shown assets on a failed or
      aborted load. It is generator-only: it composes no chat line, reaches no
      overlay URL or draft, and the overlay route does not import it. (`383d25e`)
- [x] `components/classic/ClassicPreviewBackgroundControl.tsx` — the preview
      backdrop (Transparent / Dark / Light / Custom hex) is now offered on **both**
      the chat and counter panels, independently, and persists across the OAuth
      round trip via the per-tool session draft. Still page-only: the chosen
      background is never read into a tool's style and never serialized into an
      overlay URL. A restored draft carrying an unknown background string falls
      back to Transparent rather than throwing. (`556ffb7`)
- [x] `tests/unit/previewBadgeLibrary.test.tsx` (in `383d25e`) and
      `tests/unit/previewBackgroundControl.test.ts` (13 tests, `fd24968`) — the
      badge hook's grow-only invariant and no-request-without-a-click guarantee,
      and the background control's pure serialize/restore round trip
      (`effectivePreviewBackground`, `previewBackgroundFromDraft`,
      `previewSurfaceClass`, `isHexColor`).

### Safe local OAuth configuration check

- [x] `scripts/verify-oauth-config.mts`, wired as `npm run verify:oauth`. Reads
      `process.env` only — never `.env.local`, never any secret's value — and
      reports each of the six required variables as present or MISSING by name,
      prints the public production and local callback URLs, and exits non-zero
      when a variable is absent or `TWITCH_REDIRECT_URI`'s path is wrong. It reuses
      `lib/server/oauthConfig.ts` as the authoritative list, so it cannot drift
      from what the OAuth routes check. Opt-in dotenv checking is documented in the
      script header as `node --env-file=.env.local scripts/verify-oauth-config.mts`.
      (`2627b54`)

Documented in `DEPLOY.md`'s build/verification section. The check confirms only
that the configuration contract is satisfied; whether a real authorization round
trip completes still needs a human, exactly as the `curl` check already notes.
