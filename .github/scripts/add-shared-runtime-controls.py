from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"expected text not found in {path}: {old[:220]!r}")
    p.write_text(text.replace(old, new, 1))


def write(path: str, content: str) -> None:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)


# ---------------------------------------------------------------------------
# Unified Twitch source metadata: always retain the source room id, and mark
# only partner-room messages as actual Shared Chat traffic.
# ---------------------------------------------------------------------------
replace_once(
    "src/lib/types.ts",
    "  /** Shared Chat source streamer; distinct from the message author. */\n  sourceChannel?: TwitchSourceChannel;",
    "  /** Twitch source streamer identity used when Shared Chat display is enabled. */\n  sourceChannel?: TwitchSourceChannel;\n  /** True only when this message originated in a partner room via Twitch Shared Chat. */\n  sharedChat?: boolean;",
)

replace_once(
    "src/lib/connectors/twitch.ts",
    "  /** Badge art changed after messages may already have been delivered. */\n  onBadgeMap?(badgeMap: Readonly<Record<string, string>>): void;",
    "  /** Badge art changed after messages may already have been delivered. */\n  onBadgeMap?(badgeMap: Readonly<Record<string, string>>): void;\n  /** Runtime gate for source-streamer profile enrichment. */\n  shouldEnrichSourceChannel?(): boolean;",
)
replace_once(
    "src/lib/connectors/twitch.ts",
    "  function enrichSharedMessage(message: UnifiedMessage): void {\n    const roomId = message.sourceChannel?.roomId;\n    if (!roomId) return;",
    "  function enrichSharedMessage(message: UnifiedMessage): void {\n    const roomId = message.sourceChannel?.roomId;\n    if (!roomId) return;\n    /* The room id stays on every Twitch row so Shared Chat can be enabled at\n       runtime, but profile traffic is skipped while the feature is off. A\n       local !multichat sharedon command flips the gate during onMessage, before\n       deliver() reaches this enrichment step, so that very message can receive\n       its source avatar without reconnecting. */\n    if (opts.shouldEnrichSourceChannel?.() === false) return;",
)
replace_once(
    "src/lib/connectors/twitch.ts",
    "    const sourceRoomId = tags['source-room-id'];\n    const localRoomId = tags['room-id'];\n    const message: UnifiedMessage = {",
    "    const sourceRoomId = tags['source-room-id'];\n    const localRoomId = tags['room-id'];\n    const effectiveSourceRoomId = sourceRoomId || localRoomId;\n    const sharedChat = Boolean(sourceRoomId && sourceRoomId !== localRoomId);\n    const message: UnifiedMessage = {",
)
replace_once(
    "src/lib/connectors/twitch.ts",
    "      category,\n      ...(sourceRoomId && sourceRoomId !== localRoomId ? { sourceChannel: { roomId: sourceRoomId } } : {}),\n    };",
    "      category,\n      ...(effectiveSourceRoomId ? { sourceChannel: { roomId: effectiveSourceRoomId } } : {}),\n      ...(sharedChat ? { sharedChat: true } : {}),\n    };",
)

# ---------------------------------------------------------------------------
# Shared Chat query/config setting. Default OFF everywhere; true is explicit.
# ---------------------------------------------------------------------------
replace_once(
    "src/lib/multichatConfig.ts",
    "  /* bChat smooth-scroll is opt-in for existing overlay URLs; new generator URLs enable it. */\n  smoothScroll: z.string().optional().transform(v => v === '1' || v === 'true'),",
    "  /* bChat smooth-scroll is opt-in for existing overlay URLs; new generator URLs enable it. */\n  smoothScroll: z.string().optional().transform(v => v === '1' || v === 'true'),\n  /* Twitch Shared Chat partner messages + source-streamer avatars. Default OFF. */\n  sharedChatEnabled: z.string().optional().transform(v => v === '1' || v === 'true'),",
)
replace_once(
    "src/lib/multichatConfig.ts",
    "  /** Smoothly scroll the message stack as new rows arrive. */\n  smoothScroll: boolean;\n  modAction: boolean;",
    "  /** Smoothly scroll the message stack as new rows arrive. */\n  smoothScroll: boolean;\n  /** Include Twitch Shared Chat partner rows and show source-streamer avatars. */\n  sharedChatEnabled: boolean;\n  modAction: boolean;",
)
replace_once(
    "src/lib/multichatConfig.ts",
    "  msgSlideIn: false,\n  smoothScroll: false,\n  modAction: true,",
    "  msgSlideIn: false,\n  smoothScroll: false,\n  sharedChatEnabled: false,\n  modAction: true,",
)
replace_once(
    "src/lib/multichatConfig.ts",
    "    mentionColor, bgColor, emoteScale, msgBold, msgCaps, msgSlideIn, smoothScroll, modAction,\n    paintShadows, fontColor, pinPlatforms: effectivePinPlats, hideNames,",
    "    mentionColor, bgColor, emoteScale, msgBold, msgCaps, msgSlideIn, smoothScroll, sharedChatEnabled, modAction,\n    paintShadows, fontColor, pinPlatforms: effectivePinPlats, hideNames,",
)
replace_once(
    "src/lib/multichatConfig.ts",
    "    ...(workspaceStyle\n      ? (smoothScroll ? {} : { smoothScroll: '0' })\n      : (smoothScroll ? { smoothScroll: '1' } : {})),\n    ...(modAction ? {} : { modAction: 'false' }),",
    "    ...(workspaceStyle\n      ? (smoothScroll ? {} : { smoothScroll: '0' })\n      : (smoothScroll ? { smoothScroll: '1' } : {})),\n    ...(sharedChatEnabled ? { sharedChatEnabled: '1' } : {}),\n    ...(modAction ? {} : { modAction: 'false' }),",
)

