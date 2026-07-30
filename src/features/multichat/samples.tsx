/* Deterministic sample chat for the generator's built-in preview.
 *
 * These are `UnifiedMessage` values — the normalized shape the four live
 * connectors produce, *before* rendering. That choice is load-bearing rather
 * than stylistic. Four of the twenty-four MultiChat settings are applied while a
 * message is converted to renderable form, not while ChatOverlay draws it:
 *
 *   sevenTVEmotesEnabled     whether third-party emotes are swapped into text
 *   sevenTVCosmeticsEnabled  whether a paint or 7TV badge is attached at all
 *   paintShadows             whether a paint contributes drop-shadows
 *   mentionColor             whether @tokens become coloured strongs
 *
 * Fixtures shipped as pre-rendered nodes could not respond to any of those four,
 * however faithfully they copied the markup. So the preview holds normalized
 * messages and runs them through lib/multichatMessageModel — the same conversion
 * the overlay route performs — and every setting reaches the screen through the
 * code that really implements it.
 *
 * Nothing here restates renderer output. Badges are declared as platform badge
 * *types* and resolved by the production `renderBadges` (so Twitch badge UUIDs,
 * Kick subscriber tiers, and YouTube role art come from the real lookups).
 * Emotes are declared as 7TV fixtures and swapped in by the production
 * word-swap. A fixture that hardcoded an <img> would keep rendering after those
 * lookups broke, which is the opposite of useful.
 *
 * DETERMINISM. No Date.now, no Math.random, no network, no clock-dependent ids.
 * Timestamps are fixed offsets from a constant epoch. Emote character offsets are
 * computed from the literal text by codepoint, so they cannot drift from it and
 * cannot be miscounted by hand.
 *
 * Emote and badge art is referenced by URL from the same CDNs the connectors use.
 * In a test environment those requests never resolve, which is fine: assertions
 * are about the elements the overlay emits, not about pixels.
 *
 * All content is written for this repository. Nothing is copied from another
 * chat overlay's source, fixtures, or branding.
 *
 * Browser-safe — no server-only imports, no secrets.
 */
import type {
  Entitlements,
  KickChannel,
  SevenTVBadge,
  SevenTVEmote,
  SevenTVPaint,
} from '@/lib/kick';
import type { MessageCosmetics } from '@/lib/multichatMessageModel';
import type {
  Platform,
  UnifiedEmote,
  UnifiedMessage,
  UnifiedPin,
} from '@/lib/types';
import {
  PREVIEW_EMOTE_CAT,
  PREVIEW_EMOTE_GRIN,
  PREVIEW_EMOTE_LAUGH,
  PREVIEW_EMOTE_NATIVE,
  PREVIEW_EMOTE_RAIN,
  PREVIEW_EMOTE_SMILE,
  PREVIEW_EMOTE_TOKENS,
  PREVIEW_SEVENTV_BADGE_IMAGE,
  PREVIEW_TIKTOK_MOD_BADGE,
} from './previewAssets';

/* A fixed instant, so timestamps are stable across runs and machines.
   2026-01-01T00:00:00Z. Never Date.now(). */
export const SAMPLE_EPOCH = 1_767_225_600_000;

/** Sequential fixed timestamps, one second apart, in sample order. */
const at = (index: number) => SAMPLE_EPOCH + index * 1000;

/**
 * A native platform emote, located in the text by codepoint.
 *
 * `renderMessageText` slices the message with `Array.from`, so offsets are
 * codepoint indices, not UTF-16 code units. Computing them from the literal
 * rather than writing numbers means the unicode sample below can hold astral
 * characters ahead of its emote without a hand-counted offset silently landing
 * mid-surrogate — which is exactly the bug this sample exists to keep out.
 *
 * Throws rather than degrading: the inputs are two literals in this file, so a
 * miss is a broken fixture and a test asserting the emote renders will catch it
 * before it can reach a page.
 */
function nativeEmote(text: string, token: string, url: string): UnifiedEmote {
  const chars = Array.from(text);
  const tokenChars = Array.from(token);
  for (let i = 0; i <= chars.length - tokenChars.length; i++) {
    if (tokenChars.every((char, j) => chars[i + j] === char)) {
      /* `end` is exclusive — renderMessageText resumes its cursor there. */
      return { begin: i, end: i + tokenChars.length, text: token, url };
    }
  }
  throw new Error(`sample emote token ${token} is not present in its own text`);
}

