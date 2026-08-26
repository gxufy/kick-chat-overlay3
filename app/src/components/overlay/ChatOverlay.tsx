import { Fragment, memo, useEffect, useMemo, useRef, useState } from 'react';


import Head from 'next/head';
import type { MultichatConfig } from '../../lib/multichatConfig';
import type { ParsedMessage } from '../../lib/kick';
import { sourceTag, PROVIDERS, type SourceTagMode } from '../../lib/render';
import type { Platform } from '../../lib/types';
import type { TwitchHypeTrainState } from '../../lib/twitchHypeTrainClient';
import { LOCAL_OVERLAY_FONT_CSS, overlayFontCss } from '../../lib/overlayFonts';

export interface PinnedState {
  msg: ParsedMessage;
  pinnedBy?: string;
}

export type StartupLoaderPhase = 'hidden' | 'visible' | 'fading';

interface Props {
  config: MultichatConfig;
  messages: ParsedMessage[];
  fadingIds: Set<string>;
  pinnedMessage: PinnedState | null;
  /** Boolean remains accepted for renderer fixtures; production passes a phase. */
  showLoader: boolean | StartupLoaderPhase;
  /**
   * Whether `sourceTag=` was actually present in the URL.
   *
   * The parser defaults the field to 'icon', so the config alone cannot tell an
   * explicit `sourceTag=icon` from an omitted parameter. Only the raw query can,
   * and the distinction matters: an omitted parameter shows the shared icon for
   * YouTube and no marker for the other single-platform overlays, while an explicit
   * value is always honoured. Defaults to false so existing callers are unaffected.
   */
  sourceTagExplicit?: boolean;
  /** Preview-only override; production callers leave this absent. */
  sourceTagOverride?: SourceTagMode;
  hypeTrain?: TwitchHypeTrainState | null;
  hypeTrainEnding?: boolean;
  /** Runtime Shared Chat state; omitted callers use config.sharedChatEnabled. */
  sharedChatEnabled?: boolean;
}

/**
 * `font=` value → CSS `font-family`, the overlay's own resolution.
 *
 * Exported because the generator's font picker previews each option in the face
 * it names, and it must name the same faces the overlay will actually draw. It
 * previously kept a third copy of this table, so a family could be renamed here
 * and the picker would go on previewing the old one.
 */
export const FONT_FAMILIES: Record<string, string> = {
  default:     "'Open Sans', Arial, system-ui, sans-serif",
  geist:       "Geist, system-ui, sans-serif",
  baloo:       "'Baloo Tammudu 2', cursive",
  segoe:       "'Segoe UI', sans-serif",
  roboto:      "'Roboto', sans-serif",
  lato:        "'Lato', sans-serif",
  noto:        "'Noto Sans JP', sans-serif",
  sourcecode:  "'Source Code Pro', monospace",
  impact:      "'Impact', sans-serif",
  comfortaa:   "'Comfortaa', cursive",
  dancing:     "'Dancing Script', cursive",
  indieflower: "'Indie Flower', cursive",
  opensans:    "'Open Sans', Arial, system-ui, sans-serif",
  alsina:      "'Alsina', cursive",
};


const SIZE = {
  small: {
    fontSize:'20px', lineHeight:'30px',
    badgeW:'16px', badgeH:'16px', badgeMR:'2px', badgeMB:'3px', badgeLastMR:'3px',
    colonMR:'8px',
    emoteMaxW:'75px', emoteMaxH:'25px', emoteMR:'-3px',
    upscaleH:'25px', emojiH:'22px',
  },
  medium: {
    fontSize:'34px', lineHeight:'55px',
    badgeW:'28px', badgeH:'28px', badgeMR:'4px', badgeMB:'6px', badgeLastMR:'6px',
    colonMR:'14px',
    emoteMaxW:'128px', emoteMaxH:'42px', emoteMR:'-6px',
    upscaleH:'42px', emojiH:'39px',
  },
  large: {
    fontSize:'48px', lineHeight:'75px',
    badgeW:'40px', badgeH:'40px', badgeMR:'5px', badgeMB:'8px', badgeLastMR:'8px',
    colonMR:'20px',
    emoteMaxW:'180px', emoteMaxH:'60px', emoteMR:'-8px',
    upscaleH:'60px', emojiH:'55px',
  },
} as const;
type SzKey = keyof typeof SIZE;


function getShadowFilter(s: string) {
  if (s === 'small')  return '2px 2px 0.2rem black';
  if (s === 'medium') return '2px 2px 0.35rem black';
  if (s === 'large')  return '2px 2px 0.5rem black';
  return '';
}