replace_once(
    "src/features/multichat/config.ts",
    "    msgSlideIn: keepBoolean(style.msgSlideIn, d.msgSlideIn),\n    smoothScroll: keepBoolean(style.smoothScroll, d.smoothScroll),\n    modAction: keepBoolean(style.modAction, d.modAction),",
    "    msgSlideIn: keepBoolean(style.msgSlideIn, d.msgSlideIn),\n    smoothScroll: keepBoolean(style.smoothScroll, d.smoothScroll),\n    sharedChatEnabled: keepBoolean(style.sharedChatEnabled, d.sharedChatEnabled),\n    modAction: keepBoolean(style.modAction, d.modAction),",
)

replace_once(
    "src/features/multichat/settings.ts",
    "  {\n    key: 'smoothScroll',\n    param: 'smoothScroll',\n    type: 'toggle',\n    label: 'Smooth message scroll',\n    description: 'Default message handling: smooth for ordinary arrivals, instant during rapid bursts so animations never pile up.',\n    default: D.smoothScroll,\n  },\n  {\n    key: 'modAction',",
    "  {\n    key: 'smoothScroll',\n    param: 'smoothScroll',\n    type: 'toggle',\n    label: 'Smooth message scroll',\n    description: 'Default message handling: smooth for ordinary arrivals, instant during rapid bursts so animations never pile up.',\n    default: D.smoothScroll,\n  },\n  {\n    key: 'sharedChatEnabled',\n    param: 'sharedChatEnabled',\n    type: 'toggle',\n    label: 'Twitch Shared Chat',\n    description: 'Off ignores partner Shared Chat messages. On includes them and identifies each Twitch source streamer by profile picture only.',\n    default: D.sharedChatEnabled,\n  },\n  {\n    key: 'modAction',",
)

# ---------------------------------------------------------------------------
# Generator: expose the Shared Chat switch and let the commands table describe
# the counter-background commands honestly.
# ---------------------------------------------------------------------------
replace_once(
    "src/components/classic/ClassicGenerator.tsx",
    "const MC_MSG_SLIDE_IN = toggleSetting(MC, 'msgSlideIn');\nconst MC_SMOOTH_SCROLL = toggleSetting(MC, 'smoothScroll');\nconst MC_HIDE_NAMES",
    "const MC_MSG_SLIDE_IN = toggleSetting(MC, 'msgSlideIn');\nconst MC_SMOOTH_SCROLL = toggleSetting(MC, 'smoothScroll');\nconst MC_SHARED_CHAT = toggleSetting(MC, 'sharedChatEnabled');\nconst MC_HIDE_NAMES",
)
replace_once(
    "src/components/classic/ClassicGenerator.tsx",
    "/** All 24 MultiChat settings, in the Classic multi-column arrangement. */",
    "/** All MultiChat settings, in the Classic multi-column arrangement. */",
)
replace_once(
    "src/components/classic/ClassicGenerator.tsx",
    "            {chat(MC_MSG_SLIDE_IN)}\n            {chat(MC_SMOOTH_SCROLL)}\n            {chat(MC_HIDE_NAMES)}",
    "            {chat(MC_MSG_SLIDE_IN)}\n            {chat(MC_SMOOTH_SCROLL)}\n            {chat(MC_SHARED_CHAT)}\n            {chat(MC_HIDE_NAMES)}",
)
replace_once(
    "src/components/classic/ClassicGenerator.tsx",
    "          These commands apply to the chat overlay only; the viewer counter has none.",
    "          Most commands act on the chat overlay. The counterbgon/counterbgoff pair also controls the separate viewer-counter browser source when it uses the same gxufy.com origin and channel set.",
)

