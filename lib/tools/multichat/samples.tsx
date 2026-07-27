/* Deterministic sample chat messages for the Demo Preview.
 *
 * These are `ParsedMessage` values — the exact type the four live connectors
 * produce and the production `ChatOverlay` consumes. That is the whole point:
 * Demo Preview renders the real overlay component over these, so there is no
 * second chat renderer to drift from the first. Anything the overlay does with a
 * real message (badges, paints, pills, avatars, event cards, source tags,
 * stroke, shadow, font, batching) it does with these unchanged.
 *
 * DETERMINISM. No Date.now, no Math.random, no network. Ids are literal and
 * stable, so a snapshot or a DOM query cannot flake, and the same sample set
 * renders identically on every machine and every run. Timestamps are fixed
 * offsets from a constant epoch rather than "now".
 *
 * Emote and badge art is referenced by URL from the same CDNs the connectors
 * use. In a test environment those requests never resolve, which is fine: the
 * assertions are about the elements the overlay emits, not about pixels.
 *
 * Browser-safe — no server-only imports, no secrets.
 */
import type { ParsedMessage } from '@/lib/kick';
import type { Platform } from '@/lib/types';

/* A fixed instant, so timestamps are stable across runs and machines.
   2026-01-01T00:00:00Z. Never Date.now(). */
const EPOCH = 1_767_225_600_000;

/** Sequential fixed timestamps, one second apart, in sample order. */
const at = (index: number) => EPOCH + index * 1000;

/** A 7TV-style emote image, sized by the overlay's own emote CSS classes. */
function emote(name: string, id: string) {
  return (
    <img
      key={`e-${id}`}
      className="ck-emote"
      src={`https://cdn.7tv.app/emote/${id}/2x.webp`}
      alt={name}
      title={name}
    />
  );
}

/** A badge image, styled by the overlay's own badge CSS class. */
function badge(type: string, src: string) {
  return <img key={`b-${type}`} className="ck-badge-img" src={src} alt={type} />;
}

/** A mention chip, matching what renderMessageText emits for a @name. */
function mention(name: string) {
  return (
    <span key={`m-${name}`} className="ck-mention" data-mention={name}>
      @{name}
    </span>
  );
}

/**
 * The sample categories, each demonstrating one renderer capability.
 *
 * Exposed as a union rather than free-form strings so the preview's own filter
 * UI and its tests share one list and cannot fall out of step.
 */
export const SAMPLE_GROUPS = [
  'plain',
  'badges',
  'mention',
  'emotes',
  'paint',
  'moderation',
  'event',
  'pin',
] as const;

export type SampleGroup = (typeof SAMPLE_GROUPS)[number];

/** A sample plus the capability it exists to demonstrate. */
export type SampleMessage = {
  readonly group: SampleGroup;
  /** Shown in the preview's own legend. Not overlay content. */
  readonly label: string;
  readonly message: ParsedMessage;
};

/** Default identity fields, so each sample only states what it is exercising. */
const identity = (
  username: string,
  color: string,
  extra: Partial<ParsedMessage['identity']> = {},
): ParsedMessage['identity'] => ({
  username,
  color,
  background: '',
  filter: '',
  badges: [],
  ...extra,
});

/**
 * Every sample, in display order.
 *
 * Ordered so the mixed-platform requirement is satisfied by the list as a whole:
 * consecutive messages come from different platforms, which is what makes the
 * source-tag setting visibly meaningful in the preview. Each platform appears at
 * least twice, and every group in SAMPLE_GROUPS appears at least once — both
 * asserted in tests/unit/multichatSamples.test.tsx.
 */
