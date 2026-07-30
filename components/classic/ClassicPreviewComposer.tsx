/* The custom preview message control, inside the Chat overlay card.
 *
 * This is a preview control, not a demo mode: it changes what the preview above
 * it shows and nothing else. It sends no message to any provider, it does not
 * touch the generated overlay URL, and the messages it adds are never written to
 * the saved draft. A composed line exists in generator state until the tab is
 * closed.
 *
 * It is deliberately compact — one row of fields, one row of actions — because it
 * lives inside a card that already holds a 600px preview, a URL, and two buttons.
 * A taller control would push the chat settings card off the first screen, which
 * is the layout this page was approved with.
 *
 * The value it produces is a `UnifiedMessage`, built by composePreviewMessage,
 * so a composed line travels the identical conversion path as a fixture and as a
 * live message. See that module for why it is plain data rather than nodes.
 */
import { useState } from 'react';
import {
  PREVIEW_NAME_MAX,
  PREVIEW_TEXT_MAX,
  PREVIEW_FALLBACK_NAME,
  canComposePreviewMessage,
  composePreviewMessage,
} from '@/lib/tools/multichat/composePreviewMessage';
import type { Platform, UnifiedMessage } from '@/lib/types';

/** The four platforms, in the page's established order. */
const PLATFORMS: readonly { value: Platform; label: string }[] = [
  { value: 'kick', label: 'Kick' },
  { value: 'twitch', label: 'Twitch' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
];

export default function ClassicPreviewComposer({
  onAdd,
  onReset,
  onClear,
  customCount,
}: {
  /** Appends a composed message to the preview list. */
  onAdd: (message: UnifiedMessage) => void;
  /** Back to the built-in sample set, discarding composed messages. */
  onReset: () => void;
  /** Removes composed messages, keeping the samples. */
  onClear: () => void;
  /** How many composed messages are currently in the preview. */
  customCount: number;
}) {
  const [platform, setPlatform] = useState<Platform>('kick');
  const [username, setUsername] = useState('');
  const [text, setText] = useState('');
  /* Monotonic, so ids are unique for the life of the page even after a clear.
     Resetting it on clear would let a new message reuse a React key that a
     just-removed message still held during the same commit. */
  const [seq, setSeq] = useState(1);
  /* What was last done, announced rather than only drawn: adding a message
     changes the preview above, which a screen reader user cannot see happen. */
  const [announcement, setAnnouncement] = useState('');

  const draft = { platform, username, text };
  const canAdd = canComposePreviewMessage(draft);

  const add = () => {
    if (!canAdd) return;
    onAdd(composePreviewMessage(draft, seq));
    setSeq((n) => n + 1);
    /* The message clears, the name and platform stay: composing several lines
       from the same chatter is the common case when judging a font. */
    setText('');
    setAnnouncement('Preview message added.');
  };

  return (
    <div className="preview-compose">
      <p className="preview-compose-note">
        Add your own lines to the preview. Nothing is sent to any platform and
        none of this reaches the overlay URL.
      </p>

      <div className="preview-compose-row">
        <fieldset className="classic-seg preview-compose-seg">
          <legend>Platform</legend>
          <div className="classic-seg-row">
            {PLATFORMS.map((option) => (
              <span className="classic-seg-item" key={option.value}>
                <input
                  type="radio"
                  id={`compose-platform-${option.value}`}
                  name="compose-platform"
                  value={option.value}
                  checked={platform === option.value}
                  onChange={() => setPlatform(option.value)}
                />
                <label
                  htmlFor={`compose-platform-${option.value}`}
                  className={`classic-seg-label${platform === option.value ? ' on' : ''}`}
                >
                  {option.label}
                </label>
              </span>
            ))}
          </div>
        </fieldset>

        <div className="classic-field stacked preview-compose-name">
          <label htmlFor="compose-username">Display name</label>
          <input
            type="text"
            id="compose-username"
            value={username}
            maxLength={PREVIEW_NAME_MAX}
            placeholder={PREVIEW_FALLBACK_NAME}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
      </div>

      <div className="classic-field stacked">
        <label htmlFor="compose-text">Message</label>
        <textarea
          id="compose-text"
          value={text}
          rows={2}
          maxLength={PREVIEW_TEXT_MAX}
          placeholder="Type a line to see it in the preview"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            /* Enter adds, Shift+Enter starts a new line. A textarea rather than
               an input because a message with a line break is one of the things
               worth previewing, and Enter would otherwise be the only way to
               submit a form-less control. */
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              add();
            }
          }}
        />
      </div>

      <div className="preview-compose-actions">
        <button
          type="button"
          className="classic-conn-btn"
          onClick={add}
          disabled={!canAdd}
        >
          Add preview message
        </button>
        <button
          type="button"
          className="classic-conn-btn"
          onClick={() => {
            onClear();
            setAnnouncement('Custom preview messages cleared.');
          }}
          disabled={customCount === 0}
        >
          Clear custom messages
        </button>
        <button
          type="button"
          className="classic-conn-btn"
          onClick={() => {
            onReset();
            setText('');
            setUsername('');
            setPlatform('kick');
            setAnnouncement('Preview reset to the built-in samples.');
          }}
        >
          Reset preview
        </button>
        {/* Live region: states the count, so the effect of Add and Clear is
            available without seeing the preview repaint. */}
        <span className="preview-compose-status" role="status">
          {announcement
            ? `${announcement} ${customCount} custom message${customCount === 1 ? '' : 's'} in the preview.`
            : ''}
        </span>
      </div>
    </div>
  );
}
