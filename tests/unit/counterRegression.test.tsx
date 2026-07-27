/* The Viewer Counter, now that it shares a page with MultiChat.
 *
 * The counter used to have a route and a shell to itself. It is now a panel in
 * the Classic generator, beside 24 chat settings, a Twitch connection, OAuth
 * drafts, runtime gating, and URL fragments — none of which are the counter's,
 * and none of which the counter has any way to notice. This file is the guard for
 * that, and the move made it more necessary rather than less: proximity is how
 * machinery leaks.
 *
 * It asserts absence, which is exactly what the counter's own feature tests
 * cannot do — they assert presence of counter behaviour and would still pass if a
 * connection control or a fragment appeared in the counter panel.
 *
 * The load-bearing claim is byte identity: a counter URL built by this page must
 * equal one built by lib/viewerCounterConfig's own serializer, because that is
 * what /counter parses and what is already in OBS scenes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import ClassicGenerator from '@/components/classic/ClassicGenerator';
import { PREVIEW_DEBOUNCE_MS } from '@/components/workspace/OverlayPreviewFrame';
import { counterTool } from '@/lib/tools/counter/config';
import { COUNTER_CATALOG } from '@/lib/tools/counter/settings';
import { workspaceDraftKey } from '@/lib/workspaceStorage';
import {
  DEFAULT_STYLE,
  buildViewerCounterQuery,
  type ViewerPlatform,
} from '@/lib/viewerCounterConfig';

vi.mock('next/head', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

/* The generator reads window.location.origin for its base URL, and jsdom's
   default origin is what the expected URLs below are built from. */
const BASE = 'http://localhost:3000';

const expectedUrl = (
  channels: Partial<Record<ViewerPlatform, string>>,
  style = DEFAULT_STYLE,
) => `${BASE}/counter?${buildViewerCounterQuery(channels, style)}`;

const mount = () => render(<ClassicGenerator />);

const panel = (selector: string) => {
  const el = document.querySelector(selector);
  expect(el, `${selector} is missing`).not.toBeNull();
  return el as HTMLElement;
};

const counterUrl = () =>
  within(panel('.panel-counter-output')).getByLabelText(
    'Generated viewer counter URL',
  ).textContent ?? '';

const counterIframeSrc = () =>
  document
    .querySelector('iframe[title="Live viewer counter preview"]')
    ?.getAttribute('src') ?? '';

const settle = () => act(() => void vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS + 10));

/** Channel fields by id: per-platform setting labels make label lookup ambiguous. */
const typeChannel = (platform: string, value: string) =>
  fireEvent.change(document.getElementById(`channel-${platform}`)!, {
    target: { value },
  });

