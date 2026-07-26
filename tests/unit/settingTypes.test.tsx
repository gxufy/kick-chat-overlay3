/* The generic setting controls.
 *
 * These lock the properties every tool relies on: each of the six descriptor
 * types renders its own control, every control is reachable and named, and the
 * value each emits is correctly typed for the setting's key. Encoding — CSV,
 * repeated params, bitmasks, colour normalization — deliberately lives in the
 * tools, so none of it is exercised or permitted here.
 */
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import SettingRow from '@/components/workspace/SettingRow';
import SettingsList from '@/components/workspace/SettingsList';
import ToolConfigPanel from '@/components/workspace/ToolConfigPanel';
import { COUNTER_CATALOG } from '@/lib/tools/counter/settings';
import { counterTool } from '@/lib/tools/counter/config';
import {
  DEFAULT_STYLE,
  buildViewerCounterQuery,
  type ViewerCounterStyle,
} from '@/lib/viewerCounterConfig';
import type {
  ColorSetting,
  MultiSelectSetting,
  NumberSetting,
  SelectSetting,
  Setting,
  SettingCatalog,
  SettingValue,
  TextSetting,
  ToggleSetting,
} from '@/lib/tools/settingTypes';

type Demo = {
  flag: boolean;
  choice: string;
  name: string;
  tint: string;
  fade: number;
  plats: readonly string[];
};

const DEFAULTS: Demo = {
  flag: true,
  choice: 'b',
  name: 'hello',
  tint: '#AbC',
  fade: 4,
  plats: ['kick', 'twitch'],
};

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Bravo' },
] as const;

const PLATFORMS = [
  { value: 'kick', label: 'Kick' },
  { value: 'twitch', label: 'Twitch' },
  { value: 'youtube', label: 'YouTube' },
] as const;

afterEach(cleanup);

/* Typed per variant, so a spread in a test still narrows to its own variant
 * and cannot silently add a property the variant does not declare. */
const SETTINGS = {
  flag: {
    key: 'flag',
    param: 'f',
    label: 'Flag',
    type: 'toggle',
    default: DEFAULTS.flag,
  } satisfies ToggleSetting<Demo>,
  choice: {
    key: 'choice',
    param: 'c',
    label: 'Choice',
    type: 'select',
    options: OPTIONS,
    default: DEFAULTS.choice,
  } satisfies SelectSetting<Demo>,
  name: {
    key: 'name',
    param: 'n',
    label: 'Name',
    type: 'text',
    default: DEFAULTS.name,
  } satisfies TextSetting<Demo>,
  tint: {
    key: 'tint',
    param: 't',
    label: 'Tint',
    type: 'color',
    default: DEFAULTS.tint,
  } satisfies ColorSetting<Demo>,
  fade: {
    key: 'fade',
    param: 'fd',
    label: 'Fade',
    type: 'number',
    default: DEFAULTS.fade,
    min: 0,
    max: 60,
    step: 1,
    unit: 'seconds',
  } satisfies NumberSetting<Demo>,
  plats: {
    key: 'plats',
    param: 'p',
    label: 'Platforms',
    type: 'multiselect',
    options: PLATFORMS,
    default: DEFAULTS.plats,
  } satisfies MultiSelectSetting<Demo>,
};

/** Render one row against the demo defaults, returning the change spy. */
function row(setting: Setting<Demo>, value: SettingValue = DEFAULTS[setting.key]) {
  const onChange = vi.fn<(key: keyof Demo & string, next: SettingValue) => void>();
  render(<SettingRow setting={setting} value={value} onChange={onChange} />);
  return onChange;
}

