from pathlib import Path

path = Path('app/src/components/overlay/ChatOverlay.tsx')
text = path.read_text()


def replace_once(old: str, new: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'expected exactly one match, found {count}: {old[:100]!r}')
    text = text.replace(old, new, 1)

replace_once(
    "import { LOCAL_OVERLAY_FONT_CSS, overlayFontCss } from '../../lib/overlayFonts';\n",
    "import { LOCAL_OVERLAY_FONT_CSS, overlayFontCss } from '../../lib/overlayFonts';\nimport { createSmoothScrollFollower } from '../../lib/smoothScrollFollower';\n",
)

replace_once(
    "function getShadowFilter(s: string) {\n  if (s === 'small')  return '2px 2px 0.2rem black';\n  if (s === 'medium') return '2px 2px 0.35rem black';\n  if (s === 'large')  return '2px 2px 0.5rem black';\n  return '';\n}\n",
    "function getShadowFilter(s: string) {\n  if (s === 'small')  return '2px 2px 0.2rem black';\n  if (s === 'medium') return '2px 2px 0.35rem black';\n  if (s === 'large')  return '2px 2px 0.5rem black';\n  return '';\n}\n\n/* The pre-optimization renderer used CSS drop-shadow around the complete\n   rendered username. Keep that exact color/shadow treatment on the small name\n   span, while the rest of each message uses the cheaper text-shadow path. */\nfunction getDropShadowFilter(s: string) {\n  const shadow = getShadowFilter(s);\n  return shadow ? `drop-shadow(${shadow})` : '';\n}\n",
)

replace_once(
    "  msg, fading, msgSlideIn, smoothRuntime, shadowVal, sz, emoteMaxH, emoteMaxW,\n  strokeVal, hideNames, tagMode, showAvatar, showSharedSource,\n",
    "  msg, fading, msgSlideIn, smoothRuntime, shadowVal, visualShadowFilter, sz, emoteMaxH, emoteMaxW,\n  strokeVal, hideNames, tagMode, showAvatar, showSharedSource,\n",
)

replace_once(
    "  msg: ParsedMessage; fading: boolean; msgSlideIn: boolean; smoothRuntime: boolean; shadowVal: string;\n  sz: typeof SIZE[SzKey]; emoteMaxH: string; emoteMaxW: string; strokeVal: string;\n",
    "  msg: ParsedMessage; fading: boolean; msgSlideIn: boolean; smoothRuntime: boolean; shadowVal: string; visualShadowFilter: string;\n  sz: typeof SIZE[SzKey]; emoteMaxH: string; emoteMaxW: string; strokeVal: string;\n",
)

replace_once(
    "        stroke={strokeVal} hideNames={hideNames}\n        tagMode={tagMode} showAvatar={showAvatar} showSharedSource={showSharedSource} />\n",
    "        stroke={strokeVal} hideNames={hideNames}\n        tagMode={tagMode} showAvatar={showAvatar} showSharedSource={showSharedSource}\n        visualShadowFilter={visualShadowFilter} />\n",
)

replace_once(
    "  const filterVal  = getShadowFilter(cfg.textShadow);\n  const strokeVal  = getStroke(cfg.stroke ?? 'none');\n",
    "  const filterVal  = getShadowFilter(cfg.textShadow);\n  const visualShadowFilter = getDropShadowFilter(cfg.textShadow);\n  const strokeVal  = getStroke(cfg.stroke ?? 'none');\n",
)

