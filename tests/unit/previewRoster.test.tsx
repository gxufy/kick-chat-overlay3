import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTwitchPreviewRoster } from '@/components/classic/useTwitchPreviewRoster';
import { __resetPreviewIdentityClient } from '@/features/multichat/previewIdentityClient';
import {
  PREVIEW_MESSAGES,
  PREVIEW_PLATFORM_SEQUENCE,
  PREVIEW_ROSTER,
  PREVIEW_ROSTER_CONCURRENCY,
  curatedBadges,
} from '@/features/multichat/previewRoster';
import type { PreviewIdentityResponse } from '@/features/multichat/previewIdentity';

const responseFor = (login: string): PreviewIdentityResponse => ({
  identity: { userId: String(100 + PREVIEW_ROSTER.findIndex((entry) => entry.login === login)), login, displayName: 'ProviderCase' },
  providers: {
    Twitch: { status: 'loaded', resources: { globalBadges: {
      'moderator/1': `https://cdn.example/${login}-global-mod.png`,
      'subscriber/1': `https://cdn.example/${login}-sub.png`,
      'bits/100': `https://cdn.example/${login}-bits.png`,
    }, channelBadges: { 'moderator/1': `https://cdn.example/${login}-channel-mod.png` } } },
    FFZ: { status: 'loaded', resources: {
      globalEmotes: [], roomEmotes: [], badgeOverrides: { 'moderator/1': `https://cdn.example/${login}-ffz-mod.png` },
      ownedBadges: [{ id: 'ffz-owner', image: `https://cdn.example/${login}-ffz-owner.png` }],
    } },
    BTTV: { status: 'loaded', resources: {
      globalEmotes: [], channelEmotes: [], sharedEmotes: [],
      ownedBadges: [{ id: 'bttv-owner', image: `https://cdn.example/${login}-bttv-owner.png` }],
    } },
    '7TV': { status: 'loaded', resources: { globalEmotes: [], channelEmotes: [], personalEmotes: [], paint: null, badge: null } },
  },
});

const jsonResponse = (body: unknown) => ({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);

beforeEach(() => __resetPreviewIdentityClient());
afterEach(() => vi.unstubAllGlobals());

describe('curated Preview Identity roster', () => {
  it('preserves the exact requested order, casing, and approved message pool', () => {
    expect(PREVIEW_ROSTER.map((entry) => entry.displayName)).toEqual([
      'gxufy', 'feelssunnyman', 'uniiDev', 'Xslash58', 'wyydogg', 'JAYKAYRAH', 'slaiqe',
    ]);
    expect(PREVIEW_ROSTER.map((entry) => entry.login)).toEqual([
      'gxufy', 'feelssunnyman', 'uniidev', 'xslash58', 'wyydogg', 'jaykayrah', 'slaiqe',
    ]);
    expect(PREVIEW_MESSAGES).toEqual([
      'Alright',
      '!vanish peepoVanish',
      'Thats a real jammer ShoulderDance RaveTime',
      'aga life is like a box of chocolate, you never know when im gonna eat them all catEat',
      'Pog chat overlay with better zero width emotes catJAM WideRaveTime ALERT',
      '@uniiDev yugi61',
      'gżegżółka bah',
      "I'm thinking Miku, Miku Ooh-ee-ooh",
    ]);
  });

  it('shows seven deterministic fallbacks and varied logos before requests settle', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)));
    const { result, unmount } = renderHook(() => useTwitchPreviewRoster());
    expect(result.current.templates.map((template) => template.username)).toEqual(PREVIEW_ROSTER.map((entry) => entry.displayName));
    expect(result.current.templates.map((template) => template.text)).toEqual(PREVIEW_MESSAGES.slice(0, 7));
    expect(result.current.templates.map((template) => template.displayPlatform)).toEqual(PREVIEW_PLATFORM_SEQUENCE.slice(0, 7));
    expect(result.current.templates.every((template) => template.platform === 'twitch')).toBe(true);
    const logos = result.current.templates.map((template) => template.displayPlatform);
    expect(logos.every((logo, index) => index === 0 || logo !== logos[index - 1])).toBe(true);
    unmount();
  });

  it('composes multiple badges with channel and FFZ replacement, stable order, and ownership coexistence', () => {
    const response = responseFor('gxufy');
    const badges = curatedBadges(PREVIEW_ROSTER[0], response, 0);
    expect(badges.length).toBeGreaterThan(3);
    expect(badges.find((badge) => badge.type === 'moderator')?.url).toBe('https://cdn.example/gxufy-ffz-mod.png');
    expect(badges.some((badge) => badge.type === 'bttv-owner')).toBe(true);
    expect(badges.some((badge) => badge.type === 'ffz-owner')).toBe(true);
    expect(curatedBadges(PREVIEW_ROSTER[0], response, 0)).toEqual(badges);
    expect(new Set(badges.map((badge) => badge.url)).size).toBe(badges.length);
  });

  it('bounds concurrency and continues after an independent failure', async () => {
    let active = 0;
    let peak = 0;
    const resolvers = new Map<string, { resolve: (response: Response) => void; reject: (error: Error) => void }>();
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const login = new URL(String(input), 'http://local').searchParams.get('login')!;
      active += 1;
      peak = Math.max(peak, active);
      return new Promise<Response>((resolve, reject) => resolvers.set(login, {
        resolve: (value) => { active -= 1; resolve(value); },
        reject: (error) => { active -= 1; reject(error); },
      }));
    }));
    const { result } = renderHook(() => useTwitchPreviewRoster());
    await waitFor(() => expect(resolvers.size).toBe(PREVIEW_ROSTER_CONCURRENCY));
    expect(peak).toBe(PREVIEW_ROSTER_CONCURRENCY);
    await act(async () => resolvers.get('feelssunnyman')!.reject(new Error('offline')));
    await waitFor(() => expect(resolvers.has('xslash58')).toBe(true));
    await act(async () => resolvers.get('gxufy')!.resolve(jsonResponse(responseFor('gxufy'))));
    await waitFor(() => expect(result.current.responses.has('gxufy')).toBe(true));
    expect(result.current.templates[0]!.username).toBe('gxufy');
    expect(peak).toBe(PREVIEW_ROSTER_CONCURRENCY);
  });

  it('reuses cached identities, advances messages/logos, and resets the initial page', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const login = new URL(String(input), 'http://local').searchParams.get('login')!;
      return Promise.resolve(jsonResponse(responseFor(login)));
    });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useTwitchPreviewRoster());
    await waitFor(() => expect(result.current.responses.size).toBe(PREVIEW_ROSTER.length));
    expect(fetchMock).toHaveBeenCalledTimes(PREVIEW_ROSTER.length);
    const before = result.current.templates.map((template) => `${template.text}|${template.displayPlatform}`);
    act(() => result.current.loadMore());
    expect(result.current.page).toBe(1);
    expect(result.current.templates.map((template) => `${template.text}|${template.displayPlatform}`)).not.toEqual(before);
    act(() => result.current.reset());
    expect(result.current.page).toBe(0);
    expect(result.current.templates.map((template) => template.text)).toEqual(PREVIEW_MESSAGES.slice(0, 7));
    expect(fetchMock).toHaveBeenCalledTimes(PREVIEW_ROSTER.length);
  });
});
