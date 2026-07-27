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
 * WHAT THIS FILE COVERS. Page-level, through the real Classic generator and the
 * real counter descriptor — not the serializer in isolation, which the sibling
 * viewerCounterConfig tests already cover. The point is that no state the page
 * can reach, at any point in its lifecycle, produces such a URL: not the first
 * unconfigured render, not mid-typing, not after a remount, not from a restored
 * draft, and not in the debounced iframe, Copy, or Open values.
 *
 * The counter now lives inside the generator rather than in a workspace of its
 * own, so every case is exercised where a user actually meets it: on the same
 * page as 24 chat settings that write a different style object.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import ClassicGenerator from '@/components/classic/ClassicGenerator';
import { PREVIEW_DEBOUNCE_MS } from '@/components/workspace/OverlayPreviewFrame';
import { workspaceDraftKey } from '@/lib/workspaceStorage';
import { counterTool } from '@/lib/tools/counter/config';
import { buildViewerCounterQuery } from '@/lib/viewerCounterConfig';

/* next/head renders nothing in jsdom and next/link wants a router context; the
   generator is being asked about its URLs, not its chrome. */
vi.mock('next/head', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

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

const mount = () => render(<ClassicGenerator />);

/** The Counter panel, so its Copy button and URL are addressed unambiguously —
 *  the chat panel beside it has a Copy button and a URL of its own. */
const counterPanel = () => {
  const panel = document.querySelector('.panel-counter-output');
  expect(panel, 'counter output panel is missing').not.toBeNull();
  return within(panel as HTMLElement);
};

const counterUrl = () =>
  counterPanel().getByLabelText('Generated viewer counter URL').textContent ?? '';

const counterIframeSrc = () =>
  document
    .querySelector('iframe[title="Live viewer counter preview"]')
    ?.getAttribute('src') ?? '';

const settle = () => act(() => void vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS + 10));

/* Channel fields are addressed by id, not by label: both catalogs on this page
   contain settings labelled per platform, so getByLabelText('Kick') is
   ambiguous. */
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
    // No settle() — this is the value Copy would read on the very next tick.
    expectNoUndefined(counterUrl(), 'undebounced');
  });

  it('4. the debounced iframe URL', () => {
    mount();
    typeChannel('kick', 'iceposeidon');
    settle();
    const src = counterIframeSrc();
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
      expectNoUndefined(counterUrl(), `keystroke ${i}`);
    }
    settle();
    expectNoUndefined(counterIframeSrc(), 'iframe after typing');
  });

  it('5. stays clean across a remount, carrying nothing over', () => {
    /* The counter used to be its own route, and a route change remounted the
       shell with a different descriptor. It is now a panel, so the remount that
       matters is a plain reload of the generator — and if any counter state
       survived it as a partial object, every counter field would be missing,
       which is precisely the observed shape. */
    const { unmount } = mount();
    typeChannel('kick', 'iceposeidon');
    unmount();

    mount();
    expectNoUndefined(counterUrl(), 'after remount');
    typeChannel('kick', 'iceposeidon');
    expectNoUndefined(counterUrl(), 'after remount, configured');
    settle();
    expectNoUndefined(counterIframeSrc(), 'iframe after remount');
  });

  it('survives a foreign draft left in sessionStorage', () => {
    /* Draft restore is the one path that feeds stored, untyped data into style
       state. A draft written under the counter's own key but carrying MultiChat
       fields is the realistic stale-state case — and it is more likely now that
       both tools write a draft on the same OAuth navigation. It must normalize
       rather than serialize undefined. */
    window.sessionStorage.setItem(
      workspaceDraftKey(counterTool.id),
      JSON.stringify({
        version: 1,
        style: { textShadow: 'small', stroke: 'none', font: 'roboto', msgBold: true },
        channels: { kick: 'iceposeidon' },
        background: 'checker',
      }),
    );
    mount();
    expectNoUndefined(counterUrl(), 'restored foreign draft');
    settle();
    expectNoUndefined(counterIframeSrc(), 'iframe from restored draft');
  });

  it('6. defaults before and after hydration settle to the same clean URL', () => {
    /* First paint and post-effect state are separate opportunities to serialize
       incomplete state. Both are asserted, and they must agree. */
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

    // One derived URL feeds all four, so a defect cannot hide in just one.
    expect(writeText.mock.calls[0][0]).toBe(counterUrl());
    expect(counterIframeSrc()).toBe(counterUrl());
    expect(counterPanel().getByRole('link', { name: 'Open' }).getAttribute('href')).toBe(
      counterUrl(),
    );
  });
});

describe('every reachable counter style combination stays clean', () => {
  /* Scoped to the counter's own controls. The chat settings on this page write a
     different style object, and sweeping them here would prove nothing about the
     counter while making a failure hard to attribute. */
  const counterSettings = () => {
    const panel = document.querySelector('.panel-counter-settings');
    expect(panel, 'counter settings panel is missing').not.toBeNull();
    return panel as HTMLElement;
  };

  it('holds while toggling and re-selecting each counter control', () => {
    /* Exhaustive over the controls a user can actually operate, because the
       observed URL had four fields wrong at once — a state no single toggle
       produces, so no single-toggle test would have found it. */
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
    expectNoUndefined(counterIframeSrc(), 'iframe after full sweep');
  });

  it('stays clean while the chat side is restyled around it', () => {
    /* The two panels share a page and a channel map. Sweeping every chat control
       is what proves the counter's style object is genuinely separate: a shared
       or partially-spread style is exactly how fields go missing. */
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

    // And unchanged: no chat setting is a counter parameter.
    expect(counterUrl()).toBe(before);
  });
});
