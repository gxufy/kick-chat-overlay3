/* No Counter URL may ever contain the literal string 'undefined'.
 *
 * THE EVIDENCE. A real request was observed in a development log:
 *
 *   /counter?kick=iceposeidon&combined=undefined&icons=undefined&bg=undefined
 *           &textShadow=small&stroke=none&align=undefined
 *
 * That is not a hypothetical. buildViewerCounterQuery reproduces it byte for
 * byte, in exactly that parameter order, from a style missing four fields: the
 * three booleans went through String(), which yields 'undefined', and align
 * passed its `!== DEFAULT_STYLE.align` guard because undefined !== 'left'.
 * textShadow and stroke carried real values because they were present — which
 * is why they alone look correct in the evidence.
 *
 * WHY IT MATTERS BEYOND COSMETICS. parseViewerCounterConfig reads booleans with
 * boolTrueDefault, which is `!== 'false'`. So combined=undefined parses back as
 * TRUE. Someone who switched Combined off and copied the URL got one that reads
 * as on, with nothing to indicate the setting had been dropped.
 *
 * WHAT THIS FILE COVERS. Page-level, through the real workspace shell and the
 * real counter descriptor — not the serializer in isolation, which the sibling
 * viewerCounterConfig tests already cover. The point is that no state the shell
 * can reach, at any point in its lifecycle, produces such a URL: not the first
 * unconfigured render, not mid-typing, not after a tool switch, not from a
 * restored draft, and not in the debounced iframe, Copy, or Open values.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import GeneratorWorkspace from '@/components/workspace/GeneratorWorkspace';
import { PREVIEW_DEBOUNCE_MS } from '@/components/workspace/OverlayPreviewFrame';
import { counterTool } from '@/lib/tools/counter/config';
import { multichatTool } from '@/lib/tools/multichat/config';
import type { OverlayTool } from '@/lib/tools/registry';
import { buildViewerCounterQuery } from '@/lib/viewerCounterConfig';

const BASE = 'https://example.com';

/** The exact shape observed in the wild, as a reproduction fixture. */
const EVIDENCE =
  'kick=iceposeidon&combined=undefined&icons=undefined&bg=undefined' +
  '&textShadow=small&stroke=none&align=undefined';

/**
 * Assert a URL is free of every spelling of the defect.
 *
 * Checks the specific token shapes the brief names and then the bare word, so a
 * new parameter that stringifies badly in some other position is still caught.
 */
function expectNoUndefined(url: string, label: string) {
  expect(url, `${label}: =undefined`).not.toContain('=undefined');
  expect(url, `${label}: undefined&`).not.toContain('undefined&');
  expect(url, `${label}: ?undefined`).not.toContain('?undefined');
  expect(url, `${label}: bare word`).not.toContain('undefined');
}

/* Generic over the tool so the MultiChat→Counter route-switch case can mount the
   other descriptor. A default parameter would pin the type to the counter's. */
const mount = <S extends Record<string, unknown>, P extends string, R>(
  tool: OverlayTool<S, P, R> = counterTool as never,
) => render(<GeneratorWorkspace tool={tool} baseUrl={BASE} />);

const urlField = () => screen.getByLabelText('Overlay URL') as HTMLInputElement;
const iframeSrc = () => document.querySelector('iframe')?.getAttribute('src') ?? '';
const settle = () => act(() => void vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS + 10));

/* Channel fields are addressed by id, not by label. MultiChat's catalog also
   contains settings labelled per platform, so getByLabelText('Kick') is
   ambiguous there — and this helper is used against both tools. */
const channelInput = (platform: string): HTMLInputElement => {
  const el = document.getElementById(`channel-${platform}`);
  expect(el, `channel-${platform} field is missing`).not.toBeNull();
  return el as HTMLInputElement;
};

/** Type into one channel field. */
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
    /* Guards the fixture itself. If this ever stops matching, the evidence and
       the test have drifted and the rest of this file proves less than it
       claims. Uses the pre-fix code path deliberately: String() on undefined. */
    const params = new URLSearchParams({ kick: 'iceposeidon' });
    const partial: Record<string, unknown> = { textShadow: 'small', stroke: 'none' };
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
    // Missing fields became their defaults, not empty strings.
    expect(produced).toContain('combined=true');
    expect(produced).toContain('icons=true');
    expect(produced).toContain('bg=true');
  });
});

