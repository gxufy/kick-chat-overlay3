/* A runtime safety net for badge and emote images that fail to load.
 *
 * WHAT THIS IS FOR, AND WHAT IT IS NOT. The real fix for a broken preview image
 * is valid fixture data — that lives in lib/tools/multichat/previewAssets.ts and
 * is where a dead URL should be corrected. This handler is the last line of
 * defence for the images the renderer cannot vouch for: the live Twitch badge
 * CDN, a channel's 7TV emote art, an FFZ room badge. When one of those 404s or
 * times out on a real overlay, the browser would otherwise draw its broken-image
 * glyph in the middle of a chat line. This hides that one image and leaves the
 * rest of the message intact.
 *
 * THE RULES IT KEEPS.
 *   - It hides only the failed <img>, and with `display:none` so the element
 *     claims no width — no broken glyph, no empty gap where art would sit.
 *   - It clears its own `onerror` immediately, so a src that keeps failing can
 *     never spin the handler in a loop.
 *   - It logs each failed URL at most once, across the whole session, so a wall
 *     of identical warnings cannot bury the console.
 *   - It never logs a data URI's body: those are kilobytes of base64 or SVG, and
 *     a fixture data URI failing is a code bug worth a short, bounded line.
 *
 * Browser-safe — no server-only imports, no secrets, no network.
 */
import type React from 'react';

/* The URLs already logged this session. A module-level Set is deliberate: the
   point is one diagnostic per distinct URL for as long as the page lives.
   Exported reset exists so a test can assert the "once" behaviour without one
   test's log state leaking into the next. */
const loggedUrls = new Set<string>();

/** A short, safe label for a src — never the full body of a data URI. */
function describeSource(src: string): string {
  if (src.startsWith('data:')) {
    /* Keep the mime prefix (data:image/svg+xml…), drop the payload. Enough to
       say which fixture broke, none of the kilobytes that would follow. */
    const comma = src.indexOf(',');
    const prefix = comma === -1 ? src.slice(0, 32) : src.slice(0, comma);
    return `${prefix},<data omitted>`;
  }
  /* A remote or app URL is short and is the useful part of the diagnostic. */
  return src.length > 200 ? `${src.slice(0, 200)}…` : src;
}

/** The key a URL is de-duplicated by: the mime type for data URIs, else the URL. */
function logKey(src: string): string {
  return src.startsWith('data:') ? describeSource(src) : src;
}

/**
 * `onError` for any badge or emote <img>.
 *
 * Hides the failed image and logs its URL once. Written to be attached with
 * `onError={handleAssetError}` and nothing else — it reads the target from the
 * event, so one shared reference wires every image without a per-image closure.
 */
export function handleAssetError(event: React.SyntheticEvent<HTMLImageElement>): void {
  const img = event.currentTarget;

  /* Stop any further error events from this element before touching it, so a
     handler can never re-enter on the same broken src. */
  img.onerror = null;

  /* Hidden, not merely emptied: display:none removes the layout box entirely, so
     no gap remains where the art would have been. The surrounding name, badges
     and text are untouched — only this element leaves the flow. */
  img.style.display = 'none';
  /* A hook for tests and for anyone inspecting a live overlay. */
  img.setAttribute('data-asset-failed', 'true');

  const src = img.getAttribute('src') ?? '';
  const key = logKey(src);
  if (!loggedUrls.has(key)) {
    loggedUrls.add(key);
    /* console.warn rather than throw: a missing badge must never take down the
       overlay. One line, the safe label only. */
    console.warn(`[overlay] hiding image that failed to load: ${describeSource(src)}`);
  }
}

/**
 * Forget every logged URL.
 *
 * Only for tests: the "log once per URL" guarantee is session-scoped state, and
 * a suite asserting it must be able to start from empty so one test's failures
 * do not silence the next test's. Not called in production.
 */
export function resetAssetErrorLog(): void {
  loggedUrls.clear();
}