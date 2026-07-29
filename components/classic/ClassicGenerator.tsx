/* The multichat-gxufy generator: the original Classic page, revamped.
 *
 * This is the canonical generator, served at a channel-less /multichat. It keeps
 * the Classic identity — centred branded header, platform badges, the dark
 * gradient background, one polished card per section, compact platform inputs,
 * the two-column control table, the pill switches — and replaces what used to sit
 * underneath it.
 *
 * What changed underneath, and why it matters:
 *
 *   - Controls are rendered from the tool catalogs (24 MultiChat, 6 Counter)
 *     rather than hand-written <select>s and hardcoded <option> lists. The
 *     Classic page previously restated every label and option, so a catalog entry
 *     could change without this page noticing. Now it cannot.
 *   - `sourceTag` is the full four-value enum, not the legacy platformIcons
 *     boolean that could only reach 'icon' and 'none'.
 *   - Both previews are real overlays in iframes at the exact generated URLs, so
 *     Preview, URL, Copy, and Open cannot disagree.
 *   - The Viewer Counter is embedded as a companion panel driven by the same
 *     counterTool descriptor — the same defaults, normalizer, serializer, and
 *     preview frame as the standalone tool had. There is no second Counter.
 *
 * Layout, which is load-bearing rather than cosmetic: one column per tool. The
 * chat and Counter outputs sit aligned beside each other in the first row, and
 * each settings card sits directly beneath its own output in the second, with
 * commands and OBS setup full width below. The DOM order is the stacked order —
 * header, channels, chat preview and URL, chat settings, Counter preview and URL,
 * Counter settings, commands, OBS setup — so a phone gets that sequence with no
 * reordering, and the desktop arrangement is named grid areas over that same tree
 * rather than a second one.
 *
 * Browser-safe: no server-only imports. The Twitch connection id is never
 * rendered, logged, or placed in a query string — it reaches only the generated
 * overlay URL's fragment, through the descriptor's own `context`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import OverlayPreviewFrame from '@/components/workspace/OverlayPreviewFrame';
import ClassicChatPreview from './ClassicChatPreview';
import ClassicCounterPreview from './ClassicCounterPreview';
import ClassicPreviewComposer from './ClassicPreviewComposer';
import ClassicSetting, { type SettingRange } from './ClassicSetting';
import ClassicTwitchConnect from './ClassicTwitchConnect';
import ClassicPreviewFeedControls from './ClassicPreviewFeedControls';
import ClassicPreviewBadgePicker from './ClassicPreviewBadgePicker';
import ClassicPreviewBadgeLibrary from './ClassicPreviewBadgeLibrary';
import ClassicPreviewScaleControl from './ClassicPreviewScaleControl';
import ClassicPreviewBackgroundControl, {
  DEFAULT_PREVIEW_CUSTOM_COLOR,
  effectivePreviewBackground,
  previewBackgroundFromDraft,
  previewSurfaceClass,
  type PreviewBgMode,
} from './ClassicPreviewBackgroundControl';
import {
  PREVIEW_SCALE_DEFAULT,
  type PreviewScale,
} from './IsolatedPreviewFrame';
import ClassicCounterFeedControls from './ClassicCounterFeedControls';
import { useChatPreviewSimulator } from './useChatPreviewSimulator';
import { usePreviewBadgeLibrary } from './usePreviewBadgeLibrary';
import { useCounterPreviewSimulator } from './useCounterPreviewSimulator';
import { combinationLabel } from '@/lib/tools/counter/previewSimulator';
import { PREVIEW_SOURCES } from '@/lib/tools/multichat/previewSimulator';
import { CLASSIC_GENERATOR_CSS } from './classicStyles';
import { MULTICHAT_COMMANDS, MULTICHAT_COMMAND_ALIAS, MULTICHAT_COMMAND_TRIGGER } from '@/lib/multichatCommands';
import {
  OVERLAY_FONT_SPECS,
  UI_FONT_SPECS,
  googleFontsImportCss,
} from '@/lib/overlayFonts';
import { FONT_FAMILIES } from '@/components/ChatOverlay';
import { MULTICHAT_OBS_ALTERNATE, MULTICHAT_OBS_SIZE } from '@/lib/tools/multichat/obs';
import { multichatTool } from '@/lib/tools/multichat/config';
import { SAMPLE_PIN_ID, sampleMessages } from '@/lib/tools/multichat/samples';
import { counterTool } from '@/lib/tools/counter/config';
import {
  SAMPLE_COUNTER_COUNTS,
  parseCounterCount,
  sampleCounterStatuses,
} from '@/lib/tools/counter/samples';
import { EMPTY_MULTICHAT_RUNTIME, type MultichatRuntime } from '@/lib/tools/multichat/runtime';
import type { MultichatPlatform, MultichatWorkspaceStyle } from '@/lib/multichatConfig';
import { PLATFORM_ORDER } from '@/lib/viewerCounterConfig';
import type { ViewerCounterStyle, ViewerPlatform } from '@/lib/viewerCounterConfig';
import type { ToolChannels } from '@/lib/tools/registry';
import type { UnifiedMessage } from '@/lib/types';
import type { CatalogAvailability, SettingValue } from '@/lib/tools/settingTypes';
import {
  colorSetting,
  multiSelectSetting,
  selectSetting,
  textSetting,
  toggleSetting,
} from '@/lib/tools/settingTypes';
import { buildOverlayUrl } from '@/lib/tools/toolContext';
import { consumeWorkspaceDraft, writeWorkspaceDraft } from '@/lib/workspaceStorage';
import { COUNTER_SECTION_ID } from '@/lib/multichatRouting';

/* Every face this page needs: its own UI typography plus all overlay families,
   because the font picker renders each option in the face it names. The overlay
   routes deliberately request only the single family their URL selected.

   An @import inside a <style>, never a stylesheet <link> — next/head warns about
   the latter on every render, and a repo test greps for it. */
const GENERATOR_FONT_CSS = googleFontsImportCss([
  ...Object.values(UI_FONT_SPECS),
  ...Object.values(OVERLAY_FONT_SPECS),
]);

/** How long the copied confirmation stays on a Copy button. */
const COPIED_MS = 2000;

/* The built-in chat fixtures, resolved once at module scope.
   `sampleMessages()` returns a fresh array per call, so calling it inline would
   hand the preview a new array identity on every keystroke and re-convert every
   message for nothing. The list is never mutated — custom messages are appended
   into a new array — so one shared frozen-in-practice value is correct. */
const SAMPLE_CHAT_MESSAGES = sampleMessages();

/* The built-in counts as field strings, for the editable preview inputs.
   A fresh object per call, deliberately: this seeds state and backs Restore, and
   a shared object would let one of those mutate the other's baseline. */