describe('every union member renders its own control', () => {
  it('toggle renders a checkbox switch reflecting the config value', () => {
    row(SETTINGS.flag, false);
    const input = screen.getByLabelText('Flag');
    expect(input).toHaveProperty('type', 'checkbox');
    expect(input).toHaveProperty('checked', false);
  });

  it('select renders a native select with the declared options', () => {
    row(SETTINGS.choice);
    const input = screen.getByLabelText('Choice') as HTMLSelectElement;
    expect(input.tagName).toBe('SELECT');
    expect([...input.options].map((option) => option.value)).toEqual(['a', 'b']);
    expect(input.value).toBe('b');
  });

  it('text renders a text field holding the config string', () => {
    row(SETTINGS.name);
    expect(screen.getByLabelText('Name')).toHaveProperty('value', 'hello');
  });

  it('color renders a text value plus a swatch', () => {
    row(SETTINGS.tint);
    expect(screen.getByLabelText('Tint')).toHaveProperty('value', '#AbC');
    expect(screen.getByLabelText('Colour swatch')).toHaveProperty('type', 'color');
  });

  it('number renders a numeric field holding the config number', () => {
    row(SETTINGS.fade);
    const input = screen.getByLabelText('Fade') as HTMLInputElement;
    expect(input.type).toBe('number');
    expect(input.value).toBe('4');
    expect([input.min, input.max, input.step]).toEqual(['0', '60', '1']);
  });

  it('multiselect renders one checkbox per option, checked by value', () => {
    row(SETTINGS.plats);
    const boxes = PLATFORMS.map(
      (option) => screen.getByLabelText(option.label) as HTMLInputElement,
    );
    expect(boxes.map((box) => box.type)).toEqual(['checkbox', 'checkbox', 'checkbox']);
    expect(boxes.map((box) => box.checked)).toEqual([true, true, false]);
  });

  it('the switch is exhaustive: the never branch is unreachable at runtime', () => {
    // A descriptor with an unknown type cannot be constructed without a cast,
    // which is the compile-time guarantee. If one is forced through, the never
    // branch returns it and React refuses to render it.
    const rogue = { key: 'flag', param: 'f', label: 'X', type: 'slider', default: 1 };
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <SettingRow
          setting={rogue as unknown as Setting<Demo>}
          value={1}
          onChange={() => {}}
        />,
      ),
    ).toThrow();
    quiet.mockRestore();
  });
});