old_scroll = """  const chatContainerRef = useRef<HTMLDivElement>(null);\n  useEffect(() => {\n    if (!smoothRuntime) return;\n    const el = chatContainerRef.current;\n    if (!el || typeof MutationObserver === 'undefined') return;\n    let raf = 0;\n    let lastScrollAt = 0;\n    const scrollNewestIntoView = () => {\n      cancelAnimationFrame(raf);\n      raf = requestAnimationFrame(() => {\n        const now = Date.now();\n        const burst = now - lastScrollAt < 100;\n        lastScrollAt = now;\n        try {\n          el.scrollTo({ top: el.scrollHeight, behavior: burst ? 'auto' : 'smooth' });\n        } catch {\n          el.scrollTop = el.scrollHeight;\n        }\n      });\n    };\n    const observer = new MutationObserver(scrollNewestIntoView);\n    observer.observe(el, { childList: true });\n    return () => {\n      cancelAnimationFrame(raf);\n      observer.disconnect();\n    };\n  }, [smoothRuntime]);\n"""
new_scroll = """  const chatContainerRef = useRef<HTMLDivElement>(null);\n  useEffect(() => {\n    if (!smoothRuntime) return;\n    const el = chatContainerRef.current;\n    if (!el || typeof MutationObserver === 'undefined') return;\n\n    /* One continuously moving rAF target gives burst chat a stable frame cadence.\n       Native smooth scrolling restarts its easing curve on every mutation, while\n       the old burst fallback snapped to `auto`; both are visible as uneven speed\n       when messages arrive faster than the animation can settle. */\n    const follower = createSmoothScrollFollower(el);\n    const observer = new MutationObserver(() => follower.wake());\n    observer.observe(el, { childList: true });\n    follower.wake();\n    return () => {\n      observer.disconnect();\n      follower.stop();\n    };\n  }, [smoothRuntime]);\n"""
replace_once(old_scroll, new_scroll)

replace_once(
    "      smoothRuntime={smoothRuntime}\n      shadowVal={filterVal}\n      sz={sz}\n",
    "      smoothRuntime={smoothRuntime}\n      shadowVal={filterVal}\n      visualShadowFilter={visualShadowFilter}\n      sz={sz}\n",
)

replace_once(
    "          .gx-message-slide-in {\n            animation: gxMessageSlideIn 250ms ease-out;\n            backface-visibility: hidden;\n          }\n",
    "          .gx-message-slide-in {\n            animation: gxMessageSlideIn 250ms ease-out;\n            backface-visibility: hidden;\n          }\n          /* Only hint scrolling while the rAF follower is actually moving. */\n          .gx-scroll-active { will-change: scroll-position; }\n",
)

replace_once(
    "function MsgLine({ msg, sz, emoteMaxH, emoteMaxW, stroke, hideNames, tagMode, showAvatar, showSharedSource }: {\n  msg: ParsedMessage; sz: typeof SIZE[SzKey];\n  emoteMaxH:string; emoteMaxW:string; stroke:string;\n  hideNames:boolean;\n  tagMode:SourceTagMode; showAvatar:boolean; showSharedSource:boolean;\n}) {\n  const isPaint = !!msg.identity.background;\n  const pill = msg.identity.namePill?.split('|');\n  const nameStyle: React.CSSProperties = pill\n    ? { background:pill[0], color:pill[1], borderRadius:'0.4em', padding:'0 0.35em',\n        WebkitTextStroke:'0px', textShadow:'none',\n        }    : isPaint\n",
    "function MsgLine({ msg, sz, emoteMaxH, emoteMaxW, stroke, hideNames, tagMode, showAvatar, showSharedSource, visualShadowFilter }: {\n  msg: ParsedMessage; sz: typeof SIZE[SzKey];\n  emoteMaxH:string; emoteMaxW:string; stroke:string;\n  hideNames:boolean;\n  tagMode:SourceTagMode; showAvatar:boolean; showSharedSource:boolean; visualShadowFilter:string;\n}) {\n  const isPaint = !!msg.identity.background;\n  const pill = msg.identity.namePill?.split('|');\n  const oldNameShadow = visualShadowFilter || undefined;\n  const nameStyle: React.CSSProperties = pill\n    ? { background:pill[0], color:pill[1], borderRadius:'0.4em', padding:'0 0.35em',\n        WebkitTextStroke:'0px', textShadow:'none', filter:oldNameShadow,\n        }    : isPaint\n",
)

replace_once(
    "    ? { backgroundImage:msg.identity.background, filter:msg.identity.filter,\n        WebkitTextFillColor:'transparent', WebkitBackgroundClip:'text',\n",
    "    ? { backgroundImage:msg.identity.background,\n        filter:[msg.identity.filter, visualShadowFilter].filter(Boolean).join(' ') || undefined,\n        WebkitTextFillColor:'transparent', WebkitBackgroundClip:'text',\n",
)

replace_once(
    "        WebkitTextStroke:'0px', textShadow:'none' }\n    : { color:msg.identity.color, };\n",
    "        WebkitTextStroke:'0px', textShadow:'none' }\n    : { color:msg.identity.color,\n        ...(oldNameShadow ? { filter:oldNameShadow, textShadow:'none' } : {}) };\n",
)

path.write_text(text)
