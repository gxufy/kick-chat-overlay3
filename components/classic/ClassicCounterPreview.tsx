/* The generator's built-in counter preview: the production renderer over fixtures.
 *
 * This is NOT a second counter renderer. It mounts
 * `components/ViewerCounterDisplay` — the same component pages/counter.tsx
 * mounts — and hands it `PlatformStatuses`, the same shape the live overlay
 * folds `/api/viewers` results into. Every counter setting therefore behaves
 * here exactly as it will in OBS: combined and separate modes, icons,
 * alignment, the pill background, the shadow, the outline, and the rolling
 * number's own formatting included.
 *
 * The configuration is not mapped from generator state by hand. State is
 * serialized by the tool's own serializer and parsed back through
 * `parseViewerCounterConfig` — the identical round trip pages/counter.tsx
 * performs on a real URL. A hand-written mapping would be a second reading of
 * the same six parameters and would drift; this cannot.
 *
 * WHAT IT DOES NOT DO. No iframe, no fetch of /api/viewers, no polling, no pin
 * polling, no timers of its own. It is a pure function of (query string,
 * counts): mount it and it paints. A live preview of a channel nobody has typed
 * yet is correctly empty, and an empty frame shows nothing about styling.
 *
 * The counts never reach a generated URL. They are not serialized, not written
 * to the draft, and not part of `counterQuery`; this component only reads it.
 */
import { useMemo } from 'react';
import ViewerCounterDisplay from '@/components/ViewerCounterDisplay';
import {
  parseViewerCounterConfig,
  type PlatformStatuses,
} from '@/lib/viewerCounterConfig';

/** Parse a serialized query string into the config the overlay expects. */
function styleFromQuery(query: string) {
  const raw = Object.fromEntries(new URLSearchParams(query).entries());
  return parseViewerCounterConfig(raw).style;
}

export default function ClassicCounterPreview({
  query,
  statuses,
  height,
}: {
  /** The counter query string, from the tool's own serializer. */
  query: string;
  /** Sample statuses to render. */
  statuses: PlatformStatuses;
  /** Viewport height, matching the OBS height the tool declares. */
  height: number;
}) {
  const style = useMemo(() => styleFromQuery(query), [query]);

  return (
    /* Labelled, as the live iframe is labelled by its title. Without this a
       screen reader reads four invented numbers with nothing saying they are
       samples rather than a real audience. A group rather than a region: a
       labelled grouping inside the preview, not a landmark worth its own entry
       in the landmark list. */
    <div
      role="group"
      aria-label="Preview data — sample viewer counts, not live numbers"
      /* The same padding the overlay page applies around the renderer, so the
         pills are not flush against the preview surface's edge here while
         being inset in OBS. */
      style={{ minHeight: height, padding: 8, boxSizing: 'border-box', width: '100%' }}
      data-testid="counter-fixture-preview"
    >
      <ViewerCounterDisplay statuses={statuses} style={style} />
    </div>
  );
}
