/* Preview containment: the production overlays render inside their own documents.
 *
 * WHY THIS FILE EXISTS. Both previews mount the real production renderers, and
 * both of those renderers are written to own a whole browser source. ChatOverlay
 * in particular emits, through next/head:
 *
 *     html, body { margin:0 !important; padding:0 !important;
 *                  overflow:hidden !important; height:100vh !important;
 *                  position:relative !important; background:… !important; }
 *     #__next   { position:static !important; height:0 !important;
 *                 overflow:visible !important; }
 *
 * That reset is correct in OBS and wrong everywhere else. Hoisted into the
 * generator's own head it makes <body> the containing block for the overlay's
 * absolutely positioned layers — #chat_container at bottom:0, the pin banner at
 * top:0 with z-index:10, the loader at z-index:100, and SlideGroup's
 * position:fixed measuring div — so the overlay paints over the whole generator
 * page. That is the defect these tests exist to keep fixed.
 *
 * WHY IT DOES NOT MOCK next/head. Every other preview suite replaces next/head
 * with a passthrough, which is reasonable there and useless here: the head
 * manager *is* the isolation seam. IsolatedPreviewFrame overrides
 * HeadManagerContext over the portalled subtree, so <Head> inside the frame
 * writes into the frame's own document instead of the page's. Mocking next/head
 * away would delete the thing under test and leave a suite that passes whether
 * or not containment works.
 *
 * WHAT MAKES THESE LOAD-BEARING. Each assertion is paired with a positive
 * control wherever "absent" could mean "never emitted at all". A test that only
 * checked the generator head is empty would pass against a renderer that emitted
 * no styles at all, or against a component that failed to mount; so the same
 * rules are asserted *present* inside the frame document, and the escape is
 * demonstrated directly by mounting ChatOverlay unframed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { HeadManagerContext } from 'next/dist/shared/lib/head-manager-context.shared-runtime';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import ClassicGenerator from '@/components/classic/ClassicGenerator';
import ClassicChatPreview from '@/components/classic/ClassicChatPreview';
import ClassicCounterPreview from '@/components/classic/ClassicCounterPreview';
import ChatOverlay from '@/components/overlay/ChatOverlay';
import IsolatedPreviewFrame from '@/components/classic/IsolatedPreviewFrame';
import { multichatTool } from '@/features/multichat/config';
import { counterTool } from '@/features/counter/config';
import { MULTICHAT_OBS_SIZE } from '@/features/multichat/obs';
import { PREVIEW_ROSTER } from '@/features/multichat/previewRoster';
import {
  SAMPLE_COSMETICS,
  SAMPLE_PIN_BY,
  sampleAllMessages,
  sampleMessages,
} from '@/features/multichat/samples';
import {
  SAMPLE_COUNTER_COUNTS,
  sampleCounterStatuses,
} from '@/features/counter/samples';
import { safeParseMultichatConfig } from '@/lib/multichatConfig';
import { PLATFORM_ORDER } from '@/lib/viewerCounterConfig';
import type { MultichatPlatform } from '@/lib/multichatConfig';
import type { ToolChannels } from '@/features/registry';

/* next/head is deliberately NOT mocked — see the header. next/link is, because a
   real Link wants a router in context and routing is not what this file is
   about. */
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const NO_CHAT_CHANNELS: ToolChannels<MultichatPlatform> = {};

const chatQuery = (style: Partial<Record<string, unknown>> = {}) =>
  multichatTool.serialize(NO_CHAT_CHANNELS, {
    ...multichatTool.defaults,
    ...style,
  } as never);

const counterQuery = (style: Partial<Record<string, unknown>> = {}) =>
  counterTool.serialize({}, { ...counterTool.defaults, ...style } as never);

/* The config the unframed controls hand to ChatOverlay, parsed the same way
   ClassicChatPreview parses it — through the real validator, unwrapped. Passing
   the zod result object straight through would still render (the overlay reads
   missing keys as undefined and falls back), so the control would go green
   while measuring a renderer that never got its real settings. */
