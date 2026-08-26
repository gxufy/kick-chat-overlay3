from pathlib import Path

fixes = {
    'app/src/pages/multichat.tsx': [
        ("    /* Frame pacing is independent of the entrance animation. The old slide\\n       exclusion routed the default animation through a 200 ms publication\\n       timer, so bursts could only become visible at ~5 cadence points/sec.\\n       A dirty frame is still scheduled only on demand, never while idle. */\\n    const smoothRuntime = cfg.smoothScroll;",
         "    /* Frame pacing is independent of the entrance animation. The old slide\n       exclusion routed the default animation through a 200 ms publication\n       timer, so bursts could only become visible at ~5 cadence points/sec.\n       A dirty frame is still scheduled only on demand, never while idle. */\n    const smoothRuntime = cfg.smoothScroll;"),
    ],
    'app/src/components/overlay/ChatOverlay.tsx': [
        ("  /* Entrance style must not opt out of frame pacing. In particular slide is\\n     the default generated animation and was the exact path that still fell\\n     back to 200 ms / 5 Hz updates in OBS. */\\n  const smoothRuntime = cfg.smoothScroll;",
         "  /* Entrance style must not opt out of frame pacing. In particular slide is\n     the default generated animation and was the exact path that still fell\n     back to 200 ms / 5 Hz updates in OBS. */\n  const smoothRuntime = cfg.smoothScroll;"),
    ],
    'app/src/lib/render.tsx': [
        ("        style={{ display:'inline-flex', verticalAlign:'-0.1em', marginRight:'0.4em',\\n                 ...(iconShadowFilter ? { filter:iconShadowFilter } : {}) }}>",
         "        style={{ display:'inline-flex', verticalAlign:'-0.1em', marginRight:'0.4em',\n                 ...(iconShadowFilter ? { filter:iconShadowFilter } : {}) }}>")
    ],
}

for name, replacements in fixes.items():
    path = Path(name)
    text = path.read_text()
    for old, new in replacements:
        if text.count(old) != 1:
            raise SystemExit(f'{name}: expected one malformed generated-newline match')
        text = text.replace(old, new, 1)
    path.write_text(text)
