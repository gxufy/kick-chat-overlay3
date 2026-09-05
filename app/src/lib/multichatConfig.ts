/* Authoritative MultiChat configuration module.
 *
 * Owns two responsibilities that used to live in two different files:
 *
 *   1. Parsing — the overlay query schema, moved verbatim from
 *      pages/multichat.tsx. Every parameter, numeric alias, boolean coercion,
 *      and transform stays centralized here.
 *   2. Serialization — buildMultichatQuery, moved from the URLSearchParams
 *      assembly the original generator page held.
 *
 * CRISP CHAT DEFAULT
 *
 * New overlays use Open Sans, the compact medium preset, and no shadow or
 * stroke by default. Message text starts semibold while the existing Bold
 * messages control remains available as an explicit heavier option.
 *
 * RETIRED PIN PARAMETERS
 *
 * showPinEnabled and pinPlatforms remain accepted in the schema and retained in
 * the public style types so old links and callers do not fail validation, but
 * they normalize to disabled values and are no longer serialized by the site.
 * This makes old `showPinEnabled=true` URLs harmless instead of leaving a hidden
 * path that can turn pins back on.
 *
 * Browser-safe — no server-only imports, no secrets.
 */
import { z } from 'zod';
import { googleFontValue } from './overlayFonts';
import { DEFAULT_TWITCH_GIF_SIZE_PX, normalizeTwitchGifSize } from './twitchGifConfig';
import { normalizeBadgeLayout } from './badgeLayout';

/** Supported chat platforms. */
export const MULTICHAT_PLATFORMS = ['kick', 'twitch', 'youtube', 'tiktok'] as const;

export type MultichatPlatform = (typeof MULTICHAT_PLATFORMS)[number];

/* ------------------------------------------------------------------ */
/* Authoritative enum tuples                                           */
/* ------------------------------------------------------------------ */

/*
 * The value sets the parser accepts, extracted from the schema transforms
 * below so a workspace catalog can reference them instead of restating them.
 *
 * Order is load-bearing twice over: it is the order the legacy numeric aliases
 * map to (1-based index), and it is the order the generator's own <select>
 * elements list. Both were already true of the inline arrays these replace, so
 * nothing about parsing changed — only where the values live.
 */

/** `textShadow=` values. Legacy aliases 1–4. */
export const MULTICHAT_TEXT_SHADOWS = ['none', 'small', 'medium', 'large'] as const;

/** `textSize=` values. Legacy aliases 1–3. */
export const MULTICHAT_TEXT_SIZES = ['small', 'medium', 'large'] as const;

/** `animation=` values. Legacy aliases 1–3. */
export const MULTICHAT_ANIMATIONS = ['none', 'slide', 'fade'] as const;

/** `stroke=` values. Legacy aliases 1–5. */
export const MULTICHAT_STROKES = ['none', 'thin', 'medium', 'thick', 'thicker'] as const;

/**
 * `sourceTag=` values, in parser order.
 *
 * All four are implemented by the overlay, and the generator reaches all four
 * through MultichatWorkspaceStyle. MULTICHAT_GENERATOR_DEFAULTS still holds the
 * legacy boolean, which can only express `icon` (by omitting the parameter) and
 * `none`; it is kept so already-copied URLs keep serializing identically.
 */
export const MULTICHAT_SOURCE_TAGS = ['none', 'dot', 'label', 'icon'] as const;

/**
 * The same four values in workspace display order, strongest tag first.
 *
 * Separate from MULTICHAT_SOURCE_TAGS because that tuple's order is the
 * parser's and carries no legacy numeric aliases to preserve. A test asserts
 * the two hold exactly the same set, so this cannot drift into a different
 * vocabulary.
 */
export const MULTICHAT_SOURCE_TAG_ORDER = ['icon', 'dot', 'label', 'none'] as const;

/** `font=` values, in generator display order. Legacy aliases 1–12 stay pinned. */
export const MULTICHAT_FONTS = [
  'baloo',
  'segoe',
  'roboto',
  'lato',
  'noto',
  'sourcecode',
  'impact',
  'comfortaa',
  'dancing',
  'indieflower',
  'opensans',
  'alsina',
  'geist',
] as const;

export type MultichatTextShadow = (typeof MULTICHAT_TEXT_SHADOWS)[number];
export type MultichatTextSize = (typeof MULTICHAT_TEXT_SIZES)[number];
export type MultichatAnimation = (typeof MULTICHAT_ANIMATIONS)[number];
export type MultichatStroke = (typeof MULTICHAT_STROKES)[number];
export type MultichatSourceTag = (typeof MULTICHAT_SOURCE_TAGS)[number];
export type MultichatFont = (typeof MULTICHAT_FONTS)[number];

