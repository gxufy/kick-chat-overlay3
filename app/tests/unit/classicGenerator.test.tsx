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
 *   - all MultiChat settings and all six Counter settings, from the catalogs;
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
import { MULTICHAT_OBS_ALTERNATE, MULTICHAT_OBS_SIZE } from '@/features/multichat/obs';
import { multichatTool } from '@/features/multichat/config';
import { counterTool } from '@/features/counter/config';
import { MULTICHAT_CATALOG } from '@/features/multichat/settings';
import { COUNTER_CATALOG } from '@/features/counter/settings';
import { CLASSIC_GENERATOR_CSS } from '@/components/classic/classicStyles';
import { buildMultichatQuery } from '@/lib/multichatConfig';
import { buildViewerCounterQuery } from '@/lib/viewerCounterConfig';
import { workspaceDraftKey } from '@/lib/workspaceStorage';
import { buildConnectionFragment } from '@/lib/twitchConnection';

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


  it('keeps the non-affiliation line', () => {
    mount();
    const footer = panel('footer');
    expect(footer.textContent).toContain('Not affiliated with');
    for (const platform of ['Kick', 'Twitch', 'YouTube', 'TikTok']) {
      expect(footer.textContent).toContain(platform);
    }
  });
});

describe('the original two-card tool layout', () => {
  it('keeps one grid with each output immediately before its settings in DOM order', () => {
    mount();
    const grid = document.querySelector('.tool-grid')!;
    expect(document.querySelectorAll('.tool-grid')).toHaveLength(1);
    expect(Array.from(grid.children).map((child) => child.className)).toEqual([
      'card panel-chat-output',
      'card panel-chat-settings',
      'card panel-counter-output',
      'card panel-counter-settings',
      'card panel-commands',
      'card panel-obs',
    ]);
  });

  it('renders both independent output cards together without workspace tabs', () => {
    mount();
    expect(document.querySelectorAll('.panel-chat-output')).toHaveLength(1);
    expect(document.querySelectorAll('.panel-counter-output')).toHaveLength(1);
    expect(document.querySelector('.preview-workspace')).toBeNull();
    expect(screen.queryByRole('tablist', { name: 'Preview Workspace' })).toBeNull();
  });

  it('aligns the two outputs over their settings in equal desktop columns', () => {
    expect(CLASSIC_GENERATOR_CSS).toContain(
      'grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)',
    );
    expect(CLASSIC_GENERATOR_CSS).toContain('"chat-output counter-output"');
    expect(CLASSIC_GENERATOR_CSS).toContain('"chat-settings counter-settings"');
    expect(CLASSIC_GENERATOR_CSS).toContain('"commands commands"');
    expect(CLASSIC_GENERATOR_CSS).toContain('"obs obs"');
    expect(CLASSIC_GENERATOR_CSS).not.toContain('position: sticky');
  });

  it('uses the same DOM sequence as the single-column responsive layout', () => {
    expect(CLASSIC_GENERATOR_CSS).toContain('"chat-output"');
    expect(CLASSIC_GENERATOR_CSS).toContain('"chat-settings"');
    expect(CLASSIC_GENERATOR_CSS).toContain('"counter-output"');
    expect(CLASSIC_GENERATOR_CSS).toContain('"counter-settings"');
    expect(CLASSIC_GENERATOR_CSS).not.toMatch(
      /\.panel-(?:chat|counter|commands|obs)[^{]*\{[^}]*\border\s*:/,
    );
  });
});

describe('every catalog setting is reachable', () => {
  it('renders all 31 MultiChat settings', () => {
    mount();
    expect(MULTICHAT_CATALOG).toHaveLength(31);
    /* A multiselect is a group of checkboxes, so it has no single control id —
       it is present when its first option is. Both conditional settings (the
       fade duration and the pin platform set) are on by default, so a default
       render must already show all 31. */
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

describe('catalog-backed settings resets', () => {
  it('restores Chat defaults without changing channels or Counter settings', () => {
    mount();
    typeChannel('kick', 'gxufy');
    fireEvent.change(document.getElementById('mc-font')!, { target: { value: 'geist' } });
    fireEvent.click(document.getElementById('vc-combined')!);
    const changedCounterUrl = counterUrl();

    fireEvent.click(screen.getByRole('button', { name: 'Reset Chat Settings to Default' }));

    expect((document.getElementById('mc-font') as HTMLSelectElement).value).toBe('opensans');
    expect(chatUrl()).toContain('kick=gxufy');
    expect(chatUrl()).toContain('font=opensans');
    expect(counterUrl()).toBe(changedCounterUrl);
    expect(panel('.panel-chat-settings').textContent).toContain(
      'Chat settings restored to defaults.',
    );
  });

  it('restores Counter defaults without changing channels or Chat settings', () => {
    mount();
    typeChannel('twitch', 'gxufy');
    fireEvent.change(document.getElementById('mc-font')!, { target: { value: 'geist' } });
    const changedChatUrl = chatUrl();
    fireEvent.click(document.getElementById('vc-combined')!);

    fireEvent.click(screen.getByRole('button', { name: 'Reset Viewer Settings to Default' }));

    expect((document.getElementById('vc-combined') as HTMLInputElement).checked).toBe(
      counterTool.defaults.combined,
    );
    expect(counterUrl()).toContain('twitch=gxufy');
    expect(chatUrl()).toBe(changedChatUrl);
    expect(document.body.textContent).toContain('Viewer settings restored to defaults.');
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

  it('gives Chat and Viewer Counter equal desktop output columns', () => {
    expect(CLASSIC_GENERATOR_CSS).toContain(
      'grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)',
    );
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
       alone would not prove the narrow case.

       The chat panel's appearance table now carries three catalog groups, so it
       is cols-3; its Filters table stays cols-2 (free-text lists need a full
       line). The counter panel is a single cols-2 table. */
    expect(document.querySelectorAll('.panel-chat-settings .form_table.cols-3').length)
      .toBeGreaterThan(0);
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
    /* The third track exists but is gated higher still: a settings panel is half a
       tool row, so at 1360px two tracks already sit near the readable floor and a
       third belongs only once each half is wide (~1600px). Below that a cols-3
       table falls back to the two-track rule, so it is never three narrow columns. */
    const thirdRule = CLASSIC_GENERATOR_CSS.indexOf(
      '.form_table.cols-3 { grid-template-columns: repeat(3',
    );
    expect(thirdRule, 'the third-column rule is missing').toBeGreaterThan(-1);
    const thirdEnclosing = CLASSIC_GENERATOR_CSS.slice(0, thirdRule).match(
      /@media \(min-width: (\d+)px\)[^{]*\{[^@]*$/,
    );
    expect(thirdEnclosing, 'the third column is not inside a media query').not.toBeNull();
    expect(Number(thirdEnclosing![1])).toBeGreaterThan(Number(enclosing![1]));
    /* Below its own gate, cols-3 inherits the two-track rule rather than jumping
       straight from one column to three. */
    expect(CLASSIC_GENERATOR_CSS).toContain(
      '.form_table.cols-3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }',
    );
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

  it('loads no overlay document until a channel is configured', () => {
    /* The claim being protected is that nothing connects, polls, or authenticates
       on a page a visitor is only looking at. That is a claim about *navigation*,
       not about iframe elements: both fixture previews now render inside an
       isolated frame, and those frames hold locally written documents that cannot
       load anything. So the assertion is that no frame has a src or a srcdoc —
       which is what would pull in the real overlay route and its sockets. */
    mount();
    settle();
    const frames = Array.from(document.querySelectorAll('iframe'));
    expect(frames).toHaveLength(2);
    for (const f of frames) {
      expect(f.getAttribute('src')).toBeNull();
      expect(f.getAttribute('srcdoc')).toBeNull();
    }
    /* And they are the two fixture frames rather than anything else. */
    expect(frames.map((f) => f.getAttribute('title')).sort()).toEqual([
      'MultiChat sample preview',
      'Viewer Counter sample preview',
    ]);
    /* Neither side waits for a channel any more: both render fixtures through
       their own production renderer, each inside its own frame. */
    expect(
      within(panel('.panel-chat-output')).getByTestId('chat-fixture-preview'),
    ).toBeTruthy();
    expect(
      within(panel('.panel-counter-output')).getByTestId('counter-fixture-preview'),
    ).toBeTruthy();
    /* And so the "enter a channel" placeholder is gone from both panels rather
       than merely from one — it described a state neither panel now reaches. */
    expect(screen.queryAllByText(/Enter a channel above/)).toHaveLength(0);
  });

  it('automatically switches on the empty-to-configured transition and uses the exact generated URL', () => {
    mount();
    typeChannel('kick', 'somechannel');
    expect(screen.getByRole('tab', { name: 'Live Overlay' }).getAttribute('aria-selected')).toBe('true');
    settle();
    expect(
      document
        .querySelector('iframe[title="Live chat overlay preview"]')
        ?.getAttribute('src'),
    ).toBe(chatUrl());
    expect(
    document
      .querySelector('[data-testid="counter-live-preview"]')
      ?.getAttribute('data-overlay-url'),
  ).toBe(counterUrl());
  });

  it('respects manual Preview Data until every channel clears, then permits a new auto-switch', () => {
    mount();
    typeChannel('kick', 'somechannel');
    fireEvent.click(screen.getByRole('tab', { name: 'Preview Data' }));
    typeChannel('twitch', 'anotherchannel');
    expect(screen.getByRole('tab', { name: 'Preview Data' }).getAttribute('aria-selected')).toBe('true');
    typeChannel('kick', '');
    expect(screen.getByRole('tab', { name: 'Preview Data' }).getAttribute('aria-selected')).toBe('true');
    typeChannel('twitch', '');
    expect(document.querySelector('iframe[title="Live chat overlay preview"]')).toBeNull();
    typeChannel('youtube', '@freshchannel');
    expect(screen.getByRole('tab', { name: 'Live Overlay' }).getAttribute('aria-selected')).toBe('true');
  });

  it('sizes each preview to its own OBS height', () => {
    mount();
    typeChannel('kick', 'somechannel');
    fireEvent.click(screen.getByRole('tab', { name: 'Live Overlay' }));
    settle();
    const chatHeight = (
    document.querySelector('iframe[title="Live chat overlay preview"]') as HTMLElement
  ).style.height;
  const counterHeight = document
    .querySelector('[data-testid="counter-live-preview"]')
    ?.getAttribute('data-preview-height');
  expect(chatHeight).toBe(`${MULTICHAT_OBS_SIZE.height}px`);
  expect(counterHeight).toBe(String(counterTool.obs.height));
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
    // The adjacent Chat card's button is untouched.
    expect(
      within(panel('.panel-chat-output')).getByRole('button', { name: 'Copy' }),
    ).toBeDefined();
  });
});

describe('preview backgrounds are page-only and independent', () => {
  /* Each preview's backdrop is a four-way radio group — Transparent, Dark, Light,
     Custom — rather than the two-state button it replaced. The independence
     question is now whether the two groups share a radio `name` (they must not,
     or picking the chat backdrop would move the counter's), so these read each
     group's radios by their own ids. The id prefix (`chat`/`counter`) is the
     region, so an id lookup already scopes to the right group without a query. */
  const bgRadio = (region: 'chat' | 'counter', option: string) =>
    document.getElementById(`${region}-preview-bg-${option}`) as HTMLInputElement;
  const colorField = (region: 'chat' | 'counter') =>
    document.getElementById(`${region}-preview-bg-color`) as HTMLInputElement | null;

  it('starts both previews transparent', () => {
    mount();
    expect(bgRadio('chat', 'checker').checked).toBe(true);
    expect(bgRadio('counter', 'checker').checked).toBe(true);
  });

  it('changes one preview background without touching the other', () => {
    mount();
    fireEvent.click(bgRadio('chat', 'dark'));
    expect(bgRadio('chat', 'dark').checked).toBe(true);
    expect(bgRadio('chat', 'checker').checked).toBe(false);
    /* The counter group is untouched — a shared radio name would have moved it. */
    expect(bgRadio('counter', 'checker').checked).toBe(true);
    expect(bgRadio('counter', 'dark').checked).toBe(false);
  });

  it('reveals a colour field only under Custom, and drives the surface with it', () => {
    mount();
    const surface = () =>
      panel('.panel-chat-output').querySelector<HTMLElement>('.preview-surface')!;
    /* No colour input until Custom is the mode — a field that did nothing would
       be worse than no field. */
    expect(colorField('chat')).toBeNull();
    fireEvent.click(bgRadio('chat', 'custom'));
    const color = colorField('chat')!;
    expect(color.type).toBe('color');
    fireEvent.change(color, { target: { value: '#123456' } });
    /* The backdrop is inline on the wrapper, never a class and never a URL. */
    expect(surface().style.background).toContain('rgb(18, 52, 86)');
    /* Leaving Custom hides the field again but must not lose the chosen colour. */
    fireEvent.click(bgRadio('chat', 'dark'));
    expect(colorField('chat')).toBeNull();
    fireEvent.click(bgRadio('chat', 'custom'));
    expect(colorField('chat')!.value).toBe('#123456');
  });

  it('never puts a preview background in either URL', () => {
    mount();
    typeChannel('kick', 'somechannel');
    const before = [chatUrl(), counterUrl()];
    fireEvent.click(bgRadio('chat', 'custom'));
    fireEvent.change(colorField('chat')!, { target: { value: '#abcdef' } });
    fireEvent.click(bgRadio('counter', 'dark'));
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
    /* Each preview owns a four-way radio group; the two are kept independent by
       distinct ids and radio `name`s, so picking Dark for the counter must leave
       the chat preview on its Transparent default across the round trip. */
    mount();
    fireEvent.click(document.getElementById('counter-preview-bg-dark')!);
    leave();
    cleanup();
    mount();
    expect(
      (document.getElementById('chat-preview-bg-checker') as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (document.getElementById('counter-preview-bg-dark') as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (document.getElementById('chat-preview-bg-dark') as HTMLInputElement).checked,
    ).toBe(false);
  });

  it('round-trips a custom preview colour through the draft', () => {
    /* Custom is the one mode whose value is not a fixed id: the chosen hex is
       what persists, so restoring must land back on Custom with that colour and
       not fall through to Transparent. The colour reaches no URL — a separate
       test in this file asserts the background never enters either output. */
    mount();
    fireEvent.click(document.getElementById('chat-preview-bg-custom')!);
    fireEvent.change(document.getElementById('chat-preview-bg-color') as HTMLInputElement, {
      target: { value: '#123456' },
    });
    leave();
    cleanup();
    mount();
    expect(
      (document.getElementById('chat-preview-bg-custom') as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (document.getElementById('chat-preview-bg-color') as HTMLInputElement).value,
    ).toBe('#123456');
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

describe('the Twitch connection lives beside the pinned-message controls', () => {
  /* A well-formed connection id, matching the fragment the OAuth callback emits.
     The login is what the UI shows; the id is never rendered. */
  const CONNECTION_ID = '123e4567-e89b-12d3-a456-426614174000';

  const connectVia = (login: string) => {
    window.location.hash = buildConnectionFragment({
      connectionId: CONNECTION_ID,
      login,
    });
  };

  /* The connection adoption strips the fragment, but a test that fails before it
     mounts could leave one behind for the next test — clear it either way. */
  afterEach(() => {
    window.location.hash = '';
  });

  const settings = () => panel('.panel-chat-settings');
  const hero = () => panel('.card.hero');

  it('shows no Connect Twitch control in Your Channels', () => {
    mount();
    expect(hero().querySelector('.classic-conn')).toBeNull();
    expect(within(hero()).queryByText('Connect')).toBeNull();
    expect(
      within(hero()).queryByRole('link', { name: 'Connect Twitch account' }),
    ).toBeNull();
  });

  it('states that no login is required, in Your Channels', () => {
    mount();
    expect(hero().textContent).toMatch(
      /no login is required for chat or viewer counts/i,
    );
  });

  it('leaves the Twitch channel field a plain input like the others', () => {
    mount();
    const field = document
      .querySelector('label[for="channel-twitch"]')!
      .closest('.platform-input') as HTMLElement;
    // A label and an input, nothing else — the same shape as the other three.
    expect(field.querySelector('.classic-conn')).toBeNull();
    expect(within(field).queryByText('Connect')).toBeNull();
    expect(field.querySelectorAll('input')).toHaveLength(1);
  });

  it('places the connection controls in Chat settings, by the pin platforms', () => {
    mount();
    // The single connection panel now lives in Chat settings.
    expect(document.querySelectorAll('.classic-conn')).toHaveLength(1);
    expect(settings().querySelector('.classic-conn')).not.toBeNull();
    // Beside the pin platform control, in the one wrapper.
    const wrap = settings().querySelector('.mc-pin-connect')!;
    expect(wrap).not.toBeNull();
    expect(wrap.querySelector('.classic-conn')).not.toBeNull();
    expect(settings().querySelector('#mc-pinPlatforms-kick')).not.toBeNull();
  });

  it('orders the connection after the pin platform control in reading order', () => {
    /* jsdom computes no layout, so DOM order is the assertion — it is what a
       screen reader and a phone follow. The connection sits after the pins. */
    mount();
    const pin = settings().querySelector('#mc-pinPlatforms-kick')!;
    const conn = settings().querySelector('.classic-conn')!;
    expect(
      pin.compareDocumentPosition(conn) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('reveals the connection controls only while pins are on', () => {
    mount();
    // Pins default on, so the connection is present.
    expect(settings().querySelector('.classic-conn')).not.toBeNull();
    fireEvent.click(document.getElementById('mc-showPinEnabled')!);
    expect(settings().querySelector('.classic-conn')).toBeNull();
  });

  it('keeps Connect reachable before Twitch is a selected pin platform', () => {
    /* The Twitch pin chip stays disabled until a matching connection exists, so
       gating Connect on that chip would strand a fresh user with no way in. It
       is gated on the pin switch instead, which is why Connect shows here even
       though Twitch is not yet selected. */
    mount();
    expect(
      (document.getElementById('mc-pinPlatforms-twitch') as HTMLInputElement)
        .checked,
    ).toBe(false);
    expect(within(settings()).getByText('Connect')).toBeTruthy();
  });

  it('gives Connect an accurate accessible name and associated help', () => {
    mount();
    const connect = within(settings()).getByRole('link', {
      name: 'Connect Twitch account',
    });
    const describedBy = connect.getAttribute('aria-describedby');
    expect(describedBy).toBe('mc-pin-connect-help');
    expect(document.getElementById(describedBy!)?.textContent).toMatch(
      /only to display native Twitch pinned messages/i,
    );
  });

  it('reuses the authoritative OAuth start URL, not a second implementation', () => {
    mount();
    const href =
      within(settings()).getByText('Connect').getAttribute('href') ?? '';
    expect(href).toContain('/api/twitch/oauth/start');
    expect(href).toContain(encodeURIComponent('/multichat'));
    expect(href).not.toContain('tools');
  });

  it('keeps chat and counter URLs working with no connection', () => {
    /* The whole point of the move: chat and the counter need no login. */
    mount();
    typeChannel('kick', 'somechannel');
    expect(chatUrl().startsWith(`${BASE}/multichat?`)).toBe(true);
    expect(counterUrl().startsWith(`${BASE}/counter?`)).toBe(true);
    // And no connection id leaks into either displayed URL.
    expect(chatUrl()).not.toContain(CONNECTION_ID);
    expect(counterUrl()).not.toContain(CONNECTION_ID);
  });

  it('shows the connected login and a Disconnect action once connected', () => {
    connectVia('streamer');
    mount();
    expect(settings().textContent).toContain('Connected as');
    expect(settings().textContent).toContain('streamer');
    expect(within(settings()).getByText('Disconnect')).toBeTruthy();
    // No Connect link while a connection exists.
    expect(within(settings()).queryByText('Connect')).toBeNull();
    // The opaque id is never rendered.
    expect(settings().textContent).not.toContain(CONNECTION_ID);
  });

  it('warns and offers a one-click fix when the channel does not match', () => {
    connectVia('streamer');
    mount();
    typeChannel('twitch', 'someoneelse');
    expect(
      within(settings()).getByText(/does not match the connected account/i),
    ).toBeTruthy();
    fireEvent.click(within(settings()).getByText('Use connected channel'));
    expect(
      (document.getElementById('channel-twitch') as HTMLInputElement).value,
    ).toBe('streamer');
    // The correction resolves the mismatch, so the warning clears.
    expect(within(settings()).queryByText(/does not match/i)).toBeNull();
    expect(within(settings()).queryByText('Use connected channel')).toBeNull();
  });

  it('drops the warning once the channel matches the connected account', () => {
    connectVia('streamer');
    mount();
    typeChannel('twitch', 'streamer');
    expect(settings().textContent).toContain('Connected as');
    expect(within(settings()).queryByText(/does not match/i)).toBeNull();
    expect(within(settings()).queryByText(/Set the Twitch channel/i)).toBeNull();
    expect(within(settings()).queryByText('Use connected channel')).toBeNull();
  });

  it('disconnects, returning to the Connect control', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    vi.stubGlobal('fetch', fetchMock);
    connectVia('streamer');
    mount();
    fireEvent.click(within(settings()).getByText('Disconnect'));
    // Flush the disconnect's microtasks so local state clears.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/twitch/oauth/disconnect',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(within(settings()).getByText('Connect')).toBeTruthy();
    expect(settings().textContent).not.toContain('Connected as');
    vi.unstubAllGlobals();
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

  it('documents the counter background bridge for the separate counter source', () => {
    mount();
    const text = panel('[aria-labelledby="commands-heading"]').textContent ?? '';
    expect(text).toContain('!multichat counterbgon');
    expect(text).toContain('!multichat counterbgoff');
    expect(text).toMatch(/separate viewer-counter browser source/i);
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
  it('offers no Live/Demo switch, message creator, or test tools', () => {
    mount();
    const text = document.body.textContent ?? '';
    for (const gone of [/demo/i, /message creator/i, /command simulator/i, /test tools/i]) {
      expect(text).not.toMatch(gone);
    }
  });

  it('names no control that switches the previews between live and sample content', () => {
    /* This replaced a /sample message/i scan of the whole page. That pattern was
       standing in for the retired Demo panel's own heading, and it stopped
       distinguishing anything once labelled fixtures became a requirement: the
       captions now say "sample messages" precisely so nobody mistakes invented
       chat for a real stream, and a text scan cannot tell that caption from the
       panel it was written to detect.

       What actually has to stay gone is the *switch* — a control the user picks
       live or sample content with. Fixtures are not a mode: they are what a panel
       with no channel shows, and typing a channel is the only thing that ends
       them. So the assertion is structural, over every interactive control on the
       page, which is what the old regex was a weak proxy for.

       The pattern is about that pairing rather than about the bare word "live",
       and the distinction now carries weight: the preview feed's controls are
       named "Live preview feed" and "Live counter simulation", where "live" means
       the fixtures are moving rather than frozen. Neither offers a choice of
       content source — both animate the samples that a channel-less panel was
       already showing, and typing a channel still replaces the whole panel with
       the real overlay. A bare /\blive\b/ could not tell those apart from the
       mode switch this test exists to keep out, so it matched the honest label
       and would have forced it to be renamed to something less accurate. What
       identifies the retired control is that it named both sides of a choice, or
       named a mode outright. */
    mount();
    const modeSwitch = [
      /\blive\b[^.]*\b(sample|fixture|demo|test)\b/i,
      /\b(sample|fixture|demo|test)\b[^.]*\blive\b/i,
      /\b(live|sample|fixture|demo|test)\s+mode\b/i,
      /\bswitch to (live|sample|demo)\b/i,
    ];
    const controls = Array.from(
      document.querySelectorAll<HTMLElement>('button, input, select, [role="switch"], [role="tab"]'),
    );
    for (const control of controls) {
      const name = [
        control.textContent ?? '',
        control.getAttribute('aria-label') ?? '',
        control.getAttribute('value') ?? '',
        document.querySelector(`label[for="${control.id}"]`)?.textContent ?? '',
      ].join(' ');
      expect(name).not.toMatch(/\bdemo\b/i);
      for (const pattern of modeSwitch) expect(name, name).not.toMatch(pattern);
    }
  });

  it('renders configured previews through their live production paths when selected', () => {
  /* Chat keeps the exact generated overlay iframe. The Counter keeps the
     production renderer but polls in the parent document and renders into a
     local isolated frame, so no nested /counter navigation can be blocked. */
  mount();
  typeChannel('kick', 'somechannel');
  fireEvent.click(screen.getByRole('tab', { name: 'Live Overlay' }));
  settle();

  const chatFrame = document.querySelector<HTMLIFrameElement>(
    'iframe[title="Live chat overlay preview"]',
  );
  const counterLive = document.querySelector<HTMLElement>(
    '[data-testid="counter-live-preview"]',
  );
  const counterFrame = document.querySelector<HTMLIFrameElement>(
    'iframe[title="Live viewer counter preview"]',
  );

  expect(chatFrame?.getAttribute('src')?.startsWith(BASE)).toBe(true);
  expect(counterLive?.getAttribute('data-overlay-url')).toBe(counterUrl());
  expect(counterFrame?.getAttribute('src')).toBeNull();
  expect(document.querySelectorAll('iframe')).toHaveLength(2);
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
    expect(within(chat).getAllByText('Preview Data').length).toBeGreaterThan(0);
    /* No mode switch came back with it: nothing toggles between live and sample
       content, because a configured channel decides that on its own. */
    expect(chat.textContent ?? '').not.toMatch(/\bdemo\b/i);
  });

  it('marks the counter panel s sample numbers as samples too', () => {
    /* This test used to asert the counter's "enter a channel" placeholder, which
       was the honest empty case while the counter had no fixtures. It has them
       now, so the requirement is the same one the chat panel carries: sample
       numbers must be labelled as samples, not passed off as a real audience. */
    mount();
    const counter = panel('.panel-counter-output');
    expect(within(counter).getByTestId('counter-fixture-preview')).toBeTruthy();
    expect(within(counter).getByText('Preview Data')).toBeTruthy();
    /* No mode switch here either: a configured channel decides live vs sample. */
    expect(counter.textContent ?? '').not.toMatch(/\bdemo\b/i);
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
