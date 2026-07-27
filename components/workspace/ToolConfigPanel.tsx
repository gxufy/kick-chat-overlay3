/* Centre column — appearance and layout settings for the active tool.
 *
 * Scrolls independently of the nav and preview columns on desktop. Contains no
 * channel inputs: channel identity lives beside the preview it parameterizes.
 */
import Card, { SectionTitle } from './Card';
import SettingsList from './SettingsList';
import ToolHelpPanel from './ToolHelpPanel';
import type { ToolHelpSection } from '@/lib/tools/registry';
import type {
  CatalogAvailability,
  SettingCatalog,
  SettingValue,
} from '@/lib/tools/settingTypes';

export default function ToolConfigPanel<S extends Record<string, unknown>>({
  toolLabel,
  catalog,
  config,
  onChange,
  help = [],
  availability = {},
}: {
  toolLabel: string;
  catalog: SettingCatalog<S>;
  config: S;
  onChange: (key: keyof S & string, next: SettingValue) => void;
  /** Reference material from the descriptor; empty renders nothing. */
  help?: readonly ToolHelpSection[];
  /** Which options the tool currently gates, keyed by setting key. */
  availability?: CatalogAvailability;
}) {
  return (
    /* The landmark stays on the outer element, named by the settings card's own
       heading, so the column's help material is inside the region a landmark
       user lands on. Putting it on the inner card instead would leave the help
       outside the panel it belongs to. */
    <section
      aria-labelledby="tool-config-heading"
      className="min-w-0 lg:h-full lg:overflow-y-auto"
    >
      <div className="space-y-4 px-4 py-5 sm:px-6">
        <Card as="div">
          <SectionTitle
            id="tool-config-heading"
            hint="Appearance and layout. Channels are set beside the preview."
          >
            {toolLabel} settings
          </SectionTitle>
          <SettingsList
            catalog={catalog}
            config={config}
            onChange={onChange}
            availability={availability}
          />
        </Card>

        {/* Below the catalog, not interleaved with it: reference material must
            not push settings off the first screen. Renders nothing when the
            tool declares no help, so no empty card appears. */}
        <ToolHelpPanel sections={help} />
      </div>
    </section>
  );
}