beforeEach(() => {
  vi.useFakeTimers();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('descriptor declares none of the MultiChat machinery', () => {
  it('declares no runtime', () => {
    expect(counterTool.runtime).toBeUndefined();
  });

  it('declares no context, so no URL it builds can carry a fragment', () => {
    expect(counterTool.context).toBeUndefined();
  });

  it('gates no options, because it has no runtime to gate them on', () => {
    expect(counterTool.runtime?.optionAvailability).toBeUndefined();
  });

  it('keeps its catalog free of disabled and hidden flags', () => {
    for (const setting of COUNTER_CATALOG) {
      expect(setting.disabled).toBeUndefined();
      expect(setting.hidden).toBeUndefined();
    }
  });
});

describe('the rendered counter panels show no connection surface', () => {
  /* Scoped to the counter's two panels. The page as a whole does have a Twitch
     connection — it belongs to chat, and that is the point of the scoping. */
  const counterText = () =>
    `${panel('.panel-counter-output').textContent ?? ''} ${
      panel('.panel-counter-settings').textContent ?? ''
    }`;

  it('renders no connect or disconnect control inside them', () => {
    mount();
    for (const region of ['.panel-counter-output', '.panel-counter-settings']) {
      const scope = within(panel(region));
      expect(scope.queryByText(/^Connect$/)).toBeNull();
      expect(scope.queryByText(/^Disconnect$/)).toBeNull();
      expect(scope.queryByText('Use connected channel')).toBeNull();
    }
  });

  it('never mentions connecting or a connected account in them', () => {
    mount();
    expect(counterText()).not.toMatch(/connect/i);
    expect(counterText()).not.toMatch(/connected account/i);
  });

  it('renders no gating explanation in them', () => {
    mount();
    for (const region of ['.panel-counter-output', '.panel-counter-settings']) {
      expect(panel(region).querySelectorAll('.classic-help.warn')).toHaveLength(0);
      expect(panel(region).querySelectorAll('[disabled]')).toHaveLength(0);
    }
  });

  it('renders exactly the six catalog settings and no more', () => {
    mount();
    const settings = panel('.panel-counter-settings');
    const controls = settings.querySelectorAll('select, input');
    expect(controls).toHaveLength(COUNTER_CATALOG.length);
    for (const setting of COUNTER_CATALOG) {
      expect(
        settings.querySelector(`#vc-${String(setting.key)}`),
        `vc-${String(setting.key)} is missing`,
      ).not.toBeNull();
    }
  });
});

describe('URL identity with the overlay serializer', () => {
  it('matches for defaults with one channel', () => {
    mount();
    typeChannel('twitch', 'somechannel');
    expect(counterUrl()).toBe(expectedUrl({ twitch: 'somechannel' }));
  });

  it('matches for every channel filled', () => {
    mount();
    for (const [platform, value] of [
      ['twitch', 'a'],
      ['youtube', 'b'],
      ['kick', 'c'],
      ['tiktok', 'd'],
    ] as const) {
      typeChannel(platform, value);
    }
    expect(counterUrl()).toBe(
      expectedUrl({ twitch: 'a', youtube: 'b', kick: 'c', tiktok: 'd' }),
    );
  });

  it('matches after a setting is changed', () => {
    mount();
    typeChannel('twitch', 'somechannel');
    fireEvent.click(document.getElementById('vc-combined')!);
    const style = { ...DEFAULT_STYLE, combined: !DEFAULT_STYLE.combined };
    expect(counterUrl()).toBe(expectedUrl({ twitch: 'somechannel' }, style));
  });

  it('carries no fragment, whatever is configured', () => {
    mount();
    typeChannel('twitch', 'somechannel');
    fireEvent.click(document.getElementById('vc-combined')!);
    expect(counterUrl()).not.toContain('#');
  });

  it('loads that exact URL in the preview frame', () => {
    mount();
    typeChannel('twitch', 'somechannel');
    settle();
    expect(counterIframeSrc()).toBe(expectedUrl({ twitch: 'somechannel' }));
  });

  it('points the preview at /counter, never /multichat', () => {
    mount();
    typeChannel('kick', 'somechannel');
    settle();
    const src = counterIframeSrc();
    expect(src.startsWith(`${BASE}/counter?`)).toBe(true);
    expect(src).not.toContain('/multichat');
  });

  it('serializes no chat parameter, however chat is styled', () => {
    mount();
    typeChannel('kick', 'somechannel');
    fireEvent.change(document.getElementById('mc-font')!, { target: { value: 'roboto' } });
    fireEvent.click(document.getElementById('mc-msgBold')!);
    expect(counterUrl()).toBe(expectedUrl({ kick: 'somechannel' }));
  });
});

describe('draft persistence stays scoped to its own tool', () => {
  /* Both tools' drafts are written before an OAuth navigation, so the counter's
     settings survive a round trip the chat side started. Two keys, two style
     objects: what must not happen is one key holding the other's style. */
  it('writes the counter style under the counter key only', () => {
    mount();
    typeChannel('twitch', 'somechannel');
    fireEvent.click(document.getElementById('vc-combined')!);
    // The Connect link is the only thing that persists a draft.
    fireEvent.click(within(panel('.classic-conn')).getByText('Connect'));

    const raw = window.sessionStorage.getItem(workspaceDraftKey(counterTool.id));
    expect(raw, 'no counter draft was written').not.toBeNull();
    const draft = JSON.parse(raw!) as { style: Record<string, unknown> };
    expect(draft.style.combined).toBe(!DEFAULT_STYLE.combined);
    // No MultiChat field reached the counter's draft.
    expect(draft.style).not.toHaveProperty('font');
    expect(draft.style).not.toHaveProperty('msgBold');
    expect(Object.keys(draft.style).sort()).toEqual(Object.keys(DEFAULT_STYLE).sort());
  });
});

describe('the counter starts no pin polling', () => {
  /* "Declares no runtime" above implies this, but only implies it. The failure
     that would matter is a network request, so the request layer is what is
     asserted: a counter panel must never call POST /api/twitch/pins, which is the
     only thing the poller ever calls. Configuring a Twitch channel is the state
     most likely to tempt a shared page into starting pin polling — and the chat
     panel next door is a real poller waiting for a connection. */

  const pinCalls = (fetchSpy: ReturnType<typeof vi.fn>) =>
    fetchSpy.mock.calls.filter(([url]) => String(url).includes('/api/twitch/pins'));

  it('issues no pin request across the generator lifecycle', () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const { unmount } = mount();
    typeChannel('twitch', 'somechannel');
    settle();
    // Well past the poller's 5s floor, so a started poll would have fired.
    act(() => void vi.advanceTimersByTime(30_000));
    expect(pinCalls(fetchSpy)).toEqual([]);

    unmount();
    act(() => void vi.advanceTimersByTime(30_000));
    expect(pinCalls(fetchSpy)).toEqual([]);

    vi.unstubAllGlobals();
  });

  it('renders no pin setting for a poller to be gated on', () => {
    // The MultiChat catalog's twitch pin option is what starts polling there.
    const keys = COUNTER_CATALOG.map((setting) => String(setting.key));
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.filter((key) => /pin/i.test(key))).toEqual([]);
  });

  it('keeps the counter URL free of any pin parameter', () => {
    mount();
    typeChannel('twitch', 'somechannel');
    expect(counterUrl()).not.toMatch(/pin/i);
  });
});