# ---------------------------------------------------------------------------
# Chat renderer: no startup image; Shared Chat marker is avatar-only and is
# controlled by runtime state (falling back to the URL setting in tests/previews).
# ---------------------------------------------------------------------------
replace_once(
    "src/components/overlay/ChatOverlay.tsx",
    "  hypeTrain?: TwitchHypeTrainState | null;\n  hypeTrainEnding?: boolean;\n}",
    "  hypeTrain?: TwitchHypeTrainState | null;\n  hypeTrainEnding?: boolean;\n  /** Runtime Shared Chat state; omitted callers use config.sharedChatEnabled. */\n  sharedChatEnabled?: boolean;\n}",
)
replace_once(
    "src/components/overlay/ChatOverlay.tsx",
    "export default function ChatOverlay({ config, messages, fadingIds, pinnedMessage, showLoader, sourceTagExplicit = false, sourceTagOverride, hypeTrain, hypeTrainEnding = false }: Props) {",
    "export default function ChatOverlay({ config, messages, fadingIds, pinnedMessage, showLoader, sourceTagExplicit = false, sourceTagOverride, hypeTrain, hypeTrainEnding = false, sharedChatEnabled }: Props) {",
)
replace_once(
    "src/components/overlay/ChatOverlay.tsx",
    "  const cfg = config;\n\n  const szKey",
    "  const cfg = config;\n  const showSharedSource = sharedChatEnabled ?? cfg.sharedChatEnabled;\n\n  const szKey",
)
replace_once(
    "src/components/overlay/ChatOverlay.tsx",
    "        tagMode={tagMode}\n        showAvatar={cfg.showAvatars ?? false} />",
    "        tagMode={tagMode}\n        showAvatar={cfg.showAvatars ?? false}\n        showSharedSource={showSharedSource} />",
)
replace_once(
    "src/components/overlay/ChatOverlay.tsx",
    "function MsgLine({ msg, sz, emoteMaxH, emoteMaxW, stroke, hideNames, tagMode, showAvatar }: {\n  msg: ParsedMessage; sz: typeof SIZE[SzKey];\n  emoteMaxH:string; emoteMaxW:string; stroke:string;\n  hideNames:boolean;\n  tagMode:SourceTagMode; showAvatar:boolean;\n}) {",
    "function MsgLine({ msg, sz, emoteMaxH, emoteMaxW, stroke, hideNames, tagMode, showAvatar, showSharedSource }: {\n  msg: ParsedMessage; sz: typeof SIZE[SzKey];\n  emoteMaxH:string; emoteMaxW:string; stroke:string;\n  hideNames:boolean;\n  tagMode:SourceTagMode; showAvatar:boolean; showSharedSource:boolean;\n}) {",
)
replace_once(
    "src/components/overlay/ChatOverlay.tsx",
    "  const sourceChannel = msg.sourceChannel ? (\n    <span data-testid=\"twitch-shared-source\" title={msg.sourceChannel.displayName ? `Shared from ${msg.sourceChannel.displayName}` : 'Twitch Shared Chat'}\n      style={{ display:'inline-flex', alignItems:'center', gap:'0.22em', marginRight:'0.35em', verticalAlign:'middle', fontSize:'0.65em', opacity:0.9 }}>\n      {msg.sourceChannel.profileImageUrl && (\n        <img src={msg.sourceChannel.profileImageUrl} alt=\"\" loading=\"lazy\" referrerPolicy=\"no-referrer\"\n          style={{ width:'1.45em', height:'1.45em', borderRadius:9999, objectFit:'cover' }}\n          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />\n      )}\n      {msg.sourceChannel.displayName && <span>{msg.sourceChannel.displayName}</span>}\n    </span>\n  ) : null;",
    "  const sourceChannel = showSharedSource && msg.sourceChannel?.profileImageUrl ? (\n    <span data-testid=\"twitch-shared-source\" title=\"Twitch Shared Chat\"\n      style={{ display:'inline-flex', alignItems:'center', marginRight:'0.35em', verticalAlign:'middle', opacity:0.9 }}>\n      <img src={msg.sourceChannel.profileImageUrl} alt=\"\" loading=\"lazy\" referrerPolicy=\"no-referrer\"\n        style={{ width:'1.45em', height:'1.45em', borderRadius:9999, objectFit:'cover' }}\n        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />\n    </span>\n  ) : null;",
)
replace_once(
    "src/components/overlay/ChatOverlay.tsx",
    "          .ck-startup-card {\n            display: grid;\n            grid-template-columns: minmax(64px, 104px) minmax(0, auto);\n            align-items: center;\n            gap: clamp(12px, 3vw, 24px);\n            max-width: min(560px, 100%);",
    "          .ck-startup-card {\n            display: block;\n            max-width: min(420px, 100%);",
)
replace_once(
    "src/components/overlay/ChatOverlay.tsx",
    "          .ck-startup-logo { display:block; width:100%; height:auto; max-height:104px; object-fit:contain; }\n",
    "",
)
replace_once(
    "src/components/overlay/ChatOverlay.tsx",
    "          @media (max-width: 460px) {\n            .ck-startup-card { grid-template-columns:72px minmax(0,1fr); gap:12px; }\n          }\n",
    "",
)
replace_once(
    "src/components/overlay/ChatOverlay.tsx",
    "          <div className=\"ck-startup-card\">\n            <img className=\"ck-startup-logo\" src=\"/tpl.gif\" alt=\"\" width={104} height={104} />\n            <div className=\"ck-startup-copy\">",
    "          <div className=\"ck-startup-card\">\n            <div className=\"ck-startup-copy\">",
)

