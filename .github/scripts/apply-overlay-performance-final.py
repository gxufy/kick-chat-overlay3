from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


# ---------------------------------------------------------------------------
# ChatOverlay: CSS-only entrance effects, no offscreen measuring DOM/rAF state,
# no persistent compositor hint, and memoize the large dynamic stylesheet.
# ---------------------------------------------------------------------------
chat_path = Path('app/src/components/overlay/ChatOverlay.tsx')
chat = chat_path.read_text()

start = chat.index('function SlideGroup(')
end = chat.index('const MessageRow', start)
chat = chat[:start] + '''function SlideGroup({ children }: { children: React.ReactNode }) {
  /* CSS grid can interpolate 0fr -> 1fr against intrinsic content height.
     That gives the same 150ms empty-space opening before content is revealed,
     without mounting an offscreen copy, forcing getBoundingClientRect(), or
     coordinating React state with animation frames. The batch node stays
     mounted, so a late repaint/deletion cannot replay the entrance. */
  return (
    <div className="gx-slide-group">
      <div className="gx-slide-content">{children}</div>
    </div>
  );
}

function FadeGroup({ children }: { children: React.ReactNode }) {
  /* Pure CSS keeps the 220ms fade while removing two requestAnimationFrame
     callbacks and a React state update for every arriving batch. */
  return <div className="gx-fade-group">{children}</div>;
}

''' + chat[end:]

slide_css_anchor = '''          .gx-message-slide-in {
            animation: gxMessageSlideIn 250ms ease-out;
            backface-visibility: hidden;
          }
'''
slide_css_new = slide_css_anchor + '''
          @keyframes gxSlideGroupOpen {
            from { grid-template-rows: 0fr; }
            to   { grid-template-rows: 1fr; }
          }
          @keyframes gxSlideGroupReveal {
            from { visibility: hidden; }
            to   { visibility: visible; }
          }
          .gx-slide-group {
            display: grid;
            grid-template-rows: 0fr;
            animation: gxSlideGroupOpen 150ms ease-in-out forwards;
          }
          .gx-slide-content {
            min-height: 0;
            overflow: hidden;
            visibility: hidden;
            animation: gxSlideGroupReveal 150ms step-end forwards;
          }
          @keyframes gxFadeGroupIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          .gx-fade-group {
            animation: gxFadeGroupIn 220ms ease-in-out;
          }
'''
chat = replace_once(chat, slide_css_anchor, slide_css_new, 'entrance animation css')

chat = replace_once(
    chat,
    "          if (cfg.animation==='slide') return <SlideGroup key={id} fontSize={sz.fontSize} lineHeight={sz.lineHeight} fontFamily={fontFamily} >{content}</SlideGroup>;",
    "          if (cfg.animation==='slide') return <SlideGroup key={id}>{content}</SlideGroup>;",
    'SlideGroup call',
)
chat = replace_once(
    chat,
    "        willChange: smoothRuntime ? 'scroll-position' : undefined,\n",
    '',
    'persistent scroll-position will-change',
)

# Move the large dynamic CSS template into useMemo. Message arrival/repaint
# renders should not rebuild the same ~10KB string over and over.
style_marker = '<style>{`${LOCAL_OVERLAY_FONT_CSS}'
style_start = chat.index(style_marker)
literal_start = style_start + len('<style>{')
style_end = chat.index('}</style>', literal_start)
style_literal = chat[literal_start:style_end]
if not style_literal.startswith('`') or not style_literal.endswith('`'):
    raise RuntimeError('overlay stylesheet template boundaries changed')
chat = chat[:style_start] + '<style>{overlayCss}</style>' + chat[style_end + len('}</style>'):]

render_msg_marker = '  const renderMsg = (msg: ParsedMessage) => ('
render_msg_start = chat.index(render_msg_marker)
return_pos = chat.index('\n  return (', render_msg_start)
memo_block = f'''\n  /* Visual configuration is static for the lifetime of a browser-source mount.
     Memoizing this template prevents message traffic from reconstructing a large
     CSS string while preserving the exact same stylesheet and renderer. */
  const overlayCss = useMemo(() => {style_literal}, [cfg, sz, emoteMaxW, emoteMaxH]);\n'''
chat = chat[:return_pos] + memo_block + chat[return_pos:]
chat_path.write_text(chat)


