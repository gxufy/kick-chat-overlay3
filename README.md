# MultiChat | Custom Multi-Platform Chat Overlay

**Live:** https://multichat-gxufy.com/

A customizable Kick, Twitch, YouTube and TikTok chat overlay for OBS, with a
separate multi-platform viewer counter.

Chat and viewer counts require no login. Twitch connection is optional and used
only for native Twitch pinned messages.

## Commands

Type a command as the **first word** of a chat message. Kick, Twitch, YouTube
and TikTok all reach the same dispatcher, so a command works from any connected
platform. Moderator or broadcaster permission is required. `!kickchat` is
accepted as an alias.

| Command | What it does |
| :--- | :--- |
| `!multichat ping` | Shows a "Pong!" confirmation on the overlay for 3 seconds. |
| `!multichat reload` | Reloads the whole browser source. |
| `!multichat stop` | Clears every active overlay: notifications, images and videos. |
| `!multichat show` | Shows the chat container again after hide. |
| `!multichat hide` | Hides the chat container without stopping the connections. |
| `!multichat refresh [emotes]` | Reloads 7TV, BTTV and FFZ emotes without reloading the source. |
| `!multichat img <url\|emote> [-t seconds] [-o opacity]` | Shows a fullscreen image, or an emote by name, over the scene. |
| `!multichat yt <url\|preset> [-t seconds] [-m]` | Plays a fullscreen YouTube video over the scene. |
| `!multichat tts <message>` | Reads the message aloud through the browser source. |

The generator's **Commands & help** section is built from the same command
registry, so it always matches what the overlay implements.

## Chat Customization Settings

- Kick, Twitch, YouTube and TikTok in one overlay
- Message size
- Font selection
- Bold messages
- Font stroke
- Text shadow
- Message animation
- Message fade time
- Source marker style (icon, colored dot, platform name or off)
- Hide usernames
- Platform and 7TV badges
- Bot filtering, with a custom bot list
- Username and message-prefix blacklists
- Pinned messages
- 7TV emotes
- 7TV cosmetics and badges
- 7TV paints
- Paint shadows
- BTTV emotes
- FFZ emotes
- Zero-width emotes
- Preview background and preview scaling *(generator-only — never part of an overlay URL)*

## Supported Services

| Service | Features |
| :--- | :--- |
| **Twitch** | Chat, native and third-party emotes, badges, viewer count, moderation events, and optional native pinned messages through OAuth. |
| **Kick** | Chat, emotes, badges, viewer count, pinned messages and moderation events. |
| **YouTube** | Live chat, memberships and paid events, badges, viewer count and pinned messages. |
| **TikTok** | Live chat, gifts, follows and shares, source handling, plus viewer count and pinned messages where currently supported. |
| **7TV** | Global, channel and personal emotes where supported, live set updates, zero-width emotes, paints, paint shadows and cosmetic badges. |
| **BTTV** | Global and channel emotes, with live set updates where supported. |
| **FFZ** | Global and channel emotes, with supported badge overrides. |

## OBS Setup

Chat and the viewer counter are **two separate URLs** in **two separate browser
sources**. Add either, both or neither.

1. Open the generator at [`/multichat`](https://multichat-gxufy.com/multichat)
   with no channel in the URL.
2. Enter your channel name(s) and configure the overlays.
3. Copy the **Chat URL** into a Browser Source sized **680 × 280**.
4. Copy the **Viewer Counter URL** into a separate Browser Source sized
   **400 × 80**.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Deployment](docs/DEPLOY.md)
- [Privacy & token handling](docs/PRIVACY.md)
- [Testing](docs/TESTING.md)

---

Built by [gxufy](https://guns.lol/gxufy). Not affiliated with Kick, Twitch,
YouTube or TikTok. Inspired by [ChatIS](https://chatis.is2511.com/),
[unified-chat-lite](https://github.com/Kimsec/unified-chat-lite) and
[UChat](https://github.com/Fiszh/UChat).
