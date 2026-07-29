/* The badge & cosmetic library: a browsable gallery of preview badge art.
 *
 * A SIBLING OF THE PICKER, NOT PART OF IT. This is deliberately its own
 * fieldset, outside `.preview-feed-sources` and `.preview-feed-chips`. The
 * picker's tests count the checkboxes in `.preview-feed-chips` and assert the
 * picker contributes no live region of its own; a control folded inside it would
 * break both. So the library sits beside the picker and owns its own status.
 *
 * POWERLESS OVER THE OVERLAY. Nothing here selects, toggles, or serializes. It
 * shows the badge art a stream may carry, grouped by provider, and its one button
 * asks the loader for more. No selection is made and none could reach a URL —
 * `usePreviewBadgeLibrary` holds no state the serializer can see.
 *
 * The status line is a single polite live region so a screen reader hears "12
 * badges" once a load lands rather than nothing. The card already carries the
 * feed's own live region; this is a distinct surface (the library, not the feed),
 * so it is scoped to this fieldset and does not multiply the feed's announcements.
 */
import type { BadgeLibraryStatus, PreviewBadgeLibraryState } from './usePreviewBadgeLibrary';

/** The human sentence for each status, kept out of the JSX for one clear map. */
function statusMessage(status: BadgeLibraryStatus, count: number): string {
  switch (status) {
    case 'loading':
      return 'Loading more badges…';
    case 'success':
      return `Badge library loaded — ${count} badges.`;
    case 'error':
      return 'Could not load more badges. The badges already shown are unchanged; try again.';
    case 'idle':
    default:
      return `${count} badges in the preview library.`;
  }
}

export default function ClassicPreviewBadgeLibrary({
  library,
}: {
  /** The library hook's state. Owned by the generator, passed straight down. */
  library: PreviewBadgeLibraryState;
}) {
  const { rows, count, status, loaded, load } = library;
  const busy = status === 'loading';

  return (
    <fieldset
      className="classic-seg preview-badge-library"
      aria-describedby="preview-badge-library-help"
    >
      <legend>Badge &amp; cosmetic library</legend>
      <p className="classic-help" id="preview-badge-library-help">
        The badge art a stream may carry, grouped by the provider that supplies
        it. This is a reference gallery — it does not change what the overlay
        draws, and nothing here reaches a generated URL. Load more badges to fetch
        the full 7TV set.
      </p>

      <div className="preview-badge-rows">
        {rows.map((row) => (
          <div className="preview-badge-row" key={row.provider}>
            {/* A visual grouping label, not a document heading: the card's
                headings stop at the h2 section titles, and an h3/h4 here would
                skip or reopen a level the generator's own accessibility suite
                forbids. The list carries the provider as its accessible name
                instead, so a screen reader still hears which row it is in. */}
            <p className="preview-badge-provider" id={`preview-badge-provider-${row.provider}`}>
              {row.provider}
            </p>
            <ul
              className="preview-badge-grid"
              aria-labelledby={`preview-badge-provider-${row.provider}`}
            >
              {row.assets.map((asset) => (
                <li className="preview-badge-item" key={asset.id}>
                  {/* Decorative-with-a-label: the visible caption names the
                      badge, so the art itself carries an empty alt rather than
                      repeating that name to a screen reader. */}
                  <img
                    className="preview-badge-art"
                    src={asset.image}
                    alt=""
                    loading="lazy"
                    width={28}
                    height={28}
                  />
                  <span className="preview-badge-name">{asset.label}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="preview-badge-actions">
        <button
          type="button"
          className="classic-conn-btn"
          onClick={load}
          disabled={busy || loaded}
        >
          {loaded ? 'Badge library loaded' : busy ? 'Loading…' : 'Load more badges'}
        </button>
      </div>

      {/* One polite live region, scoped to this fieldset. role="status" is an
          implicit aria-live=polite; the explicit attribute is kept for clarity
          and for jsdom, which does not always map the role. */}
      <p
        className="preview-badge-status"
        role="status"
        aria-live="polite"
        data-status={status}
      >
        {statusMessage(status, count)}
      </p>
    </fieldset>
  );
}