# ---------------------------------------------------------------------------
# Runtime command metadata and dispatcher.
# ---------------------------------------------------------------------------
replace_once(
    "src/lib/multichatCommandRuntime.ts",
    "  /** Show or hide the chat container. */\n  setChatVisible(visible: boolean): void;\n  /** Reload the browser source. */",
    "  /** Show or hide the whole chat container. */\n  setChatVisible(visible: boolean): void;\n  /** Show or suppress one platform's chat rows without disconnecting it. */\n  setPlatformChatVisible(platform: Platform, visible: boolean): void;\n  /** Include or suppress Twitch partner Shared Chat rows. */\n  setSharedChatVisible(visible: boolean): void;\n  /** Override the viewer counter's pill background in the matching counter source. */\n  setCounterBackground(visible: boolean): void;\n  /** Reload the browser source. */",
)
replace_once(
    "src/lib/multichatCommandRuntime.ts",
    "        case 'hide':\n          /* Visibility only. Messages keep buffering behind it, so `show`\n             restores a live chat rather than an empty container. */\n          host.setChatVisible(false);\n          break;\n        case 'refresh':",
    "        case 'hide':\n          /* Visibility only. Messages keep buffering behind it, so `show`\n             restores a live chat rather than an empty container. */\n          host.setChatVisible(false);\n          break;\n        case 'kickon':\n          host.setPlatformChatVisible('kick', true);\n          host.showFloat(FLOAT_NOTICE, 'Kick chat ON', 2500);\n          break;\n        case 'kickoff':\n          host.setPlatformChatVisible('kick', false);\n          host.showFloat(FLOAT_NOTICE, 'Kick chat OFF', 2500);\n          break;\n        case 'twitchon':\n          host.setPlatformChatVisible('twitch', true);\n          host.showFloat(FLOAT_NOTICE, 'Twitch chat ON', 2500);\n          break;\n        case 'twitchoff':\n          host.setPlatformChatVisible('twitch', false);\n          host.showFloat(FLOAT_NOTICE, 'Twitch chat OFF', 2500);\n          break;\n        case 'youtubeon':\n          host.setPlatformChatVisible('youtube', true);\n          host.showFloat(FLOAT_NOTICE, 'YouTube chat ON', 2500);\n          break;\n        case 'youtubeoff':\n          host.setPlatformChatVisible('youtube', false);\n          host.showFloat(FLOAT_NOTICE, 'YouTube chat OFF', 2500);\n          break;\n        case 'tiktokon':\n          host.setPlatformChatVisible('tiktok', true);\n          host.showFloat(FLOAT_NOTICE, 'TikTok chat ON', 2500);\n          break;\n        case 'tiktokoff':\n          host.setPlatformChatVisible('tiktok', false);\n          host.showFloat(FLOAT_NOTICE, 'TikTok chat OFF', 2500);\n          break;\n        case 'sharedon':\n          host.setSharedChatVisible(true);\n          host.showFloat(FLOAT_NOTICE, 'Twitch Shared Chat ON', 2500);\n          break;\n        case 'sharedoff':\n          host.setSharedChatVisible(false);\n          host.showFloat(FLOAT_NOTICE, 'Twitch Shared Chat OFF', 2500);\n          break;\n        case 'counterbgon':\n          host.setCounterBackground(true);\n          host.showFloat(FLOAT_NOTICE, 'Counter background ON', 2500);\n          break;\n        case 'counterbgoff':\n          host.setCounterBackground(false);\n          host.showFloat(FLOAT_NOTICE, 'Counter background OFF', 2500);\n          break;\n        case 'refresh':",
)

replace_once(
    "src/lib/multichatCommands.ts",
    "  {\n    name: 'hide',\n    syntax: '!multichat hide',\n    summary: 'Hides the chat container without stopping the connections.',\n  },\n  {\n    name: 'refresh',",
    "  {\n    name: 'hide',\n    syntax: '!multichat hide',\n    summary: 'Hides the chat container without stopping the connections.',\n  },\n  {\n    name: 'kickon',\n    syntax: '!multichat kickon',\n    summary: 'Shows Kick chat messages again.',\n    detail: 'The Kick connection stays alive while hidden, so this works without reloading.',\n  },\n  {\n    name: 'kickoff',\n    syntax: '!multichat kickoff',\n    summary: 'Hides current and future Kick chat messages.',\n    detail: 'The connection stays alive so a later kickon command can restore it.',\n  },\n  {\n    name: 'twitchon',\n    syntax: '!multichat twitchon',\n    summary: 'Shows Twitch chat messages again.',\n    detail: 'The Twitch connection stays alive while hidden, so this works without reloading.',\n  },\n  {\n    name: 'twitchoff',\n    syntax: '!multichat twitchoff',\n    summary: 'Hides current and future Twitch chat messages.',\n    detail: 'The connection stays alive so a later twitchon command can restore it.',\n  },\n  {\n    name: 'youtubeon',\n    syntax: '!multichat youtubeon',\n    summary: 'Shows YouTube chat messages again.',\n    detail: 'The YouTube connection stays alive while hidden, so this works without reloading.',\n  },\n  {\n    name: 'youtubeoff',\n    syntax: '!multichat youtubeoff',\n    summary: 'Hides current and future YouTube chat messages.',\n    detail: 'The connection stays alive so a later youtubeon command can restore it.',\n  },\n  {\n    name: 'tiktokon',\n    syntax: '!multichat tiktokon',\n    summary: 'Shows TikTok chat messages again.',\n    detail: 'The TikTok connection stays alive while hidden, so this works without reloading.',\n  },\n  {\n    name: 'tiktokoff',\n    syntax: '!multichat tiktokoff',\n    summary: 'Hides current and future TikTok chat messages.',\n    detail: 'The connection stays alive so a later tiktokon command can restore it.',\n  },\n  {\n    name: 'sharedon',\n    syntax: '!multichat sharedon',\n    summary: 'Turns Twitch Shared Chat display on.',\n    detail: 'Partner-room messages are included and Twitch rows show only the source streamer profile picture.',\n  },\n  {\n    name: 'sharedoff',\n    syntax: '!multichat sharedoff',\n    summary: 'Turns Twitch Shared Chat display off.',\n    detail: 'Partner-room Shared Chat messages already on screen are removed; local Twitch chat stays connected.',\n  },\n  {\n    name: 'counterbgon',\n    syntax: '!multichat counterbgon',\n    summary: 'Turns the viewer counter pill background on.',\n    detail: 'Targets the matching gxufy.com counter source generated from the same channel set.',\n  },\n  {\n    name: 'counterbgoff',\n    syntax: '!multichat counterbgoff',\n    summary: 'Turns the viewer counter pill background off.',\n    detail: 'Targets the matching gxufy.com counter source generated from the same channel set.',\n  },\n  {\n    name: 'refresh',",
)

