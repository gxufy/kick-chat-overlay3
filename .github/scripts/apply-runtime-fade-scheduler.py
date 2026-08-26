from pathlib import Path

path = Path('app/src/pages/multichat.tsx')
text = path.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    text = text.replace(old, new, 1)


replace_once(
    "import { createCosmeticsFetcher } from '../lib/cosmetics';\n",
    "import { createCosmeticsFetcher } from '../lib/cosmetics';\n"
    "import { createMessageFadeScheduler } from '../lib/messageFadeScheduler';\n",
    'scheduler import',
)

replace_once(
    "    const flushInterval: ReturnType<typeof setInterval> | null = smoothRuntime\n"
    "      ? null\n"
    "      : setInterval(flushMessages, 200);\n",
    "    const flushInterval: ReturnType<typeof setInterval> | null = smoothRuntime\n"
    "      ? null\n"
    "      : setInterval(flushMessages, 200);\n"
    "    let fadeScheduler: ReturnType<typeof createMessageFadeScheduler> | null = null;\n",
    'scheduler declaration',
)

replace_once(
    "      markDirty();\n"
    "      dismissLoaderWhenEligible();\n",
    "      markDirty();\n"
    "      fadeScheduler?.wake();\n"
    "      dismissLoaderWhenEligible();\n",
    'message wake',
)

old_fade = """    let fadeInterval: ReturnType<typeof setInterval> | null = null;
    if (cfg.fade !== false) {
      const fadeMs = (cfg.fade as number) * 1000;
      const fadingSet = new Set<string>();
      fadeInterval = setInterval(() => {
        const cutoff = Date.now() - fadeMs;
        const expired = s.messages.find(
          m => (m.timestamp ?? 0) <= cutoff && !fadingSet.has(m.id)
        );
        if (!expired) return;
        fadingSet.add(expired.id);
        setFadingIds(new Set(fadingSet));
        setTimeout(() => {
          fadingSet.delete(expired.id);
          s.messages = s.messages.filter(m => m.id !== expired.id);
          markDirty(); // removal uses the active flush policy
          setFadingIds(new Set(fadingSet));
        }, 400);
      }, 200);
    }
"""
new_fade = """    if (cfg.fade !== false) {
      fadeScheduler = createMessageFadeScheduler({
        getMessages: () => s.messages,
        fadeMs: (cfg.fade as number) * 1000,
        onFadingChange: setFadingIds,
        onRemove: (id) => {
          s.messages = s.messages.filter((message) => message.id !== id);
          markDirty(); // removal uses the active flush policy
        },
      });
      // A connector may synchronously seed messages during start(). Arm the
      // first deadline once here even when addMessage ran before the scheduler
      // existed; later arrivals call wake() themselves.
      fadeScheduler.wake();
    }
"""
replace_once(old_fade, new_fade, 'fade interval block')

replace_once(
    "      if (fadeInterval) clearInterval(fadeInterval);\n",
    "      fadeScheduler?.stop();\n",
    'fade cleanup',
)

path.write_text(text, encoding='utf-8')
