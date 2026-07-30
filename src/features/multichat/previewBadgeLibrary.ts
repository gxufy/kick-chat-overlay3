/* The generator's badge & cosmetic library: a browsable catalog of preview
 * badge art, seeded locally and extended by one real 7TV fetch on request.
 *
 * WHY THIS IS A CATALOG, NOT A CHAT INJECTION. The live preview feed already
 * renders 7TV badges through the production path — a fixture chatter is entitled
 * to `SAMPLE_SEVENTV_BADGE`, and `buildParsedMessage` attaches it exactly as the
 * overlay would. That is the renderer audit. This module is the other half the
 * spec asks for: a *library* the user can open to see the badge art a stream may
 * carry, grouped by the provider that supplies it. It never composes a chat line
 * and never decides what the overlay draws.
 *
 * GENERATOR-ONLY, AND SERIALIZED NOWHERE. Nothing here reaches an overlay URL or
 * the saved draft. The real overlay (`pages/multichat.tsx`) does not import this
 * file, so loading the library opens a request the overlay never would. The
 * catalog is a preview convenience; a browser source must not depend on it.
 *
 * ONE AUTHORITATIVE LOADER. `loadPreviewBadges` is the single place a network
 * fetch happens. A process-wide cache holds the first success for the session, an
 * in-flight promise is shared so a double-invoked effect cannot fire two
 * requests, and a failure is never cached — so a retry can succeed. A caller that
 * wants the cached set without a request reads `cachedPreviewBadges`.
 *
 * Browser-safe — no server-only imports, no secrets, no clock, no `Math.random`.
 */
import type { SevenTVBadge } from '@/lib/kick';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/**
 * Who supplies a badge. A closed union rather than a free string, so a provider
 * row cannot be misspelled into existence and the seed and the loader agree on
 * the same labels.
 */
export type BadgeProvider = '7TV' | 'FFZ';

/**
 * One asset in the catalog.
 *
 * Extends `SevenTVBadge` ({ id, image }) so a catalog entry and a rendered badge
 * are the same shape — the library shows exactly what the renderer would draw,
 * not an approximation of it. `label` and `provider` are the catalog's own
 * columns and are never part of what the overlay consumes.
 */
export type PreviewBadgeAsset = SevenTVBadge & {
  /** Human name for the asset, shown under its art. */
  readonly label: string;
  /** The provider whose row this asset sits in. */
  readonly provider: BadgeProvider;
};

/* ------------------------------------------------------------------ */
/* Error                                                               */
/* ------------------------------------------------------------------ */

/**
 * Thrown by {@link loadPreviewBadges} when the request or its response fails.
 *
 * `code` distinguishes a network/abort failure from a well-formed HTTP response
 * whose body did not validate, so a caller can word its status differently. An
 * abort is re-thrown as the original `AbortError` rather than wrapped, so callers
 * can still detect it by name.
 */
export class PreviewBadgeLoadError extends Error {
  constructor(
    message: string,
    readonly code: 'network' | 'bad-response',
  ) {
    super(message);
    this.name = 'PreviewBadgeLoadError';
  }
}

/* ------------------------------------------------------------------ */
/* Seed catalog — local, typed, offline                               */
/* ------------------------------------------------------------------ */

/* Original FFZ-style room-badge art, as local data URIs. These stand in for the
   room badges a channel can override, so the catalog is never empty and never
   needs the network to show *something* — Load More only adds to it. Modelled on
   the inline art already in lib/tools/multichat/previewSimulator.ts; drawn for
   this repository, copied from nothing. */
const FFZ_MOD_ART =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#5c16c5">' +
      '<path d="M3 4h18v13a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Zm4.6 4.2v7.6h2V12l2.4 2.7 2.4-2.7v3.8h2V8.2h-2L12 11.4 9.6 8.2Z"/></svg>',
  );

const FFZ_VIP_ART =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#e005b9">' +
      '<path d="M2 6h4l3 9 3-9h4l-6 13H8Zm14 0h4v13h-4Z"/></svg>',
  );

/**
 * The catalog before any fetch: local art the preview can always show.
 *
 * Typed and closed, so the library has a stable starting point that renders
 * offline and in tests. Load More appends the 7TV row to this rather than
 * replacing it.
 */
export const PREVIEW_BADGE_CATALOG: readonly PreviewBadgeAsset[] = [
  { id: 'ffz-mod', image: FFZ_MOD_ART, label: 'FFZ moderator', provider: 'FFZ' },
  { id: 'ffz-vip', image: FFZ_VIP_ART, label: 'FFZ VIP', provider: 'FFZ' },
];

/* ------------------------------------------------------------------ */
/* Grouping                                                            */
/* ------------------------------------------------------------------ */

/** A provider's row in the library: its name and the assets it supplies. */
export type BadgeProviderRow = {
  readonly provider: BadgeProvider;
  readonly assets: readonly PreviewBadgeAsset[];
};

/* Provider display order. Fixed so the rows do not reshuffle when the 7TV row
   arrives — a catalog that reordered itself on Load More would be disorienting. */
const PROVIDER_ORDER: readonly BadgeProvider[] = ['FFZ', '7TV'];

/**
 * Group a flat asset list into provider rows, in a fixed order.
 *
 * Empty providers are omitted, so before a fetch the 7TV row simply is not there
 * rather than being an empty heading. Deduplicates by id within the whole list,
 * keeping the first occurrence, so a seed asset is never doubled by a fetch.
 */
