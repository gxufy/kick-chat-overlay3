/* Command simulator — run a documented !multichat command against the demo.
 *
 * Every command shown here comes from `MULTICHAT_COMMANDS`, the authoritative
 * metadata module whose contents are already asserted against the overlay
 * handler's own `switch` labels by tests/unit/multichatCommands.test.ts. So this
 * panel cannot offer a command the parser does not implement, and a command
 * added to the handler appears here without touching this file.
 *
 * WHAT IT SIMULATES, AND WHAT IT DOES NOT. The commands that change what the
 * chat container looks like — hide, show, stop, ping — are applied to the demo
 * preview, because their effect is visible and local. The commands whose real
 * effect is a network fetch, a document reload, or audio playback (reload,
 * refresh, img, yt, tts) are listed and explained but not faked: pretending to
 * play a video in a preview would misrepresent what the overlay does. Which
 * bucket a command falls in is derived from its name once, below, so the two
 * lists cannot disagree with the metadata they come from.
 */
import { useId } from 'react';
import Button from '@/components/ui/inputs/Button';
import {
  MULTICHAT_COMMANDS,
  MULTICHAT_COMMAND_ALIAS,
  MULTICHAT_COMMAND_MIN_ACCESS,
  MULTICHAT_COMMAND_TRIGGER,
  type MultichatCommand,
} from '@/lib/multichatCommands';

/**
 * Commands whose effect the demo can honestly reproduce.
 *
 * Keyed by the metadata's own `name`, so a renamed command stops matching and
 * falls into the explained-only list rather than silently doing nothing.
 */
export const SIMULATABLE = ['hide', 'show', 'stop', 'ping'] as const;

export type SimulatedEffect = {
  /** Whether the chat container is currently hidden by `hide`. */
  hidden: boolean;
  /** Whether the `ping` confirmation is showing. */
  pinging: boolean;
};

export const NO_EFFECT: SimulatedEffect = { hidden: false, pinging: false };

/** Apply a command name to the simulated state. Pure, so it is directly testable. */
export function applyCommand(
  state: SimulatedEffect,
  name: string,
): SimulatedEffect {
  switch (name) {
    case 'hide':
      return { ...state, hidden: true };
    case 'show':
      return { ...state, hidden: false };
    /* The handler's `stop` clears active overlays — notifications, images,
       videos. In the demo the only such state is the ping confirmation. */
    case 'stop':
      return { ...state, pinging: false };
    case 'ping':
      return { ...state, pinging: true };
    default:
      return state;
  }
}

/** True when the demo can reproduce this command's effect. */
export function isSimulatable(command: MultichatCommand): boolean {
  return (SIMULATABLE as readonly string[]).includes(command.name);
}

export default function CommandSimulator({
  effect,
  onRun,
}: {
  effect: SimulatedEffect;
  /** Runs a command name through applyCommand in the parent's state. */
  onRun: (name: string) => void;
}) {
  const base = useId();

  const runnable = MULTICHAT_COMMANDS.filter(isSimulatable);
  const explained = MULTICHAT_COMMANDS.filter((c) => !isSimulatable(c));

  /* Describes the current simulated state in words, for the live region and for
     anyone who cannot see the preview change. */
  /* Composed, not a ternary chain: hiding the container and then pinging shows
     the Pong marker while the container stays hidden, and a chain that returned
     early on `hidden` would announce only half of what is on screen. */
  const stateLabel = [
    effect.hidden ? 'Chat container is hidden.' : 'Chat container is visible.',
    effect.pinging ? 'Pong confirmation is showing.' : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-4">
      <p className="text-xs text-ws-muted">
        Type these in your own chat. Both{' '}
        <code className="font-mono text-ws-text">{MULTICHAT_COMMAND_TRIGGER}</code>{' '}
        and{' '}
        <code className="font-mono text-ws-text">{MULTICHAT_COMMAND_ALIAS}</code>{' '}
        work. All of them need at least{' '}
        {MULTICHAT_COMMAND_MIN_ACCESS >= 1000 ? 'broadcaster' : 'moderator'}{' '}
        access — the overlay checks once, so the requirement is the same for every
        command.
      </p>

      <div>
        <h4 className="mb-2 text-xs font-semibold text-ws-text">
          Try them on the demo
        </h4>
        <div className="flex flex-wrap gap-2">
          {runnable.map((command) => (
            <Button
              key={command.name}
              onClick={() => onRun(command.name)}
              describedBy={`${base}-state`}
              title={command.syntax}
            >
              {command.syntax}
            </Button>
          ))}
        </div>
        <p
          id={`${base}-state`}
          role="status"
          className="mt-2 text-xs text-ws-muted"
        >
          {stateLabel}
        </p>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold text-ws-text">
          Real commands the preview cannot fake
        </h4>
        <p className="mb-2 text-xs text-ws-muted">
          These reload the source, fetch emotes, or play media. Showing a
          pretend version would misrepresent what happens in OBS.
        </p>
        <dl className="space-y-2">
          {explained.map((command) => (
            <div key={command.name}>
              <dt className="font-mono text-xs text-ws-accent">
                {command.syntax}
              </dt>
              <dd className="text-xs text-ws-muted">
                {command.summary}
                {command.detail ? ` ${command.detail}` : ''}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
