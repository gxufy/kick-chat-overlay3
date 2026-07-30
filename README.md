# multichat-gxufy

One browser source that merges **Kick · Twitch · YouTube · TikTok** chat into a
single OBS overlay — no login, no OAuth, just channel names.

**Live:** [multichat-gxufy.com](https://multichat-gxufy.com)

---

## What it is

A generator and two overlays. Open the generator, type your channel name on any
platform (or all four), style it, and copy a URL into an OBS browser source.
Everything runs from the URL's query string, so there is no account to make and
nothing to log into. A second, independent overlay shows live viewer counts.

The one optional exception is native Twitch pinned messages, which need a
connected Twitch account — see [DEPLOY.md](docs/DEPLOY.md). Everything else works
anonymously.

## Features

- **Four platforms, one overlay.** Any mix of Kick, Twitch, YouTube Live, and
  TikTok Live in a single source (`?kick=x&twitch=y&youtube=z&tiktok=w`).
- **Third-party emotes.** 7TV, BTTV, and FFZ — global and channel — on Kick and
  Twitch, with live 7TV emote-set updates and zero-width stacking.
- **7TV cosmetics.** Name-paints and badges, applied retroactively to messages
  already on screen.
- **Real platform badges.** The full Kick set, every Twitch badge set (sub
  tiers, bits, events) with FFZ room overrides, YouTube member/mod/verified and
  owner pill, and TikTok gifter/fan-club/sub art.
- **Source markers.** Tag each message by platform with a brand icon, a colored
  dot, a text label, or nothing.
- **Event cards.** Subs, gift subs, raids and hosts, cheers and Kicks, Super
  Chats and Stickers, memberships, TikTok gifts, follows, and shares.
- **Pinned messages.** Kick, YouTube, and TikTok pins in a card that collapses
  to a thin bar. Twitch pins too, with an optional connected account.
- **Styling.** Stroke, shadow, twelve fonts, and batched slide/fade animation
  that stays smooth on fast chat.
- **Bot filtering.** Skip known bots, plus your own custom list.
- **Chat commands.** Drive the overlay from any connected platform's chat with
  `!multichat` (see below).

## Quick start

The chat overlay and the viewer counter are **two separate browser sources with
two different URLs**. Add either, both, or neither.

1. Open **[`/multichat`](https://multichat-gxufy.com/multichat)** with no channel
   in the URL — that is the generator. Enter your channel name(s) once; they feed
   both tools.
2. Style each tool. Before you enter a channel, both previews run continuously on
   sample data marked **Preview data** so every setting is visible immediately —
   the chat preview streams fake messages through the production renderer, and the
   counter preview rolls through sample counts. Enter a channel and each preview
   becomes the real overlay at the exact URL you copy.

**Chat overlay**

- Copy the chat overlay URL, then in OBS choose **Add Source → Browser** and
  paste it.
- Size it **680 × 280**. **830 × 230** is a wider, shorter alternative that shows
  fewer messages.
- Leave **Shutdown source when not visible** off — the overlay reconnects on
  load, so toggling it drops recent messages.

**Viewer counter**

- Copy the viewer counter URL — a different URL, not a setting on the overlay.
- Add a **second Browser source** and paste it in.
- Size it **400 × 80**.

The generator is optional: the overlay URL is just query parameters, so a
hand-written one works fine. Preview backgrounds and sample counts change the
generator page only — they are never part of a URL and never reach OBS.

### What the preview shows

The chat preview is the **production overlay renderer** over sample messages, not
a mock-up, so every one of the twenty-four chat settings behaves exactly as it
will in OBS. Its config is round-tripped through the overlay route's own parser,
so the preview and the URL you copy can never disagree.

- **Badges load behind the scenes.** There is no badge gallery to browse. The
  sample chatters wear real platform and 7TV badges beside their names, through
  the same entitlement path the live overlay uses. **Refresh preview badges**
  fetches the full 7TV set once per session; a failed refresh leaves the badges
  already shown untouched. A configured OBS overlay never makes this request, and
  no badge ever reaches a generated URL.
- **Preview-only, always.** The preview background (Transparent / Dark / Light /
  Custom hex), the zoom, the sample feed speed, and the badge catalog are
  generator page state. None of them is serialized into an overlay URL or reaches
  OBS. They persist across the Twitch OAuth round trip through a session draft,
  not through the URL.
- **Native Twitch pins** are previewed through the same pin card the overlay
  renders. In OBS they need a connected Twitch account whose login matches the
  channel you typed — see [DEPLOY.md](docs/DEPLOY.md). No secret is ever read in the
  browser; token handling is entirely server-side.

## Commands

Type these as the **first word** of a chat message on any connected platform.
Kick, Twitch, YouTube, and TikTok all reach the same dispatcher, so a command run
from any one of them acts on the overlay itself. `!kickchat` works as an alias.

| Command | What it does |
|---|---|
| `!multichat ping` | Shows a "Pong!" confirmation on the overlay for 3 seconds. |
| `!multichat reload` | Reloads the whole browser source. |
| `!multichat stop` | Clears every active overlay: notifications, images, and videos. |
| `!multichat show` | Shows the chat container again after hide. |
| `!multichat hide` | Hides the chat container without stopping the connections. |
| `!multichat refresh [emotes]` | Reloads 7TV, BTTV, and FFZ emotes without reloading the source. |
| `!multichat img <url\|emote> [-t seconds] [-o opacity]` | Shows a fullscreen image, or an emote by name, over the scene. |
| `!multichat yt <url\|preset> [-t seconds] [-m]` | Plays a fullscreen YouTube video over the scene. |
| `!multichat tts <message>` | Reads the message aloud through the browser source. |

Every command needs the same access level — moderator or broadcaster — so there
is no per-command distinction. Access is read from the message's badges: a
broadcaster or owner badge (or, on TikTok, an author name matching the configured
channel) counts as broadcaster; a moderator badge counts as moderator; anything
else is denied. It fails closed, so a message with missing or unrecognized role
data runs nothing.

A few behaviors worth knowing: `hide` keeps the connections alive so `show`
restores a live chat rather than an empty box; `stop` also silences speech;
`reload` ignores a repeat within 15 seconds so a replayed message cannot loop the
source; and `img` accepts `http` and `https` URLs only. The generator's
**Commands & help** section is built from the same command registry, so it can
never document a command the overlay does not implement.

## Routes

`/multichat` is both the overlay and the generator, decided by whether the URL
names a channel.

| URL | What it serves |
|---|---|
| `/multichat?kick=…` (any channel parameter) | **The overlay.** Existing OBS URLs keep working unchanged and always will. |
| `/multichat` (no channel) | **The generator**, with the viewer counter embedded. |
| `/counter?twitch=…` | The viewer counter overlay — a separate browser source. |
| `/classic/multichat` | Redirects to `/multichat`, carrying a Twitch OAuth return fragment across. |
| `/tools/multichat` | Redirects to `/multichat`. No longer a generator page. |
| `/tools/counter` | Redirects to `/multichat#viewer-counter`. No longer a generator page. |
| `/?kick=…` | Legacy root overlay URLs still forward to `/multichat`. |

A URL that names a channel is always treated as an overlay first, so a scene
collection URL that also carries generator-shaped parameters still renders chat.

## Viewer counter

In OBS the counter polls each platform's viewer count and shows what it measured.
A measured zero is shown, because zero viewers on a live stream is a fact; a
request that failed is never turned into a zero. A brief outage keeps the last
known number for a bounded window, then shows an em-dash rather than asserting a
count it can no longer confirm. Nothing renders until the first poll settles, so
no fabricated number flashes on stream. The counter opens no sockets — it is
polling only. It supports a combined total or a per-platform breakdown.

The generator's sample counts are the one exception: they are typed in, never
fetched, never saved, and never part of the URL, so the overlay OBS loads still
shows nothing until it has measured something.

## Fonts

The overlay fetches only the one Google font your `font=` value names
(`src/lib/overlayFonts.ts`), never the whole set, so OBS does not download faces it
will not render. `segoe`, `impact`, and `default` need no network request, and
`alsina` is self-hosted. Fonts load through an `@import` inside `next/head`'s
inline `<style>` rather than a stylesheet link, which is what the Pages Router
expects outside `src/pages/_document.tsx`.

## Hosting

Run it behind a persistent Node server (`npm run build && npm start`) — a VPS,
Railway, Fly.io, or a machine that stays on. Kick and Twitch connect directly
from each viewer's browser; YouTube is polled through two small API routes;
TikTok holds a server-side connection ([tiktok-live-connector](https://github.com/zerodytrash/TikTok-Live-Connector))
streamed to the overlay over SSE — the one part that will not survive a
serverless deploy. Optionally set `TIKTOK_SIGN_API_KEY` from
[Euler Stream](https://www.eulerstream.com/) to raise TikTok signing limits.

Full deployment, environment variables, the Supabase schema for Twitch pins, and
OAuth setup are in [DEPLOY.md](docs/DEPLOY.md).

## Stack

Next.js 14 · TypeScript · Pusher (Kick) · anonymous IRC (Twitch) · InnerTube
(YouTube) · tiktok-live-connector (TikTok) · 7TV GQL + EventAPI · BTTV · FFZ

## Documentation

Developer docs live in [`docs/`](docs/): [architecture and the enforced import
boundaries](docs/ARCHITECTURE.md), [testing](docs/TESTING.md),
[deployment](docs/DEPLOY.md), and [privacy / token handling](docs/PRIVACY.md).

---

Built by [gxufy](https://guns.lol/gxufy). Not affiliated with Kick, Twitch,
YouTube, or TikTok. Inspired by [ChatIS](https://chatis.is2511.com/) by IS2511 &
giambaJ, [unified-chat-lite](https://github.com/Kimsec/unified-chat-lite) by
Kimsec, and [StreamNook](https://github.com/winters27/StreamNook).