# ---------------------------------------------------------------------------
# Same-origin control bus for commands that target the separate counter source.
# BroadcastChannel gives immediate delivery; storage is a fallback and preserves
# a recent override across a browser-source refresh without keeping it forever.
# ---------------------------------------------------------------------------
write(
    "src/lib/multichatControlBus.ts",
    r'''import type { Platform } from './types';

const CONTROL_CHANNEL = 'multichat-control-v1';
const COUNTER_BG_PREFIX = 'multichat:counter-bg:';
const OVERRIDE_TTL_MS = 12 * 60 * 60 * 1000;
const ORDER: readonly Platform[] = ['kick', 'twitch', 'youtube', 'tiktok'];

type Channels = Partial<Record<Platform, string>>;

type CounterBackgroundMessage = {
  type: 'counter-background';
  scope: string;
  enabled: boolean;
  at: number;
};

function normalizeChannel(value: string | undefined): string {
  return (value ?? '').trim().replace(/^@/, '').toLowerCase();
}

export function multichatControlScope(channels: Channels): string {
  return ORDER.map((platform) => `${platform}:${normalizeChannel(channels[platform])}`).join('|');
}

function storageKey(scope: string): string {
  return `${COUNTER_BG_PREFIX}${scope}`;
}

function parseMessage(value: unknown): CounterBackgroundMessage | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<CounterBackgroundMessage>;
  if (candidate.type !== 'counter-background') return null;
  if (typeof candidate.scope !== 'string' || typeof candidate.enabled !== 'boolean') return null;
  if (typeof candidate.at !== 'number' || !Number.isFinite(candidate.at)) return null;
  return candidate as CounterBackgroundMessage;
}

function parseStored(raw: string | null, scope: string): CounterBackgroundMessage | null {
  if (!raw) return null;
  try {
    const parsed = parseMessage(JSON.parse(raw));
    if (!parsed || parsed.scope !== scope) return null;
    if (Date.now() - parsed.at > OVERRIDE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Last command override for this channel set, or null when none is current. */
export function readCounterBackgroundControl(channels: Channels): boolean | null {
  if (typeof window === 'undefined') return null;
  const scope = multichatControlScope(channels);
  try {
    const key = storageKey(scope);
    const raw = window.localStorage.getItem(key);
    const parsed = parseStored(raw, scope);
    if (!parsed && raw) window.localStorage.removeItem(key);
    return parsed?.enabled ?? null;
  } catch {
    return null;
  }
}

/** Publish a counter-background override to other gxufy.com browser sources. */
export function publishCounterBackgroundControl(channels: Channels, enabled: boolean): void {
  if (typeof window === 'undefined') return;
  const message: CounterBackgroundMessage = {
    type: 'counter-background',
    scope: multichatControlScope(channels),
    enabled,
    at: Date.now(),
  };
  try {
    window.localStorage.setItem(storageKey(message.scope), JSON.stringify(message));
  } catch {
    /* Storage can be disabled; BroadcastChannel can still carry the live event. */
  }
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel(CONTROL_CHANNEL);
      channel.postMessage(message);
      channel.close();
    } catch {
      /* One transport failing must not break the chat command. */
    }
  }
}

/** Subscribe a counter source to overrides for its exact configured channel set. */
export function subscribeCounterBackgroundControl(
  channels: Channels,
  onChange: (enabled: boolean) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const scope = multichatControlScope(channels);
  const key = storageKey(scope);
  let channel: BroadcastChannel | null = null;

  const accept = (value: unknown) => {
    const message = parseMessage(value);
    if (!message || message.scope !== scope) return;
    if (Date.now() - message.at > OVERRIDE_TTL_MS) return;
    onChange(message.enabled);
  };

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(CONTROL_CHANNEL);
      channel.onmessage = (event) => accept(event.data);
    } catch {
      channel = null;
    }
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== key) return;
    const message = parseStored(event.newValue, scope);
    if (message) onChange(message.enabled);
  };
  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener('storage', onStorage);
    channel?.close();
  };
}
''',
)

