/* MultiChat tool descriptor — registered, and hosted at /tools/multichat.
 *
 * This adapts the existing MultiChat generator for the workspace shell the way
 * lib/tools/counter/config.ts adapts the viewer counter. It reimplements
 * nothing: defaults come from MULTICHAT_WORKSPACE_DEFAULTS by reference, enums
 * come from the tuples lib/multichatConfig exports, and `serialize` calls
 * buildMultichatQuery, so a URL built here matches what the existing generator
 * at /multichat copies for the same state.
 *
 * State is MultichatWorkspaceStyle, the explicit adapter that carries the full
 * sourceTag enum where the legacy shape carries a boolean. Nothing here
 * post-processes the query string: dot and label are emitted by the
 * authoritative serializer itself, in the slot the boolean already used.
 *
 * Registered in lib/tools/registry's TOOLS, so /tools/multichat is a real
 * prerendered workspace route. It now also declares `runtime` and `context`, so
 * native Twitch pins are reachable from the workspace: the connection panel
 * lives in ./runtime and components/workspace/multichat, and the connection id
 * reaches the URL only as a fragment, only when it is actually usable.
 *
 * Browser-safe — no server-only imports, no secrets. The connection id is an
 * opaque handle, not a token; tokens stay server-side, encrypted.
 */
import {
  MULTICHAT_ANIMATIONS,
  MULTICHAT_FONTS,
  MULTICHAT_GENERATOR_DEFAULT_CHANNELS,
  MULTICHAT_PLATFORMS,
  MULTICHAT_SOURCE_TAGS,
  MULTICHAT_STROKES,
  MULTICHAT_TEXT_SHADOWS,
  MULTICHAT_TEXT_SIZES,
  MULTICHAT_WORKSPACE_DEFAULTS,
  buildMultichatQuery,
  type MultichatAnimation,
  type MultichatChannels,
  type MultichatFont,
  type MultichatPlatform,
  type MultichatSourceTag,
  type MultichatStroke,
  type MultichatTextShadow,
  type MultichatTextSize,
  type MultichatWorkspaceStyle,
} from '@/lib/multichatConfig';
import type { OverlayTool, ToolChannels, ToolPlatform } from '../registry';
import { MULTICHAT_HELP } from './help';
import { MULTICHAT_OBS_SIZE } from './obs';
import {
  EMPTY_MULTICHAT_RUNTIME,
  multichatContext,
  multichatOptionAvailability,
  syncMultichatStyle,
  type MultichatRuntime,
} from './runtime';
import { MULTICHAT_CATALOG } from './settings';

export type { MultichatPlatform, MultichatWorkspaceStyle };

/** Channel state as the workspace holds it, before adapting for the serializer. */
export type MultichatToolChannels = ToolChannels<MultichatPlatform>;

/* ------------------------------------------------------------------ */
/* Platforms                                                           */
/* ------------------------------------------------------------------ */

/*
 * Order is kick, twitch, youtube, tiktok — the order the generator's own inputs
 * appear in on the landing page, and the order buildMultichatQuery inserts the
 * parameters in. MULTICHAT_PLATFORMS already holds exactly that, so the tuple
 * drives this list rather than being restated.
 *
 * The per-platform asymmetry is intentional and preserved verbatim: kick is
 * only trimmed, so a leading '@' survives into the URL, while the other three
 * have theirs stripped. That is what buildMultichatQuery does today. Correcting
 * it would change URLs people already have in OBS, so it is left alone.
 */

/** Labels and placeholders exactly as the existing generator shows them. */
const PLATFORM_FIELD: Record<
  MultichatPlatform,
  { label: string; placeholder: string }
> = {
  kick: { label: 'Kick', placeholder: 'Channel name' },
  twitch: { label: 'Twitch', placeholder: 'Channel name' },
  youtube: { label: 'YouTube', placeholder: '@handle' },
  tiktok: { label: 'TikTok', placeholder: '@username' },
};

/** Kick keeps a leading '@' — trim only. Matches buildMultichatQuery. */
export function normalizeKickChannel(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : '';
}

/** The other three strip one leading '@' after trimming. */
export function normalizeAtChannel(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().replace(/^@/, '') : '';
}

/*
 * No viewer-counter normalizer is reused here. normalizeChannel there rejects
 * anything outside [A-Za-z0-9._-] and caps length at 50; MultiChat accepts
 * whatever the user types. Importing it would silently add validation this tool
 * has never had.
 */
