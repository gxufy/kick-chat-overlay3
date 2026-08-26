<div align="center">

# 🕊️ MultiChat

**Custom multi-platform chat overlay for OBS**

Kick · Twitch · YouTube · TikTok

<a href="https://gxufy.com/multichat">
  <img src="https://i.nuuls.com/BN5W6.gif" alt="MultiChat overlay preview" width="760" />
</a>

[**Live Site**](https://gxufy.com/) · [**Open Generator**](https://gxufy.com/multichat)

</div>

---

MultiChat combines **Kick, Twitch, YouTube, and TikTok** chat into one customizable browser-source overlay, with a separate multi-platform viewer counter.

Chat and viewer counts require **no login**. Twitch authentication is optional and is used only for native Twitch pinned messages.

## Features

- One unified Kick, Twitch, YouTube, and TikTok chat overlay
- Separate real-time multi-platform viewer counter
- 7TV, BTTV, and FFZ emotes
- 7TV paints, cosmetics, badges, and zero-width emotes
- Native platform badges, source markers, replies, and pinned messages
- Twitch Shared Chat and Hype Train support
- Font, size, color, stroke, shadow, emote scale, bold, and uppercase controls
- Fade, entrance animation, slide-in, and smooth scrolling
- Colored @mentions, avatars, transparent/custom backgrounds, and message colors
- Moderation actions, bot filtering, and username/message-prefix blacklists
- Fullscreen image, YouTube, and TTS chat commands
- Generator UI is code-split away from the OBS browser-source startup path

## Commands

Commands must be the **first word** of a chat message and require moderator or broadcaster access.

| Command | What it does |
| :--- | :--- |
| `!multichat ping` | Shows **Pong!** for 3 seconds. |
| `!multichat reload` | Reloads the browser source. |
| `!multichat stop` | Clears active notifications, images, and videos. |
| `!multichat show` / `hide` | Shows or hides chat without disconnecting. |
| `!multichat kickon` / `kickoff` | Shows or hides Kick messages. |
| `!multichat twitchon` / `twitchoff` | Shows or hides Twitch messages. |
| `!multichat youtubeon` / `youtubeoff` | Shows or hides YouTube messages. |
| `!multichat tiktokon` / `tiktokoff` | Shows or hides TikTok messages. |
| `!multichat sharedon` / `sharedoff` | Enables or disables Twitch Shared Chat display. |
| `!multichat counterbgon` / `counterbgoff` | Shows or hides the viewer-counter pill background. |
| `!multichat refresh [emotes]` | Reloads 7TV, BTTV, and FFZ emotes without reloading OBS. |
| `!multichat img <url\|emote> [-t seconds] [-o opacity]` | Shows a fullscreen image or emote. Use `img clear` to dismiss it. |
| `!multichat yt <url\|preset> [-t seconds] [-m]` | Plays a fullscreen YouTube video. Presets: `bruh`, `vine-boom`, `dc-ping`, `rickroll`, `win-error`. |
| `!multichat tts <message>` | Reads a message aloud through the browser source. |

The generator's **Commands & help** section uses the same command registry as the overlay.

## Supported Services

| Service | Support |
| :--- | :--- |
| **Twitch** | Chat, emotes, badges, moderation, Shared Chat, pins, Hype Trains |
| **Kick** | Chat, emotes, badges, moderation, pins |
| **YouTube** | Live chat, native emoji, badges, memberships, Super Chats, pins |
| **TikTok** | Live comments, badges, gifts, subscriptions, follows, shares, pins |
| **7TV** | Global/channel emotes, zero-width emotes, paints, badges, cosmetics |
| **BTTV** | Global and channel emotes |
| **FFZ** | Global/channel emotes and badges |

## OBS Setup

Chat and the viewer counter use **separate browser-source URLs**.

1. Open [**gxufy.com/multichat**](https://gxufy.com/multichat).
2. Enter your channel name(s) and customize the overlay.
3. Copy the generated **Chat URL** into an OBS Browser Source.
4. A good starting size is **680 × 280**. A wider **830 × 230** layout also works well.
5. Add the generated **Viewer Counter URL** as its own Browser Source if you want the counter.

---

<div align="center">
  Built by <a href="https://guns.lol/gxufy"><strong>gxufy</strong></a>
</div>
