/* /tools/multichat — the registered tool rendered by the real workspace shell.
 *
 * These exercise the actual descriptor and the actual components, not a stub.
 * The load-bearing claim is URL identity: whatever the workspace shows must be
 * the exact string buildMultichatQuery produces, because that string is what
 * lands in an OBS browser source. Parsed-parameter comparisons would not catch
 * order or encoding drift, so every URL assertion compares complete strings.
 *
 * The second claim is that Batch 5A ships no OAuth surface: no connect control,
 * no connection id anywhere, and no fragment in any generated URL.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import GeneratorWorkspace from '@/components/workspace/GeneratorWorkspace';
import { PREVIEW_DEBOUNCE_MS } from '@/components/workspace/OverlayPreviewFrame';
import WorkspaceNav from '@/components/workspace/WorkspaceNav';
import {
  MULTICHAT_WORKSPACE_DEFAULTS,
  buildMultichatQuery,
  type MultichatChannels,
  type MultichatPlatform,
  type MultichatWorkspaceStyle,
} from '@/lib/multichatConfig';
import { multichatTool } from '@/lib/tools/multichat/config';
import { MULTICHAT_CATALOG } from '@/lib/tools/multichat/settings';
import { counterTool } from '@/lib/tools/counter/config';
import { TOOLS, TOOL_IDS, findTool } from '@/lib/tools/registry';

const BASE = 'https://example.com';
const D = MULTICHAT_WORKSPACE_DEFAULTS;

/** Empty channel state, the shape the authoritative serializer requires. */
const NO_CHANNELS: MultichatChannels = { kick: '', twitch: '', youtube: '', tiktok: '' };

/** The URL the workspace must produce, built by the authoritative serializer. */
const expectedUrl = (
  channels: Partial<Record<MultichatPlatform, string>>,
  style: MultichatWorkspaceStyle = D,
) => `${BASE}/multichat?${buildMultichatQuery({ ...NO_CHANNELS, ...channels }, style)}`;

const mount = () => render(<GeneratorWorkspace tool={multichatTool} baseUrl={BASE} />);
const urlField = () => screen.getByLabelText('Overlay URL') as HTMLInputElement;
const frame = () => document.querySelector('iframe');
const settle = () => act(() => void vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS + 10));

/** Query by id — 'Kick' labels both a channel field and a pin checkbox. */
const byId = (id: string) => document.getElementById(id) as HTMLElement;
const channel = (key: string) => byId(`channel-${key}`) as HTMLInputElement;
const setting = (key: string) => byId(`setting-${key}`) as HTMLInputElement;
const type = (el: HTMLElement, value: string) =>
  fireEvent.change(el, { target: { value } });

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('registration', () => {
  it('holds exactly multichat and counter, in that order', () => {
    expect(TOOLS.map((tool) => tool.id)).toEqual(['multichat', 'counter']);
    expect(TOOL_IDS).toEqual(['multichat', 'counter']);
  });

  it('keeps tool ids unique', () => {
    expect(new Set(TOOL_IDS).size).toBe(TOOL_IDS.length);
  });

  it('resolves findTool to the real descriptor, not a copy', () => {
    /* Identity checked inside the callback, so the descriptor's type parameters
     * are never re-widened on the way out. */
    expect(findTool('multichat')?.use((tool) => Object.is(tool, multichatTool))).toBe(true);
    expect(findTool('multichat')?.use((tool) => tool.catalog)).toBe(MULTICHAT_CATALOG);
    expect(findTool('multichat')?.use((tool) => tool.defaults)).toBe(
      MULTICHAT_WORKSPACE_DEFAULTS,
    );
  });

  it('emits static paths for both tools and none for an unknown id', () => {
    /* Mirrors getStaticPaths in pages/tools/[tool].tsx, which maps TOOL_IDS. */
    const paths = TOOL_IDS.map((id) => ({ params: { tool: id } }));
    expect(paths).toEqual([
      { params: { tool: 'multichat' } },
      { params: { tool: 'counter' } },
    ]);
    expect(TOOL_IDS).not.toContain('unknown');
    expect(findTool('unknown')).toBeUndefined();
  });

  it('exposes the MultiChat preview height the viewport uses', () => {
    expect(multichatTool.obs).toEqual({ width: 680, height: 280 });
  });
});

