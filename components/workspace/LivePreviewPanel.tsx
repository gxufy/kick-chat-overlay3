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
import type { ViewerCounterChannels, ViewerPlatform } from '@/lib/viewerCounterConfig';

export default function LivePreviewPanel({
  url,
  configured,
  channels,
  onChannelChange,
  background,
  onBackgroundChange,
  previewTitle,
  previewHeight,
}: {
  url: string;
  configured: boolean;
  channels: ViewerCounterChannels;
  onChannelChange: (platform: ViewerPlatform, raw: string) => void;
  background: PreviewBackgroundId;
  onBackgroundChange: (next: PreviewBackgroundId) => void;
  previewTitle: string;
  previewHeight: number;
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
        />

        <PreviewBackgroundPicker value={background} onChange={onBackgroundChange} />

        <ChannelPanel channels={channels} onChange={onChannelChange} />

        <OverlayUrlBar url={url} configured={configured} />
      </div>
    </section>
  );
}
