# UChat port provenance

## Source and license

- Upstream: [Fiszh/UChat](https://github.com/Fiszh/UChat)
- Exact commit: `ba8841c1db75af4f135ef1cd19f8745e5e12b4e3`
- Commit date inspected: 2026-08-01
- License: GNU Affero General Public License v3 or later
- Copyright notice: Copyright (C) 2026 Fish (Fiszh)
- MultiChat modification date: 2026-08-01

The upstream checkout used for the port was detached at the exact commit above.
The complete license is preserved at the repository root. MultiChat applies the
conservative interpretation that directly combining adapted UChat code with
this application creates an AGPL-covered combined work.

## Upstream files inspected

Workflow and state:

- `app/src/components/Main/Chat/Main.svelte`
- `app/src/components/Main/Chat/Display.svelte`
- `app/src/components/Main/Chat/Settings.svelte`
- `app/src/components/dialogs/channel_manager.svelte`
- `app/src/components/ChatDisplay.svelte`
- `app/src/routes/+page.svelte`
- `app/src/routes/+layout.svelte`
- `app/src/stores/global.ts`
- `app/src/stores/settings.ts`

Rendering and parsing:

- `app/src/components/chat/messageWrapper.svelte`
- `app/src/components/chat/twitch/message.svelte`
- `app/src/components/chat/kick/message.svelte`
- `app/src/components/Badge.svelte`
- `app/src/components/chat/emote.svelte`
- `app/src/components/chat/paint.svelte`
- `app/src/lib/chat.ts`
- `app/src/lib/emotes/parser.ts`

Loading:

- `app/src/lib/preview.ts`
- `app/src/lib/loadChat.ts`
- `app/src/lib/emotes/main.ts`
- `app/src/lib/badges/main.ts`
- `app/src/lib/badges/parser.ts`
- `app/src/lib/services/7TV/main.ts`
- `app/src/lib/services/7TV/cosmetics.ts`
- `app/src/lib/services/BTTV/main.ts`
- `app/src/lib/services/FFZ/main.ts`
- `app/src/lib/overlayIndex.ts`

## Materially adapted behavior

The following behavior was adapted into the existing MultiChat architecture:

- large chat preview workspace, controls, local background, reset, and custom
  message workflow;
- badge loading status and refresh workflow;
- production badge ordering and channel overrides;
- Twitch global/channel badges, 7TV entitlement cosmetics, FFZ room badges,
  and Kick badge tiers/ranks;
- global/channel 7TV, BTTV, and FFZ emote precedence;
- painted names and mentions;
- zero-width emote layering;
- bottom-anchored clipping, scaling, long wrapping, and responsive workflow.

Materially adapted target modules carry concise attribution comments. The port
uses MultiChat's existing `UnifiedMessage` → `buildParsedMessage` →
`ChatOverlay` production path rather than a separate preview renderer.

## Badge pipeline decisions

- **Twitch global/channel — combined:** MultiChat retains its anonymous Twitch
  GQL proxy and browser-side validation because it does not rely on UChat's
  private backend. Global badges load first and exact channel set/version art
  overrides them.
- **FFZ room overrides — combined:** MultiChat retains narrow moderator/VIP
  replacement behavior and applies those images in the native Twitch badge
  position.
- **7TV badges and paints — combined:** production uses real
  `userByConnection` entitlements and EventAPI updates; preview identities and
  entitlements are deterministic local fixtures.
- **Kick badges — retained from MultiChat:** MultiChat already supports a wider
  set of broadcaster, moderator, VIP, founder, OG, verified, staff, subscriber,
  gifter, gift-rank, and Kicks-rank artwork.
- **7TV/BTTV/FFZ emotes — combined:** public provider APIs/CDNs are retained,
  with global/channel ordering and zero-width behavior adapted from the audited
  upstream path.

Malformed optional records are discarded. Provider failure must not stop chat
message delivery, and failed artwork is removed without breaking message
layout.

## Dependencies and assets

UChat runtime dependencies inspected included Svelte, SvelteKit,
`@lucide/svelte`, `html-to-image`, `svelte-awesome-color-picker`,
`svelte-i18n`, `tinycolor2`, and `twemoji`. None were copied merely because
UChat uses them; the port remains on MultiChat's React/Next.js stack.

No UChat logo, name, banner, favicon, artwork, donation link, bundled font,
sample username, sample message, channel identity, or sample cosmetic ID was
copied. Twitch, Kick, 7TV, BTTV, and FFZ artwork continues to resolve through
provider APIs/CDNs. Deterministic preview-only art is original local fixture
art and cannot enter generated URLs, connectors, or saved channel drafts.

UChat's private `${API_URL}` backend contracts were not copied or called.

## Corresponding source

The complete corresponding source for multichat-gxufy is available at
[github.com/gxufy/multichat-gxufy](https://github.com/gxufy/multichat-gxufy).
A network deployment must make the exact deployed revision, including build and
installation material required by AGPL v3, available there or through an
equivalent clearly linked source archive.
