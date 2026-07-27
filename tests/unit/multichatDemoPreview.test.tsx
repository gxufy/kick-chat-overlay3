/* Demo Preview — that it is the production renderer, and that it is sealed off
 * from the generated URL.
 *
 * Two things matter here and are asserted through the real workspace shell
 * rather than by mounting DemoPreview alone:
 *
 *  1. The demo renders via the production ChatOverlay path, so appearance
 *     settings behave in it exactly as they will in OBS. Asserted by changing a
 *     setting and observing the rendered output change accordingly — not by
 *     checking that some component was imported.
 *  2. No demo-only state can reach the overlay URL. A demo filter, a composed
 *     message, or a simulated command must never alter what you paste into OBS.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import GeneratorWorkspace from '@/components/workspace/GeneratorWorkspace';
import { PREVIEW_DEBOUNCE_MS } from '@/components/workspace/OverlayPreviewFrame';
import { multichatTool } from '@/lib/tools/multichat/config';

const BASE = 'https://example.com';

const mount = () => render(<GeneratorWorkspace tool={multichatTool} baseUrl={BASE} />);

const urlField = () => screen.getByLabelText('Overlay URL') as HTMLInputElement;

/* By id, not by label text: "Kick" also labels the pin-platforms checkbox, so
   getByLabelText('Kick') is ambiguous in this tool's workspace. */
const channelField = (platform: string) =>
  document.querySelector(`#channel-${platform}`) as HTMLInputElement;

/** Switch to Demo mode. */
const toDemo = () => fireEvent.click(screen.getByLabelText('Demo'));

const demoRoot = () => document.querySelector('[data-testid="demo-preview"]');

/* The preview iframe navigates on a debounce, and the resulting state update has
   to be flushed inside act() or React never applies it. */
const settle = () => act(() => void vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS + 10));

