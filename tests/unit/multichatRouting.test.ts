/* Legacy /multichat routing — the overlay-compatibility boundary.
 *
 * The property under test is one-directional and permanent: any query naming a
 * channel must resolve to the overlay, whatever else it carries. Every OBS scene
 * in existence points at this path, so a redirect that captured one of those
 * URLs would black out a live stream. The redirect cases matter too, but they
 * are recoverable; the overlay cases are not.
 */
import { describe, expect, it } from 'vitest';
import {
  CANONICAL_COUNTER_ROUTE,
  CANONICAL_MULTICHAT_ROUTE,
  MULTICHAT_CHANNEL_PARAMS,
  hasChannelParam,
  legacyRedirectTarget,
  resolveLegacyMultichatRoute,
} from '@/lib/multichatRouting';

describe('canonical routes', () => {
  it('names the workspace routes', () => {
    expect(CANONICAL_MULTICHAT_ROUTE).toBe('/tools/multichat');
    expect(CANONICAL_COUNTER_ROUTE).toBe('/tools/counter');
  });

  it('covers every channel parameter the overlay parser accepts', () => {
    expect(MULTICHAT_CHANNEL_PARAMS).toEqual([
      'channel',
      'kick',
      'twitch',
      'youtube',
      'tiktok',
    ]);
  });
});

describe('overlay requests', () => {
  it.each(MULTICHAT_CHANNEL_PARAMS)('serves the overlay for ?%s=', (param) => {
    expect(resolveLegacyMultichatRoute({ [param]: 'somechannel' })).toEqual({
      kind: 'overlay',
    });
  });

  it('serves the overlay for a full multi-platform URL', () => {
    expect(
      resolveLegacyMultichatRoute({
        kick: 'a',
        twitch: 'b',
        youtube: 'c',
        tiktok: 'd',
        fade: '30',
      }).kind,
    ).toBe('overlay');
  });

  /* The case that makes the ordering load-bearing. */
  it('serves the overlay even when tab=counter is also present', () => {
    expect(resolveLegacyMultichatRoute({ kick: 'a', tab: 'counter' }).kind).toBe(
      'overlay',
    );
  });

  it('serves the overlay for a repeated parameter with one real value', () => {
    expect(resolveLegacyMultichatRoute({ kick: ['', 'real'] }).kind).toBe('overlay');
  });

  it('keeps serving the overlay regardless of unrelated settings', () => {
    expect(
      resolveLegacyMultichatRoute({
        twitch: 'a',
        sourceTag: 'text',
        pinPlatforms: 'twitch',
        theme: 'dark',
      }).kind,
    ).toBe('overlay');
  });
});

describe('generator requests', () => {
  it('forwards a bare visit to the MultiChat workspace', () => {
    expect(resolveLegacyMultichatRoute({})).toEqual({
      kind: 'redirect',
      pathname: '/tools/multichat',
      hash: '',
    });
  });

  it('forwards tab=counter to the counter workspace', () => {
    expect(resolveLegacyMultichatRoute({ tab: 'counter' })).toEqual({
      kind: 'redirect',
      pathname: '/tools/counter',
      hash: '',
    });
  });

  it('forwards an unrecognized tab to the MultiChat workspace', () => {
    for (const tab of ['chat', 'COUNTER', 'counter ', '', 'other']) {
      expect(resolveLegacyMultichatRoute({ tab })).toEqual({
        kind: 'redirect',
        pathname: '/tools/multichat',
        hash: '',
      });
    }
  });

  it('forwards an ambiguous repeated tab to the MultiChat workspace', () => {
    expect(resolveLegacyMultichatRoute({ tab: ['counter', 'chat'] })).toEqual({
      kind: 'redirect',
      pathname: '/tools/multichat',
      hash: '',
    });
  });

  /* An unfilled generator field submits `?kick=`. That is not a channel, so it
     must not be mistaken for an overlay request and left on a dead page. */
  it.each(MULTICHAT_CHANNEL_PARAMS)('treats an empty ?%s= as a generator visit', (param) => {
    expect(resolveLegacyMultichatRoute({ [param]: '' }).kind).toBe('redirect');
    expect(resolveLegacyMultichatRoute({ [param]: '   ' }).kind).toBe('redirect');
  });

  it('treats a repeated all-empty parameter as a generator visit', () => {
    expect(resolveLegacyMultichatRoute({ kick: ['', ''] }).kind).toBe('redirect');
  });

  it('never returns a destination outside the canonical routes', () => {
    const queries = [
      {},
      { tab: 'counter' },
      { tab: 'nonsense' },
      { kick: '' },
      { sourceTag: 'icon' },
    ];
    for (const query of queries) {
      const route = resolveLegacyMultichatRoute(query);
      if (route.kind !== 'redirect') continue;
      expect([CANONICAL_MULTICHAT_ROUTE, CANONICAL_COUNTER_ROUTE]).toContain(
        route.pathname,
      );
    }
  });
});

/* The compatibility path for an authorization that began before the callback
   destination moved. Dropping the fragment here forces the user to authorize
   again, so these are about not losing something they already earned. */
