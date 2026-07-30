/* The preview-only zoom.
 *
 * The whole risk this guards against is that a "make the preview smaller"
 * control quietly becomes a "make the overlay smaller" control. So every test
 * here is one half of that pair: the zoom must visibly change the preview
 * surface, and it must leave the serialized configuration, the generated URL, the
 * saved draft and the renderer's own props untouched.
 *
 * WHY THE ASSERTIONS LOOK LIKE GEOMETRY. The zoom is implemented by enlarging the
 * frame's internal viewport and scaling it back down, which is the only mechanism
 * that shrinks *everything* together — text, badges, emotes, source markers, event
 * cards and the pin card — without the renderer being told anything. A font-size
 * override would leave every px dimension in the overlay's CSS behind. So the
 * thing worth asserting is the geometry: viewport up by 1/f, transform down by f,
 * outer box unchanged and still clipped. jsdom computes no layout, so what is
 * checked is the declaration that produces the layout rather than a screenshot of
 * it — which is also the only part that could regress silently.
 *
 * Numbers are parsed rather than string-matched. `133.3333%` is an implementation
 * detail of how the percentage is rounded; that it is 100/0.75 is not.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import ClassicGenerator from '@/components/classic/ClassicGenerator';
import ClassicChatPreview from '@/components/classic/ClassicChatPreview';
import IsolatedPreviewFrame, {
  PREVIEW_SCALES,
  PREVIEW_SCALE_DEFAULT,
  type PreviewScale,
} from '@/components/classic/IsolatedPreviewFrame';
import { PREVIEW_DEBOUNCE_MS } from '@/components/workspace/OverlayPreviewFrame';
import { multichatTool } from '@/features/multichat/config';
import { MULTICHAT_OBS_SIZE } from '@/features/multichat/obs';
import { MULTICHAT_CATALOG } from '@/features/multichat/settings';
import { SAMPLE_COSMETICS, sampleMessages } from '@/features/multichat/samples';
import { workspaceDraftKey } from '@/lib/workspaceStorage';
import type { ToolChannels } from '@/features/registry';
import type { MultichatPlatform } from '@/lib/multichatConfig';

vi.mock('next/head', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const NO_CHANNELS: ToolChannels<MultichatPlatform> = {};

const queryFor = (style: Partial<Record<string, unknown>> = {}) =>
  multichatTool.serialize(NO_CHANNELS, { ...multichatTool.defaults, ...style } as never);

const CHAT_TITLE = 'MultiChat sample preview';

const frameEl = (title = CHAT_TITLE) =>
  document.querySelector<HTMLIFrameElement>(`iframe[title="${title}"]`)!;

/** The box the frame lives in — the one that must never change size. */
const wrapperEl = (title = CHAT_TITLE) => frameEl(title).parentElement as HTMLElement;

const frameDoc = (title = CHAT_TITLE) => frameEl(title).contentDocument!;

/** The scale factor the frame's own transform declares, as a number. */
function transformFactor(title = CHAT_TITLE): number {
  const transform = frameEl(title).style.transform;
  if (!transform) return 1;
  const match = /scale\(([\d.]+)\)/.exec(transform);
  expect(match, `unparseable transform: ${transform}`).not.toBeNull();
  return Number(match![1]);
}

/** The frame's declared viewport width, as a percentage number. */
const viewportPercent = (title = CHAT_TITLE) =>
  Number.parseFloat(frameEl(title).style.width);

const mountPreview = (scale?: number, style: Partial<Record<string, unknown>> = {}) =>
  render(
    <ClassicChatPreview
      query={queryFor(style)}
      messages={sampleMessages()}
      cosmetics={SAMPLE_COSMETICS}
      width={MULTICHAT_OBS_SIZE.width}
      height={MULTICHAT_OBS_SIZE.height}
      {...(scale === undefined ? {} : { scale })}
    />,
  );

/* ------------------------------------------------------------------ */
/* The steps themselves                                               */
/* ------------------------------------------------------------------ */

