/* Right column — preview, channel identity, and the overlay URL.
 *
 * Channels sit beside the preview because they are what makes it real. Each
 * region is a card, matching the classic generator's visual language; the panel
 * previously separated them with whitespace alone, which is much of why it read
 * as unfinished beside that page.
 *
 * PREVIEW MODES. Live embeds the real overlay route in an iframe at the exact
 * generated URL. Demo renders the tool's own demo panel — for MultiChat, the
 * production overlay component over sample messages. The switch appears only when
 * the active tool declares a demo, so nothing chat-specific is assumed here.
 *
 * Only the active mode is mounted. That matters: leaving the Live iframe mounted
 * behind the Demo would keep a real overlay connected and polling while it is not
 * visible, so switching to Demo tears the iframe down.
 */
import { useState, type ReactNode } from 'react';
import Card, { SectionTitle } from './Card';
import ChannelPanel from './ChannelPanel';
import OverlayUrlBar from './OverlayUrlBar';
import PreviewModeSwitch, { type PreviewMode } from './PreviewModeSwitch';
import PreviewViewport from './PreviewViewport';
import { PreviewBackgroundPicker, type PreviewBackgroundId } from './PreviewBackground';
import type { ToolChannels, ToolDemoPanel, ToolPlatform } from '@/lib/tools/registry';

export default function LivePreviewPanel<P extends string>({
  url,
  query,
  configured,
  platforms,
  channels,
  onChannelChange,
  background,
  onBackgroundChange,
  previewTitle,
  previewHeight,
  previewNote,
  runtimePanel,
  demo,
  sourceTagExplicit = false,
}: {
  url: string;
  /** The query portion alone, for a demo panel that parses it back. */
  query: string;
  configured: boolean;
  /** Channel fields supplied by the active tool, passed straight through. */
  platforms: readonly ToolPlatform<P>[];
  channels: ToolChannels<P>;
  onChannelChange: (platform: P, raw: string) => void;
  background: PreviewBackgroundId;
  onBackgroundChange: (next: PreviewBackgroundId) => void;
  previewTitle: string;
  previewHeight: number;
  /** The active tool's own description of its preview. Plain text. */
  previewNote: string;
  /**
   * The active tool's own runtime panel, already constructed by the shell.
   *
   * Taken as an element rather than a component so this file needs no knowledge
   * of what runtime state is — it renders whatever it is handed, or nothing.
   */
  runtimePanel?: ReactNode;
  /** The active tool's demo mode, if it has one. */
  demo?: { label: string; hint: string; Panel: ToolDemoPanel };
  /** Whether sourceTag was set explicitly, passed through to a demo panel. */
  sourceTagExplicit?: boolean;
}) {
  /* Live by default: the real thing is the honest default, and a tool without a
     demo has no other option anyway. */
  const [mode, setMode] = useState<PreviewMode>('live');
  const showDemo = demo !== undefined && mode === 'demo';
  const DemoPanel = demo?.Panel;

  return (
    <section
      aria-labelledby="live-preview-heading"
      className="min-w-0 border-ws-border lg:h-full lg:overflow-y-auto lg:border-l"
    >
      <div className="space-y-4 px-4 py-5 sm:px-6">
        {/* The primary card: accent top border, as the classic generator gives
            its own hero card. */}
        <Card labelledBy="live-preview-heading" accent>
          <SectionTitle
            id="live-preview-heading"
            hint={showDemo ? demo?.hint : 'The real overlay at the URL below.'}
            actions={
              demo ? (
                <PreviewModeSwitch
                  mode={mode}
                  onChange={setMode}
                  demoLabel={demo.label}
                />
              ) : null
            }
          >
            {showDemo ? `${demo?.label} preview` : 'Live preview'}
          </SectionTitle>

          {/* Exactly one mode is mounted, so the Live iframe cannot keep an
              overlay connected while the Demo is on screen. */}
          {showDemo && DemoPanel ? (
            <DemoPanel
              query={query}
              height={previewHeight}
              background={background}
              sourceTagExplicit={sourceTagExplicit}
            />
          ) : (
            <>
              <PreviewViewport
                url={url}
                configured={configured}
                background={background}
                title={previewTitle}
                height={previewHeight}
                note={previewNote}
              />
              <div className="mt-4">
                <PreviewBackgroundPicker
                  value={background}
                  onChange={onBackgroundChange}
                />
              </div>
            </>
          )}
        </Card>

        <Card labelledBy="channels-heading">
          <SectionTitle
            id="channels-heading"
            hint="At least one channel is needed for a live preview."
          >
            Channels
          </SectionTitle>
          <ChannelPanel
            platforms={platforms}
            channels={channels}
            onChange={onChannelChange}
          />
        </Card>

        {/* After the channels it depends on: a connection is only meaningful
            once a channel names the account it has to match. */}
        {runtimePanel}

        {/* Titled "OBS browser source", not "Overlay URL": the readonly field
            inside is already labelled "Overlay URL", and repeating it here would
            give two elements the same accessible name — ambiguous to a screen
            reader and to getByLabelText. This title also says what the URL is
            for, which the field's label does not. */}
        <Card labelledBy="overlay-url-heading">
          <SectionTitle
            id="overlay-url-heading"
            hint="Paste this URL into an OBS browser source."
          >
            OBS browser source
          </SectionTitle>
          <OverlayUrlBar url={url} configured={configured} />
        </Card>
      </div>
    </section>
  );
}
