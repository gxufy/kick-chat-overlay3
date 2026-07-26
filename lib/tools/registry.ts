/* Overlay tool registry for the generator workspace.
 *
 * A tool descriptor is the single place the workspace looks for everything it
 * needs to render a tool: where the tool lives, what controls it has, how its
 * config normalizes and serializes, and whether it has enough channel input to
 * show a preview. The workspace shell holds no per-tool knowledge.
 *
 * Fields are limited to what the Viewer Counter migration needs now. Timers,
 * alerts, goals, and scoreboards are not modelled — they get added to this
 * type when they are actually built.
 *
 * Browser-safe — no server-only imports, no secrets.
 */
import type { SettingCatalog } from './settingTypes';
import type { ViewerPlatform } from '@/lib/viewerCounterConfig';
import { counterTool } from './counter/config';

/** Channel names keyed by platform, as typed into the workspace. */
export type ToolChannels = Partial<Record<ViewerPlatform, string>>;

/**
 * A tool the generator workspace can host.
 *
 * `S` is the tool's style/appearance config — the part driven by the setting
 * catalog. Channel input is handled separately by the workspace, because every
 * tool that has channels has the same four.
 */
export type OverlayTool<S> = {
  /** Stable id; also the `/tools/[tool]` route segment. */
  id: string;
  /** Name shown in workspace navigation. */
  label: string;
  /** Workspace route for this tool. */
  workspaceRoute: string;
  /** Overlay route the generated URL points at. */
  overlayRoute: string;
  /** Non-channel controls, rendered generically by the workspace. */
  catalog: SettingCatalog<S>;
  /** Authoritative defaults. Catalog defaults must agree with these. */
  defaults: S;
  /** Coerce a partial or malformed style into a valid one. Never throws. */
  normalize: (style: Partial<S>) => S;
  /** Build the overlay query string. Must be the overlay's own serializer. */
  serialize: (channels: ToolChannels, style: S) => string;
  /** Platforms with a valid channel, in display order. */
  configuredPlatforms: (channels: ToolChannels) => ViewerPlatform[];
  /** Suggested OBS browser-source size, also used for the preview viewport. */
  obs: { width: number; height: number };
};

/**
 * Registered tools, in navigation order.
 *
 * MultiChat is not here: it still lives at `/multichat` and has not been
 * migrated. Workspace navigation links to it directly rather than pretending
 * it is a registered tool.
 */
export const TOOLS = [counterTool] as const;

/** Look a tool up by its route segment. Returns undefined for unknown ids. */
export function findTool(id: string | undefined): typeof counterTool | undefined {
  return TOOLS.find((tool) => tool.id === id);
}
