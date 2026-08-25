from pathlib import Path

p = Path('src/pages/multichat.tsx')
text = p.read_text()
old = "    const cfg = parsed.data;"
new = """    const cfg = {
      ...parsed.data,
      // Smooth handling is the normal runtime path. Existing/generated URLs do
      // not need a flag; smoothScroll=0/false is the explicit legacy fallback.
      smoothScroll: router.query.smoothScroll === undefined
        ? true
        : parsed.data.smoothScroll,
    };"""
if old not in text:
    raise SystemExit('runtime config assignment not found')
p.write_text(text.replace(old, new, 1))
