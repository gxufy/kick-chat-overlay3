import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetCommunityBadgeCache,
  resolveTwitchCommunityBadges,
} from '@/lib/communityBadges';

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 404,
    json: async () => body,
  } as Response;
}

describe('Twitch community badges', () => {
  beforeEach(() => {
    __resetCommunityBadgeCache();
    vi.restoreAllMocks();
  });

  it('stacks badges from independent providers and keeps the newest Bluzyrino match', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === 'https://api.chatterino.com/badges') {
        return jsonResponse({
          badges: [{
            tooltip: 'Chatterino Supporter',
            image3: 'https://cdn.example/chatterino.png',
            users: ['123'],
          }],
        });
      }

      if (url === 'https://api.moltorino.com/badges') {
        return jsonResponse({
          badges: [{
            id: 'supporter',
            tooltip: 'Moltorino Supporter',
            images: { '3x': 'https://cdn.example/moltorino.png' },
            users: [{ id: '123', username: 'TargetUser' }],
          }],
        });
      }

      if (url === 'https://bluzyrino-badge-registry.blu901-55.workers.dev/v1/badges') {
        return jsonResponse({
          bchat: {
            badges: [
              {
                id: 'old-supporter',
                tooltip: 'Old Bluzyrino',
                image_url_4x: 'https://cdn.example/blue-old.png',
                users: [{ id: '123', login: 'targetuser' }],
              },
              {
                id: 'new-supporter',
                tooltip: 'New Bluzyrino',
                image_url_4x: 'https://cdn.example/blue-new.png',
                users: [{ id: '123', login: 'targetuser' }],
              },
            ],
          },
        });
      }

      return jsonResponse({}, false);
    }));

    const badges = await resolveTwitchCommunityBadges('123', 'TargetUser');

    expect(badges).toEqual(expect.arrayContaining([
      {
        type: 'community:chatterino:chatterino-supporter',
        url: 'https://cdn.example/chatterino.png',
      },
      {
        type: 'community:moltorino:supporter',
        url: 'https://cdn.example/moltorino.png',
      },
      {
        type: 'community:bluzyrino:new-supporter',
        url: 'https://cdn.example/blue-new.png',
      },
    ]));
    expect(badges.some((badge) => badge.url === 'https://cdn.example/blue-old.png')).toBe(false);
  });

  it('falls back to a case-insensitive username mapping when a provider lacks Twitch ids', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === 'https://api.frankerfacez.com/v1/badges') {
        return jsonResponse({
          badges: [{ id: 7, title: 'FFZ Supporter', urls: { '4': 'https://cdn.example/ffz.png' } }],
          users: { '7': ['TargetUser'] },
        });
      }
      return jsonResponse({}, false);
    }));

    const badges = await resolveTwitchCommunityBadges('999', 'targetuser');
    expect(badges).toContainEqual({
      type: 'community:ffz:7',
      url: 'https://cdn.example/ffz.png',
    });
  });
});