describe('accessibility', () => {
  const named = [
    ['toggle', SETTINGS.flag, 'Flag'],
    ['select', SETTINGS.choice, 'Choice'],
    ['text', SETTINGS.name, 'Name'],
    ['color', SETTINGS.tint, 'Tint'],
    ['number', SETTINGS.fade, 'Fade'],
  ] as const;

  for (const [type, setting, label] of named) {
    it(`${type} associates exactly one label with its input`, () => {
      row(setting);
      expect(screen.getAllByText(label, { selector: 'label' })).toHaveLength(1);
      expect(screen.getByLabelText(label).id).toBe(`setting-${setting.key}`);
    });
  }

  it('multiselect names the group without a second label for the fieldset', () => {
    row(SETTINGS.plats);
    expect(screen.getAllByText('Platforms')).toHaveLength(2); // row text + sr legend
    expect(screen.queryByText('Platforms', { selector: 'label' })).toBeNull();
    for (const option of PLATFORMS) {
      expect(screen.getByLabelText(option.label).id).toBe(`setting-plats-${option.value}`);
    }
  });

  it('links the description to the control', () => {
    row({ ...SETTINGS.flag, description: 'Explains the flag' });
    const input = screen.getByLabelText('Flag');
    expect(input.getAttribute('aria-describedby')).toBe('setting-flag-desc');
    expect(screen.getByText('Explains the flag').id).toBe('setting-flag-desc');
  });

  it('links a text setting description without adding a second label', () => {
    row({ ...SETTINGS.name, description: 'Explains the name' });
    const input = screen.getByLabelText('Name');
    expect(screen.getAllByText('Name', { selector: 'label' })).toHaveLength(1);
    expect(input.getAttribute('aria-describedby')).toBe('setting-name-desc');
    expect(screen.getByText('Explains the name').id).toBe('setting-name-desc');
  });

  it('exposes the unit as text, not as part of the value', () => {
    row(SETTINGS.fade);
    const input = screen.getByLabelText('Fade');
    expect(input.getAttribute('aria-describedby')).toBe('setting-fade-unit');
    expect(screen.getByText('seconds').id).toBe('setting-fade-unit');
    expect(input).toHaveProperty('value', '4');
  });

  it('announces why a control is disabled', () => {
    row({ ...SETTINGS.choice, disabled: true, disabledReason: 'Sign in first' });
    const input = screen.getByLabelText('Choice');
    expect(input.getAttribute('aria-describedby')).toBe('setting-choice-reason');
    expect(screen.getByText('Sign in first').id).toBe('setting-choice-reason');
  });

  it('wraps a disabled row in a disabled fieldset, whatever the control type', () => {
    // A <fieldset disabled> makes descendant controls inert natively, so no
    // control needs its own disabled prop. The IDL `disabled` of a descendant
    // input keeps reflecting its own attribute, so the fieldset is what to
    // assert on.
    for (const setting of [SETTINGS.flag, SETTINGS.choice, SETTINGS.fade]) {
      row({ ...setting, disabled: true });
      const group = screen.getByLabelText(setting.label).closest('fieldset');
      expect(group).not.toBeNull();
      expect(group).toHaveProperty('disabled', true);
      cleanup();
    }
  });

  it('an enabled row renders no fieldset wrapper at all', () => {
    row(SETTINGS.flag);
    expect(screen.getByLabelText('Flag').closest('fieldset')).toBeNull();
  });

  it('disables the controls that carry their own disabled attribute', () => {
    row({ ...SETTINGS.plats, disabled: true });
    for (const option of PLATFORMS) {
      expect(screen.getByLabelText(option.label)).toHaveProperty('disabled', true);
    }
    cleanup();

    row({ ...SETTINGS.fade, disabled: true });
    expect(screen.getByLabelText('Fade')).toHaveProperty('disabled', true);
    cleanup();

    row({ ...SETTINGS.tint, disabled: true });
    expect(screen.getByLabelText('Tint')).toHaveProperty('disabled', true);
  });

  /* Inertness is the platform's job: a browser dispatches no click on a
   * disabled control, and a fieldset disables its descendants. fireEvent
   * dispatches events regardless of either, so it cannot demonstrate this —
   * the disabled attribute and the fieldset wrapper asserted above are what
   * carry the behaviour. */

  it('a disabled text row is not editable', () => {
    row({ ...SETTINGS.name, disabled: true });
    expect(screen.getByLabelText('Name')).toHaveProperty('readOnly', true);
  });
});

describe('change payloads are correctly typed per setting', () => {
  it('toggle emits a boolean for its own key', () => {
    const onChange = row(SETTINGS.flag, true);
    fireEvent.click(screen.getByLabelText('Flag'));
    expect(onChange).toHaveBeenCalledWith('flag', false);
  });

  it('select emits the chosen option value', () => {
    const onChange = row(SETTINGS.choice);
    fireEvent.change(screen.getByLabelText('Choice'), { target: { value: 'a' } });
    expect(onChange).toHaveBeenCalledWith('choice', 'a');
  });

  it('text emits the raw string', () => {
    const onChange = row(SETTINGS.name);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: ' Ab C ' } });
    expect(onChange).toHaveBeenCalledWith('name', ' Ab C ');
  });

  it('text honours maxLength without native truncation surprises', () => {
    const onChange = row({ ...SETTINGS.name, maxLength: 4 });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'abcdefg' } });
    expect(onChange).toHaveBeenCalledWith('name', 'abcd');
  });

  it('text emits an empty string rather than dropping the change', () => {
    const onChange = row(SETTINGS.name);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith('name', '');
  });

  it('color emits a string, number emits a number, multiselect emits an array', () => {
    const tint = row(SETTINGS.tint);
    fireEvent.change(screen.getByLabelText('Tint'), { target: { value: '#00ff00' } });
    expect(tint.mock.calls[0][1]).toBe('#00ff00');
    cleanup();

    const fade = row(SETTINGS.fade);
    fireEvent.change(screen.getByLabelText('Fade'), { target: { value: '7' } });
    expect(fade.mock.calls[0][1]).toBe(7);
    cleanup();

    const plats = row(SETTINGS.plats);
    fireEvent.click(screen.getByLabelText('YouTube'));
    expect(plats.mock.calls[0][1]).toEqual(['kick', 'twitch', 'youtube']);
  });

  it('falls back to the descriptor default when the config value is the wrong shape', () => {
    row(SETTINGS.fade, 'not a number');
    expect(screen.getByLabelText('Fade')).toHaveProperty('value', '4');
  });
});

