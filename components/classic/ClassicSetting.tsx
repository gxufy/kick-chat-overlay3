/* One catalog setting, rendered in the Classic generator's visual language.
 *
 * This is the Classic counterpart to components/workspace/SettingRow: same
 * catalog descriptors, same availability gating, same accessibility wiring —
 * different markup. The workspace row is a Tailwind label-left/control-right
 * strip; Classic rows are `.form_row.left` (control then label), `.toggle-wrap`
 * pills, and chip groups, which is a large part of what the page looks like.
 *
 * Two things it deliberately does not do:
 *
 *   - Invent labels, options, defaults, or descriptions. Everything rendered
 *     comes off the descriptor, so adding a setting to a catalog is enough and
 *     the Classic page cannot describe a control the overlay does not have.
 *   - Assume a single instance per page. Every id is built from a caller-supplied
 *     prefix, because MultiChat and the Viewer Counter both have `stroke` and
 *     `textShadow`, and they are now on the same page. Unprefixed ids would give
 *     two inputs the same id and point one label at the wrong control.
 */
import type { ReactElement } from 'react';
import {
  optionAvailable,
  type Setting,
  type SettingAvailability,
  type SettingValue,
} from '@/lib/tools/settingTypes';

/** Read a value as a string list, falling back when state disagrees. */
function asStringList(
  value: SettingValue,
  fallback: readonly string[],
): readonly string[] {
  if (typeof value !== 'object' || value === null) return fallback;
  return value;
}

/** Distinct reasons for currently-gated options, deduplicated. */
function unavailableReasons<C>(
  setting: Setting<C>,
  availability: SettingAvailability | undefined,
): string[] {
  if (!availability) return [];
  if (setting.type !== 'multiselect' && setting.type !== 'select') return [];

  const reasons: string[] = [];
  for (const option of setting.options) {
    const state = optionAvailable(availability, option.value);
    if (state.available) continue;
    if (state.reason && !reasons.includes(state.reason)) reasons.push(state.reason);
  }
  return reasons;
}

