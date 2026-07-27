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

Work from any connected platform's chat. Every command needs the same level — moderator or above — so the broadcaster and mods can run all of them equally. `!kickchat` still works as an alias.

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
distinction to make. The generator's Demo mode lists all nine and can genuinely
run four of them — `ping`, `stop`, `show`, and `hide`. The other five
(`reload`, `refresh emotes`, `img`, `yt`, `tts`) are listed without a button
rather than faked: reloading a browser source, refetching emote sets, and playing
media are not things a preview can reproduce honestly.

## OBS Setup

1. Open **`/tools/multichat`**, fill in your channel name(s) — any one platform or all four — and configure options. The preview beside the settings has two modes. **Live** is a real overlay at the exact URL you are about to copy, so it stays empty while those channels are offline or quiet. **Demo** renders the same overlay over sample messages, so you can judge fonts, colours, and badges before going live; you can also compose your own test message and try the `!multichat` commands there. Nothing you do in Demo changes the URL.
2. Click **Copy overlay URL**
3. In OBS: **Add Source → Browser Source**, paste the URL
4. Recommended size: **830 × 230**

The Viewer Counter generator is at **`/tools/counter`**.

Both generators are optional — the overlay URL is just query parameters, so a
hand-written one works fine. The original single-page generator is still
available at `/classic/multichat` if you prefer it.

> Connecting a Twitch account is optional and only enables Twitch's own **pinned
> messages**, which anonymous IRC cannot read. Everything else works with no
> login. The connected account must be the same account as the Twitch channel you
> typed — connecting as a moderator of someone else's channel authorizes fine but
> leaves the pin option disabled, with the reason shown next to the connection.
> See [DEPLOY.md](DEPLOY.md) for the environment variables that feature needs.

`/multichat` is the overlay itself, not the generator. Existing OBS URLs pointing
at it keep working unchanged and always will; a visit with no channel forwards to
`/tools/multichat`.

### Fonts

The overlay only fetches the one Google font your `font=` value names
(`lib/overlayFonts.ts`), not the whole set — so OBS never downloads faces it
will not render. The homepage and `/classic/multichat` each load their own UI and
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
