/* Command metadata must describe the real parser, not a parallel wish list.
 *
 * The load-bearing test here reads pages/multichat.tsx and extracts the `case`
 * labels from the command handler's own switch statement, then asserts they are
 * exactly the documented names. A hardcoded expected list would drift silently
 * the moment someone adds or removes a case; reading the source cannot.
 *
 * The remaining tests pin the facts the UI copy asserts — both triggers, the
 * single shared access gate, and the argument shapes — so documentation cannot
 * claim capabilities the handler lacks.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MULTICHAT_ACCESS_BROADCASTER,
  MULTICHAT_ACCESS_MODERATOR,
  MULTICHAT_COMMANDS,
  MULTICHAT_COMMAND_ALIAS,
  MULTICHAT_COMMAND_MIN_ACCESS,
  MULTICHAT_COMMAND_TRIGGER,
} from '@/lib/multichatCommands';

const SOURCE = readFileSync(join(process.cwd(), 'pages', 'multichat.tsx'), 'utf8');

/** The handler body, from `function handleCommand` to `handle7TVDispatch`. */
const handlerBody = () => {
  const start = SOURCE.indexOf('function handleCommand');
  const end = SOURCE.indexOf('function handle7TVDispatch');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return SOURCE.slice(start, end);
};

/** Every `case 'x':` label inside the handler, in source order. */
const parsedCases = () =>
  Array.from(handlerBody().matchAll(/case '([a-z]+)':/g)).map((m) => m[1]);

describe('documented commands match the parser', () => {
  it('documents exactly the switch cases the handler implements', () => {
    expect(MULTICHAT_COMMANDS.map((c) => c.name)).toEqual(parsedCases());
  });

  it('finds a non-trivial number of cases, so the regex has not silently broken', () => {
    expect(parsedCases().length).toBeGreaterThanOrEqual(9);
  });

  it('documents no command the handler lacks', () => {
    const implemented = new Set(parsedCases());
    for (const command of MULTICHAT_COMMANDS) {
      expect(implemented.has(command.name)).toBe(true);
    }
  });

  it('omits commands the handler has never implemented', () => {
    const documented = new Set(MULTICHAT_COMMANDS.map((c) => c.name));
    for (const absent of ['say', 'clear', 'mute', 'volume', 'pin', 'timeout']) {
      expect(documented.has(absent)).toBe(false);
      expect(parsedCases()).not.toContain(absent);
    }
  });
});

describe('triggers and access', () => {
  it('matches the two triggers the handler accepts', () => {
    expect(MULTICHAT_COMMAND_TRIGGER).toBe('!multichat');
    expect(MULTICHAT_COMMAND_ALIAS).toBe('!kickchat');
    expect(handlerBody()).toContain("startsWith('!multichat')");
    expect(handlerBody()).toContain("startsWith('!kickchat')");
  });

  it('applies one shared moderator gate, not per-command levels', () => {
    expect(MULTICHAT_COMMAND_MIN_ACCESS).toBe(MULTICHAT_ACCESS_MODERATOR);
    expect(MULTICHAT_ACCESS_MODERATOR).toBe(500);
    expect(MULTICHAT_ACCESS_BROADCASTER).toBe(1000);
    /* One gate, before the switch: no command can be documented as having a
     * different requirement, because the code has only this check. */
    expect(handlerBody()).toContain('getAccessLevel(um) < 500');
    expect(handlerBody().match(/getAccessLevel\(um\)/g)).toHaveLength(1);
  });

  it('keeps the access levels the badge reader assigns', () => {
    expect(SOURCE).toContain("b.type === 'broadcaster' || b.type === 'owner') return 1000");
    expect(SOURCE).toContain("b.type === 'moderator') return 500");
  });
});

describe('documented syntax is well formed', () => {
  it('starts every syntax line with the primary trigger and its own name', () => {
    for (const command of MULTICHAT_COMMANDS) {
      expect(command.syntax.startsWith(`${MULTICHAT_COMMAND_TRIGGER} ${command.name}`)).toBe(
        true,
      );
    }
  });

  it('keeps names unique and lowercase, as the handler lowercases before matching', () => {
    const names = MULTICHAT_COMMANDS.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toBe(name.toLowerCase());
  });

  it('gives every command a summary', () => {
    for (const command of MULTICHAT_COMMANDS) {
      expect(command.summary.length).toBeGreaterThan(0);
      expect(command.summary.endsWith('.')).toBe(true);
    }
  });

  it('documents only the flags the handler actually parses', () => {
    const body = handlerBody();
    const img = MULTICHAT_COMMANDS.find((c) => c.name === 'img');
    const yt = MULTICHAT_COMMANDS.find((c) => c.name === 'yt');
    expect(body).toContain('-t\\s+([\\d.]+)');
    expect(body).toContain('-o\\s+([\\d.]+)');
    expect(body).toContain("text.includes('-m')");
    expect(img?.syntax).toContain('-t');
    expect(img?.syntax).toContain('-o');
    expect(yt?.syntax).toContain('-m');
    /* -o is an image-only flag: the yt branch never reads an opacity. */
    expect(yt?.syntax).not.toContain('-o');
  });

  it('documents the five yt presets the handler defines', () => {
    const yt = MULTICHAT_COMMANDS.find((c) => c.name === 'yt');
    for (const preset of ['bruh', 'vine-boom', 'dc-ping', 'rickroll', 'win-error']) {
      expect(handlerBody()).toContain(`'${preset}'`);
      expect(yt?.detail).toContain(preset);
    }
  });

  it('documents img clear, which the handler special-cases', () => {
    expect(handlerBody()).toContain("args[2] === 'clear'");
    expect(MULTICHAT_COMMANDS.find((c) => c.name === 'img')?.detail).toContain('clear');
  });

  it('documents refresh as taking only the optional emotes argument', () => {
    expect(handlerBody()).toContain("!args[2] || args[2] === 'emotes'");
    const refresh = MULTICHAT_COMMANDS.find((c) => c.name === 'refresh');
    expect(refresh?.syntax).toContain('[emotes]');
    expect(refresh?.detail).toContain('emotes');
  });
});
