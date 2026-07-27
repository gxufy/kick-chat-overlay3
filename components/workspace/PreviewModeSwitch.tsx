/* Live / Demo preview mode switch.
 *
 * Native `input type="radio"` in a real fieldset, for the same reason
 * PreviewBackgroundPicker and MultiSelect are native: a radiogroup is expected to
 * be one tab stop with arrow keys moving between options, and `role="radio"` on
 * buttons is that pattern's appearance without its behaviour unless every key is
 * reimplemented. Native inputs get roving focus, arrow keys, and group semantics
 * from the platform, so there is nothing to keep in sync.
 *
 * The visible control is the label; the input is `sr-only` and stays the focus
 * target, so `peer-focus-visible` draws the ring on the label.
 *
 * Rendered only when the active tool declares a demo panel, so the counter — for
 * which sample numbers would be meaningless — shows no switch at all.
 */
import { useId } from 'react';

export type PreviewMode = 'live' | 'demo';

export default function PreviewModeSwitch({
  mode,
  onChange,
  demoLabel,
}: {
  mode: PreviewMode;
  onChange: (next: PreviewMode) => void;
  /** The tool's own word for its demo mode. */
  demoLabel: string;
}) {
  /* Scoped so two switches on one page cannot share a radio group name. */
  const group = useId();

  const options: readonly { id: PreviewMode; label: string }[] = [
    { id: 'live', label: 'Live' },
    { id: 'demo', label: demoLabel },
  ];

  return (
    <fieldset className="inline-flex rounded-lg border border-ws-border bg-ws-control p-0.5">
      <legend className="sr-only">Preview mode</legend>
      {options.map((option) => {
        const active = option.id === mode;
        const id = `${group}-preview-mode-${option.id}`;
        return (
          /* Input before label, as siblings: Tailwind's `peer` only reaches a
             following sibling, so nesting the input inside the label would
             silently drop the focus ring. */
          <div key={option.id} className="flex">
            <input
              id={id}
              type="radio"
              name={`${group}-preview-mode`}
              value={option.id}
              checked={active}
              onChange={() => onChange(option.id)}
              className="peer sr-only"
            />
            <label
              htmlFor={id}
              className={[
                'cursor-pointer rounded-md px-3 py-1 text-xs font-semibold transition-colors',
                'peer-focus-visible:ring-2 peer-focus-visible:ring-ws-ring',
                'peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-ws-surface',
                'motion-reduce:transition-none',
                active
                  ? 'bg-ws-accent text-white'
                  : 'text-ws-muted hover:text-ws-text',
              ].join(' ')}
            >
              {option.label}
            </label>
          </div>
        );
      })}
    </fieldset>
  );
}
