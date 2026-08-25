from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"expected text not found in {path}: {old[:180]!r}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    'tests/unit/rendererParity.test.tsx',
    "    /* Badges keep their own spacing rather than the emote compaction margin. */\n"
    "    expect(px(badge, 'margin-right')).toBeGreaterThan(0);\n"
    "    expect(emote).toMatch(/margin-right:\\s*-/);\n",
    "    /* Badge spacing now belongs to the centered inline-flex wrapper rather\n"
    "       than each image, while emotes keep their own negative compaction. */\n"
    "    const badgeRow = block(css, '.ck-bw {');\n"
    "    expect(px(badgeRow, 'gap')).toBeGreaterThan(0);\n"
    "    expect(badge).toMatch(/margin:\\s*0\\s*!important/);\n"
    "    expect(emote).toMatch(/margin-right:\\s*-/);\n",
)

replace_once(
    'tests/unit/previewBadgePipeline.test.ts',
    "      if (url === 'https://kick.com/api/v2/channels/kick-channel') return response(kickBody);\n",
    "      if (url === '/api/kick/channel?channel=kick-channel') return response(kickBody);\n"
    "      if (url === 'https://kick.com/api/v2/channels/kick-channel') return response(kickBody);\n",
)