/**
 * The legacy numeric alias map for a tuple: '1' → first value, and so on.
 *
 * Derived rather than written out, which is what keeps an alias from ever
 * pointing at the wrong value. Produces exactly the maps that were inline here
 * before.
 */
function numericAliases(values: readonly string[]): Record<string, string> {
  return Object.fromEntries(values.map((value, index) => [String(index + 1), value]));
}

/** Resolve a raw parameter through its aliases, then its value set. */
function fromEnum<T extends string>(
  raw: string | undefined,
  values: readonly T[],
  fallback: T,
): T {
  const aliased = numericAliases(values)[raw ?? ''];
  if (aliased !== undefined) return aliased as T;
  return (values as readonly string[]).includes(raw ?? '') ? (raw as T) : fallback;
}

/* ------------------------------------------------------------------ */
/* Parser — moved verbatim from pages/multichat.tsx                    */
/* ------------------------------------------------------------------ */

export const MultichatQuerySchema = z.object({
  /** legacy param — same as kick= */
  channel: z.string().optional(),
  kick: z.string().optional(),
  twitch: z.string().optional(),
  youtube: z.string().optional(),
  tiktok: z.string().optional(),
  sevenTVCosmeticsEnabled: z.string().optional().transform(v => v !== 'false'),
  sevenTVEmotesEnabled: z.string().optional().transform(v => v !== 'false'),
  /* Third-party/community badges (Chatterino, FFZ community, Homies, etc.). */
  showCommunityBadges: z.string().optional().transform(v => v !== 'false'),
  badgeLayout: z.string().optional(),
  textShadow: z.string().optional().transform(v =>
    fromEnum(v, MULTICHAT_TEXT_SHADOWS, 'large')),
  textSize: z.string().optional().transform(v =>
    fromEnum(v, MULTICHAT_TEXT_SIZES, 'medium')),
  animation: z.string().optional().transform(v =>
    fromEnum(v, MULTICHAT_ANIMATIONS, 'slide')),
  /* Retired compatibility parameter: pins can no longer be enabled by a URL. */
  showPinEnabled: z.string().optional().transform(() => false),
  /* Platform event cards/popups. Omitted means ON for backward compatibility. */
  showSystemMsgs: z.string().optional().transform(v => v !== 'false'),
  
  mentionColor: z.string().optional().transform(v => v !== 'false'),
  /* chat background: 'transparent' (default) or a hex color like 191919 */
  bgColor: z.string().optional().transform(v =>
    /^[0-9a-fA-F]{6}$/.test(v ?? '') ? `#${v}` : ''),
  /* Event visibility controls. Omitted means ON for backward compatibility. */
  showHypeTrains: z.string().optional().transform(v => v !== 'false'),
  showFirstMessages: z.string().optional().transform(v => v !== 'false'),
  /* Channel-point / reward redeems (currently Twitch + Kick). */
  showRedeems: z.string().optional().transform(v => v !== 'false'),
  
  sourceTag: z.string().optional().transform(v =>
    ((MULTICHAT_SOURCE_TAGS as readonly string[]).includes(v ?? '')
      ? v!
      : 'icon') as MultichatSourceTag),
  /* profile pictures (yt/tiktok) — off by default */
  showAvatars: z.string().optional().transform(v => v === 'true'),
  /* Preset aliases remain accepted, while a custom family passes through to
     the safe Google Fonts resolver in overlayFonts.ts. */
  font: z.string().optional().transform(v =>
    (numericAliases(MULTICHAT_FONTS.slice(0, 12))[v ?? ''] ?? v?.trim()) || 'opensans'),
  stroke: z.string().optional().transform(v =>
    fromEnum(v, MULTICHAT_STROKES, 'none')),
  emoteScale: z.string().optional().transform(v => { const n = parseFloat(v ?? ''); return isNaN(n) ? 1 : n; }),
  /* Twitch native GIF messages are explicitly opt-in. */
  gifs: z.string().optional().transform(v => v === '1' || v === 'true'),
  gifSize: z.string().optional().transform(v => normalizeTwitchGifSize(v)),
  fade: z.string().optional().transform(v => { const n = parseInt(v ?? ''); return isNaN(n) ? (false as const) : n; }),
  
  msgBold: z.string().optional().transform(v => v !== 'false'),
  msgCaps: z.string().optional().transform(v => v === 'true'),
  
  msgSlideIn: z.string().optional().transform(v => v === '1' || v === 'true'),
  
  smoothScroll: z.string().optional().transform(v => v === '1' || v === 'true'),
  /* Twitch Shared Chat partner messages + source-streamer avatars. Default OFF. */
  sharedChatEnabled: z.string().optional().transform(v => v === '1' || v === 'true'),
  fontColor: z.string().optional().transform(v =>
    /^[0-9a-fA-F]{6}$/.test(v ?? '') ? `#${v}` : ''),
  paintShadows: z.string().optional().transform(v => v !== 'false'),
  modAction: z.string().optional().transform(v => v !== 'false'),
  userBL: z.string().optional().transform(v => v ?? ''),
  prefixBL: z.string().optional().transform(v => v ?? ''),
  /* Retired compatibility parameter: platform pin selections are ignored. */
  pinPlatforms: z.string().optional().transform(() => [] as string[]),
  hideNames: z.string().optional().transform(v => v === 'true'),
  botNames: z.string().optional().transform(v => v ?? ''),
  /* compatibility-only: parsed, read by no runtime code */
  ttsEnabled: z.string().optional().transform(v => v !== 'false'),
});

