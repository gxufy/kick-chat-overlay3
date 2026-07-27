/* Demo Preview — the production overlay, rendered over sample messages.
 *
 * This is NOT a second chat renderer. It mounts `components/ChatOverlay`, the
 * same component `pages/multichat.tsx` mounts, and hands it `ParsedMessage`
 * values of the same type the four live connectors produce. Every appearance
 * setting therefore behaves here exactly as it will in OBS, because the code
 * deciding that is the same code — badges, 7TV paints, name pills, avatars,
 * event cards, source tags, stroke, shadow, font, and the pin card included.
 *
 * The config is not mapped from workspace state by hand. It is built by
 * serializing state to a query string with the tool's own serializer and parsing
 * that string back through `MultichatQuerySchema` — the identical round trip the
 * overlay route performs on a real URL. A hand-written mapping would be a second
 * interpretation of the same parameters and would drift; this cannot, because a
 * parameter the serializer stops emitting is a parameter this stops receiving.
 *
 * Live Preview remains an iframe of the real route. This exists because a live
 * preview of an offline channel is correctly empty, which shows nothing about
 * styling — see the mode switch in LivePreviewPanel.
 */
import { useMemo } from 'react';
import ChatOverlay from '@/components/ChatOverlay';
import { safeParseMultichatConfig } from '@/lib/multichatConfig';
import type { ParsedMessage } from '@/lib/kick';
import { samplePin } from '@/lib/tools/multichat/samples';

/** Parse a query string into the config the overlay expects. */
function configFromQuery(query: string) {
  const raw = Object.fromEntries(new URLSearchParams(query).entries());
  const parsed = safeParseMultichatConfig(raw);
  return parsed.success ? parsed.data : null;
}

export default function DemoPreview({
  query,
  messages,
  showPin,
  height,
  sourceTagExplicit,
}: {
  /** The overlay query string, from the tool's own serializer. */
  query: string;
  /** Samples to render, already filtered by the caller. */
  messages: readonly ParsedMessage[];
  /** Whether to render the pin card above the list. */
  showPin: boolean;
  /** Viewport height, matching the OBS height the tool declares. */
  height: number;
  /** Passed through so an explicit sourceTag= is honoured as on the real route. */
  sourceTagExplicit: boolean;
}) {
  const config = useMemo(() => configFromQuery(query), [query]);

  /* The overlay takes the pin separately from the message list, so this is
     resolved from the sample data rather than spliced into `messages`. */
  const pinnedMessage = useMemo(() => (showPin ? samplePin() : null), [showPin]);

  if (!config) {
    /* Only reachable if the serializer emitted something the parser rejects,
       which would be a real defect worth surfacing rather than hiding behind an
       empty preview. */
    return (
      <p
        role="status"
        className="flex h-full items-center justify-center px-4 text-center text-sm text-ws-danger"
      >
        These settings did not parse. That is a bug — the generated URL would not
        load either.
      </p>
    );
  }

  return (
    /* Named, as the Live iframe is named by its title. Without this a screen
       reader reads nine lines of invented chat with nothing saying they are
       samples rather than a real stream. A group rather than a region: it is a
       labelled grouping inside the preview, not a landmark worth its own entry in
       the landmark list. */
    <div
      role="group"
      aria-label="Sample chat messages — not a live stream"
      style={{ minHeight: height }}
      data-testid="demo-preview"
    >
      <ChatOverlay
        config={config}
        messages={messages as ParsedMessage[]}
        /* Nothing is mid-fade in a static demo, and no loader: the samples are
           present from first paint, so a spinner would be a lie. */
        fadingIds={EMPTY_FADING}
        pinnedMessage={pinnedMessage}
        showLoader={false}
        sourceTagExplicit={sourceTagExplicit}
      />
    </div>
  );
}

/* Hoisted so the identity is stable across renders — a fresh Set every render
   would change ChatOverlay's props on every keystroke for no reason. */
const EMPTY_FADING: Set<string> = new Set();
