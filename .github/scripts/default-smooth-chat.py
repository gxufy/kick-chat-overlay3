from pathlib import Path
import subprocess


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"expected text not found in {path}: {old[:140]!r}")
    p.write_text(text.replace(old, new, 1))


# Keep the query parser's historical default intact. The live /multichat page
# promotes an omitted smoothScroll parameter to the modern smooth runtime path.
replace_once(
    "src/pages/multichat.tsx",
    "    const cfg = parsed.data;",
    "    const cfg = {\n      ...parsed.data,\n      // Smooth handling is the normal runtime path. Existing/generated URLs do\n      // not need a flag; smoothScroll=0/false is the explicit legacy fallback.\n      smoothScroll: router.query.smoothScroll === undefined\n        ? true\n        : parsed.data.smoothScroll,\n    };",
)

# The workspace/generator should visually start with smooth handling enabled,
# without changing the pinned legacy generator-default object used by old tests.
replace_once(
    "src/lib/multichatConfig.ts",
    "export const MULTICHAT_WORKSPACE_DEFAULTS: MultichatWorkspaceStyle = (() => {\n  const { platformIcons, ...shared } = MULTICHAT_GENERATOR_DEFAULTS;\n  return { ...shared, sourceTag: platformIcons ? 'icon' : 'none' };\n})();",
    "export const MULTICHAT_WORKSPACE_DEFAULTS: MultichatWorkspaceStyle = (() => {\n  const { platformIcons, ...shared } = MULTICHAT_GENERATOR_DEFAULTS;\n  return {\n    ...shared,\n    smoothScroll: true,\n    sourceTag: platformIcons ? 'icon' : 'none',\n  };\n})();",
)

# Preserve byte-for-byte legacy serializer behavior, but make smooth scrolling
# implicit for workspace-generated URLs. Workspace OFF is the only case that
# needs an explicit smoothScroll=0 escape hatch.
replace_once(
    "src/lib/multichatConfig.ts",
    "  const sourceTag = multichatSourceTagOf(style);",
    "  const sourceTag = multichatSourceTagOf(style);\n  const workspaceStyle = 'sourceTag' in style;",
)
replace_once(
    "src/lib/multichatConfig.ts",
    "    /* Match bChat's query convention: boolean settings use 1 when enabled. */\n    ...(msgSlideIn ? { msgSlideIn: '1' } : {}),\n    ...(smoothScroll ? { smoothScroll: '1' } : {}),",
    "    /* Match bChat's query convention for the horizontal entrance. Smooth\n       scrolling is implicit for workspace URLs; only an explicit workspace OFF\n       needs a parameter. The legacy serializer keeps its original 1/omitted form. */\n    ...(msgSlideIn ? { msgSlideIn: '1' } : {}),\n    ...(workspaceStyle\n      ? (smoothScroll ? {} : { smoothScroll: '0' })\n      : (smoothScroll ? { smoothScroll: '1' } : {})),",
)

replace_once(
    "src/features/multichat/settings.ts",
    "    description: 'bChat-style scrolling: smooth for ordinary arrivals, instant during rapid bursts so animations never pile up.',",
    "    description: 'Default message handling: smooth for ordinary arrivals, instant during rapid bursts so animations never pile up.',",
)

# Focused regression coverage for the new default/compatibility split.
replace_once(
    "tests/unit/smoothScroll.test.tsx",
    "import { MULTICHAT_GENERATOR_DEFAULTS, MultichatQuerySchema, buildMultichatQuery } from '@/lib/multichatConfig';",
    "import { MULTICHAT_GENERATOR_DEFAULTS, MULTICHAT_WORKSPACE_DEFAULTS, MultichatQuerySchema, buildMultichatQuery } from '@/lib/multichatConfig';",
)
replace_once(
    "tests/unit/smoothScroll.test.tsx",
    "  it('keeps legacy/default URLs unchanged and serializes only when enabled', () => {\n    expect(MultichatQuerySchema.parse({}).smoothScroll).toBe(false);\n    const off = new URLSearchParams(buildMultichatQuery(channels, MULTICHAT_GENERATOR_DEFAULTS));\n    const on = new URLSearchParams(buildMultichatQuery(channels, {\n      ...MULTICHAT_GENERATOR_DEFAULTS,\n      smoothScroll: true,\n    }));\n    expect(off.has('smoothScroll')).toBe(false);\n    expect(on.get('smoothScroll')).toBe('1');\n  });",
    "  it('makes smooth handling the workspace default without changing legacy URL strings', () => {\n    // The parser remains a compatibility surface; the /multichat page promotes\n    // omission to smooth at runtime. Legacy serialization therefore stays exact.\n    expect(MultichatQuerySchema.parse({}).smoothScroll).toBe(false);\n    expect(MULTICHAT_GENERATOR_DEFAULTS.smoothScroll).toBe(false);\n    expect(MULTICHAT_WORKSPACE_DEFAULTS.smoothScroll).toBe(true);\n\n    const legacy = new URLSearchParams(buildMultichatQuery(channels, MULTICHAT_GENERATOR_DEFAULTS));\n    const workspace = new URLSearchParams(buildMultichatQuery(channels, MULTICHAT_WORKSPACE_DEFAULTS));\n    const workspaceLegacyFallback = new URLSearchParams(buildMultichatQuery(channels, {\n      ...MULTICHAT_WORKSPACE_DEFAULTS,\n      smoothScroll: false,\n    }));\n\n    expect(legacy.has('smoothScroll')).toBe(false);\n    expect(workspace.has('smoothScroll')).toBe(false);\n    expect(workspaceLegacyFallback.get('smoothScroll')).toBe('0');\n  });",
)

# This identity test intentionally derives the workspace object from the legacy
# object. Smooth scrolling is now the one deliberate workspace-default override.
replace_once(
    "tests/unit/multichatCatalog.test.ts",
    "  it('derives the workspace defaults from the generator defaults', () => {\n    const { platformIcons, ...shared } = LEGACY;\n    /* Every field but the swapped one comes straight from the legacy object. */\n    expect(D).toEqual({ ...shared, sourceTag: 'icon' });\n    expect(platformIcons).toBe(true);\n    expect('platformIcons' in D).toBe(false);\n  });",
    "  it('derives the workspace defaults from the generator defaults', () => {\n    const { platformIcons, ...shared } = LEGACY;\n    /* sourceTag replaces platformIcons, and smooth scrolling is the intentional\n       modern workspace default while the pinned legacy object stays unchanged. */\n    expect(D).toEqual({ ...shared, smoothScroll: true, sourceTag: 'icon' });\n    expect(platformIcons).toBe(true);\n    expect('platformIcons' in D).toBe(false);\n  });",
)

# The workflow's fixed git-add list predates this compatibility-test update.
# Stage it here so the successful migration commit includes the regression lock.
subprocess.run(["git", "add", "tests/unit/multichatCatalog.test.ts"], check=True)