describe('the zoom offers exactly the four specified steps', () => {
  it('offers 65, 75, 85 and 100 percent', () => {
    expect([...PREVIEW_SCALES]).toEqual([65, 75, 85, 100]);
  });

  it('defaults to 75 percent rather than full size', () => {
    /* The default is the point of the feature: at 100% the 680×280 source fits
       too few lines to judge density. */
    expect(PREVIEW_SCALE_DEFAULT).toBe(75);
    expect(PREVIEW_SCALES).toContain(PREVIEW_SCALE_DEFAULT);
  });

  it('is not one of the overlay settings, under any name', () => {
    /* The guard against this becoming a real setting later by accident: if a
       `previewScale` or `zoom` key ever appears in the catalog it would start
       being serialized, which is the failure the whole feature must avoid.

       `emoteScale` is a real setting and a legitimate match for a bare /scale/,
       so the guard names the keys it forbids instead of banning the word. Any
       preview-only key is forbidden outright — nothing about the preview belongs
       in a catalog whose whole purpose is to be serialized. */
    const keys = MULTICHAT_CATALOG.map((setting) => String(setting.key));
    for (const forbidden of ['previewScale', 'scale', 'zoom', 'previewZoom']) {
      expect(keys, forbidden).not.toContain(forbidden);
    }
    expect(keys.filter((key) => /preview/i.test(key))).toEqual([]);
    expect(keys).toContain('emoteScale');
  });
});

/* ------------------------------------------------------------------ */
/* The mechanism, in the frame                                        */
/* ------------------------------------------------------------------ */

describe('the frame implements the zoom by enlarging its own viewport', () => {
  afterEach(cleanup);

  it.each(PREVIEW_SCALES)('gives %i%% a viewport of 100/f and a transform of f', (scale) => {
    mountPreview(scale);
    const factor = scale / 100;
    expect(transformFactor()).toBeCloseTo(factor, 4);
    /* The viewport is enlarged by exactly the reciprocal, so the scaled result
       occupies the box again. Any other pairing would either leave a gap or
       overflow. */
    expect(viewportPercent()).toBeCloseTo(100 / factor, 3);
  });

  it('scales from the top-left corner, so nothing is pulled out of the box', () => {
    /* Scaling about the centre would move the surface up and left by half the
       overflow and clip the top of the pin card. */
    mountPreview(65);
    expect(frameEl().style.transformOrigin).toBe('0 0');
  });

  it('declares no transform at all at 100 percent', () => {
    /* Full size must be the untouched path: a scale(1) would still create a
       containing block and a compositing layer for nothing. */
    mountPreview(100);
    expect(frameEl().style.transform).toBe('');
    expect(viewportPercent()).toBeCloseTo(100, 3);
  });

  it('leaves the outer box the same size at every step', () => {
    /* The canonical ratio is what makes the preview trustworthy, so the zoom must
       change what is drawn inside the box and never the box. */
    for (const scale of PREVIEW_SCALES) {
      mountPreview(scale);
      const wrapper = wrapperEl();
      expect(wrapper.style.width, String(scale)).toBe('100%');
      expect(wrapper.style.aspectRatio.replace(/\s+/g, ''), String(scale)).toBe('680/280');
      expect(wrapper.getAttribute('data-preview-ratio'), String(scale)).toBe('680/280');
      cleanup();
    }
  });

  it('keeps the box clipped at every step, so an enlarged viewport cannot escape', () => {
    /* This is the one that matters most: the frame is deliberately larger than
       its container before the transform applies, and `overflow: hidden` on the
       wrapper is what guarantees the intermediate size is never visible. */
    for (const scale of PREVIEW_SCALES) {
      mountPreview(scale);
      expect(wrapperEl().style.overflow, String(scale)).toBe('hidden');
      cleanup();
    }
  });

  it('never lets the frame be smaller than its box, whatever it is handed', () => {
    /* Clamped rather than trusted: 0 would divide into an infinite width and a
       value above 100 would shrink the frame and leave a visible gap. */
    mountPreview(0);
    expect(viewportPercent()).toBeGreaterThanOrEqual(100);
    cleanup();
    mountPreview(400);
    expect(viewportPercent()).toBeCloseTo(100, 3);
    expect(transformFactor()).toBeCloseTo(1, 4);
  });

  it('applies to any framed renderer, not only to chat', () => {
    /* The frame is shared with the counter preview, so the zoom lives in one
       place rather than being reimplemented per tool. */
    render(
      <IsolatedPreviewFrame title="probe" width={400} height={80} scale={65}>
        <p>inside</p>
      </IsolatedPreviewFrame>,
    );
    expect(transformFactor('probe')).toBeCloseTo(0.65, 4);
    expect(wrapperEl('probe').style.overflow).toBe('hidden');
  });
});