/* ------------------------------------------------------------------ */
/* Cosmetics fixtures                                                  */
/* ------------------------------------------------------------------ */

/**
 * 7TV emotes the preview makes available for word-swapping.
 *
 * Only Kick and Twitch messages receive third-party swaps in production, so only
 * those samples reference these names. `RainTime` is zero-width: the renderer
 * overlays it on the emote before it, which is a distinctive 7TV behaviour worth
 * showing in a preview rather than discovering in OBS.
 */
export const SAMPLE_SEVENTV_EMOTES: readonly SevenTVEmote[] = [
  {
    name: PREVIEW_EMOTE_TOKENS.sevenTV,
    image: PREVIEW_EMOTE_LAUGH,
    height: 32,
    width: 32,
    zeroWidth: false,
    upscale: false,
  },
  {
    name: PREVIEW_EMOTE_TOKENS.sevenTVAlt,
    image: PREVIEW_EMOTE_GRIN,
    height: 32,
    width: 32,
    zeroWidth: false,
    upscale: false,
  },
  {
    name: PREVIEW_EMOTE_TOKENS.sevenTVZeroWidth,
    image: PREVIEW_EMOTE_RAIN,
    height: 32,
    width: 32,
    zeroWidth: true,
    upscale: false,
  },
  /* BTTV and FFZ contribute to the very same list in production —
     `loadTwitchEmotes` merges FFZ → BTTV → 7TV into one array and the renderer
     word-swaps them identically. So they are declared here as ordinary emote
     fixtures whose provider is carried by the token name alone, and they render
     through the same path behind the same `sevenTVEmotesEnabled` gate. */
  {
    name: PREVIEW_EMOTE_TOKENS.bttv,
    image: PREVIEW_EMOTE_CAT,
    height: 32,
    width: 32,
    zeroWidth: false,
    upscale: false,
  },
  {
    name: PREVIEW_EMOTE_TOKENS.ffz,
    image: PREVIEW_EMOTE_SMILE,
    height: 32,
    width: 32,
    zeroWidth: false,
    upscale: false,
  },
];

/** A 7TV badge, attached through an entitlement like a real one. */
export const SAMPLE_SEVENTV_BADGE: SevenTVBadge = {
  id: 'sample-7tv-badge',
  image: PREVIEW_SEVENTV_BADGE_IMAGE,
};

/**
 * A 7TV name paint: a three-stop linear gradient with one soft shadow.
 *
 * Colours are packed RGBA decimals, the form `decimalToRGBA` decodes, because
 * that is what the 7TV API returns and what the production paint builder
 * expects. The single shadow is what the paintShadows toggle removes — with it
 * off the gradient must survive and only the drop-shadow disappear, which one
 * shadow demonstrates unambiguously.
 */
export const SAMPLE_SEVENTV_PAINT: SevenTVPaint = {
  id: 'sample-7tv-paint',
  func: 'LINEAR_GRADIENT',
  angle: 90,
  repeat: false,
  /* rgba(0,0,0,0.6) — alpha lives in the low byte. */
  shadows: [{ color: 153, x_offset: 1, y_offset: 1, radius: 2 }],
  stops: [
    { color: 4284444159, at: 0 }, // #ff5f6d
    { color: 4290998783, at: 0.5 }, // #ffc371
    { color: 1206238463, at: 1 }, // #47e5bc
  ],
};

/**
 * Which sample chatter owns which cosmetics, keyed as the fetcher keys them.
 *
 * `${platform}:${senderId}`, so the conversion's own lookup applies them. Only
 * the paint sample is entitled, which is what makes the cosmetics toggle
 * visible: with it off that name falls back to a plain colour while every other
 * sample is unchanged.
 */
export const SAMPLE_ENTITLEMENTS: Entitlements = {
  'twitch:sample-paint-sender': {
    badge: SAMPLE_SEVENTV_BADGE.id,
    paint: SAMPLE_SEVENTV_PAINT.id,
  },
};

