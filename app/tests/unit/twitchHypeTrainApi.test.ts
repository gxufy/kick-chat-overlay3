import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '@/pages/api/twitch/hype-train';

async function invoke(channel = 'streamer', method = 'GET') {
  let statusCode = 200;
  let body: unknown;
  const req = { method, query: { channel } } as unknown as NextApiRequest;
  const res = { setHeader: vi.fn(), status(code: number) { statusCode = code; return this; }, json(value: unknown) { body = value; return this; } } as unknown as NextApiResponse;
  await handler(req, res);
  return { statusCode, body };
}

afterEach(() => vi.unstubAllGlobals());

describe('Twitch Hype Train API', () => {
  it('normalizes an active public GraphQL snapshot', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: { user: { channel: { hypeTrain: { execution: { isActive: true, progress: { goal: 1000, progression: 400, level: { value: 3 } } } } } } } }) }) as Response));
    expect(await invoke()).toEqual({ statusCode: 200, body: { active: true, level: 3, progression: 400, goal: 1000 } });
  });
  it('returns confirmed inactive state', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: { user: { channel: { hypeTrain: { execution: { isActive: false } } } } } }) }) as Response));
    expect((await invoke('different_streamer')).body).toEqual({ active: false });
  });
  it('rejects invalid boundaries and keeps upstream failures opaque', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await invoke('bad/channel')).statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: {} }) }) as Response));
    expect(await invoke('third_streamer')).toEqual({ statusCode: 502, body: { error: 'Unable to load Twitch Hype Train.' } });
  });
});
