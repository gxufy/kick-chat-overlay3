/* MultiChat workspace control catalog.
 *
 * One entry per user-adjustable field of MultichatWorkspaceStyle. Every default
 * is read from MULTICHAT_WORKSPACE_DEFAULTS rather than written out, and every
 * option list comes from a tuple lib/multichatConfig exports, so this file
 * defines no values of its own — only labels, ordering, and control types.
 *
 * `sourceTag` is a four-option select here, not the legacy `platformIcons`
 * boolean: generator state carries the full enum the overlay implements. The
 * legacy field stays on MultichatGeneratorStyle as a pinned compatibility shape
 * and appears in no catalog entry.
 *
 * NOT EXPOSED, deliberately:
 *   - ttsEnabled, showAvatars, showSystemMsgs, showRedeems. The parser accepts
 *     them for URL compatibility and no runtime code reads them; they are
 *     listed in MULTICHAT_UNREAD_PARAMS.
 *   - Channel fields. Those are platform descriptors, not settings.
 *
 * Browser-safe — no server-only imports, no secrets.
 */
import {
  MULTICHAT_ANIMATIONS,
  MULTICHAT_FONTS,
  MULTICHAT_PLATFORMS,
  MULTICHAT_SOURCE_TAG_ORDER,
  MULTICHAT_STROKES,
  MULTICHAT_TEXT_SHADOWS,
  MULTICHAT_TEXT_SIZES,
  MULTICHAT_WORKSPACE_DEFAULTS as D,
  type MultichatWorkspaceStyle,
} from '@/lib/multichatConfig';
import {
  optionsFrom,
  titleCase,
  type SettingCatalog,
  type SettingOption,
} from '@/lib/tools/settingTypes';

/** Human labels for the font values, matching the generator's own <select>. */
const FONT_LABEL: Record<string, string> = {
  geist: 'Geist',
  baloo: 'Baloo Tammudu',
  segoe: 'Segoe UI (Chatterino)',
  roboto: 'Roboto',
  lato: 'Lato',
  noto: 'Noto Sans',
  sourcecode: 'Source Code Pro',
  impact: 'Impact',
  comfortaa: 'Comfortaa',
  dancing: 'Dancing Script',
  indieflower: 'Indie Flower',
  opensans: 'Open Sans',
  alsina: 'Alsina (Vsauce)',
};

const FONT_OPTIONS: readonly SettingOption[] = optionsFrom(
  MULTICHAT_FONTS,
  (value) => FONT_LABEL[value] ?? titleCase(value),
);

/** Pin targets, in MULTICHAT_PLATFORMS order — the generator's chip order. */
const PIN_OPTIONS: readonly SettingOption[] = optionsFrom(
  MULTICHAT_PLATFORMS,
  titleCase,
);

/** Platform tag modes, in workspace display order: icon, dot, label, none. */
const SOURCE_TAG_LABEL: Record<string, string> = {
  icon: 'Platform icon',
  dot: 'Colored dot',
  label: 'Platform name',
  none: 'Off',
};

const SOURCE_TAG_OPTIONS: readonly SettingOption[] = optionsFrom(
  MULTICHAT_SOURCE_TAG_ORDER,
  (value) => SOURCE_TAG_LABEL[value] ?? titleCase(value),
);

/** 'Off' reads better than 'None' on these two, matching the generator. */
const offFirst = (value: string) => (value === 'none' ? 'Off' : titleCase(value));

