/* Platform/channel inputs — right column, beside the preview it feeds.
 *
 * Generic over the viewer-counter's four fixed platforms for this batch.
 * Validation reuses the overlay's own normalizeChannel, so a name accepted
 * here is guaranteed to be accepted by /counter's parser too.
 */
import TextInput from '@/components/ui/inputs/TextInput';
import { PLATFORM_ORDER, normalizeChannel, type ViewerPlatform, type ViewerCounterChannels } from '@/lib/viewerCounterConfig';

const PLATFORM_LABEL: Record<ViewerPlatform, string> = {
  twitch: 'Twitch',
  youtube: 'YouTube',
  kick: 'Kick',
  tiktok: 'TikTok',
};

export default function ChannelPanel({
  channels,
  onChange,
}: {
  channels: ViewerCounterChannels;
  onChange: (platform: ViewerPlatform, raw: string) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-ws-text">Channels</legend>
      {PLATFORM_ORDER.map((platform) => {
        const raw = channels[platform] ?? '';
        const invalid = raw.length > 0 && !normalizeChannel(raw);
        return (
          <TextInput
            key={platform}
            id={`channel-${platform}`}
            label={PLATFORM_LABEL[platform]}
            value={raw}
            placeholder="channel name"
            invalid={invalid}
            errorMessage={invalid ? 'Only letters, numbers, "." "_" "-" (max 50 chars).' : undefined}
            onChange={(next) => onChange(platform, next)}
          />
        );
      })}
    </fieldset>
  );
}