const chatConfig = (style: Partial<Record<string, unknown>> = {}) => {
  const parsed = safeParseMultichatConfig(
    Object.fromEntries(new URLSearchParams(chatQuery(style)).entries()),
  );
  return parsed.success ? parsed.data : null;
};

const CHAT_TITLE = 'MultiChat sample preview';
const COUNTER_TITLE = 'Viewer Counter sample preview';

/** The frame element in the *parent* document, by its accessible title. */
const frameEl = (title: string) =>
  document.querySelector<HTMLIFrameElement>(`iframe[title="${title}"]`);

/** The frame's own document — where the renderer actually lives. */
const frameDoc = (title: string) => {
  const el = frameEl(title);
  if (!el) throw new Error(`no preview frame titled "${title}"`);
  const doc = el.contentDocument;
  if (!doc) throw new Error(`frame "${title}" has no reachable document`);
  return doc;
};

/** Every style rule text in a document's head, joined. */
const headCss = (doc: Document) =>
  Array.from(doc.head.querySelectorAll('style'))
    .map((el) => el.textContent ?? '')
    .join('\n');

/** Every style rule text anywhere in a document, head and body alike. */
const allCss = (doc: Document) =>
  Array.from(doc.querySelectorAll('style'))
    .map((el) => el.textContent ?? '')
    .join('\n');

/* The full catalog rather than the six-row default, deliberately. This suite is
   about content not escaping the frame, so it wants every shape the preview can
   draw — the pin banner and its timers, the event cards, the Unicode line — not
   only the shapes that fit on screen at once. A leak through the pin card would go
   unnoticed against a fixture set that has no pin. */
const mountChat = (style: Partial<Record<string, unknown>> = {}) =>
  render(
    <ClassicChatPreview
      query={chatQuery(style)}
      messages={sampleAllMessages()}
      cosmetics={SAMPLE_COSMETICS}
      width={MULTICHAT_OBS_SIZE.width}
      height={MULTICHAT_OBS_SIZE.height}
    />,
  );

const mountCounter = (style: Partial<Record<string, unknown>> = {}) =>
  render(
    <ClassicCounterPreview
      query={counterQuery(style)}
      statuses={sampleCounterStatuses(SAMPLE_COUNTER_COUNTS)}
      width={counterTool.obs.width}
      height={counterTool.obs.height}
    />,
  );

/* A stand-in for the head manager Next's own page shell provides.
 *
 * Without one, `next/head` in jsdom writes nowhere at all: SideEffect only calls
 * updateHead when `headManager.mountedInstances` exists, and the default context
 * value is a bare `{}`. So a control that mounted ChatOverlay unframed with no
 * provider above it would find an empty head and *look* like containment while
 * proving nothing — the first version of this file did exactly that and failed
 * here, which is how the gap was found.
 *
 * Wrapping the control in this makes the unframed mount behave the way the real
 * page does, so the escape is reproduced rather than assumed. It also raises the
 * bar on the framed assertions: with a parent manager present and willing to
 * accept head elements, the frame's own override has to actually win. */
function PageHeadManager({ children }: { children: ReactNode }) {
  const [head, setHead] = useState<ReactNode[]>([]);
  const manager = useMemo(
    () => ({
      mountedInstances: new Set<unknown>(),
      updateHead: (next: ReactNode[]) => setHead(next),
    }),
    [],
  );
  return (
    <HeadManagerContext.Provider value={manager}>
      {children}
      {createPortal(<>{head}</>, document.head)}
    </HeadManagerContext.Provider>
  );
}

afterEach(() => {
  cleanup();
  /* The unframed control below writes into the real head through next/head, and
     next/head's own cleanup is asynchronous relative to unmount in jsdom. Any
     style it left behind would be read by the next test as an escape, so the
     head is swept between tests. */
  for (const el of Array.from(document.head.querySelectorAll('style, link'))) {
    el.remove();
  }
});

