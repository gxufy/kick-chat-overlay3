/* CounterPreview — live preview of the /counter overlay in the generator.
 *
 * It embeds the real same-origin /counter route in an iframe using the very
 * same URL the Copy button hands out. There is no synthetic data and no
 * duplicated platform logic: the preview shows the actual concurrent-viewer
 * counts, the actual availability behaviour (em dash for live-but-unknown,
 * nothing for confirmed offline), and the actual polling cadence, because it
 * *is* the overlay.
 *
 * The incoming URL changes on every keystroke in a channel field, so reloads
 * are debounced: the iframe only navigates once typing has paused.
 */
import { useEffect, useState } from 'react';

/** How long the incoming URL must hold still before the iframe reloads. */
const PREVIEW_DEBOUNCE_MS = 350;

/**
 * Fixed preview viewport height. Tall enough for one pill row at the
 * counter's fixed 34 px type plus the overlay's own 8 px padding, without
 * constraining width — the counter aligns left/center/right inside it.
 */
const PREVIEW_HEIGHT = 80;

export default function CounterPreview({
  url,
  configured,
}: {
  /** The generated /counter URL — identical to the one Copy provides. */
  url: string;
  /** Whether at least one normalized platform channel is configured. */
  configured: boolean;
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

    /* Runs before the next effect and on unmount, so a pending reload is
       always cancelled by newer typing or by leaving the Counter tab. */
    return () => clearTimeout(timeout);
  }, [url, configured]);

  /* Nothing configured, or nothing settled yet: render no iframe at all, so no
     overlay mounts and no polling starts. The `configured` half is checked on
     every render, so clearing the last channel removes the iframe immediately
     rather than after the debounce. */
  if (!configured || !settledUrl) return null;

  return (
    <iframe
      src={settledUrl}
      title="Live viewer counter preview"
      scrolling="no"
      style={{
        display: 'block',
        width: '100%',
        height: PREVIEW_HEIGHT,
        border: 'none',
        background: 'transparent',
        overflow: 'hidden',
      }}
    />
  );
}
