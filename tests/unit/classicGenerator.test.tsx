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
import { CLASSIC_GENERATOR_CSS } from '@/components/classic/classicStyles';
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

  it('credits the author with the guns.lol link, shown as its own URL', () => {
    mount();
    const footer = panel('footer');
    expect(footer.textContent).toContain('multichat-gxufy');

    /* Both the destination and the visible text: the footer shows the URL
       literally rather than a label, so a change to one and not the other is a
       real defect. */
    const link = within(footer).getByRole('link', {
      name: 'https://guns.lol/gxufy',
    });
    expect(link.getAttribute('href')).toBe('https://guns.lol/gxufy');
    expect(footer.textContent).not.toContain('x.com/Gxufy_');
  });

  it('carries no third-party attribution line', () => {
    /* Removed deliberately. Asserted by name so restoring the markup fails here
       rather than only being noticed visually. */
    mount();
    const footer = panel('footer');
    expect(footer.textContent).not.toMatch(/inspired by/i);
    for (const name of ['ChatIS', 'IS2511', 'giambaJ']) {
      expect(footer.textContent, `${name} is back in the footer`).not.toContain(name);
    }
    expect(
      within(footer).queryByRole('link', { name: /chatis/i }),
    ).toBeNull();
  });

  it('keeps the non-affiliation line', () => {
    mount();
    const footer = panel('footer');
    expect(footer.textContent).toContain('Not affiliated with');
    for (const platform of ['Kick', 'Twitch', 'YouTube', 'TikTok']) {
      expect(footer.textContent).toContain(platform);
    }
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

  it('keeps each tool together: its own output immediately before its own settings', () => {
    /* The stacked reading order, and the reason it needs no reordering on a
       phone: each tool is a unit, so the counter's controls follow the counter's
       preview rather than 24 chat settings. */
    mount();
    expect(order('.panel-chat-output')).toBeLessThan(order('.panel-chat-settings'));
    expect(order('.panel-chat-settings')).toBeLessThan(order('.panel-counter-output'));
    expect(order('.panel-counter-output')).toBeLessThan(order('.panel-counter-settings'));
  });

  it('follows the required order end to end', () => {
    mount();
    const sections = Array.from(document.querySelectorAll('section')).map(
      (section) => section.getAttribute('aria-labelledby'),
    );
    expect(sections).toEqual([
      'channels-heading',
      'chat-output-heading',
      'chat-settings-heading',
      'counter-output-heading',
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

  it('holds all six panels in one grid, in the stacked order', () => {
    /* The structural half of the layout: jsdom computes no layout, so what is
       assertable in the tree is that all six panels are children of the single
       grid, once each, in the order a phone should read them. Which cell each
       lands in on a desktop is the stylesheet's job, asserted below. */
    mount();
    const grids = document.querySelectorAll('.tool-grid');
    expect(grids).toHaveLength(1);

    const shape = Array.from(grids[0].children).map((child) =>
      Array.from(child.classList).find((c) => c.startsWith('panel-')),
    );
    expect(shape).toEqual([
      'panel-chat-output',
      'panel-chat-settings',
      'panel-counter-output',
      'panel-counter-settings',
      'panel-commands',
      'panel-obs',
    ]);
  });

  it('places the panels into the locked grid areas at the desktop breakpoint', () => {
    /* The locked arrangement, read off the stylesheet:
         "chat-output   counter-output"
         "chat-settings counter-settings"
         "commands      commands"
         "obs           obs"
       so the two outputs are aligned beside each other, each settings card is
       directly beneath its own output, and the last two sections span the page. */
    const areas = CLASSIC_GENERATOR_CSS.match(/grid-template-areas:([\s\S]*?);/);
    expect(areas, 'the grid declares no template areas').not.toBeNull();
    const rows = areas![1]
      .match(/"[^"]+"/g)!
      .map((row) => row.replace(/"/g, '').trim().split(/\s+/));

    expect(rows).toEqual([
      ['chat-output', 'counter-output'],
      ['chat-settings', 'counter-settings'],
      ['commands', 'commands'],
      ['obs', 'obs'],
    ]);

    // Each panel class is bound to the area of the same name.
    for (const area of [
      'chat-output',
      'counter-output',
      'chat-settings',
      'counter-settings',
      'commands',
      'obs',
    ]) {
      expect(
        CLASSIC_GENERATOR_CSS,
        `.panel-${area} is not bound to its grid area`,
      ).toContain(`.panel-${area} { grid-area: ${area}; }`);
    }
  });

  it('gives the grid two equal columns so the outputs align', () => {
    const desktop = CLASSIC_GENERATOR_CSS.match(
      /@media \(min-width: 1000px\) \{\s*\.tool-grid \{([\s\S]*?)\n  \}/,
    );
    expect(desktop, 'the .tool-grid desktop block is missing').not.toBeNull();
    const columns = desktop![1].match(/grid-template-columns: ([^;]+);/);
    expect(columns, 'the grid declares no columns').not.toBeNull();
    /* Two tracks, both minmax(0, 1fr): equal so the two outputs align beside
       each other, and minmax(0,…) so a long URL cannot push one past its
       share. */
    expect(columns![1].match(/minmax\(0, 1fr\)/g)).toHaveLength(2);
  });

  it('needs no media query for the stacked order', () => {
    /* The mobile order is the DOM order, so the base rule is a plain column and
       the grid exists only above the breakpoint. If the stack were built by
       reordering, this would be where it broke silently. */
    expect(CLASSIC_GENERATOR_CSS).toContain(
      '.tool-grid { display: flex; flex-direction: column; }',
    );
    expect(CLASSIC_GENERATOR_CSS).not.toMatch(/\.panel-[a-z-]+ \{[^}]*order:/);
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
      /* A segmented group is named by its legend, a single control by a `for`
         label. Both are accessible names taken from the descriptor, which is what
         this asserts — not which element carries it. */
      const named =
        control.tagName === 'FIELDSET'
          ? control.querySelector('legend')?.textContent
          : document.querySelector(`label[for="${control.id}"]`)?.textContent;
      expect(named).toBe(setting.label);
    }
  });
});

describe('direct controls in place of dropdowns', () => {
  /* Every segmented choice and every slider must emit exactly what the dropdown
     or field it replaced emitted. These tests compare against the catalog's own
     option values and against the serializer, so a presentation change that
     altered a value fails here rather than in a copied OBS URL. */

  const segmented = (id: string) => {
    const group = document.getElementById(id);
    expect(group, `${id} is missing`).not.toBeNull();
    expect(group!.tagName).toBe('FIELDSET');
    return group as HTMLFieldSetElement;
  };

  const radios = (id: string) =>
    Array.from(segmented(id).querySelectorAll('input[type="radio"]'));

  it.each([
    ['mc-textSize', 'textSize'],
    ['mc-stroke', 'stroke'],
    ['mc-textShadow', 'textShadow'],
    ['mc-animation', 'animation'],
    ['mc-sourceTag', 'sourceTag'],
  ])('%s is a segmented group over the catalog values', (id, key) => {
    mount();
    const setting = MULTICHAT_CATALOG.find((s) => s.key === key)!;
    expect(setting.type).toBe('select');
    const options = (setting as { options: readonly { value: string }[] }).options;
    expect(radios(id).map((r) => (r as HTMLInputElement).value)).toEqual(
      options.map((o) => o.value),
    );
  });

  it.each([
    ['vc-align', 'align'],
    ['vc-textShadow', 'textShadow'],
    ['vc-stroke', 'stroke'],
  ])('%s is a segmented group over the catalog values', (id, key) => {
    mount();
    const setting = COUNTER_CATALOG.find((s) => s.key === key)!;
    const options = (setting as { options: readonly { value: string }[] }).options;
    expect(radios(id).map((r) => (r as HTMLInputElement).value)).toEqual(
      options.map((o) => o.value),
    );
  });

  it('checks exactly the defaulted option on load', () => {
    mount();
    for (const [id, setting] of [
      ['mc-stroke', MULTICHAT_CATALOG.find((s) => s.key === 'stroke')!],
      ['vc-align', COUNTER_CATALOG.find((s) => s.key === 'align')!],
    ] as const) {
      const checked = radios(id).filter((r) => (r as HTMLInputElement).checked);
      expect(checked).toHaveLength(1);
      expect((checked[0] as HTMLInputElement).value).toBe(
        (setting as { default: string }).default,
      );
    }
  });

  it('groups each setting under its own radio name, per prefix', () => {
    /* Both catalogs have stroke and textShadow. A shared name would make picking
       a chat stroke silently clear the counter's. */
    mount();
    expect(new Set(radios('mc-stroke').map((r) => (r as HTMLInputElement).name))).toEqual(
      new Set(['mc-stroke']),
    );
    expect(new Set(radios('vc-stroke').map((r) => (r as HTMLInputElement).name))).toEqual(
      new Set(['vc-stroke']),
    );
  });

  it('serializes a segmented pick exactly as the dropdown did', () => {
    mount();
    typeChannel('kick', 'somechannel');
    fireEvent.click(document.getElementById('mc-sourceTag-dot')!);
    expect(chatUrl()).toBe(
      `${BASE}/multichat?${multichatTool.serialize(
        { kick: 'somechannel' },
        { ...multichatTool.defaults, sourceTag: 'dot' },
      )}`,
    );

    fireEvent.click(document.getElementById('vc-align-right')!);
    expect(counterUrl()).toBe(
      `${BASE}/counter?${buildViewerCounterQuery(
        { kick: 'somechannel' },
        { ...counterTool.defaults, align: 'right' },
      )}`,
    );
  });

  it('keeps every segmented choice keyboard-reachable with a visible state', () => {
    mount();
    for (const radio of radios('mc-animation')) {
      const input = radio as HTMLInputElement;
      // Not hidden from the tab order, and labelled by the visible pill.
      expect(input.disabled).toBe(false);
      const label = document.querySelector(`label[for="${input.id}"]`);
      expect(label).not.toBeNull();
      expect(label!.className.includes('on')).toBe(input.checked);
    }
  });

  it.each([
    ['mc-fade', 'fade'],
    ['mc-emoteScale', 'emoteScale'],
  ])('%s is a slider over a real numeric range', (id, key) => {
    mount();
    const input = document.getElementById(id) as HTMLInputElement;
    expect(input.type).toBe('range');
    const setting = MULTICHAT_CATALOG.find((s) => s.key === key)!;
    // Still the catalog's text setting; only the presentation changed.
    expect(setting.type).toBe('text');
  });

  it('serializes a slider value as the plain number string', () => {
    mount();
    typeChannel('kick', 'somechannel');
    fireEvent.change(document.getElementById('mc-fade')!, { target: { value: '45' } });
    expect(chatUrl()).toBe(
      `${BASE}/multichat?${multichatTool.serialize(
        { kick: 'somechannel' },
        { ...multichatTool.defaults, fade: '45' },
      )}`,
    );
    expect(chatUrl()).toContain('fade=45');
  });

  it('serializes a fractional slider value without trailing zeros', () => {
    mount();
    typeChannel('kick', 'somechannel');
    fireEvent.change(document.getElementById('mc-emoteScale')!, {
      target: { value: '1.5' },
    });
    expect(chatUrl()).toContain('emoteScale=1.5');
    expect(chatUrl()).toBe(
      `${BASE}/multichat?${multichatTool.serialize(
        { kick: 'somechannel' },
        { ...multichatTool.defaults, emoteScale: '1.5' },
      )}`,
    );
  });

  it('keeps the blank state a slider cannot express reachable', () => {
    /* Blank suppresses the parameter entirely. Without the button, one drag would
       commit emoteScale to every URL from then on. */
    mount();
    typeChannel('kick', 'somechannel');
    expect(chatUrl()).not.toContain('emoteScale');

    fireEvent.change(document.getElementById('mc-emoteScale')!, {
      target: { value: '2' },
    });
    expect(chatUrl()).toContain('emoteScale=2');

    const scope = document.getElementById('mc-emoteScale')!.closest('.classic-field')!;
    fireEvent.click(within(scope as HTMLElement).getByRole('button', { name: 'Default' }));
    expect(chatUrl()).not.toContain('emoteScale');
  });

  it('announces the blank state rather than showing a misleading number', () => {
    mount();
    const slider = document.getElementById('mc-emoteScale')!;
    expect(slider.getAttribute('aria-valuetext')).toBe('Default');
    fireEvent.change(slider, { target: { value: '2' } });
    expect(document.getElementById('mc-emoteScale')!.getAttribute('aria-valuetext')).toBe(
      '2 ×',
    );
  });

  it.each([['mc-font'], ['vc-combined']])(
    '%s keeps the control type that suits it',
    (id) => {
      /* Font is twelve unordered families — a dropdown. Booleans stay switches.
         Neither is a candidate for a slider or a pill row. */
      mount();
      const el = document.getElementById(id)!;
      expect(el.tagName === 'SELECT' || (el as HTMLInputElement).type === 'checkbox').toBe(
        true,
      );
    },
  );

  it('keeps the font dropdown listing every family', () => {
    mount();
    const select = document.getElementById('mc-font') as HTMLSelectElement;
    expect(select.tagName).toBe('SELECT');
    const setting = MULTICHAT_CATALOG.find((s) => s.key === 'font')!;
    const options = (setting as { options: readonly { value: string }[] }).options;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(
      options.map((o) => o.value),
    );
  });

  it('leaves the default URLs byte-identical to before the control change', () => {
    /* The whole point: presentation moved, values did not. */
    mount();
    typeChannel('kick', 'somechannel');
    expect(chatUrl()).toBe(
      `${BASE}/multichat?${multichatTool.serialize(
        { kick: 'somechannel' },
        multichatTool.defaults,
      )}`,
    );
    expect(counterUrl()).toBe(
      `${BASE}/counter?${buildViewerCounterQuery(
        { kick: 'somechannel' },
        counterTool.defaults,
      )}`,
    );
  });
});

describe('density', () => {
  it('bounds the page width and keeps an outer gutter', () => {
    /* Read off the stylesheet rather than measured: jsdom computes no layout, so
       a getBoundingClientRect assertion here would be meaningless. */
    const page = CLASSIC_GENERATOR_CSS.match(/\.page \{([^}]*)\}/)![1];
    const max = Number(page.match(/max-width:\s*(\d+)px/)![1]);
    expect(max).toBeGreaterThanOrEqual(1450);
    expect(max).toBeLessThanOrEqual(1550);
    // Centred, with a gutter that keeps it off the viewport edge.
    expect(page).toContain('margin: 0 auto');
    const gutter = Number(page.match(/padding:\s*0\s+(\d+)px/)![1]);
    expect(gutter).toBeGreaterThanOrEqual(24);
    expect(gutter).toBeLessThanOrEqual(48);
  });

  it('splits the two tool columns evenly rather than favouring one', () => {
    /* The chat column cannot claim a wider track than the counter column: the two
       output cards share a grid row and have to line up, which an uneven split
       would break. Read as a ratio so a future change to the unit still fails. */
    const [left, right] = CLASSIC_GENERATOR_CSS.match(
      /grid-template-columns: minmax\(0, ([\d.]+)fr\) minmax\(0, ([\d.]+)fr\);\s*\n\s*grid-template-areas/,
    )!
      .slice(1)
      .map(Number);
    expect(left / right).toBe(1);
  });

  it('puts both output actions in one group beside the field', () => {
    mount();
    typeChannel('kick', 'somechannel');
    for (const region of ['.panel-chat-output', '.panel-counter-output']) {
      const actions = panel(region).querySelector('.url-actions');
      expect(actions, `${region} has no action group`).not.toBeNull();
      const scope = within(actions as HTMLElement);
      expect(scope.getByRole('button', { name: 'Copy' })).toBeDefined();
      expect(scope.getByRole('link', { name: 'Open' })).toBeDefined();
      // The field is a sibling, not a parent, so it can wrap on its own.
      expect(panel(region).querySelector('.url-code')!.contains(actions!)).toBe(false);
    }
  });

  it('lays both output cards out identically', () => {
    mount();
    typeChannel('kick', 'somechannel');
    const shape = (region: string) =>
      Array.from(panel(region).querySelectorAll('.url-box > *')).map((el) => el.className);
    expect(shape('.panel-counter-output')).toEqual(['url-code', 'url-actions']);
    expect(shape('.panel-chat-output')).toEqual([
      'url-code',
      'url-actions',
      'url-warn',
    ]);
  });

  it('uses multi-column settings tables on wide screens only', () => {
    mount();
    /* The class declares the intent; the media query in the stylesheet is what
       keeps a narrow screen at one column. Both are asserted, because the class
       alone would not prove the narrow case. */
    expect(document.querySelectorAll('.panel-chat-settings .form_table.cols-2').length)
      .toBeGreaterThan(0);
    expect(
      document.querySelectorAll('.panel-counter-settings .form_table.cols-2').length,
    ).toBe(1);
    /* Gated above the row breakpoint, not at it: a settings panel is half of a
       row now, so two tracks only fit once the row itself is wide. This is the
       "never create unusably narrow settings columns" requirement. */
    const columnRule = CLASSIC_GENERATOR_CSS.indexOf(
      '.form_table.cols-2 { grid-template-columns: repeat(2',
    );
    expect(columnRule, 'the second-column rule is missing').toBeGreaterThan(-1);
    /* The nearest preceding media query is the one that gates it — searching
       forward from the top would match whichever block came first. */
    const enclosing = CLASSIC_GENERATOR_CSS.slice(0, columnRule).match(
      /@media \(min-width: (\d+)px\)[^{]*\{[^@]*$/,
    );
    expect(enclosing, 'the second column is not inside a media query').not.toBeNull();
    expect(Number(enclosing![1])).toBeGreaterThan(1000);
    // The base rule is one column, so narrow widths inherit it.
    expect(CLASSIC_GENERATOR_CSS).toMatch(/\.form_table \{[\s\S]*?grid-template-columns: 1fr;/);
    // No stale three-column rule left behind for a class nothing carries.
    expect(document.querySelectorAll('.form_table.cols-3')).toHaveLength(0);
    expect(CLASSIC_GENERATOR_CSS).not.toContain('cols-3');
  });

  it('does not reserve a line for the absent fragment warning', () => {
    mount();
    typeChannel('kick', 'somechannel');
    expect(panel('.panel-chat-output').querySelector('.url-warn')!.textContent).toBe('');
    expect(CLASSIC_GENERATOR_CSS).toContain('.url-warn:empty { display: none; }');
  });

  it('keeps touch targets from following desktop density', () => {
    /* Density is a desktop goal. The narrow block re-pads exactly the controls
       that would otherwise fall under a comfortable tap size. */
    const narrow = CLASSIC_GENERATOR_CSS.slice(
      CLASSIC_GENERATOR_CSS.indexOf('@media (max-width: 720px)'),
    );
    for (const selector of ['.classic-chip-label', '.classic-seg-label', '.classic-clear']) {
      expect(narrow).toContain(selector);
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
    /* No iframe means no overlay document loads, so nothing connects, polls, or
       authenticates on a page a visitor is only looking at. The chat panel is
       populated from fixtures instead, which is a pure render — this assertion is
       what keeps that true, because an iframe would reintroduce the sockets. */
    mount();
    settle();
    expect(document.querySelectorAll('iframe')).toHaveLength(0);
    /* The chat side no longer waits for a channel: fixtures render immediately
       through the production overlay. */
    expect(
      within(panel('.panel-chat-output')).getByTestId('chat-fixture-preview'),
    ).toBeTruthy();
    /* The counter side still states its empty case, and only one panel does. */
    expect(screen.getAllByText(/Enter a channel above/).length).toBe(1);
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
    // A segmented pick and a switch, one per tool.
    fireEvent.click(document.getElementById('mc-textSize-large')!);
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
    fireEvent.click(document.getElementById('vc-align-right')!);
    const expected = [chatUrl(), counterUrl()];
    leave();

    cleanup();
    mount();
    expect((document.getElementById('channel-twitch') as HTMLInputElement).value).toBe('streamer');
    expect((document.getElementById('mc-font') as HTMLSelectElement).value).toBe('roboto');
    expect((document.getElementById('vc-align-right') as HTMLInputElement).checked).toBe(true);
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

  it('labels the built-in chat samples as preview data', () => {
    /* This assertion replaced one requiring the chat panel to say "Enter a
       channel above". That empty state was honest but useless: it showed nothing
       about styling, which is the only reason to be on this page. Fixtures are
       now rendered instead — so the requirement becomes that they are *marked*
       as fixtures rather than passed off as somebody's live chat. The retired
       Demo interface is still gone; this is a labelled preview, not a mode. */
    mount();
    const chat = panel('.panel-chat-output');
    expect(within(chat).getByTestId('chat-fixture-preview')).toBeTruthy();
    expect(within(chat).getByText('Preview data')).toBeTruthy();
    /* No mode switch came back with it: nothing toggles between live and sample
       content, because a configured channel decides that on its own. */
    expect(chat.textContent ?? '').not.toMatch(/\bdemo\b/i);
  });

  it('states the honest empty case where there is genuinely nothing to show', () => {
    /* The counter panel keeps its empty state until its own fixtures land. */
    mount();
    expect(
      within(panel('.panel-counter-output')).getByText(/Enter a channel above/),
    ).toBeTruthy();
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