# ---------------------------------------------------------------------------
# MultiChat page runtime: platform suppression keeps connectors alive; Shared
# Chat is filtered before command dispatch when off; counter bg crosses sources.
# ---------------------------------------------------------------------------
replace_once(
    "src/pages/multichat.tsx",
    "import type { Connector, UnifiedMessage, UnifiedPin } from '../lib/types';",
    "import type { Connector, Platform, UnifiedMessage, UnifiedPin } from '../lib/types';",
)
replace_once(
    "src/pages/multichat.tsx",
    "import {\n  RELOAD_STAMP_KEY,\n  createMultichatCommandRunner,\n} from '../lib/multichatCommandRuntime';",
    "import {\n  RELOAD_STAMP_KEY,\n  createMultichatCommandRunner,\n} from '../lib/multichatCommandRuntime';\nimport { publishCounterBackgroundControl } from '../lib/multichatControlBus';",
)
replace_once(
    "src/pages/multichat.tsx",
    "  const [messages, setMessages] = useState<ParsedMessage[]>([]);",
    "  const [messages, setMessages] = useState<ParsedMessage[]>([]);\n  const [sharedChatEnabled, setSharedChatEnabled] = useState(false);",
)
replace_once(
    "src/pages/multichat.tsx",
    "    setConfig(cfg);\n    setError(null);",
    "    setConfig(cfg);\n    setSharedChatEnabled(cfg.sharedChatEnabled);\n    setError(null);",
)
replace_once(
    "src/pages/multichat.tsx",
    "    const shouldDisplay = buildMessageFilter(cfg);\n\n    /* Message flush policy.",
    "    const shouldDisplay = buildMessageFilter(cfg);\n\n    /* Runtime visibility controls deliberately do not stop connectors. That is\n       what lets a moderator issue twitchon/youtubeon from a platform that is\n       currently hidden without reloading the browser source. */\n    const hiddenPlatforms = new Set<Platform>();\n    let sharedChatRuntime = cfg.sharedChatEnabled;\n\n    /* Message flush policy.",
)
replace_once(
    "src/pages/multichat.tsx",
    "    const flushInterval: ReturnType<typeof setInterval> | null = smoothRuntime\n      ? null\n      : setInterval(flushMessages, 200);\n\n    function addMessage(um: UnifiedMessage) {\n      handleCommand(um); // !multichat commands work from any platform\n      /* Deliberately after handleCommand: a command still dispatches from a\n         hidden or blacklisted account, exactly as before this was extracted. */\n      if (!shouldDisplay(um)) return;",
    "    const flushInterval: ReturnType<typeof setInterval> | null = smoothRuntime\n      ? null\n      : setInterval(flushMessages, 200);\n\n    function setPlatformChatVisible(platform: Platform, visible: boolean) {\n      if (visible) {\n        hiddenPlatforms.delete(platform);\n        return;\n      }\n      hiddenPlatforms.add(platform);\n      s.messages = s.messages.filter((message) => message.platform !== platform);\n      markDirty();\n    }\n\n    function setSharedChatVisible(visible: boolean) {\n      sharedChatRuntime = visible;\n      setSharedChatEnabled(visible);\n      if (visible) return;\n      s.messages = s.messages.filter((message) => {\n        if (message.platform !== 'twitch' || !message.raw) return true;\n        return !(message.raw as UnifiedMessage).sharedChat;\n      });\n      markDirty();\n    }\n\n    function addMessage(um: UnifiedMessage) {\n      /* Shared partner traffic is completely outside the overlay while the\n         feature is off, including its commands. Local Twitch chat remains live\n         and can turn Shared Chat on at any time. */\n      if (um.platform === 'twitch' && um.sharedChat && !sharedChatRuntime) return;\n      handleCommand(um); // !multichat commands work from any enabled source chat\n      /* Commands run before platform suppression so a hidden platform can issue\n         its own ...on command. A sharedoff command can also remove its own\n         partner row immediately after it executes. */\n      if (um.platform === 'twitch' && um.sharedChat && !sharedChatRuntime) return;\n      if (hiddenPlatforms.has(um.platform)) return;\n      if (!shouldDisplay(um)) return;",
)
replace_once(
    "src/pages/multichat.tsx",
    "        onMessage: addMessage,\n        onMessageUpdate: updated => {",
    "        onMessage: addMessage,\n        shouldEnrichSourceChannel: () => sharedChatRuntime,\n        onMessageUpdate: updated => {",
)
replace_once(
    "src/pages/multichat.tsx",
    "      createElement: (tag) => document.createElement(tag),\n      setChatVisible,\n      reload: () => window.location.reload(),",
    "      createElement: (tag) => document.createElement(tag),\n      setChatVisible,\n      setPlatformChatVisible,\n      setSharedChatVisible,\n      setCounterBackground(visible) {\n        publishCounterBackgroundControl({\n          kick: kickChannel,\n          twitch: cfg.twitch ?? '',\n          youtube: cfg.youtube ?? '',\n          tiktok: cfg.tiktok ?? '',\n        }, visible);\n      },\n      reload: () => window.location.reload(),",
)
replace_once(
    "src/pages/multichat.tsx",
    "        hypeTrainEnding={hypeTrainEnding}\n        showLoader={loaderPhase}",
    "        hypeTrainEnding={hypeTrainEnding}\n        showLoader={loaderPhase}\n        sharedChatEnabled={sharedChatEnabled}",
)

# ---------------------------------------------------------------------------
# Counter source subscribes to the same-channel control bus and overlays only the
# bg field at runtime; the generated URL remains authoritative for everything else.
# ---------------------------------------------------------------------------
replace_once(
    "src/pages/counter.tsx",
    "} from '../lib/viewerCounterConfig';",
    "} from '../lib/viewerCounterConfig';\nimport {\n  readCounterBackgroundControl,\n  subscribeCounterBackgroundControl,\n} from '../lib/multichatControlBus';",
)
replace_once(
    "src/pages/counter.tsx",
    "  const [statuses, setStatuses] = useState<PlatformStatuses>({});\n  const [started, setStarted] = useState(false);",
    "  const [statuses, setStatuses] = useState<PlatformStatuses>({});\n  const [started, setStarted] = useState(false);\n  const [counterBgOverride, setCounterBgOverride] = useState<boolean | null>(null);",
)
replace_once(
    "src/pages/counter.tsx",
    "  const pollKey = config ? channelPollKey(config.channels) : '';\n\n  useEffect(() => {",
    "  const pollKey = config ? channelPollKey(config.channels) : '';\n\n  useEffect(() => {\n    if (!router.isReady) return;\n    const channels = parseChannelPollKey(pollKey);\n    setCounterBgOverride(readCounterBackgroundControl(channels));\n    return subscribeCounterBackgroundControl(channels, setCounterBgOverride);\n  }, [router.isReady, pollKey]);\n\n  useEffect(() => {",
)
replace_once(
    "src/pages/counter.tsx",
    "          <ViewerCounterDisplay statuses={statuses} style={config.style} />",
    "          <ViewerCounterDisplay\n            statuses={statuses}\n            style={counterBgOverride === null ? config.style : { ...config.style, bg: counterBgOverride }}\n          />",
)

