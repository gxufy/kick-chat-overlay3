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
    "          fontFamily={fontFamily} filterVal={filterVal} strokeVal={strokeVal}\n          hideNames={cfg.hideNames??false} tagMode={tagMode}\n",
    "          fontFamily={fontFamily} filterVal={filterVal} visualShadowFilter={visualShadowFilter} strokeVal={strokeVal}\n          hideNames={cfg.hideNames??false} tagMode={tagMode}\n",
)

replace_once(
    "  filterVal:string; strokeVal:string;\n  hideNames:boolean;\n",
    "  filterVal:string; visualShadowFilter:string; strokeVal:string;\n  hideNames:boolean;\n",
)

replace_once(
    "function PinBanner({ pinned, sz, emoteMaxH, emoteMaxW, fontFamily, filterVal, strokeVal, hideNames, tagMode }: {\n",
    "function PinBanner({ pinned, sz, emoteMaxH, emoteMaxW, fontFamily, filterVal, visualShadowFilter, strokeVal, hideNames, tagMode }: {\n",
)

replace_once(
    "        stroke={strokeVal} hideNames={hideNames}\n        tagMode={tagMode} showAvatar={false} showSharedSource={false} />\n",
    "        stroke={strokeVal} hideNames={hideNames}\n        tagMode={tagMode} showAvatar={false} showSharedSource={false}\n        visualShadowFilter={visualShadowFilter} />\n",
)

path.write_text(text)
