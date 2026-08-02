import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from '@/pages/api/twitch/badges';
import type { NextApiRequest, NextApiResponse } from 'next';

function invoke(query: Record<string, string | string[]> = {}, method = 'GET') {
  let statusCode = 200;
  let body: unknown;
  const headers = new Map<string, string>();
  const req = { method, query } as NextApiRequest;
  const res = {
    setHeader: (name: string, value: string) => headers.set(name, value),
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    },
  } as unknown as NextApiResponse;
  return handler(req, res).then(() => ({ statusCode, body, headers }));
}

afterEach(() => vi.unstubAllGlobals());

describe('Twitch badge API boundary', () => {
  it('merges channel art over global art and exposes room id only to preview callers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          badges: [
            { setID: 'subscriber', version: '1', imageURL: 'https://cdn.example/global.png' },
            { setID: 'moderator', version: '1', imageURL: 'https://cdn.example/mod.png' },
          ],
          user: {
            id: '42',
            broadcastBadges: [
              { setID: 'subscriber', version: '1', imageURL: 'https://cdn.example/channel.png' },
            ],
          },
        },
      }),
    }) as Response));

    const production = await invoke({ channel: 'streamer' });
    expect(production.statusCode).toBe(200);
    expect(production.body).toEqual({
      'subscriber/1': 'https://cdn.example/channel.png',
      'moderator/1': 'https://cdn.example/mod.png',
    });

    const preview = await invoke({ channel: 'streamer', preview: '1' });
    expect(preview.body).toEqual({
      badges: {
        'subscriber/1': 'https://cdn.example/channel.png',
        'moderator/1': 'https://cdn.example/mod.png',
      },
      roomId: '42',
    });
  });

  it('loads global badges without requiring a channel', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          badges: [{ setID: 'vip', version: '1', imageURL: 'https://cdn.example/vip.png' }],
        },
      }),
    }) as Response));
    const result = await invoke({ preview: '1' });
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({ badges: { 'vip/1': 'https://cdn.example/vip.png' }, roomId: null });
  });

  it('rejects methods and invalid channels before contacting Twitch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await invoke({}, 'POST')).statusCode).toBe(405);
    expect((await invoke({ channel: 'bad/channel' })).statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns one generic failure for malformed upstream envelopes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: { badges: 'bad' } }) }) as Response));
    const result = await invoke({ channel: 'streamer' });
    expect(result.statusCode).toBe(502);
    expect(result.body).toEqual({ error: 'Unable to load Twitch badges.' });
  });
});
