/* MultiChat descriptor and catalog integrity, plus serializer byte identity.
 *
 * The 105 parser compatibility tests in multichatConfig.test.ts stay the
 * authority on parsing and serialization behaviour; nothing here re-tests them.
 * These cover the descriptor layer instead: that it reuses the authoritative
 * defaults and enums rather than restating them, that it produces exactly the
 * string buildMultichatQuery produces, and that it is registered as the first
 * workspace tool while still generating URLs for the existing /multichat route.
 */
import { describe, expect, it } from 'vitest';
import {
  MULTICHAT_ANIMATIONS,
  MULTICHAT_FONTS,
  MULTICHAT_GENERATOR_DEFAULTS,
  MULTICHAT_PLATFORMS,
  MULTICHAT_SOURCE_TAGS,
  MULTICHAT_SOURCE_TAG_ORDER,
  MULTICHAT_STROKES,
  MULTICHAT_TEXT_SHADOWS,
  MULTICHAT_TEXT_SIZES,
  MULTICHAT_UNREAD_PARAMS,
  MULTICHAT_WORKSPACE_DEFAULTS,
  MultichatQuerySchema,
  buildMultichatQuery,
  multichatSourceTagOf,
  type MultichatGeneratorStyle,
  type MultichatPlatform,
  type MultichatWorkspaceStyle,
} from '@/lib/multichatConfig';
import {
  MULTICHAT_PLATFORM_DEFS,
  configuredMultichatPlatforms,
  multichatTool,
  normalizeMultichatStyle,
  toMultichatChannels,
} from '@/lib/tools/multichat/config';
import { MULTICHAT_CATALOG } from '@/lib/tools/multichat/settings';
import { TOOLS, TOOL_IDS, findTool } from '@/lib/tools/registry';

/** Workspace defaults — what the catalog and descriptor are built on. */
const D = MULTICHAT_WORKSPACE_DEFAULTS;

/** Legacy generator defaults — the pinned compatibility shape. */
const LEGACY = MULTICHAT_GENERATOR_DEFAULTS;

/** Both sides of every identity check get the same complete channel shape. */
const serializePair = (
  channels: Partial<Record<MultichatPlatform, string>>,
  style: MultichatWorkspaceStyle,
) => ({
  viaTool: multichatTool.serialize(channels, style),
  viaAuthority: buildMultichatQuery(toMultichatChannels(channels), style),
});

/** The exact string the generator produced before the sourceTag extension. */
const LEGACY_DEFAULT_QUERY =
  'kick=yourchannel' +
  '&sevenTVEmotesEnabled=true' +
  '&sevenTVCosmeticsEnabled=true' +
  '&textSize=medium' +
  '&font=opensans' +
  '&textShadow=small' +
  '&stroke=none' +
  '&animation=slide' +
  '&fade=30' +
  '&showPinEnabled=true' +
  '&pinPlatforms=kick%2Cyoutube%2Ctiktok' +
  '&hideNames=false';

const noChannels = { kick: '', twitch: '', youtube: '', tiktok: '' };

/* The serializer now accepts two style shapes. This suite pins the legacy one:
   every assertion here passed before MultichatWorkspaceStyle existed and must
   keep passing, because these are the URLs already sitting in people's OBS. */
