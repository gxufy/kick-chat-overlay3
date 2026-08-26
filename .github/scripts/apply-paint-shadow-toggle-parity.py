from pathlib import Path

path = Path('app/src/components/overlay/ChatOverlay.tsx')
text = path.read_text()


def replace_once(old: str, new: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'expected exactly one match, found {count}: {old[:120]!r}')
    text = text.replace(old, new, 1)

replace_once(
    "  const visualShadowFilter = getDropShadowFilter(cfg.textShadow);\n  const strokeVal  = getStroke(cfg.stroke ?? 'none');\n",
    "  const visualShadowFilter = getDropShadowFilter(cfg.textShadow);\n  /* paintShadows is an explicit promise that painted usernames can shed all\n     drop-shadow work while keeping the paint itself. Restore the old general\n     username shadow only when that paint-shadow switch is enabled. */\n  const paintVisualShadowFilter = cfg.paintShadows === false ? '' : visualShadowFilter;\n  const strokeVal  = getStroke(cfg.stroke ?? 'none');\n",
)

replace_once(
    "  msg, fading, msgSlideIn, smoothRuntime, shadowVal, visualShadowFilter, sz, emoteMaxH, emoteMaxW,\n",
    "  msg, fading, msgSlideIn, smoothRuntime, shadowVal, visualShadowFilter, paintVisualShadowFilter, sz, emoteMaxH, emoteMaxW,\n",
)

replace_once(
    "  msg: ParsedMessage; fading: boolean; msgSlideIn: boolean; smoothRuntime: boolean; shadowVal: string; visualShadowFilter: string;\n",
    "  msg: ParsedMessage; fading: boolean; msgSlideIn: boolean; smoothRuntime: boolean; shadowVal: string; visualShadowFilter: string; paintVisualShadowFilter: string;\n",
)

replace_once(
    "        tagMode={tagMode} showAvatar={showAvatar} showSharedSource={showSharedSource}\n        visualShadowFilter={visualShadowFilter} />\n",
    "        tagMode={tagMode} showAvatar={showAvatar} showSharedSource={showSharedSource}\n        visualShadowFilter={visualShadowFilter} paintVisualShadowFilter={paintVisualShadowFilter} />\n",
)

replace_once(
    "      visualShadowFilter={visualShadowFilter}\n      sz={sz}\n",
    "      visualShadowFilter={visualShadowFilter}\n      paintVisualShadowFilter={paintVisualShadowFilter}\n      sz={sz}\n",
)

replace_once(
    "          fontFamily={fontFamily} filterVal={filterVal} visualShadowFilter={visualShadowFilter} strokeVal={strokeVal}\n",
    "          fontFamily={fontFamily} filterVal={filterVal} visualShadowFilter={visualShadowFilter} paintVisualShadowFilter={paintVisualShadowFilter} strokeVal={strokeVal}\n",
)

replace_once(
    "function PinBanner({ pinned, sz, emoteMaxH, emoteMaxW, fontFamily, filterVal, visualShadowFilter, strokeVal, hideNames, tagMode }: {\n",
    "function PinBanner({ pinned, sz, emoteMaxH, emoteMaxW, fontFamily, filterVal, visualShadowFilter, paintVisualShadowFilter, strokeVal, hideNames, tagMode }: {\n",
)

replace_once(
    "  filterVal:string; visualShadowFilter:string; strokeVal:string;\n",
    "  filterVal:string; visualShadowFilter:string; paintVisualShadowFilter:string; strokeVal:string;\n",
)

replace_once(
    "        tagMode={tagMode} showAvatar={false} showSharedSource={false}\n        visualShadowFilter={visualShadowFilter} />\n",
    "        tagMode={tagMode} showAvatar={false} showSharedSource={false}\n        visualShadowFilter={visualShadowFilter} paintVisualShadowFilter={paintVisualShadowFilter} />\n",
)

replace_once(
    "function MsgLine({ msg, sz, emoteMaxH, emoteMaxW, stroke, hideNames, tagMode, showAvatar, showSharedSource, visualShadowFilter }: {\n",
    "function MsgLine({ msg, sz, emoteMaxH, emoteMaxW, stroke, hideNames, tagMode, showAvatar, showSharedSource, visualShadowFilter, paintVisualShadowFilter }: {\n",
)

replace_once(
    "  tagMode:SourceTagMode; showAvatar:boolean; showSharedSource:boolean; visualShadowFilter:string;\n",
    "  tagMode:SourceTagMode; showAvatar:boolean; showSharedSource:boolean; visualShadowFilter:string; paintVisualShadowFilter:string;\n",
)

replace_once(
    "        filter:[msg.identity.filter, visualShadowFilter].filter(Boolean).join(' ') || undefined,\n",
    "        filter:[msg.identity.filter, paintVisualShadowFilter].filter(Boolean).join(' ') || undefined,\n",
)

path.write_text(text)