/** A fully parsed MultiChat overlay configuration. */
export type MultichatConfig = z.infer<typeof MultichatQuerySchema>;

/**
 * Parameters that are parsed purely for URL compatibility and read by no
 * runtime code at HEAD. Kept so existing URLs carrying them still parse.
 */
export const MULTICHAT_UNREAD_PARAMS = [
  'ttsEnabled',
  'showAvatars',
] as const;

/**
 * Parse a `router.query`-shaped object into a MultiChat configuration.
 *
 * Returns zod's discriminated result, exactly as the overlay page consumed it
 * before this module existed: repeated (array-valued) parameters fail, and
 * unknown keys are stripped rather than rejected.
 */
export function safeParseMultichatConfig(query: unknown) {
  return MultichatQuerySchema.safeParse(query);
}

/** The kick channel, honouring the legacy `channel=` alias. */
export function multichatKickChannel(config: MultichatConfig): string {
  return config.kick || config.channel || '';
}

/**
 * How many platforms a parsed configuration actually names.
 *
 * This is the overlay/generator mode switch: zero means the route renders the
 * generator, one or more means it renders the overlay.
 */
export function multichatPlatformCount(config: MultichatConfig): number {
  return [
    multichatKickChannel(config),
    config.twitch,
    config.youtube,
    config.tiktok,
  ].filter(Boolean).length;
}

/** True when a parsed configuration names at least one platform channel. */
export function hasConfiguredMultichatChannel(config: MultichatConfig): boolean {
  return multichatPlatformCount(config) > 0;
}

/**
 * What an omitted parameter resolves to on a /multichat overlay URL.
 *
 * Derived from the schema itself rather than restated, so it can never drift.
 * `textShadow` is 'large' here, matching the pre-xqc default.
 */
export const MULTICHAT_OVERLAY_DEFAULTS: MultichatConfig =
  MultichatQuerySchema.parse({});

/* ------------------------------------------------------------------ */
/* Serializer — moved verbatim from the original generator page        */
/* ------------------------------------------------------------------ */

/** Raw channel inputs, exactly as typed into the generator. */
export type MultichatChannels = {
  /** The Kick channel. Serialized as `kick=`. */
  kick: string;
  twitch: string;
  youtube: string;
  tiktok: string;
};

/**
 * The generator's style state, in the same shapes the controls hold it.
 *
 * Strings stay strings (`fade`, `emoteScale`, `gifSize`) because the generator
 * stores them as raw input text and its emptiness is meaningful when deciding
 * whether to emit the parameter at all.
 */
