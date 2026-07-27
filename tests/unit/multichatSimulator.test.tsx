/* Command simulator and message creator.
 *
 * The simulator's value depends on it being honest: it must offer every command
 * the overlay implements, simulate only the ones whose effect it can genuinely
 * reproduce, and say plainly that the rest are not being faked. A simulator that
 * quietly pretended to reload a source or play a video would teach the wrong
 * thing about what the overlay does.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import GeneratorWorkspace from '@/components/workspace/GeneratorWorkspace';
import { multichatTool } from '@/lib/tools/multichat/config';
import {
  NO_EFFECT,
  SIMULATABLE,
  applyCommand,
  isSimulatable,
} from '@/components/workspace/multichat/CommandSimulator';
import { composeMessage } from '@/components/workspace/multichat/MessageCreator';
import { MULTICHAT_COMMANDS } from '@/lib/multichatCommands';

const mount = () => {
  render(<GeneratorWorkspace tool={multichatTool} baseUrl="https://example.com" />);
  fireEvent.click(screen.getByLabelText('Demo'));
};

const button = (name: string) => screen.getByRole('button', { name });

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('applyCommand', () => {
  it('hides on hide and restores on show', () => {
    const hidden = applyCommand(NO_EFFECT, 'hide');
    expect(hidden.hidden).toBe(true);
    expect(applyCommand(hidden, 'show').hidden).toBe(false);
  });

  it('is idempotent', () => {
    const once = applyCommand(NO_EFFECT, 'hide');
    expect(applyCommand(once, 'hide')).toEqual(once);
  });

  it('clears the ping confirmation on stop, matching the handler', () => {
    const pinging = applyCommand(NO_EFFECT, 'ping');
    expect(pinging.pinging).toBe(true);
    expect(applyCommand(pinging, 'stop').pinging).toBe(false);
  });

  it('leaves hidden state alone on stop', () => {
    /* `stop` clears active overlays; it is not an alias for `show`. */
    const hidden = applyCommand(NO_EFFECT, 'hide');
    expect(applyCommand(hidden, 'stop').hidden).toBe(true);
  });

  it('ignores a command it does not simulate', () => {
    for (const name of ['reload', 'refresh', 'img', 'yt', 'tts', 'nonsense']) {
      expect(applyCommand(NO_EFFECT, name)).toEqual(NO_EFFECT);
    }
  });

  it('does not mutate the state it is given', () => {
    const before = { ...NO_EFFECT };
    applyCommand(NO_EFFECT, 'hide');
    expect(NO_EFFECT).toEqual(before);
  });
});

describe('the simulatable set is grounded in the real command list', () => {
  it('names only commands the overlay actually implements', () => {
    const real = new Set(MULTICHAT_COMMANDS.map((c) => c.name));
    for (const name of SIMULATABLE) {
      expect(real.has(name), `"${name}" is not a real command`).toBe(true);
    }
  });

  it('classifies every real command as simulated or explained, never neither', () => {
    for (const command of MULTICHAT_COMMANDS) {
      /* isSimulatable is total over the command list, so a newly added command
         cannot fall through into being silently unlisted. */
      expect(typeof isSimulatable(command)).toBe('boolean');
    }
  });

  it('marks each simulatable command as such and the rest as not', () => {
    for (const command of MULTICHAT_COMMANDS) {
      expect(isSimulatable(command)).toBe(
        (SIMULATABLE as readonly string[]).includes(command.name),
      );
    }
  });
});

describe('rendered simulator', () => {
  it('lists every real command somewhere', () => {
    mount();
    for (const command of MULTICHAT_COMMANDS) {
      expect(
        screen.queryAllByText(command.syntax).length,
        `"${command.syntax}" is not shown`,
      ).toBeGreaterThan(0);
    }
  });

  it('offers a button for each simulatable command', () => {
    mount();
    for (const command of MULTICHAT_COMMANDS.filter(isSimulatable)) {
      expect(button(command.syntax)).toBeTruthy();
    }
  });

  it('offers no button for a command it cannot honestly fake', () => {
    mount();
    for (const command of MULTICHAT_COMMANDS.filter((c) => !isSimulatable(c))) {
      expect(
        screen.queryByRole('button', { name: command.syntax }),
        `"${command.syntax}" must not be clickable`,
      ).toBeNull();
    }
  });

  it('says the unfakeable commands are not being faked', () => {
    mount();
    expect(screen.getByText(/cannot fake/i)).toBeTruthy();
  });

  /* `hide` sets display:none on the container, as the overlay's own
     setChatVisible does — it does not discard messages. So hiddenness is
     asserted on the container's style, and the messages are asserted to still be
     mounted, which is what makes `show` able to restore them. */
  const container = () =>
    document.querySelector('[data-testid="demo-chat-container"]') as HTMLElement;

  it('hides the container on hide and restores it on show', () => {
    mount();
    expect(container().style.display).toBe('');

    fireEvent.click(button('!multichat hide'));
    expect(container().style.display).toBe('none');
    expect(screen.getByText(/Chat container hidden/)).toBeTruthy();

    fireEvent.click(button('!multichat show'));
    expect(container().style.display).toBe('');
    expect(screen.getByText('greenscreen')).toBeTruthy();
  });

  it('keeps the messages mounted while hidden, as the real overlay does', () => {
    mount();
    fireEvent.click(button('!multichat hide'));
    /* Discarding them would misrepresent the command and, because ChatOverlay
       tracks the ids it has already batched, would make `show` a no-op. */
    expect(screen.getByText('greenscreen')).toBeTruthy();
  });

  it('restores every message after hide and show, not just some', () => {
    mount();
    const before = container().textContent;
    fireEvent.click(button('!multichat hide'));
    fireEvent.click(button('!multichat show'));
    expect(container().textContent).toBe(before);
  });

  it('shows and clears the pong confirmation', () => {
    mount();
    fireEvent.click(button('!multichat ping'));
    expect(screen.getByText('Pong!')).toBeTruthy();
    fireEvent.click(button('!multichat stop'));
    expect(screen.queryByText('Pong!')).toBeNull();
  });

  it('describes the current state in a live region', () => {
    mount();
    fireEvent.click(button('!multichat hide'));
    const status = screen.getByText(/Chat container is hidden/);
    expect(status.getAttribute('role')).toBe('status');
  });

  it('announces both hidden and pinging when both are true', () => {
    mount();
    fireEvent.click(button('!multichat hide'));
    fireEvent.click(button('!multichat ping'));
    /* Both are on screen, so both must be in the live region — a ternary chain
       that returned early on `hidden` would announce only half of it. */
    const status = screen.getByText(/Chat container is hidden\./);
    expect(status.textContent).toContain('Pong confirmation is showing.');
  });

  it('does not announce the visual markers twice', () => {
    mount();
    fireEvent.click(button('!multichat hide'));
    fireEvent.click(button('!multichat ping'));
    /* The in-preview markers restate what the live region already says. */
    expect(screen.getByText('Pong!').getAttribute('aria-hidden')).toBe('true');
    expect(
      screen.getByText(/Chat container hidden/).getAttribute('aria-hidden'),
    ).toBe('true');
  });

  it('hides the pin along with the rest of the container', () => {
    mount();
    fireEvent.click(button('!multichat hide'));
    /* The pin renders inside the container, so one display:none covers it — the
       real `hide` hides the whole chat container, pin included. */
    /* Two matches: the pin card above the list, and the same sample in the list
       itself. Both must be inside the hidden container. */
    const matches = screen.getAllByText(/read the pinned message/);
    expect(matches.length).toBeGreaterThan(0);
    for (const node of matches) {
      expect(node.closest('[data-testid="demo-chat-container"]')).not.toBeNull();
    }
  });
});

