/* The generator's built-in chat preview.
 *
 * What these assert, and why each one is here rather than being obvious:
 *
 *   - the preview is populated on first paint, with no channel, no click, and no
 *     timer advanced. A preview that only fills in after an effect settles would
 *     pass a laxer test and still show an empty card to a visitor;
 *   - nothing connects. No WebSocket, no EventSource, no fetch, and no iframe that
 *     navigates anywhere. The fixtures exist so the generator can render without a
 *     channel, and the moment it opens a socket that claim stops being true. The
 *     preview does mount an iframe — that is what contains the overlay's styles —
 *     but it holds a locally written document and has no src;
 *   - the settings reach the screen. Four of them are applied while a message is
 *     converted rather than while it is drawn, so they are the ones a hand-built
 *     fixture list would silently ignore — each is asserted by toggling it and
 *     watching the DOM change;
 *   - nothing fixture-shaped reaches the generated URL.
 *
 * The renderer is not re-implemented here and its output is not restated. These
 * assert the elements the production overlay emits — .ck-body, .ck-badge-img,
 * .ck-emote — because that is the seam that would actually break.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import ClassicGenerator from '@/components/classic/ClassicGenerator';
import ClassicChatPreview from '@/components/classic/ClassicChatPreview';
import { PREVIEW_DEBOUNCE_MS } from '@/components/workspace/OverlayPreviewFrame';
import { multichatTool } from '@/lib/tools/multichat/config';
import { MULTICHAT_OBS_SIZE } from '@/lib/tools/multichat/obs';
import {
  SAMPLE_COSMETICS,
  SAMPLE_EPOCH,
  SAMPLE_GROUPS,
  SAMPLE_MESSAGES,
  SAMPLE_PIN_BY,
  SAMPLE_PIN_ID,
  sampleMessages,
  samplePlatforms,
} from '@/lib/tools/multichat/samples';
import type { ToolChannels } from '@/lib/tools/registry';
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

/** The query string the generator would produce for a style, via the real serializer. */
const queryFor = (style: Partial<Record<string, unknown>> = {}) =>
  multichatTool.serialize(NO_CHANNELS, { ...multichatTool.defaults, ...style } as never);

/** Mount the preview alone, at default settings unless overridden. */
const mountPreview = (style: Partial<Record<string, unknown>> = {}) =>
  render(
    <ClassicChatPreview
      query={queryFor(style)}
      messages={sampleMessages()}
      cosmetics={SAMPLE_COSMETICS}
      width={MULTICHAT_OBS_SIZE.width}
      height={MULTICHAT_OBS_SIZE.height}
    />,
  );

/** The isolation frame, in the generator document. */
const frame = () =>
  document.querySelector<HTMLIFrameElement>('iframe[title="MultiChat sample preview"]')!;

/* Every query below starts here rather than at `screen`, because the renderer is
   portalled into the frame's own document and a portal moves DOM without moving
   it into the parent document's tree. That is the containment this whole suite
   now rests on, so the scoping is the point rather than an inconvenience: if the
   overlay were ever mounted into the generator document again, these queries
   would find nothing. */
const previewDoc = () => frame().contentDocument!;
const preview = () => previewDoc().body;
/* Scoped to #chat_container deliberately: the pin card renders through the same
   MsgLine and so emits its own .ck-body outside the list. An unscoped query would
   count the pin twice over and make the list length assertions meaningless. */
const bodies = () =>
  Array.from(preview().querySelectorAll('#chat_container .ck-body')).map(
    (el) => el.textContent ?? '',
  );
const previewText = () => preview().textContent ?? '';

afterEach(cleanup);

