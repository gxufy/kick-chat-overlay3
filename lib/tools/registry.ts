/* Overlay tool registry for the generator workspace.
 *
 * A tool descriptor is the single place the workspace looks for everything it
 * needs to render a tool: where the tool lives, which channels it takes, what
 * controls it has, how its config normalizes and serializes, and whether it has
 * enough channel input to show a preview. The workspace shell holds no per-tool
 * knowledge — including no platform list of its own.
 *
 * Both registered tools describe themselves entirely through this type — the
 * shell holds no counter-specific or MultiChat-specific knowledge, including no
 * preview copy of its own.
 *
 * Fields are limited to what a built tool needs. Timers, alerts, goals, and
 * scoreboards are not modelled — they get added to this type when they are
 * actually built.
 *
 * Browser-safe — no server-only imports, no secrets.
 */
import type { SettingCatalog } from './settingTypes';
import type { ToolContext } from './toolContext';
import { counterTool } from './counter/config';
import { multichatTool } from './multichat/config';

/** Channel names keyed by the tool's own platform keys, as typed in. */
export type ToolChannels<P extends string = string> = Partial<Record<P, string>>;

/**
 * What a tool's style config has to look like to be driven by a setting
 * catalog: a plain keyed object. Field names and value types stay the tool's own.
 */
export type ToolStyle = Record<string, unknown>;

/**
 * One channel input a tool accepts.
 *
 * `normalize` is the tool's own rule, so a name the workspace accepts is
 * guaranteed to be accepted by that tool's overlay parser. It returns `''` for
 * anything unusable rather than throwing.
 */
export type ToolPlatform<P extends string = string> = {
  /** Query-parameter key, and the platform's identity in channel state. */
  key: P;
  /** Visible field label. */
  label: string;
  /** Field placeholder, when one helps. */
  placeholder?: string;
  /** Canonical channel name, or `''` when the raw value is unusable. */
  normalize: (raw: unknown) => string;
  /** Shown when a non-empty value does not normalize. */
  invalidMessage?: string;
};

/**
 * A tool the generator workspace can host.
 *
 * `S` is the tool's style/appearance config — the part driven by the setting
 * catalog. `P` is the union of its platform keys, so channel state for one tool
 * cannot be indexed with another tool's platform.
 */
export type OverlayTool<S, P extends string = string> = {
  /** Stable id; also the `/tools/[tool]` route segment. */
  id: string;
  /** Name shown in workspace navigation. */
  label: string;
  /** Workspace route for this tool. */
  workspaceRoute: string;
  /** Overlay route the generated URL points at. */
  overlayRoute: string;
  /** Channel inputs, in the order they are shown. */
  platforms: readonly ToolPlatform<P>[];
  /** Non-channel controls, rendered generically by the workspace. */
  catalog: SettingCatalog<S>;
  /** Authoritative defaults. Catalog defaults must agree with these. */
  defaults: S;
  /** Coerce a partial or malformed style into a valid one. Never throws. */
  normalize: (style: Partial<S>) => S;
  /** Build the overlay query string. Must be the overlay's own serializer. */
  serialize: (channels: ToolChannels<P>, style: S) => string;
  /** Platforms with a valid channel, in display order. */
  configuredPlatforms: (channels: ToolChannels<P>) => P[];
  /** Suggested OBS browser-source size, also used for the preview viewport. */
  obs: { width: number; height: number };
  /**
   * What the preview iframe is, in this tool's own terms.
   *
   * Owned by the descriptor because the accurate sentence differs per tool: the
   * counter's preview is about counts and polling, MultiChat's is about messages
   * and channel liveness. One shared sentence could only be vague or wrong for
   * one of them. Plain text — it is rendered as a caption, not as markup.
   */
  previewNote?: string;
  /**
   * Optional workspace state this tool contributes to its overlay URL. Given
   * the current style so a future tool can vary it; returning nothing — as
   * every tool does today — yields a URL identical to plain serialization.
   */
  context?: (style: S) => ToolContext | undefined;
};

/**
 * A registered tool with its `S` and `P` hidden.
 *
 * The registry cannot be a plain array of descriptors: once a second tool with
 * a different style type joins, `OverlayTool<A, PA> | OverlayTool<B, PB>` no
 * longer infers as `OverlayTool<S, P>`, because `normalize` and `serialize` are
 * contravariant in their arguments. The route would then need a per-tool
 * branch, which is exactly what this batch is meant to prevent.
 *
 * So a registered tool carries its descriptor behind `use`, which hands it back
 * with both parameters intact to whoever needs them. Nav and route only ever
 * touch the flat fields, and no `any` or cast is involved anywhere.
 */
export type RegisteredTool = {
  id: string;
  label: string;
  workspaceRoute: string;
  overlayRoute: string;
  /** Widened for display and validation; each key stays a plain string here. */
  platforms: readonly ToolPlatform[];
  obs: { width: number; height: number };
  /** Carried through as-is; it names no style field, so nothing is erased. */
  previewNote?: string;
  /** Apply `consume` to the concrete descriptor. */
  use: <R>(
    consume: <S extends ToolStyle, P extends string>(tool: OverlayTool<S, P>) => R,
  ) => R;
};

/** Hide a descriptor's type parameters so tools of any shape can sit together. */
function register<S extends ToolStyle, P extends string>(
  tool: OverlayTool<S, P>,
): RegisteredTool {
  return {
    id: tool.id,
    label: tool.label,
    workspaceRoute: tool.workspaceRoute,
    overlayRoute: tool.overlayRoute,
    platforms: tool.platforms,
    obs: tool.obs,
    previewNote: tool.previewNote,
    use: (consume) => consume(tool),
  };
}

/**
 * Registered tools, in navigation order.
 *
 * MultiChat comes first, matching the order the workspace nav already showed it
 * in while it was an unregistered direct link. Its overlay still lives at
 * `/multichat`, and the existing generator there stays reachable and unchanged —
 * navigation links to it separately as MultiChat (Classic), since it is the only
 * place a Twitch account can be connected today.
 */
export const TOOLS: readonly RegisteredTool[] = [
  register(multichatTool),
  register(counterTool),
];

/** Every registered route segment, for static path generation. */
export const TOOL_IDS: readonly string[] = TOOLS.map((tool) => tool.id);

/** Look a tool up by its route segment. Returns undefined for unknown ids. */
export function findTool(id: string | undefined): RegisteredTool | undefined {
  return TOOLS.find((tool) => tool.id === id);
}
