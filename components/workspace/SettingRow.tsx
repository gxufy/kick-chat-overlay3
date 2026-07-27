/* One catalog setting rendered as a labelled control row.
 *
 * The control is chosen by the descriptor's `type`, so a tool adds controls by
 * adding catalog entries rather than writing markup. Every row wires a real
 * <label for> to its input, and helper text is linked with aria-describedby.
 *
 * `text` is the one type that does not use the shared row layout: TextInput
 * owns its own <label for> and live error region, so the row would otherwise
 * render a second label for the same input. It gets a stacked full-width row
 * instead, TextInput supplies the single label, and helper text is linked
 * through TextInput's `describedBy`.
 *
 * A disabled setting is wrapped in a `display: contents` <fieldset disabled>,
 * which disables the descendant control natively without any control needing a
 * per-component disabled prop. The wrapper only exists when a setting declares
 * `disabled`, so catalogs that never set it render exactly as before.
 */
import type { ReactElement } from 'react';
import ColorInput from '@/components/ui/inputs/ColorInput';
import MultiSelect from '@/components/ui/inputs/MultiSelect';
import NumberInput from '@/components/ui/inputs/NumberInput';
import Select from '@/components/ui/inputs/Select';
import TextInput from '@/components/ui/inputs/TextInput';
import Toggle from '@/components/ui/inputs/Toggle';
import {
  optionAvailable,
  type Setting,
  type SettingAvailability,
  type SettingValue,
} from '@/lib/tools/settingTypes';

/** Read a value as a string list, falling back when the config disagrees. */
function asStringList(
  value: SettingValue,
  fallback: readonly string[],
): readonly string[] {
  if (typeof value !== 'object' || value === null) return fallback;
  return value;
}

/**
 * Distinct reasons for this setting's currently unavailable options.
 *
 * Only settings that actually have options can gate any, so anything else
 * returns nothing. Reasons are deduplicated: several options blocked by one
 * cause should read as one sentence, not the same sentence repeated.
 */
function unavailableReasons<S>(
  setting: Setting<S>,
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

export default function SettingRow<S>({
  setting,
  value,
  onChange,
  availability,
}: {
  setting: Setting<S>;
  /** Current value for this setting's key. */
  value: SettingValue;
  onChange: (key: keyof S & string, next: SettingValue) => void;
  /** Which of this setting's options are currently selectable. */
  availability?: SettingAvailability;
}) {
  const inputId = `setting-${setting.key}`;
  const descriptionId = setting.description ? `${inputId}-desc` : undefined;
  const reasonId = setting.disabledReason ? `${inputId}-reason` : undefined;

  /* Reasons for options the tool currently gates, deduplicated and rendered as
     real text under the control. An option that is merely greyed out tells the
     user nothing about how to enable it — and colour alone is not an accessible
     signal, so the explanation is in the accessibility tree via
     aria-describedby, not just visible. */
  const gatedReasons = unavailableReasons(setting, availability);
  const gatedId = gatedReasons.length > 0 ? `${inputId}-gated` : undefined;
  const describedBy =
    [descriptionId, reasonId, gatedId].filter(Boolean).join(' ') || undefined;

  /* Wraps the row body so a disabled setting is inert. `display: contents`
   * keeps the fieldset out of the layout entirely. */
  const frame = (children: ReactElement) =>
    setting.disabled ? (
      <fieldset disabled className="contents">
        {children}
      </fieldset>
    ) : (
      children
    );

  const help = (
    <>
      {setting.description ? (
        <p id={descriptionId} className="mt-0.5 text-xs leading-snug text-ws-muted">
          {setting.description}
        </p>
      ) : null}
      {setting.disabledReason ? (
        <p id={reasonId} className="mt-0.5 text-xs leading-snug text-ws-muted">
          {setting.disabledReason}
        </p>
      ) : null}
      {/* Runtime gating, distinct from the catalog's static disabledReason: this
          can change while the page is open. */}
      {gatedId ? (
        <div id={gatedId}>
          {gatedReasons.map((reason) => (
            <p key={reason} className="mt-0.5 text-xs leading-snug text-amber-400">
              {reason}
            </p>
          ))}
        </div>
      ) : null}
    </>
  );

  /* TextInput renders its own <label for> and its own live error region, so a
   * text setting cannot sit in the shared label-left/control-right row without
   * producing two labels for one input. It gets a stacked row instead, with no
   * outer label at all, and the row's helper text is linked through TextInput's
   * `describedBy`. `maxLength` is enforced here rather than as a native
   * attribute, because TextInput forwards no such prop. */
  if (setting.type === 'text') {
    const { maxLength } = setting;
    return (
      <div className="border-b border-ws-border px-4 py-3 last:border-b-0">
        {frame(
          <div className="min-w-0">
            <TextInput
              id={inputId}
              label={setting.label}
              value={typeof value === 'string' ? value : setting.default}
              placeholder={setting.placeholder}
              readOnly={setting.disabled}
              describedBy={describedBy}
              onChange={(next) =>
                onChange(
                  setting.key,
                  maxLength === undefined ? next : next.slice(0, maxLength),
                )
              }
            />
            {help}
          </div>,
        )}
      </div>
    );
  }

  const control = (): ReactElement => {
    switch (setting.type) {
      case 'toggle':
        return (
          <Toggle
            id={inputId}
            checked={typeof value === 'boolean' ? value : setting.default}
            describedBy={describedBy}
            onChange={(next) => onChange(setting.key, next)}
          />
        );
      case 'select':
        return (
          <Select
            id={inputId}
            value={typeof value === 'string' ? value : setting.default}
            options={setting.options}
            describedBy={describedBy}
            onChange={(next) => onChange(setting.key, next)}
          />
        );
      case 'color':
        return (
          <ColorInput
            id={inputId}
            value={typeof value === 'string' ? value : setting.default}
            allowTransparent={setting.allowTransparent}
            disabled={setting.disabled}
            describedBy={describedBy}
            onChange={(next) => onChange(setting.key, next)}
          />
        );
      case 'number':
        return (
          <NumberInput
            id={inputId}
            value={typeof value === 'number' ? value : setting.default}
            min={setting.min}
            max={setting.max}
            step={setting.step}
            unit={setting.unit}
            disabled={setting.disabled}
            describedBy={describedBy}
            onChange={(next) => onChange(setting.key, next)}
          />
        );
      case 'multiselect':
        return (
          <MultiSelect
            id={inputId}
            legend={setting.label}
            value={asStringList(value, setting.default)}
            options={setting.options}
            disabled={setting.disabled}
            /* Per-option gating, so one unavailable choice does not disable the
               whole group — the others stay usable. */
            unavailable={setting.options
              .filter((o) => !optionAvailable(availability, o.value).available)
              .map((o) => o.value)}
            describedBy={describedBy}
            onChange={(next) => onChange(setting.key, next)}
          />
        );
      default: {
        /* Exhaustiveness: a new variant fails to compile until handled. */
        const unhandled: never = setting;
        return unhandled;
      }
    }
  };

  return (
    <div className="flex items-start justify-between gap-4 border-b border-ws-border px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        {/* A checkbox group is named by its own legend, so the visible row text
         * is a span rather than a second label pointing at a fieldset. */}
        {setting.type === 'multiselect' ? (
          <span className="block text-sm font-medium text-ws-text">
            {setting.label}
          </span>
        ) : (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-ws-text"
          >
            {setting.label}
          </label>
        )}
        {help}
      </div>

      {frame(control())}
    </div>
  );
}
