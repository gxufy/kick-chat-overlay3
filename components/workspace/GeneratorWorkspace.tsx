/* Three-column generator workspace shell.
 *
 * Owns the active tool's config, channel input, opaque runtime state, and the
 * workspace-only preview background. One derived URL string is produced here and
 * handed to the preview, the readonly URL field, Copy, and Open — so those four
 * can never disagree.
 *
 * Per-tool state lives in this component's own `style` object, typed by the
 * tool descriptor. It cannot read another tool's fields, so the cross-tool
 * state leakage that previously affected the counter is a type error rather
 * than a convention.
 *
 * `R` is runtime state the shell never inspects. It stores it, hands it to the
 * tool's own panel, and passes it back to the tool's `sync`, `context`, and
 * `optionAvailability` hooks. That is what keeps the Twitch connection out of
 * this file: nothing here mentions Twitch, OAuth, or pins.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LivePreviewPanel from './LivePreviewPanel';
import ToolConfigPanel from './ToolConfigPanel';
import WorkspaceNav from './WorkspaceNav';
import { isPreviewBackgroundId, type PreviewBackgroundId } from './PreviewBackground';
import type { OverlayTool, ToolChannels } from '@/lib/tools/registry';
import type { CatalogAvailability, SettingValue } from '@/lib/tools/settingTypes';
import { buildOverlayUrl } from '@/lib/tools/toolContext';
import { consumeWorkspaceDraft, writeWorkspaceDraft } from '@/lib/workspaceStorage';

export default function GeneratorWorkspace<
  S extends Record<string, unknown>,
  P extends string,
  R,
>({
  tool,
  baseUrl,
}: {
  tool: OverlayTool<S, P, R>;
  /** Origin the generated URL is built against. */
  baseUrl: string;
}) {
  const [style, setStyle] = useState<S>(tool.defaults);
  const [channels, setChannels] = useState<ToolChannels<P>>({});
  const [background, setBackground] = useState<PreviewBackgroundId>('checker');
  /* `as R` is sound: when a tool declares no runtime, `R` is inferred as
     `undefined` and this is the only inhabitant of that type. */
  const [runtime, setRuntime] = useState<R>(
    (tool.runtime?.initial ?? undefined) as R,
  );

  /* Carries every generic setting value shape. What a value means, and how it
     reaches a URL, stays the tool's business — `normalize` decides. */
  const changeSetting = (key: keyof S & string, next: SettingValue) => {
    setStyle((current) => tool.normalize({ ...current, [key]: next }));
  };

  const changeChannel = (platform: P, raw: string) => {
    setChannels((current) => ({ ...current, [platform]: raw }));
  };

  /* Runtime can depend on channel state — the tool decides how. Kept as an
     effect keyed on `channels` so every path that changes them (typing, draft
     restore) folds through the same rule, rather than only the typing path. */
  useEffect(() => {
    const fromChannels = tool.runtime?.fromChannels;
    if (!fromChannels) return;
    setRuntime((current) => {
      const next = fromChannels(current, channels);
      /* Bail out when nothing changed, so this cannot loop. */
      return next === current ? current : next;
    });
  }, [tool, channels]);

  /* A runtime change can invalidate a style choice — a selected option whose
     capability just disappeared. The tool reconciles that itself in `sync`.

     Done as an effect on `runtime` rather than inside a change handler, so every
     path that alters runtime is covered by one rule: the panel connecting or
     disconnecting, and the channel edit that makes a connection stop matching.
     No ordering of those can leave a stale selection behind. */
  useEffect(() => {
    const sync = tool.runtime?.sync;
    if (!sync) return;
    setStyle((current) => {
      const next = sync(current, runtime);
      return next === current ? current : tool.normalize(next);
    });
  }, [tool, runtime]);

  /* Live state, for the draft write. A ref rather than a dependency so
     `persistDraft` has a stable identity: it is handed to the tool's panel, and a
     new function on every keystroke would re-render that panel for no reason. */
  const live = useRef({ style, channels, background });
  live.current = { style, channels, background };

  /* Write the draft. Called by a panel immediately before it navigates away. */
  const persistDraft = useCallback(() => {
    const { style: s, channels: c, background: b } = live.current;
    writeWorkspaceDraft(tool.id, { style: s, channels: c, background: b });
  }, [tool]);

  /* Restore on mount, and only on mount. The draft is consumed as it is read, so
     a second effect run — Strict Mode double-invokes in development — finds
     nothing and leaves whatever the user has since typed alone.

     Everything restored goes through the tool's own normalizer or validator: a
     stored style is normalized, a stored background must be a known id, and
     channel text is only accepted as a string. So a hand-edited sessionStorage
     entry can produce defaults, but not invalid state. */
  useEffect(() => {
    const draft = consumeWorkspaceDraft(tool.id);
    if (!draft) return;

    setStyle(tool.normalize(draft.style as Partial<S>));
    /* Keys are filtered to the tool's own platforms, so a draft written by a
       different version cannot introduce a channel key this tool has no field
       for — which would otherwise be serialized into the overlay URL. */
    const allowed = new Set<string>(tool.platforms.map((p) => p.key));
    const restored: ToolChannels<P> = {};
    for (const [key, value] of Object.entries(draft.channels)) {
      if (allowed.has(key)) restored[key as P] = value;
    }
    setChannels(restored);
    if (isPreviewBackgroundId(draft.background)) setBackground(draft.background);
  }, [tool]);

  /* Which options the tool currently considers unavailable. Recomputed from
     runtime on every change, so an option can become available while the page is
     open. Shape is generic: setting key → option value → availability. */
  const availability: CatalogAvailability = useMemo(
    () => (tool.runtime?.optionAvailability?.(runtime) ?? {}) as CatalogAvailability,
    [tool, runtime],
  );

  /* The single source of truth for every consumer below: the preview, the
     readonly field, Copy, and Open all receive this exact string, so they
     cannot disagree. Built from parts by one helper — the tool's own serializer
     for the query, and the tool's optional context for anything after it. A
     tool that declares no context yields precisely `base + route + '?' + query`. */
  /* The query alone, kept separate because a demo panel parses it back through
     the overlay's own schema. Derived here rather than re-split out of `url`,
     which would have to guess where the query ends once a context fragment is
     appended. */
  const query = useMemo(
    () => tool.serialize(channels, style),
    [tool, channels, style],
  );

  const url = useMemo(
    () =>
      buildOverlayUrl({
        baseUrl,
        route: tool.overlayRoute,
        query,
        context: tool.context?.(style, runtime),
      }),
    [baseUrl, tool, query, style, runtime],
  );

  const configured = tool.configuredPlatforms(channels).length > 0;

  /* Whether `sourceTag=` is actually in the query, read from the query itself.
     `pages/multichat.tsx` derives this the same way — from the presence of the
     raw parameter — because the parsed config defaults the field and so cannot
     distinguish an explicit value from an omitted one. Deriving it here rather
     than passing a constant matters: the MultiChat serializer omits the
     parameter when the value is its default, so a hardcoded `true` would make a
     demo honour a marker the real URL leaves to the route's own default. Tools
     that never emit it simply always get false. */
  const sourceTagExplicit = useMemo(
    () => new URLSearchParams(query).has('sourceTag'),
    [query],
  );

  /* The tool's own words for what its preview is. Both registered tools supply
     one; the field is optional on the descriptor, so a tool added later without
     one still gets an accurate, if plainer, sentence rather than another tool's
     prose or a hardcoded route name. */
  const previewNote =
    tool.previewNote ??
    `A real ${tool.overlayRoute} overlay at this exact URL.`;

  const RuntimePanel = tool.runtime?.Panel;

  return (
    <div className="min-h-screen bg-ws-bg text-ws-text">
      {/* Skip link. The nav lists every tool before the settings begin, so a
          keyboard or screen-reader user otherwise tabs through all of it on
          every visit. Hidden until focused, then pinned over the nav. */}
      <a
        href="#workspace-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-ws-surface focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-ws-text focus:outline-none focus:ring-2 focus:ring-ws-ring"
      >
        Skip to settings
      </a>

      <div className="lg:flex lg:h-screen lg:overflow-hidden">
        <div className="shrink-0 lg:w-56 lg:overflow-y-auto">
          <WorkspaceNav currentPath={tool.workspaceRoute} />
        </div>

        {/* A main landmark, so the two panels are reachable by landmark
            navigation rather than only by scrolling past the nav.
            `tabIndex={-1}` makes it a valid skip-link target: without it, focus
            moves in some browsers but not others. */}
        <main
          id="workspace-main"
          tabIndex={-1}
          className="min-w-0 flex-1 focus:outline-none lg:grid lg:h-full lg:grid-cols-2 lg:overflow-hidden"
        >
          {/* The page's only h1. Visually hidden because the layout has no
              header bar to put it in, but the document must still have a
              top-level heading: without it the panel headings below are h2s
              under nothing, and heading navigation starts mid-hierarchy. */}
          <h1 className="sr-only">{tool.label} overlay generator</h1>

          <ToolConfigPanel
            toolLabel={tool.label}
            catalog={tool.catalog}
            config={style}
            onChange={changeSetting}
            help={tool.help}
            availability={availability}
          />

          <LivePreviewPanel
            url={url}
            query={query}
            demo={tool.demo}
            sourceTagExplicit={sourceTagExplicit}
            configured={configured}
            platforms={tool.platforms}
            channels={channels}
            onChannelChange={changeChannel}
            background={background}
            onBackgroundChange={setBackground}
            previewTitle={`Live ${tool.label.toLowerCase()} preview`}
            previewHeight={tool.obs.height}
            previewNote={previewNote}
            runtimePanel={
              RuntimePanel ? (
                <RuntimePanel
                  runtime={runtime}
                  onChange={setRuntime}
                  onBeforeLeave={persistDraft}
                />
              ) : null
            }
          />
        </main>
      </div>
    </div>
  );
}