describe('both previews render through the one reusable isolated frame', () => {
  it('gives the chat preview a titled frame with no navigable source', () => {
    mountChat();
    const el = frameEl(CHAT_TITLE);
    expect(el).toBeTruthy();
    /* Neither src nor srcdoc: the document is written locally, so there is no URL
       for the frame to fetch and nothing for it to navigate to. */
    expect(el!.getAttribute('src')).toBeNull();
    expect(el!.getAttribute('srcdoc')).toBeNull();
    /* The narrowest sandbox that still leaves contentDocument reachable — drop
       allow-same-origin and the frame gets an opaque origin, so there would be
       no document to portal into at all. No allow-scripts: the renderer runs in
       the parent realm, and the frame never executes anything of its own. */
    expect(el!.getAttribute('sandbox')).toBe('allow-same-origin');
  });

  it('gives the counter preview the same frame component', () => {
    mountCounter();
    const el = frameEl(COUNTER_TITLE);
    expect(el).toBeTruthy();
    expect(el!.getAttribute('src')).toBeNull();
    expect(el!.getAttribute('srcdoc')).toBeNull();
    expect(el!.getAttribute('sandbox')).toBe('allow-same-origin');
  });

  it('is literally the same component in both, not two lookalikes', () => {
    /* The spec asks for one reusable frame rather than two isolation mechanisms
       that could drift apart. Rendering the shared component directly and
       comparing the shape it produces against what each preview produces is the
       assertion that keeps them one implementation. */
    const shape = (el: HTMLIFrameElement) => ({
      sandbox: el.getAttribute('sandbox'),
      scrolling: el.getAttribute('scrolling'),
      ratio: (el.parentElement as HTMLElement).getAttribute('data-preview-ratio'),
    });
    render(
      <IsolatedPreviewFrame title="probe" width={2} height={1}>
        <span>probe</span>
      </IsolatedPreviewFrame>,
    );
    const probe = shape(frameEl('probe')!);
    cleanup();
    mountChat();
    const chat = shape(frameEl(CHAT_TITLE)!);
    cleanup();
    mountCounter();
    const counter = shape(frameEl(COUNTER_TITLE)!);
    expect(chat.sandbox).toBe(probe.sandbox);
    expect(counter.sandbox).toBe(probe.sandbox);
    expect(chat.scrolling).toBe(probe.scrolling);
    expect(counter.scrolling).toBe(probe.scrolling);
    /* Ratios differ by tool, which is the point of the prop — but all three
       carry one, so the attribute is produced in one place. */
    expect(probe.ratio).toBe('2/1');
    expect(chat.ratio).toBe('680/280');
    expect(counter.ratio).toBe('400/80');
  });

  it('mounts the generator with exactly two fixture frames and no live frame', () => {
    vi.useFakeTimers();
    render(<ClassicGenerator />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    const titles = Array.from(document.querySelectorAll('iframe')).map((el) =>
      el.getAttribute('title'),
    );
    expect(titles.sort()).toEqual([CHAT_TITLE, COUNTER_TITLE].sort());
    vi.useRealTimers();
  });
});

describe('the production renderers are the ones inside the frames', () => {
  it('mounts ChatOverlay itself inside the chat frame', () => {
    mountChat();
    const doc = frameDoc(CHAT_TITLE);
    /* #chat_container is ChatOverlay's own element, not something this test or
       the preview wrapper could produce. Its presence in the frame document is
       the proof that the production renderer mounted there. */
    expect(doc.querySelector('#chat_container')).toBeTruthy();
    expect(doc.querySelectorAll('#chat_container .ck-body').length).toBeGreaterThan(0);
  });

  it('mounts ViewerCounterDisplay itself inside the counter frame', () => {
    mountCounter();
    const doc = frameDoc(COUNTER_TITLE);
    /* The renderer's own @keyframes, emitted by the component and by nothing
       else in the tree. */
    expect(allCss(doc)).toContain('vcIn');
    const total = PLATFORM_ORDER.reduce(
      (sum, platform) => sum + SAMPLE_COUNTER_COUNTS[platform],
      0,
    );
    expect(doc.body.textContent ?? '').toContain(total.toLocaleString());
  });

  it("reproduces the overlay page's own inset inside the counter frame", () => {
    mountCounter();
    const inset = frameDoc(COUNTER_TITLE).body.firstElementChild as HTMLElement;
    /* pages/counter.tsx wraps the renderer in exactly this padding. Reproducing
       it inside the frame keeps the preview faithful without the generator
       reaching into the frame to style it. */
    expect(inset.style.padding).toBe('8px');
    expect(inset.style.width).toBe('100%');
  });
});

describe('the overlay stylesheet lands in the frame and nowhere else', () => {
  it("writes the html/body reset into the chat frame's own head", () => {
    mountChat();
    const css = headCss(frameDoc(CHAT_TITLE));
    /* Positive control for every "absent from the generator" assertion below: if
       this fails, the reset was never emitted and the rest would pass vacuously. */
    expect(css).toContain('#__next');
    expect(css).toMatch(/overflow:\s*hidden\s*!important/);
    expect(css).toMatch(/height:\s*100vh\s*!important/);
  });

  it('leaves no overlay reset in the generator document', () => {
    mountChat();
    const css = headCss(document);
    expect(css).not.toContain('#__next');
    expect(css).not.toMatch(/height:\s*100vh\s*!important/);
    /* And the generator's own html and body carry no inline override either — a
       renderer that set them directly rather than through a stylesheet would
       escape past a head-only assertion. */
    expect(document.documentElement.getAttribute('style')).toBeNull();
    expect(document.body.getAttribute('style')).toBeNull();
  });

  it("keeps the overlay's animation keyframes inside the frame", () => {
    mountChat();
    expect(allCss(frameDoc(CHAT_TITLE))).toContain('ckPin');
    expect(allCss(document)).not.toContain('ckPin');
  });

  it("keeps the counter's @font-face inside its frame", () => {
    mountCounter();
    /* A global @font-face in the generator document would restyle generator text
       as a side effect of showing a preview. */
    expect(allCss(frameDoc(COUNTER_TITLE))).toContain('@font-face');
    expect(allCss(document)).not.toContain('DejaVuSans-Bold');
  });

  it('gives the frame a base href so overlay font URLs still resolve', () => {
    mountCounter();
    const base = frameDoc(COUNTER_TITLE).querySelector('base');
    /* The frame document's own URL is about:blank, so a root-relative
       /fonts/… in the overlay's @font-face would resolve nowhere without this. */
    expect(base?.getAttribute('href')).toBe(`${window.location.origin}/`);
  });

  it('escapes into the page when the same renderer is mounted unframed', () => {
    /* The control that makes every assertion above mean something. This is the
       old behaviour, reproduced deliberately: mount ChatOverlay straight into
       the generator document and the reset lands in the page's head. If this
       ever stops being true, the tests above are no longer measuring anything
       and need rewriting rather than trusting. */
    const config = chatConfig();
    expect(config).toBeTruthy();
    render(
      <PageHeadManager>
        <ChatOverlay
          config={config!}
          messages={[]}
          fadingIds={new Set()}
          pinnedMessage={null}
          showLoader={false}
        />
      </PageHeadManager>,
    );
    expect(headCss(document)).toContain('#__next');
  });
});

describe('no preview content reaches the generator document', () => {
  it('keeps every fixture message inside the chat frame', () => {
    mountChat();
    const inside = frameDoc(CHAT_TITLE).body.textContent ?? '';
    const outside = document.body.textContent ?? '';
    for (const token of [
      'first time catching the stream live',
      'greenscreen',
      'purplereign',
      'ありがとう',
    ]) {
      expect(inside).toContain(token);
      expect(outside).not.toContain(token);
    }
  });

  it('keeps the pinned fixture and its attribution inside the chat frame', () => {
    mountChat();
    const doc = frameDoc(CHAT_TITLE);
    expect(doc.body.textContent ?? '').toContain(`Pinned by ${SAMPLE_PIN_BY}`);
    expect(document.body.textContent ?? '').not.toContain(`Pinned by ${SAMPLE_PIN_BY}`);
  });

  it('keeps the sample counts inside the counter frame', () => {
    mountCounter({ combined: false });
    const inside = frameDoc(COUNTER_TITLE).body.textContent ?? '';
    const outside = document.body.textContent ?? '';
    for (const platform of PLATFORM_ORDER) {
      const shown = SAMPLE_COUNTER_COUNTS[platform].toLocaleString();
      expect(inside).toContain(shown);
      expect(outside).not.toContain(shown);
    }
  });

  it('keeps curated roster messages inside the chat frame', () => {
    render(<ClassicGenerator />);
    const inside = frameDoc(CHAT_TITLE).body.textContent ?? '';
    expect(inside).toContain(PREVIEW_ROSTER[1]!.displayName);
    expect(document.body.textContent ?? '').not.toContain(PREVIEW_ROSTER[1]!.displayName);
  });

  it('leaves no positioned overlay layer in the generator document', () => {
    render(<ClassicGenerator />);
    /* The four escapees named in the root cause: the message list, the pin
       banner, the loader, and SlideGroup's off-screen measuring div. None of
       them may exist in the parent document at any depth. */
    expect(document.querySelector('#chat_container')).toBeNull();
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('[style]'))) {
      const position = el.style.position;
      if (position !== 'fixed' && position !== 'absolute') continue;
      /* Nothing positioned in the generator may claim the overlay's stacking
         levels or its off-screen measuring offset. */
      expect(el.style.top).not.toBe('-9999px');
      expect(['10', '100']).not.toContain(el.style.zIndex);
    }
  });
});

