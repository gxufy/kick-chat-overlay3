/* The generated URLs, as literal strings.
 *
 * Every other URL test in this suite asserts an *identity*: that the page's URL
 * equals what the serializer produces. That is the right check for "the page has
 * no second implementation", and it is worth nothing against the failure this file
 * is for — the serializer itself changing shape. An identity test passes happily
 * while a parameter is renamed, reordered, or dropped, because both sides move
 * together, and the URLs that break are the ones already pasted into scene
 * collections nobody is going to edit.
 *
 * So these are the strings, written out. A diff here is not a failure to fix by
 * updating the expectation; it is notice that existing OBS sources are about to
 * change behaviour, and the expectation moves only once that is intended.
 *
 * Every string below was captured from the serializer rather than composed by
 * hand, including the parts that look like mistakes: the Counter emits its
 * channels in twitch, youtube, kick, tiktok order, `bgColor` and `fontColor` drop
 * the `#`, and an empty generator emits `kick=yourchannel` so the preview URL
 * stays valid. Those are the compatibility surface.
 */
import { describe, expect, it } from 'vitest';
import {
  buildMultichatQuery,
  safeParseMultichatConfig,
  type MultichatSerializableStyle,
} from '@/lib/multichatConfig';
import {
  buildViewerCounterQuery,
  parseViewerCounterConfig,
} from '@/lib/viewerCounterConfig';
import { buildOverlayUrl, overlayFragment } from '@/lib/tools/toolContext';
import { multichatTool } from '@/features/multichat/config';
import { counterTool } from '@/features/counter/config';

const BASE = 'https://multichat-gxufy.vercel.app';

const NO_CHANNELS = { kick: '', twitch: '', youtube: '', tiktok: '' };

/** A query string → the keys in the order they appear. */
function keys(query: string): string[] {
  return query.length ? query.split('&').map((p) => p.split('=')[0]) : [];
}

describe('MultiChat, complete strings', () => {
  const MC_DEFAULT_TAIL =
    '&sevenTVEmotesEnabled=true&sevenTVCosmeticsEnabled=true&textSize=medium' +
    '&font=opensans&textShadow=small&stroke=none&animation=slide&fade=30' +
    '&showPinEnabled=false&pinPlatforms=kick%2Cyoutube%2Ctiktok&hideNames=false';

  it('one Kick channel at every default', () => {
    expect(
      buildOverlayUrl({
        baseUrl: BASE,
        route: multichatTool.overlayRoute,
        query: buildMultichatQuery({ ...NO_CHANNELS, kick: 'somechannel' }, multichatTool.defaults),
      }),
    ).toBe(`${BASE}/multichat?kick=somechannel${MC_DEFAULT_TAIL}`);
  });

  it('the descriptor produces that same string through its own adapter', () => {
    /* The page calls the descriptor, not the raw serializer, so the adapter is
       part of the compatibility surface too. */
    expect(multichatTool.serialize({ kick: 'somechannel' } as never, multichatTool.defaults)).toBe(
      `kick=somechannel${MC_DEFAULT_TAIL}`.replace(/^&/, ''),
    );
  });

  it('all four channels, every control off its default', () => {
    const flipped: MultichatSerializableStyle = {
      ...multichatTool.defaults,
      sevenTVEmotesEnabled: false,
      sevenTVCosmeticsEnabled: false,
      textSize: 'large',
      font: 'roboto',
      textShadow: 'none',
      stroke: 'thick',
      animation: 'none',
      fade: '5',
      fadeEnabled: true,
      showPinEnabled: false,
      mentionColor: false,
      bgColor: '#112233',
      emoteScale: '1.5',
      msgBold: false,
      msgCaps: true,
      modAction: false,
      paintShadows: false,
      fontColor: '#ff0000',
      pinPlatforms: [],
      hideNames: true,
      botNames: 'nightbot, streamelements',
      userBL: 'someone',
      prefixBL: '!, ?',
      sourceTag: 'label',
    };
    expect(
      buildOverlayUrl({
        baseUrl: BASE,
        route: multichatTool.overlayRoute,
        query: buildMultichatQuery(
          { kick: 'kickname', twitch: 'twitchname', youtube: '@handle', tiktok: 'tiktokname' },
          flipped,
        ),
      }),
    ).toBe(
      `${BASE}/multichat?kick=kickname&twitch=twitchname&youtube=handle&tiktok=tiktokname` +
        '&sevenTVEmotesEnabled=false&sevenTVCosmeticsEnabled=false&textSize=large' +
        '&font=roboto&textShadow=none&stroke=thick&animation=none&fade=5' +
        '&showPinEnabled=false&sourceTag=label&mentionColor=false&bgColor=112233' +
        '&emoteScale=1.5&msgBold=false&msgCaps=true&modAction=false&paintShadows=false' +
        '&fontColor=ff0000&pinPlatforms=&hideNames=true' +
        '&botNames=nightbot%2C+streamelements&userBL=someone&prefixBL=%21%2C+%3F',
    );
  });

  it('omits fade entirely when the fade switch is off', () => {
    /* And omits pinPlatforms when all four are selected, because that is the
       overlay's own default and the shortest URL is the compatible one. */
    expect(
      buildMultichatQuery(
        { ...NO_CHANNELS, kick: 'k' },
        {
          ...multichatTool.defaults,
          fadeEnabled: false,
          pinPlatforms: ['kick', 'twitch', 'youtube', 'tiktok'],
        },
      ),
    ).toBe(
      'kick=k&sevenTVEmotesEnabled=true&sevenTVCosmeticsEnabled=true&textSize=medium' +
        '&font=opensans&textShadow=small&stroke=none&animation=slide' +
        '&showPinEnabled=false&hideNames=false',
    );
  });

  it('substitutes a placeholder channel when nothing is typed', () => {
    /* The preview URL has to stay parseable while the user is still typing, so
       an empty generator emits a placeholder rather than a channel-less URL. */
    expect(buildMultichatQuery(NO_CHANNELS, multichatTool.defaults)).toBe(
      `kick=yourchannel${MC_DEFAULT_TAIL}`.replace(/^&/, ''),
    );
  });

  it('carries a connection fragment strictly after the query', () => {
    /* The fragment is a live credential, which is why it is never a query
       parameter: query strings reach the server and its logs, fragments do not. */
    expect(
      buildOverlayUrl({
        baseUrl: BASE,
        route: multichatTool.overlayRoute,
        query: buildMultichatQuery({ ...NO_CHANNELS, twitch: 'twitchname' }, multichatTool.defaults),
        context: { fragment: 'conn=abc123' },
      }),
    ).toBe(`${BASE}/multichat?twitch=twitchname${MC_DEFAULT_TAIL}#conn=abc123`);
  });
});

