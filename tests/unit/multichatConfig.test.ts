/* MultiChat config extraction — compatibility lock.
 *
 * Every expected value in this file was captured from the pre-extraction
 * implementation at commit 3e111a3 (the zod schema in pages/multichat.tsx and
 * the URLSearchParams assembly in components/LandingPage.tsx) using a
 * throwaway read-only harness, then embedded here as literals. None of it is
 * derived from lib/multichatConfig.ts, so these tests can actually fail if the
 * extraction changed behaviour.
 *
 * The serialized-URL assertions compare complete strings, not parsed
 * URLSearchParams, because parameter order and percent-encoding are part of
 * the compatibility surface.
 */
import { describe, expect, it } from 'vitest';
import {
  MULTICHAT_GENERATOR_DEFAULTS,
  MULTICHAT_GENERATOR_DEFAULT_CHANNELS,
  MULTICHAT_OVERLAY_DEFAULTS,
  MULTICHAT_UNREAD_PARAMS,
  buildMultichatQuery,
  hasConfiguredMultichatChannel,
  multichatKickChannel,
  multichatPlatformCount,
  safeParseMultichatConfig,
  type MultichatGeneratorStyle,
} from '@/lib/multichatConfig';

/** Parse helper that asserts success and returns the data. */
function parse(query: Record<string, string | string[]>) {
  const result = safeParseMultichatConfig(query);
  expect(result.success).toBe(true);
  if (!result.success) throw new Error('unreachable');
  return result.data;
}

/** Serialize the generator defaults with the given overrides applied. */
function build(
  over: Partial<MultichatGeneratorStyle> = {},
  channels: Partial<typeof MULTICHAT_GENERATOR_DEFAULT_CHANNELS> = {},
): string {
  return buildMultichatQuery(
    { ...MULTICHAT_GENERATOR_DEFAULT_CHANNELS, ...channels },
    { ...MULTICHAT_GENERATOR_DEFAULTS, ...over },
  );
}

/* ------------------------------------------------------------------ */
/* 6 + 7. The two defaults, which must stay different                  */
/* ------------------------------------------------------------------ */

describe('overlay parse defaults (captured from HEAD)', () => {
  it('an empty query resolves to exactly the HEAD defaults', () => {
    expect(parse({})).toEqual({
      channel: undefined,
      kick: undefined,
      twitch: undefined,
      youtube: undefined,
      tiktok: undefined,
      sevenTVCosmeticsEnabled: true,
      sevenTVEmotesEnabled: true,
      textShadow: 'large',
      textSize: 'medium',
      animation: 'slide',
      showPinEnabled: false,
      showSystemMsgs: true,
      mentionColor: true,
      bgColor: '',
      showRedeems: true,
      sourceTag: 'icon',
      showAvatars: false,
      font: 'opensans',
      stroke: 'none',
      emoteScale: 1,
      fade: false,
      msgBold: true,
      msgCaps: false,
      fontColor: '',
      paintShadows: true,
      modAction: true,
      userBL: '',
      prefixBL: '',
      pinPlatforms: ['kick', 'twitch', 'youtube', 'tiktok'],
      hideNames: false,
      botNames: '',
      ttsEnabled: true,
    });
  });

  it('a bare overlay URL keeps resolving textShadow to large', () => {
    expect(parse({ kick: 'someone' }).textShadow).toBe('large');
    expect(MULTICHAT_OVERLAY_DEFAULTS.textShadow).toBe('large');
  });
});

