# Community badge sources

The Twitch connector augments native Twitch badges with public community badge registries used by UChat/bChat-compatible overlays.

Current sources:

- UChat / YAUTC
- Chatterino
- Chatterino Homies (legacy and custom)
- Moltorino
- Bluzyrino
- FrankerFaceZ global badges
- BetterTTV user badges
- Turteg
- PolandBOT
- bChat
- FolhinhaPlus
- DankChat

The resolver prefers Twitch numeric user IDs and falls back to case-insensitive usernames only for providers that expose username ownership instead of Twitch IDs. Provider failures are isolated, successful results are cached, and community badge artwork must resolve to HTTPS before it is accepted.

Native Twitch badges and 7TV badges/paints continue through their existing pipelines.
