/* Centre column — appearance and layout settings for the active tool.
 *
 * Scrolls independently of the nav and preview columns on desktop. Contains no
 * channel inputs: channel identity lives beside the preview it parameterizes.
 */
import SettingsList from './SettingsList';
import type { SettingCatalog, SettingValue } from '@/lib/tools/settingTypes';

export default function ToolConfigPanel<S extends Record<string, unknown>>({
  toolLabel,
  catalog,
  config,
  onChange,
}: {
  toolLabel: string;
  catalog: SettingCatalog<S>;
  config: S;
  onChange: (key: keyof S & string, next: SettingValue) => void;
}) {
  return (
    <section
      aria-labelledby="tool-config-heading"
      className="min-w-0 lg:overflow-y-auto lg:h-full"
    >
      <div className="px-4 py-5 sm:px-6">
        <h2
          id="tool-config-heading"
          className="text-base font-semibold text-ws-text"
        >
          {toolLabel} settings
        </h2>
        <p className="mt-0.5 text-xs text-ws-muted">
          Appearance and layout. Channels are set beside the preview.
        </p>

        <div className="mt-4">
          <SettingsList catalog={catalog} config={config} onChange={onChange} />
        </div>
      </div>
    </section>
  );
}
