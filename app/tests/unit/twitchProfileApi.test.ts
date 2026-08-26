import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '@/pages/api/twitch/profile';
import { parseTwitchProfile } from '@/lib/twitchProfileClient';

async function invoke(id: string) {
  let statusCode = 200; let body: unknown;
  const req = { method: 'GET', query: { id } } as unknown as NextApiRequest;
  const res = { setHeader: vi.fn(), status(code: number) { statusCode = code; return this; }, json(value: unknown) { body = value; return this; } } as unknown as NextApiResponse;
  await handler(req, res); return { statusCode, body };
}
afterEach(() => vi.unstubAllGlobals());

describe('Twitch profile API and client validation', () => {
  it('returns only a matching canonical room profile', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: { user: { id: '200', displayName: 'Partner', profileImageURL: 'https://cdn.example/p.png' } } }) }) as Response));
    expect(await invoke('200')).toEqual({ statusCode: 200, body: { roomId: '200', displayName: 'Partner', profileImageUrl: 'https://cdn.example/p.png' } });
  });
  it('rejects invalid IDs, mismatches, and unsafe artwork', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    expect((await invoke('bad')).statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(parseTwitchProfile({ roomId: '201', displayName: 'Wrong' }, '200')).toBeNull();
    expect(parseTwitchProfile({ roomId: '200', displayName: 'Partner', profileImageUrl: 'http://bad/p.png' }, '200')).toBeNull();
  });
});
