/* Preview message creator — compose a sample and see it in the real renderer.
 *
 * Produces a `ParsedMessage`, the same type the connectors emit, so a composed
 * message travels the identical path through `ChatOverlay` as a live one. It is
 * therefore a way to check styling against your own name and text length, which
 * is what the fixed samples cannot do.
 *
 * Ids are derived from a caller-supplied counter rather than Date.now or
 * Math.random, so composing is deterministic and testable.
 */
import { useId, useState } from 'react';
import Button from '@/components/ui/inputs/Button';
import Select from '@/components/ui/inputs/Select';
import TextInput from '@/components/ui/inputs/TextInput';
import Toggle from '@/components/ui/inputs/Toggle';
import { chipClass } from '@/lib/tools/platformChrome';
import { PROVIDERS } from '@/lib/render';
import type { ParsedMessage } from '@/lib/kick';
import type { Platform } from '@/lib/types';

const PLATFORMS: readonly Platform[] = ['kick', 'twitch', 'youtube', 'tiktok'];

const PLATFORM_OPTIONS = PLATFORMS.map((value) => ({
  value,
  label: PROVIDERS[value].label,
}));

/** Badge art used for composed messages, by role. */
const ROLE_BADGE: Record<string, string> = {
  moderator: '/badges/moderator.svg',
  subscriber: '/badges/subscriber.svg',
};

/**
 * Build a ParsedMessage from the composer's fields.
 *
 * Exported for the tests, which assert the produced value against the type the
 * connectors emit rather than against this component's markup.
 */
export function composeMessage(
  fields: {
    platform: Platform;
    username: string;
    text: string;
    moderator: boolean;
    subscriber: boolean;
  },
  seq: number,
): ParsedMessage {
  const badges = [];
  if (fields.moderator) {
    badges.push(
      <img
        key="b-moderator"
        className="ck-badge-img"
        src={ROLE_BADGE.moderator}
        alt="moderator"
      />,
    );
  }
  if (fields.subscriber) {
    badges.push(
      <img
        key="b-subscriber"
        className="ck-badge-img"
        src={ROLE_BADGE.subscriber}
        alt="subscriber"
      />,
    );
  }

  return {
    /* Deterministic: derived from the caller's counter, never from a clock or
       a random source, so a composed message is reproducible in a test. */
    id: `composed-${seq}`,
    platform: fields.platform,
    kind: 'chat',
    identity: {
      username: fields.username.trim() || 'your_name',
      color: PROVIDERS[fields.platform].color,
      background: '',
      filter: '',
      badges,
    },
    message: [fields.text.trim() || 'your message text'],
  };
}

export default function MessageCreator({
  onAdd,
  onClear,
  addedCount,
}: {
  /** Hands a finished sample to the preview. */
  onAdd: (message: ParsedMessage) => void;
  /** Removes every composed message, leaving the fixed samples. */
  onClear: () => void;
  /** How many composed messages are currently in the preview. */
  addedCount: number;
}) {
  const base = useId();
  const [platform, setPlatform] = useState<Platform>('kick');
  const [username, setUsername] = useState('');
  const [text, setText] = useState('');
  const [moderator, setModerator] = useState(false);
  const [subscriber, setSubscriber] = useState(false);
  /* Monotonic per-component counter, so ids are unique and deterministic. */
  const [seq, setSeq] = useState(1);

  const add = () => {
    onAdd(composeMessage({ platform, username, text, moderator, subscriber }, seq));
    setSeq((n) => n + 1);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${base}-platform`}
            className="mb-1 block text-xs font-semibold text-ws-muted"
          >
            Platform
          </label>
          <div className="flex items-center gap-2">
            <Select
              id={`${base}-platform`}
              value={platform}
              options={PLATFORM_OPTIONS}
              onChange={(next) => setPlatform(next as Platform)}
            />
            {/* Reinforces which service the composed line will be tagged as.
                aria-hidden because it only restates the select's own value,
                which a screen reader already announces — unlike the channel
                fields, where the chip *is* the label, there is a real label
                here and this would be a second reading of the same word. */}
            <span aria-hidden="true" className={chipClass(platform)}>
              {platform}
            </span>
          </div>
        </div>

        <TextInput
          id={`${base}-username`}
          label="Username"
          value={username}
          onChange={setUsername}
          placeholder="your_name"
        />
      </div>

      <TextInput
        id={`${base}-text`}
        label="Message"
        value={text}
        onChange={setText}
        placeholder="your message text"
      />

      <div className="flex flex-wrap items-center gap-4">
        <span className="inline-flex items-center gap-2">
          <Toggle
            id={`${base}-moderator`}
            checked={moderator}
            onChange={setModerator}
          />
          <label htmlFor={`${base}-moderator`} className="text-sm text-ws-muted">
            Moderator badge
          </label>
        </span>
        <span className="inline-flex items-center gap-2">
          <Toggle
            id={`${base}-subscriber`}
            checked={subscriber}
            onChange={setSubscriber}
          />
          <label htmlFor={`${base}-subscriber`} className="text-sm text-ws-muted">
            Subscriber badge
          </label>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={add} variant="primary">
          Add to preview
        </Button>
        <Button onClick={onClear} disabled={addedCount === 0}>
          Clear composed
        </Button>
        {/* A live region: adding a message changes the preview, which a screen
            reader user cannot see happen. */}
        <span role="status" className="text-xs text-ws-muted">
          {addedCount === 0
            ? 'No composed messages yet.'
            : `${addedCount} composed message${addedCount === 1 ? '' : 's'} in preview.`}
        </span>
      </div>
    </div>
  );
}
