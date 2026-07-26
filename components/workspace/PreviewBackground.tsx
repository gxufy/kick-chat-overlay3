/* Preview background selector and surface.
 *
 * Workspace-only state. The chosen background is applied to the container that
 * *wraps* the iframe — never injected into the overlay document, never added to
 * the generated URL. It exists so transparency can be eyeballed against light
 * and dark scenes; it cannot affect what OBS renders.
 */
import type { ReactNode } from 'react';

export const PREVIEW_BACKGROUNDS = ['checker', 'dark', 'light'] as const;
export type PreviewBackgroundId = (typeof PREVIEW_BACKGROUNDS)[number];

const LABELS: Record<PreviewBackgroundId, string> = {
  checker: 'Transparent',
  dark: 'Dark',
  light: 'Light',
};

/* Checkerboard drawn with two conic gradients so no image asset is needed. */
const CHECKER_STYLE = {
  backgroundColor: '#2a2a2a',
  backgroundImage:
    'conic-gradient(from 90deg at 1px 1px, #0000 25%, #3a3a3a 0) ,' +
    'conic-gradient(#3a3a3a 25%, #242424 0 50%, #3a3a3a 0 75%, #242424 0)',
  backgroundSize: '16px 16px',
} as const;

/** Radio group choosing the preview backdrop. */
export function PreviewBackgroundPicker({
  value,
  onChange,
}: {
  value: PreviewBackgroundId;
  onChange: (next: PreviewBackgroundId) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ws-muted">
        Preview background
      </legend>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Preview background">
        {PREVIEW_BACKGROUNDS.map((id) => {
          const active = id === value;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(id)}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ws-surface ${
                active
                  ? 'border-ws-accent bg-ws-accent/20 text-ws-text'
                  : 'border-ws-border bg-ws-control text-ws-muted hover:bg-ws-control-hover'
              }`}
            >
              {LABELS[id]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** The backdrop container. Styling stops at this element. */
export default function PreviewBackground({
  background,
  children,
}: {
  background: PreviewBackgroundId;
  children: ReactNode;
}) {
  const style =
    background === 'checker'
      ? CHECKER_STYLE
      : background === 'light'
        ? { backgroundColor: '#f4f4f5' }
        : { backgroundColor: '#141414' };

  return (
    <div
      style={style}
      className="overflow-hidden rounded-lg border border-ws-border"
    >
      {children}
    </div>
  );
}
