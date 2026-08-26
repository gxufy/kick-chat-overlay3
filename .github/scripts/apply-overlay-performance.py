from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'marker not found in {path}: {old[:160]!r}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


# 1) Stop rerendering every old rich message row when the parent receives a new
# message or a cosmetic/badge update for somebody else.
replace_once(
    'app/src/components/overlay/ChatOverlay.tsx',
    "import { Fragment, useEffect, useMemo, useRef, useState } from 'react';",
    "import { Fragment, memo, useEffect, useMemo, useRef, useState } from 'react';",
)

replace_once(
    'app/src/components/overlay/ChatOverlay.tsx',
    "function FadeGroup({ children }: { children: React.ReactNode }) {\n  const [op, setOp] = useState(0);\n  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setOp(1))); }, []);\n  return <div style={{ opacity:op, transition:'opacity 220ms ease-in-out' }}>{children}</div>;\n}\n\nexport default function ChatOverlay",
    "function FadeGroup({ children }: { children: React.ReactNode }) {\n  const [op, setOp] = useState(0);\n  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => setOp(1))); }, []);\n  return <div style={{ opacity:op, transition:'opacity 220ms ease-in-out' }}>{children}</div>;\n}\n\nconst MessageRow = memo(function MessageRow({\n  msg, fading, msgSlideIn, smoothRuntime, shadowVal, sz, emoteMaxH, emoteMaxW,\n  strokeVal, hideNames, tagMode, showAvatar, showSharedSource,\n}: {\n  msg: ParsedMessage; fading: boolean; msgSlideIn: boolean; smoothRuntime: boolean; shadowVal: string;\n  sz: typeof SIZE[SzKey]; emoteMaxH: string; emoteMaxW: string; strokeVal: string;\n  hideNames: boolean; tagMode: SourceTagMode; showAvatar: boolean; showSharedSource: boolean;\n}) {\n  return (\n    <div className={msgSlideIn ? 'gx-message-slide-in' : undefined} style={{\n      margin: '0 10px',\n      opacity: fading ? 0 : 1,\n      transition: fading ? 'opacity 400ms linear' : 'none',\n      ...(smoothRuntime && shadowVal ? { textShadow: shadowVal } : {}),\n    }}>\n      <MsgLine msg={msg} sz={sz} emoteMaxH={emoteMaxH} emoteMaxW={emoteMaxW}\n        stroke={strokeVal} hideNames={hideNames}\n        tagMode={tagMode} showAvatar={showAvatar} showSharedSource={showSharedSource} />\n    </div>\n  );\n});\n\nexport default function ChatOverlay",
)

# 2) Text shadow was implemented as a CSS filter over the entire chat subtree.
# Animated emotes force that large filtered surface to reraster continuously in
# OBS Chromium. Keep the same visual values as a real text-shadow instead.
replace_once(
    'app/src/components/overlay/ChatOverlay.tsx',
    "function getShadowFilter(s: string) {\n  if (s === 'small')  return 'drop-shadow(2px 2px 0.2rem black)';\n  if (s === 'medium') return 'drop-shadow(2px 2px 0.35rem black)';\n  if (s === 'large')  return 'drop-shadow(2px 2px 0.5rem black)';\n  return '';\n}",
    "function getShadowFilter(s: string) {\n  if (s === 'small')  return '2px 2px 0.2rem black';\n  if (s === 'medium') return '2px 2px 0.35rem black';\n  if (s === 'large')  return '2px 2px 0.5rem black';\n  return '';\n}",
)

# 3) Avoid a second parent render on every message update when nothing was
# deleted from the retained batch membership.
replace_once(
    'app/src/components/overlay/ChatOverlay.tsx',
    "  /* Sync deletions while preserving batch identity for every surviving row. */\n  useEffect(() => {\n    const ids = new Set(messages.map((message) => message.id));\n    setBatches((previous) => previous\n      .map((batch) => ({\n        ...batch,\n        messageIds: batch.messageIds.filter((id) => ids.has(id)),\n      }))\n      .filter((batch) => batch.messageIds.length));\n  }, [messages]);\n\n  const renderMsg = (msg: ParsedMessage) => (\n    <div key={msg.id} className={cfg.msgSlideIn ? 'gx-message-slide-in' : undefined} style={{\n      margin: '0 10px',\n\n      opacity: fadingIds.has(msg.id) ? 0 : 1,\n      transition: fadingIds.has(msg.id) ? 'opacity 400ms linear' : 'none',\n      ...(smoothRuntime && filterVal ? { filter: filterVal } : {}),\n\n    }}>\n      <MsgLine msg={msg} sz={sz} emoteMaxH={emoteMaxH} emoteMaxW={emoteMaxW}\n        stroke={strokeVal} hideNames={cfg.hideNames??false}\n        tagMode={tagMode}\n        showAvatar={cfg.showAvatars ?? false}\n        showSharedSource={showSharedSource} />\n    </div>\n  );",
    "  /* Sync deletions while preserving batch identity for every surviving row.\n     Returning the previous array when membership is unchanged avoids a redundant\n     full ChatOverlay render for every ordinary message arrival. */\n  useEffect(() => {\n    const ids = new Set(messages.map((message) => message.id));\n    setBatches((previous) => {\n      let changed = false;\n      const next: typeof previous = [];\n      for (const batch of previous) {\n        const messageIds = batch.messageIds.filter((id) => ids.has(id));\n        if (messageIds.length === batch.messageIds.length) {\n          next.push(batch);\n          continue;\n        }\n        changed = true;\n        if (messageIds.length) next.push({ ...batch, messageIds });\n      }\n      return changed ? next : previous;\n    });\n  }, [messages]);\n\n  const renderMsg = (msg: ParsedMessage) => (\n    <MessageRow key={msg.id}\n      msg={msg}\n      fading={fadingIds.has(msg.id)}\n      msgSlideIn={cfg.msgSlideIn ?? false}\n      smoothRuntime={smoothRuntime}\n      shadowVal={filterVal}\n      sz={sz}\n      emoteMaxH={emoteMaxH}\n      emoteMaxW={emoteMaxW}\n      strokeVal={strokeVal}\n      hideNames={cfg.hideNames ?? false}\n      tagMode={tagMode}\n      showAvatar={cfg.showAvatars ?? false}\n      showSharedSource={showSharedSource}\n    />\n  );",
)

