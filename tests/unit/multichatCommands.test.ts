/* Command metadata must describe the real dispatcher, not a parallel wish list.
 *
 * The load-bearing test here reads lib/multichatCommandRuntime.ts and extracts the
 * `case` labels from the dispatcher's own switch statement, then asserts they are
 * exactly the documented names. A hardcoded expected list would drift silently the
 * moment someone adds or removes a case; reading the source cannot.
 *
 * The remaining tests pin the facts the UI copy asserts — both triggers, the single
 * shared access gate, and the argument shapes — so documentation cannot claim
 * capabilities the dispatcher lacks. Behaviour itself is tested by executing it:
 * see multichatCommandDispatch.test.ts, which drives every command through each
 * connector's real ingestion path.
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
import { MULTICHAT_TRIGGERS, YT_PRESETS } from '@/lib/multichatCommandRuntime';

const SOURCE = readFileSync(
  join(process.cwd(), 'src', 'lib', 'multichatCommandRuntime.ts'),
  'utf8',
);

/** The dispatcher body: the switch inside `handle`, to the end of the module. */
const handlerBody = () => {
  const start = SOURCE.indexOf('switch (command.name)');
  expect(start).toBeGreaterThan(-1);
  return SOURCE.slice(start);
};

/** The whole runtime module, for facts that live outside the switch. */
const runtimeSource = () => SOURCE;

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
  it('matches the two triggers the dispatcher accepts', () => {
    expect(MULTICHAT_COMMAND_TRIGGER).toBe('!multichat');
    expect(MULTICHAT_COMMAND_ALIAS).toBe('!kickchat');
    /* The runtime's own list, so a third trigger cannot appear undocumented. */
    expect([...MULTICHAT_TRIGGERS]).toEqual([
      MULTICHAT_COMMAND_TRIGGER,
      MULTICHAT_COMMAND_ALIAS,
    ]);
  });

  it('applies one shared moderator gate, not per-command levels', () => {
    expect(MULTICHAT_COMMAND_MIN_ACCESS).toBe(MULTICHAT_ACCESS_MODERATOR);
    expect(MULTICHAT_ACCESS_MODERATOR).toBe(500);
    expect(MULTICHAT_ACCESS_BROADCASTER).toBe(1000);
    /* One gate, before the switch: no command can be documented as having a
     * different requirement, because the code has only this check. */
    const gate = runtimeSource().match(/multichatAccessLevel\([^)]*\)\s*</g);
    expect(gate).toHaveLength(1);
    expect(runtimeSource()).toContain('< MULTICHAT_COMMAND_MIN_ACCESS');
  });

  it('keeps the access levels the badge reader assigns', () => {
    expect(runtimeSource()).toContain(
      "badge.type === 'broadcaster' || badge.type === 'owner'",
    );
    expect(runtimeSource()).toContain('return MULTICHAT_ACCESS_BROADCASTER');
    expect(runtimeSource()).toContain("badge.type === 'moderator'");
    expect(runtimeSource()).toContain('return MULTICHAT_ACCESS_MODERATOR');
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

  it('documents only the flags the dispatcher actually parses', () => {
    const source = runtimeSource();
    const img = MULTICHAT_COMMANDS.find((c) => c.name === 'img');
    const yt = MULTICHAT_COMMANDS.find((c) => c.name === 'yt');
    expect(source).toContain('-t\\s+([\\d.]+)');
    expect(source).toContain('-o\\s+([\\d.]+)');
    expect(source).toContain("command.text.includes('-m')");
    expect(img?.syntax).toContain('-t');
    expect(img?.syntax).toContain('-o');
    expect(yt?.syntax).toContain('-m');
    /* -o is an image-only flag: the yt branch never reads an opacity. */
    expect(yt?.syntax).not.toContain('-o');
  });

  it('documents exactly the yt presets the dispatcher defines', () => {
    const yt = MULTICHAT_COMMANDS.find((c) => c.name === 'yt');
    /* The runtime's own table, so a preset cannot be added or removed without the
       documented detail line failing. */
    expect(Object.keys(YT_PRESETS).sort()).toEqual(
      ['bruh', 'dc-ping', 'rickroll', 'vine-boom', 'win-error'].sort(),
    );
    for (const preset of Object.keys(YT_PRESETS)) {
      expect(yt?.detail).toContain(preset);
    }
  });

  it('documents img clear, which the dispatcher special-cases', () => {
    expect(runtimeSource()).toContain("command.args[0] === 'clear'");
    expect(MULTICHAT_COMMANDS.find((c) => c.name === 'img')?.detail).toContain('clear');
  });

  it('documents refresh as taking only the optional emotes argument', () => {
    expect(runtimeSource()).toContain("if (argument && argument !== 'emotes') return;");
    const refresh = MULTICHAT_COMMANDS.find((c) => c.name === 'refresh');
    expect(refresh?.syntax).toContain('[emotes]');
    expect(refresh?.detail).toContain('emotes');
  });
});
