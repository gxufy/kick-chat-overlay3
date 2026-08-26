from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1))


# The page previously disabled frame publication whenever animation=slide,
# sending the default slide path back to a fixed 200 ms (5 Hz) publication
# interval. Keep the explicit smoothScroll=false fallback, but frame-pace slide
# just like the other animations.
replace_once(
    "app/src/pages/multichat.tsx",
    "    const smoothRuntime = cfg.smoothScroll && cfg.animation !== 'slide';",
    "    /* Frame pacing is independent of the entrance animation. The old slide\\n"
    "       exclusion routed the default animation through a 200 ms publication\\n"
    "       timer, so bursts could only become visible at ~5 cadence points/sec.\\n"
    "       A dirty frame is still scheduled only on demand, never while idle. */\\n"
    "    const smoothRuntime = cfg.smoothScroll;",
)

# ChatOverlay must use the same rule as the page or slide rows get rAF-published
# but still skip the continuous bottom follower.
replace_once(
    "app/src/components/overlay/ChatOverlay.tsx",
    "  const smoothRuntime = cfg.smoothScroll && cfg.animation !== 'slide';",
    "  /* Entrance style must not opt out of frame pacing. In particular slide is\\n"
    "     the default generated animation and was the exact path that still fell\\n"
    "     back to 200 ms / 5 Hz updates in OBS. */\\n"
    "  const smoothRuntime = cfg.smoothScroll;",
)

# Replace the layout-animated 0fr -> 1fr slide group with an immediately sized
# wrapper whose child animation is transform/opacity only. The scroll follower
# handles the changing stack position; this entrance stays on compositor-friendly
# properties and does not recalculate grid tracks on every animation frame.
replace_once(
    "app/src/components/overlay/ChatOverlay.tsx",
    '''function SlideGroup({ children }: { children: React.ReactNode }) {
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
}''',
    '''function SlideGroup({ children }: { children: React.ReactNode }) {
  /* The batch enters layout at its real height immediately so the one scroll
     follower can track the true bottom even while messages are bursting. The
     visible entrance itself uses only transform/opacity; unlike grid-track or
     height animation, it does not force layout on every animation frame. */
  return (
    <div className="gx-slide-group">
      <div className="gx-slide-content">{children}</div>
    </div>
  );
}''',
)

replace_once(
    "app/src/components/overlay/ChatOverlay.tsx",
    '''          @keyframes gxSlideGroupOpen {
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
          .gx-slide-group .gx-message-slide-in {
            /* The measured ghost used to remount the visible row after 150ms,
               so preserve that exact visible start time without ghost DOM. */
            animation-delay: 150ms;
          }''',
    '''          @keyframes gxSlideGroupReveal {
            from { opacity: 0; transform: translate3d(0, 0.55em, 0); }
            to   { opacity: 1; transform: translate3d(0, 0, 0); }
          }
          .gx-slide-group {
            overflow: hidden;
          }
          .gx-slide-content {
            min-height: 0;
            animation: gxSlideGroupReveal 150ms ease-out both;
            backface-visibility: hidden;
          }
          .gx-slide-group .gx-message-slide-in {
            /* Keep the independent per-row slide from fighting the batch
               entrance during its first 150 ms. */
            animation-delay: 150ms;
          }''',
)

replace_once(
    "app/src/components/overlay/ChatOverlay.tsx",
    '''          @media (prefers-reduced-motion: reduce) {
            .gx-message-slide-in { animation: none; }
          }''',
    '''          @media (prefers-reduced-motion: reduce) {
            .gx-message-slide-in,
            .gx-slide-content { animation: none; }
          }''',
)

# Platform marks are alpha graphics, so text-shadow does not affect them. Feed
# the configured drop-shadow filter into sourceTag's icon wrapper instead.
replace_once(
    "app/src/components/overlay/ChatOverlay.tsx",
    "  const tag = visualPlatform ? sourceTag(visualPlatform, tagMode) : null;",
    "  const tag = visualPlatform ? sourceTag(visualPlatform, tagMode, visualShadowFilter) : null;",
)

replace_once(
    "app/src/lib/render.tsx",
    "export function sourceTag(platform: Platform, mode: SourceTagMode): React.ReactNode {",
    "export function sourceTag(platform: Platform, mode: SourceTagMode, iconShadowFilter = ''): React.ReactNode {",
)
replace_once(
    "app/src/lib/render.tsx",
    "        style={{ display:'inline-flex', verticalAlign:'-0.1em', marginRight:'0.4em' }}>",
    "        style={{ display:'inline-flex', verticalAlign:'-0.1em', marginRight:'0.4em',\\n"
    "                 ...(iconShadowFilter ? { filter:iconShadowFilter } : {}) }}>",
)

