<p align="center">
  <img src="./app/public/tpl.webp" alt="TPL" width="120" />
</p>

<h1 align="center">MultiChat | Custom Multi-Platform Chat Overlay</h1>

<p align="center">
  <a href="https://gxufy.com/">Live site</a> · <a href="https://gxufy.com/multichat">Generator</a>
</p>

A customizable **Kick, Twitch, YouTube and TikTok** chat overlay for OBS, with a separate multi-platform viewer counter.

Chat and viewer counts require no login. Twitch connection is optional and used only for native Twitch pinned messages.

## Features

- Kick, Twitch, YouTube and TikTok in one overlay
- Separate real-time multi-platform viewer counter
- 7TV, BTTV and FFZ emotes; 7TV paints, cosmetics, badges and zero-width emotes
- Platform badges, source markers and pinned messages
- Twitch Shared Chat support
- Font, size, color, stroke, shadow, emote scale, bold and uppercase controls
- Fade, entrance animation, slide-in and smooth-scroll controls
- Colored @mentions, transparent/custom backgrounds and message colors
- Moderation actions, bot filtering and username/message-prefix blacklists
- Fullscreen image, YouTube and TTS chat commands

## Commands

Commands must be the **first word** of a message and require moderator or broadcaster access. `!kickchat` is also accepted as a legacy alias for `!multichat`.

| Command | What it does |
| :--- | :--- |
| `!multichat ping` | Shows **Pong!** for 3 seconds. |
| `!multichat reload` | Reloads the browser source. |
| `!multichat stop` | Clears active notifications, images and videos. |
| `!multichat show` / `hide` | Shows or hides the chat without disconnecting. |
| `!multichat kickon` / `kickoff` | Shows or hides Kick messages without disconnecting. |
| `!multichat twitchon` / `twitchoff` | Shows or hides Twitch messages without disconnecting. |
| `!multichat youtubeon` / `youtubeoff` | Shows or hides YouTube messages without disconnecting. |
| `!multichat tiktokon` / `tiktokoff` | Shows or hides TikTok messages without disconnecting. |
| `!multichat sharedon` / `sharedoff` | Enables or disables Twitch Shared Chat display. |
| `!multichat counterbgon` / `counterbgoff` | Shows or hides the matching viewer-counter pill background. |
| `!multichat refresh [emotes]` | Reloads 7TV, BTTV and FFZ emotes without reloading the source. |
| `!multichat img <url\|emote> [-t seconds] [-o opacity]` | Shows a fullscreen image or emote. Use `img clear` to dismiss it early. |
| `!multichat yt <url\|preset> [-t seconds] [-m]` | Plays a fullscreen YouTube video. Presets: `bruh`, `vine-boom`, `dc-ping`, `rickroll`, `win-error`. |
| `!multichat tts <message>` | Reads a message aloud through the browser source. |

The generator's **Commands & help** section uses the same command registry as the overlay.

## Supported Services

| Service | Support |
| :--- | :--- |
| **Twitch** | Native emotes and badges, moderation, pinned messages and Shared Chat |
| **Kick** | Native emotes and badges, moderation and live chat |
| **YouTube** | Channel emoji, owner/mod/verified/member badges, Super Chats, Super Stickers, memberships and gifted memberships |
| **TikTok** | Live chat integration alongside the other connected platforms |
| **7TV** | Global/channel/personal sets, auto updates, zero-width emotes, paints and badges |
| **BTTV** | Global/channel emotes and auto updates |
| **FFZ** | Global/channel emotes and badges |

## OBS Setup

Chat and the viewer counter use **separate browser-source URLs**.

1. Open [`gxufy.com/multichat`](https://gxufy.com/multichat).
2. Enter your channel name(s) and configure the overlay.
3. Add the **Chat URL** to OBS at **680 × 280**. *(830 × 230 also works as a wider, shorter layout.)*
4. Add the **Viewer Counter URL** as its own browser source.

Built by [gxufy](https://guns.lol/gxufy).
