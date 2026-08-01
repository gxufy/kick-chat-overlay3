/* OverlayPreviewFrame — the one live-overlay preview implementation.
 *
 * It embeds a real same-origin overlay route in an iframe using the very same
 * URL the Copy button hands out. There is no synthetic data and no duplicated
 * platform logic: the preview shows actual counts, actual availability
 * behaviour, and the actual polling cadence, because it *is* the overlay.
 *
 * The incoming URL changes on every keystroke in a channel field, so
 * navigation is debounced: the iframe only reloads once typing has paused.
 * Appearance changes navigate the iframe too — there is no parent/overlay
 * message protocol, so every settled URL is a fresh document load.
 */
import { useEffect, useState } from 'react';

/** How long the incoming URL must hold still before the iframe navigates. */
export const PREVIEW_DEBOUNCE_MS = 350;

export default function OverlayPreviewFrame({
  url,
  configured,
  title,
  height,
}: {
  /** The generated overlay URL — identical to the one Copy provides. */
  url: string;
  /** Whether the tool has enough valid channel input to render. */
  configured: boolean;
  /** Accessible iframe title. */
  title: string;
  /** Fixed viewport height in pixels. */
  height: number;
}) {
  /* The last settled URL, or null when there is nothing valid to show.
     Deliberately never seeded from `url`: at mount `url` is the channel-less
     default, and using it would let the iframe load that URL the instant a
     first character makes `configured` true, before the debounce has run. */
  const [settledUrl, setSettledUrl] = useState<string | null>(null);

  useEffect(() => {
    /* Only a configured URL is ever settled, so no channel-less URL can reach
       the iframe's src — not at mount, and not on any later transition back
       to configured. */
    const next = configured ? url : null;

    const timeout = setTimeout(() => setSettledUrl(next), PREVIEW_DEBOUNCE_MS);

    /* Runs before the next effect and on unmount, so a pending navigation is
       always cancelled by newer typing or by leaving the workspace. */
    return () => clearTimeout(timeout);
  }, [url, configured]);

  /* Nothing configured, or nothing settled yet: render no iframe at all, so no
     overlay mounts and no polling starts. The `configured` half is checked on
     every render, so clearing the last channel removes the iframe immediately
     rather than after the debounce. */
  if (!configured || settledUrl === null) return null;

  return (
    <iframe
      src={settledUrl}
      title={title}
      scrolling="no"
      style={{
        display: 'block',
        width: '100%',
        height,
        border: 'none',
        background: 'transparent',
        overflow: 'hidden',
      }}
    />
  );
}
