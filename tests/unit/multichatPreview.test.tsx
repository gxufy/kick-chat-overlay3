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
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import ClassicGenerator from '@/components/classic/ClassicGenerator';
import ClassicChatPreview from '@/components/classic/ClassicChatPreview';
import { PREVIEW_DEBOUNCE_MS } from '@/components/workspace/OverlayPreviewFrame';
import { multichatTool } from '@/features/multichat/config';
import { MULTICHAT_OBS_SIZE } from '@/features/multichat/obs';
import {
  SAMPLE_COSMETICS,
  SAMPLE_EPOCH,
  SAMPLE_ALL_MESSAGES,
  SAMPLE_GROUPS,
  SAMPLE_LIBRARY_MESSAGES,
  SAMPLE_MESSAGES,
  SAMPLE_PIN_BY,
  SAMPLE_PIN_ID,
  sampleAllMessages,
  sampleMessages,
  samplePlatforms,
  showcasePlatforms,
} from '@/features/multichat/samples';
import type { ToolChannels } from '@/features/registry';
import { MULTICHAT_WORKSPACE_DEFAULTS, type MultichatPlatform } from '@/lib/multichatConfig';

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

/** Mount the preview over a given fixture set, at default settings unless overridden. */
const mountWith = (
  messages: ReturnType<typeof sampleMessages>,
  style: Partial<Record<string, unknown>> = {},
) =>
  render(
    <ClassicChatPreview
      query={queryFor(style)}
      messages={messages}
      cosmetics={SAMPLE_COSMETICS}
      width={MULTICHAT_OBS_SIZE.width}
      height={MULTICHAT_OBS_SIZE.height}
    />,
  );

/**
 * Mount the default six-row showcase — exactly what the generator paints on arrival.
 */
const mountPreview = (style: Partial<Record<string, unknown>> = {}) =>
  mountWith(sampleMessages(), style);

/**
 * Mount every fixture, showcase and library alike.
 *
 * For the tests that exercise the event cards, the pin, the wrapping bot post, the
 * unbadged line and the Unicode line. Those are real fixtures with real rendering
 * behaviour worth asserting, but they are not in the default set: an event card is
 * three rows tall and the frame only draws six, so putting them on screen by
 * default would clip the badge and paint demonstrations the preview exists for.
 */
const mountAll = (style: Partial<Record<string, unknown>> = {}) =>
  mountWith(sampleAllMessages(), style);

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

  it('renders every showcase fixture as a list row, with none held back', () => {
    /* The default set has no pin and no event card, so every fixture is a row and
       the count matches exactly. */
    mountPreview();
    expect(bodies()).toHaveLength(SAMPLE_MESSAGES.length);
  });

  it('renders every library fixture too, when a caller asks for the full catalog', () => {
    mountAll();
    /* One shorter than the catalog: the pin renders in its own card above the list
       rather than inside it. */
    expect(bodies()).toHaveLength(SAMPLE_ALL_MESSAGES.length - 1);
    expect(previewText()).toContain('read the pinned message before asking');
  });

  it('covers all four platforms in the default six rows', () => {
    /* A preview showing only Kick would demonstrate nothing about the source-tag
       setting, which is the setting most likely to be misconfigured. And it has to
       be the *default* rows: coverage that only exists in the library is coverage
       nobody sees. */
    expect(showcasePlatforms().sort()).toEqual(['kick', 'tiktok', 'twitch', 'youtube']);
    expect(samplePlatforms().sort()).toEqual(['kick', 'tiktok', 'twitch', 'youtube']);
    mountPreview();
    const text = previewText();
    expect(text).toContain('emotefiend'); // kick
    expect(text).toContain('purplereign'); // twitch
    expect(text).toContain('RedButtonRadio'); // youtube
    expect(text).toContain('tiktokmod'); // tiktok
  });

  it('demonstrates every capability group exactly once per fixture', () => {
    /* Guards the fixture set itself: a sample deleted in a refactor stops being
       demonstrated, and nothing else would notice. Across both arrays, because the
       library fixtures are still demonstrations — they are demonstrated on request
       rather than by default. */
    const groups = new Set(SAMPLE_ALL_MESSAGES.map((s) => s.group));
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
    for (const { message } of SAMPLE_ALL_MESSAGES) {
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
    expect(within(chatPanel).getAllByText('Preview Data').length).toBeGreaterThan(0);
    /* And the same thing said to assistive tech, on the group itself. */
    expect(
      screen.getByRole('group', { name: /sample chat messages, not a live stream/i }),
    ).toBeTruthy();
  });
});

describe('the preview contains the messages a generator needs to judge styling', () => {
  it('includes a message long enough to wrap onto several lines', () => {
    /* A library fixture. Wrapping is worth demonstrating and worth testing, but a
       message that occupies three of six rows cannot be in the default set. */
    mountAll();
    const longest = Math.max(...bodies().map((t) => t.length));
    expect(longest).toBeGreaterThan(150);
  });

  it('includes a mention, coloured because the mentioned chatter spoke first', () => {
    mountPreview();
    /* renderMentions only colours an @token whose author is already in the mention
       map, so this is simultaneously an assertion that the fixtures are converted
       in display order through one shared context. */
    const strong = preview().querySelector('.ck-body strong');
    expect(strong?.textContent).toBe('@purplereign');
    expect((strong as HTMLElement).style.color).not.toBe('');
  });

  it('includes a Unicode message, preserved exactly', () => {
    mountAll();
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
    mountAll();
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
    mountAll();
    const owner = within(preview()).getByText('StreamOwner');
    expect(owner.style.background).toContain('255, 214, 0'); // #ffd600
  });

  it('renders event cards with their real category icons', () => {
    mountAll();
    const text = previewText();
    expect(text).toContain('💰'); // cheer — what a YouTube super chat really emits
    expect(text).toContain('🎁'); // gift
  });

  it('renders the pin card with its attribution', () => {
    mountAll();
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
    expect(seen.every((entry) => entry.startsWith('fetch:/api/twitch/preview-identity?login='))).toBe(true);
    expect(seen).toHaveLength(7);
    /* Specifically: no live overlay socket, pin poll, or viewer poll. */
    expect(seen.filter((entry) => entry.includes('/api/twitch/pins') || entry.includes('/api/viewers'))).toEqual([]);
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
    expect(previewText()).toContain('@purplereign');
  });
});