# ---------------------------------------------------------------------------
# Tests: loader has no image, Shared Chat is opt-in/avatar-only/local source is
# retained, config defaults include the new field, catalog count advances, and
# command hosts expose/verify every new runtime toggle.
# ---------------------------------------------------------------------------
replace_once(
    "tests/unit/chatStartupLoader.test.tsx",
    "  it('uses the existing TPL asset and exact overlay branding', () => {",
    "  it('uses text-only startup branding with no logo image', () => {",
)
replace_once(
    "tests/unit/chatStartupLoader.test.tsx",
    "    expect(loader.querySelector('img')?.getAttribute('src')).toBe('/tpl.gif');",
    "    expect(loader.querySelector('img')).toBeNull();",
)

replace_once(
    "tests/unit/twitchSharedChat.test.tsx",
    "  it('treats missing/equal source-room-id as ordinary chat and differing ids as shared', () => {\n    const { messages, socket } = startConnector();\n    socket.onmessage?.({ data: irc('plain') });\n    socket.onmessage?.({ data: irc('same', '100') });\n    socket.onmessage?.({ data: irc('shared', '200') });\n\n    expect(messages[0]?.sourceChannel).toBeUndefined();\n    expect(messages[1]?.sourceChannel).toBeUndefined();\n    expect(messages[2]?.sourceChannel).toEqual({ roomId: '200' });\n  });",
    "  it('retains the local source room and marks only differing partner rooms as Shared Chat', () => {\n    const { messages, socket } = startConnector();\n    socket.onmessage?.({ data: irc('plain') });\n    socket.onmessage?.({ data: irc('same', '100') });\n    socket.onmessage?.({ data: irc('shared', '200') });\n\n    expect(messages.map((message) => message.sourceChannel)).toEqual([\n      { roomId: '100' },\n      { roomId: '100' },\n      { roomId: '200' },\n    ]);\n    expect(messages.map((message) => message.sharedChat ?? false)).toEqual([false, false, true]);\n  });",
)
replace_once(
    "tests/unit/twitchSharedChat.test.tsx",
    "    const config = MultichatQuerySchema.parse({ twitch: 'local', animation: 'none' });",
    "    const config = MultichatQuerySchema.parse({ twitch: 'local', animation: 'none', sharedChatEnabled: '1' });",
)
replace_once(
    "tests/unit/twitchSharedChat.test.tsx",
    "    expect(source.textContent).toContain('Partner');\n    expect(source.querySelector('img')?.getAttribute('src')).toBe('https://cdn.example/avatar.png');",
    "    expect(source.textContent).toBe('');\n    expect(source.querySelector('img')?.getAttribute('src')).toBe('https://cdn.example/avatar.png');\n    expect(container.textContent).not.toContain('Partner');",
)
# Insert an explicit default-off renderer assertion after the avatar-only test.
replace_once(
    "tests/unit/twitchSharedChat.test.tsx",
    "    expect(container.textContent).not.toContain('Partner');\n  });\n});",
    "    expect(container.textContent).not.toContain('Partner');\n  });\n\n  it('renders no source avatar when Shared Chat is left at its default off state', () => {\n    const config = MultichatQuerySchema.parse({ twitch: 'local', animation: 'none' });\n    const raw: UnifiedMessage = {\n      platform: 'twitch', id: 'm2', senderId: '9', username: 'Author', color: '#fff',\n      badges: [], text: 'hello', emotes: [], timestamp: 1, kind: 'chat',\n      sourceChannel: { roomId: '200', displayName: 'Partner', profileImageUrl: 'https://cdn.example/avatar.png' },\n      sharedChat: true,\n    };\n    const parsed = buildParsedMessage(raw, config, NO_COSMETICS, { enabled: true, colors: new Map() }, 1);\n    render(<ChatOverlay config={config} messages={[parsed]} fadingIds={new Set()} pinnedMessage={null} showLoader={false} />);\n    expect(screen.queryByTestId('twitch-shared-source')).toBeNull();\n  });\n});",
)

replace_once(
    "tests/unit/multichatConfig.test.ts",
    "      msgSlideIn: false,\n      smoothScroll: false,\n      fontColor: '',",
    "      msgSlideIn: false,\n      smoothScroll: false,\n      sharedChatEnabled: false,\n      fontColor: '',",
)
replace_once(
    "tests/unit/multichatConfig.test.ts",
    "      msgSlideIn: false,\n      smoothScroll: false,\n      modAction: true,",
    "      msgSlideIn: false,\n      smoothScroll: false,\n      sharedChatEnabled: false,\n      modAction: true,",
)
replace_once(
    "tests/unit/classicGenerator.test.tsx",
    " *   - all 24 MultiChat settings and all six Counter settings, from the catalogs;",
    " *   - all MultiChat settings and all six Counter settings, from the catalogs;",
)
replace_once(
    "tests/unit/classicGenerator.test.tsx",
    "  it('renders all 26 MultiChat settings', () => {\n    mount();\n    expect(MULTICHAT_CATALOG).toHaveLength(26);",
    "  it('renders all 27 MultiChat settings', () => {\n    mount();\n    expect(MULTICHAT_CATALOG).toHaveLength(27);",
)
replace_once(
    "tests/unit/classicGenerator.test.tsx",
    "       render must already show all 26. */",
    "       render must already show all 27. */",
)