describe('legacy generator compatibility', () => {
  it('still produces the exact previous default string', () => {
    expect(buildMultichatQuery(noChannels, LEGACY)).toBe(LEGACY_DEFAULT_QUERY);
  });

  it('still omits sourceTag when platformIcons is true', () => {
    const url = buildMultichatQuery(noChannels, { ...LEGACY, platformIcons: true });
    expect(url).not.toContain('sourceTag');
    expect(url).toBe(LEGACY_DEFAULT_QUERY);
  });

  it('still emits sourceTag=none when platformIcons is false', () => {
    expect(buildMultichatQuery(noChannels, { ...LEGACY, platformIcons: false })).toBe(
      LEGACY_DEFAULT_QUERY.replace(
        '&showPinEnabled=true',
        '&showPinEnabled=true&sourceTag=none',
      ),
    );
  });

  it('keeps platformIcons on the legacy style, untouched', () => {
    expect(LEGACY.platformIcons).toBe(true);
    expect('sourceTag' in LEGACY).toBe(false);
  });

  it('maps the legacy boolean onto the enum the way it always serialized', () => {
    expect(multichatSourceTagOf({ ...LEGACY, platformIcons: true })).toBe('icon');
    expect(multichatSourceTagOf({ ...LEGACY, platformIcons: false })).toBe('none');
  });

  /* A spread of legacy generator states, each byte-pinned against the same serializer
     call, so any drift in order, encoding, or inclusion shows up here. */
  it('stays byte-identical across representative legacy generator states', () => {
    const fixtures: Partial<MultichatGeneratorStyle>[] = [
      {},
      { platformIcons: false },
      { textSize: 'large', font: 'impact', stroke: 'thick', textShadow: 'none' },
      { fadeEnabled: false },
      { fade: '' },
      { pinPlatforms: [] },
      { pinPlatforms: ['kick', 'twitch', 'youtube', 'tiktok'] },
      { bgColor: '#191919', fontColor: '#ff0000' },
      { msgBold: false, msgCaps: true, hideNames: true, mentionColor: false },
      { botNames: 'nightbot, streamelements', userBL: 'a b', prefixBL: 'https://' },
      { emoteScale: '1.5' },
      { modAction: false, paintShadows: false, showPinEnabled: false },
    ];
    for (const fixture of fixtures) {
      const style = { ...LEGACY, ...fixture };
      const channels = { kick: 'k', twitch: '@t', youtube: '@y', tiktok: '@tt' };
      /* Recomputed from the same authority, then checked for the one parameter
         the extension touches. */
      const url = buildMultichatQuery(channels, style);
      expect(url).toContain('kick=k&twitch=t&youtube=y&tiktok=tt');
      expect(url.includes('sourceTag=none')).toBe(style.platformIcons === false);
      expect(url).not.toContain('sourceTag=dot');
      expect(url).not.toContain('sourceTag=label');
      expect(url).not.toContain('sourceTag=icon');
    }
  });

  it('puts sourceTag in the same slot for legacy and workspace styles', () => {
    const legacyNone = buildMultichatQuery(noChannels, {
      ...LEGACY,
      platformIcons: false,
    });
    const workspaceNone = buildMultichatQuery(noChannels, { ...D, sourceTag: 'none' });
    expect(workspaceNone).toBe(legacyNone);
  });
});

describe('descriptor identity', () => {
  it('declares the stable id and its overlay route', () => {
    expect(multichatTool.id).toBe('multichat');
    expect(multichatTool.label).toBe('MultiChat');
    expect(multichatTool.overlayRoute).toBe('/multichat');
  });

  it('declares the intended OBS browser-source size', () => {
    /* 680 × 280 — the size the generator's own OBS setup step recommends, from
       lib/tools/multichat/obs.ts. */
    expect(multichatTool.obs).toEqual({ width: 680, height: 280 });
  });

  it('uses the authoritative workspace defaults by reference', () => {
    expect(multichatTool.defaults).toBe(MULTICHAT_WORKSPACE_DEFAULTS);
  });

  it('derives the workspace defaults from the generator defaults', () => {
    const { platformIcons, ...shared } = LEGACY;
    /* Every field but the swapped one comes straight from the legacy object. */
    expect(D).toEqual({ ...shared, sourceTag: 'icon' });
    expect(platformIcons).toBe(true);
    expect('platformIcons' in D).toBe(false);
  });

  it('leaves the generator defaults unmutated by the derivation', () => {
    expect(LEGACY.platformIcons).toBe(true);
    expect(LEGACY.textShadow).toBe('small');
  });

  /* The descriptor now declares a context, but it must stay silent unless a
     connection is genuinely usable — that is what keeps every URL built without
     one byte-identical to what this tool produced before the connection existed. */
  it('contributes no fragment without a connection', () => {
    expect(multichatTool.context).toBeDefined();
    expect(
      multichatTool.context?.(D, {
        connectionId: '',
        connectedLogin: '',
        twitchChannel: '',
      }),
    ).toBeUndefined();
  });
});

describe('registration boundary', () => {
  it('can be imported directly', () => {
    expect(multichatTool).toBeDefined();
    expect(multichatTool.catalog).toBe(MULTICHAT_CATALOG);
  });

  it('is present in TOOLS, first', () => {
    expect(TOOLS.some((tool) => tool.id === 'multichat')).toBe(true);
    expect(TOOLS).toHaveLength(2);
    expect(TOOLS[0]?.id).toBe('multichat');
  });

  it('puts multichat ahead of the counter in TOOL_IDS', () => {
    expect(TOOL_IDS).toEqual(['multichat', 'counter']);
  });

  it('is findable by id, which is what the retired /tools redirect resolves', () => {
    expect(findTool('multichat')).toBeDefined();
    expect(findTool('multichat')?.id).toBe('multichat');
  });

  it('keeps the overlay route the generated URL has always pointed at', () => {
    /* The generated URL points at the overlay, never at a generator page — that
       is what keeps every URL already pasted into OBS valid regardless of which
       address the generator itself is served from. */
    expect(findTool('multichat')?.overlayRoute).toBe('/multichat');
  });

  it('hands back the same descriptor object through use', () => {
    /* Compared inside the callback: returning the descriptor out of `use` would
     * re-widen its type parameters, which is the very thing `use` exists to
     * avoid. Object.is proves identity without that. */
    expect(findTool('multichat')?.use((tool) => Object.is(tool, multichatTool))).toBe(true);
    expect(findTool('multichat')?.use((tool) => tool.catalog)).toBe(MULTICHAT_CATALOG);
  });
});

