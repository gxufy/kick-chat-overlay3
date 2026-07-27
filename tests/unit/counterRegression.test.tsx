/* The Viewer Counter, after the MultiChat migration ran through the same shell.
 *
 * Batches 5A–6 added generic runtime state, per-option gating, URL fragments,
 * draft persistence, and OAuth to the workspace the counter also renders in.
 * None of it is the counter's, and the counter has no way to notice it exists.
 * This file is the guard for that: it asserts absence, which is exactly what
 * the counter's own feature tests cannot do, because they assert presence of
 * counter behaviour and would still pass if a Twitch panel appeared beside it.
 *
 * The load-bearing claim is byte identity: a counter URL built by the workspace
 * must equal one built by lib/viewerCounterConfig's own serializer, because
 * that is what /counter parses and what is already in OBS scenes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import GeneratorWorkspace from '@/components/workspace/GeneratorWorkspace';
import { PREVIEW_DEBOUNCE_MS } from '@/components/workspace/OverlayPreviewFrame';
import { counterTool } from '@/lib/tools/counter/config';
import { COUNTER_CATALOG } from '@/lib/tools/counter/settings';
import {
  DEFAULT_STYLE,
  buildViewerCounterQuery,
  type ViewerPlatform,
} from '@/lib/viewerCounterConfig';

const BASE = 'https://example.com';

const NO_CHANNELS: Record<ViewerPlatform, string> = {
  twitch: '',
  youtube: '',
  kick: '',
  tiktok: '',
};

const expectedUrl = (
  channels: Partial<Record<ViewerPlatform, string>>,
  style = DEFAULT_STYLE,
) =>
  `${BASE}/counter?${buildViewerCounterQuery({ ...NO_CHANNELS, ...channels }, style)}`;

const mount = () => render(<GeneratorWorkspace tool={counterTool} baseUrl={BASE} />);
const urlField = () => screen.getByLabelText('Overlay URL') as HTMLInputElement;
const settle = () => act(() => void vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS + 10));

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

describe('rendered workspace shows no connection surface', () => {
  it('renders no connect or disconnect control', () => {
    mount();
    expect(screen.queryByText('Connect Twitch')).toBeNull();
    expect(screen.queryByText('Disconnect')).toBeNull();
  });

  it('never names Twitch outside its own channel field label', () => {
    mount();
    const labels = screen
      .getAllByText(/twitch/i)
      .map((node) => node.textContent?.trim() ?? '');
    expect(labels).toEqual(['Twitch']);
  });

  it('renders no gating explanation anywhere', () => {
    mount();
    expect(screen.queryByText(/connect/i)).toBeNull();
    expect(screen.queryByText(/connected account/i)).toBeNull();
  });
});

describe('URL identity with the overlay serializer', () => {
  it('matches for defaults with one channel', () => {
    mount();
    fireEvent.change(screen.getByLabelText('Twitch'), { target: { value: 'somechannel' } });
    expect(urlField().value).toBe(expectedUrl({ twitch: 'somechannel' }));
  });

  it('matches for every channel filled', () => {
    mount();
    for (const [label, value] of [
      ['Twitch', 'a'],
      ['YouTube', 'b'],
      ['Kick', 'c'],
      ['TikTok', 'd'],
    ] as const) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    expect(urlField().value).toBe(
      expectedUrl({ twitch: 'a', youtube: 'b', kick: 'c', tiktok: 'd' }),
    );
  });

  it('matches after a setting is changed', () => {
    mount();
    fireEvent.change(screen.getByLabelText('Twitch'), { target: { value: 'somechannel' } });
    fireEvent.click(screen.getByLabelText('Combined total'));
    const style = { ...DEFAULT_STYLE, combined: !DEFAULT_STYLE.combined };
    expect(urlField().value).toBe(expectedUrl({ twitch: 'somechannel' }, style));
  });

  it('carries no fragment, whatever is configured', () => {
    mount();
    fireEvent.change(screen.getByLabelText('Twitch'), { target: { value: 'somechannel' } });
    fireEvent.click(screen.getByLabelText('Combined total'));
    expect(urlField().value).not.toContain('#');
  });

  it('loads that exact URL in the preview frame', () => {
    mount();
    fireEvent.change(screen.getByLabelText('Twitch'), { target: { value: 'somechannel' } });
    settle();
    expect(document.querySelector('iframe')?.getAttribute('src')).toBe(
      expectedUrl({ twitch: 'somechannel' }),
    );
  });

  it('points the preview at /counter, never /multichat', () => {
    mount();
    fireEvent.change(screen.getByLabelText('Kick'), { target: { value: 'somechannel' } });
    settle();
    const src = document.querySelector('iframe')?.getAttribute('src') ?? '';
    expect(src.startsWith(`${BASE}/counter?`)).toBe(true);
    expect(src).not.toContain('/multichat');
  });
});

describe('draft persistence stays scoped to its own tool', () => {
  it('writes nothing under the MultiChat key', () => {
    mount();
    fireEvent.change(screen.getByLabelText('Twitch'), { target: { value: 'somechannel' } });
    const keys = Object.keys(window.sessionStorage);
    expect(keys.some((key) => key.includes('multichat'))).toBe(false);
  });
});
