/* The Viewer Counter, now that it shares a page with MultiChat.
 *
 * The counter used to have a route and a shell to itself. It is now a panel in
 * the Classic generator, beside chat settings, Twitch connection machinery,
 * OAuth drafts, runtime gating, and URL fragments — none of which are the
 * counter's. The load-bearing URL claim remains byte identity: the URL built by
 * this page must equal lib/viewerCounterConfig's serializer because /counter is
 * what users put in OBS. The in-page live preview now consumes that exact URL as
 * configuration without navigating a nested /counter iframe.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import ClassicGenerator from '@/components/classic/ClassicGenerator';
import { PREVIEW_DEBOUNCE_MS } from '@/components/workspace/OverlayPreviewFrame';
import { counterTool } from '@/features/counter/config';
import { COUNTER_CATALOG } from '@/features/counter/settings';
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
vi.mock('@/components/workspace/LiveCounterPreview', () => ({
  default: ({ url, height }: { url: string; height: number }) => (
    <div
      data-testid="counter-live-preview"
      data-overlay-url={url}
      data-preview-height={String(height)}
    />
  ),
}));

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

const livePreviewUrl = () =>
  document
    .querySelector('[data-testid="counter-live-preview"]')
    ?.getAttribute('data-overlay-url') ?? '';

const settle = () =>
  act(() => void vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS + 10));

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
    expect(settings.querySelectorAll('.classic-field')).toHaveLength(
      COUNTER_CATALOG.length,
    );
    for (const setting of COUNTER_CATALOG) {
      expect(
        settings.querySelector(`#vc-${String(setting.key)}`),
        `vc-${String(setting.key)} is missing`,
      ).not.toBeNull();
    }
    for (const input of Array.from(settings.querySelectorAll('select, input'))) {
      expect(input.closest('.classic-field')).not.toBeNull();
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

  it('hands that exact URL to the native live preview', () => {
    mount();
    typeChannel('twitch', 'somechannel');
    settle();
    expect(livePreviewUrl()).toBe(expectedUrl({ twitch: 'somechannel' }));
  });

  it('keeps /counter as the generated OBS route without navigating it in-page', () => {
    mount();
    typeChannel('kick', 'somechannel');
    settle();
    const url = livePreviewUrl();
    expect(url.startsWith(`${BASE}/counter?`)).toBe(true);
    expect(url).not.toContain('/multichat');
    expect(document.querySelector('iframe[src*="/counter"]')).toBeNull();
  });

  it('serializes no chat parameter, however chat is styled', () => {
    mount();
    typeChannel('kick', 'somechannel');
    fireEvent.change(document.getElementById('mc-font')!, {
      target: { value: 'roboto' },
    });
    fireEvent.click(document.getElementById('mc-msgBold')!);
    expect(counterUrl()).toBe(expectedUrl({ kick: 'somechannel' }));
  });
});

describe('draft persistence stays scoped to its own tool', () => {
  it('writes the counter style under the counter key only', () => {
    mount();
    fireEvent.click(document.getElementById('mc-showPinEnabled')!);
    typeChannel('twitch', 'somechannel');
    fireEvent.click(document.getElementById('vc-combined')!);
    fireEvent.click(within(panel('.classic-conn')).getByText('Connect'));

    const raw = window.sessionStorage.getItem(workspaceDraftKey(counterTool.id));
    expect(raw, 'no counter draft was written').not.toBeNull();
    const draft = JSON.parse(raw!) as { style: Record<string, unknown> };
    expect(draft.style.combined).toBe(!DEFAULT_STYLE.combined);
    expect(draft.style).not.toHaveProperty('font');
    expect(draft.style).not.toHaveProperty('msgBold');
    expect(Object.keys(draft.style).sort()).toEqual(Object.keys(DEFAULT_STYLE).sort());
  });
});

describe('the counter starts no pin polling', () => {
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
    act(() => void vi.advanceTimersByTime(30_000));
    expect(pinCalls(fetchSpy)).toEqual([]);

    unmount();
    act(() => void vi.advanceTimersByTime(30_000));
    expect(pinCalls(fetchSpy)).toEqual([]);

    vi.unstubAllGlobals();
  });

  it('renders no pin setting for a poller to be gated on', () => {
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
