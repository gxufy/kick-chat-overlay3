export interface KickChannel {
  id: number;
  user_id: number;
  slug: string;
  chatroom: { id: number };
  subscriber_badges: Array<{
    id: number;
    months: number;
    badge_image: { src: string };
  }>;
  user: { id: number; username: string };
}

export interface SevenTVEmote {
  name: string;
  image: string;
  height: number;
  width: number;
  zeroWidth: boolean;
  upscale: boolean;  // render at full line-height (chatis 'upscale' flag)
}

export interface SevenTVPaint {
  id: string;
  func: string;
  angle?: number;
  color?: number;
  repeat: boolean;
  shadows: Array<{ color: number; x_offset: number; y_offset: number; radius: number }>;
  stops: Array<{ color: number; at: number }>;
  image_url?: string;
  shape?: string;
}

export interface SevenTVBadge {
  id: string;
  image: string;
}

export interface Entitlements {
  [userId: string]: { badge?: string; paint?: string };
}

export interface ParsedMessage {
  id: string;
  platform?: 'kick' | 'twitch' | 'youtube' | 'tiktok';
  /** platform sender id — enables ban-by-author deletion (yt) */
  senderId?: string;
  /** event card category for kind === 'system' */
  category?: string;
  /** redeem/highlighted message — truthy = highlight; string = reward title */
  redeem?: boolean | string;
  /** avatar URL (yt/tiktok) */
  avatar?: string;
  /** original UnifiedMessage — kept so late-arriving 7TV cosmetics can rebuild the rendered line */
  raw?: unknown;
  /** system events (gifts, subs, superchats) render without name colon */
  kind?: 'chat' | 'system';
  timestamp?: number;
  identity: {
    username: string;
    color: string;
    background: string;
    filter: string;
    badges: React.ReactNode[];
    /** render name as a colored pill (yt owner gold) — 'bg|fg' */
    namePill?: string;
  };
  message: React.ReactNode[];
}

export async function getKickChannel(channel: string): Promise<KickChannel | null> {
  try {
    const res = await fetch(`https://kick.com/api/v2/channels/${channel}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/* One 7TV ActiveEmote → our SevenTVEmote. Shared by every set source
   (the global set, a connection's inline set, and the by-id set fetch) so
   an emote is shaped identically no matter which request delivered it —
   the "one parser" the v3 split fetch feeds. */
function mapSevenTVEmote(e: any): SevenTVEmote {
  return {
    name: e.name,
    image: `https://cdn.7tv.app/emote/${e.id}/4x.webp`,
    height: e.data?.host?.files?.[3]?.height ?? e.data?.host?.files?.[1]?.height ?? 28,
    width: e.data?.host?.files?.[3]?.width ?? e.data?.host?.files?.[1]?.width ?? 28,
    zeroWidth: (e.data?.flags & 256) === 256,
    upscale: (e.data?.flags & 128) === 128,
  };
}

/* An emote set's `emotes` array (from any endpoint) → our shape, dropping
   malformed entries that lack a name or id. `emotes` is not a guaranteed
   field on EmoteSetModel, so a missing array degrades to empty, not throw. */
function mapEmoteSet(set: any): SevenTVEmote[] {
  return (set?.emotes ?? [])
    .filter((e: any) => e && e.name && e.id)
    .map(mapSevenTVEmote);
}

export async function getSevenTVGlobalEmotes(): Promise<SevenTVEmote[]> {
  try {
    const res = await fetch('https://7tv.io/v3/emote-sets/global');
    if (!res.ok) return [];
    return mapEmoteSet(await res.json());
  } catch {
    return [];
  }
}

/* Fetch a 7TV emote set by id — the v3 follow-up request. 7TV's documented
   "Adapt to upcoming 7TV API change" makes GET /v3/users/:platform/:id able
   to return emote_set: null while emote_set_id is still populated; the full
   set then comes from GET /v3/emote-sets/:id. */
export async function getSevenTVEmoteSet(setId: string): Promise<SevenTVEmote[]> {
  try {
    const res = await fetch(`https://7tv.io/v3/emote-sets/${setId}`);
    if (!res.ok) return [];
    return mapEmoteSet(await res.json());
  } catch {
    return [];
  }
}

export async function getSevenTVChannelEmotes(userId: string, platform: 'kick' | 'twitch' = 'kick'): Promise<{ emotes: SevenTVEmote[]; setId: string | null; stvUserId: string | null }> {
  try {
    const res = await fetch(`https://7tv.io/v3/users/${platform}/${userId}`);
    if (!res.ok) return { emotes: [], setId: null, stvUserId: null };
    const data = await res.json();
    // NOTE: root `id` is the PLATFORM connection id; the actual 7TV
    // user id (needed for the presence POST) is `user.id`.
    const stvUserId = data?.user?.id ?? null;
    const emoteSet = data?.emote_set;
    // v3: emote_set may be null/omitted while emote_set_id is populated.
    // The id is authoritative for both the emote list and the SSE
    // subscription, so prefer it and fall back to the inline set's id.
    const setId: string | null = data?.emote_set_id ?? emoteSet?.id ?? null;

    // Legacy fast path: the connection already carries its set's emotes.
    const inline = mapEmoteSet(emoteSet);
    if (inline.length) return { emotes: inline, setId, stvUserId };

    // v3 path: no inline emotes, but a set id — fetch the full set.
    if (setId) return { emotes: await getSevenTVEmoteSet(setId), setId, stvUserId };

    // Unregistered user, or a connection with no set at all.
    return { emotes: [], setId, stvUserId };
  } catch {
    return { emotes: [], setId: null, stvUserId: null };
  }
}

export function decimalToRGBA(decimal: number): string {
  const r = (decimal >>> 24) & 255;
  const g = (decimal >>> 16) & 255;
  const b = (decimal >>> 8) & 255;
  const a = ((decimal & 255) / 255).toFixed(3);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