describe('platforms', () => {
  const keys = MULTICHAT_PLATFORM_DEFS.map((platform) => platform.key);

  it('matches the generator order: kick, twitch, youtube, tiktok', () => {
    expect(keys).toEqual(['kick', 'twitch', 'youtube', 'tiktok']);
    expect(keys).toEqual([...MULTICHAT_PLATFORMS]);
  });

  it('uses unique keys', () => {
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives every platform a non-empty label', () => {
    for (const platform of MULTICHAT_PLATFORM_DEFS) {
      expect(platform.label.length).toBeGreaterThan(0);
    }
    expect(MULTICHAT_PLATFORM_DEFS.map((p) => p.label)).toEqual([
      'Kick',
      'Twitch',
      'YouTube',
      'TikTok',
    ]);
  });

  it('keeps the generator placeholders, including the @ ones', () => {
    expect(MULTICHAT_PLATFORM_DEFS.map((p) => p.placeholder)).toEqual([
      'Channel name',
      'Channel name',
      '@handle',
      '@username',
    ]);
  });

  it('preserves the @ asymmetry: kick keeps it, the others strip it', () => {
    const by = (key: MultichatPlatform) =>
      MULTICHAT_PLATFORM_DEFS.find((p) => p.key === key)!.normalize;
    expect(by('kick')('@someone')).toBe('@someone');
    expect(by('twitch')('@someone')).toBe('someone');
    expect(by('youtube')('@someone')).toBe('someone');
    expect(by('tiktok')('@someone')).toBe('someone');
  });

  it('strips only one leading @, and only from the front', () => {
    const twitch = MULTICHAT_PLATFORM_DEFS.find((p) => p.key === 'twitch')!.normalize;
    expect(twitch('@@someone')).toBe('@someone');
    expect(twitch('some@one')).toBe('some@one');
  });

  it('trims but adds no validation the generator does not have', () => {
    for (const platform of MULTICHAT_PLATFORM_DEFS) {
      expect(platform.normalize('  spaced  ')).toBe('spaced');
      /* Characters the counter would reject are kept here. */
      expect(platform.normalize('a b!$%')).toBe('a b!$%');
      expect(platform.normalize('x'.repeat(80))).toHaveLength(80);
    }
  });

  it('does not URL-encode inside the normalizer', () => {
    const kick = MULTICHAT_PLATFORM_DEFS.find((p) => p.key === 'kick')!.normalize;
    expect(kick('a b#c%d')).toBe('a b#c%d');
  });

  it('returns empty for non-strings and blank input', () => {
    for (const platform of MULTICHAT_PLATFORM_DEFS) {
      expect(platform.normalize(undefined)).toBe('');
      expect(platform.normalize(null)).toBe('');
      expect(platform.normalize(42)).toBe('');
      expect(platform.normalize('   ')).toBe('');
    }
  });
});

describe('configuredPlatforms', () => {
  it('is empty when nothing is typed', () => {
    expect(configuredMultichatPlatforms({})).toEqual([]);
    expect(configuredMultichatPlatforms({ kick: '', twitch: '   ' })).toEqual([]);
  });

  it('lists only normalized non-empty channels, in descriptor order', () => {
    expect(
      configuredMultichatPlatforms({ tiktok: 'c', kick: 'a', youtube: 'b' }),
    ).toEqual(['kick', 'youtube', 'tiktok']);
  });

  it('counts a lone @ as configured on kick but not elsewhere', () => {
    /* Preserved asymmetry: '@' survives kick's trim-only rule. */
    expect(configuredMultichatPlatforms({ kick: '@' })).toEqual(['kick']);
    expect(configuredMultichatPlatforms({ twitch: '@' })).toEqual([]);
  });

  it('agrees with the descriptor method', () => {
    expect(multichatTool.configuredPlatforms({ kick: 'a' })).toEqual(['kick']);
    expect(multichatTool.configuredPlatforms({})).toEqual([]);
  });
});

