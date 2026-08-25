from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"expected text not found in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    "src/lib/multichatConfig.ts",
    "  /* bChat smooth-scroll is opt-in for existing overlay URLs; new generator URLs enable it. */\n  smoothScroll: z.string().optional().transform(v => v === '1' || v === 'true'),",
    "  /* bChat smooth-scroll is the normal runtime path. Omit the parameter for smooth handling;\n     smoothScroll=0/false is the explicit legacy fallback. */\n  smoothScroll: z.string().optional().transform(v => v !== '0' && v !== 'false'),",
)
replace_once(
    "src/lib/multichatConfig.ts",
    "  smoothScroll: false,",
    "  smoothScroll: true,",
)
replace_once(
    "src/lib/multichatConfig.ts",
    "    /* Match bChat's query convention: boolean settings use 1 when enabled. */\n    ...(msgSlideIn ? { msgSlideIn: '1' } : {}),\n    ...(smoothScroll ? { smoothScroll: '1' } : {}),",
    "    /* Match bChat's query convention for the horizontal entrance. Smooth\n       scrolling is the runtime default, so only the explicit legacy fallback\n       needs a parameter. */\n    ...(msgSlideIn ? { msgSlideIn: '1' } : {}),\n    ...(!smoothScroll ? { smoothScroll: '0' } : {}),",
)
replace_once(
    "src/features/multichat/settings.ts",
    "    description: 'bChat-style scrolling: smooth for ordinary arrivals, instant during rapid bursts so animations never pile up.',",
    "    description: 'Default message handling: smooth for ordinary arrivals, instant during rapid bursts so animations never pile up.',",
)
replace_once(
    "tests/unit/smoothScroll.test.tsx",
    "  it('keeps legacy/default URLs unchanged and serializes only when enabled', () => {\n    expect(MultichatQuerySchema.parse({}).smoothScroll).toBe(false);\n    const off = new URLSearchParams(buildMultichatQuery(channels, MULTICHAT_GENERATOR_DEFAULTS));\n    const on = new URLSearchParams(buildMultichatQuery(channels, {\n      ...MULTICHAT_GENERATOR_DEFAULTS,\n      smoothScroll: true,\n    }));\n    expect(off.has('smoothScroll')).toBe(false);\n    expect(on.get('smoothScroll')).toBe('1');\n  });",
    "  it('uses smooth handling by default without changing default URL strings', () => {\n    expect(MultichatQuerySchema.parse({}).smoothScroll).toBe(true);\n    const defaultParams = new URLSearchParams(buildMultichatQuery(channels, MULTICHAT_GENERATOR_DEFAULTS));\n    const legacyFallback = new URLSearchParams(buildMultichatQuery(channels, {\n      ...MULTICHAT_GENERATOR_DEFAULTS,\n      smoothScroll: false,\n    }));\n    expect(defaultParams.has('smoothScroll')).toBe(false);\n    expect(legacyFallback.get('smoothScroll')).toBe('0');\n  });",
)
replace_once(
    "tests/unit/smoothScroll.test.tsx",
    "  it('accepts both 1 and true query spellings', () => {\n    expect(MultichatQuerySchema.parse({ smoothScroll: '1' }).smoothScroll).toBe(true);\n    expect(MultichatQuerySchema.parse({ smoothScroll: 'true' }).smoothScroll).toBe(true);\n    expect(MultichatQuerySchema.parse({ smoothScroll: '0' }).smoothScroll).toBe(false);\n  });",
    "  it('accepts explicit enable and legacy-fallback spellings', () => {\n    expect(MultichatQuerySchema.parse({}).smoothScroll).toBe(true);\n    expect(MultichatQuerySchema.parse({ smoothScroll: '1' }).smoothScroll).toBe(true);\n    expect(MultichatQuerySchema.parse({ smoothScroll: 'true' }).smoothScroll).toBe(true);\n    expect(MultichatQuerySchema.parse({ smoothScroll: '0' }).smoothScroll).toBe(false);\n    expect(MultichatQuerySchema.parse({ smoothScroll: 'false' }).smoothScroll).toBe(false);\n  });",
)
replace_once(
    "tests/unit/smoothScroll.test.tsx",
    "    const config = MultichatQuerySchema.parse({ twitch: 'gxufy', animation: 'slide', smoothScroll: '1', msgSlideIn: '1' });",
    "    const config = MultichatQuerySchema.parse({ twitch: 'gxufy', animation: 'slide', msgSlideIn: '1' });",
)
