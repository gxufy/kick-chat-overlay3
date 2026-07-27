/* Centre column — appearance and layout settings for the active tool.
 *
 * Scrolls independently of the nav and preview columns on desktop. Contains no
 * channel inputs: channel identity lives beside the preview it parameterizes.
 */
import SettingsList from './SettingsList';
import ToolHelpPanel from './ToolHelpPanel';
import type { ToolHelpSection } from '@/lib/tools/registry';
import type { SettingCatalog, SettingValue } from '@/lib/tools/settingTypes';

export default function ToolConfigPanel<S extends Record<string, unknown>>({
  toolLabel,
  catalog,
  config,
  onChange,
  help = [],
}: {
  toolLabel: string;
  catalog: SettingCatalog<S>;
  config: S;
  onChange: (key: keyof S & string, next: SettingValue) => void;
  /** Reference material from the descriptor; empty renders nothing. */
  help?: readonly ToolHelpSection[];
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

        {/* Below the catalog, not interleaved with it: reference material must
            not push settings off the first screen. */}
        <div className="mt-4">
          <ToolHelpPanel sections={help} />
        </div>
      </div>
    </section>
  );
}