describe('navigation', () => {
  const links = () =>
    Array.from(document.querySelectorAll('nav a')).map((a) => ({
      label: a.textContent,
      href: a.getAttribute('href'),
    }));

  it('shows the three approved entries in the approved order', () => {
    render(<WorkspaceNav currentPath="/tools/multichat" />);
    expect(links()).toEqual([
      { label: 'MultiChat', href: '/tools/multichat' },
      { label: 'MultiChat (Classic)', href: '/multichat' },
      { label: 'Viewer Counter', href: '/tools/counter' },
    ]);
  });

  it('never shows two entries both labelled MultiChat', () => {
    render(<WorkspaceNav currentPath="/tools/multichat" />);
    expect(links().filter((l) => l.label === 'MultiChat')).toHaveLength(1);
  });

  it('keeps every label and every href unique', () => {
    render(<WorkspaceNav currentPath="/tools/multichat" />);
    const labels = links().map((l) => l.label);
    const hrefs = links().map((l) => l.href);
    expect(new Set(labels).size).toBe(labels.length);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('retains the classic generator link, the only Twitch-connect path', () => {
    render(<WorkspaceNav currentPath="/tools/multichat" />);
    expect(links().some((l) => l.href === '/multichat')).toBe(true);
  });

  it('marks only the active route as current', () => {
    render(<WorkspaceNav currentPath="/tools/multichat" />);
    const current = Array.from(document.querySelectorAll('nav a[aria-current="page"]'));
    expect(current).toHaveLength(1);
    expect(current[0]?.getAttribute('href')).toBe('/tools/multichat');
  });

  it('marks the counter current on its own route, not MultiChat', () => {
    render(<WorkspaceNav currentPath="/tools/counter" />);
    const current = document.querySelector('nav a[aria-current="page"]');
    expect(current?.getAttribute('href')).toBe('/tools/counter');
  });
});

describe('catalog rendering', () => {
  const KEYS = MULTICHAT_CATALOG.map((s) => s.key);

  it('has 24 settings and renders a control for every one', () => {
    mount();
    expect(MULTICHAT_CATALOG).toHaveLength(24);
    for (const key of KEYS) expect(setting(key)).toBeTruthy();
  });

  it('renders them in exact catalog order', () => {
    mount();
    const wanted = new Set(KEYS.map((key) => `setting-${key}`));
    const rendered = Array.from(document.querySelectorAll('[id^="setting-"]'))
      .map((el) => el.id)
      .filter((id) => wanted.has(id));
    expect(rendered).toEqual(KEYS.map((key) => `setting-${key}`));
  });

  it('uses five of the six control types, deliberately not number', () => {
    /* `fade` and `emoteScale` are the only numeric-looking parameters, and both
     * are `text` because '' independently suppresses the parameter — a number
     * control cannot express "blank". So `number` stays unexercised here rather
     * than being forced on, which would change generated URLs. */
    expect(new Set(MULTICHAT_CATALOG.map((s) => s.type))).toEqual(
      new Set(['toggle', 'select', 'text', 'color', 'multiselect']),
    );
    expect(MULTICHAT_CATALOG.some((s) => s.type === 'number')).toBe(false);
    expect(MULTICHAT_CATALOG.filter((s) => s.key === 'fade')[0]?.type).toBe('text');
  });

  it('puts no channel field in the centre settings panel', () => {
    mount();
    const panel = document.querySelector('[aria-labelledby="tool-config-heading"]');
    expect(panel).not.toBeNull();
    expect(panel?.querySelectorAll('[id^="channel-"]')).toHaveLength(0);
    for (const platform of multichatTool.platforms) {
      expect(panel?.querySelector(`#channel-${platform.key}`)).toBeNull();
    }
  });

  it('links the sourceTag compatibility copy to its control', () => {
    mount();
    const desc = byId('setting-sourceTag-desc');
    expect(desc.textContent).toContain('Platform icon');
    expect(desc.textContent).toContain('single configured platform shows no marker');
    expect(setting('sourceTag').getAttribute('aria-describedby')).toContain(
      'setting-sourceTag-desc',
    );
  });

  it('links the Twitch-pin copy to its control without claiming a connection', () => {
    mount();
    const desc = byId('setting-pinPlatforms-desc');
    expect(desc.textContent).toContain('require a connected Twitch account');
    expect(desc.textContent).toContain('MultiChat (Classic)');
    expect(setting('pinPlatforms').getAttribute('aria-describedby')).toContain(
      'setting-pinPlatforms-desc',
    );
  });

  it('leaves Twitch unselected in the pin defaults', () => {
    mount();
    expect(D.pinPlatforms).not.toContain('twitch');
    expect((byId('setting-pinPlatforms-twitch') as HTMLInputElement).checked).toBe(false);
  });

  it('explains that a channel is required, without disabling the actions', () => {
    mount();
    expect(screen.getByText('Enter at least one channel to see a live preview.')).toBeTruthy();
    fireEvent.click(screen.getByText('Copy overlay URL'));
    expect(screen.getByText('Enter at least one channel first.')).toBeTruthy();
  });

  it('offers all four sourceTag modes', () => {
    mount();
    const options = Array.from(
      (setting('sourceTag') as unknown as HTMLSelectElement).options,
    ).map((o) => o.value);
    expect(options).toEqual(['icon', 'dot', 'label', 'none']);
  });
});

describe('channels', () => {
  it('renders the four fields in descriptor order', () => {
    mount();
    /* Inputs only — TextInput also renders a `${id}-error` element per field. */
    const ids = Array.from(document.querySelectorAll('input[id^="channel-"]')).map(
      (el) => el.id,
    );
    expect(ids).toEqual([
      'channel-kick',
      'channel-twitch',
      'channel-youtube',
      'channel-tiktok',
    ]);
    expect(multichatTool.platforms.map((p) => p.key)).toEqual([
      'kick',
      'twitch',
      'youtube',
      'tiktok',
    ]);
  });

  it('uses the descriptor labels and placeholders', () => {
    mount();
    for (const platform of multichatTool.platforms) {
      const field = channel(platform.key);
      expect(field.placeholder).toBe(platform.placeholder);
      /* Matched by `for`, not by getByLabelText: 'Kick' also labels a pin
       * checkbox, so the accessible name alone is ambiguous by design. */
      expect(
        document.querySelector(`label[for="channel-${platform.key}"]`)?.textContent,
      ).toBe(platform.label);
    }
    expect(multichatTool.platforms.map((p) => p.placeholder)).toEqual([
      'Channel name',
      'Channel name',
      '@handle',
      '@username',
    ]);
  });

  it('keeps the leading @ on Kick and strips it on the other three', () => {
    expect(multichatTool.platforms[0]?.normalize('@name')).toBe('@name');
    for (const platform of multichatTool.platforms.slice(1)) {
      expect(platform.normalize('@name')).toBe('name');
    }
  });

  it('treats empty and whitespace-only values as unconfigured', () => {
    mount();
    type(channel('kick'), '   ');
    expect(frame()).toBeNull();
    expect(multichatTool.configuredPlatforms({ kick: '   ' })).toEqual([]);
  });

  it('lists configured platforms in descriptor order, not entry order', () => {
    expect(
      multichatTool.configuredPlatforms({ tiktok: 'd', kick: 'a', youtube: 'c' }),
    ).toEqual(['kick', 'youtube', 'tiktok']);
  });
});

describe('URL identity with the authoritative serializer', () => {
  it('matches for the unconfigured placeholder state', () => {
    mount();
    expect(urlField().value).toBe(expectedUrl({}));
    /* The kick=yourchannel placeholder is the serializer's own behaviour and is
     * preserved; it is simply not actionable. */
    expect(urlField().value).toContain('kick=yourchannel');
  });

  it('matches for each single platform', () => {
    for (const platform of multichatTool.platforms) {
      mount();
      type(channel(platform.key), 'someone');
      expect(urlField().value).toBe(expectedUrl({ [platform.key]: 'someone' }));
      cleanup();
    }
  });

  it('matches for all four platforms at once', () => {
    mount();
    type(channel('kick'), 'k1');
    type(channel('twitch'), 't1');
    type(channel('youtube'), '@y1');
    type(channel('tiktok'), '@tk1');
    expect(urlField().value).toBe(
      expectedUrl({ kick: 'k1', twitch: 't1', youtube: '@y1', tiktok: '@tk1' }),
    );
  });

  it('matches for every sourceTag value', () => {
    for (const tag of ['icon', 'dot', 'label', 'none'] as const) {
      mount();
      type(channel('kick'), 'k');
      type(setting('sourceTag'), tag);
      expect(urlField().value).toBe(expectedUrl({ kick: 'k' }, { ...D, sourceTag: tag }));
      cleanup();
    }
  });

  it('omits sourceTag entirely for icon and emits it for the rest', () => {
    mount();
    type(channel('kick'), 'k');
    expect(urlField().value).not.toContain('sourceTag');
    for (const tag of ['dot', 'label', 'none'] as const) {
      type(setting('sourceTag'), tag);
      expect(urlField().value).toContain(`sourceTag=${tag}`);
    }
  });

  it('matches with fade enabled and with it turned off', () => {
    mount();
    type(channel('kick'), 'k');
    expect(urlField().value).toBe(expectedUrl({ kick: 'k' }, { ...D, fadeEnabled: true }));
    expect(urlField().value).toContain('fade=30');

    fireEvent.click(setting('fadeEnabled'));
    expect(urlField().value).toBe(expectedUrl({ kick: 'k' }, { ...D, fadeEnabled: false }));
    expect(urlField().value).not.toContain('fade=');
  });

  it('matches with a blank fade duration, which also suppresses it', () => {
    mount();
    type(channel('kick'), 'k');
    type(setting('fade'), '');
    expect(urlField().value).toBe(expectedUrl({ kick: 'k' }, { ...D, fade: '' }));
    expect(urlField().value).not.toContain('fade=');
  });

  it('matches for empty, partial, and full pin selections', () => {
    const cases: readonly MultichatPlatform[][] = [
      [],
      ['kick'],
      ['kick', 'twitch'],
      ['kick', 'twitch', 'youtube', 'tiktok'],
    ];
    for (const pins of cases) {
      mount();
      type(channel('kick'), 'k');
      /* Click from the default set to the target set, so the assertion goes
       * through real control interaction rather than seeded state. */
      for (const p of multichatTool.platforms.map((x) => x.key)) {
        const box = byId(`setting-pinPlatforms-${p}`) as HTMLInputElement;
        if (box.checked !== pins.includes(p)) fireEvent.click(box);
      }
      expect(urlField().value).toBe(
        expectedUrl({ kick: 'k' }, { ...D, pinPlatforms: pins }),
      );
      cleanup();
    }
  });

  it('matches for both colour fields, hash stripped by the serializer', () => {
    mount();
    type(channel('kick'), 'k');
    type(setting('bgColor'), '#ff0000');
    type(setting('fontColor'), '#00ff00');
    expect(urlField().value).toBe(
      expectedUrl({ kick: 'k' }, { ...D, bgColor: '#ff0000', fontColor: '#00ff00' }),
    );
    expect(urlField().value).toContain('bgColor=ff0000');
    expect(urlField().value).toContain('fontColor=00ff00');
    /* The '#' a user typed is stripped into the parameter value, never left to
     * start a fragment. */
    expect(urlField().value).not.toContain('#');
  });

  it('matches for transparent, passed through verbatim', () => {
    mount();
    type(channel('kick'), 'k');
    type(setting('bgColor'), 'transparent');
    expect(urlField().value).toBe(expectedUrl({ kick: 'k' }, { ...D, bgColor: 'transparent' }));
  });

  it('matches for Unicode and reserved characters in the filters', () => {
    const botNames = 'ñitro, 日本, a&b';
    const userBL = 'user?one user=two';
    const prefixBL = '! # % + &';
    mount();
    type(channel('kick'), 'k');
    type(setting('botNames'), botNames);
    type(setting('userBL'), userBL);
    type(setting('prefixBL'), prefixBL);
    expect(urlField().value).toBe(
      expectedUrl({ kick: 'k' }, { ...D, botNames, userBL, prefixBL }),
    );
    /* A '#' typed into a filter is percent-encoded into the query, so it can
     * never be mistaken for a fragment delimiter. */
    expect(urlField().value).toContain('%23');
    expect(urlField().value).not.toContain('#');
  });

  it('keeps space-separated filter text as typed, not CSV', () => {
    mount();
    type(channel('kick'), 'k');
    type(setting('userBL'), 'one two three');
    expect(new URL(urlField().value).searchParams.get('userBL')).toBe('one two three');
    expect(urlField().value).not.toContain('one,two');
  });
});

describe('typed workspace state', () => {
  /** One representative per control type, with the runtime type it must keep. */
  it('carries each control type into state with its own runtime type', () => {
    mount();
    type(channel('kick'), 'k');

    fireEvent.click(setting('msgCaps')); // toggle → boolean
    type(setting('textSize'), 'large'); // select → string
    type(setting('emoteScale'), '1.5'); // text  → string, not number
    type(setting('fontColor'), '#abcdef'); // color → string
    fireEvent.click(byId('setting-pinPlatforms-twitch')); // multiselect → array

    expect(urlField().value).toBe(
      expectedUrl(
        { kick: 'k' },
        {
          ...D,
          msgCaps: true,
          textSize: 'large',
          emoteScale: '1.5',
          fontColor: '#abcdef',
          pinPlatforms: ['kick', 'twitch', 'youtube', 'tiktok'],
        },
      ),
    );
    /* emoteScale stayed a string: a number would have dropped the trailing
     * precision distinction the serializer passes through verbatim. */
    expect(new URL(urlField().value).searchParams.get('emoteScale')).toBe('1.5');
  });

  it('normalizes a multiselect into declaration order, still an array', () => {
    expect(multichatTool.normalize({ pinPlatforms: ['tiktok', 'kick'] }).pinPlatforms).toEqual([
      'kick',
      'tiktok',
    ]);
    expect(Array.isArray(multichatTool.normalize({}).pinPlatforms)).toBe(true);
  });

  it('serializes through the authoritative serializer, not a local builder', () => {
    const channels = { kick: 'a', twitch: '@b' };
    expect(multichatTool.serialize(channels, D)).toBe(
      buildMultichatQuery({ ...NO_CHANNELS, ...channels }, D),
    );
  });
});

describe('one final URL feeds every consumer', () => {
  it('gives the iframe the exact string in the field', () => {
    mount();
    type(channel('kick'), 'someone');
    settle();
    expect(frame()?.getAttribute('src')).toBe(urlField().value);
  });

  it('copies the exact string in the field', () => {
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    mount();
    type(channel('kick'), 'someone');
    fireEvent.click(screen.getByText('Copy overlay URL'));
    expect(writeText).toHaveBeenCalledWith(urlField().value);
    vi.unstubAllGlobals();
  });

  it('opens the exact string in the field', () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    mount();
    type(channel('kick'), 'someone');
    fireEvent.click(screen.getByText('Open in new tab'));
    expect(open).toHaveBeenCalledWith(urlField().value, '_blank', 'noopener,noreferrer');
    vi.unstubAllGlobals();
  });

  it('keeps all four identical after a settings change, not just at first paint', () => {
    const writeText = vi.fn();
    const open = vi.fn();
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    vi.stubGlobal('open', open);
    mount();
    type(channel('kick'), 'someone');
    type(setting('sourceTag'), 'dot');
    type(setting('bgColor'), '#123456');
    settle();
    const shown = urlField().value;
    fireEvent.click(screen.getByText('Copy overlay URL'));
    fireEvent.click(screen.getByText('Open in new tab'));
    expect(frame()?.getAttribute('src')).toBe(shown);
    expect(writeText).toHaveBeenCalledWith(shown);
    expect(open).toHaveBeenCalledWith(shown, '_blank', 'noopener,noreferrer');
    expect(shown).toBe(expectedUrl({ kick: 'someone' }, { ...D, sourceTag: 'dot', bgColor: '#123456' }));
    vi.unstubAllGlobals();
  });
});

describe('preview lifecycle', () => {
  it('renders no iframe while unconfigured, even after the debounce', () => {
    mount();
    settle();
    expect(frame()).toBeNull();
  });

  it('shows the placeholder URL without making it actionable', () => {
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    mount();
    expect(urlField().value).toContain('kick=yourchannel');
    fireEvent.click(screen.getByText('Copy overlay URL'));
    expect(writeText).not.toHaveBeenCalled();
    expect(frame()).toBeNull();
    vi.unstubAllGlobals();
  });

  it('mounts only at the debounce boundary', () => {
    mount();
    type(channel('kick'), 'someone');
    act(() => void vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS - 1));
    expect(frame()).toBeNull();
    act(() => void vi.advanceTimersByTime(2));
    expect(frame()).not.toBeNull();
  });

  it('cancels a pending mount when the URL changes again', () => {
    mount();
    type(channel('kick'), 'a');
    act(() => void vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS - 50));
    type(channel('kick'), 'ab');
    act(() => void vi.advanceTimersByTime(60));
    expect(frame()).toBeNull();
    settle();
    expect(frame()?.getAttribute('src')).toBe(urlField().value);
  });

  it('removes the iframe immediately when the last channel is cleared', () => {
    mount();
    type(channel('kick'), 'someone');
    settle();
    expect(frame()).not.toBeNull();
    type(channel('kick'), '');
    expect(frame()).toBeNull();
  });

  it('keeps the iframe while another channel remains configured', () => {
    mount();
    type(channel('kick'), 'a');
    type(channel('twitch'), 'b');
    settle();
    type(channel('kick'), '');
    expect(frame()).not.toBeNull();
  });

  it('never mounts after unmount, so leaving the route starts nothing', () => {
    mount();
    type(channel('kick'), 'someone');
    cleanup();
    act(() => void vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS * 4));
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('destroys the iframe on unmount', () => {
    mount();
    type(channel('kick'), 'someone');
    settle();
    expect(frame()).not.toBeNull();
    cleanup();
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('sizes the preview with the descriptor height of 280px', () => {
    mount();
    type(channel('kick'), 'someone');
    settle();
    expect(frame()?.getAttribute('height') ?? frame()?.style.height).toBe('280px');
    expect(frame()?.style.width).toBe('100%');
  });

  it('uses only a timeout — no interval and no randomness', () => {
    const interval = vi.spyOn(globalThis, 'setInterval');
    const random = vi.spyOn(Math, 'random');
    mount();
    type(channel('kick'), 'someone');
    settle();
    expect(interval).not.toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
    interval.mockRestore();
    random.mockRestore();
  });
});

describe('OAuth boundary — Batch 5A ships none of it', () => {
  const text = () => document.body.textContent ?? '';

  it('declares no context, so it contributes no fragment', () => {
    expect(multichatTool.context).toBeUndefined();
  });

  it('renders no connect, disconnect, or connection-status control', () => {
    mount();
    /* Asserted against interactive controls, not body text: the pinPlatforms
     * description legitimately mentions connecting Twitch, and must, since
     * explaining the requirement is how this batch handles it. What must not
     * exist is anything clickable that claims to do it. */
    const controls = [
      ...Array.from(document.querySelectorAll('button')),
      ...Array.from(document.querySelectorAll('a')),
    ].map((el) => el.textContent ?? '');
    for (const label of controls) {
      expect(label).not.toMatch(/connect|disconnect|sign in|log in|authorize/i);
    }
    expect(screen.queryByText('Disconnect')).toBeNull();
    expect(text()).not.toMatch(/connected as|not connected|connection id/i);
  });

  it('links to no OAuth endpoint from the workspace', () => {
    mount();
    const hrefs = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    for (const href of hrefs) expect(href ?? '').not.toContain('/api/twitch');
  });

  it('puts no connection id in the DOM', () => {
    mount();
    type(channel('twitch'), 'someone');
    expect(text()).not.toContain('twitchConnectionId');
    expect(document.body.innerHTML).not.toContain('twitchConnectionId');
  });

  it('emits no fragment and no trailing hash in any generated URL', () => {
    mount();
    expect(urlField().value).not.toContain('#');
    type(channel('twitch'), 'someone');
    type(setting('sourceTag'), 'label');
    fireEvent.click(byId('setting-pinPlatforms-twitch'));
    settle();
    expect(urlField().value).not.toContain('#');
    expect(urlField().value.endsWith('#')).toBe(false);
    expect(frame()?.getAttribute('src')).not.toContain('#');
  });

  it('always generates a /multichat overlay URL, never a workspace URL', () => {
    mount();
    type(channel('kick'), 'k');
    expect(urlField().value.startsWith(`${BASE}/multichat?`)).toBe(true);
    expect(urlField().value).not.toContain('/tools/');
  });

  it('keeps the preview background out of the URL', () => {
    mount();
    type(channel('kick'), 'k');
    const before = urlField().value;
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(urlField().value).toBe(before);
    expect(urlField().value).not.toContain('background');
  });
});

describe('counter regression', () => {
  it('leaves the counter descriptor and its URL untouched', () => {
    expect(counterTool.id).toBe('counter');
    expect(counterTool.overlayRoute).toBe('/counter');
    expect(counterTool.catalog).toHaveLength(6);
    expect(counterTool.context).toBeUndefined();
  });

  it('gives the counter a preview note distinct from MultiChat', () => {
    expect(counterTool.previewNote).not.toBe(multichatTool.previewNote);
    expect(counterTool.previewNote).toContain('/counter');
    expect(multichatTool.previewNote).toContain('/multichat');
  });

  it('renders the MultiChat note on /tools/multichat and no counter prose', () => {
    mount();
    expect(screen.getByText(multichatTool.previewNote as string)).toBeTruthy();
    expect(document.body.textContent).not.toContain('/counter');
    expect(document.body.textContent).not.toContain('live counts');
  });
});
