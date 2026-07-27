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
import type { ReactElement } from 'react';
import type { PreviewBackgroundId } from './previewBackground';
import type { OptionAvailability, SettingCatalog } from './settingTypes';
import type { ToolContext } from './toolContext';
import { counterTool } from './counter/config';
import { multichatTool } from './multichat/config';

/** Channel names keyed by the tool's own platform keys, as typed in. */
export type ToolChannels<P extends string = string> = Partial<Record<P, string>>;

/** One documented item — a command, a shortcut, whatever the tool has. */
export type ToolHelpEntry = {
  /** Rendered monospaced, as literal syntax to be typed. */
  readonly syntax: string;
  readonly summary: string;
  readonly detail?: string;
};

/** A titled group of help entries, with optional prose above and below. */
export type ToolHelpSection = {
  readonly id: string;
  readonly title: string;
  /** Shown above the entries. */
  readonly intro?: string;
  readonly entries: readonly ToolHelpEntry[];
  /** Shown below the entries — caveats, aliases, access requirements. */
  readonly footnote?: string;
};

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

/** Props every runtime panel component receives. Generic over `R` only —
 *  nothing here names a platform or a connection. */
export type RuntimePanelProps<R> = {
  runtime: R;
  /**
   * Replace runtime, or update it from its current value.
   *
   * The updater form exists because a panel's mount effect necessarily closes
   * over the runtime as it was at mount. Spreading that snapshot would discard
   * any field the shell folded in since — `fromChannels`, for one. Taking the
   * current value as an argument makes a write independent of when the closure
   * was captured.
   */
  onChange: (next: R | ((current: R) => R)) => void;
  /**
   * Persist the workspace draft now.
   *
   * A panel calls this immediately before any navigation that leaves the page,
   * so unsaved channels and settings survive the round trip. The shell owns what
   * a draft contains and where it is stored; the panel only says "I am about to
   * leave". Deliberately not automatic on every keystroke: a write per character
   * is wasteful, and the only moment the draft is actually needed is a
   * deliberate departure.
   */
  onBeforeLeave: () => void;
};

/**
 * Optional tool-owned runtime state, orthogonal to `S` (appearance) and
 * channel state. Exists for state that is neither: a Twitch connection is
 * not a colour and not a channel name, so it does not belong in either.
 *
 * Nothing here is platform-specific — `R` is opaque to the shell, which only
 * ever stores it, hands it to `Panel`, and passes it back to `sync` and
 * `optionAvailability`. A tool that declares no `runtime` never has this type
 * instantiated with anything but `undefined`.
 */
export type ToolRuntimeSupport<S, P extends string, R> = {
  initial: R;
  /** Rendered in the preview column, above the channel panel. */
  Panel?: (props: RuntimePanelProps<R>) => JSX.Element | null;
  /** Reconcile `style` against the current runtime (e.g. drop a selection
   *  that runtime no longer supports). Called after every runtime change. */
  sync?: (style: S, runtime: R) => S;
  /**
   * Fold current channel state into runtime.
   *
   * Some runtime state depends on what the user typed — a connection is only
   * usable if a channel names the connected account. The shell calls this
   * whenever channels change so the tool can mirror what it needs, without the
   * shell knowing which platform matters or why.
   */
  fromChannels?: (runtime: R, channels: ToolChannels<P>) => R;
  /** Availability for options of multiselect settings, keyed by setting key
   *  then option value. A setting/option absent here is always available. */
  optionAvailability?: (
    runtime: R,
  ) => Partial<Record<keyof S & string, Record<string, OptionAvailability>>>;
};

/**
 * A tool the generator workspace can host.
 *
 * `S` is the tool's style/appearance config — the part driven by the setting
 * catalog. `P` is the union of its platform keys, so channel state for one tool
 * cannot be indexed with another tool's platform. `R` is opaque runtime state
 * (e.g. a Twitch connection); tools that declare no `runtime` never have it
 * instantiated with anything but `undefined`.
 */
export type OverlayTool<S, P extends string = string, R = undefined> = {
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
   * Reference material for this tool, rendered below its settings.
   *
   * Plain data, so the shell renders it without knowing what it describes: for
   * MultiChat these are chat commands, and a different tool could document
   * anything else in the same shape. A tool that declares none renders nothing
   * at all, which is why the counter gains no empty section.
   */
  help?: readonly ToolHelpSection[];
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
   * the current style and runtime so a tool can vary it; returning nothing —
   * as every tool without a `runtime` does today — yields a URL identical to
   * plain serialization.
   */
  context?: (style: S, runtime: R) => ToolContext | undefined;
  /** Optional tool-owned runtime state beyond appearance and channels. */
  runtime?: ToolRuntimeSupport<S, P, R>;
  /**
   * Optional second preview mode, rendering sample data instead of a live feed.
   *
   * A live preview of an offline channel is correctly empty, which shows nothing
   * about styling. A tool that can render representative sample data supplies a
   * component here and the shell offers a Live/Demo switch; a tool that cannot —
   * the counter, whose numbers are only meaningful when real — supplies nothing
   * and the switch does not appear.
   *
   * Declared as a component rather than as data because what makes a convincing
   * demo is tool-specific: MultiChat's is a message list with its own filters and
   * composer. The shell hands over the serialized query, the viewport height, and
   * the chosen preview background, and knows nothing else about it. In
   * particular it does not know the demo exists as a concept beyond this field,
   * which is what keeps chat-specific vocabulary out of the shell.
   */
  demo?: {
    /** Label for the mode switch. */
    label: string;
    /** One line describing what the demo shows. */
    hint: string;
    Panel: ToolDemoPanel;
  };
};

/**
 * A tool's demo-mode panel.
 *
 * Receives only what the shell can supply without knowing the tool: the exact
 * query string the URL bar shows, the OBS viewport height, the workspace's
 * preview background, and whether the source tag was set explicitly. Everything
 * else — which samples, which filters — is the panel's own state, which is why
 * no demo choice can reach the generated URL.
 */
export type ToolDemoPanel = (props: {
  query: string;
  height: number;
  background: PreviewBackgroundId;
  sourceTagExplicit: boolean;
}) => ReactElement | null;

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
  /** Carried through as-is; they name no style field, so nothing is erased. */
  previewNote?: string;
  help?: readonly ToolHelpSection[];
  /** Apply `consume` to the concrete descriptor. `Out` is the caller's own
   *  result type; `R` below is the descriptor's runtime type, also hidden. */
  use: <Out>(
    consume: <S extends ToolStyle, P extends string, R>(
      tool: OverlayTool<S, P, R>,
    ) => Out,
  ) => Out;
};

/** Hide a descriptor's type parameters so tools of any shape can sit together. */
function register<S extends ToolStyle, P extends string, R>(
  tool: OverlayTool<S, P, R>,
): RegisteredTool {
  return {
    id: tool.id,
    label: tool.label,
    workspaceRoute: tool.workspaceRoute,
    overlayRoute: tool.overlayRoute,
    platforms: tool.platforms,
    obs: tool.obs,
    previewNote: tool.previewNote,
    help: tool.help,
    use: (consume) => consume(tool),
  };
}

/**
 * Registered tools, in navigation order.
 *
 * MultiChat comes first, matching the order the workspace nav already showed it
 * in while it was an unregistered direct link. Its overlay still lives at
 * `/multichat`, and the original generator stays reachable and unchanged at
 * `/classic/multichat` — navigation links to it separately as MultiChat
 * (Classic). It is no longer the only place a Twitch account can be connected;
 * the workspace does that through the descriptor's `runtime` panel.
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