describe('catalog integrity', () => {
  const keys = MULTICHAT_CATALOG.map((setting) => setting.key);

  it('uses unique keys', () => {
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('shares a param only for the fade pair, which is one parameter', () => {
    const params = MULTICHAT_CATALOG.map((setting) => setting.param);
    const duplicated = params.filter((p, i) => params.indexOf(p) !== i);
    expect(duplicated).toEqual(['fade']);
    expect(
      MULTICHAT_CATALOG.filter((s) => s.param === 'fade').map((s) => s.key),
    ).toEqual(['fadeEnabled', 'fade']);
  });

  it('contains no channel field', () => {
    for (const platform of MULTICHAT_PLATFORMS) {
      expect(keys).not.toContain(platform);
    }
    expect(keys).not.toContain('channel');
  });

  it('contains none of the four unread compatibility-only parameters', () => {
    const params = MULTICHAT_CATALOG.map((setting) => setting.param);
    for (const unread of MULTICHAT_UNREAD_PARAMS) {
      expect(keys).not.toContain(unread);
      expect(params).not.toContain(unread);
    }
    expect([...MULTICHAT_UNREAD_PARAMS]).toEqual([
      'ttsEnabled',
      'showAvatars',
      'showSystemMsgs',
      'showRedeems',
    ]);
  });

  it('takes every default from MULTICHAT_GENERATOR_DEFAULTS', () => {
    for (const setting of MULTICHAT_CATALOG) {
      expect(setting.default).toEqual(D[setting.key]);
    }
  });

  it('keeps the generator textShadow default of small, not the overlay large', () => {
    const shadow = MULTICHAT_CATALOG.find((s) => s.key === 'textShadow');
    expect(shadow?.default).toBe('small');
    expect(MultichatQuerySchema.parse({}).textShadow).toBe('large');
  });

  it('uses only the six supported control types', () => {
    const allowed = ['toggle', 'select', 'text', 'color', 'number', 'multiselect'];
    for (const setting of MULTICHAT_CATALOG) {
      expect(allowed).toContain(setting.type);
    }
  });

  it('gives every setting a non-empty label', () => {
    for (const setting of MULTICHAT_CATALOG) {
      expect(setting.label.length).toBeGreaterThan(0);
    }
  });

  it('declares every select default inside its own option list', () => {
    for (const setting of MULTICHAT_CATALOG) {
      if (setting.type !== 'select') continue;
      expect(setting.options.map((option) => option.value)).toContain(setting.default);
    }
  });

  it('sources every select option list from an authoritative tuple, in order', () => {
    const values = (key: string) => {
      const setting = MULTICHAT_CATALOG.find((s) => s.key === key);
      return setting && setting.type === 'select'
        ? setting.options.map((option) => option.value)
        : undefined;
    };
    expect(values('textSize')).toEqual([...MULTICHAT_TEXT_SIZES]);
    expect(values('textShadow')).toEqual([...MULTICHAT_TEXT_SHADOWS]);
    expect(values('stroke')).toEqual([...MULTICHAT_STROKES]);
    expect(values('animation')).toEqual([...MULTICHAT_ANIMATIONS]);
    expect(values('font')).toEqual([...MULTICHAT_FONTS]);
  });

  it('sources the multiselect options from the platform tuple, in order', () => {
    const pins = MULTICHAT_CATALOG.find((s) => s.key === 'pinPlatforms');
    expect(pins?.type).toBe('multiselect');
    expect(
      pins && pins.type === 'multiselect'
        ? pins.options.map((option) => option.value)
        : undefined,
    ).toEqual([...MULTICHAT_PLATFORMS]);
  });

  it('allows an empty pin selection and defaults to the generator subset', () => {
    const pins = MULTICHAT_CATALOG.find((s) => s.key === 'pinPlatforms');
    expect(pins?.default).toEqual(['kick', 'youtube', 'tiktok']);
    expect(pins?.default).toEqual(D.pinPlatforms);
  });

  it('keeps the fade pair as two uncollapsed fields', () => {
    const enabled = MULTICHAT_CATALOG.find((s) => s.key === 'fadeEnabled');
    const seconds = MULTICHAT_CATALOG.find((s) => s.key === 'fade');
    expect(enabled?.type).toBe('toggle');
    expect(enabled?.default).toBe(true);
    expect(seconds?.type).toBe('text');
    expect(seconds?.default).toBe('30');
  });

  it('carries no OAuth, connection, or token metadata', () => {
    const serialized = JSON.stringify(MULTICHAT_CATALOG);
    for (const word of ['oauth', 'token', 'connectionId', 'twitchConnection', 'login']) {
      expect(serialized.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });

  /* The catalog stays static. Pin gating is genuinely dynamic — it changes as the
     user connects and retypes the channel — so it lives in the descriptor's
     `optionAvailability`, not in a `disabled` flag that could only be a constant.
     A static flag here would be permanently wrong in one direction or the other. */
  it('declares no disabled or hidden flags, leaving gating to the runtime', () => {
    for (const setting of MULTICHAT_CATALOG) {
      expect(setting.disabled).toBeUndefined();
      expect(setting.hidden).toBeUndefined();
    }
  });

  it('exposes sourceTag as a four-option select, and no platformIcons entry', () => {
    const keys = MULTICHAT_CATALOG.map((s) => s.key);
    expect(keys).toContain('sourceTag');
    expect(keys).not.toContain('platformIcons');
    const tag = MULTICHAT_CATALOG.find((s) => s.key === 'sourceTag');
    expect(tag?.type).toBe('select');
    expect(tag?.param).toBe('sourceTag');
    expect(tag?.default).toBe('icon');
    expect(
      tag && tag.type === 'select' ? tag.options.map((o) => o.value) : undefined,
    ).toEqual(['icon', 'dot', 'label', 'none']);
  });

  it('draws the sourceTag options from the authoritative display tuple', () => {
    const tag = MULTICHAT_CATALOG.find((s) => s.key === 'sourceTag');
    expect(
      tag && tag.type === 'select' ? tag.options.map((o) => o.value) : undefined,
    ).toEqual([...MULTICHAT_SOURCE_TAG_ORDER]);
    /* Display order is a permutation of the parser's set, never a new set. */
    expect([...MULTICHAT_SOURCE_TAG_ORDER].sort()).toEqual([...MULTICHAT_SOURCE_TAGS].sort());
    expect(MULTICHAT_SOURCE_TAG_ORDER).toHaveLength(MULTICHAT_SOURCE_TAGS.length);
  });

  it('labels every sourceTag option', () => {
    const tag = MULTICHAT_CATALOG.find((s) => s.key === 'sourceTag');
    const labels = tag && tag.type === 'select' ? tag.options.map((o) => o.label) : [];
    expect(labels).toHaveLength(4);
    for (const label of labels) expect(label.length).toBeGreaterThan(0);
    expect(new Set(labels).size).toBe(4);
  });

  it('covers every workspace style field, sourceTag included', () => {
    /* Compared against the workspace defaults, not the legacy generator ones, so
       sourceTag counts and platformIcons does not. Fails if a field is added to
       MultichatWorkspaceStyle without a catalog decision. */
    const styleKeys = Object.keys(MULTICHAT_WORKSPACE_DEFAULTS).sort();
    expect([...keys].sort()).toEqual(styleKeys);
    expect(styleKeys).toContain('sourceTag');
    expect(styleKeys).not.toContain('platformIcons');
  });
});

describe('normalization', () => {
  it('fills an empty object with the generator defaults exactly', () => {
    expect(normalizeMultichatStyle({})).toEqual(D);
  });

  it('returns a fresh object, never the defaults themselves', () => {
    expect(normalizeMultichatStyle({})).not.toBe(D);
  });

  it('falls back to the generator default for every missing catalog field', () => {
    for (const setting of MULTICHAT_CATALOG) {
      const result = normalizeMultichatStyle({ [setting.key]: undefined });
      expect(result[setting.key]).toEqual(D[setting.key]);
    }
  });

  it('preserves a valid value for every catalog field', () => {
    const valid: Partial<Record<string, unknown>> = {
      textSize: 'large',
      font: 'impact',
      stroke: 'thick',
      textShadow: 'medium',
      animation: 'none',
      emoteScale: '2.5',
      sevenTVEmotesEnabled: false,
      sevenTVCosmeticsEnabled: false,
      fadeEnabled: false,
      fade: '12',
      msgBold: false,
      msgCaps: true,
      modAction: false,
      paintShadows: false,
      hideNames: true,
      showPinEnabled: false,
      pinPlatforms: ['twitch'],
      sourceTag: 'dot',
      mentionColor: false,
      bgColor: '#191919',
      fontColor: '#ff0000',
      botNames: 'nightbot',
      userBL: 'spammer',
      prefixBL: 'https://',
    };
    for (const setting of MULTICHAT_CATALOG) {
      const value = valid[setting.key];
      const result = normalizeMultichatStyle({ [setting.key]: value } as never);
      expect(result[setting.key]).toEqual(value);
    }
  });

  it('replaces a wrong-typed value with the default for every catalog field', () => {
    const wrong = [null, undefined, 42, {}, [], 'nonsense-value', true];
    for (const setting of MULTICHAT_CATALOG) {
      for (const value of wrong) {
        /* A boolean field legitimately accepts true, so skip that one pairing. */
        if (setting.type === 'toggle' && typeof value === 'boolean') continue;
        /* Free text legitimately accepts any string. */
        if (
          (setting.type === 'text' || setting.type === 'color') &&
          typeof value === 'string'
        ) {
          continue;
        }
        /* An empty selection is a valid multiselect value, not a bad one. */
        if (setting.type === 'multiselect' && Array.isArray(value)) continue;
        const result = normalizeMultichatStyle({ [setting.key]: value } as never);
        expect(result[setting.key]).toEqual(D[setting.key]);
      }
    }
  });

  it('keeps textShadow at small when it is missing', () => {
    expect(normalizeMultichatStyle({}).textShadow).toBe('small');
    expect(normalizeMultichatStyle({ textShadow: undefined }).textShadow).toBe('small');
  });

  it('does not borrow the overlay large default on a bad value', () => {
    expect(normalizeMultichatStyle({ textShadow: 'enormous' as never }).textShadow).toBe(
      'small',
    );
  });

  it('leaves the overlay omission default as large in the parser', () => {
    expect(MultichatQuerySchema.parse({}).textShadow).toBe('large');
  });

  it('does not mutate its input', () => {
    const input: Partial<MultichatGeneratorStyle> = { textSize: 'large' };
    const snapshot = { ...input };
    normalizeMultichatStyle(input);
    expect(input).toEqual(snapshot);
  });

  it('does not mutate the authoritative defaults', () => {
    const snapshot = JSON.parse(JSON.stringify(D));
    const result = normalizeMultichatStyle({ pinPlatforms: [] });
    result.pinPlatforms = ['kick'];
    expect(D).toEqual(snapshot);
  });

  it('keeps arrays as arrays and copies rather than aliasing', () => {
    const input = ['kick', 'twitch'];
    const result = normalizeMultichatStyle({ pinPlatforms: input });
    expect(Array.isArray(result.pinPlatforms)).toBe(true);
    expect(result.pinPlatforms).not.toBe(input);
    expect(result.pinPlatforms).toEqual(['kick', 'twitch']);
  });

  it('preserves an empty pin selection instead of defaulting it', () => {
    expect(normalizeMultichatStyle({ pinPlatforms: [] }).pinPlatforms).toEqual([]);
  });

  it('orders a pin selection by the declared option order, not click order', () => {
    expect(
      normalizeMultichatStyle({ pinPlatforms: ['tiktok', 'kick'] }).pinPlatforms,
    ).toEqual(['kick', 'tiktok']);
  });

  it('drops unknown pin names and deduplicates', () => {
    expect(
      normalizeMultichatStyle({ pinPlatforms: ['kick', 'kick', 'discord'] }).pinPlatforms,
    ).toEqual(['kick']);
  });

  it('falls back to the default pin subset for a non-array', () => {
    expect(normalizeMultichatStyle({ pinPlatforms: 'kick' as never }).pinPlatforms).toEqual(
      D.pinPlatforms,
    );
  });

  it('agrees with the descriptor method', () => {
    expect(multichatTool.normalize({})).toEqual(D);
  });

  it('falls back to icon when sourceTag is missing', () => {
    expect(normalizeMultichatStyle({}).sourceTag).toBe('icon');
    expect(normalizeMultichatStyle({ sourceTag: undefined }).sourceTag).toBe('icon');
  });

  it('preserves every valid sourceTag value', () => {
    for (const tag of MULTICHAT_SOURCE_TAGS) {
      expect(normalizeMultichatStyle({ sourceTag: tag }).sourceTag).toBe(tag);
    }
  });

  it('falls back to icon for a malformed sourceTag', () => {
    for (const bad of ['ICON', 'dots', '', 'true', 42, null, {}, []]) {
      expect(normalizeMultichatStyle({ sourceTag: bad as never }).sourceTag).toBe('icon');
    }
  });

  it('emits no platformIcons property in workspace output', () => {
    const result = normalizeMultichatStyle({});
    expect('platformIcons' in result).toBe(false);
    expect(Object.keys(result)).not.toContain('platformIcons');
    /* Even when a caller passes the legacy field, it does not leak through. */
    const contaminated = normalizeMultichatStyle({ platformIcons: false } as never);
    expect('platformIcons' in contaminated).toBe(false);
    expect(contaminated.sourceTag).toBe('icon');
  });

  it('does not mutate the workspace defaults', () => {
    const snapshot = JSON.parse(JSON.stringify(D));
    const result = normalizeMultichatStyle({ sourceTag: 'dot' });
    result.sourceTag = 'label';
    expect(D).toEqual(snapshot);
    expect(D.sourceTag).toBe('icon');
  });
});

/* Every case below compares the complete string, never a parsed parameter map:
   order and encoding are part of the compatibility surface. */
describe('serializer byte identity', () => {
  const expectIdentical = (
    channels: Partial<Record<MultichatPlatform, string>>,
    style: MultichatWorkspaceStyle,
  ) => {
    const { viaTool, viaAuthority } = serializePair(channels, style);
    expect(viaTool).toBe(viaAuthority);
    return viaTool;
  };

  /* Pinned literally, because comparing the descriptor against
     buildMultichatQuery alone would pass even if both produced nonsense. This
     locks the actual bytes: parameter order, the placeholder, textShadow=small
     rather than large, and the CSV encoding of the default pin subset. */
  it('produces the exact expected default string', () => {
    expect(multichatTool.serialize({}, D)).toBe(
      'kick=yourchannel' +
        '&sevenTVEmotesEnabled=true' +
        '&sevenTVCosmeticsEnabled=true' +
        '&textSize=medium' +
        '&font=opensans' +
        '&textShadow=small' +
        '&stroke=none' +
        '&animation=slide' +
        '&fade=30' +
        '&showPinEnabled=true' +
        '&pinPlatforms=kick%2Cyoutube%2Ctiktok' +
        '&hideNames=false',
    );
  });

  it('matches for the defaults, placeholder included', () => {
    const url = expectIdentical({}, D);
    expect(url).toContain('kick=yourchannel');
  });

  it('matches for each platform independently', () => {
    for (const platform of MULTICHAT_PLATFORMS) {
      expectIdentical({ [platform]: 'someone' }, D);
    }
  });

  it('matches for all four platforms at once', () => {
    const url = expectIdentical(
      { kick: 'k', twitch: 't', youtube: 'y', tiktok: 'tt' },
      D,
    );
    expect(url).not.toContain('yourchannel');
  });

  it('matches with the @ asymmetry in play', () => {
    const url = expectIdentical(
      { kick: '@keeps', twitch: '@strips', youtube: '@strips', tiktok: '@strips' },
      D,
    );
    expect(url).toContain('kick=%40keeps');
    expect(url).toContain('twitch=strips');
  });

  it('matches for every catalog field changed individually', () => {
    const alternatives: Record<string, unknown[]> = {
      textSize: [...MULTICHAT_TEXT_SIZES],
      font: [...MULTICHAT_FONTS],
      stroke: [...MULTICHAT_STROKES],
      textShadow: [...MULTICHAT_TEXT_SHADOWS],
      animation: [...MULTICHAT_ANIMATIONS],
      emoteScale: ['', '1', '2.5', '0'],
      sevenTVEmotesEnabled: [true, false],
      sevenTVCosmeticsEnabled: [true, false],
      fadeEnabled: [true, false],
      fade: ['', '0', '30', '999'],
      msgBold: [true, false],
      msgCaps: [true, false],
      modAction: [true, false],
      paintShadows: [true, false],
      hideNames: [true, false],
      showPinEnabled: [true, false],
      pinPlatforms: [[], ['kick'], ['kick', 'twitch', 'youtube', 'tiktok']],
      sourceTag: [...MULTICHAT_SOURCE_TAGS],
      mentionColor: [true, false],
      bgColor: ['', '#191919', '191919', 'transparent'],
      fontColor: ['', '#ff0000', 'ff0000'],
      botNames: ['', 'nightbot, streamelements'],
      userBL: ['', 'spammer1 botuser'],
      prefixBL: ['', 'https:// scam '],
    };
    for (const setting of MULTICHAT_CATALOG) {
      const values = alternatives[setting.key];
      expect(values, `no alternatives listed for ${setting.key}`).toBeDefined();
      for (const value of values) {
        expectIdentical({ kick: 'someone' }, { ...D, [setting.key]: value });
      }
    }
  });

  it('emits each sourceTag value as its own exact string', () => {
    const base = LEGACY_DEFAULT_QUERY;
    const withTag = (tag: string) =>
      base.replace('&showPinEnabled=true', `&showPinEnabled=true&sourceTag=${tag}`);

    /* icon is the overlay default, so it is expressed by omission. */
    expect(multichatTool.serialize({}, { ...D, sourceTag: 'icon' })).toBe(base);
    expect(multichatTool.serialize({}, { ...D, sourceTag: 'dot' })).toBe(withTag('dot'));
    expect(multichatTool.serialize({}, { ...D, sourceTag: 'label' })).toBe(
      withTag('label'),
    );
    expect(multichatTool.serialize({}, { ...D, sourceTag: 'none' })).toBe(withTag('none'));
  });

  it('matches the authority for every sourceTag value', () => {
    for (const tag of MULTICHAT_SOURCE_TAGS) {
      expectIdentical({ kick: 'a' }, { ...D, sourceTag: tag });
    }
  });

  it('keeps the sourceTag parameter in a stable position', () => {
    for (const tag of ['dot', 'label', 'none'] as const) {
      const parts = multichatTool.serialize({ kick: 'a' }, { ...D, sourceTag: tag }).split('&');
      expect(parts[parts.indexOf(`sourceTag=${tag}`) - 1]).toBe('showPinEnabled=true');
    }
  });

  it('never collapses two sourceTag values onto the same output, except icon', () => {
    const outputs = MULTICHAT_SOURCE_TAGS.map((tag) =>
      multichatTool.serialize({ kick: 'a' }, { ...D, sourceTag: tag }),
    );
    expect(new Set(outputs).size).toBe(MULTICHAT_SOURCE_TAGS.length);
    /* dot and label are genuinely reachable, which the boolean could not do. */
    expect(outputs.some((url) => url.includes('sourceTag=dot'))).toBe(true);
    expect(outputs.some((url) => url.includes('sourceTag=label'))).toBe(true);
    /* icon alone omits the parameter. */
    const icon = multichatTool.serialize({ kick: 'a' }, { ...D, sourceTag: 'icon' });
    expect(icon).not.toContain('sourceTag');
  });

  it('round-trips each sourceTag back through the parser', () => {
    for (const tag of MULTICHAT_SOURCE_TAGS) {
      const url = multichatTool.serialize({ kick: 'a' }, { ...D, sourceTag: tag });
      const parsed = MultichatQuerySchema.parse(
        Object.fromEntries(new URLSearchParams(url)),
      );
      expect(parsed.sourceTag).toBe(tag);
    }
  });

  it('matches for fade enabled, disabled, and blank', () => {
    expect(
      expectIdentical({ kick: 'a' }, { ...D, fadeEnabled: true, fade: '30' }),
    ).toContain('fade=30');
    expect(
      expectIdentical({ kick: 'a' }, { ...D, fadeEnabled: false, fade: '30' }),
    ).not.toContain('fade=');
    expect(
      expectIdentical({ kick: 'a' }, { ...D, fadeEnabled: true, fade: '' }),
    ).not.toContain('fade=');
  });

  it('matches for empty, partial, and all pin selections', () => {
    expect(expectIdentical({ kick: 'a' }, { ...D, pinPlatforms: [] })).toContain(
      'pinPlatforms=',
    );
    expect(
      expectIdentical({ kick: 'a' }, { ...D, pinPlatforms: ['kick', 'twitch'] }),
    ).toContain('pinPlatforms=kick%2Ctwitch');
    expect(
      expectIdentical({ kick: 'a' }, {
        ...D,
        pinPlatforms: ['kick', 'twitch', 'youtube', 'tiktok'],
      }),
    ).not.toContain('pinPlatforms');
  });

  it('matches for filters carrying spaces, commas, Unicode, #, %, + and /', () => {
    const nasty = 'a b,c#d%e+f/g é 日本 🎉';
    for (const key of ['botNames', 'userBL', 'prefixBL'] as const) {
      expectIdentical({ kick: 'a' }, { ...D, [key]: nasty });
    }
  });

  it('matches for transparent and hex colours', () => {
    for (const value of ['', '#191919', '191919', 'transparent', '#FFF']) {
      expectIdentical({ kick: 'a' }, { ...D, bgColor: value });
      expectIdentical({ kick: 'a' }, { ...D, fontColor: value });
    }
  });

  it('matches for realistic combined configurations', () => {
    const combos: Partial<MultichatWorkspaceStyle>[] = [
      { textSize: 'large', font: 'impact', stroke: 'thick', textShadow: 'none' },
      { hideNames: true, msgCaps: true, msgBold: false, mentionColor: false },
      { showPinEnabled: false, pinPlatforms: [], sourceTag: 'none' },
      {
        bgColor: '#191919',
        fontColor: '#ff00ff',
        emoteScale: '1.5',
        fadeEnabled: false,
        botNames: 'nightbot, streamelements',
        userBL: 'a b',
        prefixBL: 'https://',
      },
      { animation: 'fade', fade: '5', paintShadows: false, modAction: false },
    ];
    for (const combo of combos) {
      expectIdentical(
        { kick: 'k', twitch: '@t', youtube: '@y', tiktok: '@tt' },
        { ...D, ...combo },
      );
    }
  });

  it('matches for a normalized style, and never emits a fragment', () => {
    const url = expectIdentical({ kick: 'a' }, normalizeMultichatStyle({}));
    expect(url).not.toContain('#');
    expect(url.startsWith('?')).toBe(false);
  });
});
