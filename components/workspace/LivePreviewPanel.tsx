/* Right column — live preview, channel identity, and the overlay URL.
 *
 * Channels sit beside the preview because they are what makes it real. The
 * preview background selector is workspace-only state and is passed straight
 * through to the container that wraps the iframe.
 */
import ChannelPanel from './ChannelPanel';
import OverlayUrlBar from './OverlayUrlBar';
import PreviewViewport from './PreviewViewport';
import { PreviewBackgroundPicker, type PreviewBackgroundId } from './PreviewBackground';
import type { ToolChannels, ToolPlatform } from '@/lib/tools/registry';

export default function LivePreviewPanel<P extends string>({
  url,
  configured,
  platforms,
  channels,
  onChannelChange,
  background,
  onBackgroundChange,
  previewTitle,
  previewHeight,
  previewNote,
}: {
  url: string;
  configured: boolean;
  /** Channel fields supplied by the active tool, passed straight through. */
  platforms: readonly ToolPlatform<P>[];
  channels: ToolChannels<P>;
  onChannelChange: (platform: P, raw: string) => void;
  background: PreviewBackgroundId;
  onBackgroundChange: (next: PreviewBackgroundId) => void;
  previewTitle: string;
  previewHeight: number;
  /** The active tool's own description of its preview. Plain text. */
  previewNote: string;
}) {
  return (
    <section
      aria-labelledby="live-preview-heading"
      className="min-w-0 border-ws-border lg:h-full lg:overflow-y-auto lg:border-l"
    >
      <div className="space-y-5 px-4 py-5 sm:px-6">
        <div>
          <h2
            id="live-preview-heading"
            className="text-base font-semibold text-ws-text"
          >
            Live preview
          </h2>
          <p className="mt-0.5 text-xs text-ws-muted">
            The real overlay at the URL below.
          </p>
        </div>

        <PreviewViewport
          url={url}
          configured={configured}
          background={background}
          title={previewTitle}
          height={previewHeight}
          note={previewNote}
        />

        <PreviewBackgroundPicker value={background} onChange={onBackgroundChange} />

        <ChannelPanel
          platforms={platforms}
          channels={channels}
          onChange={onChannelChange}
        />

        <OverlayUrlBar url={url} configured={configured} />
      </div>
    </section>
  );
}