# Async image decode keeps an image becoming ready from monopolizing the same
# main-thread turn that is trying to present a burst of chat. It changes neither
# source selection nor dimensions.
replace_once(
    "app/src/lib/render.tsx",
    'return <img key={key} className={`ck-emote${upscale ? \' ck-upscale\' : \'\'}`} src={src} alt={alt} onError={handleAssetError} />;',
    'return <img key={key} className={`ck-emote${upscale ? \' ck-upscale\' : \'\'}`} src={src} alt={alt} decoding="async" onError={handleAssetError} />;',
)
replace_once(
    "app/src/lib/render.tsx",
    '''      alt={alt}
      style={backgroundColor ? { backgroundColor } : undefined}
      onError={handleAssetError}''',
    '''      alt={alt}
      decoding="async"
      style={backgroundColor ? { backgroundColor } : undefined}
      onError={handleAssetError}''',
)
replace_once(
    "app/src/lib/render.tsx",
    'return <img src="/platform-twitch.png" alt="Twitch" style={iconImgStyle} />;',
    'return <img src="/platform-twitch.png" alt="Twitch" style={iconImgStyle} decoding="async" />;',
)
replace_once(
    "app/src/lib/render.tsx",
    'return <img src="/platform-tiktok.png" alt="TikTok" style={iconImgStyle} />;',
    'return <img src="/platform-tiktok.png" alt="TikTok" style={iconImgStyle} decoding="async" />;',
)

# Twitch IRC already supplies reply-parent-* tags and parseTags already unescapes
# their values. Normalize them into the same UnifiedReply shape Kick uses, so the
# existing universal reply renderer can display them without a Twitch-only UI.
replace_once(
    "app/src/lib/connectors/twitch.ts",
    '''    const sharedChat = Boolean(sourceRoomId && sourceRoomId !== localRoomId);
    const message: UnifiedMessage = {''',
    '''    const sharedChat = Boolean(sourceRoomId && sourceRoomId !== localRoomId);
    const replyUsername = tags['reply-parent-display-name'] || tags['reply-parent-user-login'];
    const hasReplyBody = Object.prototype.hasOwnProperty.call(tags, 'reply-parent-msg-body');
    const reply = replyUsername && (tags['reply-parent-msg-id'] || hasReplyBody)
      ? {
          username: replyUsername,
          text: tags['reply-parent-msg-body'] ?? '',
          ...(tags['reply-parent-msg-id'] ? { messageId: tags['reply-parent-msg-id'] } : {}),
          ...(tags['reply-parent-user-id'] ? { senderId: tags['reply-parent-user-id'] } : {}),
        }
      : undefined;
    const message: UnifiedMessage = {''',
)
replace_once(
    "app/src/lib/connectors/twitch.ts",
    '''      ...(effectiveSourceRoomId ? { sourceChannel: { roomId: effectiveSourceRoomId } } : {}),
      ...(sharedChat ? { sharedChat: true } : {}),''',
    '''      ...(reply ? { reply } : {}),
      ...(effectiveSourceRoomId ? { sourceChannel: { roomId: effectiveSourceRoomId } } : {}),
      ...(sharedChat ? { sharedChat: true } : {}),''',
)
replace_once(
    "app/src/lib/types.ts",
    "/** Provider-native reply preview (currently Kick). */",
    "/** Provider-native reply preview (currently Kick + Twitch). */",
)

# Add direct regressions for icon shadows, Twitch reply normalization/rendering,
# and the slide hot path no longer using layout-track animation.
Path("app/tests/unit/platformIconShadow.test.tsx").write_text('''import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ChatOverlay from '@/components/overlay/ChatOverlay';
import { MultichatQuerySchema } from '@/lib/multichatConfig';
import type { ParsedMessage } from '@/lib/kick';
import type { Platform } from '@/lib/types';

afterEach(cleanup);

const message = (platform: Platform): ParsedMessage => ({
  id: `${platform}:icon-shadow`,
  platform,
  kind: 'chat',
  identity: { username: 'User', color: '#fff', background: '', filter: '', badges: [] },
  message: ['hello'],
});

describe('platform icon shadow parity', () => {
  it('applies the configured drop shadow to every platform logo', () => {
    for (const platform of ['kick', 'twitch', 'youtube', 'tiktok'] as const) {
      const config = MultichatQuerySchema.parse({
        [platform]: 'channel',
        sourceTag: 'icon',
        textShadow: 'small',
        animation: 'none',
      });
      const { container } = render(
        <ChatOverlay
          config={config}
          messages={[message(platform)]}
          fadingIds={new Set()}
          pinnedMessage={null}
          showLoader={false}
          sourceTagExplicit
        />,
      );
      const marker = container.querySelector('[data-source-tag="icon"]') as HTMLElement;
      expect(marker).not.toBeNull();
      expect(marker.style.filter).toBe('drop-shadow(2px 2px 0.2rem black)');
      cleanup();
    }
  });

  it('does not invent a logo shadow when text shadow is disabled', () => {
    const config = MultichatQuerySchema.parse({
      twitch: 'channel', sourceTag: 'icon', textShadow: 'none', animation: 'none',
    });
    const { container } = render(
      <ChatOverlay config={config} messages={[message('twitch')]} fadingIds={new Set()}
        pinnedMessage={null} showLoader={false} sourceTagExplicit />,
    );
    expect((container.querySelector('[data-source-tag="icon"]') as HTMLElement).style.filter).toBe('');
  });
});
''')