describe('multiselect behaviour', () => {
  it('an empty selection is a valid value, not a reset to defaults', () => {
    row(SETTINGS.plats, []);
    for (const option of PLATFORMS) {
      expect(screen.getByLabelText(option.label)).toHaveProperty('checked', false);
    }
  });

  it('selecting adds once, and a repeated selection cannot duplicate', () => {
    const onChange = row(SETTINGS.plats, ['kick']);
    fireEvent.click(screen.getByLabelText('Twitch'));
    expect(onChange).toHaveBeenCalledWith('plats', ['kick', 'twitch']);
    // The control is controlled, so re-clicking the same unchanged value
    // cannot append a second copy.
    fireEvent.click(screen.getByLabelText('Twitch'));
    expect(onChange.mock.calls[1][1]).toEqual(['kick', 'twitch']);
  });

  it('deselecting removes only that value', () => {
    const onChange = row(SETTINGS.plats, ['kick', 'twitch', 'youtube']);
    fireEvent.click(screen.getByLabelText('Twitch'));
    expect(onChange).toHaveBeenCalledWith('plats', ['kick', 'youtube']);
  });

  it('emitted order follows the declared options, not click order', () => {
    const onChange = row(SETTINGS.plats, ['youtube']);
    fireEvent.click(screen.getByLabelText('Kick'));
    expect(onChange).toHaveBeenCalledWith('plats', ['kick', 'youtube']);
  });

  it('emitted values are deduplicated even from a duplicated config value', () => {
    const onChange = row(SETTINGS.plats, ['kick', 'kick']);
    fireEvent.click(screen.getByLabelText('Twitch'));
    expect(onChange).toHaveBeenCalledWith('plats', ['kick', 'twitch']);
  });

  it('drops values that are not declared options', () => {
    const onChange = row(SETTINGS.plats, ['kick', 'myspace']);
    fireEvent.click(screen.getByLabelText('Twitch'));
    expect(onChange).toHaveBeenCalledWith('plats', ['kick', 'twitch']);
  });

  it('every checkbox is keyboard reachable and space-operable', () => {
    const onChange = row(SETTINGS.plats, []);
    const box = screen.getByLabelText('Kick') as HTMLInputElement;
    box.focus();
    expect(document.activeElement).toBe(box);
    fireEvent.click(box); // what space produces on a focused checkbox
    expect(onChange).toHaveBeenCalledWith('plats', ['kick']);
  });
});