function initialSampleCountFields(): Record<ViewerPlatform, string> {
  const fields = {} as Record<ViewerPlatform, string>;
  for (const platform of PLATFORM_ORDER) {
    fields[platform] = String(SAMPLE_COUNTER_COUNTS[platform]);
  }
  return fields;
}

/* The two catalogs, looked up once at module scope. Every lookup asserts the key
   exists with the expected control type, so a catalog rename breaks the build
   here rather than silently dropping a control from the page. */
const MC = multichatTool.catalog;
const VC = counterTool.catalog;

const MC_TEXT_SIZE = selectSetting(MC, 'textSize');
const MC_FONT = selectSetting(MC, 'font');
const MC_STROKE = selectSetting(MC, 'stroke');
const MC_TEXT_SHADOW = selectSetting(MC, 'textShadow');
const MC_ANIMATION = selectSetting(MC, 'animation');
const MC_EMOTE_SCALE = textSetting(MC, 'emoteScale');
const MC_SOURCE_TAG = selectSetting(MC, 'sourceTag');
const MC_SEVENTV_EMOTES = toggleSetting(MC, 'sevenTVEmotesEnabled');
const MC_SEVENTV_COSMETICS = toggleSetting(MC, 'sevenTVCosmeticsEnabled');
const MC_PAINT_SHADOWS = toggleSetting(MC, 'paintShadows');
const MC_FADE_ENABLED = toggleSetting(MC, 'fadeEnabled');
const MC_FADE = textSetting(MC, 'fade');
const MC_MSG_BOLD = toggleSetting(MC, 'msgBold');
const MC_MSG_CAPS = toggleSetting(MC, 'msgCaps');
const MC_HIDE_NAMES = toggleSetting(MC, 'hideNames');
const MC_MOD_ACTION = toggleSetting(MC, 'modAction');
const MC_MENTION_COLOR = toggleSetting(MC, 'mentionColor');
const MC_SHOW_PIN = toggleSetting(MC, 'showPinEnabled');
const MC_PIN_PLATFORMS = multiSelectSetting(MC, 'pinPlatforms');
const MC_BG_COLOR = colorSetting(MC, 'bgColor');
const MC_FONT_COLOR = colorSetting(MC, 'fontColor');
const MC_BOT_NAMES = textSetting(MC, 'botNames');
const MC_USER_BL = textSetting(MC, 'userBL');
const MC_PREFIX_BL = textSetting(MC, 'prefixBL');

const VC_COMBINED = toggleSetting(VC, 'combined');
const VC_ICONS = toggleSetting(VC, 'icons');
const VC_BG = toggleSetting(VC, 'bg');
const VC_ALIGN = selectSetting(VC, 'align');
const VC_TEXT_SHADOW = selectSetting(VC, 'textShadow');
const VC_STROKE = selectSetting(VC, 'stroke');

/* The two settings that are genuinely numeric, drawn as sliders.
   Bounds are the ones the overlay's own parser accepts, not new limits: the fade
   parser is parseInt on a seconds value, and emoteScale is documented in its own
   label as 0–3. Both keep their blank state, which suppresses the parameter — a
   slider alone cannot express that, hence the button. */
const FADE_RANGE: SettingRange = {
  min: 1,
  max: 120,
  step: 1,
  unit: 's',
  blankLabel: 'Never',
};

const EMOTE_SCALE_RANGE: SettingRange = {
  min: 0.5,
  max: 3,
  step: 0.1,
  unit: '×',
  blankLabel: 'Default',
};

/* Counter platform labels, taken from the descriptor's own channel fields rather
   than written out again. The counter panel already labels its channel inputs
   from this list, so the preview-count fields cannot end up disagreeing with
   them about what a platform is called. */
const COUNTER_PLATFORM_LABEL = Object.fromEntries(
  counterTool.platforms.map((platform) => [platform.key, platform.label]),
) as Record<ViewerPlatform, string>;

/* Platform chip classes, matching the Classic tag colours. */
const PLATFORM_TAG: Record<string, string> = {
  kick: 'kick-tag',
  twitch: 'tw-tag',
  youtube: 'yt-tag',
  tiktok: 'tt-tag',
};