Path("app/tests/unit/twitchReplies.test.tsx").write_text('''import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatOverlay from '@/components/overlay/ChatOverlay';
import { createTwitchConnector } from '@/lib/connectors/twitch';
import { MultichatQuerySchema } from '@/lib/multichatConfig';
import { buildParsedMessage, NO_COSMETICS } from '@/lib/multichatMessageModel';
import type { UnifiedMessage } from '@/lib/types';

vi.mock('@/lib/twitchProfileClient', () => ({ fetchTwitchProfile: vi.fn(async () => null) }));
vi.mock('@/lib/twitchEmotes', () => ({ loadFFZRoomBadges: vi.fn(async () => ({})) }));
vi.mock('@/lib/communityBadges', () => ({ resolveTwitchCommunityBadges: vi.fn(async () => []) }));

class FakeSocket {
  static last: FakeSocket;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];
  constructor() { FakeSocket.last = this; }
  send(value: string) { this.sent.push(value); }
  close() {}
}

beforeEach(() => {
  vi.stubGlobal('WebSocket', FakeSocket);
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function receive(line: string): UnifiedMessage {
  const messages: UnifiedMessage[] = [];
  const connector = createTwitchConnector({
    channel: 'local',
    onMessage: message => messages.push(message),
    onDelete: vi.fn(),
    onPin: vi.fn(),
    onStatus: vi.fn(),
    shouldEnrichSourceChannel: () => false,
  });
  connector.start();
  FakeSocket.last.onmessage?.({ data: `${line}\\r\\n` });
  expect(messages).toHaveLength(1);
  connector.stop();
  return messages[0];
}

describe('Twitch native replies', () => {
  it('normalizes Twitch reply-parent tags into the same reply model Kick renders', () => {
    const message = receive(
      '@display-name=ReplyGuy;id=child;room-id=100;user-id=9;reply-parent-msg-id=parent;reply-parent-user-id=42;reply-parent-user-login=parentlogin;reply-parent-display-name=ParentUser;reply-parent-msg-body=hello\\sworld :reply!r@r PRIVMSG #local :my reply',
    );
    expect(message.reply).toEqual({
      username: 'ParentUser',
      text: 'hello world',
      messageId: 'parent',
      senderId: '42',
    });
  });

  it('leaves ordinary Twitch chat without a reply preview', () => {
    const message = receive(
      '@display-name=Plain;id=plain;room-id=100;user-id=9 :plain!p@p PRIVMSG #local :hello',
    );
    expect(message.reply).toBeUndefined();
  });

  it('uses the existing universal Kick-style reply renderer for Twitch', () => {
    const raw = receive(
      '@display-name=ReplyGuy;id=child2;room-id=100;user-id=9;reply-parent-msg-id=parent2;reply-parent-user-id=42;reply-parent-display-name=ParentUser;reply-parent-msg-body=quoted\\smessage :reply!r@r PRIVMSG #local :answer',
    );
    const config = MultichatQuerySchema.parse({ twitch: 'local', animation: 'none' });
    const parsed = buildParsedMessage(raw, config, NO_COSMETICS, { enabled: true, colors: new Map() }, 1);
    render(
      <ChatOverlay config={config} messages={[parsed]} fadingIds={new Set()}
        pinnedMessage={null} showLoader={false} />,
    );
    expect(screen.getByText('ParentUser').parentElement?.textContent).toContain('quoted message');
    expect(screen.getByText('answer')).toBeTruthy();
  });
});
''')

# Strengthen an existing slide test so a future animation refactor cannot quietly
# reintroduce grid/height layout animation or disable the frame-paced container.
p = Path("app/tests/unit/smoothScroll.test.tsx")
text = p.read_text()
old = '''    expect(container.querySelector('.gx-message-slide-in')).not.toBeNull();
  });'''
new = '''    expect(container.querySelector('.gx-message-slide-in')).not.toBeNull();
    const chat = container.querySelector('#chat_container') as HTMLElement;
    expect(chat.style.display).toBe('flex');
    expect(chat.style.maxHeight).toBe('calc(100vh - 20px)');
    const css = Array.from(document.querySelectorAll('style')).map(node => node.textContent ?? '').join('\\n');
    expect(css).not.toContain('grid-template-rows');
    expect(css).toContain('translate3d(0, 0.55em, 0)');
  });'''
if text.count(old) != 1:
    raise SystemExit("smoothScroll.test.tsx: expected assertion insertion point once")
p.write_text(text.replace(old, new, 1))