replace_once(
    "tests/unit/multichatCommandDispatch.test.ts",
    "import type { Connector, UnifiedMessage } from '@/lib/types';",
    "import type { Connector, Platform, UnifiedMessage } from '@/lib/types';",
)
replace_once(
    "tests/unit/multichatCommandDispatch.test.ts",
    "  visible: boolean[];\n  reloads: number;",
    "  visible: boolean[];\n  platformVisible: { platform: Platform; visible: boolean }[];\n  sharedVisible: boolean[];\n  counterBackground: boolean[];\n  reloads: number;",
)
replace_once(
    "tests/unit/multichatCommandDispatch.test.ts",
    "    visible: [],\n    reloads: 0,",
    "    visible: [],\n    platformVisible: [],\n    sharedVisible: [],\n    counterBackground: [],\n    reloads: 0,",
)
replace_once(
    "tests/unit/multichatCommandDispatch.test.ts",
    "    setChatVisible: (visible) => log.visible.push(visible),\n    reload: () => { log.reloads += 1; },",
    "    setChatVisible: (visible) => log.visible.push(visible),\n    setPlatformChatVisible: (platform, visible) => log.platformVisible.push({ platform, visible }),\n    setSharedChatVisible: (visible) => log.sharedVisible.push(visible),\n    setCounterBackground: (visible) => log.counterBackground.push(visible),\n    reload: () => { log.reloads += 1; },",
)
# Add direct side-effect coverage before the connector-wide command loop.
replace_once(
    "tests/unit/multichatCommandDispatch.test.ts",
    "describe('every command runs from every platform', () => {",
    "describe('runtime visibility controls', () => {\n  it('maps platform, Shared Chat, and counter background commands onto their host controls', () => {\n    const { runner, log } = createHost();\n    const base: UnifiedMessage = {\n      platform: 'twitch', id: 'ctl-0', senderId: '9', username: 'somemod', color: '',\n      badges: [{ type: 'moderator' }], text: '', emotes: [], timestamp: 1, kind: 'chat',\n    };\n    const commands = [\n      'kickoff', 'kickon', 'twitchoff', 'twitchon', 'youtubeoff', 'youtubeon',\n      'tiktokoff', 'tiktokon', 'sharedoff', 'sharedon', 'counterbgoff', 'counterbgon',\n    ];\n    commands.forEach((name, index) => runner.handle({ ...base, id: `ctl-${index}`, text: `!multichat ${name}` }));\n    expect(log.platformVisible).toEqual([\n      { platform: 'kick', visible: false }, { platform: 'kick', visible: true },\n      { platform: 'twitch', visible: false }, { platform: 'twitch', visible: true },\n      { platform: 'youtube', visible: false }, { platform: 'youtube', visible: true },\n      { platform: 'tiktok', visible: false }, { platform: 'tiktok', visible: true },\n    ]);\n    expect(log.sharedVisible).toEqual([false, true]);\n    expect(log.counterBackground).toEqual([false, true]);\n  });\n});\n\ndescribe('every command runs from every platform', () => {",
)

# Control-bus transport/persistence coverage.
write(
    "tests/unit/multichatControlBus.test.ts",
    r'''import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  multichatControlScope,
  publishCounterBackgroundControl,
  readCounterBackgroundControl,
  subscribeCounterBackgroundControl,
} from '@/lib/multichatControlBus';

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  closed = false;

  constructor(readonly name: string) {
    FakeBroadcastChannel.instances.push(this);
  }

  postMessage(data: unknown) {
    for (const instance of FakeBroadcastChannel.instances) {
      if (instance === this || instance.closed || instance.name !== this.name) continue;
      instance.onmessage?.({ data });
    }
  }

  close() {
    this.closed = true;
  }
}

beforeEach(() => {
  window.localStorage.clear();
  FakeBroadcastChannel.instances = [];
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('MultiChat cross-source control bus', () => {
  it('normalizes the same generator channel set to one stable scope', () => {
    expect(multichatControlScope({ kick: '@GXUFY ', twitch: ' Adapt', youtube: '@Maya' })).toBe(
      'kick:gxufy|twitch:adapt|youtube:maya|tiktok:',
    );
  });

  it('delivers and remembers a counter background override for the matching scope only', () => {
    const channels = { twitch: 'adapt', youtube: 'maya' };
    const seen: boolean[] = [];
    const stop = subscribeCounterBackgroundControl(channels, (enabled) => seen.push(enabled));

    publishCounterBackgroundControl(channels, false);
    expect(seen).toEqual([false]);
    expect(readCounterBackgroundControl(channels)).toBe(false);
    expect(readCounterBackgroundControl({ twitch: 'someone-else' })).toBeNull();

    publishCounterBackgroundControl(channels, true);
    expect(seen).toEqual([false, true]);
    expect(readCounterBackgroundControl(channels)).toBe(true);
    stop();
  });
});
''',
)

# Remove the now-unused loader GIF. The homepage's supplied avatar GIF remains.
tpl = Path('public/tpl.gif')
if tpl.exists():
    tpl.unlink()
