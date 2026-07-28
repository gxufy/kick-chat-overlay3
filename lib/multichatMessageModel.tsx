/* UnifiedMessage → ParsedMessage: the one place that conversion happens.
 *
 * This was previously a closure inside the overlay route's connect effect, which
 * meant nothing else could perform the conversion without reimplementing it.
 * Four appearance settings are applied *here* rather than in ChatOverlay:
 *
 *   sevenTVEmotesEnabled     decides whether third-party emotes are swapped into
 *                            the text at all (by passing an empty emote list)
 *   sevenTVCosmeticsEnabled  decides whether a paint or 7TV badge is attached
 *   paintShadows             decides whether a paint contributes drop-shadows
 *   mentionColor             decides whether @tokens become coloured strongs
 *
 * A caller that skipped this step and built ParsedMessage values by hand would
 * therefore be unable to respond to any of those four, however faithfully it
 * copied the rest. That is why the generator's preview renders fixtures through
 * this function instead of shipping pre-rendered nodes: the settings have to pass
 * through the same code on the way to the screen.
 *
 * Moved verbatim from pages/multichat.tsx. The only deliberate change is that
 * `timestamp` is a parameter rather than a `Date.now()` call, so a deterministic
 * caller can supply a fixed instant. The overlay passes `Date.now()` and is
 * unaffected.
 *
 * Browser-safe — no server-only imports, no secrets, no network.
 */
import {
  decimalToRGBA,
  type Entitlements,
  type KickChannel,
  type ParsedMessage,
  type SevenTVBadge,
  type SevenTVEmote,
  type SevenTVPaint,
} from './kick';
import {
  fallbackColor,
  isYouTubeOwner,
  readableColor,
  renderBadges,
  renderMessageText,
  type MentionContext,
} from './render';
import type { UnifiedMessage } from './types';

/**
 * The cosmetic data a conversion reads from.
 *
 * The overlay fills this from live 7TV lookups as they resolve; the generator
 * preview fills it from fixtures. Both shapes are the same, so neither needs a
 * special case in the conversion itself.
 */
export type MessageCosmetics = {
  /** Third-party emotes available for word-swapping (kick and twitch only). */
  emotes: SevenTVEmote[];
  badges: SevenTVBadge[];
  paints: SevenTVPaint[];
  /** Keyed `${platform}:${senderId}`, as the cosmetics fetcher keys them. */
  entitlements: Entitlements;
  /** Kick channel, for its subscriber badge tiers. Null when not loaded. */
  channel: KickChannel | null;
};

/** The subset of overlay configuration that changes how a message is built. */
export type MessageStyleConfig = {
  sevenTVEmotesEnabled: boolean;
  sevenTVCosmeticsEnabled: boolean;
  paintShadows: boolean;
};

/** The subset of overlay configuration that decides whether a message is shown. */
export type MessageFilterConfig = {
  /** Comma- or space-separated extra bot names to hide. */
  botNames: string;
  /** Space-separated usernames to hide. */
  userBL: string;
  /** Space-separated text prefixes to hide. */
  prefixBL: string;
  showSystemMsgs: boolean;
  showRedeems: boolean;
};

/**
 * Well-known chat bots, hidden on every platform without being named.
 *
 * Matches the chatis list. Lowercase; comparisons lowercase the candidate.
 */
const KNOWN_BOTS: ReadonlySet<string> = new Set([
  'streamelements', 'streamlabs', 'nightbot', 'moobot',
  'titlechange_bot', 'supibot', 'pajbot', 'huwobot',
  'oshbt', 'spanixbot', 'potatbotat', 'streamqbot', 'twirapp',
  'fossabot', 'wizebot', 'botisimo', 'sery_bot', 'soundalerts',
]);

/**
 * Build the "should this message be displayed" predicate for a configuration.
 *
 * Lifted out of the overlay's connect effect for the same reason as the
 * conversion above: these four settings — botNames, userBL, prefixBL, and the
 * system/redeem toggles — are applied *before* ChatOverlay ever sees a message,
 * so a preview that rendered a fixture list directly could not respond to any of
 * them. It would show a blacklisted name happily sitting on screen.
 *
 * Returns a fresh predicate rather than filtering a list, because the overlay
 * applies it to one arriving message at a time while the preview applies it to a
 * fixture array. Parsing the blacklists once per configuration rather than once
 * per message is deliberate.
 */
export function buildMessageFilter(
  cfg: MessageFilterConfig,
): (um: UnifiedMessage) => boolean {
  const extraBots = new Set(
    (cfg.botNames || '')
      .split(',')
      .flatMap((b) => b.trim().split(' '))
      .filter(Boolean)
      .map((b) => b.toLowerCase()),
  );
  /* Space-separated, matching the labels on both fields. */
  const userBlacklist = new Set(
    (cfg.userBL || '').split(/\s+/).filter(Boolean).map((u) => u.toLowerCase()),
  );
  const prefixBlacklist = (cfg.prefixBL || '').split(/\s+/).filter(Boolean);

  return (um: UnifiedMessage): boolean => {
    const name = um.username.toLowerCase();
    if (KNOWN_BOTS.has(name) || extraBots.has(name) || userBlacklist.has(name)) return false;
    /* Prefixes apply to chat only: an event card's text is composed by the
       connector, not typed by the chatter, so blacklisting "!" should not hide a
       subscription. */
    if (um.kind === 'chat' && prefixBlacklist.some((p) => um.text.startsWith(p))) return false;
    if (um.kind === 'system' && !cfg.showSystemMsgs) return false;
    if (um.redeem && !cfg.showRedeems) return false;
    return true;
  };
}