export default function ClassicGenerator({
  /** True when the visitor arrived asking to start at the Viewer Counter. */
  focusCounter = false,
}: {
  focusCounter?: boolean;
}) {
  /* ---------------------------------------------------------------- */
  /* State                                                            */
  /* ---------------------------------------------------------------- */

  const [chatStyle, setChatStyle] = useState<MultichatWorkspaceStyle>(
    multichatTool.defaults,
  );
  const [counterStyle, setCounterStyle] = useState<ViewerCounterStyle>(
    counterTool.defaults,
  );
  /* One channel map, shared by both tools. The Classic page has always had a
     single set of platform inputs feeding chat and the counter alike, and that is
     the point of the embedded panel — you fill in your channels once. The two
     tools' styles stay completely separate objects, so restyling chat cannot
     alter an already-generated counter URL. */
  const [channels, setChannels] = useState<ToolChannels<string>>({});
  const [runtime, setRuntime] = useState<MultichatRuntime>(EMPTY_MULTICHAT_RUNTIME);
  /* The preview-only backdrop, one mode per preview so the two are independent
     browser sources judged against different scenes. Custom carries its own
     remembered colour, so a detour through another mode and back restores it.
     None of this is serialized — see ClassicPreviewBackgroundControl. */
  const [chatBgMode, setChatBgMode] = useState<PreviewBgMode>('checker');
  const [chatBgColor, setChatBgColor] = useState(DEFAULT_PREVIEW_CUSTOM_COLOR);
  const [counterBgMode, setCounterBgMode] = useState<PreviewBgMode>('checker');
  const [counterBgColor, setCounterBgColor] = useState(DEFAULT_PREVIEW_CUSTOM_COLOR);
  const [baseUrl, setBaseUrl] = useState('https://multichat-gxufy.com');
  const [copiedChat, setCopiedChat] = useState(false);
  const [copiedCounter, setCopiedCounter] = useState(false);
  /* Composed preview messages, appended after the built-in samples.
     Generator-only state: never serialized into an overlay URL, never written to
     the saved draft, and gone when the tab closes. */
  const [customMessages, setCustomMessages] = useState<readonly UnifiedMessage[]>([]);

  /* The live preview feed. Generator-only, exactly like the composed messages:
     it produces `UnifiedMessage` values and hands them to the same preview
     component the static fixtures go through. No socket, no pin poll, no fetch,
     and nothing it produces is serialized. The hook owns its own timer; see its
     header for why it sits here rather than inside the preview. */
  const feed = useChatPreviewSimulator();

  /* The badge & cosmetic library. Generator-only in the same strict sense as the
     feed: it owns a browsable catalog of preview badge art and the one request
     that extends it, and nothing it holds is serialized or written to the draft.
     The real overlay never imports its loader, so opening the library opens a
     request OBS never makes. See the hook header for the no-fetch-on-mount and
     never-clear-on-failure guarantees. */
  const badgeLibrary = usePreviewBadgeLibrary();

  /* The preview-only zoom. Generator-only state in the strictest sense: it is
     not in `chatStyle`, so the serializer never sees it, it is not in the draft,
     and `textSize` is untouched — the overlay's own size setting still means
     what it meant. All this decides is how large the preview *surface* is drawn.

     Held here rather than inside the preview so the control and the frame agree
     without the preview needing state of its own, which two suites assert it has
     none of. */
  const [previewScale, setPreviewScale] = useState<PreviewScale>(PREVIEW_SCALE_DEFAULT);

  /* Summarised for the feed's live region rather than announced per chip: the
     count is what changes meaningfully, and nine separate announcements while
     someone works through the picker would be noise. */
  const enabledSourceCount = PREVIEW_SOURCES.filter((source) => feed.sources[source]).length;

  /* What the fixture preview renders: the samples, then anything composed, then
     whatever the feed has generated. A new array only when one of those three
     actually changes, so typing in a settings field does not re-convert every
     message.

     The pin fixture is held out while the feed says the pin is not currently
     offered. That is the whole pin mechanism: `ClassicChatPreview` decides
     whether to pin by looking for SAMPLE_PIN_ID in this array, so removing the
     fixture retires the banner and returning it brings a fresh one — with no
     clock or random source inside the preview, which two existing suites assert
     it has none of. */
  const previewMessages = useMemo(() => {
    const fixtures = feed.pinVisible
      ? SAMPLE_CHAT_MESSAGES
      : SAMPLE_CHAT_MESSAGES.filter((message) => message.id !== SAMPLE_PIN_ID);
    if (customMessages.length === 0 && feed.messages.length === 0) return fixtures;
    return [...fixtures, ...customMessages, ...feed.messages];
  }, [customMessages, feed.messages, feed.pinVisible]);

  /* Appends rather than replaces, and never mutates: the fixture list is shared at
     module scope, and the preview compares message arrays by identity. */
  const addCustomMessage = useCallback((message: UnifiedMessage) => {
    setCustomMessages((current) => [...current, message]);
  }, []);

  /* Reset and Clear land on the same state today, and that is not an oversight
     worth "simplifying" away: they differ in what else they do and in when they
     are offered. Clear is about the composed messages alone and is disabled when
     there are none; Reset also empties the composer's own fields and is always
     available, so it is the one button that always returns the card to how it
     looked on arrival. Keeping them separate means adding a control that mutates
     the sample list has one obvious place to hook into. */
  const clearCustomMessages = useCallback(() => setCustomMessages([]), []);
  const resetPreviewMessages = useCallback(() => setCustomMessages([]), []);

  /* The live Counter rotation. Generator-only in the same way the chat feed is:
     it produces `PlatformStatuses` — the shape the live overlay folds real
     /api/viewers results into — and hands them to the same production renderer
     the fixtures went through. No request, no polling, no provider connection,
     and nothing it produces is serialized.

     Declared above the manual fields because typing in one switches the mode. */
  const counterSim = useCounterPreviewSimulator();

  /* Pulled out by itself so the callback below can depend on it. It is a
     `useState` setter, so its identity is stable for the life of the component —
     depending on the whole `counterSim` object instead would rebuild that
     callback on every render, since the hook returns a fresh object each time. */
  const { setMode: setCounterMode } = counterSim;

  /* Sample viewer counts, as typed. Strings rather than numbers, because the
     field has to be able to hold "" — the state the renderer draws as an em dash
     — and a numeric state would have to encode that absence some other way.
     Generator-only, exactly like the composed messages: never serialized, never
     written to the draft, never sent to /api/viewers. */
  const [sampleCounts, setSampleCounts] = useState<Record<ViewerPlatform, string>>(
    () => initialSampleCountFields(),
  );

  const setSampleCount = useCallback(
    (platform: ViewerPlatform, raw: string) => {
      /* Rejected keystrokes are dropped rather than corrected: silently rewriting
         what someone typed is worse than refusing it, and the field is already
         constrained to seven digits. An empty field is always allowed through —
         it is a meaningful value here, not an invalid one. */
      if (raw !== '' && parseCounterCount(raw) === null) return;
      /* Typing is the switch into Manual. Without this the rotation would
         overwrite the typed value at the next tick and the field would look
         broken; there is no reading of "edit a number but keep cycling" that a
         person would actually want. Restore simulation goes back. */
      setCounterMode('manual');
      setSampleCounts((current) => ({ ...current, [platform]: raw }));
    },
    [setCounterMode],
  );

  const restoreSampleCounts = useCallback(
    () => setSampleCounts(initialSampleCountFields()),
    [],
  );

  /* The statuses the manual fields describe. Every field is parsed through the
     shared helper, so a blank field becomes 'live-unknown' and the renderer's own
     unavailable presentation is what appears — no second reading of the counts
     here. */
  const manualStatuses = useMemo(() => {
    const counts: Partial<Record<ViewerPlatform, number>> = {};
    for (const platform of PLATFORM_ORDER) {
      const parsed = parseCounterCount(sampleCounts[platform]);
      if (parsed !== null) counts[platform] = parsed;
    }
    return sampleCounterStatuses(counts);
  }, [sampleCounts]);

  /* Which numbers the preview shows.
     The rotation's statuses win while it is live and has produced a state, and
     the manual fields are the fallback in every other case. The order matters
     twice over: `counterSim.statuses` is null until the first tick, so the very
     first paint — server and client alike — is the deterministic fixture set and
     there is no hydration mismatch; and switching to Manual hands control back
     to the fields immediately rather than after the pending delay expires. */
  const counterStatuses =
    counterSim.mode === 'live' && counterSim.statuses !== null
      ? counterSim.statuses
      : manualStatuses;

  /* Rendered origin. Kept out of the initial state so the server-rendered markup
     and the first client render agree; the effect corrects it immediately. */
  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  /* Arrived from the retired /tools/counter route, or with ?tab=counter from an
     old bookmark. The Counter panel is a real anchor target, so the browser
     handles a plain `#viewer-counter` itself — but `?tab=counter` has no
     fragment to act on, and a fragment that arrives before hydration can be
     scrolled past as the rest of the page mounts. Scrolling here covers both. */
  useEffect(() => {
    if (!focusCounter) return;
    document.getElementById(COUNTER_SECTION_ID)?.scrollIntoView({ block: 'start' });
  }, [focusCounter]);

  /* ---------------------------------------------------------------- */
  /* Change handlers                                                  */
  /* ---------------------------------------------------------------- */

  const changeChat = useCallback((key: keyof MultichatWorkspaceStyle & string, next: SettingValue) => {
    setChatStyle((current) => multichatTool.normalize({ ...current, [key]: next }));
  }, []);

  const changeCounter = useCallback((key: keyof ViewerCounterStyle & string, next: SettingValue) => {
    setCounterStyle((current) => counterTool.normalize({ ...current, [key]: next }));
  }, []);

  const changeChannel = useCallback((platform: string, raw: string) => {
    setChannels((current) => ({ ...current, [platform]: raw }));
  }, []);

  /* ---------------------------------------------------------------- */
  /* Runtime reconciliation                                           */
  /* ---------------------------------------------------------------- */

  /* Mirror the typed Twitch channel into runtime, so the pin gating rule can be
     evaluated. Keyed on `channels` rather than done in the change handler, so
     every path that sets a channel — typing, draft restore, Use connected
     channel — folds through the same rule. */
  useEffect(() => {
    const fromChannels = multichatTool.runtime?.fromChannels;
    if (!fromChannels) return;
    setRuntime((current) => {
      const next = fromChannels(current, channels as ToolChannels<MultichatPlatform>);
      /* Bail out when nothing changed, so this cannot loop. */
      return next === current ? current : next;
    });
  }, [channels]);

  /* A runtime change can invalidate a style choice — a selected pin platform
     whose capability just disappeared. The descriptor reconciles that in `sync`.
     An effect on `runtime` rather than logic in a handler, so connecting,
     disconnecting, and editing the channel until it stops matching are all
     covered by one rule and no ordering leaves a stale selection behind. */
  useEffect(() => {
    const sync = multichatTool.runtime?.sync;
    if (!sync) return;
    setChatStyle((current) => {
      const next = sync(current, runtime);
      return next === current ? current : multichatTool.normalize(next);
    });
  }, [runtime]);

  /* ---------------------------------------------------------------- */
  /* Draft persistence across OAuth                                   */
  /* ---------------------------------------------------------------- */

  /* Live state for the draft write. A ref rather than dependencies, so
     `persistDraft` keeps a stable identity — it is handed to the connection
     panel, and a new function on every keystroke would re-render it for nothing. */
  const live = useRef({
    chatStyle,
    counterStyle,
    channels,
    chatBgMode,
    chatBgColor,
    counterBgMode,
    counterBgColor,
  });
  live.current = {
    chatStyle,
    counterStyle,
    channels,
    chatBgMode,
    chatBgColor,
    counterBgMode,
    counterBgColor,
  };

  /* Both tools' drafts, written immediately before the OAuth navigation.
     Two keys, because the storage is keyed per tool and the two styles are
     different shapes — and because the Counter's settings must survive an OAuth
     round trip the chat side initiated, which is the whole reason this writes
     twice rather than once.

     The background is the mode's own value — a named id for the three fixed
     backdrops, the hex string itself for Custom — so a chosen colour survives
     the round trip too. Still preview-only: `background` is never read into a
     tool's style and never serialized into an overlay URL. */
  const persistDraft = useCallback(() => {
    const l = live.current;
    writeWorkspaceDraft(multichatTool.id, {
      style: l.chatStyle,
      channels: l.channels,
      background: effectivePreviewBackground(l.chatBgMode, l.chatBgColor),
    });
    writeWorkspaceDraft(counterTool.id, {
      style: l.counterStyle,
      channels: l.channels,
      background: effectivePreviewBackground(l.counterBgMode, l.counterBgColor),
    });
  }, []);

  /* Restore on mount, and only on mount. Each draft is consumed as it is read,
     so a second effect run — Strict Mode double-invokes in development — finds
     nothing and leaves whatever the user has since typed alone.

     Everything restored goes through a tool's own normalizer, so a hand-edited
     sessionStorage entry can produce defaults but not invalid state. */
  useEffect(() => {
    const chatDraft = consumeWorkspaceDraft(multichatTool.id);
    const counterDraft = consumeWorkspaceDraft(counterTool.id);

    if (chatDraft) {
      setChatStyle(multichatTool.normalize(chatDraft.style as Partial<MultichatWorkspaceStyle>));
      /* The backdrop is preview-only, so it is restored into its own state and
         never handed to the tool's normalizer. An unknown string falls back to
         Transparent rather than throwing — see previewBackgroundFromDraft. */
      const chatBg = previewBackgroundFromDraft(chatDraft.background);
      setChatBgMode(chatBg.mode);
      setChatBgColor(chatBg.customColor);
    }
    if (counterDraft) {
      setCounterStyle(counterTool.normalize(counterDraft.style as Partial<ViewerCounterStyle>));
      const counterBg = previewBackgroundFromDraft(counterDraft.background);
      setCounterBgMode(counterBg.mode);
      setCounterBgColor(counterBg.customColor);
    }

    /* Channels are shared, so they are restored from whichever draft has them —
       chat first, since that is the side that initiates OAuth. Keys are filtered
       to platforms this page actually has a field for, so a draft written by a
       different version cannot introduce a channel key that would then be
       serialized into an overlay URL. */
    const source = chatDraft ?? counterDraft;
    if (source) {
      const allowed = new Set<string>([
        ...multichatTool.platforms.map((p) => p.key),
        ...counterTool.platforms.map((p) => p.key),
      ]);
      const restored: ToolChannels<string> = {};
      for (const [key, value] of Object.entries(source.channels)) {
        if (allowed.has(key)) restored[key] = value;
      }
      setChannels(restored);
    }
  }, []);

  /* ---------------------------------------------------------------- */
  /* Derived URLs                                                     */
  /* ---------------------------------------------------------------- */

  /* Which pin options the descriptor currently considers unavailable.
     Recomputed from runtime, so an option can become available while the page is
     open — connecting an account does not need a reload. */
  const availability: CatalogAvailability = useMemo(
    () => (multichatTool.runtime?.optionAvailability?.(runtime) ?? {}) as CatalogAvailability,
    [runtime],
  );

  /* The descriptor's own serializer. Not a second implementation: this is the
     same call the retired workspace made and the same one the overlay parses, so
     a URL from this page is byte-identical for the same state. */
  const chatQuery = useMemo(
    () => multichatTool.serialize(channels as ToolChannels<MultichatPlatform>, chatStyle),
    [channels, chatStyle],
  );

  /* One string for the preview, the readonly field, Copy, and Open — so those
     four cannot disagree. The connection id enters only here, only as a fragment,
     and only when the descriptor's `context` says it is genuinely usable. */
  const chatUrl = useMemo(
    () =>
      buildOverlayUrl({
        baseUrl,
        route: multichatTool.overlayRoute,
        query: chatQuery,
        context: multichatTool.context?.(chatStyle, runtime),
      }),
    [baseUrl, chatQuery, chatStyle, runtime],
  );

  const counterQuery = useMemo(
    () => counterTool.serialize(channels as ToolChannels<ViewerPlatform>, counterStyle),
    [channels, counterStyle],
  );

  /* No context, so no fragment: the Counter never carries a connection id, and
     the serializer's own normalization is what keeps 'undefined' out of it. */
  const counterUrl = useMemo(
    () =>
      buildOverlayUrl({
        baseUrl,
        route: counterTool.overlayRoute,
        query: counterQuery,
      }),
    [baseUrl, counterQuery],
  );

  /* Each tool decides for itself what counts as configured — MultiChat accepts
     anything typed, the Counter validates against its own normalizer — so a name
     that is valid for chat but not for the counter shows one preview, not two. */
  const chatConfigured =
    multichatTool.configuredPlatforms(channels as ToolChannels<MultichatPlatform>).length > 0;
  const counterConfigured =
    counterTool.configuredPlatforms(channels as ToolChannels<ViewerPlatform>).length > 0;

  /* Whether the URL actually carries a connection fragment. Drives the warning
     beside Copy — the fragment is a live credential, so the user is told before
     they paste it anywhere other than their own OBS. */
  const chatHasFragment = chatUrl.includes('#');

  const copyChat = () => {
    void navigator.clipboard?.writeText(chatUrl);
    setCopiedChat(true);
    setTimeout(() => setCopiedChat(false), COPIED_MS);
  };

  const copyCounter = () => {
    void navigator.clipboard?.writeText(counterUrl);
    setCopiedCounter(true);
    setTimeout(() => setCopiedCounter(false), COPIED_MS);
  };

  /* The face the picker previews itself in, and each option in. Read from the
     overlay's own table, so the picker cannot advertise a family the overlay
     resolves differently. */
  const fontStack = FONT_FAMILIES[chatStyle.font];

  return (
    <>
      <Head>
        <title>multichat-gxufy | Kick · Twitch · YouTube · TikTok Chat Overlay</title>
        <meta
          name="description"
          content="Free multi-platform chat overlay for OBS by gxufy — Kick, Twitch, YouTube & TikTok in one browser source. 7TV/BTTV/FFZ emotes, real badges, name-paints, pins, and a live viewer counter. No login required."
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* dangerouslySetInnerHTML because React would escape `&` and `'`, and a
            <style> element does not decode entities — escaped, the sheet's
            `&family=` separators would collapse to a single family. */}
        <style dangerouslySetInnerHTML={{ __html: GENERATOR_FONT_CSS }} />
        <style
          dangerouslySetInnerHTML={{
            __html:
              '@font-face{font-family:Alsina;src:url(https://chatis.is2511.com/v2/styles/Alsina_Ultrajada.ttf);}',
          }}
        />
      </Head>

      <style dangerouslySetInnerHTML={{ __html: CLASSIC_GENERATOR_CSS }} />

      {/* Skip link: the header and four channel fields come before the settings,
          so a keyboard or screen-reader user otherwise tabs through all of it. */}
      <a href="#generator-main" className="skip-link">
        Skip to the generator
      </a>

      <div className="page">
        {classicHeader()}

        <main id="generator-main" tabIndex={-1}>
          {/* The page's only h1. Visually hidden: the branded wordmark above is
              the visual title, but a screen reader needs one heading that says
              what this page is before the section headings under it. */}
          <h1 className="sr-only">
            multichat-gxufy — chat overlay and viewer counter generator for OBS
          </h1>

          {/* Called as functions, not rendered as <Component /> elements. A
              component declared inside this body is a new type on every render,
              which would unmount and remount its whole subtree on every
              keystroke — losing focus in the field being typed into. Calling
              them just splices their JSX into this tree. */}
          {channelCard()}

          {/* One grid, six children, named areas. DOM order is the mobile order —
              chat output, chat settings, counter output, counter settings, then
              the two full-width cards — so the phone stack is this tree unchanged
              and no control is duplicated per breakpoint.

              Desktop places them into:
                "chat-output    counter-output"
                "chat-settings  counter-settings"
                "commands       commands"
                "obs            obs"
              so the two previews stay aligned beside each other and each settings
              card sits directly beneath the output it belongs to. Grid placement
              only — the reading and tab order is always the DOM order above. */}
          <div className="tool-grid">
            {chatOutputPanel()}
            {chatSettingsPanel()}
            {counterOutputPanel()}
            {counterSettingsPanel()}
            {commandsCard()}
            {obsSetupCard()}
          </div>
        </main>
      </div>

      {classicFooter()}
    </>
  );

  /* ---------------------------------------------------------------- */
  /* Sections                                                         */
  /* ---------------------------------------------------------------- */

  function classicHeader() {
    return (
      /* The original compact strip: logo, wordmark, tagline, platform chips. */
      <header className="header-strip">
        <Link href="/" className="home-link" title="Back to homepage">
          ← Home
        </Link>
        <Link href="/" aria-label="multichat-gxufy home">
          <img src="/tpl.webp" alt="" className="header-logo" />
        </Link>
        <div className="header-copy">
          <p className="header-title">multichat-gxufy</p>
          <p className="header-sub">Every chat. One overlay. No login.</p>
          <div className="platform-row">
            <span className="platform-chip kick-tag">Kick</span>
            <span className="platform-chip tw-tag">Twitch</span>
            <span className="platform-chip yt-tag">YouTube</span>
            <span className="platform-chip tt-tag">TikTok</span>
          </div>
        </div>
      </header>
    );
  }

  /** The shared platform inputs, plus the inline Twitch connection. */
  function channelCard() {
    return (
      <section className="card hero" aria-labelledby="channels-heading">
        <h2 id="channels-heading" className="section-title">
          Your channels
        </h2>

        <div className="platform-inputs">
          {multichatTool.platforms.map((platform) => {
            const inputId = `channel-${platform.key}`;
            return (
              <div className="platform-input" key={platform.key}>
                <label
                  htmlFor={inputId}
                  className={`platform-tag ${PLATFORM_TAG[platform.key] ?? ''}`}
                >
                  {platform.label}
                </label>
                <input
                  id={inputId}
                  type="text"
                  name={platform.key}
                  placeholder={platform.placeholder}
                  value={channels[platform.key] ?? ''}
                  onChange={(e) => changeChannel(platform.key, e.target.value)}
                />
                {/* Only Twitch has a connection: it is the one platform whose
                    native pins need authorization. */}
                {platform.key === 'twitch' ? (
                  <ClassicTwitchConnect
                    runtime={runtime}
                    onRuntimeChange={setRuntime}
                    onUseConnectedChannel={(login) => changeChannel('twitch', login)}
                    onBeforeLeave={persistDraft}
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        <p className="platform-hint">
          Fill in any one — or combine platforms into a single overlay. These
          channels feed both the chat overlay and the viewer counter. No login
          needed.
        </p>
      </section>
    );
  }

  /** Chat preview, generated URL, Copy, Open. */
  function chatOutputPanel() {
    return (
      <section
        className="card panel-chat-output"
        aria-labelledby="chat-output-heading"
      >
        <h2 id="chat-output-heading" className="section-title">
          Chat overlay
        </h2>

        <div className="preview-label">
          <span>Preview</span>
          {/* Says what is on screen, for anyone who can see it — the preview's own
              aria-label says the same thing to a screen reader. Without this the
              samples read as somebody's real chat, and a visitor could reasonably
              wonder whose. Unobtrusive by design: it is a marker, not a warning. */}
          {!chatConfigured && <span className="preview-badge">Preview data</span>}
        </div>

        {/* The backdrop is on the wrapper, never inside the overlay document and
            never in the URL: it exists to eyeball transparency, and it cannot
            reach OBS. The overlay's own bgColor, when set, wins — the surface then
            shows what OBS will actually paint rather than a backdrop behind it. */}
        <div
          className={`preview-surface ${previewSurfaceClass(chatBgMode)}`}
          style={
            chatStyle.bgColor
              ? { background: chatStyle.bgColor }
              : chatBgMode === 'custom'
                ? { background: chatBgColor }
                : undefined
          }
        >
          {chatConfigured ? (
            /* The real overlay at the exact URL below, so the preview and the
               copied URL cannot disagree. No iframe exists until a channel is
               configured, so nothing connects or polls before then. */
            <OverlayPreviewFrame
              url={chatUrl}
              configured={chatConfigured}
              title="Live chat overlay preview"
              height={MULTICHAT_OBS_SIZE.height}
            />
          ) : (
            /* No channel yet, so there is no live overlay to show — and an empty
               frame says nothing about styling, which is the whole reason someone
               is on this page. Fixtures go through the production renderer
               instead, so all twenty-four settings are visible immediately. The
               frame here is a local blank document, not the overlay URL, so
               nothing connects, polls, or authenticates. */
            <ClassicChatPreview
              query={chatQuery}
              messages={previewMessages}
              width={MULTICHAT_OBS_SIZE.width}
              height={MULTICHAT_OBS_SIZE.height}
              /* Not part of `chatQuery`, and that is the whole point: the zoom
                 reaches the frame while the renderer's config comes only from
                 the serialized URL above. */
              scale={previewScale}
            />
          )}
        </div>

        {/* Offered whether or not a channel is configured: the backdrop sits
            behind the live overlay iframe just as it does behind the fixtures, so
            judging transparency against a scene colour is useful in both states. */}
        <ClassicPreviewBackgroundControl
          idPrefix="chat"
          legend="Preview background"
          mode={chatBgMode}
          customColor={chatBgColor}
          onModeChange={setChatBgMode}
          onCustomColorChange={setChatBgColor}
        />

        {/* Paired with the fixture preview, because it composes lines *for* that
            preview. With a channel configured the panel above is the real overlay
            showing real chat, and a composed message would have nowhere to
            appear — a control that visibly did nothing would be worse than no
            control. */}
        {!chatConfigured && (
          <ClassicPreviewFeedControls
            enabled={feed.enabled}
            paused={feed.paused}
            speed={feed.speed}
            running={feed.running}
            messageCount={feed.messages.length}
            onEnabledChange={feed.setEnabled}
            onTogglePaused={feed.togglePaused}
            onSpeedChange={feed.setSpeed}
            onReset={feed.reset}
            statusDetail={`${enabledSourceCount} of ${PREVIEW_SOURCES.length} fixture sources on.`}
          >
            <ClassicPreviewBadgePicker
              sources={feed.sources}
              onToggleSource={feed.toggleSource}
              onEnableAll={feed.enableAllSources}
              onDisableAll={feed.disableAllSources}
              onRandomize={feed.randomizeSources}
              onReset={feed.resetSources}
            />
            {/* The badge library sits beside the source picker, never inside it:
                the picker's fieldset owns the fixture-source chips and its own
                live region, and folding a second control into it would break the
                one-status-line contract that suite asserts. This is a browse-only
                gallery — it composes no message and reaches no URL. */}
            <ClassicPreviewBadgeLibrary library={badgeLibrary} />
            {/* Reset lives inside the control, which already returns to the
                default through this same setter — a second path would be one
                more thing to keep in agreement. */}
            <ClassicPreviewScaleControl
              scale={previewScale}
              onScaleChange={setPreviewScale}
            />
          </ClassicPreviewFeedControls>
        )}

        {!chatConfigured && (
          <ClassicPreviewComposer
            onAdd={addCustomMessage}
            onReset={resetPreviewMessages}
            onClear={clearCustomMessages}
            customCount={customMessages.length}
          />
        )}

        <p className="card-note">{multichatTool.previewNote}</p>

        <div className="url-box">
          <div className="url-code" aria-label="Generated MultiChat overlay URL">
            {chatUrl}
          </div>
          {/* Both actions in one group, so a URL that wraps to three lines makes
              the field taller and leaves the buttons their own height. */}
          <div className="url-actions">
            <button
              type="button"
              onClick={copyChat}
              className={`url-copy${copiedChat ? ' ok' : ''}`}
            >
              {copiedChat ? '✓ Copied' : 'Copy'}
            </button>
            <a
              className="url-open"
              href={chatUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open
            </a>
          </div>
          {/* Announced, not just shown: the URL gains a fragment while the page
              is open, and the fragment is a live credential. */}
          <p className="url-warn" role="status">
            {chatHasFragment
              ? 'This URL ends in a private connection key for your Twitch pins. Paste it into your own OBS only — do not share it or post it publicly.'
              : ''}
          </p>
        </div>
        {/* Copy status, for assistive tech — the button's own label change is
            visual only. */}
        <p className="sr-only" role="status">
          {copiedChat ? 'MultiChat overlay URL copied to the clipboard.' : ''}
        </p>
      </section>
    );
  }

  /** Counter preview, generated URL, Copy, Open. */
  function counterOutputPanel() {
    return (
      <section
        className="card panel-counter-output"
        id={COUNTER_SECTION_ID}
        aria-labelledby="counter-output-heading"
      >
        <h2 id="counter-output-heading" className="section-title">
          Viewer counter
        </h2>

        <div className="preview-label">
          <span>Preview</span>
          {/* The same marker the chat preview carries, for the same reason: four
              plausible numbers with nothing saying otherwise read as a real
              audience. */}
          {!counterConfigured && <span className="preview-badge">Preview data</span>}
        </div>

        <div
          className={`preview-surface ${previewSurfaceClass(counterBgMode)}`}
          style={
            counterBgMode === 'custom' ? { background: counterBgColor } : undefined
          }
        >
          {counterConfigured ? (
            <OverlayPreviewFrame
              url={counterUrl}
              configured={counterConfigured}
              title="Live viewer counter preview"
              height={counterTool.obs.height}
            />
          ) : (
            /* No channel yet, so there is no live counter to show — and a frame
               holding nothing, or only dashes, says nothing about how the six
               settings look. Sample counts go through the production renderer
               instead. The frame here is a local blank document, not the overlay
               URL, so nothing fetches /api/viewers and nothing polls. */
            <ClassicCounterPreview
              query={counterQuery}
              statuses={counterStatuses}
              width={counterTool.obs.width}
              height={counterTool.obs.height}
            />
          )}
        </div>

        {/* Offered in both states for the same reason as the chat backdrop: the
            colour sits behind the live counter iframe just as it does behind the
            sample counts. */}
        <ClassicPreviewBackgroundControl
          idPrefix="counter"
          legend="Preview background"
          mode={counterBgMode}
          customColor={counterBgColor}
          onModeChange={setCounterBgMode}
          onCustomColorChange={setCounterBgColor}
        />

        {/* Paired with the fixture preview, because this is what feeds it. With a
            channel configured the panel above is the real overlay showing real
            numbers, and simulating a count would have nowhere to appear. */}
        {!counterConfigured && (
          <ClassicCounterFeedControls
            enabled={counterSim.enabled}
            paused={counterSim.paused}
            speed={counterSim.speed}
            mode={counterSim.mode}
            running={counterSim.running}
            seenCount={counterSim.seenCount}
            combinationLabel={
              counterSim.combination === null
                ? ''
                : combinationLabel(counterSim.combination, COUNTER_PLATFORM_LABEL)
            }
            counts={sampleCounts}
            platformLabel={COUNTER_PLATFORM_LABEL}
            onEnabledChange={counterSim.setEnabled}
            onTogglePaused={counterSim.togglePaused}
            onSpeedChange={counterSim.setSpeed}
            onAdvance={counterSim.advance}
            onRestore={counterSim.restore}
            onCountChange={setSampleCount}
            onRestoreCounts={restoreSampleCounts}
          />
        )}

        <p className="card-note">{counterTool.previewNote}</p>

        <div className="url-box">
          <div className="url-code" aria-label="Generated viewer counter URL">
            {counterUrl}
          </div>
          {/* The same output row as the chat panel, class for class. */}
          <div className="url-actions">
            <button
              type="button"
              onClick={copyCounter}
              className={`url-copy${copiedCounter ? ' ok' : ''}`}
            >
              {copiedCounter ? '✓ Copied' : 'Copy'}
            </button>
            <a
              className="url-open"
              href={counterUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open
            </a>
          </div>
        </div>
        <p className="sr-only" role="status">
          {copiedCounter ? 'Viewer counter URL copied to the clipboard.' : ''}
        </p>
      </section>
    );
  }

  /** All 24 MultiChat settings, in the Classic multi-column arrangement. */
  function chatSettingsPanel() {
    const chat = (
      setting: Parameters<typeof ClassicSetting<MultichatWorkspaceStyle>>[0]['setting'],
      extra?: {
        optionStyle?: (v: string) => React.CSSProperties | undefined;
        controlStyle?: React.CSSProperties;
        segmented?: boolean;
        range?: SettingRange;
      },
    ) => (
      <ClassicSetting
        key={setting.key}
        setting={setting}
        value={chatStyle[setting.key] as SettingValue}
        onChange={changeChat}
        availability={availability[setting.key]}
        idPrefix="mc"
        optionStyle={extra?.optionStyle}
        controlStyle={extra?.controlStyle}
        segmented={extra?.segmented}
        range={extra?.range}
      />
    );

    return (
      <section
        className="card panel-chat-settings"
        aria-labelledby="chat-settings-heading"
      >
        <h2 id="chat-settings-heading" className="section-title">
          Chat settings
        </h2>

        {/* Two columns once the settings half is wide enough for them, one below
            that — grid tracks over one unchanged tree, so reading and tab order
            follow this DOM order at every width and no control exists twice.
            Two rather than three: this panel is one column of the grid rather
            than the page's full width, and a third track put two words per line
            on the longer labels. */}
        <div className="form_table cols-2">
          {/* How it is drawn. */}
          <div className="form_col">
            <p className="col-heading">Text</p>
            {chat(MC_TEXT_SIZE, { segmented: true })}
            {/* Each option in the face it names, and the closed control in the
                selected one — the reason this page loads every overlay family.
                Twelve faces, so this stays a dropdown: as pills it would be four
                rows of unreadably small type. */}
            {chat(MC_FONT, {
              controlStyle: fontStack ? { fontFamily: fontStack } : undefined,
              optionStyle: (v) =>
                FONT_FAMILIES[v] ? { fontFamily: FONT_FAMILIES[v] } : undefined,
            })}
            {chat(MC_STROKE, { segmented: true })}
            {chat(MC_TEXT_SHADOW, { segmented: true })}
            {chat(MC_FONT_COLOR)}
            {chat(MC_BG_COLOR)}
          </div>

          {/* How it moves and marks. */}
          <div className="form_col">
            <p className="col-heading">Appearance</p>
            {chat(MC_ANIMATION, { segmented: true })}
            {chat(MC_SOURCE_TAG, { segmented: true })}
            {chat(MC_EMOTE_SCALE, { range: EMOTE_SCALE_RANGE })}
            {chat(MC_FADE_ENABLED)}
            {/* Only meaningful while fading is on, so it is only rendered then —
                the toggle's own description states that emission depends on it. */}
            {chatStyle.fadeEnabled ? chat(MC_FADE, { range: FADE_RANGE }) : null}
          </div>

          {/* What it shows. */}
          <div className="form_col">
            <p className="col-heading">Behaviour</p>
            {chat(MC_SEVENTV_EMOTES)}
            {chat(MC_SEVENTV_COSMETICS)}
            {chat(MC_PAINT_SHADOWS)}
            {chat(MC_MSG_BOLD)}
            {chat(MC_MSG_CAPS)}
            {chat(MC_HIDE_NAMES)}
            {chat(MC_MENTION_COLOR)}
            {chat(MC_MOD_ACTION)}
            {chat(MC_SHOW_PIN)}
            {chatStyle.showPinEnabled ? chat(MC_PIN_PLATFORMS) : null}
          </div>
        </div>

        {/* Filters: three free-text lists, each needing the width of a line, so
            they take the same two tracks rather than three narrow ones. */}
        <div className="form_table cols-2">
          <div className="form_col">
            <p className="col-heading">Filters</p>
            {chat(MC_BOT_NAMES)}
            {chat(MC_PREFIX_BL)}
          </div>
          <div className="form_col">
            <p className="col-heading" aria-hidden="true">
              &nbsp;
            </p>
            {chat(MC_USER_BL)}
          </div>
        </div>
      </section>
    );
  }

  /** All six Viewer Counter settings. */
  function counterSettingsPanel() {
    const vc = (
      setting: Parameters<typeof ClassicSetting<ViewerCounterStyle>>[0]['setting'],
      extra?: { segmented?: boolean },
    ) => (
      <ClassicSetting
        key={setting.key}
        setting={setting}
        value={counterStyle[setting.key] as SettingValue}
        onChange={changeCounter}
        idPrefix="vc"
        segmented={extra?.segmented}
      />
    );

    return (
      <section
        className="card panel-counter-settings"
        aria-labelledby="counter-settings-heading"
      >
        <h2 id="counter-settings-heading" className="section-title">
          Counter settings
        </h2>

        <div className="form_table cols-2">
          <div className="form_col">
            <p className="col-heading">Layout</p>
            {vc(VC_ALIGN, { segmented: true })}
            {vc(VC_TEXT_SHADOW, { segmented: true })}
            {vc(VC_STROKE, { segmented: true })}
          </div>
          <div className="form_col">
            <p className="col-heading">Display</p>
            {vc(VC_COMBINED)}
            {vc(VC_ICONS)}
            {vc(VC_BG)}
          </div>
        </div>

        <p className="card-note">
          The counter has its own fixed typography and never follows the chat
          font, size, shadow, or outline — restyling chat cannot change a counter
          URL you have already put in OBS.
        </p>
      </section>
    );
  }

  /** Commands, from the parser's own metadata. */
  function commandsCard() {
    return (
      <section className="card panel-commands" aria-labelledby="commands-heading">
        <h2 id="commands-heading" className="section-title">
          Commands &amp; help
        </h2>

        {/* Rows come from MULTICHAT_COMMANDS, which is derived from the parser's
            own command metadata — so this table cannot document a command the
            overlay does not implement. */}
        <div className="cmd-table-wrap">
          <table className="cmd-table">
            <caption className="sr-only">
              Chat commands the MultiChat overlay implements
            </caption>
            <thead>
              <tr>
                <th scope="col">Command</th>
                <th scope="col">What it does</th>
                <th scope="col">Who can use it</th>
              </tr>
            </thead>
            <tbody>
              {MULTICHAT_COMMANDS.map((command) => (
                <tr key={command.name}>
                  <td>{command.syntax}</td>
                  <td>
                    {command.detail
                      ? `${command.summary} ${command.detail}`
                      : command.summary}
                  </td>
                  <td>Moderators and the broadcaster</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="card-note">
          Type these in any connected platform&rsquo;s chat — they act on the
          overlay itself, so they work from Kick, Twitch, YouTube, or TikTok.
          The overlay ignores them from everyone else.{' '}
          <code>{MULTICHAT_COMMAND_ALIAS}</code> works as an alias for{' '}
          <code>{MULTICHAT_COMMAND_TRIGGER}</code> everywhere above. These
          commands apply to the chat overlay only; the viewer counter has none.
        </p>
      </section>
    );
  }

  /** OBS setup, for two independent browser sources. */
  function obsSetupCard() {
    return (
      <section className="card panel-obs" aria-labelledby="obs-heading">
        <h2 id="obs-heading" className="section-title">
          OBS setup
        </h2>

        <p className="card-note" style={{ margin: '0 0 14px' }}>
          The chat overlay and the viewer counter are two separate browser
          sources with two different URLs. Add whichever you want — neither needs
          the other, and they can go in different scenes, at different sizes, or
          only one at a time.
        </p>

        {/* Two independent procedures, so they sit side by side on a wide screen
            rather than stacking into twice the height. */}
        <div className="setup-cols">
        <div>
        <p className="setup-sub">Chat overlay</p>
        <ol className="steps">
          <li>
            Copy the <strong>chat overlay URL</strong> above.
          </li>
          <li>
            In OBS: <strong>Add Source → Browser</strong>, then paste it into{' '}
            <strong>URL</strong>.
          </li>
          <li>
            Size it{' '}
            <strong>
              {MULTICHAT_OBS_SIZE.width} × {MULTICHAT_OBS_SIZE.height}
            </strong>
            . {MULTICHAT_OBS_ALTERNATE.width} × {MULTICHAT_OBS_ALTERNATE.height}{' '}
            is a wider, shorter alternative that shows fewer messages.
          </li>
          <li>
            Leave <strong>Shutdown source when not visible</strong> off — the
            overlay reconnects on load, so toggling it drops recent messages.
          </li>
        </ol>
        </div>

        <div>
        <p className="setup-sub">Viewer counter</p>
        <ol className="steps">
          <li>
            Copy the <strong>viewer counter URL</strong> above — it is a
            different URL, not a setting on the overlay.
          </li>
          <li>
            Add a <strong>second Browser source</strong> and paste it in.
          </li>
          <li>
            Size it{' '}
            <strong>
              {counterTool.obs.width} × {counterTool.obs.height}
            </strong>
            .
          </li>
        </ol>
        </div>
        </div>

        <p className="card-note">
          Both backgrounds are already transparent, so no custom CSS is needed.
          The preview background buttons on this page only change this page —
          they are never part of either URL and never reach OBS.
        </p>
      </section>
    );
  }

  function classicFooter() {
    return (
      <footer>
        <p>
          multichat-gxufy with 🕊️ —{' '}
          <a href="https://guns.lol/gxufy" target="_blank" rel="noreferrer">
            https://guns.lol/gxufy
          </a>
        </p>
        <p>
          Not affiliated with{' '}
          <a href="https://kick.com" target="_blank" rel="noreferrer">
            Kick
          </a>
          ,{' '}
          <a href="https://twitch.tv" target="_blank" rel="noreferrer">
            Twitch
          </a>
          ,{' '}
          <a href="https://youtube.com" target="_blank" rel="noreferrer">
            YouTube
          </a>
          , or{' '}
          <a href="https://tiktok.com" target="_blank" rel="noreferrer">
            TikTok
          </a>
        </p>
      </footer>
    );
  }
}
