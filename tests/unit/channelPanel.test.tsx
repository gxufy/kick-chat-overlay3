/* ChannelPanel renders whatever platforms the active tool declares.
 *
 * The point of these is that the component has no platform list of its own: the
 * first group drives it with an invented two-platform tool and its own
 * validation rule, which would be impossible if anything counter-specific were
 * still hardcoded. The last group checks the real counter descriptor still
 * produces the four fields it always did.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ChannelPanel from '@/components/workspace/ChannelPanel';
import type { ToolPlatform } from '@/lib/tools/registry';
import { COUNTER_PLATFORMS } from '@/lib/tools/counter/config';

afterEach(cleanup);

/* Nothing to do with the counter: uppercase-only keys, a different rule, and
 * only two fields. */
const INVENTED: readonly ToolPlatform<'alpha' | 'beta'>[] = [
  {
    key: 'alpha',
    label: 'Alpha channel',
    placeholder: 'alpha id',
    normalize: (raw) => (typeof raw === 'string' && /^\d+$/.test(raw) ? raw : ''),
    invalidMessage: 'Digits only.',
  },
  { key: 'beta', label: 'Beta channel', normalize: (raw) => String(raw ?? '').trim() },
];

describe('platforms come from the descriptor', () => {
  it('renders one labelled input per declared platform, in order', () => {
    render(<ChannelPanel platforms={INVENTED} channels={{}} onChange={() => {}} />);
    const labels = screen
      .getAllByLabelText(/channel$/i)
      .map((input) => input.getAttribute('id'));
    expect(labels).toEqual(['channel-alpha', 'channel-beta']);
    expect(screen.getByLabelText('Alpha channel')).toHaveProperty('value', '');
  });

  it('renders no field for a platform the tool does not declare', () => {
    render(<ChannelPanel platforms={INVENTED} channels={{}} onChange={() => {}} />);
    expect(screen.queryByLabelText('Twitch')).toBeNull();
    expect(screen.queryByLabelText('TikTok')).toBeNull();
  });

  it('uses each platform placeholder, and none where undeclared', () => {
    render(<ChannelPanel platforms={INVENTED} channels={{}} onChange={() => {}} />);
    expect(screen.getByLabelText('Alpha channel').getAttribute('placeholder')).toBe(
      'alpha id',
    );
    expect(screen.getByLabelText('Beta channel').hasAttribute('placeholder')).toBe(
      false,
    );
  });

  it('reports edits with the platform key the descriptor declared', () => {
    const onChange = vi.fn();
    render(<ChannelPanel platforms={INVENTED} channels={{}} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Alpha channel'), {
      target: { value: '42' },
    });
    expect(onChange).toHaveBeenCalledWith('alpha', '42');
  });

  it('shows the value supplied for each platform', () => {
    render(
      <ChannelPanel
        platforms={INVENTED}
        channels={{ alpha: '7', beta: 'hello' }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText('Alpha channel')).toHaveProperty('value', '7');
    expect(screen.getByLabelText('Beta channel')).toHaveProperty('value', 'hello');
  });
});

describe('validation comes from the descriptor normalizer', () => {
  it('marks a non-empty value invalid only when that rule rejects it', () => {
    render(
      <ChannelPanel
        platforms={INVENTED}
        channels={{ alpha: 'not-digits' }}
        onChange={() => {}}
      />,
    );
    const input = screen.getByLabelText('Alpha channel');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Digits only.')).toBeTruthy();
  });

  it('accepts a value the declared rule allows', () => {
    render(
      <ChannelPanel platforms={INVENTED} channels={{ alpha: '99' }} onChange={() => {}} />,
    );
    expect(screen.getByLabelText('Alpha channel').getAttribute('aria-invalid')).not.toBe(
      'true',
    );
    expect(screen.queryByText('Digits only.')).toBeNull();
  });

  it('treats an empty field as unfilled rather than invalid', () => {
    render(
      <ChannelPanel platforms={INVENTED} channels={{ alpha: '' }} onChange={() => {}} />,
    );
    expect(screen.getByLabelText('Alpha channel').getAttribute('aria-invalid')).not.toBe(
      'true',
    );
  });
});

describe('the counter descriptor still produces its four fields', () => {
  it('renders Twitch, YouTube, Kick, TikTok in the overlay order', () => {
    render(
      <ChannelPanel platforms={COUNTER_PLATFORMS} channels={{}} onChange={() => {}} />,
    );
    expect(
      COUNTER_PLATFORMS.map((platform) => screen.getByLabelText(platform.label).id),
    ).toEqual(['channel-twitch', 'channel-youtube', 'channel-kick', 'channel-tiktok']);
  });

  it('keeps the channel-name placeholder and the counter error text', () => {
    render(
      <ChannelPanel
        platforms={COUNTER_PLATFORMS}
        channels={{ twitch: 'bad name' }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText('Kick').getAttribute('placeholder')).toBe(
      'channel name',
    );
    expect(
      screen.getByText('Only letters, numbers, "." "_" "-" (max 50 chars).'),
    ).toBeTruthy();
  });

  it('accepts an @-prefixed name, as the overlay rule does', () => {
    render(
      <ChannelPanel
        platforms={COUNTER_PLATFORMS}
        channels={{ tiktok: '@someone' }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText('TikTok').getAttribute('aria-invalid')).not.toBe('true');
  });

  it('still reports edits per platform key', () => {
    const onChange = vi.fn();
    render(
      <ChannelPanel
        platforms={COUNTER_PLATFORMS}
        channels={{}}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText('YouTube'), { target: { value: 'chan' } });
    expect(onChange).toHaveBeenCalledWith('youtube', 'chan');
  });
});
