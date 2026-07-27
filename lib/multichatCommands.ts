/* Authoritative !multichat command metadata.
 *
 * The overlay's command handler in pages/multichat.tsx is the implementation;
 * this module is the single description of it. Both the workspace Commands panel
 * and the classic generator's table read from here, so neither can document a
 * command the parser does not implement.
 *
 * A test in tests/unit/multichatCommands.test.ts reads the handler's own switch
 * statement out of the source file and asserts its `case` labels are exactly the
 * names below. That is what keeps this from drifting into fiction: adding a case
 * without documenting it, or documenting one that was removed, fails the suite.
 *
 * Everything here was traced from the handler rather than assumed. In
 * particular: both triggers are prefix matches on the lowercased text, the
 * access gate is a single `>= 500` check applied before the switch (so every
 * command carries the same requirement), and there is no `refresh` variant other
 * than a bare call or the literal `emotes`.
 */

/** Primary trigger word. */
export const MULTICHAT_COMMAND_TRIGGER = '!multichat';

/** Legacy trigger, still accepted verbatim by the handler. */
export const MULTICHAT_COMMAND_ALIAS = '!kickchat';

/** Access levels the handler derives from unified badges. */
export const MULTICHAT_ACCESS_BROADCASTER = 1000;
export const MULTICHAT_ACCESS_MODERATOR = 500;

/**
 * The minimum level the handler requires, checked once before the switch.
 *
 * Because the gate is not per-command, every documented command shares this
 * requirement. Presenting a per-command access column would imply a distinction
 * the implementation does not make.
 */
export const MULTICHAT_COMMAND_MIN_ACCESS = MULTICHAT_ACCESS_MODERATOR;

export type MultichatCommand = {
  /** The `case` label in the handler's switch — the second whitespace token. */
  readonly name: string;
  /** Exact syntax, including the trigger. */
  readonly syntax: string;
  /** What it does, in one line. */
  readonly summary: string;
  /** Extra detail only where behaviour would otherwise be guessed at. */
  readonly detail?: string;
};

/**
 * Every command the handler implements, in switch order.
 *
 * Order matches the switch so a reader comparing the two sees them line up.
 */
export const MULTICHAT_COMMANDS: readonly MultichatCommand[] = [
  {
    name: 'ping',
    syntax: '!multichat ping',
    summary: 'Shows a "Pong!" confirmation on the overlay for 3 seconds.',
    detail: 'Quickest way to confirm the browser source is live and receiving chat.',
  },
  {
    name: 'reload',
    syntax: '!multichat reload',
    summary: 'Reloads the whole browser source.',
  },
  {
    name: 'stop',
    syntax: '!multichat stop',
    summary: 'Clears every active overlay: notifications, images, and videos.',
  },
  {
    name: 'show',
    syntax: '!multichat show',
    summary: 'Shows the chat container again after hide.',
  },
  {
    name: 'hide',
    syntax: '!multichat hide',
    summary: 'Hides the chat container without stopping the connections.',
  },
  {
    name: 'refresh',
    syntax: '!multichat refresh [emotes]',
    summary: 'Reloads 7TV, BTTV, and FFZ emotes without reloading the source.',
    detail:
      'The argument is optional and the only accepted value is "emotes"; anything else does nothing.',
  },
  {
    name: 'img',
    syntax: '!multichat img <url|emote> [-t seconds] [-o opacity]',
    summary: 'Shows a fullscreen image, or an emote by name, over the scene.',
    detail:
      'Defaults to 5 seconds at full opacity. "!multichat img clear" dismisses it early.',
  },
  {
    name: 'yt',
    syntax: '!multichat yt <url|preset> [-t seconds] [-m]',
    summary: 'Plays a fullscreen YouTube video over the scene.',
    detail:
      'Presets: bruh, vine-boom, dc-ping, rickroll, win-error. Defaults to 5 seconds; -m mutes.',
  },
  {
    name: 'tts',
    syntax: '!multichat tts <message>',
    summary: 'Reads the message aloud through the browser source.',
    detail:
      'Uses the server voice, falling back to the browser voice if that request fails.',
  },
];
