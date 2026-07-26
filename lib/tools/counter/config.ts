/* Viewer Counter tool descriptor.
 *
 * This module adapts the existing lib/viewerCounterConfig for the workspace.
 * It does NOT reimplement or relocate it: /counter and the current generator
 * keep importing lib/viewerCounterConfig directly, and this descriptor calls
 * the very same serializer, so a URL built here is byte-identical to one built
 * by the existing generator.
 *
 * Browser-safe — no server-only imports, no secrets.
 */
import {
  ALIGNMENTS,
  DEFAULT_STYLE,
  PLATFORM_ORDER,
  STROKES,
  TEXT_SHADOWS,
  buildViewerCounterQuery,
  normalizeChannel,
  type CounterAlign,
  type CounterStroke,
  type CounterTextShadow,
  type ViewerCounterStyle,
  type ViewerPlatform,
} from '@/lib/viewerCounterConfig';
import type { OverlayTool, ToolChannels } from '../registry';
import { COUNTER_CATALOG } from './settings';

/** Re-exported for workspace code so it has one import site for counter types. */
export type { ViewerCounterStyle, ViewerPlatform };
export { DEFAULT_STYLE, PLATFORM_ORDER, normalizeChannel };

/** Keep an enum value if allowed, else fall back to the authoritative default. */
function keepEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return (allowed as readonly unknown[]).includes(value) ? (value as T) : fallback;
}

/**
 * Coerce a partial style into a complete valid one.
 *
 * Used for workspace state, which is always well-typed in practice; this is the
 * belt-and-braces boundary so a future preset or stored config cannot inject an
 * out-of-range enum. Overlay-side parsing stays in parseViewerCounterConfig.
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

/** Platforms whose typed channel normalizes to a usable name, in display order. */
export function configuredCounterPlatforms(
  channels: ToolChannels,
): ViewerPlatform[] {
  return PLATFORM_ORDER.filter((platform) =>
    Boolean(normalizeChannel(channels[platform])),
  );
}

export const counterTool: OverlayTool<ViewerCounterStyle> = {
  id: 'counter',
  label: 'Viewer Counter',
  workspaceRoute: '/tools/counter',
  overlayRoute: '/counter',
  catalog: COUNTER_CATALOG,
  defaults: DEFAULT_STYLE,
  normalize: normalizeCounterStyle,
  /* The overlay's own serializer, unmodified — this is what guarantees the
     workspace and the existing generator produce identical URLs. */
  serialize: (channels, style) => buildViewerCounterQuery(channels, style),
  configuredPlatforms: configuredCounterPlatforms,
  /* Matches the fixed 34 px type plus the overlay's 8 px padding; width is the
     common single-row browser-source size used in the existing docs. */
  obs: { width: 400, height: 80 },
};
