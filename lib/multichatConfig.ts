/* Authoritative MultiChat configuration module.
 *
 * Owns two responsibilities that used to live in two different files:
 *
 *   1. Parsing — the overlay query schema, moved verbatim from
 *      pages/multichat.tsx. Every parameter, default, numeric alias, boolean
 *      coercion, and transform is byte-for-byte the same, so every overlay URL
 *      already pasted into OBS keeps rendering identically.
 *   2. Serialization — buildMultichatQuery, moved verbatim from the
 *      URLSearchParams assembly in components/LandingPage.tsx. Parameter
 *      order, inclusion rules, and encoding are preserved exactly, because the
 *      copied URL string is part of the compatibility surface.
 *
 * TWO DELIBERATELY SEPARATE DEFAULT SETS
 *
 * The overlay parser and the generator start from different values, and both
 * are load-bearing:
 *
 *   - MULTICHAT_OVERLAY_DEFAULTS — what a /multichat URL resolves to when a
 *     parameter is absent. textShadow is 'large' here. Changing it would
 *     restyle every existing overlay URL that omits the parameter.
 *   - MULTICHAT_GENERATOR_DEFAULTS — what the generator's controls begin at.
 *     textShadow is 'small' here, and the generator always serializes the
 *     parameter explicitly, so a generated URL never relies on the overlay
 *     default.
 *
 * These are not reconciled, and neither is a bug. They are separate concepts:
 * one is "what an omitted parameter means", the other is "where the UI starts".
 *
 * Browser-safe — no server-only imports, no secrets.
 */
import { z } from 'zod';

/** Platforms that can carry a channel and appear in pinPlatforms. */
export const MULTICHAT_PLATFORMS = ['kick', 'twitch', 'youtube', 'tiktok'] as const;

export type MultichatPlatform = (typeof MULTICHAT_PLATFORMS)[number];

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
  textShadow: z.string().optional().transform(v => {
    const map: Record<string,string> = {'1':'none','2':'small','3':'medium','4':'large'};
    return map[v??''] ?? (['none','small','medium','large'].includes(v??'') ? v! : 'large');
  }),
  textSize: z.string().optional().transform(v => {
    const map: Record<string,string> = {'1':'small','2':'medium','3':'large'};
    return map[v??''] ?? (['small','medium','large'].includes(v??'') ? v! : 'medium');
  }),
  animation: z.string().optional().transform(v => {
    const map: Record<string,string> = {'1':'none','2':'slide','3':'fade'};
    return map[v??''] ?? (['none','slide','fade'].includes(v??'') ? v! : 'slide');
  }),
  showPinEnabled: z.string().optional().transform(v => v === 'true'),
  /* compatibility-only: parsed for URL compatibility, read by no runtime code */
  showSystemMsgs: z.string().optional().transform(v => v !== 'false'),
  /* UChat-style colorable mentions — default ON (mentionColor=false to disable) */
  mentionColor: z.string().optional().transform(v => v !== 'false'),
  /* chat background: 'transparent' (default) or a hex color like 191919 */
  bgColor: z.string().optional().transform(v =>
    /^[0-9a-fA-F]{6}$/.test(v ?? '') ? `#${v}` : ''),
  /* channel-point redeems (kick/twitch highlighted messages).
     compatibility-only: parsed, read by no runtime code */
  showRedeems: z.string().optional().transform(v => v !== 'false'),
  /* StreamNook sourceTag: none | dot | label | icon (default icon —
     official brand marks, same art Streamlabs uses) */
  sourceTag: z.string().optional().transform(v =>
    (['none','dot','label','icon'].includes(v ?? '') ? v! : 'icon') as 'none'|'dot'|'label'|'icon'),
  /* profile pictures (yt/tiktok) — off by default */
  showAvatars: z.string().optional().transform(v => v === 'true'),
  font: z.string().optional().transform(v => {
    const map: Record<string,string> = {'1':'baloo','2':'segoe','3':'roboto','4':'lato','5':'noto','6':'sourcecode','7':'impact','8':'comfortaa','9':'dancing','10':'indieflower','11':'opensans','12':'alsina'};
    return map[v??''] ?? v ?? 'opensans';
  }),
  stroke: z.string().optional().transform(v => {
    const map: Record<string,string> = {'1':'none','2':'thin','3':'medium','4':'thick','5':'thicker'};
    return map[v??''] ?? (['none','thin','medium','thick','thicker'].includes(v??'') ? v! : 'none');
  }),
  emoteScale: z.string().optional().transform(v => { const n = parseFloat(v ?? ''); return isNaN(n) ? 1 : n; }),
  fade: z.string().optional().transform(v => { const n = parseInt(v ?? ''); return isNaN(n) ? (false as const) : n; }),
  /* ── UChat-ported settings ── */
  msgBold: z.string().optional().transform(v => v !== 'false'),
  msgCaps: z.string().optional().transform(v => v === 'true'),
  fontColor: z.string().optional().transform(v =>
    /^[0-9a-fA-F]{6}$/.test(v ?? '') ? `#${v}` : ''),
  paintShadows: z.string().optional().transform(v => v !== 'false'),
  modAction: z.string().optional().transform(v => v !== 'false'),
  userBL: z.string().optional().transform(v => v ?? ''),
  prefixBL: z.string().optional().transform(v => v ?? ''),
  /* per-platform pins: CSV of kick,twitch,youtube,tiktok
   * - absent → default to all four (backward compat)
   * - present but empty → [] (no pins at all)
   * - valid names → only those; invalid ignored, duplicates removed */
  pinPlatforms: z.string().optional().transform(v => {
    const all = ['kick', 'twitch', 'youtube', 'tiktok'];
    if (v === undefined) return all;       // param absent → default
    if (v === '') return [];                // param explicitly empty → none
    const picked = [...new Set(v.split(',').map(s => s.trim().toLowerCase()).filter(s => all.includes(s)))];
    return picked.length ? picked : all;    // no valid names → fallback to all
  }),
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
  'showSystemMsgs',
  'showRedeems',
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
 * `textShadow` is 'large' here — see the module header.
 */
