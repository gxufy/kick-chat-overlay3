/* Shared viewer-counter configuration: types, defaults, parsing, and URL
 * serialization used by both the standalone /counter overlay and the
 * generator preview, so the two can never drift apart.
 *
 * Browser-safe — no server-only imports, no secrets.
 */

/* ------------------------------------------------------------------ */
/* Platforms                                                           */
/* ------------------------------------------------------------------ */

export type ViewerPlatform = 'twitch' | 'youtube' | 'kick' | 'tiktok';

/** Fixed display order, left → right. */
export const PLATFORM_ORDER: readonly ViewerPlatform[] = [
  'twitch',
  'youtube',
  'kick',
  'tiktok',
];

/** Platforms whose counts are fetched through /api/viewers. */
export const SERVER_PLATFORMS: readonly ViewerPlatform[] = [
  'twitch',
  'youtube',
  'tiktok',
];

/* ------------------------------------------------------------------ */
/* Availability model                                                  */
/* ------------------------------------------------------------------ */

/**
 * The four distinct states a platform can be in. Deliberately kept
 * separate so an unavailable count is never displayed or summed as 0.
 *
 *  offline       — confirmed not streaming; clears immediately.
 *  live          — measured concurrent viewers (0 is a valid measurement).
 *  live-unknown  — confirmed live, but no usable concurrent count.
 *  unavailable   — request/parse failed and no fresh value is retained.
 */
export type PlatformCountStatus =
  | { state: 'offline' }
  | { state: 'live'; viewers: number }
  | { state: 'live-unknown' }
  | { state: 'unavailable' };

/** Per-platform statuses, keyed by platform. */
export type PlatformStatuses = Partial<Record<ViewerPlatform, PlatformCountStatus>>;

/* ------------------------------------------------------------------ */
/* Style enums                                                         */
/* ------------------------------------------------------------------ */

export const TEXT_SHADOWS = ['none', 'small', 'medium', 'large'] as const;
export const STROKES = ['none', 'thin', 'medium', 'thick', 'thicker'] as const;
export const ALIGNMENTS = ['left', 'center', 'right'] as const;

export type CounterTextShadow = (typeof TEXT_SHADOWS)[number];
export type CounterStroke = (typeof STROKES)[number];
export type CounterAlign = (typeof ALIGNMENTS)[number];

/* ------------------------------------------------------------------ */
/* Fixed typography — the counter's own visual identity                */
/* ------------------------------------------------------------------ */

/*
 * The counter has one font, one size, and one weight, all fixed here and
 * used by both the standalone overlay and the generator preview through
 * ViewerCounterDisplay. They are deliberately not configurable and are
 * deliberately independent of the MultiChat overlay's font and size
 * controls, so restyling chat can never change a generated counter URL.
 */

/** Fixed family — DejaVuSans-Bold, the previous default. */
export const COUNTER_FONT_FAMILY = "'DejaVu Sans', sans-serif";

/** Fixed size in pixels — the previous 'medium' default. */
export const COUNTER_FONT_SIZE_PX = 34;

/** Fixed weight — DejaVuSans-Bold's real source weight. */
export const COUNTER_FONT_WEIGHT = 700;

/* ------------------------------------------------------------------ */
/* Style config                                                        */
/* ------------------------------------------------------------------ */

/** Everything that affects rendering, independent of data. */
export type ViewerCounterStyle = {
  combined: boolean;
  icons: boolean;
  bg: boolean;
  textShadow: CounterTextShadow;
  stroke: CounterStroke;
  align: CounterAlign;
};

/** Channel names per platform, normalized (no leading '@'). */
export type ViewerCounterChannels = Partial<Record<ViewerPlatform, string>>;

/** Full parsed overlay configuration. */
export type ViewerCounterConfig = {
  channels: ViewerCounterChannels;
  style: ViewerCounterStyle;
};

/** Defaults — an overlay URL with no style params renders exactly this. */
export const DEFAULT_STYLE: ViewerCounterStyle = {
  combined: true,
  icons: true,
  bg: false,
  textShadow: 'large',
  stroke: 'none',
  align: 'left',
};