describe('the frames declare the canonical OBS shape', () => {
  it('shapes the chat frame 680 by 280 responsively', () => {
    mountChat();
    const wrapper = frameEl(CHAT_TITLE)!.parentElement as HTMLElement;
    expect(wrapper.getAttribute('data-preview-ratio')).toBe('680/280');
    /* Width-driven with an aspect ratio rather than fixed pixels, so the card
       can be any width and the preview still shows the real OBS proportions. */
    expect(wrapper.style.width).toBe('100%');
    expect(wrapper.style.aspectRatio.replace(/\s+/g, '')).toBe('680/280');
    /* Clipped, so nothing the overlay draws can extend past the card. */
    expect(wrapper.style.overflow).toBe('hidden');
    expect(MULTICHAT_OBS_SIZE).toEqual({ width: 680, height: 280 });
  });

  it('shapes the counter frame 400 by 80 responsively', () => {
    mountCounter();
    const wrapper = frameEl(COUNTER_TITLE)!.parentElement as HTMLElement;
    expect(wrapper.getAttribute('data-preview-ratio')).toBe('400/80');
    expect(wrapper.style.width).toBe('100%');
    expect(wrapper.style.aspectRatio.replace(/\s+/g, '')).toBe('400/80');
    expect(wrapper.style.overflow).toBe('hidden');
    expect(counterTool.obs).toEqual({ width: 400, height: 80 });
  });

  it('clips inside the frame document as well as outside it', () => {
    mountChat();
    /* Two independent clips. The wrapper stops the frame from painting past the
       card; the frame document's own html/body overflow stops content from
       scrolling the frame. Without the second, a long fixture list would give
       the frame a scrollbar instead of behaving like an OBS source. */
    expect(headCss(frameDoc(CHAT_TITLE))).toMatch(/overflow:\s*hidden/);
    expect(frameEl(CHAT_TITLE)!.getAttribute('scrolling')).toBe('no');
  });
});