export const MULTICHAT_PLATFORM_DEFS: readonly ToolPlatform<MultichatPlatform>[] =
  MULTICHAT_PLATFORMS.map((key) => ({
    key,
    label: PLATFORM_FIELD[key].label,
    placeholder: PLATFORM_FIELD[key].placeholder,
    normalize: key === 'kick' ? normalizeKickChannel : normalizeAtChannel,
  }));

/** Platforms whose typed channel is non-empty once normalized, in field order. */
export function configuredMultichatPlatforms(
  channels: MultichatToolChannels,
): MultichatPlatform[] {
  return MULTICHAT_PLATFORM_DEFS.filter((platform) =>
    Boolean(platform.normalize(channels[platform.key])),
  ).map((platform) => platform.key);
}

/**
 * Widen workspace channel state into the complete shape the serializer takes.
 *
 * Raw values are passed through untouched — buildMultichatQuery does its own
 * trimming and '@' handling, and doing any of it here would double up.
 */
export function toMultichatChannels(
  channels: MultichatToolChannels,
): MultichatChannels {
  return {
    kick: channels.kick ?? MULTICHAT_GENERATOR_DEFAULT_CHANNELS.kick,
    twitch: channels.twitch ?? MULTICHAT_GENERATOR_DEFAULT_CHANNELS.twitch,
    youtube: channels.youtube ?? MULTICHAT_GENERATOR_DEFAULT_CHANNELS.youtube,
    tiktok: channels.tiktok ?? MULTICHAT_GENERATOR_DEFAULT_CHANNELS.tiktok,
  };
}

/* ------------------------------------------------------------------ */
/* Normalization                                                       */
/* ------------------------------------------------------------------ */

/** Keep a boolean, else take the generator default. */
function keepBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Keep a string, else take the generator default.
 *
 * Free-text fields keep '' — emptiness is meaningful for `fade`, `emoteScale`,
 * `bgColor`, `fontColor`, and the three blocklists, where it decides whether
 * the parameter is emitted at all.
 */
function keepString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

/** Keep an enum member, else take the generator default. */
function keepEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return (allowed as readonly unknown[]).includes(value) ? (value as T) : fallback;
}

/**
 * Coerce partial workspace state into a complete valid generator style.
 *
 * Not the overlay parser: that one reads query strings, resolves numeric
 * aliases, and — critically — falls back to textShadow 'large'. Workspace state
 * starts from the generator's 'small'. Routing normalization through the parser
 * would silently restyle the control on any partial input, so this fills from
 * MULTICHAT_WORKSPACE_DEFAULTS directly.
 *
 * Returns a fresh object; the input and the defaults are never mutated, and
 * pinPlatforms is copied rather than aliased.
 */
export function normalizeMultichatStyle(
  style: Partial<MultichatWorkspaceStyle>,
): MultichatWorkspaceStyle {
  const d = MULTICHAT_WORKSPACE_DEFAULTS;
  return {
    sevenTVEmotesEnabled: keepBoolean(style.sevenTVEmotesEnabled, d.sevenTVEmotesEnabled),
    sevenTVCosmeticsEnabled: keepBoolean(
      style.sevenTVCosmeticsEnabled,
      d.sevenTVCosmeticsEnabled,
    ),
    textSize: keepEnum(style.textSize, MULTICHAT_TEXT_SIZES, d.textSize as MultichatTextSize),
    font: keepEnum(style.font, MULTICHAT_FONTS, d.font as MultichatFont),
    textShadow: keepEnum(
      style.textShadow,
      MULTICHAT_TEXT_SHADOWS,
      d.textShadow as MultichatTextShadow,
    ),
    stroke: keepEnum(style.stroke, MULTICHAT_STROKES, d.stroke as MultichatStroke),
    animation: keepEnum(style.animation, MULTICHAT_ANIMATIONS, d.animation as MultichatAnimation),
    fade: keepString(style.fade, d.fade),
    fadeEnabled: keepBoolean(style.fadeEnabled, d.fadeEnabled),
    showPinEnabled: keepBoolean(style.showPinEnabled, d.showPinEnabled),
    /* The full enum, not the legacy boolean. platformIcons never appears in
       generator state — it is the legacy compatibility shape, not this one. */
    sourceTag: keepEnum(style.sourceTag, MULTICHAT_SOURCE_TAGS, d.sourceTag),
    mentionColor: keepBoolean(style.mentionColor, d.mentionColor),
    bgColor: keepString(style.bgColor, d.bgColor),
    emoteScale: keepString(style.emoteScale, d.emoteScale),
    msgBold: keepBoolean(style.msgBold, d.msgBold),
    msgCaps: keepBoolean(style.msgCaps, d.msgCaps),
    modAction: keepBoolean(style.modAction, d.modAction),
    paintShadows: keepBoolean(style.paintShadows, d.paintShadows),
    fontColor: keepString(style.fontColor, d.fontColor),
    pinPlatforms: normalizePinPlatforms(style.pinPlatforms),
    hideNames: keepBoolean(style.hideNames, d.hideNames),
    botNames: keepString(style.botNames, d.botNames),
    userBL: keepString(style.userBL, d.userBL),
    prefixBL: keepString(style.prefixBL, d.prefixBL),
  };
}