/** Empty cosmetics, for a caller with no 7TV data at all. */
export const NO_COSMETICS: MessageCosmetics = {
  emotes: [],
  badges: [],
  paints: [],
  entitlements: {},
  channel: null,
};

/**
 * A 7TV paint as CSS: a gradient (or image) for `background`, shadows for
 * `filter`.
 *
 * `paintShadows` is honoured by returning an empty filter rather than by
 * dropping the paint, so turning shadows off leaves the gradient intact — which
 * is what the setting claims to do.
 */
export function buildPaintStyle(
  paint: SevenTVPaint,
  paintShadows: boolean,
): { background: string; filter: string } {
  const parts: string[] = [];
  const shadows: string[] = [];
  let prefix = '';
  if (paint.func === 'URL') {
    parts.push(paint.image_url ?? '');
  } else {
    if (paint.func === 'LINEAR_GRADIENT') parts.push(`${paint.angle ?? 0}deg`);
    else if (paint.func === 'RADIAL_GRADIENT') parts.push(paint.shape ?? 'circle');
    prefix = paint.repeat ? 'repeating-' : '';
    for (const stop of paint.stops) {
      parts.push(`${decimalToRGBA(stop.color)} ${stop.at * 100}%`);
    }
  }
  for (const shadow of paint.shadows) {
    if (!paintShadows) break; // UChat: paint shadows toggle
    shadows.push(
      `drop-shadow(${decimalToRGBA(shadow.color)} ${shadow.x_offset}px ${shadow.y_offset}px ${shadow.radius}px)`,
    );
  }
  const background = `${prefix}${paint.func.toLowerCase().replace('_', '-')}(${parts.join(', ')})`;
  return { background, filter: shadows.join(' ') };
}

/**
 * Convert one normalized message into the renderable form ChatOverlay consumes.
 *
 * Side effect, and it is load-bearing: the author's resolved colour is recorded
 * in `mentions.colors` under their lowercased name. That is how mention colouring
 * works — a mention only takes a colour if that chatter has been seen already —
 * so callers must convert a list in display order and reuse one context across
 * it, exactly as the overlay does.
 */
export function buildParsedMessage(
  um: UnifiedMessage,
  cfg: MessageStyleConfig,
  cosmetics: MessageCosmetics,
  mentions: MentionContext,
  timestamp: number,
): ParsedMessage {
  const badgeNodes = renderBadges(um, cosmetics.channel?.subscriber_badges ?? []);
  let background = '';
  let filter = '';
  // 7TV cosmetics apply to kick AND twitch chatters (chatis parity)
  if (
    (um.platform === 'kick' || um.platform === 'twitch') &&
    cfg.sevenTVCosmeticsEnabled &&
    um.senderId
  ) {
    const entitlement = cosmetics.entitlements[`${um.platform}:${um.senderId}`];
    if (entitlement) {
      if (entitlement.badge) {
        const badge = cosmetics.badges.find((b) => b.id === entitlement.badge);
        if (badge) {
          badgeNodes.push(
            <img key="7tv-badge" className="ck-badge-img" src={badge.image} alt="7tv badge" />,
          );
        }
      }
      if (entitlement.paint) {
        const paint = cosmetics.paints.find((p) => p.id === entitlement.paint);
        if (paint) ({ background, filter } = buildPaintStyle(paint, cfg.paintShadows));
      }
    }
  }
  // mention map: remember every chatter's color (lowercase name)
  const displayColor = um.color
    ? readableColor(um.color)
    : fallbackColor(um.platform, um.username, um.senderId);
  mentions.colors.set(um.username.toLowerCase(), displayColor);
  return {
    id: `${um.platform}:${um.id}`,
    platform: um.platform,
    senderId: um.senderId,
    kind: um.kind,
    category: um.category,
    redeem: um.redeem,
    avatar: um.avatar,
    raw: um,
    timestamp,
    identity: {
      username: um.username,
      color: displayColor,
      background,
      filter,
      badges: badgeNodes,
      // StreamNook: yt channel owner name renders as a gold pill
      ...(isYouTubeOwner(um) ? { namePill: '#ffd600|#111111' } : {}),
    },
    // kick + twitch both get third-party emote word-swaps in text gaps
    message: renderMessageText(
      um,
      (um.platform === 'kick' || um.platform === 'twitch') && cfg.sevenTVEmotesEnabled
        ? cosmetics.emotes
        : [],
      mentions,
    ),
  };
}
