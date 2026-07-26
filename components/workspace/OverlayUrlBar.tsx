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

export default function OverlayUrlBar({
  url,
  configured,
}: {
  url: string;
  configured: boolean;
}) {
  const [message, setMessage] = useState('');

  const copy = () => {
    if (!configured) {
      setMessage(UNCONFIGURED_MESSAGE);
      return;
    }
    void navigator.clipboard?.writeText(url);
    setMessage('Overlay URL copied.');
  };

  const open = () => {
    if (!configured) {
      setMessage(UNCONFIGURED_MESSAGE);
      return;
    }
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

      <div className="flex flex-wrap gap-2">
        <Button onClick={copy} variant="primary">
          Copy overlay URL
        </Button>
        <Button onClick={open}>Open in new tab</Button>
      </div>

      {/* Live region exists before the first message so updates are announced. */}
      <p
        role="status"
        aria-live="polite"
        className={`text-xs ${configured ? 'text-ws-muted' : 'text-ws-danger'}`}
      >
        {message}
      </p>
    </div>
  );
}