export const SAMPLE_MESSAGES: readonly SampleMessage[] = [
  {
    group: 'plain',
    label: 'Plain Kick message',
    message: {
      id: 'sample-plain-kick',
      platform: 'kick',
      kind: 'chat',
      timestamp: at(0),
      identity: identity('greenscreen', '#53fc18'),
      message: ['first time catching the stream live, this is sick'],
    },
  },
  {
    group: 'badges',
    label: 'Twitch broadcaster with badges',
    message: {
      id: 'sample-badges-twitch',
      platform: 'twitch',
      kind: 'chat',
      timestamp: at(1),
      identity: identity('purplereign', '#a970ff', {
        badges: [
          badge('broadcaster', 'https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/2'),
          badge('subscriber', 'https://static-cdn.jtvnw.net/badges/v1/5d9f2208-5dd8-11e7-8513-2ff4adfae661/2'),
        ],
      }),
      message: ['welcome in everyone, mods are up'],
    },
  },
  {
    group: 'mention',
    label: 'YouTube message with a mention',
    message: {
      id: 'sample-mention-youtube',
      platform: 'youtube',
      kind: 'chat',
      timestamp: at(2),
      avatar: 'https://yt3.ggpht.com/sample-avatar=s64-c-k-c0x00ffffff-no-rj',
      identity: identity('RedButtonRadio', '#ff5b5b'),
      message: [mention('greenscreen'), ' agreed, the new layout is much better'],
    },
  },
  {
    group: 'emotes',
    label: 'Kick message with 7TV emotes',
    message: {
      id: 'sample-emotes-kick',
      platform: 'kick',
      kind: 'chat',
      timestamp: at(3),
      identity: identity('emotefiend', '#7ae2ff'),
      message: [
        'that clip had me ',
        emote('OMEGALUL', '01F6MZGCKG000255K4T4CG3TB2'),
        ' ',
        emote('KEKW', '01F6ME5WVR000255K4TQNRZZQ6'),
      ],
    },
  },
  {
    group: 'paint',
    label: 'Twitch subscriber with a 7TV paint',
    message: {
      id: 'sample-paint-twitch',
      platform: 'twitch',
      kind: 'chat',
      timestamp: at(4),
      identity: identity('paintedname', '#ffffff', {
        /* A paint is a gradient clipped to the name's glyphs. The overlay keys
           off `background` being non-empty and applies `filter` alongside it,
           so both are set here — that is the real 7TV cosmetic shape. */
        background: 'linear-gradient(90deg, #ff5f6d 0%, #ffc371 50%, #47e5bc 100%)',
        filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.6))',
        badges: [
          badge('subscriber', 'https://static-cdn.jtvnw.net/badges/v1/5d9f2208-5dd8-11e7-8513-2ff4adfae661/2'),
        ],
      }),
      message: ['gradient name, courtesy of 7TV'],
    },
  },
  {
    group: 'moderation',
    label: 'TikTok moderator',
    message: {
      id: 'sample-moderation-tiktok',
      platform: 'tiktok',
      kind: 'chat',
      timestamp: at(5),
      avatar: 'https://p16-sign-va.tiktokcdn.com/sample-avatar~c5_100x100.jpeg',
      identity: identity('tiktokmod', '#25f4ee', {
        badges: [badge('moderator', '/badges/moderator.svg')],
      }),
      message: ['keep it civil in here please'],
    },
  },
  {
    group: 'event',
    label: 'YouTube super chat event card',
    message: {
      id: 'sample-event-youtube',
      /* kind 'system' with a category is what the overlay renders as an event
         card: provider-coloured left border, gradient wash, no name colon. */
      platform: 'youtube',
      kind: 'system',
      category: 'superchat',
      timestamp: at(6),
      identity: identity('GoldTierViewer', '#ffd166'),
      message: ['sent a super chat — $20.00'],
    },
  },
  {
    group: 'event',
    label: 'TikTok gift event card',
    message: {
      id: 'sample-gift-tiktok',
      /* A second event card, on a different platform, because the card takes its
         left border and wash from the provider colour — one example cannot show
         that the colour actually follows the platform. */
      platform: 'tiktok',
      kind: 'system',
      category: 'gift',
      timestamp: at(7),
      avatar: 'https://p16-sign-va.tiktokcdn.com/sample-gifter~c5_100x100.jpeg',
      identity: identity('giftgiver', '#25f4ee'),
      message: ['sent Rose ×10'],
    },
  },
  {
    group: 'pin',
    label: 'Kick message pinned by a moderator',
    message: {
      id: 'sample-pin-kick',
      platform: 'kick',
      kind: 'chat',
      timestamp: at(8),
      identity: identity('pinnedviewer', '#53fc18', {
        badges: [badge('moderator', '/badges/moderator.svg')],
      }),
      message: ['read the pinned message before asking, thanks'],
    },
  },
];

/**
 * The sample the pin demo pins, and who pinned it.
 *
 * Kept beside the samples rather than chosen by the panel, so "which message is
 * pinned" is data, not UI logic. The overlay takes a PinnedState separately from
 * the message list, so this is deliberately not spliced into SAMPLE_MESSAGES.
 */
export const SAMPLE_PIN_ID = 'sample-pin-kick';
export const SAMPLE_PIN_BY = 'tiktokmod';

/** The sample designated as pinned, or null if the id ever stops matching. */
export function samplePin(): { msg: ParsedMessage; pinnedBy: string } | null {
  const found = SAMPLE_MESSAGES.find((s) => s.message.id === SAMPLE_PIN_ID);
  return found ? { msg: found.message, pinnedBy: SAMPLE_PIN_BY } : null;
}

/** Platforms represented in the sample set, in first-appearance order. */
export function samplePlatforms(): Platform[] {
  const seen: Platform[] = [];
  for (const { message } of SAMPLE_MESSAGES) {
    const p = message.platform;
    if (p && !seen.includes(p)) seen.push(p);
  }
  return seen;
}