describe('the built-in chat preview is populated immediately', () => {
  it('renders sample messages on first paint, with no channel and no click', () => {
    /* No fake timers, nothing advanced, nothing typed: this is what a visitor
       sees the instant the page paints. */
    mountPreview();
    expect(bodies().length).toBeGreaterThan(0);
  });

  it('renders every fixture that is not held out as the pin', () => {
    mountPreview();
    /* The pinned fixture is rendered in the pin card rather than the list, so the
       list is one shorter than the fixture set — and the pin is still on screen. */
    expect(bodies()).toHaveLength(SAMPLE_MESSAGES.length - 1);
    expect(previewText()).toContain('read the pinned message before asking');
  });

  it('covers all four platforms', () => {
    /* A preview showing only Kick would demonstrate nothing about the source-tag
       setting, which is the setting most likely to be misconfigured. */
    expect(samplePlatforms().sort()).toEqual(['kick', 'tiktok', 'twitch', 'youtube']);
    mountPreview();
    const text = previewText();
    expect(text).toContain('greenscreen'); // kick
    expect(text).toContain('purplereign'); // twitch
    expect(text).toContain('RedButtonRadio'); // youtube
    expect(text).toContain('tiktokmod'); // tiktok
  });

  it('demonstrates every capability group exactly once per fixture', () => {
    /* Guards the fixture set itself: a sample deleted in a refactor stops being
       demonstrated, and nothing else would notice. */
    const groups = new Set(SAMPLE_MESSAGES.map((s) => s.group));
    for (const group of SAMPLE_GROUPS) expect(groups.has(group)).toBe(true);
  });

  it('is deterministic — identical markup across two independent mounts', () => {
    /* The frame document's body, not the group's innerHTML: the group holds only
       the iframe element now, so comparing its markup would compare two empty
       shells and pass however the renderer behaved. */
    mountPreview();
    const firstHtml = preview().innerHTML;
    expect(firstHtml).toContain('ck-body');
    cleanup();
    mountPreview();
    expect(preview().innerHTML).toBe(firstHtml);
  });

  it('uses fixed fixture timestamps rather than the wall clock', () => {
    /* Date.now() in a fixture would make the preview unreproducible and would
       make any snapshot of it flaky. Timestamps are offsets from a constant. */
    const now = vi.spyOn(Date, 'now');
    mountPreview();
    expect(now).not.toHaveBeenCalled();
    for (const { message } of SAMPLE_MESSAGES) {
      expect(message.timestamp).toBeGreaterThanOrEqual(SAMPLE_EPOCH);
    }
    now.mockRestore();
  });

  it('labels the samples as preview data, visibly and to a screen reader', () => {
    render(<ClassicGenerator />);
    /* Visible marker, so nobody mistakes invented chat for a real stream.
       Scoped to the chat panel: the counter panel carries its own badge with the
       same words, so an unscoped query here matches two elements. */
    const chatPanel = document.querySelector('.panel-chat-output') as HTMLElement;
    expect(within(chatPanel).getByText('Preview data')).toBeTruthy();
    /* And the same thing said to assistive tech, on the group itself. */
    expect(
      screen.getByRole('group', { name: /sample chat messages, not a live stream/i }),
    ).toBeTruthy();
  });
});

describe('the preview contains the messages a generator needs to judge styling', () => {
  it('includes a multiline message long enough to wrap', () => {
    mountPreview();
    const longest = Math.max(...bodies().map((t) => t.length));
    expect(longest).toBeGreaterThan(150);
  });

  it('includes a mention, coloured because the mentioned chatter spoke first', () => {
    mountPreview();
    /* renderMentions only colours an @token whose author is already in the mention
       map, so this is simultaneously an assertion that the fixtures are converted
       in display order through one shared context. */
    const strong = preview().querySelector('.ck-body strong');
    expect(strong?.textContent).toBe('@greenscreen');
    expect((strong as HTMLElement).style.color).not.toBe('');
  });

  it('includes a Unicode message, preserved exactly', () => {
    mountPreview();
    const text = previewText();
    expect(text).toContain('ありがとう');
    expect(text).toContain('спасибо');
    expect(text).toContain('شكرا');
    expect(text).toContain('🐉');
    expect(text).toContain('ユキ_yuki');
  });

  it('renders a native emote after astral characters at the right offset', () => {
    /* The emote sits after a surrogate pair and a combining accent. Codepoint
       indexing puts it in the right place; UTF-16 indexing tears the text. */
    mountPreview();
    const emotes = Array.from(preview().querySelectorAll('img.ck-emote'));
    const kappa = emotes.find((img) => img.getAttribute('alt') === 'Kappa');
    expect(kappa).toBeTruthy();
    /* Nothing was consumed from the sentence around it. */
    expect(previewText()).toContain('¡qué buena racha!');
  });

  it('renders badges through the production lookup tables', () => {
    mountPreview();
    const badges = Array.from(preview().querySelectorAll('img.ck-badge-img'));
    expect(badges.length).toBeGreaterThan(0);
    /* Real Twitch badge art, from the UUID table — not a URL written in a fixture. */
    expect(
      badges.some((b) => b.getAttribute('src')?.includes('static-cdn.jtvnw.net/badges')),
    ).toBe(true);
    /* TikTok's non-square badge art gets the width-relaxing class. */
    expect(badges.some((b) => b.className.includes('ck-badge-wide'))).toBe(true);
  });

  it('renders the YouTube owner as a gold name pill rather than a badge', () => {
    mountPreview();
    const owner = within(preview()).getByText('StreamOwner');
    expect(owner.style.background).toContain('255, 214, 0'); // #ffd600
  });

  it('renders event cards with their real category icons', () => {
    mountPreview();
    const text = previewText();
    expect(text).toContain('💰'); // cheer — what a YouTube super chat really emits
    expect(text).toContain('🎁'); // gift
  });

  it('renders the pin card with its attribution', () => {
    mountPreview();
    expect(previewText()).toContain(`Pinned by ${SAMPLE_PIN_BY}`);
  });
});

