/* Readonly overlay URL plus the permanent Copy and Open actions.
 *
 * The URL shown here is the same string the preview iframe loads, so what is
 * copied and what is previewed can never disagree. Nothing is written to the
 * browser address bar.
 *
 * Both actions are gated on having a configured platform. When unconfigured
 * they explain why in an inline live region rather than firing an alert() or
 * silently copying a channel-less URL.
 */
import { useState } from 'react';
import Button from '@/components/ui/inputs/Button';
import TextInput from '@/components/ui/inputs/TextInput';

const UNCONFIGURED_MESSAGE = 'Enter at least one channel first.';

/** Said when the clipboard is unavailable or refuses. Names the recovery. */
const MANUAL_COPY_MESSAGE =
  'Could not copy automatically. Select the URL above and copy it manually.';

export default function OverlayUrlBar({
  url,
  configured,
}: {
  url: string;
  configured: boolean;
}) {
  const [message, setMessage] = useState('');
  /* Tracks whether the last message was a failure, so the styling follows the
     outcome rather than `configured` — a copy can fail on a configured URL. */
  const [failed, setFailed] = useState(false);

  /* Only claims success once the write has actually resolved.
   *
   * The clipboard API is absent on insecure origins and rejects when the
   * permission is denied or the document is not focused. Reporting "copied"
   * regardless would send someone to OBS to paste a URL they do not have, and
   * the field is readonly, so the fallback has to be told to them explicitly. */
  const copy = async (): Promise<void> => {
    if (!configured) {
      setMessage(UNCONFIGURED_MESSAGE);
      return;
    }
    setFailed(false);

    const write = navigator.clipboard?.writeText;
    if (!write) {
      setFailed(true);
      setMessage(MANUAL_COPY_MESSAGE);
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setMessage('Overlay URL copied.');
    } catch {
      setFailed(true);
      setMessage(MANUAL_COPY_MESSAGE);
    }
  };

  const open = () => {
    if (!configured) {
      setMessage(UNCONFIGURED_MESSAGE);
      return;
    }
    setFailed(false);
    setMessage('');
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-2">
      <TextInput
        id="overlay-url"
        label="Overlay URL"
        value={url}
        readOnly
        monospace
      />

      <div className="flex flex-wrap gap-2 pt-1">
        <Button onClick={() => void copy()} variant="primary">
          Copy overlay URL
        </Button>
        <Button onClick={open}>Open in new tab</Button>
      </div>

      {/* Live region exists before the first message so updates are announced. */}
      <p
        role="status"
        aria-live="polite"
        className={`text-xs ${configured && !failed ? 'text-ws-muted' : 'text-ws-danger'}`}
      >
        {message}
      </p>
    </div>
  );
}