describe('colour behaviour', () => {
  it('does not change case or expand shorthand', () => {
    const onChange = row(SETTINGS.tint);
    const input = screen.getByLabelText('Tint');
    expect(input).toHaveProperty('value', '#AbC');
    fireEvent.change(input, { target: { value: '#DEF' } });
    expect(onChange).toHaveBeenCalledWith('tint', '#DEF');
  });

  it('accepts the exact string transparent when allowed', () => {
    const setting = { ...SETTINGS.tint, allowTransparent: true };
    const onChange = row(setting, '#ffffff');
    fireEvent.change(screen.getByLabelText('Tint'), { target: { value: 'transparent' } });
    expect(onChange).toHaveBeenCalledWith('tint', 'transparent');
    cleanup();

    row(setting, 'transparent');
    expect(screen.getByLabelText('Tint')).toHaveProperty('value', 'transparent');
    // The swatch cannot represent transparency, so it steps aside rather than
    // offering a colour that would overwrite the value.
    expect(screen.getByLabelText('Colour swatch')).toHaveProperty('disabled', true);
  });

  it('never throws on an invalid intermediate value, and emits it verbatim', () => {
    for (const intermediate of ['', '#', '#a', '#ab', 'rebeccapurple', 'nonsense']) {
      const onChange = row(SETTINGS.tint, intermediate);
      const input = screen.getByLabelText('Tint');
      expect(input).toHaveProperty('value', intermediate);
      fireEvent.change(input, { target: { value: `${intermediate}x` } });
      expect(onChange).toHaveBeenCalledWith('tint', `${intermediate}x`);
      cleanup();
    }
  });

  it('the swatch mirrors a hex value without rewriting the text value', () => {
    row(SETTINGS.tint, '#aabbcc');
    expect(screen.getByLabelText('Colour swatch')).toHaveProperty('value', '#aabbcc');
    expect(screen.getByLabelText('Tint')).toHaveProperty('value', '#aabbcc');
  });

  it('the swatch emits through the same change channel', () => {
    const onChange = row(SETTINGS.tint);
    fireEvent.change(screen.getByLabelText('Colour swatch'), {
      target: { value: '#123456' },
    });
    expect(onChange).toHaveBeenCalledWith('tint', '#123456');
  });
});

describe('number behaviour', () => {
  it('emits finite numbers, never strings', () => {
    const onChange = row(SETTINGS.fade);
    fireEvent.change(screen.getByLabelText('Fade'), { target: { value: '12' } });
    expect(onChange).toHaveBeenCalledWith('fade', 12);
    expect(typeof onChange.mock.calls[0][1]).toBe('number');
  });

  it('never emits NaN for an empty or partial entry', () => {
    const onChange = row(SETTINGS.fade);
    for (const partial of ['', '   ', '-', '.', 'abc', '1e', '--2']) {
      fireEvent.change(screen.getByLabelText('Fade'), { target: { value: partial } });
    }
    expect(onChange).not.toHaveBeenCalled();
  });

  it('emits zero and negative values rather than treating them as absent', () => {
    const onChange = row(SETTINGS.fade);
    fireEvent.change(screen.getByLabelText('Fade'), { target: { value: '0' } });
    expect(onChange).toHaveBeenCalledWith('fade', 0);
    fireEvent.change(screen.getByLabelText('Fade'), { target: { value: '-3' } });
    expect(onChange).toHaveBeenCalledWith('fade', -3);
  });

  it('does not clamp beyond the browser constraints it declares', () => {
    const onChange = row(SETTINGS.fade);
    fireEvent.change(screen.getByLabelText('Fade'), { target: { value: '999' } });
    expect(onChange).toHaveBeenCalledWith('fade', 999);
  });

  it('omits min, max, and step when the descriptor declares none', () => {
    row({ key: 'fade', param: 'fd', label: 'Fade', type: 'number', default: 4 });
    const input = screen.getByLabelText('Fade');
    expect(input.hasAttribute('min')).toBe(false);
    expect(input.hasAttribute('max')).toBe(false);
    expect(input.hasAttribute('step')).toBe(false);
    expect(input.getAttribute('aria-describedby')).toBeNull();
  });
});

