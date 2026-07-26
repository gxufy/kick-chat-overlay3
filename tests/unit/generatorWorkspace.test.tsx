/* GeneratorWorkspace: one derived URL, and it is the counter's own.
 *
 * The URL is now built by a shared helper that can also append a tool fragment,
 * so these lock down what that must not change: the counter's string stays what
 * plain serialization produced, and the iframe, the readonly field, Copy, and
 * Open all receive that one string.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import GeneratorWorkspace from '@/components/workspace/GeneratorWorkspace';
import { PREVIEW_DEBOUNCE_MS } from '@/components/workspace/OverlayPreviewFrame';
import { counterTool } from '@/lib/tools/counter/config';
import { DEFAULT_STYLE, buildViewerCounterQuery } from '@/lib/viewerCounterConfig';

const BASE = 'https://example.com';

/** The URL the previous concatenation would have produced, for comparison. */
const expectedUrl = (channels: Record<string, string>, style = DEFAULT_STYLE) =>
  `${BASE}/counter?${buildViewerCounterQuery(channels, style)}`;

const urlField = () => screen.getByLabelText('Overlay URL') as HTMLInputElement;
const settle = () => act(() => void vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS + 10));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('the counter URL is unchanged by the shared builder', () => {
  it('shows the plain serialized URL before any channel is typed', () => {
    render(<GeneratorWorkspace tool={counterTool} baseUrl={BASE} />);
    expect(urlField().value).toBe(expectedUrl({}));
    expect(urlField().value).not.toContain('#');
  });

  it('shows the plain serialized URL once a channel is valid', () => {
    render(<GeneratorWorkspace tool={counterTool} baseUrl={BASE} />);
    fireEvent.change(screen.getByLabelText('Twitch'), { target: { value: 'someone' } });
    expect(urlField().value).toBe(expectedUrl({ twitch: 'someone' }));
    expect(urlField().value).not.toContain('#');
  });

  it('keeps a setting change in the query, still with no fragment', () => {
    render(<GeneratorWorkspace tool={counterTool} baseUrl={BASE} />);
    fireEvent.change(screen.getByLabelText('Twitch'), { target: { value: 'someone' } });
    fireEvent.click(screen.getByLabelText('Combined total'));
    expect(urlField().value).toBe(
      expectedUrl(
        { twitch: 'someone' },
        { ...DEFAULT_STYLE, combined: !DEFAULT_STYLE.combined },
      ),
    );
    expect(urlField().value).not.toContain('#');
  });

  it('omits an invalid channel from the URL', () => {
    render(<GeneratorWorkspace tool={counterTool} baseUrl={BASE} />);
    fireEvent.change(screen.getByLabelText('Kick'), { target: { value: 'bad name' } });
    expect(urlField().value).toBe(expectedUrl({}));
    expect(urlField().value).not.toContain('bad');
  });
});

describe('one URL feeds the preview, the field, Copy, and Open', () => {
  const frame = () => document.querySelector('iframe');

  it('gives the iframe exactly the string shown in the field', () => {
    render(<GeneratorWorkspace tool={counterTool} baseUrl={BASE} />);
    fireEvent.change(screen.getByLabelText('Twitch'), { target: { value: 'someone' } });
    settle();
    expect(frame()?.getAttribute('src')).toBe(urlField().value);
  });

  it('copies exactly the string shown in the field', () => {
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<GeneratorWorkspace tool={counterTool} baseUrl={BASE} />);
    fireEvent.change(screen.getByLabelText('Twitch'), { target: { value: 'someone' } });
    fireEvent.click(screen.getByText('Copy overlay URL'));
    expect(writeText).toHaveBeenCalledWith(urlField().value);
    vi.unstubAllGlobals();
  });

  it('opens exactly the string shown in the field', () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    render(<GeneratorWorkspace tool={counterTool} baseUrl={BASE} />);
    fireEvent.change(screen.getByLabelText('Twitch'), { target: { value: 'someone' } });
    fireEvent.click(screen.getByText('Open in new tab'));
    expect(open).toHaveBeenCalledWith(urlField().value, '_blank', 'noopener,noreferrer');
    vi.unstubAllGlobals();
  });

  it('renders no iframe until a channel is configured', () => {
    render(<GeneratorWorkspace tool={counterTool} baseUrl={BASE} />);
    settle();
    expect(frame()).toBeNull();
  });

  it('removes the iframe as soon as the last channel is cleared', () => {
    render(<GeneratorWorkspace tool={counterTool} baseUrl={BASE} />);
    const twitch = screen.getByLabelText('Twitch');
    fireEvent.change(twitch, { target: { value: 'someone' } });
    settle();
    expect(frame()).not.toBeNull();

    fireEvent.change(twitch, { target: { value: '' } });
    expect(frame()).toBeNull();
  });
});

describe('channel fields come from the descriptor', () => {
  it('renders the counter platforms in descriptor order', () => {
    render(<GeneratorWorkspace tool={counterTool} baseUrl={BASE} />);
    expect(
      counterTool.platforms.map((platform) => screen.getByLabelText(platform.label).id),
    ).toEqual(['channel-twitch', 'channel-youtube', 'channel-kick', 'channel-tiktok']);
  });

  it('still renders all six counter settings', () => {
    render(<GeneratorWorkspace tool={counterTool} baseUrl={BASE} />);
    for (const setting of counterTool.catalog) {
      expect(screen.getByLabelText(setting.label)).toBeTruthy();
    }
    expect(counterTool.catalog).toHaveLength(6);
  });
});
