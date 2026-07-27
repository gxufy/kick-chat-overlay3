/* Renders a tool's setting catalog as rows.
 *
 * Hidden settings are filtered out and no reveal affordance is rendered while
 * a catalog declares none — the Viewer Counter catalog has no hidden settings,
 * so nothing extra appears on /tools/counter.
 */
import SettingRow from './SettingRow';
import {
  visibleSettings,
  type CatalogAvailability,
  type SettingCatalog,
  type SettingValue,
} from '@/lib/tools/settingTypes';

export default function SettingsList<S extends Record<string, unknown>>({
  catalog,
  config,
  onChange,
  availability = {},
}: {
  catalog: SettingCatalog<S>;
  config: S;
  /** Receives whichever value shape the changed setting's control produces. */
  onChange: (key: keyof S & string, next: SettingValue) => void;
  /** Per-setting option gating from the active tool. Absent means all available. */
  availability?: CatalogAvailability;
}) {
  const settings = visibleSettings(catalog);

  return (
    <div className="rounded-lg border border-ws-border bg-ws-surface">
      {settings.map((setting) => (
        <SettingRow
          key={setting.key}
          setting={setting}
          value={config[setting.key] as SettingValue}
          onChange={onChange}
          availability={availability[setting.key]}
        />
      ))}
    </div>
  );
}