/* ------------------------------------------------------------------ */
/* Parsing helpers                                                     */
/* ------------------------------------------------------------------ */

/** Read a single string from a raw query value, rejecting arrays. */
function one(value: unknown): string {
  if (typeof value === 'string') return value;
  return '';
}

/** Match a member of `allowed`, else fall back. Legacy numeric aliases
 *  ('1','2',…) are still accepted so older copied URLs keep working. */
function pickEnum<T extends string>(
  raw: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = one(raw);
  if ((allowed as readonly string[]).includes(value)) return value as T;

  const index = Number(value);
  if (Number.isInteger(index) && index >= 1 && index <= allowed.length) {
    return allowed[index - 1];
  }
  return fallback;
}

/**
 * Parse a boolean with an authoritative fallback when the parameter is omitted
 * or is not a single string. Explicit values preserve the historical rule that
 * only the literal string 'false' disables a default-on flag.
 */
function boolDefault(raw: unknown, fallback: boolean): boolean {
  const value = one(raw);
  if (!value) return fallback;
  return value !== 'false';
}

/** Keep an enum value if allowed, else fall back to the authoritative default. */
function keepEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return (allowed as readonly unknown[]).includes(value) ? (value as T) : fallback;
}

/**
 * Coerce a partial or malformed style into a complete valid one.
 *
 * Lives here, in the authoritative module, rather than beside the workspace tool
 * descriptor that used to own it, because the serializer below now depends on
 * it — see the note there. The tool descriptor re-exports this one, so there is
 * still exactly one normalizer and no second set of fallbacks.
 */
export function normalizeCounterStyle(
  style: Partial<ViewerCounterStyle>,
): ViewerCounterStyle {
  return {
    combined:
      typeof style.combined === 'boolean' ? style.combined : DEFAULT_STYLE.combined,
    icons: typeof style.icons === 'boolean' ? style.icons : DEFAULT_STYLE.icons,
    bg: typeof style.bg === 'boolean' ? style.bg : DEFAULT_STYLE.bg,
    textShadow: keepEnum<CounterTextShadow>(
      style.textShadow,
      TEXT_SHADOWS,
      DEFAULT_STYLE.textShadow,
    ),
    stroke: keepEnum<CounterStroke>(style.stroke, STROKES, DEFAULT_STYLE.stroke),
    align: keepEnum<CounterAlign>(style.align, ALIGNMENTS, DEFAULT_STYLE.align),
  };
}


/**
 * Normalize a channel name: trim, drop a leading '@', and accept only the
 * conservative charset the viewers API already enforces.
 */
