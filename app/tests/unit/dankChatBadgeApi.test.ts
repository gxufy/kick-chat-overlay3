import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from '@/pages/api/twitch/dankchat-badges';
import type { NextApiRequest, NextApiResponse } from 'next';

function invoke(method = 'GET') {
  let statusCode = 200;
  let body: unknown;
  const headers = new Map<string, string>();
  const req = { method, query: {} } as NextApiRequest;
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

describe('DankChat badge API boundary', () => {
  it('forwards only valid official DankChat badge assignments', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe('https://flxrs.com/api/badges');
      return {
        ok: true,
        json: async () => [
          { type: 'DankChat', url: 'https://cdn.example/dank.png', users: ['123', 456] },
          { type: 'bad', url: 'http://cdn.example/insecure.png', users: ['123'] },
          { type: '', url: 'https://cdn.example/no-title.png', users: ['123'] },
          { type: 'empty', url: 'https://cdn.example/no-users.png', users: [] },
        ],
      } as Response;
    }));

    const result = await invoke();
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual([
      { type: 'DankChat', url: 'https://cdn.example/dank.png', users: ['123', '456'] },
    ]);
    expect(result.headers.get('Cache-Control')).toContain('s-maxage=1800');
  });

  it('rejects non-GET methods without contacting the upstream API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await invoke('POST');
    expect(result.statusCode).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a generic 502 for malformed upstream payloads', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ badges: [] }) }) as Response));
    const result = await invoke();
    expect(result.statusCode).toBe(502);
    expect(result.body).toEqual({ error: 'Unable to load DankChat badges.' });
  });
});
