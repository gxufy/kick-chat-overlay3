# 🕊️ MultiChat | Custom Multi-Platform Chat Overlay

**Live:** https://gxufy.com/

A customizable Kick, Twitch, YouTube and TikTok chat overlay for OBS, with a
separate multi-platform viewer counter.

Chat and viewer counts require no login. Twitch connection is optional and used
only for native Twitch pinned messages.

## Commands

Type a command as the **first word** of a chat message. Kick, Twitch, YouTube
and TikTok all reach the same dispatcher, so a command works from any connected
platform. Moderator or broadcaster permission is required.

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

<!-- prettier-ignore-start -->
| Service | Features |
| :--- | :--- |
| <img src="https://assets.twitch.tv/assets/favicon-32-e29e246c157142c94346.png" width="20" /> **[Twitch](https://www.twitch.tv/)** | **Emotes:** Global, Channel, Follow, Sub, Bit<br>**Badges:** Sub Badges, Bit Badges, Global Badges<br>**Moderation:** Delete Messages, Timeouts, Bans, Chat Clears |
| <img src="https://kick.com/favicon.ico" width="20" /> **[Kick](https://kick.com/)** | **Emotes:** Global, Channel, Sub<br>**Badges:** Sub Badges, Global Badges<br>**Moderation:** Delete Messages, Timeouts, Bans, Chat Clears |
| <img src="https://upload.wikimedia.org/wikipedia/commons/0/09/YouTube_full-color_icon_%282017%29.svg" width="20" /> **[YouTube](https://www.youtube.com/)** | **Emotes:** Native Unicode and YouTube channel emoji<br>**Badges:** Owner, Moderator, Verified, Membership<br>**Events:** Super Chats, Super Stickers, Memberships, Gifted Memberships<br>**Moderation:** Message and Author Deletions |
| <img src="https://7tv.app/favicon.svg" width="20" /> **[7TV](https://7tv.app/)** | **Emotes:** Global, Channel, Personal/Special Sets, Auto Set Updates, Zero-Width<br>**User Customization:** Paints, Badges, Personal/Special Emote Sets |
| <img src="https://betterttv.com/favicon.png" width="20" /> **[BTTV](https://betterttv.com/)** | **Emotes:** Global, Channel, Auto Set Updates |
| <img src="https://www.frankerfacez.com/static/images/favicon-32.png" width="20" /> **[FFZ](https://www.frankerfacez.com/)** | **Emotes:** Global, Channel<br>**User Customization:** Global + Channel Badges |
<!-- prettier-ignore-end -->

## OBS Setup

Chat and the viewer counter are **two separate URLs** in **two separate browser
sources**. Add either, both or neither.

1. Open the generator at [`/multichat`](https://gxufy.com/multichat)
   with no channel in the URL.
2. Enter your channel name(s) and configure the overlays.
3. Copy the **Chat URL** into a Browser Source sized **680 × 280**.
4. Copy the **Viewer Counter URL** into a separate Browser Source sized
   **400 × 80**.

Built by [gxufy](https://guns.lol/gxufy).