/**
 * A Kick channel, present only for its subscriber badge tiers.
 *
 * The Kick subscriber badge resolves by picking the highest tier a chatter's
 * month count reaches, so a preview without tiers would fall back to the generic
 * art and never exercise that lookup.
 */
export const SAMPLE_KICK_CHANNEL: KickChannel = {
  id: 1,
  user_id: 1,
  slug: 'sample-channel',
  chatroom: { id: 1 },
  subscriber_badges: [
    { id: 1, months: 1, badge_image: { src: '/badges/subscriber.svg' } },
    { id: 2, months: 6, badge_image: { src: '/badges/subscriber.svg' } },
  ],
  user: { id: 1, username: 'sample-channel' },
};

/** Everything the conversion reads, assembled once. */
export const SAMPLE_COSMETICS: MessageCosmetics = {
  emotes: [...SAMPLE_SEVENTV_EMOTES],
  badges: [SAMPLE_SEVENTV_BADGE],
  paints: [SAMPLE_SEVENTV_PAINT],
  entitlements: SAMPLE_ENTITLEMENTS,
  channel: SAMPLE_KICK_CHANNEL,
};

/* ------------------------------------------------------------------ */
/* Samples                                                             */
/* ------------------------------------------------------------------ */

/**
 * The sample categories, each demonstrating one renderer capability.
 *
 * A union rather than free-form strings, so the preview and its tests share one
 * list and cannot fall out of step.
 */
export const SAMPLE_GROUPS = [
  'plain',
  'badges',
  'mention',
  'emotes',
  'paint',
  'moderation',
  'multiline',
  'event',
  'unicode',
  'owner',
  'pin',
] as const;

export type SampleGroup = (typeof SAMPLE_GROUPS)[number];

/** A sample plus the capability it exists to demonstrate. */
export type SampleMessage = {
  readonly group: SampleGroup;
  /** Describes the sample for a maintainer. Never overlay content. */
  readonly label: string;
  readonly message: UnifiedMessage;
};

/* The Kick author's raw colour, reused by the mention sample's text so the
   mention resolves against a chatter who has actually spoken. */
const KICK_GREEN = '#53fc18';

/** The unicode sample's text, named so its emote offset is computed from it. */
const UNICODE_TEXT = 'ありがとう! спасибо! شكرا! ¡qué buena racha! 🎉🐉 é Kappa';

/**
 * Every sample, in display order.
 *
 * Order is not cosmetic. Mention colouring only applies to a chatter who has
 * already been seen, exactly as in a live stream, so the mention sample sits
 * after the Kick author it names — reordering these would silently stop
 * demonstrating mentions. Consecutive messages come from different platforms,
 * which is what makes the source-tag setting visibly meaningful, and every
 * platform appears at least twice. All three properties are asserted in
 * tests/unit/multichatSamples.test.tsx.
 */