describe('the counter workspace lifecycle, end to end', () => {
  it('1. initial unconfigured render', () => {
    mount();
    expectNoUndefined(urlField().value, 'initial');
  });

  it('2. entering only a Kick channel', () => {
    mount();
    typeChannel('kick', 'iceposeidon');
    expectNoUndefined(urlField().value, 'kick only');
    expect(urlField().value).toContain('kick=iceposeidon');
  });

  it('3. the immediately displayed URL, before any debounce', () => {
    mount();
    typeChannel('kick', 'iceposeidon');
    // No settle() — this is the value Copy would read on the very next tick.
    expectNoUndefined(urlField().value, 'undebounced');
  });

  it('4. the debounced iframe URL', () => {
    mount();
    typeChannel('kick', 'iceposeidon');
    settle();
    const src = iframeSrc();
    expect(src).not.toBe('');
    expectNoUndefined(src, 'iframe src');
  });

  it('is clean at every keystroke of a channel name, not just the last', () => {
    /* The evidence URL had a complete channel, so the failure was not
       mid-typing — but a per-keystroke check is what proves no transient state
       between renders produces it either. */
    mount();
    const name = 'iceposeidon';
    for (let i = 1; i <= name.length; i++) {
      typeChannel('kick', name.slice(0, i));
      expectNoUndefined(urlField().value, `keystroke ${i}`);
    }
    settle();
    expectNoUndefined(iframeSrc(), 'iframe after typing');
  });

  it('5. routing from the MultiChat workspace to the Counter workspace', () => {
    /* A remount with a different descriptor is what the route change does:
       /tools/[tool] renders one GeneratorWorkspace keyed by the resolved tool.
       If any state survived that, a MultiChat style object would reach the
       counter serializer and every counter field would be missing — which is
       precisely the observed shape. */
    const { unmount } = mount(multichatTool);
    typeChannel('kick', 'iceposeidon');
    unmount();

    mount();
    expectNoUndefined(urlField().value, 'after tool switch');
    typeChannel('kick', 'iceposeidon');
    expectNoUndefined(urlField().value, 'after tool switch, configured');
    settle();
    expectNoUndefined(iframeSrc(), 'iframe after tool switch');
  });

  it('survives a MultiChat draft left in sessionStorage', () => {
    /* Draft restore is the one path that feeds stored, untyped data into style
       state. A draft written under the counter's own id but carrying MultiChat
       fields is the realistic stale-state case, and it must normalize rather
       than serialize undefined. */
    window.sessionStorage.setItem(
      'workspace-draft:counter',
      JSON.stringify({
        style: { textShadow: 'small', stroke: 'none', font: 'roboto', msgBold: true },
        channels: { kick: 'iceposeidon' },
        background: 'checker',
      }),
    );
    mount();
    expectNoUndefined(urlField().value, 'restored foreign draft');
    settle();
    expectNoUndefined(iframeSrc(), 'iframe from restored draft');
  });

  it('6. defaults before and after hydration settle to the same clean URL', () => {
    /* First paint and post-effect state are separate opportunities to serialize
       incomplete state. Both are asserted, and they must agree. */
    mount();
    const first = urlField().value;
    expectNoUndefined(first, 'first paint');
    settle();
    const after = urlField().value;
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
    fireEvent.click(screen.getByRole('button', { name: /copy overlay url/i }));
    await act(async () => void (await Promise.resolve()));

    expect(writeText).toHaveBeenCalledTimes(1);
    expectNoUndefined(writeText.mock.calls[0][0] as string, 'clipboard');
  });

  it('opens a URL with no undefined in it', () => {
    const open = vi.fn();
    vi.spyOn(window, 'open').mockImplementation(open as never);

    mount();
    typeChannel('kick', 'iceposeidon');
    fireEvent.click(screen.getByRole('button', { name: /open in new tab/i }));

    expect(open).toHaveBeenCalledTimes(1);
    expectNoUndefined(open.mock.calls[0][0] as string, 'window.open');
  });

  it('copies, displays, and previews the identical string', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    mount();
    typeChannel('kick', 'iceposeidon');
    settle();
    fireEvent.click(screen.getByRole('button', { name: /copy overlay url/i }));

    // One derived URL feeds all three, so a defect cannot hide in just one.
    expect(writeText.mock.calls[0][0]).toBe(urlField().value);
    expect(iframeSrc()).toBe(urlField().value);
  });
});

describe('every reachable style combination stays clean', () => {
  it('holds while toggling and re-selecting each counter control', () => {
    /* Exhaustive over the controls a user can actually operate, because the
       observed URL had four fields wrong at once — a state no single toggle
       produces, so no single-toggle test would have found it. */
    mount();
    typeChannel('kick', 'iceposeidon');

    for (const el of Array.from(
      document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    )) {
      fireEvent.click(el);
      expectNoUndefined(urlField().value, `after toggling ${el.id}`);
    }

    for (const select of Array.from(document.querySelectorAll('select'))) {
      for (const option of Array.from(select.options)) {
        fireEvent.change(select, { target: { value: option.value } });
        expectNoUndefined(urlField().value, `${select.id}=${option.value}`);
      }
    }

    settle();
    expectNoUndefined(iframeSrc(), 'iframe after full sweep');
  });
});