replace_once(
    'app/src/components/overlay/ChatOverlay.tsx',
    "            animation: gxMessageSlideIn 250ms ease-out;\n            will-change: transform, opacity;\n            backface-visibility: hidden;",
    "            animation: gxMessageSlideIn 250ms ease-out;\n            backface-visibility: hidden;",
)

replace_once(
    'app/src/components/overlay/ChatOverlay.tsx',
    "                ...(!smoothRuntime && filterVal ? { filter:filterVal } : {}),",
    "        ...(!smoothRuntime && filterVal ? { textShadow:filterVal } : {}),",
)

replace_once(
    'app/src/components/overlay/ChatOverlay.tsx',
    "    ...(filterVal ? { filter:filterVal } : {}),",
    "    ...(filterVal ? { textShadow:filterVal } : {}),",
)

# 4) A successful 7TV lookup with no cosmetic is still a valid negative cache
# result. Previously we removed it from `seen`, so repeat chatters without paints
# or badges were queried again and again for the lifetime of the overlay.
replace_once(
    'app/src/lib/cosmetics.ts',
    "      if (typeof style !== 'object' || style === null || Array.isArray(style)) {\n        seen.delete(`${b.platform}:${b.senderId}`);\n        return;\n      }",
    "      if (typeof style !== 'object' || style === null || Array.isArray(style)) {\n        return;\n      }",
)
replace_once(
    'app/src/lib/cosmetics.ts',
    "      if (ent.paint || ent.badge) {\n        stores.entitlements[key] = ent;\n        applied.push(key);\n      } else {\n        seen.delete(key);\n      }",
    "      if (ent.paint || ent.badge) {\n        stores.entitlements[key] = ent;\n        applied.push(key);\n      }",
)

Path('app/tests/unit/cosmeticsPerformance.test.ts').write_text(r'''import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCosmeticsFetcher } from '@/lib/cosmetics';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('7TV cosmetics lookup caching', () => {
  it('negative-caches a successful lookup for a chatter with no cosmetics', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { u0: { style: { paint: null, badge: null } } } }),
    }) as Response);
    vi.stubGlobal('fetch', fetchMock);

    const stores = { paints: [], badges: [], entitlements: {} };
    const fetcher = createCosmeticsFetcher(stores, vi.fn());

    fetcher.want('twitch', '123');
    await vi.advanceTimersByTimeAsync(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetcher.want('twitch', '123');
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetcher.stop();
  });

  it('still permits a retry after an actual request failure', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { u0: { style: { paint: null, badge: null } } } }),
      } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const stores = { paints: [], badges: [], entitlements: {} };
    const fetcher = createCosmeticsFetcher(stores, vi.fn());

    fetcher.want('twitch', '456');
    await vi.advanceTimersByTimeAsync(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetcher.want('twitch', '456');
    await vi.advanceTimersByTimeAsync(500);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetcher.stop();
  });
});
''', encoding='utf-8')

Path('app/tests/unit/chatOverlayPerformance.test.tsx').write_text(r'''import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ChatOverlay from '@/components/overlay/ChatOverlay';
import { MultichatQuerySchema } from '@/lib/multichatConfig';
import type { ParsedMessage } from '@/lib/kick';

const message: ParsedMessage = {
  id: 'twitch:performance',
  platform: 'twitch',
  kind: 'chat',
  identity: { username: 'user', color: '#fff', background: '', filter: '', badges: [] },
  message: ['hello'],
};

afterEach(cleanup);

describe('chat overlay compositor-friendly rendering', () => {
  it('uses text-shadow instead of filtering the entire animated chat subtree', () => {
    const config = MultichatQuerySchema.parse({ twitch: 'channel', animation: 'none', textShadow: 'large' });
    const { container } = render(
      <ChatOverlay
        config={config}
        messages={[message]}
        fadingIds={new Set()}
        pinnedMessage={null}
        showLoader={false}
      />,
    );
    const chat = container.querySelector('#chat_container') as HTMLElement;
    expect(chat.style.filter).toBe('');
    expect(chat.style.textShadow).toContain('black');
  });
});
''', encoding='utf-8')

# One-shot maintenance helper removes itself so it cannot remain in the final tree.
Path('.github/scripts/apply-overlay-performance.py').unlink()
