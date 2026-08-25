from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"expected test text not found in {path}: {old[:220]!r}")
    p.write_text(text.replace(old, new, 1))


# The new Shared Chat setting is a real catalog field, so the generic catalog
# tests need one valid value and a set of serializer alternatives for it.
replace_once(
    'tests/unit/multichatCatalog.test.ts',
    "      sevenTVCosmeticsEnabled: false,\n      fadeEnabled: false,",
    "      sevenTVCosmeticsEnabled: false,\n      sharedChatEnabled: true,\n      fadeEnabled: false,",
)
replace_once(
    'tests/unit/multichatCatalog.test.ts',
    "      sevenTVCosmeticsEnabled: [true, false],\n      fadeEnabled: [true, false],",
    "      sevenTVCosmeticsEnabled: [true, false],\n      sharedChatEnabled: [true, false],\n      fadeEnabled: [true, false],",
)

# counterbgon/off deliberately give the otherwise separate counter source a
# command bridge, so the previous statement that the viewer counter has no
# commands is no longer true.
replace_once(
    'tests/unit/classicGenerator.test.tsx',
    "  it('says the counter has no commands of its own', () => {\n    mount();\n    expect(panel('[aria-labelledby=\"commands-heading\"]').textContent).toMatch(\n      /viewer counter has none/i,\n    );\n  });",
    "  it('documents the counter background bridge for the separate counter source', () => {\n    mount();\n    const text = panel('[aria-labelledby=\"commands-heading\"]').textContent ?? '';\n    expect(text).toContain('!multichat counterbgon');\n    expect(text).toContain('!multichat counterbgoff');\n    expect(text).toMatch(/separate viewer-counter browser source/i);\n  });",
)

# Every enrichment call must return a Promise. The default mock resolves to no
# profile; individual tests override it when they need a real avatar/profile.
replace_once(
    'tests/unit/twitchSharedChat.test.tsx',
    "  profile.mockReset();\n});",
    "  profile.mockReset();\n  profile.mockResolvedValue(null);\n});",
)

# The connector now enriches both the partner room and the configured local room
# while Shared Chat display is enabled. Keep only the partner request pending in
# this test so the second local lookup cannot overwrite the resolver being tested.
replace_once(
    'tests/unit/twitchSharedChat.test.tsx',
    "    let resolve!: (value: any) => void;\n    profile.mockImplementation(() => new Promise(result => { resolve = result; }));\n    const { messages, socket, onMessageUpdate } = startConnector();\n    socket.onmessage?.({ data: irc('partner', '200') });",
    "    let resolve!: (value: any) => void;\n    profile.mockImplementation((roomId: string) =>\n      roomId === '200'\n        ? new Promise(result => { resolve = result; })\n        : Promise.resolve(null),\n    );\n    const { messages, socket, onMessageUpdate } = startConnector();\n    socket.onmessage?.({ data: irc('partner', '200') });",
)