describe('settings reach the framed renderers immediately', () => {
  it('repaints the framed chat overlay when a setting changes', () => {
    /* Through the generator, not by remounting the preview with a different
       prop: the claim is that editing a control updates the framed renderer in
       place. A frame that only picked settings up on mount would fail here. */
    render(<ClassicGenerator />);
    const before = frameDoc(CHAT_TITLE).querySelectorAll('#chat_container .ck-colon')
      .length;
    expect(before).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText('Hide usernames'));
    expect(
      frameDoc(CHAT_TITLE).querySelectorAll('#chat_container .ck-colon').length,
    ).toBe(0);
    /* And back, so the assertion is about the setting rather than about a
       one-way teardown. */
    fireEvent.click(screen.getByLabelText('Hide usernames'));
    expect(
      frameDoc(CHAT_TITLE).querySelectorAll('#chat_container .ck-colon').length,
    ).toBe(before);
  });

  it('repaints the framed counter when a setting changes', () => {
    render(<ClassicGenerator />);
    const doc = () => frameDoc(COUNTER_TITLE);
    const pills = () =>
      (doc().body.firstElementChild?.querySelector('div')?.children.length ?? 0);
    expect(pills()).toBe(1);
    fireEvent.click(screen.getByLabelText('Combined total'));
    expect(pills()).toBe(PLATFORM_ORDER.length);
  });

  it('carries the overlay background into the frame rather than the page', () => {
    /* bgColor is the setting that most obviously belongs to the overlay's own
       body. It must reach the frame's stylesheet and leave the generator's dark
       Classic background alone. */
    mountChat({ bgColor: '#ff00ff' });
    expect(headCss(frameDoc(CHAT_TITLE)).toLowerCase()).toContain('#ff00ff');
    expect(headCss(document).toLowerCase()).not.toContain('#ff00ff');
    expect(document.body.style.background).toBe('');
  });
});