# ---------------------------------------------------------------------------
# render.tsx: turn 7TV word matching from repeated O(words * emotes) scans into
# O(words) lookups. Cache by array identity and preserve Array.find semantics:
# for duplicate names the FIRST emote still wins.
# ---------------------------------------------------------------------------
render_path = Path('app/src/lib/render.tsx')
render = render_path.read_text()
lookup_anchor = '''/* Word-level 7TV swap for a plain-text segment (Kick), with zero-width
   emotes overlaying the previous emote — behavior carried over from the
   original parseMessageText. */
'''
lookup_block = '''const EMOTES_BY_NAME = new WeakMap<SevenTVEmote[], Map<string, SevenTVEmote>>();

function emotesByName(emotes: SevenTVEmote[]): Map<string, SevenTVEmote> {
  const cached = EMOTES_BY_NAME.get(emotes);
  if (cached) return cached;
  const lookup = new Map<string, SevenTVEmote>();
  /* Array.find used to choose the first duplicate. Keep that exact behavior. */
  for (const emote of emotes) {
    if (!lookup.has(emote.name)) lookup.set(emote.name, emote);
  }
  EMOTES_BY_NAME.set(emotes, lookup);
  return lookup;
}

''' + lookup_anchor
render = replace_once(render, lookup_anchor, lookup_block, '7TV lookup cache insertion')
render = replace_once(
    render,
    "  const nodes: React.ReactNode[] = [];\n  const words = segment.split(' ');",
    "  const nodes: React.ReactNode[] = [];\n  const words = segment.split(' ');\n  const lookup = emotesByName(emotes);",
    '7TV segment lookup init',
)
render = replace_once(render, '    const emote = emotes.find(e => e.name === word);', '    const emote = lookup.get(word);', '7TV base lookup')
render = replace_once(render, '      const next = emotes.find(e => e.name === words[i + 1]);', '      const next = lookup.get(words[i + 1]);', '7TV zero-width lookup')
render = replace_once(render, "    const nextIsEmote = i + 1 < words.length && emotes.some(e => e.name === words[i + 1]);", "    const nextIsEmote = i + 1 < words.length && lookup.has(words[i + 1]);", '7TV lookahead lookup')
render_path.write_text(render)


# ---------------------------------------------------------------------------
# multichatMessageModel: cosmetic badge/paint IDs are looked up for every
# entitled message. Cache first-by-id maps by immutable array identity.
# ---------------------------------------------------------------------------
model_path = Path('app/src/lib/multichatMessageModel.tsx')
model = model_path.read_text()
model_anchor = '''/**
 * Convert one normalized message into the renderable form ChatOverlay consumes.
'''
model_cache = '''const BADGES_BY_ID = new WeakMap<SevenTVBadge[], Map<string, SevenTVBadge>>();
const PAINTS_BY_ID = new WeakMap<SevenTVPaint[], Map<string, SevenTVPaint>>();

function badgeById(badges: SevenTVBadge[], id: string): SevenTVBadge | undefined {
  let lookup = BADGES_BY_ID.get(badges);
  if (!lookup) {
    lookup = new Map<string, SevenTVBadge>();
    for (const badge of badges) if (!lookup.has(badge.id)) lookup.set(badge.id, badge);
    BADGES_BY_ID.set(badges, lookup);
  }
  return lookup.get(id);
}

function paintById(paints: SevenTVPaint[], id: string): SevenTVPaint | undefined {
  let lookup = PAINTS_BY_ID.get(paints);
  if (!lookup) {
    lookup = new Map<string, SevenTVPaint>();
    for (const paint of paints) if (!lookup.has(paint.id)) lookup.set(paint.id, paint);
    PAINTS_BY_ID.set(paints, lookup);
  }
  return lookup.get(id);
}

''' + model_anchor
model = replace_once(model, model_anchor, model_cache, 'cosmetic lookup cache insertion')
model = replace_once(model, '        const badge = cosmetics.badges.find((b) => b.id === entitlement.badge);', '        const badge = badgeById(cosmetics.badges, entitlement.badge);', 'badge id lookup')
model = replace_once(model, '        const paint = cosmetics.paints.find((p) => p.id === entitlement.paint);', '        const paint = paintById(cosmetics.paints, entitlement.paint);', 'paint id lookup')
model_path.write_text(model)