/** Appearance and behaviour controls, in display order. */
export const MULTICHAT_CATALOG: SettingCatalog<MultichatWorkspaceStyle> = [
  {
    key: 'textSize',
    param: 'textSize',
    type: 'select',
    label: 'Size',
    options: optionsFrom(MULTICHAT_TEXT_SIZES, titleCase),
    default: D.textSize,
  },
  {
    key: 'font',
    param: 'font',
    type: 'select',
    label: 'Font',
    options: FONT_OPTIONS,
    default: D.font,
  },
  {
    key: 'stroke',
    param: 'stroke',
    type: 'select',
    label: 'Stroke',
    options: optionsFrom(MULTICHAT_STROKES, offFirst),
    default: D.stroke,
  },
  {
    key: 'textShadow',
    param: 'textShadow',
    type: 'select',
    label: 'Shadow',
    /* 'small' — the generator's start, not the overlay's omission default of
       'large'. The generator always writes the parameter, so they never meet. */
    options: optionsFrom(MULTICHAT_TEXT_SHADOWS, offFirst),
    default: D.textShadow,
  },
  {
    key: 'animation',
    param: 'animation',
    type: 'select',
    label: 'Animation',
    options: optionsFrom(MULTICHAT_ANIMATIONS, (value) =>
      value === 'fade' ? 'Fade in' : titleCase(value),
    ),
    default: D.animation,
  },
  {
    key: 'emoteScale',
    param: 'emoteScale',
    type: 'text',
    label: 'Emote scale (0–3)',
    /* Text, not number: the generator holds raw input and '' means "omit the
       parameter", which a numeric control cannot express. */
    description: 'Blank uses the overlay default.',
    placeholder: '1.0',
    default: D.emoteScale,
  },
  {
    key: 'sevenTVEmotesEnabled',
    param: 'sevenTVEmotesEnabled',
    type: 'toggle',
    label: '7TV Emotes',
    default: D.sevenTVEmotesEnabled,
  },
  {
    key: 'sevenTVCosmeticsEnabled',
    param: 'sevenTVCosmeticsEnabled',
    type: 'toggle',
    label: '7TV Cosmetics',
    default: D.sevenTVCosmeticsEnabled,
  },
  /* The fade pair, kept as the two fields the generator actually holds. The
     toggle gates emission; the text field carries the seconds. Both are needed
     because `fade` is raw input whose emptiness also suppresses the parameter,
     so neither field can be derived from the other. */
  {
    key: 'fadeEnabled',
    param: 'fade',
    type: 'toggle',
    label: 'Fade out old messages',
    description: 'Off removes the parameter entirely.',
    default: D.fadeEnabled,
  },
  {
    key: 'fade',
    param: 'fade',
    type: 'text',
    label: 'Fade after (seconds)',
    description: 'Only used while Fade out old messages is on.',
    placeholder: '30',
    default: D.fade,
  },
  {
    key: 'msgBold',
    param: 'msgBold',
    type: 'toggle',
    label: 'Bold messages',
    default: D.msgBold,
  },
  {
    key: 'msgCaps',
    param: 'msgCaps',
    type: 'toggle',
    label: 'UPPERCASE messages',
    default: D.msgCaps,
  },
  {
    key: 'msgSlideIn',
    param: 'msgSlideIn',
    type: 'toggle',
    label: 'New messages slide in from the right',
    description: 'bChat-style 250ms horizontal entrance for each newly inserted chat row.',
    default: D.msgSlideIn,
  },
  {
    key: 'smoothScroll',
    param: 'smoothScroll',
    type: 'toggle',
    label: 'Smooth message scroll',
    description: 'Default message handling: smooth for ordinary arrivals, instant during rapid bursts so animations never pile up.',
    default: D.smoothScroll,
  },
  {
    key: 'sharedChatEnabled',
    param: 'sharedChatEnabled',
    type: 'toggle',
    label: 'Twitch Shared Chat',
    description: 'Off ignores partner Shared Chat messages. On includes them and identifies each Twitch source streamer by profile picture only.',
    default: D.sharedChatEnabled,
  },
  {
    key: 'modAction',
    param: 'modAction',
    type: 'toggle',
    label: 'Moderation actions',
    description:
      'Deletions, timeouts, bans and clears remove messages from the overlay.',
    default: D.modAction,
  },
  {
    key: 'paintShadows',
    param: 'paintShadows',
    type: 'toggle',
    label: 'Paint shadows',
    description: 'Shadows on 7TV paints — may cost performance.',
    default: D.paintShadows,
  },
  {
    key: 'hideNames',
    param: 'hideNames',
    type: 'toggle',
    label: 'Hide usernames',
    default: D.hideNames,
  },
  {
    key: 'showPinEnabled',
    param: 'showPinEnabled',
    type: 'toggle',
    label: 'Pinned messages',
    description: 'Show pinned messages from your platforms; the latest pin wins.',
    default: D.showPinEnabled,
  },
  {
    key: 'pinPlatforms',
    param: 'pinPlatforms',
    type: 'multiselect',
    label: 'Pins from',
    /* Gating is no longer static. `disabled` here could only ever be a constant,
       so the Twitch requirement is expressed at runtime instead — the descriptor's
       `optionAvailability` blocks just that one option and supplies the reason,
       which changes as the user connects and edits the channel.
       So this description states only what is always true; anything conditional
       is the runtime's to say, and saying it here too would go stale the moment
       someone connects. Twitch is absent from the workspace defaults, so nothing
       here selects an option that would not work. */
    description:
      'An empty selection turns pins off for every platform. Native Twitch pins additionally require a connected Twitch account matching the Twitch channel above.',
    options: PIN_OPTIONS,
    default: D.pinPlatforms,
  },
  {
    key: 'sourceTag',
    param: 'sourceTag',
    type: 'select',
    label: 'Platform tag',
    /* All four values the overlay implements. The legacy platformIcons boolean
       could only reach 'icon' and 'none'; workspace state carries the enum, and
       the authoritative serializer emits 'dot' and 'label' directly.
       The description explains the one asymmetry a user can actually observe:
       'icon' is the legacy omitted-parameter case, so with a single configured
       platform the overlay's own pre-existing default applies and no marker is
       drawn. Explaining it is the fix — changing the serializer would restyle
       every URL already in an OBS scene. */
    description:
      'Colored dot, Platform name, and Off apply exactly as chosen. Platform icon keeps the original URL format, where a single configured platform shows no marker; with several platforms, icons identify each message’s source.',
    options: SOURCE_TAG_OPTIONS,
    default: D.sourceTag,
  },
  {
    key: 'mentionColor',
    param: 'mentionColor',
    type: 'toggle',
    label: 'Colored mentions',
    description:
      'Highlight @mentions in the mentioned user’s name color. They must have chatted before.',
    default: D.mentionColor,
  },
  {
    key: 'bgColor',
    param: 'bgColor',
    type: 'color',
    label: 'Background',
    description: 'Blank is transparent, the default.',
    allowTransparent: true,
    default: D.bgColor,
  },
  {
    key: 'fontColor',
    param: 'fontColor',
    type: 'color',
    label: 'Message color',
    description: 'Blank uses the overlay default.',
    allowTransparent: true,
    default: D.fontColor,
  },
  {
    key: 'botNames',
    param: 'botNames',
    type: 'text',
    label: 'Extra bots to hide (comma-separated)',
    placeholder: 'nightbot, streamelements…',
    default: D.botNames,
  },
  {
    key: 'userBL',
    param: 'userBL',
    type: 'text',
    label: 'Username blacklist (space-separated)',
    placeholder: 'spammer1 botuser',
    default: D.userBL,
  },
  {
    key: 'prefixBL',
    param: 'prefixBL',
    type: 'text',
    label: 'Message-prefix blacklist (space-separated)',
    placeholder: 'https:// scam ',
    default: D.prefixBL,
  },
];
