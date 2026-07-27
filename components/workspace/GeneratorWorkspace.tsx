/* Three-column generator workspace shell.
 *
 * Owns the active tool's config, channel input, and the workspace-only preview
 * background. One derived URL string is produced here and handed to the
 * preview, the readonly URL field, Copy, and Open — so those four can never
 * disagree.
 *
 * Per-tool state lives in this component's own `style` object, typed by the
 * tool descriptor. It cannot read another tool's fields, so the cross-tool
 * state leakage that previously affected the counter is a type error rather
 * than a convention.
 */
import { useMemo, useState } from 'react';
import LivePreviewPanel from './LivePreviewPanel';
import ToolConfigPanel from './ToolConfigPanel';
import WorkspaceNav from './WorkspaceNav';
import type { PreviewBackgroundId } from './PreviewBackground';
import type { OverlayTool, ToolChannels } from '@/lib/tools/registry';
import type { SettingValue } from '@/lib/tools/settingTypes';
import { buildOverlayUrl } from '@/lib/tools/toolContext';

export default function GeneratorWorkspace<
  S extends Record<string, unknown>,
  P extends string,
>({
  tool,
  baseUrl,
}: {
  tool: OverlayTool<S, P>;
  /** Origin the generated URL is built against. */
  baseUrl: string;
}) {
  const [style, setStyle] = useState<S>(tool.defaults);
  const [channels, setChannels] = useState<ToolChannels<P>>({});
  const [background, setBackground] = useState<PreviewBackgroundId>('checker');

  /* Carries every generic setting value shape. What a value means, and how it
     reaches a URL, stays the tool's business — `normalize` decides. */
  const changeSetting = (key: keyof S & string, next: SettingValue) => {
    setStyle((current) => tool.normalize({ ...current, [key]: next }));
  };

  const changeChannel = (platform: P, raw: string) => {
    setChannels((current) => ({ ...current, [platform]: raw }));
  };

  /* The single source of truth for every consumer below: the preview, the
     readonly field, Copy, and Open all receive this exact string, so they
     cannot disagree. Built from parts by one helper — the tool's own serializer
     for the query, and the tool's optional context for anything after it. A
     tool that declares no context, which is every tool today, yields precisely
     `base + route + '?' + query`. */
  const url = useMemo(
    () =>
      buildOverlayUrl({
        baseUrl,
        route: tool.overlayRoute,
        query: tool.serialize(channels, style),
        context: tool.context?.(style),
      }),
    [baseUrl, tool, channels, style],
  );

  const configured = tool.configuredPlatforms(channels).length > 0;

  /* The tool's own words for what its preview is. Both registered tools supply
     one; the field is optional on the descriptor, so a tool added later without
     one still gets an accurate, if plainer, sentence rather than another tool's
     prose or a hardcoded route name. */
  const previewNote =
    tool.previewNote ??
    `A real ${tool.overlayRoute} overlay at this exact URL.`;

  return (
    <div className="min-h-screen bg-ws-bg text-ws-text">
      <div className="lg:flex lg:h-screen lg:overflow-hidden">
        <div className="shrink-0 lg:w-56 lg:overflow-y-auto">
          <WorkspaceNav currentPath={tool.workspaceRoute} />
        </div>

        <div className="min-w-0 flex-1 lg:grid lg:h-full lg:grid-cols-2 lg:overflow-hidden">
          <ToolConfigPanel
            toolLabel={tool.label}
            catalog={tool.catalog}
            config={style}
            onChange={changeSetting}
            help={tool.help}
          />

          <LivePreviewPanel
            url={url}
            configured={configured}
            platforms={tool.platforms}
            channels={channels}
            onChannelChange={changeChannel}
            background={background}
            onBackgroundChange={setBackground}
            previewTitle={`Live ${tool.label.toLowerCase()} preview`}
            previewHeight={tool.obs.height}
            previewNote={previewNote}
          />
        </div>
      </div>
    </div>
  );
}