describe('SettingsList threads values into rows', () => {
  const CATALOG: SettingCatalog<Demo> = [
    SETTINGS.flag,
    SETTINGS.choice,
    { ...SETTINGS.name, hidden: true },
  ];

  it('renders visible settings only, valued from the supplied config', () => {
    render(
      <SettingsList
        catalog={CATALOG}
        config={{ ...DEFAULTS, flag: false, choice: 'a' }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText('Flag')).toHaveProperty('checked', false);
    expect(screen.getByLabelText('Choice')).toHaveProperty('value', 'a');
    expect(screen.queryByLabelText('Name')).toBeNull();
  });

  it('forwards boolean and string changes to the shell handler', () => {
    const onChange = vi.fn();
    render(<SettingsList catalog={CATALOG} config={DEFAULTS} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Flag'));
    fireEvent.change(screen.getByLabelText('Choice'), { target: { value: 'a' } });
    expect(onChange.mock.calls).toEqual([
      ['flag', false],
      ['choice', 'a'],
    ]);
  });
});

/* The point of these is the whole path, not one row: SettingRow →
 * SettingsList → ToolConfigPanel → the state owner. Every value shape has to
 * arrive at the top intact, because that is where the earlier version of this
 * batch silently dropped numbers and arrays. */
describe('the full setting pipeline carries every value type', () => {
  const FULL: SettingCatalog<Demo> = [
    SETTINGS.flag,
    SETTINGS.choice,
    SETTINGS.name,
    SETTINGS.tint,
    SETTINGS.fade,
    SETTINGS.plats,
  ];

  /** Renders the real panel over a stateful owner, as the workspace does. */
  function pipeline(initial: Demo = DEFAULTS) {
    const seen: [string, SettingValue][] = [];
    let latest: Demo = initial;

    function Owner() {
      const [config, setConfig] = useState<Demo>(initial);
      latest = config;
      return (
        <ToolConfigPanel
          toolLabel="Demo"
          catalog={FULL}
          config={config}
          onChange={(key, next) => {
            seen.push([key, next]);
            setConfig((current) => ({ ...current, [key]: next }));
          }}
        />
      );
    }

    render(<Owner />);
    return { seen, config: () => latest };
  }

  it('a toggle reaches the state owner as a boolean', () => {
    const { seen, config } = pipeline();
    fireEvent.click(screen.getByLabelText('Flag'));
    expect(seen).toEqual([['flag', false]]);
    expect(config().flag).toBe(false);
  });

  it('a select reaches the state owner as a string', () => {
    const { seen, config } = pipeline();
    fireEvent.change(screen.getByLabelText('Choice'), { target: { value: 'a' } });
    expect(seen).toEqual([['choice', 'a']]);
    expect(config().choice).toBe('a');
  });

  it('a text field reaches the state owner as a string', () => {
    const { seen, config } = pipeline();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'goodbye' } });
    expect(seen).toEqual([['name', 'goodbye']]);
    expect(config().name).toBe('goodbye');
  });

  it('a colour reaches the state owner as a verbatim string', () => {
    const { seen, config } = pipeline();
    fireEvent.change(screen.getByLabelText('Tint'), { target: { value: '#FFeeDD' } });
    expect(seen).toEqual([['tint', '#FFeeDD']]);
    expect(config().tint).toBe('#FFeeDD');
  });

  it('a number reaches the state owner as a number, never a string', () => {
    const { seen, config } = pipeline();
    fireEvent.change(screen.getByLabelText('Fade'), { target: { value: '9' } });
    expect(seen).toEqual([['fade', 9]]);
    expect(typeof seen[0][1]).toBe('number');
    expect(config().fade).toBe(9);
    expect(typeof config().fade).toBe('number');
  });

  it('a multiselect reaches the state owner as a string array, never CSV', () => {
    const { seen, config } = pipeline({ ...DEFAULTS, plats: [] });
    fireEvent.click(screen.getByLabelText('Twitch'));
    expect(seen).toEqual([['plats', ['twitch']]]);
    expect(Array.isArray(seen[0][1])).toBe(true);
    expect(typeof seen[0][1]).not.toBe('string');
    expect(config().plats).toEqual(['twitch']);
  });

  it('discards nothing: six interactions produce six updates', () => {
    const { seen, config } = pipeline({ ...DEFAULTS, plats: [] });
    fireEvent.click(screen.getByLabelText('Flag'));
    fireEvent.change(screen.getByLabelText('Choice'), { target: { value: 'a' } });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'x' } });
    fireEvent.change(screen.getByLabelText('Tint'), { target: { value: '#0f0' } });
    fireEvent.change(screen.getByLabelText('Fade'), { target: { value: '30' } });
    fireEvent.click(screen.getByLabelText('YouTube'));

    expect(seen.map(([key]) => key)).toEqual([
      'flag',
      'choice',
      'name',
      'tint',
      'fade',
      'plats',
    ]);
    expect(config()).toEqual({
      flag: false,
      choice: 'a',
      name: 'x',
      tint: '#0f0',
      fade: 30,
      plats: ['youtube'],
    });
  });

  it('multiselect order through the pipeline follows the declared options', () => {
    const { config } = pipeline({ ...DEFAULTS, plats: [] });
    fireEvent.click(screen.getByLabelText('YouTube'));
    fireEvent.click(screen.getByLabelText('Kick'));
    fireEvent.click(screen.getByLabelText('Twitch'));
    expect(config().plats).toEqual(['kick', 'twitch', 'youtube']);
  });

  it('does not mutate the array it emitted', () => {
    const { seen, config } = pipeline({ ...DEFAULTS, plats: [] });
    fireEvent.click(screen.getByLabelText('Kick'));
    const emitted = seen[0][1] as readonly string[];
    fireEvent.click(screen.getByLabelText('Twitch'));
    expect(emitted).toEqual(['kick']);
    expect(config().plats).toEqual(['kick', 'twitch']);
    expect(config().plats).not.toBe(emitted);
  });

  it('an invalid number entry reaches the owner as no update at all', () => {
    const { seen, config } = pipeline();
    fireEvent.change(screen.getByLabelText('Fade'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Fade'), { target: { value: 'abc' } });
    expect(seen).toEqual([]);
    expect(config().fade).toBe(DEFAULTS.fade);
  });
});

