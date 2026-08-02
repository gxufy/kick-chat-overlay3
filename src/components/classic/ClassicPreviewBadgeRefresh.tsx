/* Preview-badge workflow adapted from Fiszh/UChat at
 * ba8841c1db75af4f135ef1cd19f8745e5e12b4e3 (AGPL-3.0-or-later).
 * Modified 2026-08-01 to load through MultiChat's production badge pipeline.
 *
 *
 * What replaced the gallery. The browsable grid of badge art is gone — a stream's
 * badges belong beside the usernames in the preview, not in a reference catalog
 * nobody was choosing from. This is all that remains of the library's *surface*:
 * a single button that asks the loader for the full 7TV set, and a one-line status
 * so the request is not silent.
 *
 * POWERLESS OVER THE OVERLAY, exactly as the gallery was. Nothing here selects,
 * toggles, or serializes; `usePreviewBadgeLibrary` holds no state the serializer
 * can see, and the real overlay never imports its loader. Refreshing badges opens
 * a request OBS never makes, and no badge id can reach a generated URL.
 *
 * The status is one polite live region scoped to this control. It reports the
 * catalog size, the in-flight load, and — crucially — that a failed refresh leaves
 * the badges already shown untouched. It does not announce the continuous feed;
 * the feed owns its own summarised region elsewhere in the card.
 */
import type { BadgeLibraryStatus, PreviewBadgeLibraryState } from './usePreviewBadgeLibrary';

/** The button face for each status. Idle and success both invite a refresh; a
    load in flight is disabled; a failure invites a retry. */
function buttonLabel(status: BadgeLibraryStatus): string {
  switch (status) {
    case 'loading':
      return 'Loading badges…';
    case 'error':
    case 'partial':
      return 'Retry Load Badges';
    case 'success':
      return 'Reload Badges';
    case 'idle':
    default:
      return 'Load Badges';
  }
}

/** The one-line status sentence. */
function statusMessage(
  status: BadgeLibraryStatus,
  count: number,
  failedProviders: readonly string[],
): string {
  switch (status) {
    case 'loading':
      return 'Loading Twitch, Kick, 7TV, and FFZ preview badges…';
    case 'success':
      return `Preview badges loaded — ${count} available.`;
    case 'partial':
      return `Loaded ${count} preview badges. Retry ${failedProviders.join(', ')}.`;
    case 'error':
      return 'Could not refresh badges. The ones already shown are unchanged.';
    case 'idle':
    default:
      return `${count} local preview badges ready.`;
  }
}

export default function ClassicPreviewBadgeRefresh({
  library,
}: {
  /** The library hook's state. Owned by the generator, passed straight down. */
  library: PreviewBadgeLibraryState;
}) {
  const { count, status, failedProviders, load } = library;
  const busy = status === 'loading';

  return (
    <div className="preview-badge-refresh">
      <button
        type="button"
        className="classic-conn-btn"
        onClick={load}
        disabled={busy}
      >
        {buttonLabel(status)}
      </button>
      {/* One polite live region, scoped here. role="status" is an implicit
          aria-live=polite; the explicit attribute is kept for jsdom, which does
          not always map the role. */}
      <span
        className="preview-badge-status"
        role="status"
        aria-live="polite"
        data-status={status}
      >
        {statusMessage(status, count, failedProviders)}
      </span>
    </div>
  );
}
