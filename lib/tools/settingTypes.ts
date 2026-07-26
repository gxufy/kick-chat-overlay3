/* Setting descriptor types for the generator workspace.
 *
 * A tool describes its non-channel controls as data — a flat catalog of
 * descriptors — and the workspace renders them generically. Adding a control
 * means adding a catalog entry, not writing markup.
 *
 * Six control types are modelled: `toggle` and `select` (used today by the
 * Viewer Counter) plus `text`, `color`, `number`, and `multiselect`, added for
 * MultiChat's channel names, colours, fade duration, and pinned-platform set.
 * Each variant describes a control generically: no tool-specific field names,
 * no CSV or bitmask encoding, no serialization. Encoding stays in each tool's
 * own config module.
 *
 * Browser-safe — no server-only imports, no secrets.
 */

/** Fields every descriptor carries, whatever its control type. */
type SettingBase<C> = {
  /** Stable identifier, unique within a catalog. Also the config field name. */
  key: keyof C & string;
  /** Overlay query parameter this setting serializes to. */
  param: string;
  /** Visible control label. Must be a plain string — it is rendered as text. */
  label: string;
  /** Optional one-line helper text shown under the label. */
  description?: string;
  /**
   * Kept out of the default control list until explicitly revealed.
   *
   * Supported by the type so a later tool can park legacy or debug parameters
   * somewhere addressable. The Viewer Counter catalog sets this on nothing,
   * and the workspace renders no reveal affordance while no setting uses it.
   */
  hidden?: boolean;
  /**
   * Renders the control non-interactive. A static property only: the catalog
   * declares it, nothing recomputes it per render. Contextual enabling (OAuth
   * state, sibling values) is not modelled here.
   */
  disabled?: boolean;
  /** Why the control is disabled. Announced with the control when present. */
  disabledReason?: string;
};

/** A single choice in a select control. */
export type SettingOption<V extends string = string> = {
  value: V;
  label: string;
};

/** Boolean control. */
export type ToggleSetting<C> = SettingBase<C> & {
  type: 'toggle';
  /** Must equal the tool's authoritative default for this field. */
  default: boolean;
};

/** Fixed-choice control. */
export type SelectSetting<C> = SettingBase<C> & {
  type: 'select';
  /** Allowed values, in display order. */
  options: readonly SettingOption[];
  /** Must equal the tool's authoritative default, and appear in `options`. */
  default: string;
};

/** Free-text control. Edits a plain string; no parsing, no validation. */
export type TextSetting<C> = SettingBase<C> & {
  type: 'text';
  /** Must equal the tool's authoritative default for this field. */
  default: string;
  /** Hint shown in the empty field. Never a value. */
  placeholder?: string;
  /** Native input length cap, when the field has a real one. */
  maxLength?: number;
};

/**
 * Colour control. Edits an opaque CSS colour string — the value is passed
 * through exactly as typed, with no case folding, shorthand expansion, or
 * normalization. Tools that need a canonical form do it at serialization time.
 */
export type ColorSetting<C> = SettingBase<C> & {
  type: 'color';
  /** Must equal the tool's authoritative default for this field. */
  default: string;
  /** Permits the exact string `transparent` in addition to a colour. */
  allowTransparent?: boolean;
};

/** Numeric control. Emits finite numbers only. */
export type NumberSetting<C> = SettingBase<C> & {
  type: 'number';
  /** Must equal the tool's authoritative default for this field. */
  default: number;
  min?: number;
  max?: number;
  step?: number;
  /** Displayed beside the field ('ms', 'px'). Never part of the value. */
  unit?: string;
};

/**
 * Multiple-choice control. The value is the selected subset, deduplicated and
 * ordered by `options`, never by click order. Encoding that subset (CSV, repeated
 * params, bitmask) is the tool's job, not this control's.
 */
export type MultiSelectSetting<C> = SettingBase<C> & {
  type: 'multiselect';
  /** Allowed values, in display order. */
  options: readonly SettingOption[];
  /** Must equal the tool's authoritative default. Empty is valid. */
  default: readonly string[];
};

/** Any descriptor in a catalog. */
export type Setting<C> =
  | ToggleSetting<C>
  | SelectSetting<C>
  | TextSetting<C>
  | ColorSetting<C>
  | NumberSetting<C>
  | MultiSelectSetting<C>;

/** Every value shape a control can hold or emit. */
export type SettingValue = boolean | string | number | readonly string[];

/** The value type a given descriptor holds, taken from its own default. */
export type SettingValueFor<T extends { default: SettingValue }> = T['default'];

/** A tool's full control catalog, in display order. */
export type SettingCatalog<C> = readonly Setting<C>[];

/** Descriptors the workspace shows without an explicit reveal. */
export function visibleSettings<C>(catalog: SettingCatalog<C>): Setting<C>[] {
  return catalog.filter((setting) => !setting.hidden);
}

/** Build option lists from a readonly enum tuple, labelled by a formatter. */
export function optionsFrom<V extends string>(
  values: readonly V[],
  label: (value: V) => string,
): readonly SettingOption<V>[] {
  return values.map((value) => ({ value, label: label(value) }));
}

/** Sentence-case a lowercase enum member for display ('live-unknown' → 'Live unknown'). */
export function titleCase(value: string): string {
  const spaced = value.replace(/-/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