/* ------------------------------------------------------------------ */
/* Everything inside scales together                                  */
/* ------------------------------------------------------------------ */

describe('the whole preview surface scales, not just the text', () => {
  afterEach(cleanup);

  it('scales the pin card and the event cards with the messages', () => {
    /* Asserted structurally rather than by measurement, and that is the stronger
       claim: the pin card and the event cards are inside the frame's document, so
       one transform on the frame moves all of them by construction. A per-element
       font override is what could scale the list and leave the pin behind, and
       this is what would notice it.

       Anchored on rendered text, not on selectors. PinBanner and the event card
       are class-less divs carrying inline styles, so `.ck-pin` matches nothing —
       their own visible output is the only honest handle. The pin card also sits
       *outside* #chat_container, which is exactly why it is worth naming here:
       anything that scaled the list alone would miss it. */
    mountPreview(65);
    const doc = frameDoc();

    const pinLabel = Array.from(doc.querySelectorAll('span')).find(
      (el) => el.textContent === 'Pinned Message',
    );
    expect(pinLabel, 'the pinned fixture should be rendered').toBeDefined();

    const eventBody = Array.from(doc.querySelectorAll('.ck-body')).find((el) =>
      (el.textContent ?? '').includes('Super Chat'),
    );
    expect(eventBody, 'the event-card fixture should be rendered').toBeDefined();

    const list = doc.querySelector('#chat_container');
    expect(list).not.toBeNull();

    /* The pin banner is a sibling of the list rather than a descendant of it —
       stated as an assertion because it is the reason the transform has to live on
       the frame and not on the message list. */
    expect(list!.contains(pinLabel!)).toBe(false);
    expect(list!.contains(eventBody!)).toBe(true);

    /* All three are nonetheless inside the one scaled frame. */
    for (const node of [pinLabel!, eventBody!, list!]) {
      expect(doc.contains(node)).toBe(true);
    }
    expect(transformFactor()).toBeCloseTo(0.65, 4);
  });

  it('leaves the overlay stylesheet identical across every step', () => {
    /* The renderer is never told about the zoom, so its emitted CSS must be
       byte-identical at 65% and at 100%. A difference here would mean the zoom had
       reached into the production styles. */
    const cssAt = (scale: PreviewScale) => {
      mountPreview(scale);
      const css = Array.from(frameDoc().querySelectorAll('style'))
        .map((el) => el.textContent ?? '')
        .join('\n');
      cleanup();
      return css;
    };
    const small = cssAt(65);
    const full = cssAt(100);
    expect(small.length).toBeGreaterThan(0);
    expect(small).toBe(full);
  });

  it('renders the same messages at every step', () => {
    const textAt = (scale: PreviewScale) => {
      mountPreview(scale);
      const text = frameDoc().body.textContent ?? '';
      cleanup();
      return text;
    };
    expect(textAt(65)).toBe(textAt(100));
  });
});

/* ------------------------------------------------------------------ */
/* Wired into the generator                                           */
/* ------------------------------------------------------------------ */

