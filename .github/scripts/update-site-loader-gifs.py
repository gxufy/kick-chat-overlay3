from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"expected text not found in {path}: {old!r}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    "src/pages/index.tsx",
    '<img className="hero-avatar" src="/gxufy-avatar.jpg" alt="Gxufy" />',
    '<img className="hero-avatar" src="/gxufy-avatar.gif" alt="Gxufy" />',
)

replace_once(
    "src/components/overlay/ChatOverlay.tsx",
    '<img className="ck-startup-logo" src="/tpl.webp" alt="" width={104} height={104} />',
    '<img className="ck-startup-logo" src="/tpl.gif" alt="" width={104} height={104} />',
)

replace_once(
    "tests/unit/chatStartupLoader.test.tsx",
    "expect(loader.querySelector('img')?.getAttribute('src')).toBe('/tpl.webp');",
    "expect(loader.querySelector('img')?.getAttribute('src')).toBe('/tpl.gif');",
)

replace_once(
    "tests/unit/homepageRoutes.test.tsx",
    "describe('homepage product cards', () => {\n  it('links the generator and the counter panel at their canonical addresses', () => {",
    "describe('homepage product cards', () => {\n  it('uses the supplied GIF as the homepage logo', () => {\n    render(<HomePage />);\n    expect(document.querySelector('img.hero-avatar')?.getAttribute('src')).toBe('/gxufy-avatar.gif');\n  });\n\n  it('links the generator and the counter panel at their canonical addresses', () => {",
)