describe('the preview opens no connections', () => {
  const seen: string[] = [];

  beforeEach(() => {
    seen.length = 0;
    /* Every outbound mechanism the overlay has, replaced by a recorder. Not
       asserting on a mock's call count but on the fact that nothing was even
       constructed — a socket opened in an effect would register here. */
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
      vi.fn((url: string) => {
        seen.push(`fetch:${String(url)}`);
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens no socket, stream, or request when the preview alone is mounted', () => {
    mountPreview();
    expect(seen).toEqual([]);
  });

  it('opens nothing when the whole generator is mounted without a channel', async () => {
    vi.useFakeTimers();
    render(<ClassicGenerator />);
    /* Advance well past the preview debounce: a navigating frame or a poller
       would have started by now if one existed. */
    await act(async () => {
      vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS * 4);
    });
    expect(seen).toEqual([]);
    /* And specifically: nothing that would be a pin poll or a viewer poll. */
    expect(seen.filter((s) => s.includes('/api/'))).toEqual([]);
    vi.useRealTimers();
  });

  it('mounts a frame that never navigates to the real overlay route', () => {
    /* The fixture preview does use an iframe now — that is what contains the
       overlay's html/body reset and its positioned layers. What must stay true is
       that the frame never *navigates*: pointing it at /multichat?channels=… is
       what would open real sockets. So the assertion is about src, not about the
       iframe's existence, and it is the src attribute rather than contentWindow
       because an unset src is the only value that cannot load anything. */
    mountPreview();
    const frames = Array.from(document.querySelectorAll('iframe'));
    expect(frames).toHaveLength(1);
    expect(frames[0].getAttribute('src')).toBeNull();
    expect(frames[0].getAttribute('srcdoc')).toBeNull();
    expect(seen).toEqual([]);
  });
});

describe('the four parse-time settings reach the preview', () => {
  /* These are the settings applied while a message is converted rather than while
     it is drawn. A preview built from pre-rendered nodes would ignore all four
     while looking correct, which is why each is asserted by observing a change. */

  it('sevenTVEmotesEnabled swaps third-party emotes in and out', () => {
    mountPreview({ sevenTVEmotesEnabled: true });
    /* Counted before cleanup, because the count lives in the frame's document and
       the frame goes away with the mount. */
    const withEmotes = preview().querySelectorAll('img.ck-emote').length;
    cleanup();
    mountPreview({ sevenTVEmotesEnabled: false });
    const withoutEmotes = preview().querySelectorAll('img.ck-emote').length;
    expect(withEmotes).toBeGreaterThan(withoutEmotes);
    /* The words come back as text rather than vanishing. */
    expect(previewText()).toContain('OMEGALUL');
  });

  it('sevenTVCosmeticsEnabled attaches and detaches the paint', () => {
    mountPreview({ sevenTVCosmeticsEnabled: true });
    const painted = within(preview()).getByText('paintedname');
    expect(painted.style.background).toContain('linear-gradient');
    cleanup();
    mountPreview({ sevenTVCosmeticsEnabled: false });
    const plain = within(preview()).getByText('paintedname');
    expect(plain.style.background).toBe('');
    expect(plain.style.color).not.toBe('');
  });

  it('paintShadows removes the drop-shadows while keeping the gradient', () => {
    mountPreview({ paintShadows: true });
    const withShadow = within(preview()).getByText('paintedname');
    expect(withShadow.style.filter).toContain('drop-shadow');
    cleanup();
    mountPreview({ paintShadows: false });
    const withoutShadow = within(preview()).getByText('paintedname');
    expect(withoutShadow.style.filter).toBe('');
    /* The setting removes shadows, not the paint. */
    expect(withoutShadow.style.background).toContain('linear-gradient');
  });

  it('mentionColor stops colouring @tokens', () => {
    mountPreview({ mentionColor: true });
    expect(preview().querySelector('.ck-body strong')).toBeTruthy();
    cleanup();
    mountPreview({ mentionColor: false });
    expect(preview().querySelector('.ck-body strong')).toBeNull();
    /* The mention is still readable, just not coloured. */
    expect(previewText()).toContain('@greenscreen');
  });
});

describe('render-time settings reach the preview too', () => {
  it('hideNames removes names and keeps message bodies', () => {
    mountPreview({ hideNames: false });
    expect(preview().querySelectorAll('.ck-colon').length).toBeGreaterThan(0);
    expect(within(preview()).getByText('greenscreen')).toBeTruthy();
    cleanup();
    mountPreview({ hideNames: true });
    /* The name span and its colon go together, so the colon count is the honest
       signal. Not asserting the string is absent from the whole preview: the
       mention sample says "@greenscreen" in its body, and hiding names must not
       edit what somebody typed. */
    expect(preview().querySelectorAll('.ck-colon')).toHaveLength(0);
    expect(within(preview()).queryByText('greenscreen')).toBeNull();
    expect(previewText()).toContain('@greenscreen');
    expect(bodies().join(' ')).toContain('first time catching the stream live');
  });

  it('msgCaps uppercases through the overlay stylesheet, not the fixture text', () => {
    /* The fixture text must stay as written: uppercasing is presentational, and a
       fixture that shipped pre-uppercased text would make the setting untestable. */
    mountPreview({ msgCaps: true });
    expect(previewText()).toContain('first time catching the stream live');
  });

  it('sourceTag honours an explicit choice, including its default value', () => {
    /* The serializer omits sourceTag=icon as the default, so a preview relying on
       the round trip alone would fall back to showing no marker at all. */
    mountPreview({ sourceTag: 'label' });
    expect(previewText()).toContain('Kick');
    cleanup();
    mountPreview({ sourceTag: 'none' });
    expect(previewText()).not.toContain('Kick');
  });

  it('showPinEnabled returns the pinned sample to the list rather than dropping it', () => {
    mountPreview({ showPinEnabled: true });
    const pinned = bodies().length;
    expect(previewText()).toContain(`Pinned by ${SAMPLE_PIN_BY}`);
    cleanup();
    mountPreview({ showPinEnabled: false });
    /* One more in the list, none lost, and no pin card. */
    expect(bodies()).toHaveLength(pinned + 1);
    expect(previewText()).not.toContain(`Pinned by ${SAMPLE_PIN_BY}`);
  });

  it('pinPlatforms hides the pin when its own platform is deselected', () => {
    /* Both of the route's gates, not just the on/off toggle: without this the
       setting would appear inert in the preview while working in OBS. */
    const kickPin = SAMPLE_MESSAGES.find((s) => s.message.id === SAMPLE_PIN_ID);
    expect(kickPin?.message.platform).toBe('kick');
    mountPreview({ showPinEnabled: true, pinPlatforms: ['twitch'] });
    expect(previewText()).not.toContain(`Pinned by ${SAMPLE_PIN_BY}`);
  });
});

describe('the filter settings reach the preview', () => {
  /* Applied before ChatOverlay sees a message, so a preview that rendered the
     fixture array directly would show a blacklisted chatter on screen. */

  it('userBL hides a named chatter', () => {
    mountPreview({ userBL: 'greenscreen' });
    expect(previewText()).not.toContain('first time catching the stream live');
    /* Everyone else is unaffected. */
    expect(previewText()).toContain('purplereign');
  });

  it('botNames hides a chatter named as a bot', () => {
    mountPreview({ botNames: 'emotefiend' });
    expect(previewText()).not.toContain('emotefiend');
  });

  it('prefixBL hides messages starting with a prefix, leaving event cards alone', () => {
    /* An event card's text is composed by the connector, not typed, so a prefix
       blacklist must not silence a subscription. */
    mountPreview({ prefixBL: 'so' });
    expect(previewText()).not.toContain('one browser source for chat');
    expect(previewText()).toContain('Super Chat');
  });
});

describe('the preview cannot leak into the generated URL', () => {
  const settle = () => act(() => void vi.advanceTimersByTime(PREVIEW_DEBOUNCE_MS + 10));

  beforeEach(() => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('puts no fixture content in either URL', () => {
    render(<ClassicGenerator />);
    settle();
    const urls = Array.from(document.querySelectorAll('.url-code')).map(
      (el) => el.textContent ?? '',
    );
    expect(urls).toHaveLength(2);
    for (const url of urls) {
      for (const token of [
        'sample',
        'greenscreen',
        'purplereign',
        'OMEGALUL',
        'preview',
        'fixture',
        String(SAMPLE_EPOCH),
      ]) {
        expect(url.toLowerCase()).not.toContain(token.toLowerCase());
      }
    }
  });

  it('leaves the URL byte-identical to the serializer for the same state', () => {
    /* The preview reads chatQuery; it must never contribute to it. */
    render(<ClassicGenerator />);
    settle();
    const url = document.querySelector('.url-code')?.textContent ?? '';
    expect(url).toBe(
      `http://localhost:3000/multichat?${multichatTool.serialize(
        NO_CHANNELS,
        multichatTool.defaults,
      )}`,
    );
  });

  it('writes no fixture content to the saved draft', () => {
    render(<ClassicGenerator />);
    fireEvent.change(document.getElementById('channel-kick')!, {
      target: { value: 'somechannel' },
    });
    settle();
    const stored = JSON.stringify(window.sessionStorage);
    expect(stored.toLowerCase()).not.toContain('greenscreen');
    expect(stored.toLowerCase()).not.toContain('omegalul');
  });
});
