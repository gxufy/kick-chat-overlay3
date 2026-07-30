/* The preview-only background control.
 *
 * WHAT IT IS. Four backdrops for the preview surface — Transparent, Dark, Light
 * and a Custom colour — so someone can judge how the overlay reads against
 * whatever their scene puts behind it. Workspace-only in the strictest sense:
 * the backdrop lives on the preview wrapper, never inside the overlay document
 * and never in a generated URL. It cannot reach OBS, and nothing it holds is
 * serialized into a query string.
 *
 * WHY RADIOS RATHER THAN THE TWO-STATE BUTTON IT REPLACED. Four discrete named
 * choices are a radio group, not a toggle: a native group announces "3 of 4" and
 * moves under the arrow keys with no scripting, and it can name Dark and Custom
 * outright rather than hiding them behind a cycle a screen reader cannot see.
 *
 * WHY THE COLOUR FIELD ONLY APPEARS UNDER CUSTOM. A colour input that did nothing
 * until Custom was picked would be a control that visibly does nothing, which
 * this card treats as worse than no control — so it is rendered only while Custom
 * is the selected mode. The chosen colour is remembered by the parent across a
 * detour through another mode, so returning to Custom restores it.
 */
import {
  PREVIEW_BACKGROUNDS,
  isPreviewBackgroundId,
  type PreviewBackgroundId,
} from '@/lib/tools/previewBackground';

/** The four modes: the three fixed backdrops plus a user colour. */
export type PreviewBgMode = PreviewBackgroundId | 'custom';

export const PREVIEW_BG_MODES: readonly PreviewBgMode[] = [
  ...PREVIEW_BACKGROUNDS,
  'custom',
];

/* The grey the old two-state "Light background" produced, kept as the starting
   custom colour so the option that replaced it can still reach the same value. */
export const DEFAULT_PREVIEW_CUSTOM_COLOR = '#46464e';

const LABELS: Record<PreviewBgMode, string> = {
  checker: 'Transparent',
  dark: 'Dark',
  light: 'Light',
  custom: 'Custom',
};

/* The class each fixed backdrop carries on `.preview-surface`. Custom has none —
   its colour is applied inline — and "checker" keeps its historical class name. */
const SURFACE_CLASS: Record<PreviewBgMode, string> = {
  checker: 'checkered',
  dark: 'dark',
  light: 'light',
  custom: '',
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** A six-digit hex colour, the only shape `<input type=color>` round-trips. */
export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

/** The value that persists to a draft and drives the surface: a named id for the
 *  three fixed backdrops, or the hex string itself for Custom. Never a URL. */
export function effectivePreviewBackground(
  mode: PreviewBgMode,
  customColor: string,
): string {
  return mode === 'custom' ? customColor : mode;
}

/** The inverse, for restoring a draft. A valid id restores that mode; a hex
 *  restores Custom with that colour; anything else falls back to Transparent. */
export function previewBackgroundFromDraft(value: string): {
  mode: PreviewBgMode;
  customColor: string;
} {
  if (isPreviewBackgroundId(value)) {
    return { mode: value, customColor: DEFAULT_PREVIEW_CUSTOM_COLOR };
  }
  if (isHexColor(value)) return { mode: 'custom', customColor: value };
  return { mode: 'checker', customColor: DEFAULT_PREVIEW_CUSTOM_COLOR };
}

/** The `.preview-surface` modifier class for a mode ('' for Custom). */
export function previewSurfaceClass(mode: PreviewBgMode): string {
  return SURFACE_CLASS[mode];
}

export default function ClassicPreviewBackgroundControl({
  idPrefix,
  legend,
  mode,
  customColor,
  onModeChange,
  onCustomColorChange,
}: {
  /** Unique per preview, so the two groups' radio ids and `name`s never couple. */
  idPrefix: string;
  legend: string;
  mode: PreviewBgMode;
  customColor: string;
  onModeChange: (next: PreviewBgMode) => void;
  onCustomColorChange: (next: string) => void;
}) {
  const name = `${idPrefix}-preview-bg`;
  const helpId = `${idPrefix}-preview-bg-help`;
  const colorId = `${idPrefix}-preview-bg-color`;
  return (
    <fieldset className="classic-seg preview-bg" aria-describedby={helpId}>
      <legend>{legend}</legend>
      <div className="classic-seg-row">
        {PREVIEW_BG_MODES.map((option) => {
          const id = `${idPrefix}-preview-bg-${option}`;
          return (
            <span className="classic-seg-item" key={option}>
              <input
                type="radio"
                id={id}
                name={name}
                value={option}
                checked={mode === option}
                onChange={() => onModeChange(option)}
              />
              <label
                htmlFor={id}
                className={`classic-seg-label${mode === option ? ' on' : ''}`}
              >
                {LABELS[option]}
              </label>
            </span>
          );
        })}
      </div>
      {mode === 'custom' && (
        <div className="preview-bg-custom">
          <label htmlFor={colorId}>Custom colour</label>
          <input
            type="color"
            id={colorId}
            value={isHexColor(customColor) ? customColor : DEFAULT_PREVIEW_CUSTOM_COLOR}
            onChange={(event) => onCustomColorChange(event.target.value)}
          />
        </div>
      )}
      {/* Says plainly that the backdrop is preview-only. Without it the control
          reads as an overlay background that mysteriously never reaches the URL. */}
      <p className="classic-help" id={helpId}>
        Sets this preview&apos;s backdrop only. The overlay and its URL are unchanged.
      </p>
    </fieldset>
  );
}