describe('composeMessage', () => {
  const fields = {
    platform: 'kick' as const,
    username: 'someone',
    text: 'hello there',
    moderator: false,
    subscriber: false,
  };

  it('produces a chat message with the given name and text', () => {
    const msg = composeMessage(fields, 1);
    expect(msg.kind).toBe('chat');
    expect(msg.identity.username).toBe('someone');
    expect(msg.message).toEqual(['hello there']);
  });

  it('derives its id from the counter, not from a clock', () => {
    expect(composeMessage(fields, 7).id).toBe('composed-7');
    /* Same inputs, same output — no Date.now or Math.random anywhere. */
    expect(composeMessage(fields, 7)).toEqual(composeMessage(fields, 7));
  });

  it('gives distinct ids for distinct counter values', () => {
    expect(composeMessage(fields, 1).id).not.toBe(composeMessage(fields, 2).id);
  });

  it('falls back to placeholders rather than rendering an empty line', () => {
    const msg = composeMessage({ ...fields, username: '  ', text: '' }, 1);
    expect(msg.identity.username).toBe('your_name');
    expect(msg.message).toEqual(['your message text']);
  });

  it('trims whitespace around the name and text', () => {
    const msg = composeMessage({ ...fields, username: '  bob  ', text: '  hi  ' }, 1);
    expect(msg.identity.username).toBe('bob');
    expect(msg.message).toEqual(['hi']);
  });

  it('adds only the badges that were selected', () => {
    expect(composeMessage(fields, 1).identity.badges).toHaveLength(0);
    expect(
      composeMessage({ ...fields, moderator: true }, 1).identity.badges,
    ).toHaveLength(1);
    expect(
      composeMessage({ ...fields, moderator: true, subscriber: true }, 1).identity.badges,
    ).toHaveLength(2);
  });

  it('fills the identity fields the renderer reads unconditionally', () => {
    const msg = composeMessage(fields, 1);
    expect(typeof msg.identity.background).toBe('string');
    expect(typeof msg.identity.filter).toBe('string');
    expect(typeof msg.identity.color).toBe('string');
  });
});

describe('rendered message creator', () => {
  it('adds a composed message to the preview', () => {
    mount();
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'mytestname' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'my test text' } });
    fireEvent.click(button('Add to preview'));

    expect(screen.getByText('mytestname')).toBeTruthy();
    expect(screen.getByText('my test text')).toBeTruthy();
  });

  it('reports how many messages were composed, in a live region', () => {
    mount();
    const status = screen.getByText(/No composed messages yet/);
    expect(status.getAttribute('role')).toBe('status');

    fireEvent.click(button('Add to preview'));
    expect(screen.getByText(/1 composed message in preview/)).toBeTruthy();

    fireEvent.click(button('Add to preview'));
    expect(screen.getByText(/2 composed messages in preview/)).toBeTruthy();
  });

  it('clears composed messages without touching the fixed samples', () => {
    mount();
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'mytestname' } });
    fireEvent.click(button('Add to preview'));
    fireEvent.click(button('Clear composed'));

    expect(screen.queryByText('mytestname')).toBeNull();
    expect(screen.getByText('greenscreen')).toBeTruthy();
  });

  it('disables Clear until something has been composed', () => {
    mount();
    expect(button('Clear composed').hasAttribute('disabled')).toBe(true);
    fireEvent.click(button('Add to preview'));
    expect(button('Clear composed').hasAttribute('disabled')).toBe(false);
  });
});