/* The widened union must not disturb the one catalog that ships today. This
 * drives the real counter catalog through the real panel and normalizer, and
 * checks the serialized query the workspace would build from the result. */
describe('the counter catalog still behaves exactly as before', () => {
  const CHANNELS = { twitch: 'someone', kick: 'other_1' };

  function counterPipeline() {
    let latest: ViewerCounterStyle = DEFAULT_STYLE;
    function Owner() {
      const [style, setStyle] = useState<ViewerCounterStyle>(DEFAULT_STYLE);
      latest = style;
      return (
        <ToolConfigPanel
          toolLabel="Viewer Counter"
          catalog={COUNTER_CATALOG}
          config={style}
          onChange={(key, next) =>
            setStyle((current) => counterTool.normalize({ ...current, [key]: next }))
          }
        />
      );
    }
    render(<Owner />);
    return () => latest;
  }

  it('renders every counter setting as a toggle or select', () => {
    counterPipeline();
    for (const setting of COUNTER_CATALOG) {
      const input = screen.getByLabelText(setting.label);
      expect(['INPUT', 'SELECT']).toContain(input.tagName);
    }
  });

  it('updates booleans and strings, and serializes identically', () => {
    const style = counterPipeline();
    fireEvent.click(screen.getByLabelText('Combined total'));
    fireEvent.change(screen.getByLabelText('Text shadow'), {
      target: { value: 'large' },
    });
    expect(style()).toEqual({
      ...DEFAULT_STYLE,
      combined: !DEFAULT_STYLE.combined,
      textShadow: 'large',
    });
    expect(counterTool.serialize(CHANNELS, style())).toBe(
      buildViewerCounterQuery(CHANNELS, style()),
    );
  });

  it('produces the same query as the defaults before any interaction', () => {
    const style = counterPipeline();
    expect(counterTool.serialize(CHANNELS, style())).toBe(
      buildViewerCounterQuery(CHANNELS, DEFAULT_STYLE),
    );
  });
});