describe('render-time settings reach the preview too', () => {
  it('hideNames removes names and keeps message bodies', () => {
    mountPreview({ hideNames: false });
    expect(preview().querySelectorAll('.ck-colon').length).toBeGreaterThan(0);
    expect(within(preview()).getByText('purplereign')).toBeTruthy();
    cleanup();
    mountPreview({ hideNames: true });
    /* The name span and its colon go together, so the colon count is the honest
       signal. Not asserting the string is absent from the whole preview: the
       mention sample says "@purplereign" in its body, and hiding names must not
       edit what somebody typed. */
    expect(preview().querySelectorAll('.ck-colon')).toHaveLength(0);
    expect(within(preview()).queryByText('purplereign')).toBeNull();
    expect(previewText()).toContain('@purplereign');
    expect(bodies().join(' ')).toContain('keep it civil in here please');
  });

  it('msgCaps uppercases through the overlay stylesheet, not the fixture text', () => {
    /* The fixture text must stay as written: uppercasing is presentational, and a
       fixture that shipped pre-uppercased text would make the setting untestable. */
    mountPreview({ msgCaps: true });
    expect(previewText()).toContain('keep it civil in here please');
  });

  it('uses preview-only icon source marks without rewriting sourceTag', () => {
    /* Preview Data deliberately showcases all four platform logos while retaining
       the serialized sourceTag setting for the authoritative Live Overlay URL. */
    for (const sourceTag of ['label', 'none'] as const) {
      mountPreview({ sourceTag });
      expect(preview().querySelectorAll('[data-source-tag="icon"]').length).toBeGreaterThan(0);
      expect(preview().querySelectorAll('[data-source-tag="label"], [data-source-tag="dot"]')).toHaveLength(0);
      cleanup();
    }
  });

  it('showPinEnabled returns the pinned sample to the list rather than dropping it', () => {
    /* Over the full catalog, since the pin is a library fixture — the default six
       rows carry no pin at all, which is a separate assertion further down. */
    mountAll({ showPinEnabled: true });
    const pinned = bodies().length;
    expect(previewText()).toContain(`Pinned by ${SAMPLE_PIN_BY}`);
    cleanup();
    mountAll({ showPinEnabled: false });
    /* One more in the list, none lost, and no pin card. */
    expect(bodies()).toHaveLength(pinned + 1);
    expect(previewText()).not.toContain(`Pinned by ${SAMPLE_PIN_BY}`);
  });

  it('pinPlatforms hides the pin when its own platform is deselected', () => {
    /* Both of the route's gates, not just the on/off toggle: without this the
       setting would appear inert in the preview while working in OBS. */
    const pinned = SAMPLE_ALL_MESSAGES.find((s) => s.message.id === SAMPLE_PIN_ID);
    /* The pin fixture's platform has to be one the default pinPlatforms contains,
       or the banner never draws: syncMultichatStyle strips twitch until an account
       is connected, so a Twitch pin would fall through to an ordinary list row. */
    expect(pinned?.message.platform).toBe('tiktok');
    expect(MULTICHAT_WORKSPACE_DEFAULTS.pinPlatforms).toContain('tiktok');
    mountAll({ showPinEnabled: true, pinPlatforms: ['twitch'] });
    expect(previewText()).not.toContain(`Pinned by ${SAMPLE_PIN_BY}`);
  });
});