describe('generator defaults (captured from HEAD useState)', () => {
  it('the generator still begins at textShadow small', () => {
    expect(MULTICHAT_GENERATOR_DEFAULTS.textShadow).toBe('small');
  });

  it('the two default sets are deliberately distinct, not reconciled', () => {
    expect(MULTICHAT_GENERATOR_DEFAULTS.textShadow).not.toBe(
      MULTICHAT_OVERLAY_DEFAULTS.textShadow,
    );
  });

  it('every other generator default matches HEAD initial state', () => {
    expect(MULTICHAT_GENERATOR_DEFAULTS).toEqual({
      sevenTVEmotesEnabled: true,
      sevenTVCosmeticsEnabled: true,
      textSize: 'medium',
      font: 'opensans',
      textShadow: 'small',
      stroke: 'none',
      animation: 'slide',
      fade: '30',
      fadeEnabled: true,
      showPinEnabled: true,
      platformIcons: true,
      mentionColor: true,
      bgColor: '',
      emoteScale: '',
      msgBold: true,
      msgCaps: false,
      modAction: true,
      paintShadows: true,
      fontColor: '',
      pinPlatforms: ['kick', 'youtube', 'tiktok'],
      hideNames: false,
      botNames: '',
      userBL: '',
      prefixBL: '',
    });
    expect(MULTICHAT_GENERATOR_DEFAULT_CHANNELS).toEqual({
      kick: '', twitch: '', youtube: '', tiktok: '',
    });
  });

  it('the generator always writes textShadow, so it never inherits large', () => {
    expect(build({}, { kick: 'a' })).toContain('textShadow=small');
  });
});

/* ------------------------------------------------------------------ */
/* 2. Numeric alias tables, complete                                   */
/* ------------------------------------------------------------------ */