describe('the scale control in the generator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.sessionStorage.clear();
  });

  const settle = () => act(() => void vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS + 10));

  const chatUrl = () =>
    within(document.querySelector<HTMLElement>('.panel-chat-output')!)
      .getByLabelText('Generated MultiChat overlay URL').textContent ?? '';

  const radio = (scale: number) =>
    document.getElementById(`preview-scale-${scale}`) as HTMLInputElement;

  it('starts at 75 percent, with the frame already scaled', () => {
    render(<ClassicGenerator />);
    expect(radio(PREVIEW_SCALE_DEFAULT).checked).toBe(true);
    expect(transformFactor()).toBeCloseTo(0.75, 4);
  });

  it('offers one radio per step, in one named group', () => {
    render(<ClassicGenerator />);
    for (const scale of PREVIEW_SCALES) {
      const input = radio(scale);
      expect(input, String(scale)).toBeTruthy();
      expect(input.type).toBe('radio');
      expect(input.name).toBe('preview-scale');
      expect(document.querySelector(`label[for="preview-scale-${scale}"]`)).toBeTruthy();
    }
  });

  it('rescales the frame when a step is chosen', () => {
    render(<ClassicGenerator />);
    act(() => void fireEvent.click(radio(65)));
    expect(transformFactor()).toBeCloseTo(0.65, 4);
    act(() => void fireEvent.click(radio(100)));
    expect(frameEl().style.transform).toBe('');
  });

  it('changes neither the generated URL nor the draft at any step', () => {
    render(<ClassicGenerator />);
    settle();
    const before = chatUrl();
    expect(before.length).toBeGreaterThan(0);
    const draftBefore = window.sessionStorage.getItem(workspaceDraftKey('multichat')) ?? '';
    for (const scale of PREVIEW_SCALES) {
      act(() => void fireEvent.click(radio(scale)));
      settle();
      expect(chatUrl(), String(scale)).toBe(before);
    }
    expect(window.sessionStorage.getItem(workspaceDraftKey('multichat')) ?? '').toBe(
      draftBefore,
    );
    /* And no zoom vocabulary reached the query under any name. */
    expect(before).not.toMatch(/scale|zoom|preview/i);
  });

  it('leaves textSize alone — the real setting keeps its own value', () => {
    /* The failure this prevents: implementing the zoom by driving `textSize`,
       which would look right in the preview and change what OBS draws. */
    render(<ClassicGenerator />);
    settle();
    const sizeBefore = (document.getElementById('set-textSize') as HTMLSelectElement | null)
      ?.value;
    act(() => void fireEvent.click(radio(65)));
    settle();
    const sizeAfter = (document.getElementById('set-textSize') as HTMLSelectElement | null)
      ?.value;
    expect(sizeAfter).toBe(sizeBefore);
  });

  it('resets to 75 percent, and says so on the button', () => {
    render(<ClassicGenerator />);
    act(() => void fireEvent.click(radio(100)));
    expect(radio(100).checked).toBe(true);
    const reset = screen.getByRole('button', {
      name: `Reset scale to ${PREVIEW_SCALE_DEFAULT}%`,
    }) as HTMLButtonElement;
    expect(reset.disabled).toBe(false);
    act(() => void fireEvent.click(reset));
    expect(radio(PREVIEW_SCALE_DEFAULT).checked).toBe(true);
    expect(transformFactor()).toBeCloseTo(0.75, 4);
    /* Nothing left to do once it is back at the default. */
    expect(
      (screen.getByRole('button', {
        name: `Reset scale to ${PREVIEW_SCALE_DEFAULT}%`,
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('names the control as a preview zoom and says the overlay is unaffected', () => {
    render(<ClassicGenerator />);
    const fieldset = document.querySelector<HTMLFieldSetElement>('.preview-scale')!;
    expect(fieldset.querySelector('legend')!.textContent).toBe('Preview scale');
    const help = document.getElementById('preview-scale-help')!;
    expect(fieldset.getAttribute('aria-describedby')).toBe('preview-scale-help');
    expect(help.textContent ?? '').toMatch(/preview only/i);
    expect(help.textContent ?? '').toMatch(/url/i);
  });

  it('scales the composed messages by the same frame as the simulated ones', () => {
    /* One frame, one transform: custom and generated messages cannot end up at
       different sizes because there is only one surface. */
    render(<ClassicGenerator />);
    act(() => void fireEvent.click(radio(65)));
    const frames = Array.from(
      document.querySelectorAll<HTMLIFrameElement>(`iframe[title="${CHAT_TITLE}"]`),
    );
    expect(frames).toHaveLength(1);
    expect(transformFactor()).toBeCloseTo(0.65, 4);
  });

  it('is absent once a channel is configured, where the real overlay renders', () => {
    /* With a channel the panel is the live overlay in its own navigating frame,
       and a zoom that silently did nothing there would be worse than no control. */
    render(<ClassicGenerator />);
    act(() =>
      void fireEvent.change(document.getElementById('channel-kick')!, {
        target: { value: 'somechannel' },
      }),
    );
    settle();
    expect(document.querySelector('.preview-scale')).toBeNull();
  });
});