describe('Counter, complete strings', () => {
  it('one Kick channel at every default', () => {
    expect(
      buildOverlayUrl({
        baseUrl: BASE,
        route: counterTool.overlayRoute,
        query: buildViewerCounterQuery({ kick: 'somechannel' }, counterTool.defaults),
      }),
    ).toBe(
      `${BASE}/counter?kick=somechannel&combined=true&icons=true&bg=true` +
        '&textShadow=small&stroke=none',
    );
  });

  it('all four channels with every control flipped', () => {
    expect(
      buildOverlayUrl({
        baseUrl: BASE,
        route: counterTool.overlayRoute,
        query: buildViewerCounterQuery(
          { kick: 'kickname', twitch: 'twitchname', youtube: 'handle', tiktok: 'tiktokname' },
          {
            ...counterTool.defaults,
            combined: false,
            icons: false,
            bg: false,
            textShadow: 'large',
            stroke: 'thin',
            align: 'right',
          },
        ),
      }),
    ).toBe(
      `${BASE}/counter?twitch=twitchname&youtube=handle&kick=kickname&tiktok=tiktokname` +
        '&combined=false&icons=false&bg=false&textShadow=large&stroke=thin&align=right',
    );
  });

  it('omits align while it is still the default', () => {
    expect(buildViewerCounterQuery({ kick: 'k' }, counterTool.defaults)).not.toContain('align');
  });

  it('never carries a connection fragment', () => {
    /* The Counter has no connection, so its URL must never gain a credential —
       and it is built from parts each time rather than appended to, so deriving
       the string twice cannot append twice. */
    const once = buildOverlayUrl({ baseUrl: BASE, route: counterTool.overlayRoute, query: 'kick=a' });
    expect(once).toBe(
      buildOverlayUrl({ baseUrl: BASE, route: counterTool.overlayRoute, query: 'kick=a' }),
    );
    expect(once).not.toContain('#');
  });
});

