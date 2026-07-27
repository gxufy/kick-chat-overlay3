/* DemoPanel — the MultiChat tool's demo mode, assembled.
 *
 * Owns the demo's own state: which sample groups are shown, which messages the
 * user composed, and the simulated command effect. None of that is overlay
 * configuration, so none of it reaches the generated URL — a demo choice can
 * never change what you paste into OBS.
 *
 * The renderer is `DemoPreview`, which mounts the production ChatOverlay. This
 * file arranges controls around it and decides which messages it receives.
 */
import { useMemo, useState } from 'react';
import Card, { SectionTitle } from '../Card';
import CommandSimulator, {
  NO_EFFECT,
  applyCommand,
  type SimulatedEffect,
} from './CommandSimulator';
import DemoPreview from './DemoPreview';
import MessageCreator from './MessageCreator';
import PreviewBackground, { type PreviewBackgroundId } from '../PreviewBackground';
import {
  SAMPLE_GROUPS,
  SAMPLE_MESSAGES,
  type SampleGroup,
} from '@/lib/tools/multichat/samples';
import type { ParsedMessage } from '@/lib/kick';

/** Human labels for the group filter. Derived keys, written labels. */
const GROUP_LABEL: Record<SampleGroup, string> = {
  plain: 'Plain',
  badges: 'Badges',
  mention: 'Mentions',
  emotes: 'Emotes',
  paint: '7TV paint',
  moderation: 'Moderation',
  event: 'Event cards',
  pin: 'Pinned',
};

export default function DemoPanel({
  query,
  height,
  background,
  sourceTagExplicit,
}: {
  /** The overlay query string from the tool's serializer. */
  query: string;
  height: number;
  background: PreviewBackgroundId;
  sourceTagExplicit: boolean;
}) {
  /* All groups on by default: the point of the demo is to see everything the
     renderer does before deciding what to change. */
  const [groups, setGroups] = useState<ReadonlySet<SampleGroup>>(
    () => new Set(SAMPLE_GROUPS),
  );
  const [composed, setComposed] = useState<readonly ParsedMessage[]>([]);
  const [effect, setEffect] = useState<SimulatedEffect>(NO_EFFECT);

  const toggleGroup = (group: SampleGroup) =>
    setGroups((current) => {
      const next = new Set(current);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });

  /* Fixed samples in the enabled groups, then anything composed, so a new
     composed message appears at the bottom like a real incoming one. */
  const messages = useMemo(() => {
    const fixed = SAMPLE_MESSAGES.filter((s) => groups.has(s.group)).map(
      (s) => s.message,
    );
    return [...fixed, ...composed];
  }, [groups, composed]);

  /* `hide` sets display:none on the chat container — see setChatVisible in
     pages/multichat.tsx. It does NOT discard messages, and the demo must not
     either, for two reasons. It would misrepresent the command: after `show` the
     real overlay still has everything it received. And ChatOverlay tracks the ids
     it has already batched, so a message removed from the list never returns —
     emptying the list would make `hide` permanent and `show` a no-op. */
  const showPin = groups.has('pin');

  return (
    <div className="space-y-4">
      <PreviewBackground background={background}>
        <div className="relative" style={{ minHeight: height }}>
          {/* display:none, exactly as the overlay's own setChatVisible does, so
              the messages stay mounted and `show` genuinely restores them. */}
          <div
            data-testid="demo-chat-container"
            style={effect.hidden ? { display: 'none' } : undefined}
          >
            <DemoPreview
              query={query}
              messages={messages}
              showPin={showPin}
              height={height}
              sourceTagExplicit={sourceTagExplicit}
            />
          </div>

          {/* The ping confirmation, matching what the handler shows for 3s. */}
          {effect.pinging ? (
            /* aria-hidden: the simulator's live region already states that the
               Pong confirmation is showing, so announcing this too would say the
               same thing twice. */
            <p
              aria-hidden="true"
              className="pointer-events-none absolute right-2 top-2 rounded-md bg-black/70 px-2 py-1 text-sm font-semibold text-white"
            >
              Pong!
            </p>
          ) : null}

          {effect.hidden ? (
            /* aria-hidden for the same reason as the Pong marker: this explains
               the blank area to someone looking at it, and the simulator's live
               region already announces the hidden state in words. */
            <p
              aria-hidden="true"
              className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-ws-muted"
            >
              Chat container hidden. Run <span className="mx-1 font-mono">show</span>{' '}
              to bring it back.
            </p>
          ) : null}
        </div>
      </PreviewBackground>

      <p className="text-xs text-ws-muted">
        Sample messages in the real overlay renderer — the same component OBS
        loads. Nothing here changes the generated URL.
      </p>

      <Card as="div" raised>
        <SectionTitle level={3} hint="Show or hide each kind of sample.">
          Sample messages
        </SectionTitle>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Sample message kinds</legend>
          {SAMPLE_GROUPS.map((group) => {
            const on = groups.has(group);
            return (
              /* Input as a preceding sibling, not nested in the label, so
                 `peer-focus-visible` can reach the label — Tailwind's peer only
                 matches following siblings. Nested, the sr-only input would take
                 focus with nothing drawn anywhere, leaving a keyboard user unable
                 to see which chip they are on. Same structure as
                 PreviewBackgroundPicker. */
              <div key={group} className="flex">
                <input
                  id={`demo-group-${group}`}
                  type="checkbox"
                  checked={on}
                  onChange={() => toggleGroup(group)}
                  className="peer sr-only"
                />
                <label
                  htmlFor={`demo-group-${group}`}
                  className={[
                    'cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                    'peer-focus-visible:ring-2 peer-focus-visible:ring-ws-ring',
                    'peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-ws-surface',
                    'motion-reduce:transition-none',
                    on
                      ? 'border-ws-accent bg-ws-accent/15 text-ws-accent'
                      : 'border-ws-border bg-ws-control text-ws-muted hover:text-ws-text',
                  ].join(' ')}
                >
                  {GROUP_LABEL[group]}
                </label>
              </div>
            );
          })}
        </fieldset>
      </Card>

      <Card as="div" raised>
        <SectionTitle
          level={3}
          hint="Compose your own line and see it rendered with your settings."
        >
          Message creator
        </SectionTitle>
        <MessageCreator
          onAdd={(message) => setComposed((current) => [...current, message])}
          onClear={() => setComposed([])}
          addedCount={composed.length}
        />
      </Card>

      <Card as="div" raised>
        <SectionTitle level={3} hint="Every command the overlay actually implements.">
          Command simulator
        </SectionTitle>
        <CommandSimulator
          effect={effect}
          onRun={(name) => setEffect((current) => applyCommand(current, name))}
        />
      </Card>
    </div>
  );
}
