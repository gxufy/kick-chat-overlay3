/* The revamped original Classic generator.
 *
 * This is the page a visitor without a channel parameter lands on, and it is the
 * only generator there is. What it has to keep is easy to lose in a refactor and
 * invisible to a typecheck:
 *
 *   - the original Classic identity: the branded header, the platform badges, one
 *     card per section, the compact platform inputs, the two-column control table;
 *   - a chat panel and a Viewer Counter panel, chat first, both reachable without
 *     scrolling past a long settings list;
 *   - all 24 MultiChat settings and all six Counter settings, from the catalogs;
 *   - two authoritative URLs, each identical across Preview, the field, Copy, and
 *     Open;
 *   - Commands and then OBS setup beneath both tools;
 *   - none of the retired Demo interface.
 *
 * DOM order is asserted rather than pixel layout: the desktop arrangement is
 * produced by CSS grid placement over this same tree, and jsdom computes no
 * layout. Order is what a screen reader and a phone actually follow, so it is
 * both the meaningful assertion and the testable one. Screenshots are avoided
 * deliberately — they would fail on a font metric and prove nothing about this.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import ClassicGenerator from '@/components/classic/ClassicGenerator';
import { PREVIEW_DEBOUNCE_MS } from '@/components/workspace/OverlayPreviewFrame';
import { COUNTER_SECTION_ID } from '@/lib/multichatRouting';
import { MULTICHAT_COMMANDS, MULTICHAT_COMMAND_TRIGGER } from '@/lib/multichatCommands';
import { MULTICHAT_OBS_ALTERNATE, MULTICHAT_OBS_SIZE } from '@/lib/tools/multichat/obs';
import { multichatTool } from '@/lib/tools/multichat/config';
import { counterTool } from '@/lib/tools/counter/config';
import { MULTICHAT_CATALOG } from '@/lib/tools/multichat/settings';
import { COUNTER_CATALOG } from '@/lib/tools/counter/settings';
import { buildMultichatQuery } from '@/lib/multichatConfig';
import { buildViewerCounterQuery } from '@/lib/viewerCounterConfig';
import { workspaceDraftKey } from '@/lib/workspaceStorage';

vi.mock('next/head', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

/** jsdom's origin, which the generator reads for its base URL. */
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
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('the original Classic identity', () => {
  it('renders the branded header strip with the wordmark and tagline', () => {
    mount();
    const header = panel('header.header-strip');
    expect(header.textContent).toContain('multichat-gxufy');
    expect(header.textContent).toContain('Every chat. One overlay. No login.');
    expect(header.querySelector('img.header-logo')).not.toBeNull();
  });

  it('renders the four platform badges, in Classic order and colours', () => {
    mount();
    const chips = Array.from(
      panel('header.header-strip').querySelectorAll('.platform-chip'),
    );
    expect(chips.map((chip) => chip.textContent)).toEqual([
      'Kick',
      'Twitch',
      'YouTube',
      'TikTok',
    ]);
    expect(chips.map((chip) => chip.className)).toEqual([
      'platform-chip kick-tag',
      'platform-chip tw-tag',
      'platform-chip yt-tag',
      'platform-chip tt-tag',
    ]);
  });

  it('builds every section as a Classic card, with the hero card first', () => {
    mount();
    const cards = Array.from(document.querySelectorAll('section.card'));
    expect(cards.length).toBeGreaterThanOrEqual(6);
    expect(cards[0]?.className).toContain('hero');
  });

  it('keeps the compact platform inputs with their coloured tag labels', () => {
    mount();
    const inputs = Array.from(panel('.platform-inputs').querySelectorAll('.platform-input'));
    expect(inputs).toHaveLength(multichatTool.platforms.length);
    for (const platform of multichatTool.platforms) {
      const label = document.querySelector(`label[for="channel-${platform.key}"]`);
      expect(label?.className).toContain('platform-tag');
      expect(label?.textContent).toBe(platform.label);
    }
  });

  it('arranges both settings panels as Classic two-column tables', () => {
    mount();
    for (const region of ['.panel-chat-settings', '.panel-counter-settings']) {
      const tables = panel(region).querySelectorAll('.form_table');
      expect(tables.length).toBeGreaterThan(0);
      expect(panel(region).querySelectorAll('.form_col').length).toBeGreaterThan(1);
    }
  });

  it('keeps the Classic pill switch for every toggle', () => {
    mount();
    const wraps = document.querySelectorAll('.toggle-wrap .toggle input[type="checkbox"]');
    expect(wraps.length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.toggle-slider').length).toBe(wraps.length);
  });

  it('keeps the Classic footer credits', () => {
    mount();
    const footer = panel('footer');
    expect(footer.textContent).toContain('multichat-gxufy');
    expect(footer.textContent).toContain('ChatIS');
  });
});

describe('layout order', () => {
  /** Index of a selector among all cards and panels, in DOM order. */
  const order = (selector: string) => {
    const all = Array.from(document.querySelectorAll('section'));
    const target = document.querySelector(selector);
    expect(target, `${selector} is missing`).not.toBeNull();
    return all.indexOf(target as HTMLElement);
  };

  it('puts the chat panel before the Counter panel', () => {
    mount();
    expect(order('.panel-chat-output')).toBeLessThan(order('.panel-counter-output'));
  });

  it('puts the Counter output before the full chat settings list', () => {
    /* The mobile requirement, and the reason DOM order is not the desktop order:
       a phone user must reach the counter without scrolling through 24 chat
       settings. */
    mount();
    expect(order('.panel-counter-output')).toBeLessThan(order('.panel-chat-settings'));
  });

  it('follows the required order end to end', () => {
    mount();
    const sections = Array.from(document.querySelectorAll('section')).map(
      (section) => section.getAttribute('aria-labelledby'),
    );
    expect(sections).toEqual([
      'channels-heading',
      'chat-output-heading',
      'counter-output-heading',
      'chat-settings-heading',
      'counter-settings-heading',
      'commands-heading',
      'obs-heading',
    ]);
  });

  it('places Commands beneath both tools and OBS setup beneath Commands', () => {
    mount();
    const commands = order('[aria-labelledby="commands-heading"]');
    expect(commands).toBeGreaterThan(order('.panel-chat-settings'));
    expect(commands).toBeGreaterThan(order('.panel-counter-settings'));
    expect(order('[aria-labelledby="obs-heading"]')).toBeGreaterThan(commands);
  });

  it('declares the grid areas the desktop arrangement is built from', () => {
    /* jsdom computes no layout, so the assertion is that each panel carries the
       class the stylesheet places — chat left, counter right. */
    mount();
    for (const area of [
      'panel-chat-output',
      'panel-counter-output',
      'panel-chat-settings',
      'panel-counter-settings',
    ]) {
      expect(document.querySelectorAll(`.${area}`)).toHaveLength(1);
    }
    expect(panel('.tool-grid').children).toHaveLength(4);
  });
});

describe('every catalog setting is reachable', () => {
  it('renders all 24 MultiChat settings', () => {
    mount();
    expect(MULTICHAT_CATALOG).toHaveLength(24);
    /* A multiselect is a group of checkboxes, so it has no single control id —
       it is present when its first option is. Both conditional settings (the
       fade duration and the pin platform set) are on by default, so a default
       render must already show all 24. */
    const missing = MULTICHAT_CATALOG.filter((setting) => {
      const key = String(setting.key);
      const id =
        setting.type === 'multiselect'
          ? `mc-${key}-${setting.options[0].value}`
          : `mc-${key}`;
      return document.getElementById(id) === null;
    }).map((setting) => String(setting.key));
    expect(missing).toEqual([]);
  });

  it('renders all six Counter settings', () => {
    mount();
    expect(COUNTER_CATALOG).toHaveLength(6);
    for (const setting of COUNTER_CATALOG) {
      expect(
        document.getElementById(`vc-${String(setting.key)}`),
        `vc-${String(setting.key)}`,
      ).not.toBeNull();
    }
  });

  it('namespaces the two catalogs' + ' shared keys apart', () => {
    /* Both catalogs contain stroke and textShadow. Unprefixed ids would give two
       inputs the same id and point one label at the wrong control. */
    mount();
    for (const shared of ['stroke', 'textShadow']) {
      expect(document.getElementById(`mc-${shared}`)).not.toBeNull();
      expect(document.getElementById(`vc-${shared}`)).not.toBeNull();
    }
  });

  it('labels every control from its descriptor, not from this page', () => {
    mount();
    for (const setting of COUNTER_CATALOG) {
      const control = document.getElementById(`vc-${String(setting.key)}`)!;
      const label = document.querySelector(`label[for="${control.id}"]`);
      expect(label?.textContent).toBe(setting.label);
    }
  });
});

describe('conditional settings appear with what they depend on', () => {
  it('reveals the fade duration only while fading is on', () => {
    mount();
    // Default has fading on, so the duration is present.
    expect(document.getElementById('mc-fade')).not.toBeNull();
    fireEvent.click(document.getElementById('mc-fadeEnabled')!);
    expect(document.getElementById('mc-fade')).toBeNull();
  });

  it('reveals the pin platform set only while pins are on', () => {
    mount();
    expect(document.getElementById('mc-pinPlatforms-kick')).not.toBeNull();
    fireEvent.click(document.getElementById('mc-showPinEnabled')!);
    expect(document.getElementById('mc-pinPlatforms-kick')).toBeNull();
  });
});

describe('the two authoritative URLs', () => {
  it('builds the chat URL with the overlay serializer', () => {
    /* Asserted against the descriptor's own serialize, which is buildMultichatQuery
       behind the channel adapter. Calling the raw serializer here would mean
       restating that adapter in the test and could pass while the page skipped
       it. */
    mount();
    typeChannel('kick', 'somechannel');
    expect(chatUrl()).toBe(
      `${BASE}/multichat?${multichatTool.serialize(
        { kick: 'somechannel' },
        multichatTool.defaults,
      )}`,
    );
    // And that is the authoritative builder, not a second one.
    expect(chatUrl()).toContain(
      buildMultichatQuery(
        { kick: 'somechannel', twitch: '', youtube: '', tiktok: '' },
        multichatTool.defaults,
      ),
    );
  });

  it('builds the counter URL with the counter serializer', () => {
    mount();
    typeChannel('kick', 'somechannel');
    expect(counterUrl()).toBe(
      `${BASE}/counter?${buildViewerCounterQuery(
        { kick: 'somechannel' },
        counterTool.defaults,
      )}`,
    );
  });

  it('keeps the two URLs pointing at different overlays', () => {
    mount();
    typeChannel('kick', 'somechannel');
    expect(chatUrl().startsWith(`${BASE}/multichat?`)).toBe(true);
    expect(counterUrl().startsWith(`${BASE}/counter?`)).toBe(true);
  });

  it('shows no preview iframe until a channel is configured', () => {
    /* No iframe means no overlay mounts, so nothing connects or polls on a page
       a visitor is only looking at. */
    mount();
    settle();
    expect(document.querySelectorAll('iframe')).toHaveLength(0);
    expect(screen.getAllByText(/Enter a channel above/).length).toBe(2);
  });

  it('previews both overlays at exactly their generated URLs', () => {
    mount();
    typeChannel('kick', 'somechannel');
    settle();
    expect(
      document
        .querySelector('iframe[title="Live chat overlay preview"]')
        ?.getAttribute('src'),
    ).toBe(chatUrl());
    expect(
      document
        .querySelector('iframe[title="Live viewer counter preview"]')
        ?.getAttribute('src'),
    ).toBe(counterUrl());
  });

  it('sizes each preview to its own OBS height', () => {
    mount();
    typeChannel('kick', 'somechannel');
    settle();
    const height = (title: string) =>
      (document.querySelector(`iframe[title="${title}"]`) as HTMLElement).style.height;
    expect(height('Live chat overlay preview')).toBe(`${MULTICHAT_OBS_SIZE.height}px`);
    expect(height('Live viewer counter preview')).toBe(`${counterTool.obs.height}px`);
  });
});

describe('Copy and Open hand over the displayed URL', () => {
  const clipboard = () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    return writeText;
  };

  it.each([
    ['.panel-chat-output', chatUrl],
    ['.panel-counter-output', counterUrl],
  ])('%s copies and opens exactly what it displays', (region, url) => {
    const writeText = clipboard();
    mount();
    typeChannel('kick', 'somechannel');
    const scope = within(panel(region));

    fireEvent.click(scope.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith(url());
    expect(scope.getByRole('link', { name: 'Open' }).getAttribute('href')).toBe(url());
  });

  it('confirms a copy visibly and to assistive technology', () => {
    clipboard();
    mount();
    typeChannel('kick', 'somechannel');
    const scope = within(panel('.panel-chat-output'));
    fireEvent.click(scope.getByRole('button', { name: 'Copy' }));
    expect(scope.getByRole('button', { name: '✓ Copied' })).toBeDefined();
    expect(
      within(panel('.panel-chat-output')).getByText(
        'MultiChat overlay URL copied to the clipboard.',
      ),
    ).toBeDefined();
  });

  it('copies each tool independently', () => {
    const writeText = clipboard();
    mount();
    typeChannel('kick', 'somechannel');
    fireEvent.click(within(panel('.panel-counter-output')).getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith(counterUrl());
    // The chat panel's button is untouched.
    expect(
      within(panel('.panel-chat-output')).getByRole('button', { name: 'Copy' }),
    ).toBeDefined();
  });
});

describe('preview backgrounds are page-only and independent', () => {
  const toggleIn = (region: string) =>
    within(panel(region)).getByRole('button', { name: /background$/ });

  it('starts both previews transparent', () => {
    mount();
    expect(toggleIn('.panel-chat-output').getAttribute('aria-pressed')).toBe('false');
    expect(toggleIn('.panel-counter-output').getAttribute('aria-pressed')).toBe('false');
  });

  it('changes one preview background without touching the other', () => {
    mount();
    fireEvent.click(toggleIn('.panel-chat-output'));
    expect(toggleIn('.panel-chat-output').getAttribute('aria-pressed')).toBe('true');
    expect(toggleIn('.panel-counter-output').getAttribute('aria-pressed')).toBe('false');
  });

  it('never puts a preview background in either URL', () => {
    mount();
    typeChannel('kick', 'somechannel');
    const before = [chatUrl(), counterUrl()];
    fireEvent.click(toggleIn('.panel-chat-output'));
    fireEvent.click(toggleIn('.panel-counter-output'));
    expect([chatUrl(), counterUrl()]).toEqual(before);
  });
});

describe('OAuth preserves both tools', () => {
  const leave = () =>
    fireEvent.click(within(panel('.classic-conn')).getByText('Connect'));

  const draft = (toolId: string) => {
    const raw = window.sessionStorage.getItem(workspaceDraftKey(toolId));
    expect(raw, `no draft for ${toolId}`).not.toBeNull();
    return JSON.parse(raw!);
  };

  it('writes a draft for each tool before navigating away', () => {
    mount();
    typeChannel('kick', 'somechannel');
    fireEvent.change(document.getElementById('mc-textSize')!, { target: { value: 'large' } });
    fireEvent.click(document.getElementById('vc-icons')!);
    leave();

    expect(draft(multichatTool.id).style.textSize).toBe('large');
    expect(draft(counterTool.id).style.icons).toBe(false);
    // Shared channels reach both, so either draft can restore them.
    expect(draft(multichatTool.id).channels.kick).toBe('somechannel');
    expect(draft(counterTool.id).channels.kick).toBe('somechannel');
  });

  it('sends the visitor to the canonical generator, not a retired route', () => {
    mount();
    const href = within(panel('.classic-conn')).getByText('Connect').getAttribute('href') ?? '';
    expect(href).toContain(encodeURIComponent('/multichat'));
    expect(href).not.toContain('tools');
  });

  it('restores both tools on the way back', () => {
    mount();
    typeChannel('twitch', 'streamer');
    fireEvent.change(document.getElementById('mc-font')!, { target: { value: 'roboto' } });
    fireEvent.change(document.getElementById('vc-align')!, { target: { value: 'right' } });
    const expected = [chatUrl(), counterUrl()];
    leave();

    cleanup();
    mount();
    expect((document.getElementById('channel-twitch') as HTMLInputElement).value).toBe('streamer');
    expect((document.getElementById('mc-font') as HTMLSelectElement).value).toBe('roboto');
    expect((document.getElementById('vc-align') as HTMLSelectElement).value).toBe('right');
    expect([chatUrl(), counterUrl()]).toEqual(expected);
  });

  it('restores each preview background independently', () => {
    mount();
    fireEvent.click(
      within(panel('.panel-counter-output')).getByRole('button', { name: /background$/ }),
    );
    leave();
    cleanup();
    mount();
    expect(
      within(panel('.panel-chat-output'))
        .getByRole('button', { name: /background$/ })
        .getAttribute('aria-pressed'),
    ).toBe('false');
    expect(
      within(panel('.panel-counter-output'))
        .getByRole('button', { name: /background$/ })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('consumes each draft once, so a remount does not overwrite new input', () => {
    mount();
    typeChannel('kick', 'first');
    leave();
    cleanup();

    mount();
    typeChannel('kick', 'second');
    cleanup();
    mount();
    // The draft was consumed by the first restore; nothing is re-applied.
    expect((document.getElementById('channel-kick') as HTMLInputElement).value).toBe('');
  });
});

describe('Commands and help', () => {
  it('documents every command the parser implements, and only those', () => {
    mount();
    const rows = Array.from(
      panel('[aria-labelledby="commands-heading"]').querySelectorAll('tbody tr'),
    );
    expect(rows).toHaveLength(MULTICHAT_COMMANDS.length);
    expect(rows.map((row) => row.querySelector('td')?.textContent)).toEqual(
      MULTICHAT_COMMANDS.map((command) => command.syntax),
    );
  });

  it('names the real trigger', () => {
    mount();
    expect(panel('[aria-labelledby="commands-heading"]').textContent).toContain(
      MULTICHAT_COMMAND_TRIGGER,
    );
  });

  it('says the counter has no commands of its own', () => {
    mount();
    expect(panel('[aria-labelledby="commands-heading"]').textContent).toMatch(
      /viewer counter has none/i,
    );
  });
});

describe('OBS setup', () => {
  it('explains that the two overlays are separate browser sources', () => {
    mount();
    const text = panel('[aria-labelledby="obs-heading"]').textContent ?? '';
    expect(text).toMatch(/two separate browser sources/i);
    expect(text).toMatch(/second Browser source/i);
  });

  it('gives each overlay its own sizing step', () => {
    mount();
    const text = panel('[aria-labelledby="obs-heading"]').textContent ?? '';
    expect(text).toContain(`${MULTICHAT_OBS_SIZE.width} × ${MULTICHAT_OBS_SIZE.height}`);
    expect(text).toContain(
      `${MULTICHAT_OBS_ALTERNATE.width} × ${MULTICHAT_OBS_ALTERNATE.height}`,
    );
    expect(text).toContain(`${counterTool.obs.width} × ${counterTool.obs.height}`);
  });
});

describe('the Demo interface is gone', () => {
  it('offers no Live/Demo switch, sample messages, or test tools', () => {
    mount();
    const text = document.body.textContent ?? '';
    for (const gone of [
      /demo/i,
      /sample message/i,
      /message creator/i,
      /command simulator/i,
      /test tools/i,
    ]) {
      expect(text).not.toMatch(gone);
    }
  });

  it('renders previews only as real overlay iframes', () => {
    mount();
    typeChannel('kick', 'somechannel');
    settle();
    const frames = Array.from(document.querySelectorAll('iframe'));
    expect(frames).toHaveLength(2);
    for (const frame of frames) {
      expect(frame.getAttribute('src')?.startsWith(BASE)).toBe(true);
    }
  });

  it('states the honest empty case rather than fabricating messages', () => {
    mount();
    expect(screen.getAllByText(/Enter a channel above/).length).toBe(2);
  });
});

describe('accessibility', () => {
  it('offers a skip link into the generator', () => {
    mount();
    const skip = screen.getByRole('link', { name: 'Skip to the generator' });
    expect(skip.getAttribute('href')).toBe('#generator-main');
    expect(document.getElementById('generator-main')).not.toBeNull();
  });

  it('has exactly one h1, naming the page', () => {
    mount();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toContain('multichat-gxufy');
  });

  it('labels every section by its own heading', () => {
    mount();
    for (const section of Array.from(document.querySelectorAll('section'))) {
      const id = section.getAttribute('aria-labelledby');
      expect(id, 'a section has no aria-labelledby').not.toBeNull();
      expect(document.getElementById(id!)?.tagName).toBe('H2');
    }
  });

  it('associates a label with every channel field', () => {
    mount();
    for (const platform of multichatTool.platforms) {
      const field = document.getElementById(`channel-${platform.key}`)!;
      expect(document.querySelector(`label[for="${field.id}"]`)).not.toBeNull();
    }
  });

  it('gives the counter panel a real anchor id to be sent to', () => {
    mount();
    expect(panel('.panel-counter-output').id).toBe(COUNTER_SECTION_ID);
  });

  it('scrolls the counter into view when asked to start there', () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      value: scrollIntoView,
      configurable: true,
      writable: true,
    });
    mount({ focusCounter: true });
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('does not scroll on an ordinary visit', () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      value: scrollIntoView,
      configurable: true,
      writable: true,
    });
    mount();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
