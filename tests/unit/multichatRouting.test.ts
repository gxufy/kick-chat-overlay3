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
    });
  });

  it('forwards tab=counter to the counter workspace', () => {
    expect(resolveLegacyMultichatRoute({ tab: 'counter' })).toEqual({
      kind: 'redirect',
      pathname: '/tools/counter',
    });
  });

  it('forwards an unrecognized tab to the MultiChat workspace', () => {
    for (const tab of ['chat', 'COUNTER', 'counter ', '', 'other']) {
      expect(resolveLegacyMultichatRoute({ tab })).toEqual({
        kind: 'redirect',
        pathname: '/tools/multichat',
      });
    }
  });

  it('forwards an ambiguous repeated tab to the MultiChat workspace', () => {
    expect(resolveLegacyMultichatRoute({ tab: ['counter', 'chat'] })).toEqual({
      kind: 'redirect',
      pathname: '/tools/multichat',
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