export function normalizeChannel(raw: unknown): string {
  const value = one(raw).trim().replace(/^@/, '');
  if (value.length === 0 || value.length > 50) return '';
  return /^[A-Za-z0-9._-]+$/.test(value) ? value : '';
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Parse a raw query object (Next's `router.query`) into a full config.
 *
 * Never throws: every field falls back to its default, so a malformed URL
 * renders the default styling rather than an error.
 */
export function parseViewerCounterConfig(
  query: Record<string, unknown>,
): ViewerCounterConfig {
  const channels: ViewerCounterChannels = {};
  for (const platform of PLATFORM_ORDER) {
    const name = normalizeChannel(query[platform]);
    if (name) channels[platform] = name;
  }

  return {
    channels,
    style: {
      combined: boolDefault(query.combined, DEFAULT_STYLE.combined),
      icons: boolDefault(query.icons, DEFAULT_STYLE.icons),
      bg: boolDefault(query.bg, DEFAULT_STYLE.bg),
      textShadow: pickEnum(
        query.textShadow,
        TEXT_SHADOWS,
        DEFAULT_STYLE.textShadow,
      ),
      stroke: pickEnum(query.stroke, STROKES, DEFAULT_STYLE.stroke),
      align: pickEnum(query.align, ALIGNMENTS, DEFAULT_STYLE.align),
      /* `font`, `textSize`, `label`, `showLabel`, `weight`, and `metric` from
         older builds are deliberately not read. Typography is fixed and the
         label feature is gone, so those params are harmlessly ignored and an
         old copied URL still loads and renders normally. */
    },
  };
}

/**
 * Build the `/counter` query string for a config.
 *
 * The long-standing style params are always emitted so existing copied URLs
 * keep their familiar shape; `align` is emitted only when it differs from its
 * default, keeping short URLs short. No typography or label params are
 * emitted — the counter's font, size, and weight are fixed.
 */
export function buildViewerCounterQuery(
  channels: ViewerCounterChannels,
  style: Partial<ViewerCounterStyle>,
): string {
  const params = new URLSearchParams();

  for (const platform of PLATFORM_ORDER) {
    const name = normalizeChannel(channels[platform]);
    if (name) params.set(platform, name);
  }

  /* Normalized first, so a field that is missing at runtime becomes its default
     rather than the literal string 'undefined'.

     This is not hypothetical. A real request was observed as
     /counter?kick=…&combined=undefined&icons=undefined&bg=undefined&
     textShadow=small&stroke=none&align=undefined — exactly what the three
     String() calls below and the align guard produce from a partial style, in
     exactly this parameter order. The type said that could not happen; the
     parameter is now Partial so the type matches reality and the coercion is
     explicit.

     Emitting 'undefined' is worse than cosmetic: the parser must not guess at a
     missing runtime value. Normalization makes each missing field inherit its
     authoritative default before serialization.

     Normalizing a complete style is a no-op, so every already-copied URL and
     every existing caller serializes byte-identically except where a caller was
     relying on the old pill-background default. */
  const safe = normalizeCounterStyle(style);

  params.set('combined', String(safe.combined));
  params.set('icons', String(safe.icons));
  params.set('bg', String(safe.bg));
  params.set('textShadow', safe.textShadow);
  params.set('stroke', safe.stroke);

  if (safe.align !== DEFAULT_STYLE.align) {
    params.set('align', safe.align);
  }

  return params.toString();
}

/**
 * Stable primitive key describing only the polling-relevant configuration.
 *
 * The overlay's polling effect depends on this string rather than on a
 * config object's identity, so restyling never restarts polling while a
 * genuine channel change does.
 */
export function channelPollKey(channels: ViewerCounterChannels): string {
  return PLATFORM_ORDER
    .map((platform) => `${platform}:${channels[platform] ?? ''}`)
    .join('|');
}

/**
 * Combined-total summary derived from per-platform statuses.
 *
 * `total` sums only measured counts. `hasMeasured` is false when nothing
 * usable exists, and `hasPresence` is true when at least one platform is
 * live or unavailable — together they let the renderer show an unavailable
 * marker instead of a fabricated 0.
 */
export type CombinedSummary = {
  total: number;
  hasMeasured: boolean;
  hasPresence: boolean;
};

/** Platforms that should occupy space in the overlay, in display order. */
export function visiblePlatforms(
  statuses: PlatformStatuses,
): ViewerPlatform[] {
  return PLATFORM_ORDER.filter((platform) => {
    const status = statuses[platform];
    if (!status) return false;
    return status.state === 'live' || status.state === 'live-unknown';
  });
}

/** Summarize statuses for combined mode. */
export function summarize(statuses: PlatformStatuses): CombinedSummary {
  let total = 0;
  let hasMeasured = false;
  let hasPresence = false;

  for (const platform of PLATFORM_ORDER) {
    const status = statuses[platform];
    if (!status) continue;

    if (status.state === 'live') {
      total += status.viewers;
      hasMeasured = true;
      hasPresence = true;
    } else if (status.state === 'live-unknown') {
      // Deliberately contributes nothing to the numeric total.
      hasPresence = true;
    } else if (status.state === 'unavailable') {
      hasPresence = true;
    }
  }

  return { total, hasMeasured, hasPresence };
}

/** Rebuild the channel map from a {@link channelPollKey} string. */
export function parseChannelPollKey(key: string): ViewerCounterChannels {
  const channels: ViewerCounterChannels = {};
  for (const part of key.split('|')) {
    const index = part.indexOf(':');
    if (index <= 0) continue;
    const platform = part.slice(0, index) as ViewerPlatform;
    const name = part.slice(index + 1);
    if (name && (PLATFORM_ORDER as readonly string[]).includes(platform)) {
      channels[platform] = name;
    }
  }
  return channels;
}