describe('nothing malformed can reach a URL', () => {
  it('a partial style serializes to defaults, never to "undefined"', () => {
    /* Observed in the wild as combined=undefined&icons=undefined&bg=undefined,
       which parses back as ON for each — so a user who switched Combined off and
       copied the URL got one that reads as on. */
    const query = buildViewerCounterQuery({ kick: 'k' }, {});
    expect(query).toBe('kick=k&combined=true&icons=true&bg=true&textShadow=small&stroke=none');
  });

  it('emits no undefined, null, or NaN in either tool', () => {
    for (const query of [
      buildMultichatQuery({ ...NO_CHANNELS, kick: 'somechannel' }, multichatTool.defaults),
      buildViewerCounterQuery({ kick: 'somechannel' }, counterTool.defaults),
      buildViewerCounterQuery({ kick: 'somechannel' }, {}),
    ]) {
      expect(query).not.toContain('undefined');
      expect(query).not.toContain('null');
      expect(query).not.toContain('NaN');
    }
  });

  it('every emitted pair has a key', () => {
    /* Values may legitimately be empty — pinPlatforms= is how "no pins" is
       encoded — but a keyless pair is always a bug. */
    for (const query of [
      buildMultichatQuery(
        { kick: 'a', twitch: 'b', youtube: 'c', tiktok: 'd' },
        { ...multichatTool.defaults, pinPlatforms: [] },
      ),
      buildViewerCounterQuery({ kick: 'a', twitch: 'b' }, counterTool.defaults),
    ]) {
      for (const key of keys(query)) expect(key.length, query).toBeGreaterThan(0);
      expect(query).not.toContain('&&');
      expect(query.startsWith('&')).toBe(false);
      expect(query.endsWith('&')).toBe(false);
    }
  });

  it('neither serializer emits a fragment or a leading question mark', () => {
    for (const query of [
      buildMultichatQuery({ ...NO_CHANNELS, kick: 'a' }, multichatTool.defaults),
      buildViewerCounterQuery({ kick: 'a' }, counterTool.defaults),
    ]) {
      expect(query).not.toContain('#');
      expect(query).not.toContain('?');
    }
  });

  it('leaves no bare or doubled # on any built URL', () => {
    for (const fragment of [undefined, '', '   ', '#', '##', '#conn=1', 'conn=1']) {
      const url = buildOverlayUrl({
        baseUrl: BASE,
        route: '/multichat',
        query: 'kick=a',
        context: fragment === undefined ? undefined : { fragment },
      });
      expect(url.endsWith('#'), String(fragment)).toBe(false);
      expect(url, String(fragment)).not.toContain('##');
      expect(url.split('#').length, String(fragment)).toBeLessThanOrEqual(2);
    }
    /* The two spellings converge, so a caller that includes the # and one that
       does not cannot produce two different OBS URLs. */
    expect(overlayFragment({ fragment: 'conn=1' })).toBe(overlayFragment({ fragment: '#conn=1' }));
  });
});

describe('what the overlay reads back', () => {
  it('a complete MultiChat string parses to the state that built it', () => {
    const style: MultichatSerializableStyle = {
      ...multichatTool.defaults,
      textSize: 'large',
      fade: '5',
      emoteScale: '1.5',
      sourceTag: 'dot',
      showPinEnabled: false,
    };
    const query = buildMultichatQuery(
      { ...NO_CHANNELS, kick: 'kickname', twitch: 'twitchname' },
      style,
    );
    const parsed = safeParseMultichatConfig(Object.fromEntries(new URLSearchParams(query)));
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.kick).toBe('kickname');
    expect(parsed.data.twitch).toBe('twitchname');
    expect(parsed.data.textSize).toBe('large');
    expect(parsed.data.fade).toBe(5);
    expect(parsed.data.emoteScale).toBe(1.5);
    expect(parsed.data.sourceTag).toBe('dot');
    expect(parsed.data.showPinEnabled).toBe(false);
  });

  it('a complete Counter string parses to the state that built it', () => {
    const style = {
      ...counterTool.defaults,
      combined: false,
      stroke: 'thin' as const,
      align: 'right' as const,
    };
    const query = buildViewerCounterQuery({ kick: 'kickname', tiktok: 'tiktokname' }, style);
    const parsed = parseViewerCounterConfig(Object.fromEntries(new URLSearchParams(query)));
    expect(parsed.channels.kick).toBe('kickname');
    expect(parsed.channels.tiktok).toBe('tiktokname');
    expect(parsed.style).toEqual(style);
  });

  it('every literal string above still parses', () => {
    /* A string can be stable and wrong. These are the same URLs asserted at the
       top of the file, run back through the overlay's own parser. */
    const urls = [
      buildMultichatQuery({ ...NO_CHANNELS, kick: 'somechannel' }, multichatTool.defaults),
      buildMultichatQuery(NO_CHANNELS, multichatTool.defaults),
      buildMultichatQuery(
        { ...NO_CHANNELS, kick: 'k' },
        { ...multichatTool.defaults, fadeEnabled: false, pinPlatforms: [] },
      ),
    ];
    for (const query of urls) {
      const parsed = safeParseMultichatConfig(Object.fromEntries(new URLSearchParams(query)));
      expect(parsed.success, query).toBe(true);
    }
  });

  it('parameter order is stable across repeated builds', () => {
    /* Not cosmetic: someone comparing a freshly generated URL against the one
       already in OBS needs the two comparable by eye. */
    const build = () =>
      buildMultichatQuery(
        { kick: 'a', twitch: 'b', youtube: 'c', tiktok: 'd' },
        multichatTool.defaults,
      );
    expect(build()).toBe(build());
    expect(keys(build()).slice(0, 4)).toEqual(['kick', 'twitch', 'youtube', 'tiktok']);
    expect(keys(buildViewerCounterQuery({ kick: 'a', twitch: 'b', youtube: 'c', tiktok: 'd' }, counterTool.defaults)).slice(0, 4)).toEqual(
      ['twitch', 'youtube', 'kick', 'tiktok'],
    );
  });
});