export const MULTICHAT_OVERLAY_DEFAULTS: MultichatConfig =
  MultichatQuerySchema.parse({});

/* ------------------------------------------------------------------ */
/* Serializer — moved verbatim from components/LandingPage.tsx         */
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
 * Strings stay strings (`fade`, `emoteScale`) because the generator stores
 * them as raw input text and its emptiness is meaningful when deciding
 * whether to emit the parameter at all.
 */
export type MultichatGeneratorStyle = {
  sevenTVEmotesEnabled: boolean;
  sevenTVCosmeticsEnabled: boolean;
  textSize: string;
  font: string;
  textShadow: string;
  stroke: string;
  animation: string;
  /** Raw seconds input. Emitted only when `fadeEnabled` and non-empty. */
  fade: string;
  fadeEnabled: boolean;
  showPinEnabled: boolean;
  /** False emits `sourceTag=none`; true emits nothing. */
  platformIcons: boolean;
  mentionColor: boolean;
  /** '' means transparent. A leading '#' is stripped when emitted. */
  bgColor: string;
  /** Raw input. Emitted only when non-empty. */
  emoteScale: string;
  msgBold: boolean;
  msgCaps: boolean;
  modAction: boolean;
  paintShadows: boolean;
  /** '' means unset. A leading '#' is stripped when emitted. */
  fontColor: string;
  /**
   * Platforms that should show pins, after the caller has applied its own
   * gating. Omitted when all four are present (the overlay default), emitted
   * as '' when none are, and as CSV for any subset.
   */
  pinPlatforms: readonly string[];
  hideNames: boolean;
  botNames: string;
  userBL: string;
  prefixBL: string;
};

/**
 * Where the generator's controls begin.
 *
 * Distinct from MULTICHAT_OVERLAY_DEFAULTS on purpose: `textShadow` is 'small'
 * here and 'large' there. The generator always writes the parameter
 * explicitly, so the two never have to agree. See the module header.
 */
