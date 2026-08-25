from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"expected text not found in {path}: {old[:180]!r}")
    p.write_text(text.replace(old, new, 1))


# Keep smooth handling as the global/default behavior, but do not let it replace
# the selected ChatIS Slide animation. ChatIS Slide owns its original layout,
# shadow placement and 200ms batch cadence.
replace_once(
    "src/components/overlay/ChatOverlay.tsx",
    "  const fontCss    = overlayFontCss(cfg.font);\n",
    "  const fontCss    = overlayFontCss(cfg.font);\n  /* ChatIS Slide is a complete entrance mode, not a smooth-scroll variant.\n     When Slide is selected, preserve ChatIS's original bottom-anchored layout\n     and height-ghost motion even though smooth handling is the site default. */\n  const smoothRuntime = cfg.smoothScroll && cfg.animation !== 'slide';\n",
)
replace_once(
    "src/components/overlay/ChatOverlay.tsx",
    "    if (!cfg.smoothScroll) return;",
    "    if (!smoothRuntime) return;",
)
replace_once(
    "src/components/overlay/ChatOverlay.tsx",
    "  }, [cfg.smoothScroll]);",
    "  }, [smoothRuntime]);",
)
replace_once(
    "src/components/overlay/ChatOverlay.tsx",
    "      ...(cfg.smoothScroll && filterVal ? { filter: filterVal } : {}),",
    "      ...(smoothRuntime && filterVal ? { filter: filterVal } : {}),",
)
replace_once(
    "src/components/overlay/ChatOverlay.tsx",
    "        maxHeight:  cfg.smoothScroll ? 'calc(100vh - 20px)' : undefined,\n        display:    cfg.smoothScroll ? 'flex' : undefined,\n        flexDirection: cfg.smoothScroll ? 'column' : undefined,\n        willChange: cfg.smoothScroll ? 'scroll-position' : undefined,",
    "        maxHeight:  smoothRuntime ? 'calc(100vh - 20px)' : undefined,\n        display:    smoothRuntime ? 'flex' : undefined,\n        flexDirection: smoothRuntime ? 'column' : undefined,\n        willChange: smoothRuntime ? 'scroll-position' : undefined,",
)
replace_once(
    "src/components/overlay/ChatOverlay.tsx",
    "                ...(!cfg.smoothScroll && filterVal ? { filter:filterVal } : {}),",
    "                ...(!smoothRuntime && filterVal ? { filter:filterVal } : {}),",
)
replace_once(
    "src/components/overlay/ChatOverlay.tsx",
    "          if (cfg.animation==='slide' && !cfg.smoothScroll) return <SlideGroup key={id} fontSize={sz.fontSize} lineHeight={sz.lineHeight} fontFamily={fontFamily} >{content}</SlideGroup>;",
    "          if (cfg.animation==='slide') return <SlideGroup key={id} fontSize={sz.fontSize} lineHeight={sz.lineHeight} fontFamily={fontFamily} >{content}</SlideGroup>;",
)
replace_once(
    "src/components/overlay/ChatOverlay.tsx",
    "  /* bChat smooth message handling: observe structural row changes, coalesce\n     them to one frame, and smooth-scroll to the newest row. If messages arrive\n     within 100ms, jump immediately so browser smooth-scroll animations never queue. */",
    "  /* bChat smooth message handling for non-Slide modes: observe structural row\n     changes, coalesce them to one frame, and smooth-scroll to the newest row.\n     ChatIS Slide deliberately bypasses this observer so its own height animation\n     remains visually identical to the source implementation. */",
)

replace_once(
    "src/pages/multichat.tsx",
    "    /* Message flush policy.\n       Legacy URLs keep the old chatis 200ms batch cadence. New generator URLs\n       opt into bChat-style smooth scrolling, where store changes are coalesced\n       to one React commit per animation frame instead of arriving in 200ms chunks. */\n    let dirty = false;",
    "    /* Message flush policy.\n       Smooth handling normally coalesces store changes to one React commit per\n       animation frame. ChatIS Slide is the exception by design: the upstream\n       implementation consumes one aggregate batch every 200ms, then opens that\n       batch's height over 150ms. Keep that cadence whenever Slide is selected. */\n    const smoothRuntime = cfg.smoothScroll && cfg.animation !== 'slide';\n    let dirty = false;",
)
replace_once(
    "src/pages/multichat.tsx",
    "      if (!cfg.smoothScroll || flushFrame !== null) return;",
    "      if (!smoothRuntime || flushFrame !== null) return;",
)
replace_once(
    "src/pages/multichat.tsx",
    "    const flushInterval: ReturnType<typeof setInterval> | null = cfg.smoothScroll\n      ? null\n      : setInterval(flushMessages, 200);",
    "    const flushInterval: ReturnType<typeof setInterval> | null = smoothRuntime\n      ? null\n      : setInterval(flushMessages, 200);",
)

replace_once(
    "tests/unit/smoothScroll.test.tsx",
    "  it('does not stack the legacy height ghost on top of smooth scrolling', async () => {\n    const config = MultichatQuerySchema.parse({ twitch: 'gxufy', animation: 'slide', smoothScroll: '1', msgSlideIn: '1' });\n    const raw = SAMPLE_MESSAGES[0].message;\n    const parsed = buildParsedMessage(raw, config, SAMPLE_COSMETICS, { enabled: config.mentionColor, colors: new Map() }, raw.timestamp);\n    const { container } = render(<ChatOverlay config={config} messages={[parsed]} fadingIds={new Set()} pinnedMessage={null} showLoader={false} sourceTagExplicit />);\n    await waitFor(() => expect(container.querySelector('.gx-bchat-slide-in')).not.toBeNull());\n    expect(container.querySelector('[data-slide-ghost]')).toBeNull();\n  });",
    "  it('keeps the authentic ChatIS height ghost when Slide is selected', async () => {\n    const config = MultichatQuerySchema.parse({ twitch: 'gxufy', animation: 'slide', smoothScroll: '1', msgSlideIn: '1' });\n    const raw = SAMPLE_MESSAGES[0].message;\n    const parsed = buildParsedMessage(raw, config, SAMPLE_COSMETICS, { enabled: config.mentionColor, colors: new Map() }, raw.timestamp);\n    const { container } = render(<ChatOverlay config={config} messages={[parsed]} fadingIds={new Set()} pinnedMessage={null} showLoader={false} sourceTagExplicit />);\n    await waitFor(() => expect(container.querySelector('[data-slide-ghost]')).not.toBeNull());\n    await waitFor(() => expect(container.querySelector('[data-slide-ghost]')).toBeNull());\n    expect(container.querySelector('.gx-bchat-slide-in')).not.toBeNull();\n  });",
)
