# multichat-gxufy

A multi-platform chat overlay for OBS and streaming software — **Kick · Twitch · YouTube · TikTok** in one browser source, no login or OAuth required. Built by [@Gxufy_](https://x.com/Gxufy_).

**Live:** [multichat-gxufy.com](https://multichat-gxufy.com)

---

## Features

- **4 platforms, 1 overlay** — combine any mix of Kick, Twitch, YouTube Live, and TikTok Live chats (`?kick=x&twitch=y&youtube=z&tiktok=w`)
- **No OAuth** — works with just channel names; anyone can use it
- **Third-party emotes** — 7TV + BTTV + FFZ (global & channel) on Kick and Twitch, with live 7TV emote-set updates via EventAPI
- **7TV cosmetics** — name-paints and badges on Kick and Twitch chatters (GQL-backed, applies retroactively to buffered messages)
- Zero-width emote stacking
- **Real platform badges** — full Kick set, all Twitch badge sets (sub tiers, bits, events) + FFZ room overrides, YouTube member/mod/verified with owner gold-pill, TikTok top-gifter/fan-club/sub art
- **Platform source tags** — official brand icon (default), dot, label, or none per message
- **Event cards** — subs, gift subs, raids/hosts, cheers/Kicks, Super Chats/Stickers, memberships, TikTok gifts (with art + diamonds), follows & shares
- **Pinned messages** — Kick, YouTube, and TikTok pins in a StreamNook-style card that collapses to a thin bar. Twitch pins too, with an optional connected account (Twitch's own pins are not readable over anonymous IRC)
- Batched slide / fade animations (chatis-exact 200ms loop — no stutter on fast chat)
- Stroke, shadow, font options (12 fonts including Alsina)
- Bot filtering — ignore known bots + custom list
- Chat commands (`!multichat`) from **any** connected platform's chat

## Chat Commands

Work from any connected platform's chat — Kick, Twitch, YouTube, and TikTok reach
the same dispatcher, and the tests drive every command through each platform's real
connector rather than through the parser alone. Every command needs the same level,
moderator or above, so the broadcaster and mods can run all of them equally.
`!kickchat` still works as an alias.

The trigger has to be the message's **first word**. `!multichats stop` and "type
`!multichat hide` to hide it" are ordinary chat messages and run nothing.

| Command | Description | Access |
|---|---|---|
| `!multichat ping` | Shows a Pong overlay on screen | Mod+ |
| `!multichat reload` | Reloads the browser source | Mod+ |
| `!multichat stop` | Stops all active overlays | Mod+ |
| `!multichat show` / `hide` | Shows or hides the chat overlay | Mod+ |
| `!multichat refresh emotes` | Reloads 7TV/BTTV/FFZ emotes live | Mod+ |
| `!multichat img [url or emote name] -t [sec] -o [opacity]` | Displays an image or emote (e.g. `GIGACHAD`) fullscreen for N seconds | Mod+ |
| `!multichat yt [url or preset] -t [sec] -m` | Plays YouTube video/sound. Presets: `bruh` `vine-boom` `dc-ping` `rickroll` `win-error` | Mod+ |
| `!multichat tts [message]` | Text-to-speech via StreamElements | Mod+ |

Every command needs the same level, so the table above has no per-command access
distinction to make. The generator's **Commands & help** section is built from the
parser's own command list, so it documents these nine and nothing else. The viewer
counter has no commands of its own.

**How access is decided.** From the badges on the message: a broadcaster or owner
badge, or an author name matching the channel you configured, counts as
broadcaster; a moderator badge counts as moderator; anything else is 0, which is
below the gate. It fails closed — a message whose role metadata is missing or
unrecognised runs nothing. The name fallback exists because TikTok sends no
broadcaster badge at all, so without it a streamer could not use their own commands
in their own chat.

**Behaviour worth knowing.** `hide` hides the container without disconnecting, so
messages keep arriving behind it and `show` restores a live chat rather than an
empty box; both are idempotent. `stop` clears every overlay *and* silences speech.
`reload` ignores a second call within 15 seconds — a replayed message from
YouTube's continuation or TikTok's buffer could otherwise reload the source in a
loop. `img` accepts `http` and `https` only, so a `javascript:` or `data:` URL from
chat does nothing. One chat message runs one command, even if a platform delivers
it twice.

## OBS Setup

The chat overlay and the viewer counter are **two independent browser sources with
two different URLs**. Add either, both, or neither — neither needs the other.

Open **[`/multichat`](https://multichat-gxufy.com/multichat)** — with no channel
parameters, that is the generator. Fill in your channel name(s) once (any one
platform or all four); they feed both tools.

The page is one column of sections: the shared **channel** fields, then a row per
tool, then **Commands & help**, then **OBS setup**. Each tool row puts its output on
the left — heading, live preview, generated URL, Copy and Open — and that tool's
settings on the right, side by side on a desktop. On a narrow screen each row
stacks, so the order becomes chat preview, chat settings, counter preview, counter
settings.

**Chat overlay**

1. Configure the chat settings. Before you enter a channel the preview holds a fixed set of sample messages, marked **Preview data**, so every setting is visible immediately. Enter a channel and it becomes a real overlay at the exact URL you are about to copy — which then stays empty while those channels are offline or quiet.
2. Click **Copy** under the chat overlay URL.
3. In OBS: **Add Source → Browser**, paste the URL.
4. Size it **680 × 280**. **830 × 230** is a wider, shorter alternative that shows fewer messages.
5. Leave **Shutdown source when not visible** off — the overlay reconnects on load, so toggling it drops recent messages.

**Viewer counter**

1. The **Viewer counter** row sits below the chat row, with its own six settings beside its own preview and URL. Before you enter a channel it shows sample counts, marked **Preview data**, and you can edit them or click **Restore sample counts**.
2. Click its **Copy**, add a **second Browser source**, and paste it in.
3. Size it **400 × 80**.

In OBS it polls each platform's viewer count and shows what it measured. A measured
zero is shown, because zero viewers on a live stream is a fact; a request that
failed is not turned into a zero. A brief outage keeps the last known number for a
bounded window and then shows an em-dash rather than continuing to assert a count it
can no longer confirm. Nothing renders until the first poll has settled, so no
fabricated number ever flashes on stream. The counter carries no connection key and
opens no sockets — it is polling only.

The generator's sample counts are the one exception to that, and only there: they
are typed in, never fetched, never saved, and never part of the URL, so the overlay
OBS loads still shows nothing until it has measured something.

The preview-background buttons on the generator change that page only. They are
never part of either URL and never reach OBS.

The generator is optional — the overlay URL is just query parameters, so a
hand-written one works fine.

> Connecting a Twitch account is optional and only enables Twitch's own **pinned
> messages**, which anonymous IRC cannot read. Everything else works with no
> login. The connected account must be the same account as the Twitch channel you
> typed — connecting as a moderator of someone else's channel authorizes fine but
> leaves the pin option disabled, with the reason shown next to the connection.
> See [DEPLOY.md](DEPLOY.md) for the environment variables that feature needs.
>
> If **Connect Twitch** returns `{"error":"oauth_not_configured"}`, the deployment
> is missing one or more of those six variables. The server log names which ones.
> Everything except native Twitch pins keeps working meanwhile.

### Routes

`/multichat` is both, decided by whether the URL names a channel:

| URL | What it serves |
|---|---|
| `/multichat?kick=…` (any channel parameter) | **The overlay.** Existing OBS URLs keep working unchanged and always will. |
| `/multichat` (no channel) | **The generator** — chat overlay and embedded viewer counter. |
| `/counter?twitch=…` | The viewer counter overlay, a separate browser source. |
| `/classic/multichat` | Redirects to `/multichat`, carrying a Twitch OAuth return fragment across. |
| `/tools/multichat` | Redirects to `/multichat`. No longer a generator page. |
| `/tools/counter` | Redirects to `/multichat#viewer-counter`. No longer a generator page. |
| `/?kick=…` | Legacy root overlay URLs still forward to `/multichat`. |

There is still no demo or test mode, and no separate testing page. With a channel
configured, every preview is the real overlay at the real URL, so it is empty when
those channels are. With no channel yet, both previews show fixed sample data —
marked **Preview data** — through those same overlay components, so the settings
are visible before you have typed anything. The samples are generator-only: they
open no sockets, poll nothing, and never appear in a URL or in OBS.

### Fonts

The overlay only fetches the one Google font your `font=` value names
(`lib/overlayFonts.ts`), not the whole set — so OBS never downloads faces it
will not render. The homepage and the generator each load their own UI and
font-picker faces the same way, via a `@import` inside `next/head`'s `<style>`
rather than a `<link rel="stylesheet">`, which is what Next.js's Pages Router
warns against outside `pages/_document.tsx`. `segoe`, `impact`, and `default`
need no network request at all, and `alsina` is self-hosted.

## Hosting

Run with a persistent Node server (`npm run build && npm start`) — a VPS, Railway, Fly.io, or a PC that stays on.

- **Kick** and **Twitch** connect directly from the browser (websockets)
- **YouTube** polls through two small API routes
- **TikTok** holds a server-side connection ([tiktok-live-connector](https://github.com/zerodytrash/TikTok-Live-Connector)) streamed to the overlay via SSE — this is the part that won't survive serverless (Vercel) deploys; everything else does
- Optional: set `TIKTOK_SIGN_API_KEY` ([Euler Stream](https://www.eulerstream.com/)) to raise TikTok signing rate limits

## Stack

Next.js 14 · TypeScript · Pusher (Kick) · anonymous IRC (Twitch) · InnerTube (YouTube) · tiktok-live-connector (TikTok) · 7TV GQL + EventAPI · BTTV · FFZ

---

*Inspired by [ChatIS](https://chatis.is2511.com/) by IS2511 & giambaJ, [unified-chat-lite](https://github.com/Kimsec/unified-chat-lite) by Kimsec, and [StreamNook](https://github.com/winters27/StreamNook). Not affiliated with Kick, Twitch, YouTube, or TikTok.*
