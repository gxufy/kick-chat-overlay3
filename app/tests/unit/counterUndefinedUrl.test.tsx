/* No Counter URL may ever contain the literal string 'undefined'.
 *
 * The generator, clipboard, Open link and native live preview must all consume
 * the same normalized /counter URL. The live preview deliberately receives the
 * URL as configuration instead of navigating an iframe to it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import ClassicGenerator from '@/components/classic/ClassicGenerator';
import { PREVIEW_DEBOUNCE_MS } from '@/components/workspace/OverlayPreviewFrame';
import { workspaceDraftKey } from '@/lib/workspaceStorage';
import { counterTool } from '@/features/counter/config';
import { buildViewerCounterQuery } from '@/lib/viewerCounterConfig';

vi.mock('next/head', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/components/workspace/LiveCounterPreview', () => ({
  default: ({ url, height }: { url: string; height: number }) => (
    <div
      data-testid="counter-live-preview"
      data-overlay-url={url}
      data-preview-height={String(height)}
    />
  ),
}));

const EVIDENCE =
  'kick=iceposeidon&combined=undefined&icons=undefined&bg=undefined' +
  '&textShadow=small&stroke=none&align=undefined';

function expectNoUndefined(url: string, label: string) {
  expect(url, `${label}: =undefined`).not.toContain('=undefined');
  expect(url, `${label}: undefined&`).not.toContain('undefined&');
  expect(url, `${label}: ?undefined`).not.toContain('?undefined');
  expect(url, `${label}: bare word`).not.toContain('undefined');
}

const mount = () => render(<ClassicGenerator />);

const counterPanel = () => {
  const panel = document.querySelector('.panel-counter-output');
  expect(panel, 'counter output panel is missing').not.toBeNull();
  return within(panel as HTMLElement);
};

const counterUrl = () =>
  counterPanel().getByLabelText('Generated viewer counter URL').textContent ?? '';

const counterLiveUrl = () =>
  document
    .querySelector('[data-testid="counter-live-preview"]')
    ?.getAttribute('data-overlay-url') ?? '';

const settle = () =>
  act(() => void vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS + 10));

const channelInput = (platform: string): HTMLInputElement => {
  const el = document.getElementById(`channel-${platform}`);
  expect(el, `channel-${platform} field is missing`).not.toBeNull();
  return el as HTMLInputElement;
};

const typeChannel = (platform: string, value: string) =>
  fireEvent.change(channelInput(platform), { target: { value } });

beforeEach(() => {
  vi.useFakeTimers();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('the reproduction fixture is genuinely what the bug looked like', () => {
  it('is reproduced exactly by a partial style before the fix', () => {
    const params = new URLSearchParams({ kick: 'iceposeidon' });
    const partial: Record<string, unknown> = {
      textShadow: 'small',
      stroke: 'none',
    };
    params.set('combined', String(partial.combined));
    params.set('icons', String(partial.icons));
    params.set('bg', String(partial.bg));
    params.set('textShadow', partial.textShadow as string);
    params.set('stroke', partial.stroke as string);
    params.set('align', String(partial.align));
    expect(params.toString()).toBe(EVIDENCE);
  });

  it('is no longer what the real serializer produces from that style', () => {
    const produced = buildViewerCounterQuery(
      { kick: 'iceposeidon' },
      { textShadow: 'small', stroke: 'none' },
    );
    expect(produced).not.toBe(EVIDENCE);
    expectNoUndefined(produced, 'serializer with partial style');
    expect(produced).toContain('combined=true');
    expect(produced).toContain('icons=true');
    expect(produced).toContain('bg=true');
  });
});

describe('the counter panel lifecycle, end to end', () => {
  it('1. initial unconfigured render', () => {
    mount();
    expectNoUndefined(counterUrl(), 'initial');
  });

  it('2. entering only a Kick channel', () => {
    mount();
    typeChannel('kick', 'iceposeidon');
    expectNoUndefined(counterUrl(), 'kick only');
    expect(counterUrl()).toContain('kick=iceposeidon');
  });

  it('3. the immediately displayed URL, before any debounce', () => {
    mount();
    typeChannel('kick', 'iceposeidon');
    expectNoUndefined(counterUrl(), 'undebounced');
  });

  it('4. the debounced native preview URL', () => {
    mount();
    typeChannel('kick', 'iceposeidon');
    settle();
    const url = counterLiveUrl();
    expect(url).not.toBe('');
    expectNoUndefined(url, 'native preview URL');
    expect(document.querySelector('iframe[src*="/counter"]')).toBeNull();
  });

  it('is clean at every keystroke of a channel name, not just the last', () => {
    mount();
    const name = 'iceposeidon';
    for (let i = 1; i <= name.length; i++) {
      typeChannel('kick', name.slice(0, i));
      expectNoUndefined(counterUrl(), `keystroke ${i}`);
    }
    settle();
    expectNoUndefined(counterLiveUrl(), 'native preview after typing');
  });

  it('5. stays clean across a remount, carrying nothing over', () => {
    const { unmount } = mount();
    typeChannel('kick', 'iceposeidon');
    unmount();

    mount();
    expectNoUndefined(counterUrl(), 'after remount');
    typeChannel('kick', 'iceposeidon');
    expectNoUndefined(counterUrl(), 'after remount, configured');
    settle();
    expectNoUndefined(counterLiveUrl(), 'native preview after remount');
  });

  it('survives a foreign draft left in sessionStorage', () => {
    window.sessionStorage.setItem(
      workspaceDraftKey(counterTool.id),
      JSON.stringify({
        version: 1,
        style: {
          textShadow: 'small',
          stroke: 'none',
          font: 'roboto',
          msgBold: true,
        },
        channels: { kick: 'iceposeidon' },
        background: 'checker',
      }),
    );
    mount();
    expectNoUndefined(counterUrl(), 'restored foreign draft');
    settle();
    expectNoUndefined(counterLiveUrl(), 'native preview from restored draft');
  });

  it('6. defaults before and after hydration settle to the same clean URL', () => {
    mount();
    const first = counterUrl();
    expectNoUndefined(first, 'first paint');
    settle();
    const after = counterUrl();
    expectNoUndefined(after, 'after effects');
    expect(after).toBe(first);
  });
});

describe('7. the values Copy and Open actually hand over', () => {
  it('copies a URL with no undefined in it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    mount();
    typeChannel('kick', 'iceposeidon');
    fireEvent.click(counterPanel().getByRole('button', { name: 'Copy' }));
    await act(async () => void (await Promise.resolve()));

    expect(writeText).toHaveBeenCalledTimes(1);
    expectNoUndefined(writeText.mock.calls[0][0] as string, 'clipboard');
  });

  it('offers Open at a URL with no undefined in it', () => {
    mount();
    typeChannel('kick', 'iceposeidon');
    const open = counterPanel().getByRole('link', { name: 'Open' });
    expectNoUndefined(open.getAttribute('href') ?? '', 'Open href');
  });

  it('copies, displays, opens, and previews the identical string', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    mount();
    typeChannel('kick', 'iceposeidon');
    settle();
    fireEvent.click(counterPanel().getByRole('button', { name: 'Copy' }));

    expect(writeText.mock.calls[0][0]).toBe(counterUrl());
    expect(counterLiveUrl()).toBe(counterUrl());
    expect(
      counterPanel().getByRole('link', { name: 'Open' }).getAttribute('href'),
    ).toBe(counterUrl());
  });
});

describe('every reachable counter style combination stays clean', () => {
  const counterSettings = () => {
    const panel = document.querySelector('.panel-counter-settings');
    expect(panel, 'counter settings panel is missing').not.toBeNull();
    return panel as HTMLElement;
  };

  it('holds while toggling and re-selecting each counter control', () => {
    mount();
    typeChannel('kick', 'iceposeidon');

    for (const el of Array.from(
      counterSettings().querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    )) {
      fireEvent.click(el);
      expectNoUndefined(counterUrl(), `after toggling ${el.id}`);
    }

    for (const select of Array.from(counterSettings().querySelectorAll('select'))) {
      for (const option of Array.from(select.options)) {
        fireEvent.change(select, { target: { value: option.value } });
        expectNoUndefined(counterUrl(), `${select.id}=${option.value}`);
      }
    }

    settle();
    expectNoUndefined(counterLiveUrl(), 'native preview after full sweep');
  });

  it('stays clean while the chat side is restyled around it', () => {
    mount();
    typeChannel('kick', 'iceposeidon');
    const before = counterUrl();

    const chatSettings = document.querySelector('.panel-chat-settings') as HTMLElement;
    for (const el of Array.from(
      chatSettings.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    )) {
      fireEvent.click(el);
      expectNoUndefined(counterUrl(), `chat toggle ${el.id}`);
    }
    for (const select of Array.from(chatSettings.querySelectorAll('select'))) {
      for (const option of Array.from(select.options)) {
        if (option.disabled) continue;
        fireEvent.change(select, { target: { value: option.value } });
        expectNoUndefined(counterUrl(), `chat ${select.id}=${option.value}`);
      }
    }

    expect(counterUrl()).toBe(before);
  });
});