export default function ClassicSetting<C>({
  setting,
  value,
  onChange,
  availability,
  idPrefix,
  /** Renders each option in the face it names — the font picker's whole point. */
  optionStyle,
  /** Applied to the control itself, e.g. the font picker's own preview face. */
  controlStyle,
}: {
  setting: Setting<C>;
  value: SettingValue;
  onChange: (key: keyof C & string, next: SettingValue) => void;
  availability?: SettingAvailability;
  /** Namespace for this setting's ids, e.g. 'mc' or 'vc'. */
  idPrefix: string;
  optionStyle?: (optionValue: string) => React.CSSProperties | undefined;
  controlStyle?: React.CSSProperties;
}) {
  const inputId = `${idPrefix}-${setting.key}`;
  const descriptionId = setting.description ? `${inputId}-desc` : undefined;
  const reasonId = setting.disabledReason ? `${inputId}-reason` : undefined;

  /* The catalog's static flags, honoured rather than assumed absent. Neither
     catalog sets either today, and the generator picks its controls by hand — but
     a control that silently ignored `disabled` would be editable while claiming
     not to be, and one that ignored `hidden` would expose a parked parameter. */
  if (setting.hidden) return null;
  const disabled = setting.disabled === true;

  const gatedReasons = unavailableReasons(setting, availability);
  const gatedId = gatedReasons.length > 0 ? `${inputId}-gated` : undefined;
  const describedBy =
    [descriptionId, reasonId, gatedId].filter(Boolean).join(' ') || undefined;

  /* Helper text and gating reasons, in the accessibility tree via
     aria-describedby rather than only visible — a greyed-out option with no
     stated reason tells the user nothing about how to enable it, and colour
     alone is not an accessible signal. */
  const help = (
    <>
      {setting.description ? (
        <p id={descriptionId} className="classic-help">
          {setting.description}
        </p>
      ) : null}
      {setting.disabledReason ? (
        <p id={reasonId} className="classic-help">
          {setting.disabledReason}
        </p>
      ) : null}
      {gatedId ? (
        <div id={gatedId}>
          {gatedReasons.map((reason) => (
            <p key={reason} className="classic-help warn">
              {reason}
            </p>
          ))}
        </div>
      ) : null}
    </>
  );

  switch (setting.type) {
    /* Control first, then label — the Classic select row's own order. */
    case 'select':
      return (
        <div className="classic-field">
          <div className="form_row left">
            <select
              id={inputId}
              value={typeof value === 'string' ? value : setting.default}
              aria-describedby={describedBy}
              disabled={disabled}
              style={controlStyle}
              onChange={(e) => onChange(setting.key, e.target.value)}
            >
              {setting.options.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={!optionAvailable(availability, option.value).available}
                  style={optionStyle?.(option.value)}
                >
                  {option.label}
                </option>
              ))}
            </select>
            <label htmlFor={inputId}>{setting.label}</label>
          </div>
          {help}
        </div>
      );

    /* The Classic pill switch, unchanged in look: a real checkbox inside a
       `.toggle` label, with the slider drawn by CSS from its :checked state. */
    case 'toggle':
      return (
        <div className="classic-field">
          <div className="toggle-wrap">
            <label htmlFor={inputId}>{setting.label}</label>
            <span className="toggle">
              <input
                id={inputId}
                type="checkbox"
                checked={typeof value === 'boolean' ? value : setting.default}
                aria-describedby={describedBy}
                disabled={disabled}
                onChange={(e) => onChange(setting.key, e.target.checked)}
              />
              <span className="toggle-slider" aria-hidden="true" />
            </span>
          </div>
          {help}
        </div>
      );

    case 'text': {
      const { maxLength } = setting;
      return (
        <div className="classic-field stacked">
          <label htmlFor={inputId}>{setting.label}</label>
          <input
            id={inputId}
            type="text"
            value={typeof value === 'string' ? value : setting.default}
            placeholder={setting.placeholder}
            aria-describedby={describedBy}
            /* readOnly, not disabled: a disabled text field is skipped by tab
               order, so its content becomes unreadable to a keyboard user. */
            readOnly={disabled}
            onChange={(e) =>
              onChange(
                setting.key,
                maxLength === undefined
                  ? e.target.value
                  : e.target.value.slice(0, maxLength),
              )
            }
          />
          {help}
        </div>
      );
    }

    /* Colour keeps the Classic pair: a Transparent button that clears the value,
       beside a native colour input. '' is a meaningful value here — it means the
       parameter is omitted — which a colour input alone cannot express, so the
       button is the only way to get back to it. */
    case 'color': {
      const current = typeof value === 'string' ? value : setting.default;
      const clearId = `${inputId}-clear`;
      return (
        <div className="classic-field">
          <div className="toggle-wrap">
            <label htmlFor={inputId}>{setting.label}</label>
            <span className="classic-color">
              {setting.allowTransparent ? (
                <button
                  type="button"
                  id={clearId}
                  className={`classic-clear${current === '' ? ' on' : ''}`}
                  aria-pressed={current === ''}
                  disabled={disabled}
                  onClick={() => onChange(setting.key, '')}
                >
                  Transparent
                </button>
              ) : null}
              <input
                id={inputId}
                type="color"
                value={current || '#191919'}
                aria-describedby={describedBy}
                disabled={disabled}
                onChange={(e) => onChange(setting.key, e.target.value)}
              />
            </span>
          </div>
          {help}
        </div>
      );
    }

    /* Chips, but native checkboxes underneath: the group is a real fieldset with
       a legend, each input is sr-only and stays the focus target, and the visible
       chip is its label. Buttons with aria-pressed would look identical and lose
       group semantics, and per-option gating disables just the blocked chip
       rather than the whole group. */
    case 'multiselect': {
      const raw = asStringList(value, setting.default);
      /* Deduplicated and ordered by the declared options, never by click order.
         The value is serialized as CSV, so click order would make two identical
         selections produce two different overlay URLs — and a duplicate would
         appear twice in the query. */
      const selected = setting.options
        .map((option) => option.value)
        .filter((optionValue) => raw.includes(optionValue));
      return (
        <div className="classic-field">
          <fieldset className="classic-chips" aria-describedby={describedBy}>
            <legend>{setting.label}</legend>
            <div className="classic-chip-row">
              {setting.options.map((option) => {
                const state = optionAvailable(availability, option.value);
                const on = selected.includes(option.value) && state.available;
                const chipId = `${inputId}-${option.value}`;
                return (
                  <span key={option.value} className="classic-chip">
                    <input
                      id={chipId}
                      type="checkbox"
                      checked={on}
                      disabled={disabled || !state.available}
                      onChange={(e) => {
                        /* Rebuilt from the declared options rather than appended
                           to, so the emitted order is the catalog's order
                           whichever chip was clicked last. */
                        const next = new Set(selected);
                        if (e.target.checked) next.add(option.value);
                        else next.delete(option.value);
                        onChange(
                          setting.key,
                          setting.options
                            .map((o) => o.value)
                            .filter((v) => next.has(v)),
                        );
                      }}
                    />
                    <label
                      htmlFor={chipId}
                      className={`classic-chip-label${on ? ' on' : ''}`}
                      data-platform={option.value}
                    >
                      {option.label}
                    </label>
                  </span>
                );
              })}
            </div>
          </fieldset>
          {help}
        </div>
      );
    }

    case 'number':
      return (
        <div className="classic-field">
          <div className="form_row left">
            <input
              id={inputId}
              type="number"
              className="short"
              value={typeof value === 'number' ? value : setting.default}
              min={setting.min}
              max={setting.max}
              step={setting.step}
              aria-describedby={describedBy}
              disabled={disabled}
              /* An empty or partial entry ('', '-', '1e') emits nothing rather
                 than NaN or a coerced 0: Number('') is 0, which would silently
                 replace the user's value while they were still typing. */
              onChange={(e) => {
                const next = Number(e.target.value);
                if (e.target.value.trim() === '' || !Number.isFinite(next)) return;
                onChange(setting.key, next);
              }}
            />
            <label htmlFor={inputId}>
              {setting.unit ? `${setting.label} (${setting.unit})` : setting.label}
            </label>
          </div>
          {help}
        </div>
      );

    default: {
      /* Exhaustiveness: a new control type fails to compile until handled. */
      const unhandled: never = setting;
      return unhandled as unknown as ReactElement;
    }
  }
}