function getStroke(s: string) {
  const m: Record<string,string> = { thin:'1px black', medium:'2px black', thick:'3px black', thicker:'4px black' };
  return m[s] ?? '';
}


function SlideGroup({ children }: { children: React.ReactNode }) {
  /* CSS grid can interpolate 0fr -> 1fr against intrinsic content height.
     That gives the same 150ms empty-space opening before content is revealed,
     without mounting an offscreen copy, forcing getBoundingClientRect(), or
     coordinating React state with animation frames. The batch node stays
     mounted, so a late repaint/deletion cannot replay the entrance. */
  return (
    <div className="gx-slide-group">
      <div className="gx-slide-content">{children}</div>
    </div>
  );
}

function FadeGroup({ children }: { children: React.ReactNode }) {
  /* Pure CSS keeps the 220ms fade while removing two requestAnimationFrame
     callbacks and a React state update for every arriving batch. */
  return <div className="gx-fade-group">{children}</div>;
}

const MessageRow = memo(function MessageRow({
  msg, fading, msgSlideIn, smoothRuntime, shadowVal, sz, emoteMaxH, emoteMaxW,
  strokeVal, hideNames, tagMode, showAvatar, showSharedSource,
}: {
  msg: ParsedMessage; fading: boolean; msgSlideIn: boolean; smoothRuntime: boolean; shadowVal: string;
  sz: typeof SIZE[SzKey]; emoteMaxH: string; emoteMaxW: string; strokeVal: string;
  hideNames: boolean; tagMode: SourceTagMode; showAvatar: boolean; showSharedSource: boolean;
}) {
  return (
    <div className={msgSlideIn ? 'gx-message-slide-in' : undefined} style={{
      margin: '0 10px',
      opacity: fading ? 0 : 1,
      transition: fading ? 'opacity 400ms linear' : 'none',
      ...(smoothRuntime && shadowVal ? { textShadow: shadowVal } : {}),
    }}>
      <MsgLine msg={msg} sz={sz} emoteMaxH={emoteMaxH} emoteMaxW={emoteMaxW}
        stroke={strokeVal} hideNames={hideNames}
        tagMode={tagMode} showAvatar={showAvatar} showSharedSource={showSharedSource} />
    </div>
  );
});