# ---------------------------------------------------------------------------
# Regression tests: entrance batches stay one renderer/batch and the old
# offscreen measurement path cannot creep back; compositor hint stays absent.
# ---------------------------------------------------------------------------
entrance_path = Path('app/tests/unit/chatOverlayEntranceQueue.test.tsx')
entrance_path.write_text('''import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ChatOverlay from '@/components/overlay/ChatOverlay';
import { MultichatQuerySchema } from '@/lib/multichatConfig';
import type { ParsedMessage } from '@/lib/kick';
import type { Platform } from '@/lib/types';

const parsed = (platform: Platform, id: string, body = id): ParsedMessage => ({
  id: `${platform}:${id}`,
  platform,
  kind: 'chat',
  identity: { username: id, color: '#fff', background: '', filter: '', badges: [] },
  message: [body],
});

const props = (animation: 'slide' | 'fade' | 'none', platform: Platform = 'twitch') => ({
  config: MultichatQuerySchema.parse({ [platform]: 'channel', animation }),
  fadingIds: new Set<string>(),
  pinnedMessage: null,
  showLoader: false as const,
  sourceTagExplicit: true,
});

afterEach(cleanup);

describe('shared batch entrance', () => {
  it.each(['twitch', 'kick', 'tiktok'] as const)('uses one CSS-only SlideGroup for one %s flush', (platform) => {
    const messages = [parsed(platform, 'one'), parsed(platform, 'two'), parsed(platform, 'three')];
    const { container } = render(<ChatOverlay {...props('slide', platform)} messages={messages} />);
    const groups = container.querySelectorAll('.gx-slide-group');
    expect(groups).toHaveLength(1);
    expect(groups[0].querySelectorAll('.ck-body')).toHaveLength(3);
    expect(container.querySelectorAll('[data-slide-ghost]')).toHaveLength(0);
    expect(container.innerHTML).not.toContain('-9999px');
  });

  it('repaints a same-ID row without adding another entrance batch', () => {
    const before = parsed('twitch', 'stable', 'before');
    const { container, rerender } = render(<ChatOverlay {...props('slide')} messages={[before]} />);
    expect(container.querySelectorAll('.gx-slide-group')).toHaveLength(1);
    rerender(<ChatOverlay {...props('slide')} messages={[parsed('twitch', 'stable', 'after')]} />);
    expect(container.querySelectorAll('.gx-slide-group')).toHaveLength(1);
    expect(container.textContent).toContain('after');
  });

  it('removes a deleted member without replaying or duplicating the surviving batch', () => {
    const one = parsed('twitch', 'one');
    const two = parsed('twitch', 'two');
    const { container, rerender } = render(<ChatOverlay {...props('slide')} messages={[one, two]} />);
    rerender(<ChatOverlay {...props('slide')} messages={[one]} />);
    expect(container.querySelectorAll('.gx-slide-group')).toHaveLength(1);
    expect(container.textContent).toContain('one');
    expect(container.textContent).not.toContain('two');
  });

  it.each(['fade', 'none'] as const)('%s preserves one immediate shared batch', (animation) => {
    const messages = [parsed('twitch', 'one'), parsed('twitch', 'two')];
    const { container } = render(<ChatOverlay {...props(animation)} messages={messages} />);
    expect(container.querySelectorAll('.ck-body')).toHaveLength(2);
    expect(container.querySelectorAll('[data-slide-ghost]')).toHaveLength(0);
  });
});
''')

perf_path = Path('app/tests/unit/chatOverlayPerformance.test.tsx')
perf = perf_path.read_text()
perf_insert = '''

  it('does not keep the scrolling subtree permanently promoted', () => {
    const config = MultichatQuerySchema.parse({ twitch: 'channel', animation: 'none', smoothScroll: true });
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
    expect(chat.style.willChange).toBe('');
  });
'''
closing = '\n});\n'
if not perf.endswith(closing):
    raise RuntimeError('chatOverlayPerformance test ending changed')
perf = perf[:-len(closing)] + perf_insert + closing
perf_path.write_text(perf)

hot_path = Path('app/tests/unit/renderHotPathPerformance.test.tsx')
hot_path.write_text('''import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderMessageText } from '@/lib/render';
import type { SevenTVEmote } from '@/lib/kick';
import type { UnifiedMessage } from '@/lib/types';

const message: UnifiedMessage = {
  platform: 'twitch',
  id: 'hot-path',
  senderId: 'user-1',
  username: 'user',
  color: '#ffffff',
  badges: [],
  text: 'Wave',
  emotes: [],
  timestamp: 1,
  kind: 'chat',
};

const emote = (image: string): SevenTVEmote => ({
  name: 'Wave',
  image,
  height: 32,
  width: 32,
  zeroWidth: false,
  upscale: false,
});

describe('render hot-path caches', () => {
  it('preserves first-match semantics when a 7TV set contains duplicate names', () => {
    const set = [emote('https://cdn.example/first.webp'), emote('https://cdn.example/second.webp')];
    const nodes = renderMessageText(message, set);
    const { container } = render(<>{nodes}</>);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://cdn.example/first.webp');
  });
});
''')

# This is a one-shot verified migration. Remove its machinery from the final tree
# so production carries only the optimized runtime and regression tests.
Path('.github/scripts/apply-overlay-performance-final.py').unlink()
Path('.github/workflows/maintenance-overlay-performance.yml').unlink()
