import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';
import chattyHandler from '@/pages/api/twitch/chatty-badges';
import chatsenHandler from '@/pages/api/twitch/chatsen-badges';

function invoke(
  handler: (req: NextApiRequest, res: NextApiResponse) => unknown,
  method = 'GET',
) {
  let statusCode = 200;
  let body: unknown;
  const headers = new Map<string, string>();
  const req = { method, query: {} } as NextApiRequest;
  const res = {
    setHeader(name: string, value: string) { headers.set(name, value); },
    status(code: number) { statusCode = code; return this; },
    json(value: unknown) { body = value; return this; },
  } as unknown as NextApiResponse;
  return Promise.resolve(handler(req, res)).then(() => ({ statusCode, body, headers }));
}

afterEach(() => vi.unstubAllGlobals());

describe('community chat-client badge API boundaries', () => {
  it('normalizes Chatty supporter badges from the official tduva feed', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL) => {
      expect(String(url)).toBe('https://tduva.com/res/badges');
      return {
        ok: true,
        json: async () => [{
          id: 'supporter',
          version: '2',
          meta_title: 'Chatty Supporter',
          image_url: 'https://cdn.example/chatty.png',
          image_url_2: 'https://cdn.example/chatty-2x.png',
          color: '#123456',
          usernames: ['TargetUser'],
          userids: ['123'],
        }],
      } as Response;
    }));

    const result = await invoke(chattyHandler);
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual([{
      id: 'supporter-2',
      title: 'Chatty Supporter',
      url: 'https://cdn.example/chatty-2x.png',
      users: ['123'],
      usernames: ['TargetUser'],
      color: '#123456',
    }]);
  });

  it('normalizes Chatsen badges using the highest-resolution mipmap', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL) => {
      expect(String(url)).toBe('https://api.chatsen.app/account/badges');
      return {
        ok: true,
        json: async () => [{
          id: 'supporter',
          name: 'Chatsen Supporter',
          description: 'Thanks!',
          mipmap: [
            'https://cdn.example/chatsen-1x.png',
            'https://cdn.example/chatsen-2x.png',
            'https://cdn.example/chatsen-4x.png',
          ],
          users: ['123'],
        }],
      } as Response;
    }));

    const result = await invoke(chatsenHandler);
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual([{
      id: 'supporter',
      title: 'Chatsen Supporter',
      url: 'https://cdn.example/chatsen-4x.png',
      users: ['123'],
    }]);
  });

  it('rejects non-GET methods without contacting upstream services', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await invoke(chattyHandler, 'POST')).statusCode).toBe(405);
    expect((await invoke(chatsenHandler, 'POST')).statusCode).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