describe('legacy numeric aliases', () => {
  const cases: [string, [string, string][]][] = [
    ['textSize', [['1', 'small'], ['2', 'medium'], ['3', 'large']]],
    ['textShadow', [['1', 'none'], ['2', 'small'], ['3', 'medium'], ['4', 'large']]],
    ['animation', [['1', 'none'], ['2', 'slide'], ['3', 'fade']]],
    ['stroke', [
      ['1', 'none'], ['2', 'thin'], ['3', 'medium'], ['4', 'thick'], ['5', 'thicker'],
    ]],
    ['font', [
      ['1', 'baloo'], ['2', 'segoe'], ['3', 'roboto'], ['4', 'lato'],
      ['5', 'noto'], ['6', 'sourcecode'], ['7', 'impact'], ['8', 'comfortaa'],
      ['9', 'dancing'], ['10', 'indieflower'], ['11', 'opensans'], ['12', 'alsina'],
    ]],
  ];

  for (const [param, table] of cases) {
    for (const [alias, expected] of table) {
      it(`${param}=${alias} → ${expected}`, () => {
        const cfg = parse({ kick: 'a', [param]: alias }) as Record<string, unknown>;
        expect(cfg[param]).toBe(expected);
      });
    }
  }

  it('canonical values pass through unchanged', () => {
    expect(parse({ kick: 'a', textSize: 'large' }).textSize).toBe('large');
    expect(parse({ kick: 'a', textShadow: 'none' }).textShadow).toBe('none');
    expect(parse({ kick: 'a', animation: 'fade' }).animation).toBe('fade');
    expect(parse({ kick: 'a', stroke: 'thin' }).stroke).toBe('thin');
    expect(parse({ kick: 'a', font: 'impact' }).font).toBe('impact');
  });

  it('malformed enums fall back to the HEAD default', () => {
    expect(parse({ kick: 'a', textSize: 'gigantic' }).textSize).toBe('medium');
    expect(parse({ kick: 'a', textSize: '0' }).textSize).toBe('medium');
    expect(parse({ kick: 'a', textShadow: 'huge' }).textShadow).toBe('large');
    expect(parse({ kick: 'a', animation: 'zoom' }).animation).toBe('slide');
    expect(parse({ kick: 'a', stroke: 'huge' }).stroke).toBe('none');
    expect(parse({ kick: 'a', sourceTag: 'badge' }).sourceTag).toBe('icon');
  });

  it('font is the one enum that passes unknown values straight through', () => {
    /* HEAD quirk, preserved: font has no membership check, so an unmapped
       value is returned verbatim rather than defaulted. */
    expect(parse({ kick: 'a', font: '13' }).font).toBe('13');
    expect(parse({ kick: 'a', font: 'comicsans' }).font).toBe('comicsans');
  });

  it('sourceTag accepts all four canonical modes', () => {
    for (const mode of ['none', 'dot', 'label', 'icon'] as const) {
      expect(parse({ kick: 'a', sourceTag: mode }).sourceTag).toBe(mode);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 11. Number transforms and malformed input                           */
/* ------------------------------------------------------------------ */

describe('fade (parseInt semantics, preserved)', () => {
  const cases: [string | undefined, number | false][] = [
    [undefined, false],
    ['30', 30],
    ['0', 0],
    ['-5', -5],
    ['abc', false],
    ['', false],
    ['12.9', 12],
    ['10s', 10],
  ];

  for (const [input, expected] of cases) {
    it(`${input === undefined ? 'absent' : `"${input}"`} → ${expected}`, () => {
      const query: Record<string, string> = { kick: 'a' };
      if (input !== undefined) query.fade = input;
      expect(parse(query).fade).toBe(expected);
    });
  }
});

describe('emoteScale (parseFloat semantics, preserved)', () => {
  const cases: [string | undefined, number][] = [
    [undefined, 1],
    ['1.5', 1.5],
    ['big', 1],
    ['', 1],
    ['0', 0],
    ['-2', -2],
  ];

  for (const [input, expected] of cases) {
    it(`${input === undefined ? 'absent' : `"${input}"`} → ${expected}`, () => {
      const query: Record<string, string> = { kick: 'a' };
      if (input !== undefined) query.emoteScale = input;
      expect(parse(query).emoteScale).toBe(expected);
    });
  }
});

describe('colour parsing', () => {
  it('accepts a bare six-digit hex and prefixes it', () => {
    expect(parse({ kick: 'a', bgColor: '191919' }).bgColor).toBe('#191919');
    expect(parse({ kick: 'a', fontColor: 'FFAA00' }).fontColor).toBe('#FFAA00');
  });

  it('rejects an already-hashed value, a short value, and a name', () => {
    /* HEAD quirk, preserved: '#191919' fails the bare-hex test, so a hashed
       input parses to '' — the generator strips the '#' before emitting. */
    expect(parse({ kick: 'a', bgColor: '#191919' }).bgColor).toBe('');
    expect(parse({ kick: 'a', bgColor: '191' }).bgColor).toBe('');
    expect(parse({ kick: 'a', bgColor: 'red' }).bgColor).toBe('');
    expect(parse({ kick: 'a', fontColor: 'nope' }).fontColor).toBe('');
  });
});

describe('boolean coercion', () => {
  it('default-on flags need exactly "false" to turn off', () => {
    const on = parse({ kick: 'a', msgBold: 'FALSE', ttsEnabled: '0' });
    expect(on.msgBold).toBe(true);
    expect(on.ttsEnabled).toBe(true);

    const off = parse({
      kick: 'a', msgBold: 'false', ttsEnabled: 'false',
      sevenTVEmotesEnabled: 'false', sevenTVCosmeticsEnabled: 'false',
      showSystemMsgs: 'false', mentionColor: 'false', showRedeems: 'false',
      paintShadows: 'false', modAction: 'false',
    });
    expect(off).toMatchObject({
      msgBold: false, ttsEnabled: false, sevenTVEmotesEnabled: false,
      sevenTVCosmeticsEnabled: false, showSystemMsgs: false,
      mentionColor: false, showRedeems: false, paintShadows: false,
      modAction: false,
    });
  });

  it('default-off flags need exactly "true" to turn on', () => {
    const junk = parse({
      kick: 'a', showPinEnabled: 'yes', showAvatars: '1',
      msgCaps: 'TRUE', hideNames: 'on',
    });
    expect(junk).toMatchObject({
      showPinEnabled: false, showAvatars: false, msgCaps: false, hideNames: false,
    });

    const on = parse({
      kick: 'a', showPinEnabled: 'true', showAvatars: 'true',
      msgCaps: 'true', hideNames: 'true',
    });
    expect(on).toMatchObject({
      showPinEnabled: true, showAvatars: true, msgCaps: true, hideNames: true,
    });
  });
});

/* ------------------------------------------------------------------ */
/* 5. pinPlatforms — absent, empty, and partial stay distinct          */
/* ------------------------------------------------------------------ */

describe('pinPlatforms', () => {
  const ALL = ['kick', 'twitch', 'youtube', 'tiktok'];

  it('absent means all four', () => {
    expect(parse({ kick: 'a' }).pinPlatforms).toEqual(ALL);
  });

  it('empty string means none', () => {
    expect(parse({ kick: 'a', pinPlatforms: '' }).pinPlatforms).toEqual([]);
  });

  it('a partial list means exactly that list, in given order', () => {
    expect(parse({ kick: 'a', pinPlatforms: 'kick,youtube' }).pinPlatforms)
      .toEqual(['kick', 'youtube']);
    expect(parse({ kick: 'a', pinPlatforms: 'twitch' }).pinPlatforms)
      .toEqual(['twitch']);
  });

  it('the three states are mutually distinguishable', () => {
    const absent = parse({ kick: 'a' }).pinPlatforms;
    const empty = parse({ kick: 'a', pinPlatforms: '' }).pinPlatforms;
    const partial = parse({ kick: 'a', pinPlatforms: 'kick' }).pinPlatforms;
    expect(absent).not.toEqual(empty);
    expect(absent).not.toEqual(partial);
    expect(empty).not.toEqual(partial);
  });

  it('duplicates collapse and order of first appearance is kept', () => {
    expect(parse({ kick: 'a', pinPlatforms: 'kick,kick,twitch' }).pinPlatforms)
      .toEqual(['kick', 'twitch']);
  });

  it('unknown names are dropped', () => {
    expect(parse({ kick: 'a', pinPlatforms: 'kick,discord' }).pinPlatforms)
      .toEqual(['kick']);
  });

  it('an all-unknown list falls back to all four', () => {
    expect(parse({ kick: 'a', pinPlatforms: 'discord,irc' }).pinPlatforms)
      .toEqual(ALL);
  });

  it('entries are trimmed and lowercased', () => {
    expect(parse({ kick: 'a', pinPlatforms: ' kick , TWITCH ' }).pinPlatforms)
      .toEqual(['kick', 'twitch']);
  });

  it('a trailing comma is ignored', () => {
    expect(parse({ kick: 'a', pinPlatforms: 'kick,' }).pinPlatforms)
      .toEqual(['kick']);
  });
});

/* ------------------------------------------------------------------ */
/* 3 + 4. Unknown keys and repeated parameters                         */
/* ------------------------------------------------------------------ */

describe('unknown keys are stripped, not rejected', () => {
  it('parses successfully and omits them from the result', () => {
    const cfg = parse({
      kick: 'a', label: 'x', weight: '700', tab: 'counter', nonsense: '1',
    });
    expect(cfg.kick).toBe('a');
    expect(cfg).not.toHaveProperty('label');
    expect(cfg).not.toHaveProperty('weight');
    expect(cfg).not.toHaveProperty('tab');
    expect(cfg).not.toHaveProperty('nonsense');
  });
});

describe('repeated (array-valued) parameters fail, as at HEAD', () => {
  const cases: Record<string, string | string[]>[] = [
    { kick: ['a', 'b'] },
    { kick: 'a', textSize: ['1', '2'] },
    { kick: 'a', pinPlatforms: ['kick', 'twitch'] },
    { kick: 'a', fade: ['30'] },
    { kick: 'a', msgBold: ['false'] },
  ];

  for (const [index, query] of cases.entries()) {
    it(`case ${index + 1} does not parse`, () => {
      expect(safeParseMultichatConfig(query).success).toBe(false);
    });
  }
});

/* ------------------------------------------------------------------ */
/* 10. Compatibility-only parameters stay parsed                       */
/* ------------------------------------------------------------------ */

describe('compatibility-only parameters', () => {
  it('all four remain present in a parsed config', () => {
    const cfg = parse({ kick: 'a' }) as Record<string, unknown>;
    for (const key of MULTICHAT_UNREAD_PARAMS) {
      expect(cfg).toHaveProperty(key);
    }
  });

  it('their HEAD defaults are unchanged', () => {
    const cfg = parse({ kick: 'a' });
    expect(cfg.ttsEnabled).toBe(true);
    expect(cfg.showSystemMsgs).toBe(true);
    expect(cfg.showRedeems).toBe(true);
    expect(cfg.showAvatars).toBe(false);
  });

  it('explicit values still round-trip through the parser', () => {
    const cfg = parse({
      kick: 'a', ttsEnabled: 'false', showSystemMsgs: 'false',
      showRedeems: 'false', showAvatars: 'true',
    });
    expect(cfg).toMatchObject({
      ttsEnabled: false, showSystemMsgs: false,
      showRedeems: false, showAvatars: true,
    });
  });

  it('none of them is emitted by the generator', () => {
    const query = build({}, { kick: 'a' });
    for (const key of MULTICHAT_UNREAD_PARAMS) {
      expect(query).not.toContain(key);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Overlay-versus-generator mode detection                             */
/* ------------------------------------------------------------------ */

describe('mode detection', () => {
  it('no channel means generator mode', () => {
    const cfg = parse({});
    expect(multichatPlatformCount(cfg)).toBe(0);
    expect(hasConfiguredMultichatChannel(cfg)).toBe(false);
  });

  it('any single platform means overlay mode', () => {
    for (const key of ['kick', 'twitch', 'youtube', 'tiktok'] as const) {
      const cfg = parse({ [key]: 'someone' });
      expect(multichatPlatformCount(cfg)).toBe(1);
      expect(hasConfiguredMultichatChannel(cfg)).toBe(true);
    }
  });

  it('counts all four when all four are present', () => {
    const cfg = parse({ kick: 'a', twitch: 'b', youtube: 'c', tiktok: 'd' });
    expect(multichatPlatformCount(cfg)).toBe(4);
  });

  it('the legacy channel= alias counts as the kick channel', () => {
    const cfg = parse({ channel: 'legacyname' });
    expect(multichatKickChannel(cfg)).toBe('legacyname');
    expect(multichatPlatformCount(cfg)).toBe(1);
  });

  it('kick= wins over channel= when both are present', () => {
    expect(multichatKickChannel(parse({ kick: 'k', channel: 'c' }))).toBe('k');
  });

  it('a whitespace-only channel still counts, as at HEAD', () => {
    /* HEAD quirk, preserved: the count is a truthiness filter, so '   ' is a
       configured channel and the route renders the overlay. */
    const cfg = parse({ kick: '   ' });
    expect(cfg.kick).toBe('   ');
    expect(hasConfiguredMultichatChannel(cfg)).toBe(true);
  });

  it('a leading @ on kick is preserved by the parser', () => {
    expect(parse({ kick: '@someone' }).kick).toBe('@someone');
  });
});

/* ------------------------------------------------------------------ */
/* 8. Serializer — complete strings captured from the HEAD generator    */
/* ------------------------------------------------------------------ */

describe('buildMultichatQuery matches the HEAD generator byte-for-byte', () => {
  const golden: [string, Partial<MultichatGeneratorStyle>, Partial<typeof MULTICHAT_GENERATOR_DEFAULT_CHANNELS>, string][] = [
    ['initial state emits the placeholder channel', {}, {},
      'kick=yourchannel&sevenTVEmotesEnabled=true&sevenTVCosmeticsEnabled=true&textSize=medium&font=opensans&textShadow=small&stroke=none&animation=slide&fade=30&showPinEnabled=true&pinPlatforms=kick%2Cyoutube%2Ctiktok&hideNames=false'],
    ['kick only', {}, { kick: 'xqc' },
      'kick=xqc&sevenTVEmotesEnabled=true&sevenTVCosmeticsEnabled=true&textSize=medium&font=opensans&textShadow=small&stroke=none&animation=slide&fade=30&showPinEnabled=true&pinPlatforms=kick%2Cyoutube%2Ctiktok&hideNames=false'],
    ['kick is trimmed', {}, { kick: '  xqc  ' },
      'kick=xqc&sevenTVEmotesEnabled=true&sevenTVCosmeticsEnabled=true&textSize=medium&font=opensans&textShadow=small&stroke=none&animation=slide&fade=30&showPinEnabled=true&pinPlatforms=kick%2Cyoutube%2Ctiktok&hideNames=false'],
    ['kick keeps a leading @, unlike the other three', {}, { kick: '@xqc' },
      'kick=%40xqc&sevenTVEmotesEnabled=true&sevenTVCosmeticsEnabled=true&textSize=medium&font=opensans&textShadow=small&stroke=none&animation=slide&fade=30&showPinEnabled=true&pinPlatforms=kick%2Cyoutube%2Ctiktok&hideNames=false'],
    ['twitch strips a leading @', {}, { twitch: '@forsen' },
      'twitch=forsen&sevenTVEmotesEnabled=true&sevenTVCosmeticsEnabled=true&textSize=medium&font=opensans&textShadow=small&stroke=none&animation=slide&fade=30&showPinEnabled=true&pinPlatforms=kick%2Cyoutube%2Ctiktok&hideNames=false'],
    ['all four, in fixed order', {}, { kick: 'a', twitch: 'b', youtube: 'c', tiktok: 'd' },
      'kick=a&twitch=b&youtube=c&tiktok=d&sevenTVEmotesEnabled=true&sevenTVCosmeticsEnabled=true&textSize=medium&font=opensans&textShadow=small&stroke=none&animation=slide&fade=30&showPinEnabled=true&pinPlatforms=kick%2Cyoutube%2Ctiktok&hideNames=false'],
    ['whitespace-only channels still trigger the placeholder', {}, { kick: ' ', twitch: '  ' },
      'kick=yourchannel&sevenTVEmotesEnabled=true&sevenTVCosmeticsEnabled=true&textSize=medium&font=opensans&textShadow=small&stroke=none&animation=slide&fade=30&showPinEnabled=true&pinPlatforms=kick%2Cyoutube%2Ctiktok&hideNames=false'],
    ['7TV off', { sevenTVEmotesEnabled: false, sevenTVCosmeticsEnabled: false }, { kick: 'a' },
      'kick=a&sevenTVEmotesEnabled=false&sevenTVCosmeticsEnabled=false&textSize=medium&font=opensans&textShadow=small&stroke=none&animation=slide&fade=30&showPinEnabled=true&pinPlatforms=kick%2Cyoutube%2Ctiktok&hideNames=false'],
    ['fade disabled omits the parameter', { fadeEnabled: false }, { kick: 'a' },
      'kick=a&sevenTVEmotesEnabled=true&sevenTVCosmeticsEnabled=true&textSize=medium&font=opensans&textShadow=small&stroke=none&animation=slide&showPinEnabled=true&pinPlatforms=kick%2Cyoutube%2Ctiktok&hideNames=false'],
    ['fade empty also omits the parameter', { fade: '' }, { kick: 'a' },
      'kick=a&sevenTVEmotesEnabled=true&sevenTVCosmeticsEnabled=true&textSize=medium&font=opensans&textShadow=small&stroke=none&animation=slide&showPinEnabled=true&pinPlatforms=kick%2Cyoutube%2Ctiktok&hideNames=false'],
    ['platform icons off emits sourceTag=none', { platformIcons: false }, { kick: 'a' },
      'kick=a&sevenTVEmotesEnabled=true&sevenTVCosmeticsEnabled=true&textSize=medium&font=opensans&textShadow=small&stroke=none&animation=slide&fade=30&showPinEnabled=true&sourceTag=none&pinPlatforms=kick%2Cyoutube%2Ctiktok&hideNames=false'],
    ['bgColor drops its hash', { bgColor: '#191919' }, { kick: 'a' },
      'kick=a&sevenTVEmotesEnabled=true&sevenTVCosmeticsEnabled=true&textSize=medium&font=opensans&textShadow=small&stroke=none&animation=slide&fade=30&showPinEnabled=true&bgColor=191919&pinPlatforms=kick%2Cyoutube%2Ctiktok&hideNames=false'],
    ['emoteScale is emitted when non-empty', { emoteScale: '1.5' }, { kick: 'a' },
      'kick=a&sevenTVEmotesEnabled=true&sevenTVCosmeticsEnabled=true&textSize=medium&font=opensans&textShadow=small&stroke=none&animation=slide&fade=30&showPinEnabled=true&emoteScale=1.5&pinPlatforms=kick%2Cyoutube%2Ctiktok&hideNames=false'],
    ['no pins emits an empty pinPlatforms', { pinPlatforms: [] }, { kick: 'a' },
      'kick=a&sevenTVEmotesEnabled=true&sevenTVCosmeticsEnabled=true&textSize=medium&font=opensans&textShadow=small&stroke=none&animation=slide&fade=30&showPinEnabled=true&pinPlatforms=&hideNames=false'],
    ['all four pins omits pinPlatforms entirely', { pinPlatforms: ['kick', 'twitch', 'youtube', 'tiktok'] }, { kick: 'a' },
      'kick=a&sevenTVEmotesEnabled=true&sevenTVCosmeticsEnabled=true&textSize=medium&font=opensans&textShadow=small&stroke=none&animation=slide&fade=30&showPinEnabled=true&hideNames=false'],
    ['a single pin platform', { pinPlatforms: ['twitch'] }, { kick: 'a' },
      'kick=a&sevenTVEmotesEnabled=true&sevenTVCosmeticsEnabled=true&textSize=medium&font=opensans&textShadow=small&stroke=none&animation=slide&fade=30&showPinEnabled=true&pinPlatforms=twitch&hideNames=false'],
    ['filters are trimmed and percent-encoded', { botNames: ' bot1,bot2 ', userBL: ' x,y ', prefixBL: ' !,? ' }, { kick: 'a' },
      'kick=a&sevenTVEmotesEnabled=true&sevenTVCosmeticsEnabled=true&textSize=medium&font=opensans&textShadow=small&stroke=none&animation=slide&fade=30&showPinEnabled=true&pinPlatforms=kick%2Cyoutube%2Ctiktok&hideNames=false&botNames=bot1%2Cbot2&userBL=x%2Cy&prefixBL=%21%2C%3F'],
    ['whitespace-only filters are omitted', { botNames: '  ', userBL: '  ' }, { kick: 'a' },
      'kick=a&sevenTVEmotesEnabled=true&sevenTVCosmeticsEnabled=true&textSize=medium&font=opensans&textShadow=small&stroke=none&animation=slide&fade=30&showPinEnabled=true&pinPlatforms=kick%2Cyoutube%2Ctiktok&hideNames=false'],
    ['encoding-sensitive values', { botNames: 'a b,c+d', userBL: 'ü/é', prefixBL: '#,%' }, { kick: 'a b&c' },
      'kick=a+b%26c&sevenTVEmotesEnabled=true&sevenTVCosmeticsEnabled=true&textSize=medium&font=opensans&textShadow=small&stroke=none&animation=slide&fade=30&showPinEnabled=true&pinPlatforms=kick%2Cyoutube%2Ctiktok&hideNames=false&botNames=a+b%2Cc%2Bd&userBL=%C3%BC%2F%C3%A9&prefixBL=%23%2C%25'],
  ];

  for (const [label, style, channels, expected] of golden) {
    it(label, () => {
      expect(build(style, channels)).toBe(expected);
    });
  }

  it('every control off its default at once', () => {
    expect(build(
      {
        sevenTVEmotesEnabled: false, sevenTVCosmeticsEnabled: false,
        textSize: 'small', font: 'alsina', textShadow: 'none',
        stroke: 'thicker', animation: 'none', fade: '7', fadeEnabled: true,
        showPinEnabled: false, platformIcons: false, mentionColor: false,
        bgColor: '#0a0a0a', emoteScale: '2', msgBold: false, msgCaps: true,
        modAction: false, paintShadows: false, fontColor: '#ffffff',
        hideNames: true, pinPlatforms: ['twitch', 'tiktok'],
        botNames: 'nightbot', userBL: 'troll', prefixBL: '!',
      },
      { kick: 'kickguy', twitch: '@twitchguy', youtube: '@ytguy', tiktok: '@ttguy' },
    )).toBe(
      'kick=kickguy&twitch=twitchguy&youtube=ytguy&tiktok=ttguy&sevenTVEmotesEnabled=false&sevenTVCosmeticsEnabled=false&textSize=small&font=alsina&textShadow=none&stroke=thicker&animation=none&fade=7&showPinEnabled=false&sourceTag=none&mentionColor=false&bgColor=0a0a0a&emoteScale=2&msgBold=false&msgCaps=true&modAction=false&paintShadows=false&fontColor=ffffff&pinPlatforms=twitch%2Ctiktok&hideNames=true&botNames=nightbot&userBL=troll&prefixBL=%21',
    );
  });

  it('emits no fragment and no leading question mark', () => {
    const query = build({}, { kick: 'a' });
    expect(query.startsWith('?')).toBe(false);
    expect(query).not.toContain('#');
    expect(query).not.toContain('twitchConnectionId');
  });
});

/* ------------------------------------------------------------------ */
/* 9. Round-trips, only where HEAD actually supports one               */
/* ------------------------------------------------------------------ */

describe('parse(build(state)) round-trips', () => {
  /* Only asserted for fields the generator serializes losslessly. The
     generator is lossy by design elsewhere: it emits a placeholder channel
     when none is set, omits pinPlatforms when all four are chosen, and drops
     fade entirely when disabled — so a full object round-trip is not a
     property HEAD ever had. */
  it('a fully specified state survives a round-trip', () => {
    const style: MultichatGeneratorStyle = {
      ...MULTICHAT_GENERATOR_DEFAULTS,
      textSize: 'large', font: 'impact', textShadow: 'medium',
      stroke: 'thick', animation: 'fade', fade: '12', fadeEnabled: true,
      showPinEnabled: true, platformIcons: false, mentionColor: false,
      bgColor: '#191919', emoteScale: '1.5', msgBold: false, msgCaps: true,
      modAction: false, paintShadows: false, fontColor: '#ffaa00',
      hideNames: true, pinPlatforms: ['kick', 'twitch'],
      botNames: 'nightbot', userBL: 'troll', prefixBL: '!',
    };
    const query = buildMultichatQuery({ kick: 'a', twitch: 'b', youtube: '', tiktok: '' }, style);
    const cfg = parse(Object.fromEntries(new URLSearchParams(query)));

    expect(cfg.textSize).toBe('large');
    expect(cfg.font).toBe('impact');
    expect(cfg.textShadow).toBe('medium');
    expect(cfg.stroke).toBe('thick');
    expect(cfg.animation).toBe('fade');
    expect(cfg.fade).toBe(12);
    expect(cfg.showPinEnabled).toBe(true);
    expect(cfg.sourceTag).toBe('none');
    expect(cfg.mentionColor).toBe(false);
    expect(cfg.bgColor).toBe('#191919');
    expect(cfg.emoteScale).toBe(1.5);
    expect(cfg.msgBold).toBe(false);
    expect(cfg.msgCaps).toBe(true);
    expect(cfg.modAction).toBe(false);
    expect(cfg.paintShadows).toBe(false);
    expect(cfg.fontColor).toBe('#ffaa00');
    expect(cfg.hideNames).toBe(true);
    expect(cfg.pinPlatforms).toEqual(['kick', 'twitch']);
    expect(cfg.botNames).toBe('nightbot');
    expect(cfg.userBL).toBe('troll');
    expect(cfg.prefixBL).toBe('!');
    expect(cfg.kick).toBe('a');
    expect(cfg.twitch).toBe('b');
  });

  it('the generator default state round-trips to the generator shadow, not the overlay one', () => {
    const query = build({}, { kick: 'a' });
    expect(parse(Object.fromEntries(new URLSearchParams(query))).textShadow)
      .toBe('small');
  });

  it('documented lossy cases do not round-trip, as at HEAD', () => {
    /* fade disabled → parameter absent → parses back as false, not '30'. */
    const faded = parse(Object.fromEntries(new URLSearchParams(
      build({ fadeEnabled: false }, { kick: 'a' }),
    )));
    expect(faded.fade).toBe(false);

    /* all four pins → parameter omitted → parses back as all four. */
    const allPins = parse(Object.fromEntries(new URLSearchParams(
      build({ pinPlatforms: ['kick', 'twitch', 'youtube', 'tiktok'] }, { kick: 'a' }),
    )));
    expect(allPins.pinPlatforms).toEqual(['kick', 'twitch', 'youtube', 'tiktok']);

    /* no channel → placeholder, so the parsed channel is not the empty input. */
    const placeholder = parse(Object.fromEntries(new URLSearchParams(build())));
    expect(placeholder.kick).toBe('yourchannel');
  });
});