/**
 * Keep the valid platform names from a selection, in declared option order.
 *
 * An empty selection is valid and preserved — the serializer emits
 * `pinPlatforms=` for it, meaning "no pins at all". Only a non-array falls back
 * to the default, and the result is always a new array.
 */
export function normalizePinPlatforms(
  value: unknown,
): readonly MultichatPlatform[] {
  if (!Array.isArray(value)) {
    return [...MULTICHAT_WORKSPACE_DEFAULTS.pinPlatforms] as MultichatPlatform[];
  }
  return MULTICHAT_PLATFORMS.filter((platform) => value.includes(platform));
}

/* ------------------------------------------------------------------ */
/* Descriptor                                                          */
/* ------------------------------------------------------------------ */

/**
 * The MultiChat tool, registered in TOOLS.
 *
 * Now declares `runtime` and `context`. The runtime is the Twitch connection —
 * capability rather than appearance, so it lives outside `MultichatWorkspaceStyle`
 * and outside channel state. `context` contributes the connection id as a URL
 * fragment, and only when it is genuinely usable, so a URL built without a
 * connection is byte-identical to what this tool produced before.
 *
 * Every rule about when a connection counts lives in ./runtime, not here and not
 * in the panel: one function decides availability, and the option gating, the
 * pin-list reconciliation, and the fragment all read from it.
 */
export const multichatTool: OverlayTool<
  MultichatWorkspaceStyle,
  MultichatPlatform,
  MultichatRuntime
> = {
  id: 'multichat',
  label: 'MultiChat',
  overlayRoute: '/multichat',
  platforms: MULTICHAT_PLATFORM_DEFS,
  catalog: MULTICHAT_CATALOG,
  /* The authoritative workspace object itself, by reference — derived in
     lib/multichatConfig from the generator defaults, not copied here. */
  defaults: MULTICHAT_WORKSPACE_DEFAULTS,
  normalize: normalizeMultichatStyle,
  /* The generator's own serializer, unmodified. Channel state is widened to the
     complete four-field shape it expects; values pass through raw so its own
     trim and '@' rules stay the only ones applied. */
  serialize: (channels, style) =>
    buildMultichatQuery(toMultichatChannels(channels), style),
  configuredPlatforms: configuredMultichatPlatforms,
  /* Canonical size, from ./obs — the same constant the help section and the docs
     now cite, so the two conflicting "recommended" values are gone. */
  obs: MULTICHAT_OBS_SIZE,
  /* Accurate for what the iframe actually is: the real overlay, at the exact
     URL below it, connected to the real platforms. An empty preview is normal
     and is not a workspace failure. */
  previewNote:
    'A real /multichat overlay at this exact URL. It connects to the channels you configure and shows their actual messages, so it stays empty while those channels are offline or nobody is chatting.',
  /* Commands are derived from the parser's own metadata, so this cannot document
     a command the overlay does not implement. */
  help: MULTICHAT_HELP,
  /* The connection id reaches the URL only through here, and only as a fragment
     — never as a query parameter, so it is not sent to the server on load. */
  context: multichatContext,
  runtime: {
    initial: EMPTY_MULTICHAT_RUNTIME,
    /* No `Panel`. The generator renders the connection controls itself, inside
       the Twitch channel field where they belong visually — the shared rules they
       depend on live in ./runtime and ./useTwitchConnection, which is what keeps
       this descriptor from needing to own a component. */
    sync: syncMultichatStyle,
    /* Mirrors the typed Twitch channel into runtime so the match rule can be
       evaluated. Returns the same object when nothing changed, which is what
       lets the shell's effect skip a needless state update. */
    fromChannels: (runtime, channels) => {
      const next = normalizeAtChannel(channels.twitch);
      return next === runtime.twitchChannel ? runtime : { ...runtime, twitchChannel: next };
    },
    optionAvailability: multichatOptionAvailability,
  },
};