beforeEach(() => {
  /* A draft would otherwise carry one test's channels into the next. */
  window.sessionStorage.clear();
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('mode switching', () => {
  it('starts in Live mode with no demo mounted', () => {
    mount();
    expect(demoRoot()).toBeNull();
  });

  it('mounts the demo when Demo is chosen', () => {
    mount();
    toDemo();
    expect(demoRoot()).not.toBeNull();
  });

  it('tears the live iframe down when switching to Demo', () => {
    mount();
    fireEvent.change(channelField('kick'), { target: { value: 'somechannel' } });
    settle();
    expect(document.querySelector('iframe')).not.toBeNull();

    toDemo();
    /* An iframe left mounted behind the demo would keep a real overlay
       connected and polling while off screen. */
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('restores the live iframe when switching back', () => {
    mount();
    fireEvent.change(channelField('kick'), { target: { value: 'somechannel' } });
    settle();
    toDemo();
    fireEvent.click(screen.getByLabelText('Live'));
    settle();
    expect(document.querySelector('iframe')).not.toBeNull();
  });
});

describe('the demo is the production renderer', () => {
  it('renders sample authors and text', () => {
    mount();
    toDemo();
    /* Sample content reaching the DOM at all is only possible through the
       overlay component — nothing else in the workspace renders messages. */
    expect(screen.getByText('greenscreen')).toBeTruthy();
    expect(
      screen.getByText(/first time catching the stream live/),
    ).toBeTruthy();
  });

  it('renders with no channel configured, which is the whole point', () => {
    mount();
    toDemo();
    /* Every channel field is empty — the state in which a live preview is
       correctly blank and therefore shows nothing about styling. The URL still
       carries the serializer's documented `kick=yourchannel` placeholder, so the
       empty fields are what is asserted, not the URL. */
    for (const platform of ['kick', 'twitch', 'youtube', 'tiktok']) {
      expect(channelField(platform).value).toBe('');
    }
    expect(screen.getByText('greenscreen')).toBeTruthy();
  });

  it('applies the font setting to the rendered output', () => {
    mount();
    toDemo();
    const before = demoRoot()?.innerHTML ?? '';
    fireEvent.change(screen.getByLabelText('Font'), { target: { value: 'roboto' } });
    const after = demoRoot()?.innerHTML ?? '';
    /* The overlay decides how a font becomes CSS; this asserts the setting
       reaches that decision, without restating its implementation. */
    expect(after).not.toBe(before);
    expect(after).toContain('Roboto');
  });

  it('applies the text size setting to the rendered output', () => {
    mount();
    toDemo();
    const before = demoRoot()?.innerHTML ?? '';
    fireEvent.change(screen.getByLabelText('Size'), { target: { value: 'large' } });
    expect(demoRoot()?.innerHTML).not.toBe(before);
  });

  it('renders the paint sample with a clipped gradient, as the overlay does', () => {
    mount();
    toDemo();
    const painted = screen.getByText('paintedname');
    /* background-clip:text is the overlay's own paint mechanism — its presence
       proves the sample travelled the real identity-paint branch. */
    expect(painted.getAttribute('style')).toMatch(/background-clip: ?text/i);
  });

  it('renders an event-card sample without a name colon', () => {
    mount();
    toDemo();
    /* System messages render as event cards; a colon would mean it fell through
       to the ordinary chat-line path. */
    const card = screen.getByText(/sent a super chat/);
    expect(card.textContent).not.toContain(':');
  });

  it('renders badge images for the badge sample', () => {
    mount();
    toDemo();
    const badges = demoRoot()?.querySelectorAll('img.ck-badge-img') ?? [];
    expect(badges.length).toBeGreaterThan(0);
  });

  it('renders emote images for the emote sample', () => {
    mount();
    toDemo();
    const emotes = demoRoot()?.querySelectorAll('img.ck-emote') ?? [];
    expect(emotes.length).toBeGreaterThan(0);
  });
});

/* The load-bearing guarantee: demo state is a viewing aid, not configuration.
   Anything here changing the URL would mean a preview choice silently altering
   what the user pastes into OBS. */
describe('the demo announces itself as a demo', () => {
  it('names the sample region, as the Live iframe is named by its title', () => {
    mount();
    toDemo();
    const group = screen.getByRole('group', {
      name: /Sample chat messages — not a live stream/,
    });
    /* Without a name, a screen reader reads nine lines of invented chat with
       nothing saying they are samples rather than a real stream. */
    expect(group).toBeTruthy();
  });

  /* An sr-only input whose label cannot show a focus ring is focusable with
     nothing drawn anywhere — a keyboard user cannot see where they are. Tailwind's
     `peer` only matches following siblings, so a nested input silently breaks it.
     This asserts the structure rather than the class string, since the bug is
     structural. */
  it('lets every visually-hidden control show a focus ring on its label', () => {
    mount();
    toDemo();
    /* Only sr-only inputs. A visible styled input — the settings Toggle, for
       instance — carries focus-visible:ring itself and needs nothing from its
       label, so requiring the sibling structure of it would be wrong. */
    const hidden = Array.from(
      document.querySelectorAll<HTMLInputElement>('input.sr-only'),
    );
    expect(hidden.length).toBeGreaterThan(0);
    for (const input of hidden) {
      const label = input.id
        ? document.querySelector(`label[for="${input.id}"]`)
        : input.closest('label');
      expect(label, `no label for ${input.id || input.type}`).not.toBeNull();
      /* peer-* only applies to a following sibling of the peer element. */
      expect(
        label!.previousElementSibling === input,
        `label for "${input.id}" is not a following sibling of its input, so its focus ring cannot render`,
      ).toBe(true);
      expect(input.className).toContain('peer');
    }
  });

  it('does not announce the platform chip beside the composer select', () => {
    mount();
    toDemo();
    /* The chip restates the select's own value; the select already announces it.
       Unlike the channel fields, where the chip *is* the label. */
    const chip = screen.getByText('kick');
    expect(chip.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('no demo state reaches the overlay URL', () => {
  it('is unchanged by entering Demo mode', () => {
    mount();
    fireEvent.change(channelField('kick'), { target: { value: 'somechannel' } });
    const before = urlField().value;
    toDemo();
    expect(urlField().value).toBe(before);
  });

  it('is unchanged by toggling a sample group off', () => {
    mount();
    toDemo();
    const before = urlField().value;
    fireEvent.click(screen.getByLabelText('Emotes'));
    expect(urlField().value).toBe(before);
  });

  it('is unchanged by composing a message', () => {
    mount();
    toDemo();
    const before = urlField().value;
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'someone' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByText('Add to preview'));
    expect(urlField().value).toBe(before);
  });

  it('is unchanged by running a simulated command', () => {
    mount();
    toDemo();
    const before = urlField().value;
    fireEvent.click(screen.getByRole('button', { name: '!multichat hide' }));
    expect(urlField().value).toBe(before);
  });

  it('never mentions the demo in the URL', () => {
    mount();
    toDemo();
    fireEvent.click(screen.getByLabelText('Emotes'));
    const url = urlField().value.toLowerCase();
    for (const word of ['demo', 'sample', 'composed', 'preview']) {
      expect(url).not.toContain(word);
    }
  });

  it('keeps the URL identical to the same settings in Live mode', () => {
    mount();
    fireEvent.change(channelField('kick'), { target: { value: 'somechannel' } });
    fireEvent.change(screen.getByLabelText('Size'), { target: { value: 'large' } });
    const live = urlField().value;

    toDemo();
    fireEvent.click(screen.getByLabelText('7TV paint'));
    fireEvent.click(screen.getByRole('button', { name: '!multichat hide' }));
    expect(urlField().value).toBe(live);
  });
});