export const MULTICHAT_GENERATOR_DEFAULTS: MultichatGeneratorStyle = {
  sevenTVEmotesEnabled: true,
  sevenTVCosmeticsEnabled: true,
  textSize: 'medium',
  font: 'opensans',
  textShadow: 'small',
  stroke: 'none',
  animation: 'slide',
  fade: '30',
  fadeEnabled: true,
  showPinEnabled: true,
  platformIcons: true,
  mentionColor: true,
  bgColor: '',
  emoteScale: '',
  msgBold: true,
  msgCaps: false,
  modAction: true,
  paintShadows: true,
  fontColor: '',
  pinPlatforms: ['kick', 'youtube', 'tiktok'],
  hideNames: false,
  botNames: '',
  userBL: '',
  prefixBL: '',
};

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
 * Moved verbatim from LandingPage: the key insertion order, the
 * include-versus-omit rules, the boolean spellings, and the encoding are all
 * part of the compatibility surface and are reproduced exactly.
 *
 * Quirks preserved deliberately, not cleaned up:
 *   - `kick` is only trimmed; a leading '@' survives. The other three platforms
 *     have theirs stripped.
 *   - With no platform filled at all, `kick=yourchannel` is emitted as a
 *     placeholder so the previewed URL stays valid.
 *   - `hideNames` is always emitted, even when false; most other booleans are
 *     emitted only on their non-default side.
 *
 * The returned string carries no leading '?' and no fragment. Callers append
 * `#twitchConnectionId=…` themselves, so this function never handles the
 * connection id.
 */
export function buildMultichatQuery(
  channels: MultichatChannels,
  style: MultichatGeneratorStyle,
): string {
  const { kick: channel, twitch, youtube, tiktok } = channels;
  const {
    sevenTVEmotesEnabled: sevenTVE, sevenTVCosmeticsEnabled: sevenTVC,
    textSize, font, textShadow, stroke, animation,
    fade, fadeEnabled: fadeBool, showPinEnabled: showPin, platformIcons,
    mentionColor, bgColor, emoteScale, msgBold, msgCaps, modAction,
    paintShadows, fontColor, pinPlatforms: effectivePinPlats, hideNames,
    botNames, userBL, prefixBL,
  } = style;

  const params = new URLSearchParams({
    ...(channel.trim() ? { kick: channel.trim() } : {}),
    ...(twitch.trim()  ? { twitch: twitch.trim().replace(/^@/, '') } : {}),
    ...(youtube.trim() ? { youtube: youtube.trim().replace(/^@/, '') } : {}),
    ...(tiktok.trim()  ? { tiktok: tiktok.trim().replace(/^@/, '') } : {}),
    // no platform filled → placeholder so the URL preview stays valid
    ...(!channel.trim() && !twitch.trim() && !youtube.trim() && !tiktok.trim() ? { kick: 'yourchannel' } : {}),
    sevenTVEmotesEnabled:    String(sevenTVE),
    sevenTVCosmeticsEnabled: String(sevenTVC),
    textSize, font, textShadow, stroke, animation,
    ...(fadeBool && fade !== '' ? { fade } : {}),
    showPinEnabled:        String(showPin),
    ...(platformIcons ? {} : { sourceTag: 'none' }),
    ...(mentionColor ? {} : { mentionColor: 'false' }),
    ...(bgColor ? { bgColor: bgColor.replace('#', '') } : {}),
    ...(emoteScale !== '' ? { emoteScale } : {}),
    ...(msgBold ? {} : { msgBold: 'false' }),
    ...(msgCaps ? { msgCaps: 'true' } : {}),
    ...(modAction ? {} : { modAction: 'false' }),
    ...(paintShadows ? {} : { paintShadows: 'false' }),
    ...(fontColor ? { fontColor: fontColor.replace('#', '') } : {}),
    /* per-platform pins: omit when all four selected (overlay default),
       encode '' when none selected, encode CSV for subsets */
    ...(effectivePinPlats.length === 0 ? { pinPlatforms: '' } : {}),
    ...(effectivePinPlats.length > 0 && effectivePinPlats.length < 4 ? { pinPlatforms: effectivePinPlats.join(',') } : {}),
    hideNames:   String(hideNames),
    ...(botNames.trim() ? { botNames: botNames.trim() } : {}),
    ...(userBL.trim() ? { userBL: userBL.trim() } : {}),
    ...(prefixBL.trim() ? { prefixBL: prefixBL.trim() } : {}),
  });

  return params.toString();
}
