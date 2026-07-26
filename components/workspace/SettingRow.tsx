/* One catalog setting rendered as a labelled control row.
 *
 * The control is chosen by the descriptor's `type`, so a tool adds controls by
 * adding catalog entries rather than writing markup. Every row wires a real
 * <label for> to its input, and helper text is linked with aria-describedby.
 */
import Select from '@/components/ui/inputs/Select';
import Toggle from '@/components/ui/inputs/Toggle';
import type { Setting } from '@/lib/tools/settingTypes';

export default function SettingRow<S>({
  setting,
  value,
  onChange,
}: {
  setting: Setting<S>;
  /** Current value for this setting's key. */
  value: boolean | string;
  onChange: (key: keyof S & string, next: boolean | string) => void;
}) {
  const inputId = `setting-${setting.key}`;
  const descriptionId = setting.description ? `${inputId}-desc` : undefined;

  return (
    <div className="flex items-start justify-between gap-4 border-b border-ws-border px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-ws-text"
        >
          {setting.label}
        </label>
        {setting.description ? (
          <p id={descriptionId} className="mt-0.5 text-xs leading-snug text-ws-muted">
            {setting.description}
          </p>
        ) : null}
      </div>

      {setting.type === 'toggle' ? (
        <Toggle
          id={inputId}
          checked={typeof value === 'boolean' ? value : setting.default}
          describedBy={descriptionId}
          onChange={(next) => onChange(setting.key, next)}
        />
      ) : (
        <Select
          id={inputId}
          value={typeof value === 'string' ? value : setting.default}
          options={setting.options}
          describedBy={descriptionId}
          onChange={(next) => onChange(setting.key, next)}
        />
      )}
    </div>
  );
}