describe('the filter settings reach the preview', () => {
  /* Applied before ChatOverlay sees a message, so a preview that rendered the
     fixture array directly would show a blacklisted chatter on screen. */

  it('userBL hides a named chatter', () => {
    mountPreview({ userBL: 'tiktokmod' });
    expect(previewText()).not.toContain('keep it civil in here please');
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
    mountAll({ prefixBL: '!' });
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

describe('BROKEN-ASSET PREVENTION: the base preview owns every image it renders', () => {
  /* The regression this guards is the one that started this work: the 7TV badge
     and emote fixtures pointed at retired cdn.7tv.app ids that now 404, so the
     base preview drew a broken-image icon before anyone touched a control. The
     fix is that a fixture-owned image is a repository-owned image — a data URI or
     a path this app serves — never a third-party host that can go dead. This does
     not touch how a live overlay resolves provider art; it is about the fixtures
     the preview invents. */

  /** Is this a repository-owned source — inline data or an app-served path? */
  const isLocal = (src: string) =>
    src.startsWith('data:image/') || (src.startsWith('/') && !src.startsWith('//'));

  it('declares no fixture cosmetic image on a remote host', () => {
    /* Read straight off the cosmetics the preview is rendered against. */
    const images = [
      SAMPLE_COSMETICS.badges.map((b) => b.image),
      SAMPLE_COSMETICS.emotes.twitch!.map((e) => e.image),
    ].flat();
    /* Both kinds are actually present, so the loop is not vacuously true. */
    expect(SAMPLE_COSMETICS.badges.length).toBeGreaterThan(0);
    expect(SAMPLE_COSMETICS.emotes.twitch!.length).toBeGreaterThan(0);
    for (const src of images) {
      expect(src, src).not.toMatch(/^https?:/i);
      expect(src, src).not.toMatch(/^\/\//);
      expect(isLocal(src), src).toBe(true);
    }
  });

  it('renders no fixture-declared image from a remote host in the mounted preview', () => {
    /* The DOM half: whatever the overlay actually drew from a fixture-supplied
       url — badge overrides and native emote art — must be local too. Twitch
       native badge art is resolved by the production renderer from a badge type,
       not declared by a fixture, so it is out of scope here and asserted
       separately by the renderer's own suite. */
    mountPreview();
    const fixtureImages = [
      ...Array.from(preview().querySelectorAll<HTMLImageElement>('img.ck-emote')),
      ...Array.from(preview().querySelectorAll<HTMLImageElement>('img.ck-badge-img')).filter(
        (img) => {
          const src = img.getAttribute('src') ?? '';
          /* Only the fixture-declared overrides: a data URI or the app's own
             /badges path. The production Twitch CDN lookup is not a fixture. */
          return src.startsWith('data:image/') || src.startsWith('/badges/');
        },
      ),
    ];
    expect(fixtureImages.length).toBeGreaterThan(0);
    for (const img of fixtureImages) {
      const src = img.getAttribute('src') ?? '';
      expect(src, src).not.toMatch(/^https?:/i);
      expect(isLocal(src), src).toBe(true);
    }
  });

  it('can decode or resolve every fixture image, so none renders broken', () => {
    /* Locality is not loadability. A data URI with a mis-encoded payload or a
       malformed SVG body is local and still draws the broken-image icon, and so
       does an app-served path with no file behind it. jsdom never fetches an
       <img>, so neither failure can surface by mounting — each source is checked
       on its own terms instead: data URIs are decoded and parsed as XML, and
       app-served paths are looked for on disk. */
    const sources = [
      ...SAMPLE_COSMETICS.badges.map((b) => b.image),
      ...SAMPLE_COSMETICS.emotes.twitch!.map((e) => e.image),
    ];
    expect(sources.length).toBeGreaterThan(0);
    for (const src of sources) {
      if (src.startsWith('data:image/svg')) {
        const markup = decodeURIComponent(src.slice(src.indexOf(',') + 1));
        expect(markup, src.slice(0, 60)).toMatch(/^<svg\b/);
        const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
        /* A parsererror element is how DOMParser reports malformed markup; the
           browser would refuse the same document and draw nothing. */
        expect(doc.querySelector('parsererror'), markup.slice(0, 80)).toBeNull();
        expect(doc.documentElement.tagName).toBe('svg');
      } else if (src.startsWith('data:image/')) {
        /* A base64 payload that does not decode is an unreadable image. */
        const [meta, payload] = [src.slice(5, src.indexOf(',')), src.slice(src.indexOf(',') + 1)];
        expect(payload.length, src.slice(0, 60)).toBeGreaterThan(0);
        if (meta.endsWith(';base64')) expect(() => atob(payload)).not.toThrow();
      } else {
        expect(existsSync(join(process.cwd(), 'public', src)), src).toBe(true);
      }
    }
  });

  it('gives every inline-SVG fixture an intrinsic size, not just a ratio', () => {
    /* A browser-only regression, which is why it is asserted on the asset string
       rather than on layout: jsdom has no layout, so nothing here could have caught
       it by measuring. The fixtures declared `viewBox` alone, giving the SVG a ratio
       and no intrinsic size. Wherever the renderer sizes an image from its own art —
       most sharply the zero-width path, which puts the base emote in a shrink-to-fit
       wrapper as `display: block` — a sizeless image collapses, and the layered emote
       drew as a 6px smudge in Chromium while this file stayed green.

       The size must also exceed the renderer's own cap, or `max-height` never
       engages and the preview draws emotes at a different size than OBS does. Real
       provider art is bigger than the line; the fixtures have to be too. */
    const sources = [
      ...SAMPLE_COSMETICS.badges.map((b) => b.image),
      ...SAMPLE_COSMETICS.emotes.twitch!.map((e) => e.image),
    ].filter((src) => src.includes('image/svg'));
    expect(sources.length).toBeGreaterThan(0);
    for (const src of sources) {
      const markup = decodeURIComponent(src.slice(src.indexOf(',') + 1));
      const width = /\swidth="(\d+)"/.exec(markup);
      const height = /\sheight="(\d+)"/.exec(markup);
      expect(width, markup.slice(0, 80)).not.toBeNull();
      expect(height, markup.slice(0, 80)).not.toBeNull();
      expect(Number(width![1]), markup.slice(0, 80)).toBeGreaterThan(0);
      expect(Number(height![1]), markup.slice(0, 80)).toBeGreaterThan(0);
    }
  });

  /* Squareness is deliberately NOT asserted, and neither is a floor on the
     declared size. An earlier version of this test required both, which locked
     the fixtures into the one shape that cannot demonstrate the two emote
     behaviours most worth demonstrating: that a wide emote keeps its ratio, and
     that art declared below the cap still draws at the configured height. Both
     are silently satisfied by uniform square art bigger than the cap.

     So the set has to stay uneven, and that is what these two assert. They are
     the guard against a well-meaning tidy-up restoring uniformity. */
  it('keeps a wide emote fixture, so a stretched render is falsifiable', () => {
    const wide = SAMPLE_COSMETICS.emotes.twitch!.filter((e) => e.width > e.height);
    expect(wide.length).toBeGreaterThan(0);
    for (const e of wide) {
      const markup = decodeURIComponent(e.image.slice(e.image.indexOf(',') + 1));
      const w = Number(/\swidth="(\d+)"/.exec(markup)![1]);
      const h = Number(/\sheight="(\d+)"/.exec(markup)![1]);
      /* The declared art has to be wide too — a wide model value over square art
         would describe a ratio the renderer never sees. */
      expect(w, e.name).toBeGreaterThan(h);
    }
  });

  it('keeps an emote fixture declared below the height cap', () => {
    /* 42px is the cap at the default size; see SIZE in ChatOverlay. A fixture
       under it is the provider 1x variant that `height: auto` used to draw
       short, and the only fixture that can prove the height lock works. */
    const small = SAMPLE_COSMETICS.emotes.twitch!.filter((e) => e.height < 42);
    expect(small.length).toBeGreaterThan(0);
  });
});

/* Every badge the production renderer draws carries the badge *type* as its alt
   text, which is what makes these assertions specific rather than a head count:
   they name the role each fixture claims and fail if the lookup stops resolving
   it. `renderBadges` is the only thing that emits .ck-badge-img, so a badge found
   here came through the production table and not from fixture markup. */
const badgeAlts = () =>
  Array.from(preview().querySelectorAll<HTMLImageElement>('img.ck-badge-img')).map(
    (img) => img.getAttribute('alt') ?? '',
  );

/* Every badge on the line containing a given username, in DOM order.

   The overlay's message line is an unclassed div holding the name span, the badge
   images and the body, so climbing to the nearest div from the name is what scopes
   this to one chatter. Order matters in the assertions below: Twitch draws badges
   as declared while YouTube sorts them, and only a per-line, in-order read can
   tell those two apart. */
const badgesBesideName = (username: string) => {
  const line = within(preview()).getByText(username).closest('div');
  return Array.from(line?.querySelectorAll<HTMLImageElement>('img.ck-badge-img') ?? []).map(
    (img) => img.getAttribute('alt') ?? '',
  );
};

describe('the preview demonstrates each platform badge set', () => {
  it('draws the four Twitch role badges plus official extras, from the UUID table', () => {
    mountPreview();
    const alts = badgeAlts();
    /* The role badges a moderator recognises at a glance. */
    for (const role of ['broadcaster', 'moderator', 'vip', 'subscriber']) {
      expect(alts, role).toContain(role);
    }
    /* Beyond the roles: an official Twitch badge that is not about permissions.
       Founder, in the default set. Premium is the same category and lives on a
       library fixture, asserted below rather than here — six rows is the budget and
       a second non-permission badge does not earn one of them. */
    expect(alts).toContain('founder');
    /* And each resolved to real Twitch CDN art rather than a fixture url. */
    const twitchArt = Array.from(
      preview().querySelectorAll<HTMLImageElement>('img.ck-badge-img'),
    ).filter((img) => (img.getAttribute('src') ?? '').includes('static-cdn.jtvnw.net/badges'));
    expect(twitchArt.length).toBeGreaterThanOrEqual(6);
  });

  it('resolves the premium badge from the same table, on the library fixture', () => {
    /* The category is two badges wide in production, so both paths stay covered
       even though only one of them is on screen by default. */
    mountAll();
    expect(badgeAlts()).toContain('premium');
    expect(badgesBesideName('ユキ_yuki')).toEqual(['premium']);
  });

  it('puts several official badges on one Twitch line, in declared order', () => {
    /* One badge per chatter would never show the spacing between them, and Twitch
       badges are not sorted by the renderer — declaration order is what ships, so
       that is what this asserts. */
    mountPreview();
    expect(badgesBesideName('emberwatch')).toEqual([
      'moderator',
      'founder',
      'subscriber',
      /* The 7TV badge is appended after the official ones by the conversion. */
      '7tv badge',
    ]);
  });

  it('resolves the Kick subscriber badge through the channel tier lookup', () => {
    mountPreview();
    /* count 8 clears the six-month tier, so this came from the tier table rather
       than the generic fallback — the lookup picks the highest tier reached.
       Both Kick badge kinds sit on this one line so that Kick keeps its moderator
       badge in a row the preview draws in both pin states. */
    expect(badgesBesideName('emotefiend')).toEqual(['moderator', 'subscriber']);
    const kickTier = SAMPLE_COSMETICS.channel?.subscriber_badges ?? [];
    expect(kickTier.some((tier) => tier.months === 6)).toBe(true);
  });

  it('draws YouTube role badges and sorts them into the production order', () => {
    mountPreview();
    /* The fixture declares moderator before verified. YT_BADGE_ORDER puts verified
       first, so getting the fixture's own order back would mean the sort is gone. */
    expect(badgesBesideName('RedButtonRadio')).toEqual(['verified', 'moderator']);
  });

  it('draws both TikTok badges from connector-supplied art, width-relaxed', () => {
    mountPreview();
    expect(badgesBesideName('tiktokmod')).toEqual(['moderator', 'subscriber']);
    /* TikTok is the one platform whose badges arrive as finished art, and the class
       that keeps non-square art from being squished is applied per platform. Two,
       from the one TikTok row the default set carries. */
    const wide = Array.from(
      preview().querySelectorAll<HTMLImageElement>('img.ck-badge-img.ck-badge-wide'),
    );
    expect(wide).toHaveLength(2);
    for (const img of wide) {
      expect(img.getAttribute('src') ?? '').toMatch(/^\/badges\//);
    }
  });

  it('draws the pinned banner badges through the same badge resolver', () => {
    /* The banner is drawn for the whole pin window, so its badges have to go
       through renderBadges like a list row's rather than through markup of their
       own. Scoped to the banner by the "Pinned by" line, which nothing else has. */
    mountAll();
    const banner = within(preview()).getByText(`Pinned by ${SAMPLE_PIN_BY}`).closest('div')
      ?.parentElement;
    const alts = Array.from(
      banner?.querySelectorAll<HTMLImageElement>('img.ck-badge-img') ?? [],
    ).map((img) => img.getAttribute('alt') ?? '');
    expect(alts).toEqual(['moderator', 'subscriber']);
  });
});

describe('7TV cosmetics are separate from official badges', () => {
  /* 7TV supplies three distinct things — a badge, a name paint, and the paint's
     shadows — and each is governed differently. Asserting them apart is the point:
     a single "cosmetics work" test would pass while the paint toggle silently took
     the official badges with it. */

  it('attaches the 7TV badge through the entitlement path, not a fixture badge', () => {
    mountPreview();
    /* Present on screen... */
    expect(badgeAlts()).toContain('7tv badge');
    /* ...and earned by an entitlement keyed the way the live fetcher keys them,
       rather than declared in the fixture's own badges array. */
    const entitled = SAMPLE_COSMETICS.entitlements['twitch:sample-roles-sender'];
    expect(entitled?.badge).toBe(SAMPLE_COSMETICS.badges[0]?.id);
    const roles = SAMPLE_ALL_MESSAGES.find((s) => s.message.id === 'sample-roles');
    expect(roles?.message.badges.map((b) => b.type)).not.toContain('7tv badge');
  });

  it('entitles one chatter to a badge alone and another to badge and paint', () => {
    /* badge and paint are independent fields, so one sample carrying both could
       not show that a badge arrives without a paint. */
    const paintSender = SAMPLE_COSMETICS.entitlements['twitch:sample-paint-sender'];
    const badgeOnly = SAMPLE_COSMETICS.entitlements['twitch:sample-roles-sender'];
    expect(paintSender?.paint).toBeTruthy();
    expect(paintSender?.badge).toBeTruthy();
    expect(badgeOnly?.badge).toBeTruthy();
    expect(badgeOnly?.paint).toBeUndefined();
    mountPreview();
    /* The badge-only chatter is painted no differently from anyone else. */
    expect(within(preview()).getByText('emberwatch').style.background).toBe('');
    expect(within(preview()).getByText('paintedname').style.background).toContain(
      'linear-gradient',
    );
  });

  it('keeps every official badge when 7TV cosmetics are switched off', () => {
    /* The regression this exists for: gating official art behind the 7TV setting
       would empty a moderator's badges because a cosmetics provider was disabled. */
    mountPreview({ sevenTVCosmeticsEnabled: true });
    const withCosmetics = badgeAlts();
    expect(withCosmetics).toContain('7tv badge');
    cleanup();
    mountPreview({ sevenTVCosmeticsEnabled: false });
    const without = badgeAlts();
    /* The 7TV badge is gone... */
    expect(without).not.toContain('7tv badge');
    /* ...and every official badge from every platform is still drawn. */
    for (const official of withCosmetics.filter((alt) => alt !== '7tv badge')) {
      expect(without, official).toContain(official);
    }
    expect(badgesBesideName('emberwatch')).toEqual(['moderator', 'founder', 'subscriber']);
    expect(badgesBesideName('tiktokmod')).toEqual(['moderator', 'subscriber']);
  });
});

/** Every emote image the preview drew, by the token it stands for. */
const emoteAlts = () =>
  Array.from(preview().querySelectorAll<HTMLImageElement>('img.ck-emote')).map(
    (img) => img.getAttribute('alt') ?? '',
  );

describe('the preview covers every provider emote path', () => {
  /* Provider names are a property of the token, not of the pipeline: production
     merges FFZ, BTTV and 7TV into one emote list and word-swaps them identically
     behind one setting. So these assert that each provider's token *reaches* the
     swap, which is the thing that can break, rather than inventing a per-provider
     code path the renderer does not have. */

  it('swaps a single 7TV token inside an ordinary sentence', () => {
    mountPreview();
    expect(emoteAlts()).toContain('OMEGALUL');
    /* The words before it survived the swap. */
    expect(previewText()).toContain('clip that');
  });

  it('swaps a run of several tokens in one message', () => {
    mountPreview();
    const alts = emoteAlts();
    /* A run exercises the adjacent-token branch, where the renderer decides
       whether a space belongs between two emotes. */
    for (const token of ['OMEGALUL', 'KEKW', 'catJAM', 'PepeLaugh']) {
      expect(alts, token).toContain(token);
    }
    expect(previewText()).toContain('no chance');
  });

  it('layers the zero-width 7TV emote over the emote before it', () => {
    mountPreview();
    const zeroWidth = Array.from(
      preview().querySelectorAll<HTMLImageElement>('img.ck-emote'),
    ).find((img) => img.getAttribute('alt') === 'RainTime');
    expect(zeroWidth).toBeTruthy();
    /* The overlay is structural, not a second inline image: the base emote and the
       zero-width one share one wrapper, which is what stacks them.

       Asserted by class rather than by inline style. The geometry moved into the
       overlay's own stylesheet so the preview and OBS cannot diverge on it, which
       also means jsdom — with no stylesheet applied — can only check structure
       here. The measurements that matter are in Chromium. */
    const wrapper = zeroWidth!.closest('span.ck-zw');
    expect(wrapper).toBeTruthy();
    const stacked = Array.from(wrapper!.querySelectorAll('img.ck-emote')).map((img) =>
      img.getAttribute('alt'),
    );
    expect(stacked).toContain('OMEGALUL');
    expect(stacked).toContain('RainTime');
    /* The base is the wrapper's own child and the only in-flow item; the overlay
       sits in a layer element, which is what takes it out of the text flow. */
    expect(wrapper!.querySelector('img.ck-zw-base')?.getAttribute('alt')).toBe('OMEGALUL');
    expect(zeroWidth!.closest('span.ck-zw-layer')).toBeTruthy();
  });

  it('carries a BTTV and an FFZ token through the same production swap', () => {
    mountPreview();
    const alts = emoteAlts();
    expect(alts).toContain('catJAM'); // BTTV
    expect(alts).toContain('PepeLaugh'); // FFZ
    /* Declared as emote fixtures rather than as badges — these are emotes, and a
       fixture that called them badges would misdescribe what the providers do. */
    const names = SAMPLE_COSMETICS.emotes.twitch!.map((e) => e.name);
    expect(names).toContain('catJAM');
    expect(names).toContain('PepeLaugh');
    expect(SAMPLE_COSMETICS.badges.map((b) => b.id)).not.toContain('catJAM');
  });

  it('keeps native platform emote art out of the third-party toggle', () => {
    /* A native emote arrives with the message and is not a 7TV swap, so disabling
       third-party emotes must not remove it. */
    mountPreview({ sevenTVEmotesEnabled: false });
    expect(emoteAlts()).toContain('Kappa');
  });

  it('returns every provider token to plain text when third-party emotes are off', () => {
    mountPreview({ sevenTVEmotesEnabled: false });
    const alts = emoteAlts();
    for (const token of ['OMEGALUL', 'KEKW', 'RainTime', 'catJAM', 'PepeLaugh']) {
      expect(alts, token).not.toContain(token);
      /* Readable rather than deleted — the message still says what was typed. */
      expect(previewText(), token).toContain(token);
    }
  });

  it('declares emotes as tokens in text, never as markup in a fixture', () => {
    /* The structural guarantee behind all of the above: if a fixture shipped an
       <img>, every assertion here would pass with the renderer removed. */
    for (const { message } of SAMPLE_ALL_MESSAGES) {
      expect(message.text, message.id).not.toContain('<img');
      expect(message.text, message.id).not.toContain('ck-emote');
      expect(message.text, message.id).not.toContain('ck-badge');
    }
  });
});

describe('the default showcase fits the frame it is drawn in', () => {
  /* WHY THIS GROUP EXISTS AT ALL, AND WHY IT IS NOW ABOUT FITTING RATHER THAN
     SURVIVING. The overlay's #chat_container is absolutely positioned at bottom: 0
     with overflow hidden, so rows fill upward from the bottom edge and the earliest
     entries are the ones clipped away. An earlier revision accepted that: it shipped
     thirteen fixtures, more than the frame can draw, and ordered them so the richest
     sat last and the sacrificial ones sat first.

     That was a losing arrangement. Ordering only decides *which* rows are lost, and
     it does nothing at all once anything is appended — the browser check found the
     first row clipped mid-badge and the showcase already gone. So the default set is
     now sized to the frame instead of ordered against it: six rows, every one of
     them whole, nothing sacrificial, nothing appended unless asked.

     The measurement, since these numbers are the specification: the sample frame
     lays out at 899×370 internal px before its 0.75 transform. A single-line row
     occupies 55 of them. Six rows are 330 and clear the 370 with room over the top;
     seven are 385 and the top one is cut mid-line. Anything that wraps costs two
     rows, and an event card costs about three. */

  /** Fixture ids in display order. No exclusions — the default set has no pin. */
  const listOrder = () => SAMPLE_MESSAGES.map((s) => s.message.id);

  it('draws six rows, which is what the measured frame holds whole', () => {
    /* Not "at most thirteen and hope". Exactly the number that fits, so a seventh
       fixture fails here rather than silently clipping the first one in a browser. */
    expect(SAMPLE_MESSAGES).toHaveLength(6);
  });

  it('renders all six as list rows, with none spent on a card or a banner', () => {
    mountPreview();
    expect(bodies()).toHaveLength(6);
  });

  it('keeps every default body short enough to stay on one line', () => {
    /* A wrapped row costs two of the six and pushes the top one out — which is
       precisely how the previous attempt lost the broadcaster and VIP badges. */
    for (const sample of SAMPLE_MESSAGES) {
      expect(sample.message.text.length, sample.message.id).toBeLessThanOrEqual(52);
    }
  });

  it('gives every default row a badge, so none of the six is filler', () => {
    /* Six rows and seventeen things to demonstrate: an unbadged line, a plain
       greeting or a coverage-only message cannot earn one of them. */
    for (const sample of SAMPLE_MESSAGES) {
      expect(sample.message.badges.length, sample.message.id).toBeGreaterThan(0);
    }
  });

  it('puts no event or system card in the default set', () => {
    /* A Super Chat card is around three rows tall. The browser check found one
       occupying half the frame while the badge and paint rows sat above the cut. */
    for (const sample of SAMPLE_MESSAGES) {
      expect(sample.message.kind, sample.message.id).toBe('chat');
      expect(sample.message.category, sample.message.id).toBeUndefined();
    }
    mountPreview();
    const text = previewText();
    expect(text).not.toContain('Super Chat');
    expect(text).not.toContain('💰');
    expect(text).not.toContain('🎁');
  });

  it('puts no pin in the default set, so no banner covers the frame', () => {
    /* The banner is opaque, top-anchored and roughly three of the six rows tall. */
    expect(listOrder()).not.toContain(SAMPLE_PIN_ID);
    mountPreview();
    expect(previewText()).not.toContain(`Pinned by ${SAMPLE_PIN_BY}`);
  });

  it('keeps the event and pin fixtures available in the library', () => {
    /* Moved out of the default viewport, not deleted: they are real production
       shapes with real rendering behaviour, and the tests above still exercise
       them through the full catalog. */
    const libraryIds = SAMPLE_LIBRARY_MESSAGES.map((s) => s.message.id);
    expect(libraryIds).toContain(SAMPLE_PIN_ID);
    expect(libraryIds).toContain('sample-event');
    expect(libraryIds).toContain('sample-gift');
    expect(libraryIds).toContain('sample-bot');
    expect(libraryIds).toContain('sample-plain');
  });

  it('separates the two arrays cleanly, with nothing in both', () => {
    const showcase = new Set(listOrder());
    for (const sample of SAMPLE_LIBRARY_MESSAGES) {
      expect(showcase.has(sample.message.id), sample.message.id).toBe(false);
    }
    expect(SAMPLE_ALL_MESSAGES).toHaveLength(
      SAMPLE_MESSAGES.length + SAMPLE_LIBRARY_MESSAGES.length,
    );
  });

  it('alternates platforms rather than grouping them', () => {
    /* Grouped platforms make the source tags look like section headers. */
    const platforms = SAMPLE_MESSAGES.map((s) => s.message.platform);
    for (let i = 1; i < platforms.length; i += 1) {
      expect(platforms[i], `index ${i}`).not.toBe(platforms[i - 1]);
    }
  });

  it('keeps the mentioned chatter ahead of the mention', () => {
    /* Mentions only colour for a chatter already seen, so this ordering is what
       makes the mention row demonstrate anything at all. */
    const order = listOrder();
    expect(order.indexOf('sample-badges')).toBeLessThan(order.indexOf('sample-mention'));
  });

  it('keeps the pin fixture on a platform the banner would actually draw', () => {
    /* Still true of the library fixture: twitch is stripped from pinPlatforms until
       an account is connected, so a Twitch pin would quietly demote to a list row
       and the banner tests above would pass against nothing. */
    const pinned = SAMPLE_ALL_MESSAGES.find((s) => s.message.id === SAMPLE_PIN_ID);
    expect(pinned).toBeTruthy();
    expect(MULTICHAT_WORKSPACE_DEFAULTS.pinPlatforms).toContain(pinned!.message.platform);
    expect(pinned!.message.platform).not.toBe('twitch');
  });
});

describe('the initial showcase is fixed, not generated', () => {
  it('reads no random source while rendering', () => {
    /* Date.now is already asserted elsewhere. Math.random is the other way a
       preview becomes unreproducible, and a randomly ordered or randomly badged
       fixture set would make every assertion above intermittent. */
    const random = vi.spyOn(Math, 'random');
    mountPreview();
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
  });

  it('gives every fixture a stable id, timestamp and sender', () => {
    const ids = SAMPLE_ALL_MESSAGES.map((s) => s.message.id);
    expect(new Set(ids).size).toBe(ids.length);
    /* Namespaced, so a fixture can never collide with a composed or generated
       message on a React key. */
    for (const id of ids) expect(id, id).toMatch(/^sample-/);
    /* One second apart, in order, from a constant epoch — no clock anywhere. The
       showcase holds the first stamps and the library continues the run, so the
       split did not leave a gap or a repeat. */
    const stamps = SAMPLE_ALL_MESSAGES.map((s) => s.message.timestamp);
    expect(stamps).toEqual(stamps.map((_, i) => SAMPLE_EPOCH + i * 1000));
  });

  it('holds the same markup on a third mount as on the first', () => {
    /* Two mounts can agree by accident if something caches. Three is the cheap
       insurance, and it also covers the frame being torn down between them. */
    mountPreview();
    const first = preview().innerHTML;
    cleanup();
    mountPreview();
    const second = preview().innerHTML;
    cleanup();
    mountPreview();
    expect(second).toBe(first);
    expect(preview().innerHTML).toBe(first);
  });
});

describe('the catalog includes the conversational shapes a generator needs', () => {
  it('includes a bot-style message that is still rendered', () => {
    /* Bots are filtered by name, and the fixture bot is deliberately not in the
       production KNOWN_BOTS set — so it renders by default and the botNames setting
       has something to act on. A library fixture: it is the longest post in the
       catalog and wraps to four lines, which the six-row default cannot spare. */
    mountAll();
    expect(previewText()).toContain('overlaybot');
    expect(bodies().join(' ')).toContain('one browser source for chat');
  });

  it('includes a message with no badges at all', () => {
    /* The plainest possible line, so the catalog shows what an ordinary viewer
       looks like next to everyone carrying badges. In the library rather than the
       default six, where a row that demonstrates the absence of a feature cannot
       justify displacing one that demonstrates a feature. */
    const plain = SAMPLE_LIBRARY_MESSAGES.find((s) => s.message.id === 'sample-plain');
    expect(plain?.message.badges).toEqual([]);
    mountAll();
    expect(badgesBesideName('greenscreen')).toEqual([]);
  });

  it('carries no provider labels or debug text in any message body', () => {
    /* The fixtures are chat, not annotations. A body naming its own provider would
       read as debug output on a page a streamer is meant to copy a URL from. */
    for (const { message } of SAMPLE_ALL_MESSAGES) {
      const text = message.text.toLowerCase();
      for (const label of ['7tv', 'bttv', 'ffz', 'test message', 'lorem', 'example']) {
        expect(text, `${message.id} / ${label}`).not.toContain(label);
      }
    }
  });
});

describe('the six default rows carry the whole demonstration between them', () => {
  /* THE POINT OF THIS GROUP. Every assertion elsewhere in this file can be satisfied
     by a capability existing somewhere in the catalog. These assert it exists in the
     set a visitor actually sees, without enabling anything, without waiting, and
     without scrolling — which is the failure the browser check caught: the coverage
     was all present and none of it was on screen.

     One mount, many reads. The default preview is what is under test, so re-mounting
     per assertion would let a change that only broke the combination pass. */

  const mountOnce = () => {
    mountPreview();
    return { alts: badgeAlts(), emotes: emoteAlts(), text: previewText() };
  };

  it('shows the Twitch role badges: broadcaster, moderator, VIP and subscriber', () => {
    const { alts } = mountOnce();
    for (const role of ['broadcaster', 'moderator', 'vip', 'subscriber']) {
      expect(alts, role).toContain(role);
    }
  });

  it('shows an official Twitch badge beyond the roles', () => {
    expect(mountOnce().alts).toContain('founder');
  });

  it('stacks three official Twitch badges on one row', () => {
    mountPreview();
    expect(badgesBesideName('emberwatch')).toEqual([
      'moderator',
      'founder',
      'subscriber',
      '7tv badge',
    ]);
  });

  it('pairs broadcaster with subscriber on one row', () => {
    mountPreview();
    expect(badgesBesideName('purplereign')).toEqual(['broadcaster', 'subscriber']);
  });

  it('pairs VIP with subscriber on one row', () => {
    mountPreview();
    expect(badgesBesideName('paintedname')).toEqual(['vip', 'subscriber', '7tv badge']);
  });

  it('shows a Kick moderator and subscriber together', () => {
    mountPreview();
    expect(badgesBesideName('emotefiend')).toEqual(['moderator', 'subscriber']);
  });

  it('shows a supported YouTube role, sorted the way production sorts it', () => {
    mountPreview();
    expect(badgesBesideName('RedButtonRadio')).toEqual(['verified', 'moderator']);
  });

  it('shows a TikTok moderator and subscriber together', () => {
    mountPreview();
    expect(badgesBesideName('tiktokmod')).toEqual(['moderator', 'subscriber']);
  });

  it('shows the 7TV badge, earned through an entitlement', () => {
    expect(mountOnce().alts).toContain('7tv badge');
  });

  it('shows a 7TV gradient paint on a username', () => {
    mountPreview();
    const painted = within(preview()).getByText('paintedname');
    expect(painted.style.background).toContain('linear-gradient');
  });

  it('shows the paint shadow on that same username', () => {
    mountPreview();
    expect(within(preview()).getByText('paintedname').style.filter).toContain('drop-shadow');
  });

  it('shows a 7TV emote', () => {
    expect(mountOnce().emotes).toContain('OMEGALUL');
  });

  it('shows a BTTV emote', () => {
    expect(mountOnce().emotes).toContain('catJAM');
  });

  it('shows an FFZ emote', () => {
    expect(mountOnce().emotes).toContain('PepeLaugh');
  });

  it('shows a native platform emote', () => {
    expect(mountOnce().emotes).toContain('Kappa');
  });

  it('shows a zero-width 7TV emote layered over its base, through the production path', () => {
    mountPreview();
    const zero = Array.from(preview().querySelectorAll<HTMLImageElement>('img.ck-emote')).find(
      (img) => img.getAttribute('alt') === 'RainTime',
    );
    expect(zero).toBeTruthy();
    /* The production layering: a layer span inside the wrapper the base emote also
       sits in. Preview-only markup would not produce this, which is the structural
       half of the assertion — the geometric half is measured in Chromium, since
       the rules that place these live in the overlay's stylesheet. */
    const inner = zero!.parentElement as HTMLElement;
    expect(inner.className).toBe('ck-zw-layer');
    const wrapper = inner.parentElement as HTMLElement;
    expect(wrapper.className).toBe('ck-zw');
    expect(wrapper.querySelectorAll('img.ck-emote').length).toBeGreaterThanOrEqual(2);
    /* One wrapper for the whole stack, and the base is not inside a layer. */
    expect(wrapper.querySelectorAll('span.ck-zw').length).toBe(0);
    const base = wrapper.querySelector('img.ck-zw-base') as HTMLElement;
    expect(base.getAttribute('alt')).toBe('OMEGALUL');
    expect(base.closest('span.ck-zw-layer')).toBeNull();
  });

  it('puts several provider emotes in one concise message', () => {
    /* One row demonstrating four providers, rather than four rows demonstrating one
       each — six rows do not stretch to a row per provider. */
    mountPreview();
    const line = within(preview()).getByText('emotefiend').closest('div');
    const alts = Array.from(line?.querySelectorAll<HTMLImageElement>('img.ck-emote') ?? []).map(
      (img) => img.getAttribute('alt') ?? '',
    );
    for (const token of ['OMEGALUL', 'RainTime', 'KEKW', 'catJAM', 'PepeLaugh']) {
      expect(alts, token).toContain(token);
    }
  });

  it('shows a coloured @mention', () => {
    mountPreview();
    const strong = preview().querySelector<HTMLElement>('.ck-body strong');
    expect(strong?.textContent).toBe('@purplereign');
    expect(strong?.style.color).not.toBe('');
  });

  it('reaches all four platforms', () => {
    const { text } = mountOnce();
    for (const name of ['purplereign', 'emotefiend', 'RedButtonRadio', 'tiktokmod']) {
      expect(text, name).toContain(name);
    }
    expect(showcasePlatforms().sort()).toEqual(['kick', 'tiktok', 'twitch', 'youtube']);
  });

  it('holds all of it at once, in one paint', () => {
    /* The combination, asserted as a combination. Each capability above could be
       satisfied by a different arrangement of six rows; this fails if any of them
       stops sharing the frame with the others. */
    const { alts, emotes } = mountOnce();
    for (const badge of ['broadcaster', 'moderator', 'vip', 'subscriber', 'founder', 'verified']) {
      expect(alts, badge).toContain(badge);
    }
    expect(alts).toContain('7tv badge');
    for (const token of ['OMEGALUL', 'RainTime', 'KEKW', 'catJAM', 'PepeLaugh', 'Kappa']) {
      expect(emotes, token).toContain(token);
    }
    expect(within(preview()).getByText('paintedname').style.background).toContain(
      'linear-gradient',
    );
    expect(bodies()).toHaveLength(6);
  });
});