export const SAMPLE_MESSAGES: readonly SampleMessage[] = [
  {
    group: 'plain',
    label: 'Plain Kick message',
    message: {
      platform: 'kick',
      id: 'sample-plain',
      senderId: 'sample-plain-sender',
      username: 'greenscreen',
      color: KICK_GREEN,
      badges: [],
      text: 'first time catching the stream live, this is sick',
      emotes: [],
      timestamp: at(0),
      kind: 'chat',
    },
  },
  {
    group: 'badges',
    label: 'Twitch broadcaster, badges resolved from the real UUID table',
    message: {
      platform: 'twitch',
      id: 'sample-badges',
      senderId: 'sample-badges-sender',
      username: 'purplereign',
      color: '#a970ff',
      /* Types only. renderBadges maps these to official Twitch badge art, so
         the preview cannot show a badge the overlay would not. */
      badges: [{ type: 'broadcaster' }, { type: 'subscriber' }],
      text: 'welcome in everyone, mods are up',
      emotes: [],
      timestamp: at(1),
      kind: 'chat',
    },
  },
  {
    group: 'mention',
    label: 'YouTube message mentioning the Kick chatter above',
    message: {
      platform: 'youtube',
      id: 'sample-mention',
      senderId: 'sample-mention-sender',
      username: 'RedButtonRadio',
      /* YouTube carries no colour, so this exercises the deterministic fallback
         palette rather than a supplied hex. */
      color: '',
      badges: [{ type: 'verified' }],
      avatar: 'https://yt3.ggpht.com/sample-avatar=s64-c-k-c0x00ffffff-no-rj',
      text: '@greenscreen agreed, the new layout is much better',
      emotes: [],
      timestamp: at(2),
      kind: 'chat',
    },
  },
  {
    group: 'emotes',
    label: 'Kick message with 7TV emotes, including a zero-width overlay',
    message: {
      platform: 'kick',
      id: 'sample-emotes',
      senderId: 'sample-emotes-sender',
      username: 'emotefiend',
      color: '#7ae2ff',
      badges: [{ type: 'subscriber', count: 8 }],
      /* Plain words. The production word-swap turns the ones that match an emote
         fixture into images, and RainTime overlays the emote before it. OMEGALUL
         and KEKW are 7TV tokens, catJAM is BTTV's and PepeLaugh is FFZ's — all
         merged into one list and swapped by the same path in production. */
      text: 'that clip had me OMEGALUL RainTime KEKW catJAM PepeLaugh',
      emotes: [],
      timestamp: at(3),
      kind: 'chat',
    },
  },
  {
    group: 'paint',
    label: 'Twitch chatter entitled to a 7TV paint and badge',
    message: {
      platform: 'twitch',
      id: 'sample-paint',
      /* Matches SAMPLE_ENTITLEMENTS, which is how the paint is attached — the
         same senderId lookup the live cosmetics fetcher uses. */
      senderId: 'sample-paint-sender',
      username: 'paintedname',
      color: '#ffffff',
      badges: [{ type: 'subscriber' }],
      text: 'gradient name, courtesy of 7TV',
      emotes: [],
      timestamp: at(4),
      kind: 'chat',
    },
  },
  {
    group: 'moderation',
    label: 'TikTok moderator with pre-resolved badge art',
    message: {
      platform: 'tiktok',
      id: 'sample-moderation',
      senderId: 'sample-moderation-sender',
      username: 'tiktokmod',
      color: '#25f4ee',
      /* A url'd badge, which is how TikTok delivers them — and the path that
         adds ck-badge-wide so non-square art is not squished. */
      badges: [{ type: 'moderator', url: PREVIEW_TIKTOK_MOD_BADGE }],
      avatar: 'https://p16-sign-va.tiktokcdn.com/sample-avatar~c5_100x100.jpeg',
      text: 'keep it civil in here please',
      emotes: [],
      timestamp: at(5),
      kind: 'chat',
    },
  },
  {
    group: 'multiline',
    label: 'Kick message long enough to wrap onto several lines',
    message: {
      platform: 'kick',
      id: 'sample-multiline',
      senderId: 'sample-multiline-sender',
      username: 'longwinded',
      color: '#b6ff6f',
      badges: [{ type: 'subscriber', count: 7 }],
      /* Deliberately one long run rather than an embedded newline. The overlay's
         message body sets wordBreak but never white-space: pre-wrap, so a '\n'
         would collapse to a space and render as a single line — a fixture built
         that way would claim to demonstrate wrapping while demonstrating
         nothing. Length is what actually exercises the multi-line path: line
         height, the indent under the name, and how stroke and shadow look on a
         second and third line. */
      text:
        'so the way I have this set up is one browser source for chat and a second one for the counter, ' +
        'which means I can move them independently and the counter never inherits the chat font — took me ' +
        'far too long to work out, so posting it here for the next person who asks',
      emotes: [],
      timestamp: at(6),
      kind: 'chat',
    },
  },
  {
    group: 'event',
    label: 'YouTube super chat event card',
    message: {
      platform: 'youtube',
      id: 'sample-event',
      senderId: 'sample-event-sender',
      username: 'GoldTierViewer',
      color: '',
      badges: [],
      /* kind 'system' with a category is what the overlay renders as an event
         card: provider-coloured left border, gradient wash, no name colon.
         'cheer' is the category the YouTube connector really emits for a super
         chat — the connector is the authority on that, not this file. */
      text: 'GoldTierViewer sent a $20.00 Super Chat',
      emotes: [],
      timestamp: at(7),
      kind: 'system',
      category: 'cheer',
    },
  },
  {
    group: 'event',
    label: 'TikTok gift event card, on a second platform',
    message: {
      platform: 'tiktok',
      id: 'sample-gift',
      senderId: 'sample-gift-sender',
      username: 'giftgiver',
      color: '#25f4ee',
      badges: [],
      avatar: 'https://p16-sign-va.tiktokcdn.com/sample-gifter~c5_100x100.jpeg',
      /* A second card on a different platform, because the card takes its border
         and wash from the provider colour — one example cannot show that the
         colour actually follows the platform. */
      text: 'giftgiver sent Rose ×10',
      emotes: [],
      timestamp: at(8),
      kind: 'system',
      category: 'gift',
    },
  },
  {
    group: 'unicode',
    label: 'Twitch message in mixed scripts, with an emote after astral characters',
    message: {
      platform: 'twitch',
      id: 'sample-unicode',
      senderId: 'sample-unicode-sender',
      /* A non-Latin display name as well as non-Latin body text: the name and
         the body take different paths (a name can be a pill, can be painted, and
         can be hidden by hideNames), so testing only one leaves the other
         unproven. */
      username: 'ユキ_yuki',
      color: '#ff9edb',
      badges: [],
      text: UNICODE_TEXT,
      /* The emote sits *after* an astral-plane pair and a combining accent, so
         its offsets are only correct under codepoint indexing. A renderer that
         sliced by UTF-16 code unit would tear the text here — which is the whole
         reason this sample carries a native emote at all. */
      emotes: [nativeEmote(UNICODE_TEXT, PREVIEW_EMOTE_TOKENS.nativeTwitch, PREVIEW_EMOTE_NATIVE)],
      timestamp: at(9),
      kind: 'chat',
    },
  },
  {
    group: 'owner',
    label: 'YouTube channel owner, whose name renders as a gold pill',
    message: {
      platform: 'youtube',
      id: 'sample-owner',
      senderId: 'sample-owner-sender',
      username: 'StreamOwner',
      color: '',
      /* An 'owner' badge is deliberately not drawn as a badge: the production
         rule turns the whole name into a gold pill instead, and that rule is
         only exercised by a sample that actually carries the badge. */
      badges: [{ type: 'owner' }],
      avatar: 'https://yt3.ggpht.com/sample-owner=s64-c-k-c0x00ffffff-no-rj',
      text: 'thanks for hanging out, back tomorrow at the usual time',
      emotes: [],
      timestamp: at(10),
      kind: 'chat',
    },
  },
  {
    group: 'pin',
    label: 'Kick message designated as the pinned one',
    message: {
      platform: 'kick',
      id: 'sample-pin',
      senderId: 'sample-pin-sender',
      username: 'pinnedviewer',
      color: KICK_GREEN,
      badges: [{ type: 'moderator' }],
      text: 'read the pinned message before asking, thanks',
      emotes: [],
      timestamp: at(11),
      kind: 'chat',
    },
  },
];

