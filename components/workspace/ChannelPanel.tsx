/* Platform/channel inputs — right column, beside the preview it feeds.
 *
 * Holds no platform list: the active tool's descriptor supplies the fields,
 * their order, their labels, and the rule each value is validated against. So a
 * tool with one channel, or five, or different validation, needs no change
 * here. Validation reuses whatever normalizer the tool declares, which for the
 * viewer counter is the overlay's own — a name accepted here is guaranteed to be
 * accepted by /counter's parser too.
 */
import TextInput from '@/components/ui/inputs/TextInput';
import type { ToolChannels, ToolPlatform } from '@/lib/tools/registry';

export default function ChannelPanel<P extends string>({
  platforms,
  channels,
  onChange,
}: {
  /** Fields to render, in display order, from the active tool. */
  platforms: readonly ToolPlatform<P>[];
  channels: ToolChannels<P>;
  onChange: (platform: P, raw: string) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-ws-text">Channels</legend>
      {platforms.map((platform) => {
        const raw = channels[platform.key] ?? '';
        const invalid = raw.length > 0 && !platform.normalize(raw);
        return (
          <TextInput
            key={platform.key}
            id={`channel-${platform.key}`}
            label={platform.label}
            value={raw}
            placeholder={platform.placeholder}
            invalid={invalid}
            errorMessage={invalid ? platform.invalidMessage : undefined}
            onChange={(next) => onChange(platform.key, next)}
          />
        );
      })}
    </fieldset>
  );
}
