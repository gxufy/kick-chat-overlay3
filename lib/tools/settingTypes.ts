/* Setting descriptor types for the generator workspace.
 *
 * A tool describes its non-channel controls as data — a flat catalog of
 * descriptors — and the workspace renders them generically. Adding a control
 * means adding a catalog entry, not writing markup.
 *
 * Only the two control types the Viewer Counter actually needs are modelled
 * here. Colour, slider, number, and multi-select arrive with the tools that
 * need them; there is deliberately no speculative variant.
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

/** Any descriptor in a catalog. */
export type Setting<C> = ToggleSetting<C> | SelectSetting<C>;

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