export type MultichatGeneratorStyle = {
  sevenTVEmotesEnabled: boolean;
  sevenTVCosmeticsEnabled: boolean;
  /** Show third-party/community badges while preserving native platform badges. */
  showCommunityBadges: boolean;
  /** Ordered badge providers; !provider means hidden. Empty is the default layout. */
  badgeLayout?: string;
  textSize: string;
  font: string;
  /** Optional Google Fonts family; when non-empty it overrides the preset font. */
  googleFont: string;
  textShadow: string;
  stroke: string;
  animation: string;
  /** Raw seconds input. Emitted only when `fadeEnabled` and non-empty. */
  fade: string;
  fadeEnabled: boolean;
  /** Retired compatibility field. Always false in current defaults/output. */
  showPinEnabled: boolean;
  /** False emits `sourceTag=none`; true emits nothing. */
  platformIcons: boolean;
  mentionColor: boolean;
  /** '' means transparent. A leading '#' is stripped when emitted. */
  bgColor: string;
  /** Raw input. Emitted only when non-empty. */
  emoteScale: string;
  /** Display Twitch's native GIF-tag messages instead of their fallback text. */
  gifs: boolean;
  /** Raw GIF maximum height in pixels. */
  gifSize: string;
  msgBold: boolean;
  msgCaps: boolean;
  
  msgSlideIn: boolean;
  /** Smoothly scroll the message stack as new rows arrive. */
  smoothScroll: boolean;
  /** Include Twitch Shared Chat partner rows and show source-streamer avatars. */
  sharedChatEnabled: boolean;
  /** Show normalized platform event cards/popups across every provider. */
  showSystemMsgs: boolean;
  /** Show Twitch Hype Train banner when the provider exposes one. */
  showHypeTrains: boolean;
  /** Show provider-tagged first-message / first-time-chatter messages. */
  showFirstMessages: boolean;
  /** Show channel-point / reward redemption messages where supported. */
  showRedeems: boolean;
  modAction: boolean;
  paintShadows: boolean;
  /** '' means unset. A leading '#' is stripped when emitted. */
  fontColor: string;
  /** Retired compatibility field. Always empty in current defaults/output. */
  pinPlatforms: readonly string[];
  hideNames: boolean;
  botNames: string;
  userBL: string;
  prefixBL: string;
};

/**
 * Where the generator's controls begin. The site and overlay both start
 * with the original Open Sans presentation.
 */
export const MULTICHAT_GENERATOR_DEFAULTS: MultichatGeneratorStyle = {
  sevenTVEmotesEnabled: true,
  sevenTVCosmeticsEnabled: true,
  showCommunityBadges: true,
  textSize: 'medium',
  font: 'opensans',
  googleFont: '',
  textShadow: 'large',
  stroke: 'none',
  animation: 'slide',
  fade: '30',
  fadeEnabled: true,
  showPinEnabled: false,
  platformIcons: true,
  mentionColor: true,
  bgColor: '',
  emoteScale: '',
  gifs: false,
  gifSize: String(DEFAULT_TWITCH_GIF_SIZE_PX),
  msgBold: true,
  msgCaps: false,
  msgSlideIn: false,
  smoothScroll: false,
  sharedChatEnabled: false,
  showSystemMsgs: true,
  showHypeTrains: true,
  showFirstMessages: true,
  showRedeems: true,
  modAction: true,
  paintShadows: true,
  fontColor: '',
  pinPlatforms: [],
  hideNames: false,
  botNames: '',
  userBL: '',
  prefixBL: '',
};

/* ------------------------------------------------------------------ */
/* Workspace style — the generator state, with the full sourceTag enum  */
/* ------------------------------------------------------------------ */

/**
 * What the generator workspace holds, as an explicit adapter over the legacy
 * state.
 *
 * Identical to MultichatGeneratorStyle except that `platformIcons: boolean` is
 * replaced by the full `sourceTag` enum. This is the shape the generator holds.
 */
export type MultichatWorkspaceStyle = Omit<MultichatGeneratorStyle, 'platformIcons'> & {
  /** 'icon' omits the parameter, matching the overlay's own default. */
  sourceTag: MultichatSourceTag;
};

/** Either style shape the authoritative serializer accepts. */
export type MultichatSerializableStyle =
  | MultichatGeneratorStyle
  | MultichatWorkspaceStyle;

/**
 * Which sourceTag a style of either shape means.
 *
 * The legacy mapping is exactly what buildMultichatQuery has always encoded:
 * platformIcons true means the parameter is omitted, and an omitted parameter
 * parses as 'icon'; false means 'none'.
 */
export function multichatSourceTagOf(
  style: MultichatSerializableStyle,
): MultichatSourceTag {
  if ('sourceTag' in style) return style.sourceTag;
  return style.platformIcons ? 'icon' : 'none';
}

/**
 * Where the workspace controls begin. It inherits the original pre-xqc default
 * and retired pin values from MULTICHAT_GENERATOR_DEFAULTS; only smooth scrolling and the
 * source-tag representation differ.
 */
export const MULTICHAT_WORKSPACE_DEFAULTS: MultichatWorkspaceStyle = (() => {
  const { platformIcons, ...shared } = MULTICHAT_GENERATOR_DEFAULTS;
  return {
    ...shared,
    smoothScroll: true,
    sourceTag: platformIcons ? 'icon' : 'none',
  };
})();

/** Channel state matching MULTICHAT_GENERATOR_DEFAULTS — all empty. */
export const MULTICHAT_GENERATOR_DEFAULT_CHANNELS: MultichatChannels = {
  kick: '',
  twitch: '',
  youtube: '',
  tiktok: '',
};