export default function ChatOverlay({ config, messages, fadingIds, pinnedMessage, showLoader, sourceTagExplicit = false, sourceTagOverride, hypeTrain, hypeTrainEnding = false, sharedChatEnabled }: Props) {
  /* Fully typed by MultichatConfig — the schema already declares every field
     read below, so no intersection or cast is needed. */
  const cfg = config;
  const showSharedSource = sharedChatEnabled ?? cfg.sharedChatEnabled;

  const szKey      = (cfg.textSize in SIZE ? cfg.textSize : 'medium') as SzKey;
  const sz         = SIZE[szKey];
  const filterVal  = getShadowFilter(cfg.textShadow);
  const strokeVal  = getStroke(cfg.stroke ?? 'none');
  const fontFamily = FONT_FAMILIES[cfg.font ?? 'opensans'] ?? FONT_FAMILIES.opensans;
  /* Naming a family does not load it. Only the selected face is requested, and
     system faces and the self-hosted Alsina yield null — see lib/overlayFonts. */
  const fontCss    = overlayFontCss(cfg.font);
  
  const smoothRuntime = cfg.smoothScroll && cfg.animation !== 'slide';
  const loaderPhase: StartupLoaderPhase = showLoader === true
    ? 'visible'
    : showLoader === false
      ? 'hidden'
      : showLoader;
  const emoteScale = cfg.emoteScale ?? 1;
  const emoteMaxH  = `${parseFloat(sz.emoteMaxH) * emoteScale}px`;
  const emoteMaxW  = `${parseFloat(sz.emoteMaxW) * emoteScale}px`;
  /* Source tag mode.
     An explicit sourceTag= always wins, for one platform or four. With no
     parameter, multi-platform and YouTube-only overlays show icons; the other
     single-platform overlays retain their existing marker-free appearance.

     The bug this replaces ignored cfg.sourceTag entirely whenever fewer than two
     platforms were configured, so dot, label, and icon were all unreachable from
     a one-platform URL and every value rendered identically. */
  const configuredPlatforms = [cfg.kick || cfg.channel, cfg.twitch, cfg.youtube, cfg.tiktok].filter(Boolean);
  const multiPlatform = configuredPlatforms.length > 1;
  const youtubeOnly = Boolean(cfg.youtube) && configuredPlatforms.length === 1;
  const tagMode: SourceTagMode = sourceTagOverride ?? (sourceTagExplicit
    ? cfg.sourceTag
    : (multiPlatform || youtubeOnly ? 'icon' : 'none'));

  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!smoothRuntime) return;
    const el = chatContainerRef.current;
    if (!el || typeof MutationObserver === 'undefined') return;
    let raf = 0;
    let lastScrollAt = 0;
    const scrollNewestIntoView = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const now = Date.now();
        const burst = now - lastScrollAt < 100;
        lastScrollAt = now;
        try {
          el.scrollTo({ top: el.scrollHeight, behavior: burst ? 'auto' : 'smooth' });
        } catch {
          el.scrollTop = el.scrollHeight;
        }
      });
    };
    const observer = new MutationObserver(scrollNewestIntoView);
    observer.observe(el, { childList: true });
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [smoothRuntime]);

  
  const seqRef = useRef(0);
  /* Batches retain only membership. Their current ParsedMessage values come from
     `messagesById`, so late badge/paint/emote data repaints an existing row without
     creating another batch or replaying its entrance animation. */
  const [batches, setBatches] = useState<{ id: number; messageIds: string[] }[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const messagesById = useMemo(
    () => new Map(messages.map((message) => [message.id, message])),
    [messages],
  );

  useEffect(() => {
    const newMessageIds = messages
      .filter((message) => !seenIdsRef.current.has(message.id))
      .map((message) => message.id);
    newMessageIds.forEach((id) => seenIdsRef.current.add(id));
    if (seenIdsRef.current.size > 500) {
      seenIdsRef.current = new Set(messages.map((message) => message.id));
    }
    if (!newMessageIds.length) return;
    const id = ++seqRef.current;
    setBatches((previous) => {
      const next = [...previous, { id, messageIds: newMessageIds }];
      let total = next.reduce((sum, batch) => sum + batch.messageIds.length, 0);
      while (total > 100 && next.length) {
        total -= next[0].messageIds.length;
        next.shift();
      }
      return next;
    });
  }, [messages]);

  /* Sync deletions while preserving batch identity for every surviving row.
     Returning the previous array when membership is unchanged avoids a redundant
     full ChatOverlay render for every ordinary message arrival. */
  useEffect(() => {
    const ids = new Set(messages.map((message) => message.id));
    setBatches((previous) => {
      let changed = false;
      const next: typeof previous = [];
      for (const batch of previous) {
        const messageIds = batch.messageIds.filter((id) => ids.has(id));
        if (messageIds.length === batch.messageIds.length) {
          next.push(batch);
          continue;
        }
        changed = true;
        if (messageIds.length) next.push({ ...batch, messageIds });
      }
      return changed ? next : previous;
    });
  }, [messages]);

  const renderMsg = (msg: ParsedMessage) => (
    <MessageRow key={msg.id}
      msg={msg}
      fading={fadingIds.has(msg.id)}
      msgSlideIn={cfg.msgSlideIn ?? false}
      smoothRuntime={smoothRuntime}
      shadowVal={filterVal}
      sz={sz}
      emoteMaxH={emoteMaxH}
      emoteMaxW={emoteMaxW}
      strokeVal={strokeVal}
      hideNames={cfg.hideNames ?? false}
      tagMode={tagMode}
      showAvatar={cfg.showAvatars ?? false}
      showSharedSource={showSharedSource}
    />
  );

  /* Visual configuration is static between settings changes. Memoizing this
     prevents message traffic from reconstructing the same large CSS string. */
  const overlayCss = useMemo(() => `${LOCAL_OVERLAY_FONT_CSS}
          
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            height: 100vh !important;
            position: relative !important;
            background: ${cfg.bgColor || 'transparent'} !important;
          }
          
          #__next {
            position: static !important;
            height: 0 !important;
            overflow: visible !important;
          }
          ${cfg.font==='alsina' ? `@font-face { font-family:Alsina; src:url(https://chatis.is2511.com/v2/styles/Alsina_Ultrajada.ttf); }` : ''}

          
          @keyframes gxMessageSlideIn {
            from { opacity: 0; transform: translate3d(40px, 0, 0); }
            to   { opacity: 1; transform: translate3d(0, 0, 0); }
          }
          .gx-message-slide-in {
            animation: gxMessageSlideIn 250ms ease-out;
            backface-visibility: hidden;
          }

          @keyframes gxSlideGroupOpen {
            from { grid-template-rows: 0fr; }
            to   { grid-template-rows: 1fr; }
          }
          @keyframes gxSlideGroupReveal {
            from { visibility: hidden; }
            to   { visibility: visible; }
          }
          .gx-slide-group {
            display: grid;
            grid-template-rows: 0fr;
            animation: gxSlideGroupOpen 150ms ease-in-out forwards;
          }
          .gx-slide-content {
            min-height: 0;
            overflow: hidden;
            visibility: hidden;
            animation: gxSlideGroupReveal 150ms step-end forwards;
          }
          .gx-slide-group .gx-message-slide-in {
            /* The measured ghost used to remount the visible row after 150ms,
               so preserve that exact visible start time without ghost DOM. */
            animation-delay: 150ms;
          }
          @keyframes gxFadeGroupIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          .gx-fade-group {
            animation: gxFadeGroupIn 220ms ease-in-out;
          }
          @media (prefers-reduced-motion: reduce) {
            .gx-message-slide-in { animation: none; }
          }

          
          .ck-bw {
            display:        inline-flex;
            align-items:    center;
            gap:            ${sz.badgeMR};
            margin-right:   ${sz.badgeLastMR};
            vertical-align: middle;
            line-height:    0;
          }
          .ck-bw img,
          .ck-bw svg,
          .ck-badge-img {
            width:          ${sz.badgeW} !important;
            height:         ${sz.badgeH} !important;
            min-width:      ${sz.badgeW} !important;
            min-height:     ${sz.badgeH} !important;
            max-width:      ${sz.badgeW} !important;
            max-height:     ${sz.badgeH} !important;
            margin:         0 !important;
            vertical-align: middle;
            border-radius:  10%;
            display:        block;
            flex:           0 0 auto;
          }

          /* Wide badges (TikTok fan-club/gifter art): height-locked,
             natural width, so they baseline-align with square badges */
          img.ck-badge-img.ck-badge-wide {
            width:     auto !important;
            min-width: 0 !important;
            max-width: calc(${sz.badgeW} * 2.5) !important;
          }

          .ck-body {
            display: inline;
          }

          /* Emote sizing. height is pinned to the configured size rather than
             left auto: providers ship the same emote at 1x-4x, and with
             height:auto a low-resolution source drew shorter than its
             neighbours instead of at the configured size. width stays auto so
             the aspect ratio decides it — wide emotes stay wide, square ones
             stay square, and max-width only clamps the extremes, where
             object-fit letterboxes instead of stretching. */
          /* Scoped to .ck-emote, not to every descendant img. Every emote path
             carries that class — ordinary, native, zero-width base, zero-width
             overlay — so this is the same set of images as before, but a
             non-emote image that ever lands in a body is no longer force-sized.
             That mattered less when height was auto; a pinned height would
             actively distort anything it caught. Badges, avatars and source
             marks are siblings of .ck-body and were never in scope. */
          .ck-body img.ck-emote {
            max-width:      ${emoteMaxW};
            max-height:     ${emoteMaxH};
            height:         ${emoteMaxH};
            width:          auto;
            object-fit:     contain;
            margin-right:   ${sz.emoteMR};
            vertical-align: middle;
            display:        inline-block;
          }

          /* Zero-width stack: base + overlays in one grid cell. The base is
             the only in-flow item, so the cell keeps its full width and the
             compaction margin moves to the wrapper — inside it, that negative
             margin was clipping the base. Overlays are out of flow and
             centred, so they add no width regardless of their own. */
          .ck-body .ck-zw {
            display:        inline-grid;
            position:       relative;
            vertical-align: middle;
            line-height:    0;
            margin-right:   ${sz.emoteMR};
          }
          .ck-body .ck-zw > img.ck-zw-base {
            grid-area:      1 / 1;
            margin-right:   0;
          }
          .ck-body .ck-zw > .ck-zw-layer {
            position:        absolute;
            inset:           0;
            display:         flex;
            align-items:     center;
            justify-content: center;
            pointer-events:  none;
          }
          .ck-body .ck-zw > .ck-zw-layer > img.ck-emote {
            margin-right:   0;
            max-width:      none;
          }

          
          .ck-body img.ck-upscale {
            max-height:     ${sz.upscaleH};
            max-width:      ${sz.emoteMaxW};
            height:         ${sz.upscaleH};
            width:          auto;
          }

          .ck-colon { margin-right: ${sz.colonMR}; }

          @keyframes ckPin {
            from { opacity:0; transform:translateY(-6px); }
            to   { opacity:1; transform:translateY(0); }
          }
          @keyframes ckSpin {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
          }

          .ck-startup-loader {
            position: fixed;
            inset: 0;
            z-index: 100;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            pointer-events: none;
            opacity: 1;
            transition: opacity 250ms ease;
          }
          .ck-startup-loader[data-phase='fading'] { opacity: 0; }
          .ck-startup-card {
            display: block;
            max-width: min(420px, 100%);
            padding: clamp(12px, 3vw, 20px) clamp(16px, 4vw, 26px);
            border: 1px solid rgba(255,255,255,.14);
            border-radius: 18px;
            background: rgba(12,12,16,.64);
            color: #fff;
            box-shadow: 0 12px 36px rgba(0,0,0,.34);
            backdrop-filter: blur(8px);
          }
          .ck-startup-copy { min-width:0; font-family:'Open Sans',Arial,system-ui,sans-serif; }
          .ck-startup-title { margin:0; font-size:clamp(20px,4.2vw,32px); line-height:1.1; font-weight:800; letter-spacing:-.025em; }
          .ck-startup-byline { margin:4px 0 10px; color:#a9c4ff; font-size:clamp(12px,2vw,15px); font-weight:700; }
          .ck-startup-status { display:flex; align-items:center; gap:9px; margin:0; color:rgba(255,255,255,.82); font-size:clamp(12px,2vw,15px); font-weight:700; }
          .ck-startup-spinner { width:16px; height:16px; flex:0 0 auto; border:2px solid rgba(255,255,255,.25); border-top-color:#6d9dff; border-radius:50%; animation:ckSpin .8s linear infinite; }
          @media (prefers-reduced-motion: reduce) {
            .ck-startup-loader { transition: none; }
            .ck-startup-spinner { animation: none; border-top-color:#6d9dff; }
          }

        `, [cfg, sz, emoteMaxW, emoteMaxH]);

  return (
    <>
      <Head>
        {/* The selected web font. Without this the overlay named a family it had
            never fetched, so every Google face — including the generator's
            default, Open Sans — fell back to generic sans-serif in OBS while the
            generator preview, which loads them for its own UI, showed the real
            face. `display=swap` keeps text visible while it loads. */}
        {fontCss && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
            {/* dangerouslySetInnerHTML, not a text child: React escapes the
                latter, and `&` → `&amp;` plus `'` → `&#x27;` are not decoded
                inside a <style> raw-text element, so the @import would be an
                invalid URL token and load nothing. */}
            <style dangerouslySetInnerHTML={{ __html: fontCss }} />
          </>
        )}
        <style>{overlayCss}</style>
      </Head>

      {loaderPhase !== 'hidden' && (
        <div className="ck-startup-loader" data-phase={loaderPhase} data-testid="chat-startup-loader">
          <div className="ck-startup-card">
            <div className="ck-startup-copy">
              <p className="ck-startup-title">Multi-Chat Overlay</p>
              <p className="ck-startup-byline">made by @Gxufy</p>
              <p className="ck-startup-status">
                <span className="ck-startup-spinner" aria-hidden="true" />
                Loading...
              </p>
            </div>
          </div>
        </div>
      )}

      {hypeTrain?.active && (
        <HypeTrainBar state={hypeTrain} ending={hypeTrainEnding} fontFamily={fontFamily} />
      )}

      {cfg.showPinEnabled && pinnedMessage && (
        <PinBanner
          pinned={pinnedMessage} sz={sz} emoteMaxH={emoteMaxH} emoteMaxW={emoteMaxW}
          fontFamily={fontFamily} filterVal={filterVal} strokeVal={strokeVal}
          hideNames={cfg.hideNames??false} tagMode={tagMode}
        />
      )}

      {}
      <div id="chat_container" ref={chatContainerRef} style={{
        width:      'calc(100% - 20px)',
        padding:    '10px',
        position:   'absolute',
        bottom:     0,
        maxHeight:  smoothRuntime ? 'calc(100vh - 20px)' : undefined,
        display:    smoothRuntime ? 'flex' : undefined,
        flexDirection: smoothRuntime ? 'column' : undefined,
        overflow:   'hidden',
        background: 'transparent',
        color:      cfg.fontColor || 'white',
        fontWeight: cfg.msgBold === false ? 400 : 800,
        textTransform: cfg.msgCaps ? 'uppercase' as const : undefined,
        wordBreak:  'break-word',
        fontFamily,
        fontSize:   sz.fontSize,
        ...(!smoothRuntime && filterVal ? { textShadow:filterVal } : {}),
        ...(strokeVal ? { WebkitTextStroke:strokeVal } : {}),
      }}>
        {batches.map(({ id, messageIds }) => {
          const content = messageIds
            .map((messageId) => messagesById.get(messageId))
            .filter((message): message is ParsedMessage => Boolean(message))
            .map(renderMsg);
          if (cfg.animation==='slide') return <SlideGroup key={id}>{content}</SlideGroup>;
          if (cfg.animation==='fade')  return <FadeGroup  key={id}>{content}</FadeGroup>;
          return <div key={id}>{content}</div>;
        })}
      </div>
    </>
  );
}

function HypeTrainBar({ state, ending, fontFamily }: {
  state: Extract<TwitchHypeTrainState, { active: true }>;
  ending: boolean;
  fontFamily: string;
}) {
  const percent = Math.max(0, Math.min(100, (state.progression / state.goal) * 100));
  return (
    <div data-testid="twitch-hype-train" role="status" aria-label={`Hype Train level ${state.level}, ${Math.round(percent)} percent`}
      style={{ position:'absolute', left:10, right:10, bottom:10, zIndex:8, padding:'8px 10px', borderRadius:8,
        background:'rgba(20,12,32,.82)', color:'white', fontFamily, opacity:ending ? 0 : 1,
        transition:'opacity 400ms ease-in-out', boxShadow:'0 4px 18px rgba(0,0,0,.3)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, fontWeight:800, marginBottom:5 }}>
        <span>🚂 Hype Train · Level {state.level}</span>
        <span>{state.progression.toLocaleString()} / {state.goal.toLocaleString()} ({Math.round(percent)}%)</span>
      </div>
      <div style={{ height:7, overflow:'hidden', borderRadius:99, background:'rgba(255,255,255,.18)' }}>
        <div data-testid="twitch-hype-train-progress" style={{ height:'100%', width:`${percent}%`, background:'#9147ff', transition:'width 300ms ease' }} />
      </div>
    </div>
  );
}

/* PinBanner — 5-second fade-out pin banner.
 *
 * Timing cycle (per msg.id):
 *   0 ms    → rendered, opacity 1
 *   4600 ms → opacity becomes 0 (400 ms fade)
 *   5000 ms → unmounted (stop rendering)
 *
 * Two states: `opacity` (number 0/1) and `mounted` (boolean).
 * Two timers: fade timer at 4600 ms, unmount timer at 5000 ms.
 * A different msg.id restarts the complete cycle.
 * Parent-driven unmount (pinnedMessage null / showPinEnabled false)
 * clears both timers in useEffect cleanup. */
function PinBanner({ pinned, sz, emoteMaxH, emoteMaxW, fontFamily, filterVal, strokeVal, hideNames, tagMode }: {
  pinned: PinnedState; sz: typeof SIZE[SzKey];
  emoteMaxH:string; emoteMaxW:string; fontFamily:string;
  filterVal:string; strokeVal:string;
  hideNames:boolean;
  /* Follows the overlay's mode rather than a hardcoded 'icon', so sourceTag=none
     leaves no marker here either. */
  tagMode:SourceTagMode;
}) {
  const { msg, pinnedBy } = pinned;
  const [opacity, setOpacity] = useState(1);
  const [mounted, setMounted] = useState(true);
  const timersRef = useRef<{ fade: ReturnType<typeof setTimeout>|null; unmount: ReturnType<typeof setTimeout>|null }>({ fade: null, unmount: null });

  useEffect(() => {
    // Reset cycle on new msg.id or initial mount
    setOpacity(1);
    setMounted(true);

    // Clear any previous timers (handles msg.id change + parent unmount)
    if (timersRef.current.fade) clearTimeout(timersRef.current.fade);
    if (timersRef.current.unmount) clearTimeout(timersRef.current.unmount);

    timersRef.current.fade = setTimeout(() => setOpacity(0), 4600);
    timersRef.current.unmount = setTimeout(() => setMounted(false), 5000);

    return () => {
      if (timersRef.current.fade) clearTimeout(timersRef.current.fade);
      if (timersRef.current.unmount) clearTimeout(timersRef.current.unmount);
    };
  }, [msg.id]);

  /* Entry animation from the original banner + 400 ms opacity fade-out
   * controlled by state. The 150 ms slide-in runs once on mount;
   * opacity transitions from 1 → 0 over 400 ms starting at 4600 ms. */
  const shell: React.CSSProperties = {
    position:'absolute', top:0, left:0, right:0, zIndex:10,
    background:'rgba(12,12,16,0.72)',
    backdropFilter:'blur(16px) saturate(180%)', WebkitBackdropFilter:'blur(16px) saturate(180%)',
    borderBottom:'1px solid rgba(255,255,255,0.12)',
    borderRadius:'0 0 10px 10px',
    animation:'ckPin 150ms ease-out',
    fontFamily, fontWeight:800,
    color:'white',
    wordBreak:'break-word', overflowWrap:'break-word',
    overflow:'hidden',
    opacity,
    transition:'opacity 400ms ease-in-out',
    ...(filterVal ? { textShadow:filterVal } : {}),
    ...(strokeVal ? { WebkitTextStroke:strokeVal } : {}),
  };

  if (!mounted) return null;

  return (
    <div style={{ ...shell, padding:'6px 10px 8px', fontSize:sz.fontSize }}>
      <div style={{ display:'flex', alignItems:'center', gap:4, paddingBottom:4, opacity:0.6, fontSize:'0.7em' }}>
        <PinSVG /> <span style={{ fontWeight:700 }}>Pinned Message</span>
      </div>
      <MsgLine msg={msg} sz={sz} emoteMaxH={emoteMaxH} emoteMaxW={emoteMaxW}
        stroke={strokeVal} hideNames={hideNames}
        tagMode={tagMode} showAvatar={false} showSharedSource={false} />
      {pinnedBy && (
        <div style={{ paddingTop:4, opacity:0.5, fontSize:'0.55em', fontWeight:600 }}>
          Pinned by {pinnedBy}
        </div>
      )}
    </div>
  );
}


const CATEGORY_ICON: Record<string, string> = {
  subscription: '★', gift: '🎁', raid: '👥', cheer: '💰',
  milestone: '🔥', follow: '❤️', announcement: '📣',
};

function MsgLine({ msg, sz, emoteMaxH, emoteMaxW, stroke, hideNames, tagMode, showAvatar, showSharedSource }: {
  msg: ParsedMessage; sz: typeof SIZE[SzKey];
  emoteMaxH:string; emoteMaxW:string; stroke:string;
  hideNames:boolean;
  tagMode:SourceTagMode; showAvatar:boolean; showSharedSource:boolean;
}) {
  const isPaint = !!msg.identity.background;
  const pill = msg.identity.namePill?.split('|');
  const nameStyle: React.CSSProperties = pill
    ? { background:pill[0], color:pill[1], borderRadius:'0.4em', padding:'0 0.35em',
        WebkitTextStroke:'0px', textShadow:'none',
        }    : isPaint
    /* backgroundImage, not the background shorthand: the shorthand resets
       backgroundSize, so the paint only sized correctly because React happened
       to emit the two in declaration order. 100% 100% rather than cover
       matters for image paints — cover crops the art to the glyph box, this
       stretches it across the name the way 7TV serves it. Gradients are
       unaffected either way. The name carries no text-shadow: the paint's own
       drop-shadow filter is the shadow, and an inherited one muddies it. */
    ? { backgroundImage:msg.identity.background, filter:msg.identity.filter,
        WebkitTextFillColor:'transparent', WebkitBackgroundClip:'text',
        backgroundClip:'text', backgroundSize:'100% 100%',
        backgroundRepeat:'no-repeat',
        WebkitTextStroke:'0px', textShadow:'none' }
    : { color:msg.identity.color, };

  const visualPlatform = msg.displayPlatform ?? msg.platform;
  const tag = visualPlatform ? sourceTag(visualPlatform, tagMode) : null;


  const avatar = showAvatar && msg.avatar && (msg.platform === 'youtube' || msg.platform === 'tiktok') ? (
    <img src={msg.avatar} alt="" loading="lazy" referrerPolicy="no-referrer"
      style={{ width:'1.5em', height:'1.5em', minWidth:'1.5em', borderRadius:9999,
               objectFit:'cover', marginRight:'0.4em', verticalAlign:'-0.32em',
               display:'inline-block' }}
      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
  ) : null;
  const sourceChannel = showSharedSource && msg.sourceChannel?.profileImageUrl ? (
    <span data-testid="twitch-shared-source" title="Twitch Shared Chat"
      style={{ display:'inline-flex', alignItems:'center', marginRight:'0.35em', verticalAlign:'middle', opacity:0.9 }}>
      <img src={msg.sourceChannel.profileImageUrl} alt="" loading="lazy" referrerPolicy="no-referrer"
        style={{ width:'1.45em', height:'1.45em', borderRadius:9999, objectFit:'cover' }}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
    </span>
  ) : null;

  const badgesNode = msg.identity.badges.length > 0 && (
    <span className="ck-bw">
      {msg.identity.badges.map((b,i) => <Fragment key={i}>{b}</Fragment>)}
    </span>
  );
  const nameNode = <span style={nameStyle}>{msg.identity.username}</span>;

  
  if (msg.kind === 'system') {
    const color = msg.platform ? PROVIDERS[msg.platform as Platform].color : '#888';
    return (
      <div style={{ lineHeight:sz.lineHeight, wordBreak:'break-word', display:'flex', alignItems:'flex-start', gap:'0.3em' }}>
        {tag && <span style={{ flexShrink:0 }}>{tag}</span>}
        {sourceChannel}
        <div style={{
          borderLeft:`2px solid ${color}`,
          background:`linear-gradient(90deg, color-mix(in srgb, ${color} 20%, transparent), transparent)`,
          padding:'0 8px', borderRadius:6, flex:1, minWidth:0,
        }}>
          <span style={{ marginRight:'0.35em' }}>{CATEGORY_ICON[msg.category ?? 'announcement'] ?? '📣'}</span>
          <span style={{ fontWeight:400 }} className="ck-body">
            {msg.message.map((node,i) => <Fragment key={i}>{node}</Fragment>)}
          </span>
        </div>
      </div>
    );
  }

  
  const redeemWrap = (inner: React.ReactNode) => (
    <div style={{
      borderLeft: '0.22em solid #9147ff',
      background: 'linear-gradient(90deg, rgba(145,71,255,0.18), transparent 70%)',
      padding: '0 0 0 0.4em', borderRadius: 3,
    }}>
      {typeof msg.redeem === 'string' && msg.redeem !== 'highlighted' && (
        <div style={{ fontSize: '0.6em', opacity: 0.75, fontWeight: 700, lineHeight: 1.6 }}>
          🎁 {msg.redeem}
        </div>
      )}
      {inner}
    </div>
  );

  const replyNode = msg.reply ? (
    <div style={{
      fontSize:'0.6em', lineHeight:1.35, opacity:0.68, marginLeft:'0.35em',
      paddingLeft:'0.45em', borderLeft:'2px solid rgba(255,255,255,0.28)',
      whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
    }}>
      <span aria-hidden="true">↪ </span><strong>{msg.reply.username}</strong>{msg.reply.text ? ` ${msg.reply.text}` : ''}
    </div>
  ) : null;

  const messageLine = (
    <div style={{ lineHeight:sz.lineHeight, wordBreak:'break-word' }}>
      {tag}
      {sourceChannel}
      {avatar}
      {!hideNames && (
        <span style={{ display:'inline' }}>
          {badgesNode}{nameNode}
          <span className="ck-colon">:</span>
        </span>
      )}
      <span className="ck-body">
        {msg.message.map((node,i) => <Fragment key={i}>{node}</Fragment>)}
      </span>
    </div>
  );

  const line = replyNode ? <div>{replyNode}{messageLine}</div> : messageLine;
  return msg.redeem ? redeemWrap(line) : line;
}

function PinSVG() {
  return (
    <svg height={12} width={12} fill="currentColor" viewBox="0 0 490.125 490.125">
      <path d="M300.625,5.025c-6.7-6.7-17.6-6.7-24.3,0l-72.6,72.6c-6.7,6.7-6.7,17.6,0,24.3l16.3,16.3l-40.3,40.3l-63.5-7c-3-0.3-6-0.5-8.9-0.5c-21.7,0-42.2,8.5-57.5,23.8l-20.8,20.8c-6.7,6.7-6.7,17.6,0,24.3l108.5,108.5l-132.4,132.4c-6.7,6.7-6.7,17.6,0,24.3c3.3,3.3,7.7,5,12.1,5s8.8-1.7,12.1-5l132.5-132.5l108.5,108.5c3.3,3.3,7.7,5,12.1,5s8.8-1.7,12.1-5l20.8-20.8c17.6-17.6,26.1-41.8,23.3-66.4l-7-63.5l40.3-40.3l16.2,16.2c6.7,6.7,17.6,6.7,24.3,0l72.6-72.6c3.2-3.2,5-7.6,5-12.1s-1.8-8.9-5-12.1L300.625,5.025z"/>
    </svg>
  );
}