/* ------------------------------------------------------------------ */
/* Accessors                                                           */
/* ------------------------------------------------------------------ */

/**
 * The sample the preview pins, and who pinned it.
 *
 * Data rather than view logic, so "which message is pinned" is not a decision
 * the UI makes. The overlay takes a pin separately from the message list, so
 * this is deliberately *not* spliced into SAMPLE_MESSAGES — doing so would
 * render the same line twice.
 */
export const SAMPLE_PIN_ID = 'sample-pin';
export const SAMPLE_PIN_BY = 'tiktokmod';

/** Just the messages, in display order — what the preview converts. */
export function sampleMessages(): UnifiedMessage[] {
  return SAMPLE_MESSAGES.map((sample) => sample.message);
}

/** The sample designated as pinned, or null if the id ever stops matching. */
export function samplePin(): UnifiedPin | null {
  const found = SAMPLE_MESSAGES.find((sample) => sample.message.id === SAMPLE_PIN_ID);
  return found ? { message: found.message, pinnedBy: SAMPLE_PIN_BY } : null;
}

/** Platforms represented in the sample set, in first-appearance order. */
export function samplePlatforms(): Platform[] {
  const seen: Platform[] = [];
  for (const { message } of SAMPLE_MESSAGES) {
    if (!seen.includes(message.platform)) seen.push(message.platform);
  }
  return seen;
}