describe('OAuth fragment preservation', () => {
  const ID = '123e4567-e89b-12d3-a456-426614174000';
  const VALID = `#twitchConnectionId=${ID}&twitch=someone`;

  it('forwards a valid fragment to the MultiChat workspace', () => {
    expect(resolveLegacyMultichatRoute({}, VALID)).toEqual({
      kind: 'redirect',
      pathname: '/tools/multichat',
      hash: `#twitchConnectionId=${ID}&twitch=someone`,
    });
  });

  it('outranks tab=counter, because a pending connection is stronger intent', () => {
    expect(resolveLegacyMultichatRoute({ tab: 'counter' }, VALID)).toEqual({
      kind: 'redirect',
      pathname: '/tools/multichat',
      hash: `#twitchConnectionId=${ID}&twitch=someone`,
    });
  });

  it('never outranks a configured channel', () => {
    for (const param of MULTICHAT_CHANNEL_PARAMS) {
      expect(resolveLegacyMultichatRoute({ [param]: 'somechannel' }, VALID).kind).toBe(
        'overlay',
      );
    }
  });

  it('normalizes the login it forwards', () => {
    const route = resolveLegacyMultichatRoute(
      {},
      `#twitchConnectionId=${ID}&twitch=%40SomeOne`,
    );
    expect(route.kind === 'redirect' && route.hash).toBe(
      `#twitchConnectionId=${ID}&twitch=someone`,
    );
  });

  /* Each of these is dropped rather than forwarded. A fragment that cannot be
     adopted is worse than none: it would sit in the workspace address bar
     looking like a connection while gating pins on an account that never
     matched. */
  it.each([
    ['a malformed uuid', '#twitchConnectionId=not-a-uuid&twitch=someone'],
    ['a uuid missing a block', '#twitchConnectionId=123e4567-e89b-12d3&twitch=someone'],
    ['an invalid login', `#twitchConnectionId=${ID}&twitch=has spaces`],
    ['an empty login', `#twitchConnectionId=${ID}&twitch=`],
    ['a missing login', `#twitchConnectionId=${ID}`],
    ['a missing id', '#twitch=someone'],
    ['a duplicated id', `#twitchConnectionId=${ID}&twitchConnectionId=${ID}&twitch=someone`],
    ['a duplicated login', `#twitchConnectionId=${ID}&twitch=someone&twitch=other`],
    ['an unrelated fragment', '#section=faq'],
    ['an empty fragment', '#'],
    ['no fragment', ''],
  ])('drops %s', (_label, hash) => {
    expect(resolveLegacyMultichatRoute({}, hash)).toEqual({
      kind: 'redirect',
      pathname: '/tools/multichat',
      hash: '',
    });
  });

  it('still honours tab=counter once a bad fragment is dropped', () => {
    expect(resolveLegacyMultichatRoute({ tab: 'counter' }, '#section=faq')).toEqual({
      kind: 'redirect',
      pathname: '/tools/counter',
      hash: '',
    });
  });

  /* Rebuilt from the two validated fields, so anything else in the incoming
     fragment is gone by construction rather than by a filter. */
  it('carries only the two recognized fields', () => {
    const route = resolveLegacyMultichatRoute(
      {},
      `#twitchConnectionId=${ID}&twitch=someone&returnTo=%2Fevil&admin=1`,
    );
    expect(route.kind === 'redirect' && route.hash).toBe(
      `#twitchConnectionId=${ID}&twitch=someone`,
    );
  });

  it('never turns the fragment into a query string', () => {
    const route = resolveLegacyMultichatRoute({}, VALID);
    expect(route.kind === 'redirect' && route.pathname).toBe('/tools/multichat');
    expect(route.kind === 'redirect' && route.pathname).not.toContain('?');
    expect(route.kind === 'redirect' && route.pathname).not.toContain(ID);
  });
});

/* The helper must stay usable during server rendering, where there is no window.
   It takes the hash as an argument for exactly this reason — a version that read
   window.location itself would throw on the server pass. */
describe('server-side safety', () => {
  const ID = '123e4567-e89b-12d3-a456-426614174000';

  it('resolves every route with window removed', () => {
    const original = globalThis.window;
    // @ts-expect-error deleting the global is the whole point of the test
    delete globalThis.window;
    try {
      expect(resolveLegacyMultichatRoute({ kick: 'a' }).kind).toBe('overlay');
      expect(legacyRedirectTarget(resolveLegacyMultichatRoute({}))).toBe(
        '/tools/multichat',
      );
      expect(
        legacyRedirectTarget(resolveLegacyMultichatRoute({ tab: 'counter' })),
      ).toBe('/tools/counter');
      expect(
        legacyRedirectTarget(
          resolveLegacyMultichatRoute({}, `#twitchConnectionId=${ID}&twitch=someone`),
        ),
      ).toBe(`/tools/multichat#twitchConnectionId=${ID}&twitch=someone`);
    } finally {
      globalThis.window = original;
    }
  });
});

describe('legacyRedirectTarget', () => {
  const ID = '123e4567-e89b-12d3-a456-426614174000';

  it('is empty for an overlay route', () => {
    expect(legacyRedirectTarget({ kind: 'overlay' })).toBe('');
  });

  it('joins the pathname and fragment', () => {
    expect(
      legacyRedirectTarget(
        resolveLegacyMultichatRoute({}, `#twitchConnectionId=${ID}&twitch=someone`),
      ),
    ).toBe(`/tools/multichat#twitchConnectionId=${ID}&twitch=someone`);
  });

  it('is the bare pathname when there is nothing to preserve', () => {
    expect(legacyRedirectTarget(resolveLegacyMultichatRoute({}))).toBe(
      '/tools/multichat',
    );
    expect(legacyRedirectTarget(resolveLegacyMultichatRoute({ tab: 'counter' }))).toBe(
      '/tools/counter',
    );
  });
});

describe('hasChannelParam', () => {
  it('is true only for a non-empty channel value', () => {
    expect(hasChannelParam({ kick: 'a' })).toBe(true);
    expect(hasChannelParam({ kick: '' })).toBe(false);
    expect(hasChannelParam({})).toBe(false);
    expect(hasChannelParam({ tab: 'counter' })).toBe(false);
  });

  it('ignores parameters that do not name a channel', () => {
    expect(hasChannelParam({ fade: '30', theme: 'dark', chan: 'x' })).toBe(false);
  });
});
