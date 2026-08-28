/* Current Classic generator contract.
 *
 * Pins and the Twitch pin-only OAuth surface are retired. The catalog retains
 * hidden compatibility descriptors so old state can normalize safely, while the
 * generator exposes only active controls and always produces pin-free URLs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import ClassicGenerator from '@/components/classic/ClassicGenerator';
import { PREVIEW_DEBOUNCE_MS } from '@/components/workspace/OverlayPreviewFrame';
import { COUNTER_SECTION_ID } from '@/lib/multichatRouting';
import { MULTICHAT_COMMANDS, MULTICHAT_COMMAND_TRIGGER } from '@/lib/multichatCommands';
import { MULTICHAT_OBS_ALTERNATE, MULTICHAT_OBS_SIZE } from '@/features/multichat/obs';
import { multichatTool } from '@/features/multichat/config';
import { counterTool } from '@/features/counter/config';
import { MULTICHAT_CATALOG } from '@/features/multichat/settings';
import { COUNTER_CATALOG } from '@/features/counter/settings';
import { CLASSIC_GENERATOR_CSS } from '@/components/classic/classicStyles';
import { buildMultichatQuery } from '@/lib/multichatConfig';
import { buildViewerCounterQuery } from '@/lib/viewerCounterConfig';

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
const mount = (props: { focusCounter?: boolean } = {}) =>
  render(<ClassicGenerator {...props} />);

const panel = (selector: string) => {
  const el = document.querySelector(selector);
  expect(el, `${selector} is missing`).not.toBeNull();
  return el as HTMLElement;
};

const typeChannel = (platform: string, value: string) =>
  fireEvent.change(document.getElementById(`channel-${platform}`)!, {
    target: { value },
  });

const chatUrl = () =>
  within(panel('.panel-chat-output')).getByLabelText('Generated MultiChat overlay URL')
    .textContent ?? '';
const counterUrl = () =>
  within(panel('.panel-counter-output')).getByLabelText('Generated viewer counter URL')
    .textContent ?? '';
const settle = () => act(() => void vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS + 10));

beforeEach(() => {
  vi.useFakeTimers();
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.location.hash = '';
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Classic identity and layout', () => {
  it('renders the branded header, tagline, and four platform chips', () => {
    mount();
    const header = panel('header.header-strip');
    expect(header.textContent).toContain('multichat-gxufy');
    expect(header.textContent).toContain('Every chat. One overlay. No login.');
    expect(header.querySelector('img.header-logo')).not.toBeNull();
    expect(Array.from(header.querySelectorAll('.platform-chip')).map((chip) => chip.textContent))
      .toEqual(['Kick', 'Twitch', 'YouTube', 'TikTok']);
  });

  it('keeps one shared channel card and the six-card tool grid order', () => {
    mount();
    expect(panel('.platform-inputs').querySelectorAll('.platform-input'))
      .toHaveLength(multichatTool.platforms.length);
    const grid = document.querySelector('.tool-grid')!;
    expect(Array.from(grid.children).map((child) => child.className)).toEqual([
      'card panel-chat-output',
      'card panel-chat-settings',
      'card panel-counter-output',
      'card panel-counter-settings',
      'card panel-commands',
      'card panel-obs',
    ]);
  });

  it('keeps equal desktop tool columns and a stacked responsive layout', () => {
    expect(CLASSIC_GENERATOR_CSS).toContain(
      'grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)',
    );
    expect(CLASSIC_GENERATOR_CSS).toContain('"chat-output counter-output"');
    expect(CLASSIC_GENERATOR_CSS).toContain('"chat-settings counter-settings"');
    expect(CLASSIC_GENERATOR_CSS).toContain('"chat-output"');
    expect(CLASSIC_GENERATOR_CSS).toContain('"counter-output"');
  });

  it('keeps the no-login message in the channel card', () => {
    mount();
    expect(panel('.card.hero').textContent).toMatch(/no login is required for chat or viewer counts/i);
  });
});

describe('catalog-backed controls', () => {
  it('renders every visible MultiChat catalog setting and hides retired pins', () => {
    mount();
    const visible = MULTICHAT_CATALOG.filter((setting) => !setting.hidden);
    for (const setting of visible) {
      expect(
        document.getElementById(`mc-${String(setting.key)}`),
        `mc-${String(setting.key)}`,
      ).not.toBeNull();
    }
    expect(document.getElementById('mc-showPinEnabled')).toBeNull();
    expect(document.getElementById('mc-pinPlatforms')).toBeNull();
    expect(document.getElementById('mc-pinPlatforms-kick')).toBeNull();
  });

  it('renders all six Viewer Counter settings', () => {
    mount();
    expect(COUNTER_CATALOG).toHaveLength(6);
    for (const setting of COUNTER_CATALOG) {
      expect(document.getElementById(`vc-${String(setting.key)}`)).not.toBeNull();
    }
  });

  it('keeps shared setting ids namespaced between chat and counter', () => {
    mount();
    for (const shared of ['stroke', 'textShadow']) {
      expect(document.getElementById(`mc-${shared}`)).not.toBeNull();
      expect(document.getElementById(`vc-${shared}`)).not.toBeNull();
    }
  });

  it('shows the community-badge toggle and defaults it on', () => {
    mount();
    const control = document.getElementById('mc-showCommunityBadges') as HTMLInputElement;
    expect(control).not.toBeNull();
    expect(control.type).toBe('checkbox');
    expect(control.checked).toBe(true);
    expect(
      document.querySelector('label[for="mc-showCommunityBadges"]')?.textContent,
    ).toBe('Show community badges');
  });

  it('reveals fade duration only while fading is enabled', () => {
    mount();
    expect(document.getElementById('mc-fade')).not.toBeNull();
    fireEvent.click(document.getElementById('mc-fadeEnabled')!);
    expect(document.getElementById('mc-fade')).toBeNull();
  });

  it('keeps pin and Twitch connection UI unreachable', () => {
    mount();
    expect(document.querySelector('.classic-conn')).toBeNull();
    expect(document.querySelector('.mc-pin-connect')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Connect Twitch account' })).toBeNull();
  });
});

describe('settings resets', () => {
  it('restores Chat defaults without changing channel or Counter state', () => {
    mount();
    typeChannel('kick', 'gxufy');
    fireEvent.click(document.getElementById('mc-showCommunityBadges')!);
    fireEvent.click(document.getElementById('vc-combined')!);
    const changedCounter = counterUrl();

    fireEvent.click(screen.getByRole('button', { name: 'Reset Chat Settings to Default' }));

    expect((document.getElementById('mc-showCommunityBadges') as HTMLInputElement).checked)
      .toBe(true);
    expect(chatUrl()).toContain('kick=gxufy');
    expect(chatUrl()).not.toContain('showCommunityBadges=false');
    expect(counterUrl()).toBe(changedCounter);
  });

  it('restores Counter defaults including background off and large shadow', () => {
    mount();
    typeChannel('twitch', 'gxufy');
    fireEvent.click(document.getElementById('vc-bg')!);
    fireEvent.click(document.getElementById('vc-textShadow-none')!);

    fireEvent.click(screen.getByRole('button', { name: 'Reset Viewer Settings to Default' }));

    expect((document.getElementById('vc-bg') as HTMLInputElement).checked).toBe(false);
    expect((document.getElementById('vc-textShadow-large') as HTMLInputElement).checked)
      .toBe(true);
    expect(counterUrl()).toContain('twitch=gxufy');
  });
});

describe('authoritative generated URLs', () => {
  it('builds the chat URL with the MultiChat serializer', () => {
    mount();
    typeChannel('kick', 'somechannel');
    expect(chatUrl()).toBe(
      `${BASE}/multichat?${buildMultichatQuery(
        { kick: 'somechannel', twitch: '', youtube: '', tiktok: '' },
        multichatTool.defaults,
      )}`,
    );
  });

  it('builds the counter URL with the Counter serializer', () => {
    mount();
    typeChannel('kick', 'somechannel');
    expect(counterUrl()).toBe(
      `${BASE}/counter?${buildViewerCounterQuery(
        { kick: 'somechannel' },
        counterTool.defaults,
      )}`,
    );
  });

  it('community-badge opt-out reaches the chat URL only', () => {
    mount();
    typeChannel('kick', 'somechannel');
    const counterBefore = counterUrl();
    fireEvent.click(document.getElementById('mc-showCommunityBadges')!);
    expect(chatUrl()).toContain('showCommunityBadges=false');
    expect(counterUrl()).toBe(counterBefore);
  });

  it('never emits retired pin params or a connection fragment', () => {
    mount();
    typeChannel('twitch', 'somechannel');
    expect(chatUrl()).not.toContain('showPinEnabled');
    expect(chatUrl()).not.toContain('pinPlatforms');
    expect(chatUrl()).not.toContain('#');
  });

  it('uses the production preview URLs after debounce', () => {
    mount();
    typeChannel('kick', 'somechannel');
    fireEvent.click(screen.getByRole('tab', { name: 'Live Overlay' }));
    settle();
    expect(
      document.querySelector('iframe[title="Live chat overlay preview"]')?.getAttribute('src'),
    ).toBe(chatUrl());
    expect(
      document.querySelector('[data-testid="counter-live-preview"]')
        ?.getAttribute('data-overlay-url'),
    ).toBe(counterUrl());
  });
});

describe('Copy and Open', () => {
  it('copies and opens exactly the displayed chat URL', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    mount();
    typeChannel('kick', 'somechannel');
    const scope = within(panel('.panel-chat-output'));
    fireEvent.click(scope.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith(chatUrl());
    expect(scope.getByRole('link', { name: 'Open' }).getAttribute('href')).toBe(chatUrl());
  });

  it('copies and opens exactly the displayed counter URL', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    mount();
    typeChannel('kick', 'somechannel');
    const scope = within(panel('.panel-counter-output'));
    fireEvent.click(scope.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith(counterUrl());
    expect(scope.getByRole('link', { name: 'Open' }).getAttribute('href')).toBe(counterUrl());
  });
});

describe('preview backgrounds', () => {
  const bgRadio = (region: 'chat' | 'counter', option: string) =>
    document.getElementById(`${region}-preview-bg-${option}`) as HTMLInputElement;

  it('starts both previews transparent/checker and keeps them independent', () => {
    mount();
    expect(bgRadio('chat', 'checker').checked).toBe(true);
    expect(bgRadio('counter', 'checker').checked).toBe(true);
    fireEvent.click(bgRadio('chat', 'dark'));
    expect(bgRadio('chat', 'dark').checked).toBe(true);
    expect(bgRadio('counter', 'checker').checked).toBe(true);
  });

  it('never serializes preview-only backgrounds', () => {
    mount();
    typeChannel('kick', 'somechannel');
    const before = [chatUrl(), counterUrl()];
    fireEvent.click(bgRadio('chat', 'dark'));
    fireEvent.click(bgRadio('counter', 'light'));
    expect([chatUrl(), counterUrl()]).toEqual(before);
  });
});

describe('Commands and OBS help', () => {
  it('documents every implemented command and the real trigger', () => {
    mount();
    const region = panel('[aria-labelledby="commands-heading"]');
    const rows = Array.from(region.querySelectorAll('tbody tr'));
    expect(rows).toHaveLength(MULTICHAT_COMMANDS.length);
    expect(rows.map((row) => row.querySelector('td')?.textContent))
      .toEqual(MULTICHAT_COMMANDS.map((command) => command.syntax));
    expect(region.textContent).toContain(MULTICHAT_COMMAND_TRIGGER);
  });

  it('documents two separate OBS browser sources and their sizes', () => {
    mount();
    const text = panel('[aria-labelledby="obs-heading"]').textContent ?? '';
    expect(text).toMatch(/two separate browser sources/i);
    expect(text).toContain(`${MULTICHAT_OBS_SIZE.width} × ${MULTICHAT_OBS_SIZE.height}`);
    expect(text).toContain(`${MULTICHAT_OBS_ALTERNATE.width} × ${MULTICHAT_OBS_ALTERNATE.height}`);
    expect(text).toContain(`${counterTool.obs.width} × ${counterTool.obs.height}`);
  });
});

describe('accessibility', () => {
  it('offers a skip link, one h1, and labelled channel inputs', () => {
    mount();
    expect(screen.getByRole('link', { name: 'Skip to the generator' }).getAttribute('href'))
      .toBe('#generator-main');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    for (const platform of multichatTool.platforms) {
      const field = document.getElementById(`channel-${platform.key}`)!;
      expect(document.querySelector(`label[for="${field.id}"]`)).not.toBeNull();
    }
  });

  it('keeps the counter output anchor and scrolls there when requested', () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      value: scrollIntoView,
      configurable: true,
      writable: true,
    });
    mount({ focusCounter: true });
    expect(panel('.panel-counter-output').id).toBe(COUNTER_SECTION_ID);
    expect(scrollIntoView).toHaveBeenCalled();
  });
});
