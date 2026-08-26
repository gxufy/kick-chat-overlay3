import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCosmeticsFetcher } from '@/lib/cosmetics';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('7TV cosmetics lookup caching', () => {
  it('negative-caches a successful lookup for a chatter with no cosmetics', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { u0: { style: { paint: null, badge: null } } } }),
    }) as Response);
    vi.stubGlobal('fetch', fetchMock);

    const stores = { paints: [], badges: [], entitlements: {} };
    const fetcher = createCosmeticsFetcher(stores, vi.fn());

    fetcher.want('twitch', '123');
    await vi.advanceTimersByTimeAsync(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetcher.want('twitch', '123');
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetcher.stop();
  });

  it('still permits a retry after an actual request failure', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { u0: { style: { paint: null, badge: null } } } }),
      } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const stores = { paints: [], badges: [], entitlements: {} };
    const fetcher = createCosmeticsFetcher(stores, vi.fn());

    fetcher.want('twitch', '456');
    await vi.advanceTimersByTimeAsync(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetcher.want('twitch', '456');
    await vi.advanceTimersByTimeAsync(500);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetcher.stop();
  });
});
