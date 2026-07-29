/* The badge library's loading state, as a hook.
 *
 * It owns exactly what the loader cannot: which assets are currently shown, and
 * where the one request stands. The loader (lib/tools/multichat/previewBadgeLibrary)
 * is the authority on fetching and caching; this is the authority on presenting
 * that to the card.
 *
 * THE ONE INVARIANT THIS PROTECTS. A failed Load More must not clear the assets
 * already on screen. So `assets` only ever grows — it starts as the local seed
 * catalog, a success merges the fetched row in, and a failure or abort leaves it
 * exactly as it was and only moves the status to 'error'. This is asserted in
 * tests/unit/previewBadgeLibrary.test.tsx.
 *
 * NO REQUEST WITHOUT A CLICK. Nothing here fetches on mount. The request happens
 * only when `load` is called, which the card wires to a button — so mounting the
 * generator opens no connection, exactly as the picker's own test requires of the
 * feed. If the session cache is already warm from an earlier click, `load`
 * resolves from it without a request.
 *
 * Browser-safe — no server-only imports, no secrets, no clock, no `Math.random`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PREVIEW_BADGE_CATALOG,
  cachedPreviewBadges,
  groupByProvider,
  loadPreviewBadges,
  type BadgeProviderRow,
  type PreviewBadgeAsset,
} from '@/lib/tools/multichat/previewBadgeLibrary';

/** Where the one request stands, as a closed union rather than loose booleans. */
export type BadgeLibraryStatus = 'idle' | 'loading' | 'success' | 'error';

export type PreviewBadgeLibraryState = {
  /** Assets currently shown, grouped by provider. Only ever grows. */
  readonly rows: readonly BadgeProviderRow[];
  /** The same assets, flat and ungrouped, for building preview cosmetics from.
      Only ever grows, exactly as `rows` does — the generator entitles the feed's
      reserved badge senders to these, so a successful load flows straight into the
      chat preview without the card needing to know the grouping. */
  readonly assets: readonly PreviewBadgeAsset[];
  /** Flat asset count, for a status line that need not know the grouping. */
  readonly count: number;
  readonly status: BadgeLibraryStatus;
  /** True once a success has loaded, so the button can retire itself. */
  readonly loaded: boolean;
  /** Begin (or resolve from cache) the one badge request. */
  load: () => void;
};

/** Merge fetched assets onto the seed, keeping the seed's leading position. */
function mergeAssets(
  fetched: readonly PreviewBadgeAsset[],
): readonly PreviewBadgeAsset[] {
  /* groupByProvider deduplicates by id, so concatenation is safe: a fetched
     asset sharing a seed id is dropped rather than doubled. */
  return [...PREVIEW_BADGE_CATALOG, ...fetched];
}

export function usePreviewBadgeLibrary(): PreviewBadgeLibraryState {
  /* Seed synchronously, and adopt a warm session cache on the first render so a
     remount after a successful load shows the full catalog without re-fetching. */
  const [assets, setAssets] = useState<readonly PreviewBadgeAsset[]>(() => {
    const cached = cachedPreviewBadges();
    return cached ? mergeAssets(cached) : PREVIEW_BADGE_CATALOG;
  });
  const [status, setStatus] = useState<BadgeLibraryStatus>(() =>
    cachedPreviewBadges() ? 'success' : 'idle',
  );

  /* One controller per mount, aborted on unmount so a slow request cannot set
     state after the card is gone. */
  const abortRef = useRef<AbortController | null>(null);
  /* Guards against a resolution landing after unmount — the abort covers the
     fetch, this covers the cache-hit fast path, which does not touch the signal. */
  const aliveRef = useRef(true);
  /* Whether a request is already running. A plain ref rather than a read of
     `status`, because the guard must be settled synchronously: Strict Mode calls
     an effect (and would call a state updater) twice, and a guard that lived in
     state would not have committed before the second call, firing two fetches.
     Set before the async work starts and cleared when it settles. */
  const loadingRef = useRef(false);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const load = useCallback(() => {
    /* Idempotent while a request is in flight and after one has succeeded. The
       loader itself would short-circuit either way, but returning early here
       keeps the status from flickering and keeps the fetch count honest — the
       one-request-per-click guarantee the tests assert. */
    if (loadingRef.current) return;
    if (cachedPreviewBadges()) {
      /* Warm cache: adopt it without a request. Covers the case where an earlier
         mount loaded and this one has not yet read the cache into state. */
      setAssets(mergeAssets(cachedPreviewBadges()!));
      setStatus('success');
      return;
    }
    loadingRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('loading');
    loadPreviewBadges(controller.signal).then(
      (fetched) => {
        loadingRef.current = false;
        if (!aliveRef.current || controller.signal.aborted) return;
        setAssets(mergeAssets(fetched));
        setStatus('success');
      },
      (error) => {
        loadingRef.current = false;
        /* An abort is not a failure the user should see — the card is gone or a
           new load superseded this one — so leave the status alone. Any other
           error moves to 'error' while `assets` stays exactly as it was: the
           existing library is never cleared by a failed fetch. */
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (!aliveRef.current) return;
        setStatus('error');
      },
    );
  }, []);

  return {
    rows: groupByProvider(assets),
    assets,
    count: assets.length,
    status,
    loaded: status === 'success',
    load,
  };
}