/**
 * Build the MultiChat overlay query string the generator copies.
 *
 * Retired pin fields are intentionally ignored: new links do not carry pin
 * toggles or platform selections, while the parser still accepts old params.
 * The returned string carries no leading '?' and no fragment.
 */
export function buildMultichatQuery(
  channels: MultichatChannels,
  style: MultichatSerializableStyle,
): string {
  const { kick: channel, twitch, youtube, tiktok } = channels;
  const {
    sevenTVEmotesEnabled: sevenTVE, sevenTVCosmeticsEnabled: sevenTVC,
    showCommunityBadges, badgeLayout,
    textSize, font, googleFont, textShadow, stroke, animation,
    fade, fadeEnabled: fadeBool,
    mentionColor, bgColor, emoteScale, gifs, gifSize, msgBold, msgCaps, msgSlideIn, smoothScroll, sharedChatEnabled, showSystemMsgs, showHypeTrains, showFirstMessages, showRedeems, modAction,
    paintShadows, fontColor, hideNames,
    botNames, userBL, prefixBL,
  } = style;
  /* Both shapes collapse to one tag. 'icon' omits the parameter, which is what
     the legacy platformIcons=true branch did, so legacy output is unchanged. */
  const sourceTag = multichatSourceTagOf(style);
  const workspaceStyle = 'sourceTag' in style;
  const selectedFont = googleFontValue(googleFont) ?? font;

  const params = new URLSearchParams({
    ...(channel.trim() ? { kick: channel.trim() } : {}),
    ...(twitch.trim()  ? { twitch: twitch.trim().replace(/^@/, '') } : {}),
    ...(youtube.trim() ? { youtube: youtube.trim().replace(/^@/, '') } : {}),
    ...(tiktok.trim()  ? { tiktok: tiktok.trim().replace(/^@/, '') } : {}),
    // no platform filled → placeholder so the URL preview stays valid
    ...(!channel.trim() && !twitch.trim() && !youtube.trim() && !tiktok.trim() ? { kick: 'yourchannel' } : {}),
    sevenTVEmotesEnabled:    String(sevenTVE),
    sevenTVCosmeticsEnabled: String(sevenTVC),
    ...(showCommunityBadges ? {} : { showCommunityBadges: 'false' }),
    ...(normalizeBadgeLayout(badgeLayout) ? { badgeLayout: normalizeBadgeLayout(badgeLayout) } : {}),
    textSize, font: selectedFont, textShadow, stroke, animation,
    ...(fadeBool && fade !== '' ? { fade } : {}),
    /* Same slot the legacy sourceTag=none occupied — position is part of the
       compatibility surface, so dot/label land here too rather than at the end. */
    ...(sourceTag === 'icon' ? {} : { sourceTag }),
    ...(mentionColor ? {} : { mentionColor: 'false' }),
    ...(bgColor ? { bgColor: bgColor.replace('#', '') } : {}),
    ...(emoteScale !== '' ? { emoteScale } : {}),
    ...(gifs ? { gifs: 'true', ...(gifSize.trim() ? { gifSize: String(normalizeTwitchGifSize(gifSize)) } : {}) } : {}),
    ...(msgBold ? {} : { msgBold: 'false' }),
    ...(msgCaps ? { msgCaps: 'true' } : {}),
    
    ...(msgSlideIn ? { msgSlideIn: '1' } : {}),
    ...(workspaceStyle
      ? (smoothScroll ? {} : { smoothScroll: '0' })
      : (smoothScroll ? { smoothScroll: '1' } : {})),
    ...(sharedChatEnabled ? { sharedChatEnabled: '1' } : {}),
    ...(showSystemMsgs ? {} : { showSystemMsgs: 'false' }),
    ...(showHypeTrains ? {} : { showHypeTrains: 'false' }),
    ...(showFirstMessages ? {} : { showFirstMessages: 'false' }),
    ...(showRedeems ? {} : { showRedeems: 'false' }),
    ...(modAction ? {} : { modAction: 'false' }),
    ...(paintShadows ? {} : { paintShadows: 'false' }),
    ...(fontColor ? { fontColor: fontColor.replace('#', '') } : {}),
    hideNames:   String(hideNames),
    ...(botNames.trim() ? { botNames: botNames.trim() } : {}),
    ...(userBL.trim() ? { userBL: userBL.trim() } : {}),
    ...(prefixBL.trim() ? { prefixBL: prefixBL.trim() } : {}),
  });

  return params.toString();
}
