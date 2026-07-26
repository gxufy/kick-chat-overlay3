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
import type { OverlayTool } from '@/lib/tools/registry';
import type { ViewerCounterChannels, ViewerPlatform } from '@/lib/viewerCounterConfig';

export default function GeneratorWorkspace<S extends Record<string, unknown>>({
  tool,
  baseUrl,
}: {
  tool: OverlayTool<S>;
  /** Origin the generated URL is built against. */
  baseUrl: string;
}) {
  const [style, setStyle] = useState<S>(tool.defaults);
  const [channels, setChannels] = useState<ViewerCounterChannels>({});
  const [background, setBackground] = useState<PreviewBackgroundId>('checker');

  const changeSetting = (key: keyof S & string, next: boolean | string) => {
    setStyle((current) => tool.normalize({ ...current, [key]: next }));
  };

  const changeChannel = (platform: ViewerPlatform, raw: string) => {
    setChannels((current) => ({ ...current, [platform]: raw }));
  };

  /* The single source of truth for every consumer below. Built with the
     overlay's own serializer, so it is byte-identical to what the existing
     generator produces for the same inputs. */
  const url = useMemo(
    () => `${baseUrl}${tool.overlayRoute}?${tool.serialize(channels, style)}`,
    [baseUrl, tool, channels, style],
  );

  const configured = tool.configuredPlatforms(channels).length > 0;

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
          />

          <LivePreviewPanel
            url={url}
            configured={configured}
            channels={channels}
            onChannelChange={changeChannel}
            background={background}
            onBackgroundChange={setBackground}
            previewTitle={`Live ${tool.label.toLowerCase()} preview`}
            previewHeight={tool.obs.height}
          />
        </div>
      </div>
    </div>
  );
}