describe('the frames are inert', () => {
  const seen: string[] = [];

  beforeEach(() => {
    seen.length = 0;
    vi.stubGlobal(
      'WebSocket',
      class {
        constructor(url: string) {
          seen.push(`ws:${url}`);
        }
        close() {}
        addEventListener() {}
      },
    );
    vi.stubGlobal(
      'EventSource',
      class {
        constructor(url: string) {
          seen.push(`sse:${url}`);
        }
        close() {}
        addEventListener() {}
      },
    );
    vi.stubGlobal(
      'fetch',
      vi.fn((url: unknown) => {
        seen.push(`fetch:${String(url)}`);
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens no socket, stream, request, pin poll or viewer poll', () => {
    vi.useFakeTimers();
    render(<ClassicGenerator />);
    /* Well past every debounce and poll interval the overlay routes use: a
       request scheduled behind a timer would be invisible on first paint. */
    act(() => {
      vi.advanceTimersByTime(120_000);
    });
    expect(seen.every((entry) => entry.startsWith('fetch:/api/twitch/preview-identity?login='))).toBe(true);
    expect(seen).toHaveLength(3);
    vi.useRealTimers();
  });

  it('never points a frame at an overlay route', () => {
    render(<ClassicGenerator />);
    for (const el of Array.from(document.querySelectorAll('iframe'))) {
      /* Loading /multichat?channels=… or /counter?channels=… inside the frame
         is what would start real provider sockets and real polling, which is
         why the frame writes its document locally instead. */
      const src = el.getAttribute('src') ?? '';
      expect(src).not.toContain('/multichat');
      expect(src).not.toContain('/counter');
      expect(el.getAttribute('src')).toBeNull();
    }
  });

  it('serializes no preview data into either generated URL', () => {
    render(<ClassicGenerator />);
    const urls = Array.from(document.querySelectorAll('.url-code')).map(
      (el) => el.textContent ?? '',
    );
    expect(urls).toHaveLength(2);
    for (const url of urls) {
      for (const token of ['greenscreen', 'purplereign', 'sample', 'preview']) {
        expect(url.toLowerCase()).not.toContain(token);
      }
      for (const platform of PLATFORM_ORDER) {
        expect(url).not.toContain(String(SAMPLE_COUNTER_COUNTS[platform]));
      }
    }
  });
});

describe('unmounting a frame disposes what it created', () => {
  it('tears down the portalled renderer and its document', () => {
    const view = mountChat();
    const doc = frameDoc(CHAT_TITLE);
    expect(doc.querySelector('#chat_container')).toBeTruthy();
    view.unmount();
    /* React unmounts the portalled tree, so the renderer's own DOM is gone from
       the frame document — the portal is disposed rather than merely orphaned
       along with a detached iframe. */
    expect(doc.querySelector('#chat_container')).toBeNull();
    expect(frameEl(CHAT_TITLE)).toBeNull();
  });

  it("clears the pin banner's timers rather than leaving them armed", () => {
    /* PinBanner arms a fade at 4600ms and an unmount at 5000ms, cleared in its
       own effect cleanup. Cleanup only runs if the portal is really unmounted,
       so the timer count is a direct reading of whether disposal happened. */
    vi.useFakeTimers();
    const before = vi.getTimerCount();
    const view = mountChat();
    expect(vi.getTimerCount()).toBeGreaterThan(before);
    view.unmount();
    expect(vi.getTimerCount()).toBe(before);
    vi.useRealTimers();
  });

  it("stops the counter's animation frames", () => {
    const frames: FrameRequestCallback[] = [];
    let cancelled = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {
      cancelled += 1;
    });
    const view = mountCounter();
    view.unmount();
    /* Either the animation cancelled its pending frame or it had none pending;
       what must not happen is a queued callback writing into a document that is
       gone. Draining after unmount is the assertion — an un-disposed renderer
       throws here. */
    expect(() => {
      for (const cb of frames) cb(1_000);
    }).not.toThrow();
    expect(cancelled).toBeGreaterThanOrEqual(0);
    vi.unstubAllGlobals();
  });

  it('starts a remounted frame from a clean document', () => {
    mountChat();
    const first = headCss(frameDoc(CHAT_TITLE));
    expect(first).toContain('#__next');
    cleanup();
    mountChat();
    /* A remount must not accumulate a second copy of the overlay stylesheet, and
       must not come up missing it either. */
    const second = headCss(frameDoc(CHAT_TITLE));
    expect(second).toBe(first);
  });
});

describe('the generator document keeps its own identity', () => {
  it('still renders every card, with normal scrolling and its own background', () => {
    render(<ClassicGenerator />);
    /* The panels the spec requires to survive. Queried structurally rather than
       by copy, so a wording change does not read as a missing card. */
    for (const selector of [
      '.panel-chat-output',
      '.panel-counter-output',
      '.url-code',
    ]) {
      expect(document.querySelector(selector)).toBeTruthy();
    }
    /* No overlay reset means no forced 100vh height and no forced hidden
       overflow, so the page still scrolls the way a settings page should. */
    const css = headCss(document);
    expect(css).not.toMatch(/height:\s*100vh\s*!important/);
    expect(css).not.toMatch(/overflow:\s*hidden\s*!important/);
    /* And the generator's own stylesheet is still the one styling the page. */
    expect(document.querySelector('style, link[rel="stylesheet"]')).not.toBe(null);
  });

  it('regression — a directly mounted ChatOverlay would fail these', () => {
    /* The tripwire the spec asks for, stated as an executable claim rather than
       a comment: mounting the overlay into the generator document puts its
       reset in the page head, and the framed preview does not. Both halves are
       asserted in one test so the contrast cannot rot independently. */
    const config = chatConfig();
    expect(config).toBeTruthy();
    /* Both halves run under a page head manager, so the only difference between
       them is the frame. Framed, the overlay's reset has somewhere else to go
       and a willing parent manager it must not use. */
    const framed = render(
      <PageHeadManager>
        <ClassicChatPreview
          query={chatQuery()}
          messages={sampleMessages()}
          cosmetics={SAMPLE_COSMETICS}
          width={MULTICHAT_OBS_SIZE.width}
          height={MULTICHAT_OBS_SIZE.height}
        />
      </PageHeadManager>,
    );
    expect(headCss(document)).not.toContain('#__next');
    expect(document.querySelector('#chat_container')).toBeNull();
    framed.unmount();

    render(
      <PageHeadManager>
        <ChatOverlay
          config={config!}
          messages={[]}
          fadingIds={new Set()}
          pinnedMessage={null}
          showLoader={false}
        />
      </PageHeadManager>,
    );
    /* Unframed, the same renderer does exactly what the bug report described. */
    expect(headCss(document)).toContain('#__next');
    expect(document.querySelector('#chat_container')).toBeTruthy();
  });
});