export function groupByProvider(
  assets: readonly PreviewBadgeAsset[],
): readonly BadgeProviderRow[] {
  const seen = new Set<string>();
  const rows = new Map<BadgeProvider, PreviewBadgeAsset[]>();
  for (const asset of assets) {
    if (seen.has(asset.id)) continue;
    seen.add(asset.id);
    const bucket = rows.get(asset.provider) ?? [];
    bucket.push(asset);
    rows.set(asset.provider, bucket);
  }
  const ordered: BadgeProviderRow[] = [];
  for (const provider of PROVIDER_ORDER) {
    const bucket = rows.get(provider);
    if (bucket && bucket.length > 0) ordered.push({ provider, assets: bucket });
  }
  return ordered;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

/* Browser-side validation of an external response, per the pattern in
   lib/twitchPinClient.ts: never trust the shape, extract only what is needed,
   and discard anything malformed rather than passing it to the renderer. */

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

/**
 * Map one raw 7TV badge node to a catalog asset, or null if it is unusable.
 *
 * The art URL is built from the badge's own CDN host exactly as lib/cosmetics.ts
 * builds it for an entitled badge (`https:<host>/3x`), so a library asset and a
 * rendered 7TV badge resolve to the same image. A node missing an id or a host is
 * dropped rather than guessed at.
 */
function mapBadgeNode(node: unknown): PreviewBadgeAsset | null {
  if (!isPlainObject(node)) return null;
  const id = node.id;
  if (!isNonEmptyString(id)) return null;
  const host = isPlainObject(node.host) ? node.host.url : undefined;
  if (!isNonEmptyString(host)) return null;
  const tooltip = isNonEmptyString(node.tooltip) ? node.tooltip : id;
  return {
    id,
    image: `https:${host}/3x`,
    label: tooltip,
    provider: '7TV',
  };
}

/* ------------------------------------------------------------------ */
/* Loader                                                              */
/* ------------------------------------------------------------------ */

const SEVENTV_GQL = 'https://7tv.io/v3/gql';

/* The public cosmetics list — the same endpoint lib/cosmetics.ts calls per user,
   asked here for the global badge set instead. `list: []` returns every badge. */
const BADGE_QUERY =
  'query { cosmetics(list: []) { badges { id tooltip host { url } } } }';

/** The first successful catalog fetch, held for the session. Null until then. */
let sessionCache: readonly PreviewBadgeAsset[] | null = null;

/** The shared request, so a double-invoked effect cannot fire two of them. */
let inFlight: Promise<readonly PreviewBadgeAsset[]> | null = null;

/** The cached catalog if one has loaded this session, else null. No request. */
export function cachedPreviewBadges(): readonly PreviewBadgeAsset[] | null {
  return sessionCache;
}

/** Test-only: drop the session cache and any shared request. */
export function __resetPreviewBadgeCache(): void {
  sessionCache = null;
  inFlight = null;
}

async function requestBadges(
  signal?: AbortSignal,
): Promise<readonly PreviewBadgeAsset[]> {
  let response: Response;
  try {
    response = await fetch(SEVENTV_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: BADGE_QUERY }),
      signal,
    });
  } catch (error) {
    /* Preserve an abort so the caller can tell a cancelled load from a failed
       one and leave its state untouched. */
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new PreviewBadgeLoadError('Badge library request failed.', 'network');
  }

  if (!response.ok) {
    throw new PreviewBadgeLoadError(
      'Badge library request failed.',
      'bad-response',
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new PreviewBadgeLoadError('Badge library request failed.', 'bad-response');
  }

  const cosmetics = isPlainObject(body) && isPlainObject(body.data)
    ? body.data.cosmetics
    : undefined;
  const rawBadges = isPlainObject(cosmetics) ? cosmetics.badges : undefined;
  if (!Array.isArray(rawBadges)) {
    throw new PreviewBadgeLoadError('Badge library response was malformed.', 'bad-response');
  }

  const assets: PreviewBadgeAsset[] = [];
  for (const node of rawBadges) {
    const asset = mapBadgeNode(node);
    if (asset) assets.push(asset);
  }
  if (assets.length === 0) {
    /* A well-formed response with nothing usable is a bad response, not an empty
       success: caching it would hide the real catalog behind a permanent blank. */
    throw new PreviewBadgeLoadError('Badge library response was empty.', 'bad-response');
  }
  return assets;
}

/**
 * Load the 7TV badge catalog, once per session.
 *
 * Returns the cached set immediately if one has loaded, shares an in-flight
 * request if one is running, and otherwise fetches. A success is cached; a
 * failure or abort is not, so a retry is free to succeed. The returned assets are
 * the 7TV row alone — a caller merges them with {@link PREVIEW_BADGE_CATALOG}.
 */
export function loadPreviewBadges(
  signal?: AbortSignal,
): Promise<readonly PreviewBadgeAsset[]> {
  if (sessionCache) return Promise.resolve(sessionCache);
  if (inFlight) return inFlight;
  const request = requestBadges(signal).then(
    (assets) => {
      sessionCache = assets;
      inFlight = null;
      return assets;
    },
    (error) => {
      inFlight = null;
      throw error;
    },
  );
  inFlight = request;
  return request;
}
