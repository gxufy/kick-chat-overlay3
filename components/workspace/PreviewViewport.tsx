/* PreviewViewport — the backdrop plus the preview frame, and the only place
 * the workspace's own shell states are rendered.
 *
 * Shell states are deliberately limited to what the parent can actually know:
 * whether a platform is configured, and whether the debounced frame has
 * mounted yet. Offline, empty, live-unknown, and unavailable are the embedded
 * overlay's own states; nothing reports them back out, and this component never
 * claims them.
 *
 * The caption below the frame is the active tool's own `previewNote`. No overlay
 * route or per-tool prose is written here.
 */
import { useCallback, useState } from 'react';
import OverlayPreviewFrame from './OverlayPreviewFrame';
import PreviewBackground, { type PreviewBackgroundId } from './PreviewBackground';

export default function PreviewViewport({
  url,
  configured,
  background,
  title,
  height,
  note,
}: {
  url: string;
  configured: boolean;
  background: PreviewBackgroundId;
  title: string;
  height: number;
  /** What this preview is, in the active tool's own words. Plain text. */
  note: string;
}) {
  const [frameMounted, setFrameMounted] = useState(false);
  const handleMountedChange = useCallback(
    (next: boolean) => setFrameMounted(next),
    [],
  );

  return (
    <div>
      <PreviewBackground background={background}>
        <div style={{ minHeight: height }} className="relative">
          <OverlayPreviewFrame
            url={url}
            configured={configured}
            title={title}
            height={height}
            onMountedChange={handleMountedChange}
          />

          {/* The workspace's own two shell states, and nothing more. */}
          {!configured ? (
            <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-ws-muted">
              Enter at least one channel to see a live preview.
            </p>
          ) : !frameMounted ? (
            <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-ws-muted">
              Loading preview…
            </p>
          ) : null}
        </div>
      </PreviewBackground>

      {/* Supplied by the active tool. No overlay route is named here. */}
      <p className="mt-2 text-xs text-ws-muted">{note}</p>
    </div>
  );
}
