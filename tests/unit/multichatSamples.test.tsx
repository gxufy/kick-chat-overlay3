/* Sample message fixtures — shape, determinism, and coverage.
 *
 * These samples exist to be rendered by the production ChatOverlay, so what
 * matters is that they are valid ParsedMessage values, that every renderer
 * capability is represented, and that nothing about them varies between runs.
 */
import { describe, expect, it } from 'vitest';
import {
  SAMPLE_GROUPS,
  SAMPLE_MESSAGES,
  SAMPLE_PIN_BY,
  SAMPLE_PIN_ID,
  samplePin,
  samplePlatforms,
} from '@/lib/tools/multichat/samples';

describe('sample coverage', () => {
  it('represents every declared group at least once', () => {
    const present = new Set(SAMPLE_MESSAGES.map((s) => s.group));
    for (const group of SAMPLE_GROUPS) {
      expect(present.has(group), `no sample for group "${group}"`).toBe(true);
    }
  });

  it('declares no group it does not use', () => {
    for (const sample of SAMPLE_MESSAGES) {
      expect(SAMPLE_GROUPS).toContain(sample.group);
    }
  });

  it('covers all four platforms, each at least twice', () => {
    const counts = new Map<string, number>();
    for (const { message } of SAMPLE_MESSAGES) {
      const p = message.platform ?? 'none';
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    for (const platform of ['kick', 'twitch', 'youtube', 'tiktok']) {
      expect(counts.get(platform) ?? 0, `${platform} coverage`).toBeGreaterThanOrEqual(2);
    }
  });

  it('never places two messages from the same platform next to each other', () => {
    /* Mixed-platform ordering is what makes the source-tag setting visibly
       meaningful in the preview. */
    for (let i = 1; i < SAMPLE_MESSAGES.length; i++) {
      expect(
        SAMPLE_MESSAGES[i].message.platform,
        `samples ${i - 1} and ${i} share a platform`,
      ).not.toBe(SAMPLE_MESSAGES[i - 1].message.platform);
    }
  });

  it('gives every sample a non-empty label for the legend', () => {
    for (const sample of SAMPLE_MESSAGES) {
      expect(sample.label.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('ParsedMessage shape', () => {
  it('gives every sample a unique id', () => {
    const ids = SAMPLE_MESSAGES.map((s) => s.message.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('fills the identity fields the renderer reads unconditionally', () => {
    for (const { message } of SAMPLE_MESSAGES) {
      expect(typeof message.identity.username).toBe('string');
      expect(message.identity.username.length).toBeGreaterThan(0);
      expect(typeof message.identity.color).toBe('string');
      /* background and filter must be present — the renderer branches on
         `!!identity.background`, so undefined would be a different code path
         than the empty string these use for "no paint". */
      expect(typeof message.identity.background).toBe('string');
      expect(typeof message.identity.filter).toBe('string');
      expect(Array.isArray(message.identity.badges)).toBe(true);
    }
  });

  it('gives every sample a non-empty message body', () => {
    for (const { message } of SAMPLE_MESSAGES) {
      expect(Array.isArray(message.message)).toBe(true);
      expect(message.message.length).toBeGreaterThan(0);
    }
  });

  it('uses only kinds the renderer implements', () => {
    for (const { message } of SAMPLE_MESSAGES) {
      expect(['chat', 'system']).toContain(message.kind);
    }
  });

  it('gives the event-card sample a category, which is what triggers that path', () => {
    const event = SAMPLE_MESSAGES.find((s) => s.group === 'event');
    expect(event?.message.kind).toBe('system');
    expect(event?.message.category).toBeTruthy();
  });

  it('gives the paint sample both background and filter', () => {
    const paint = SAMPLE_MESSAGES.find((s) => s.group === 'paint');
    expect(paint?.message.identity.background).toBeTruthy();
    expect(paint?.message.identity.filter).toBeTruthy();
  });

  it('gives the badge samples actual badge nodes', () => {
    const badged = SAMPLE_MESSAGES.find((s) => s.group === 'badges');
    expect((badged?.message.identity.badges ?? []).length).toBeGreaterThan(0);
  });
});

describe('determinism', () => {
  it('produces identical timestamps on repeated reads', () => {
    const first = SAMPLE_MESSAGES.map((s) => s.message.timestamp);
    const second = SAMPLE_MESSAGES.map((s) => s.message.timestamp);
    expect(first).toEqual(second);
  });

  it('uses fixed timestamps, not a clock', () => {
    /* Every timestamp is well in the past relative to any plausible run, and
       strictly increasing — a Date.now() seed would neither be stable across
       runs nor ordered by construction. */
    const stamps = SAMPLE_MESSAGES.map((s) => s.message.timestamp ?? 0);
    for (let i = 1; i < stamps.length; i++) {
      expect(stamps[i]).toBeGreaterThan(stamps[i - 1]);
    }
    expect(Math.max(...stamps)).toBeLessThan(Date.now());
  });

  it('uses literal ids, not generated ones', () => {
    for (const { message } of SAMPLE_MESSAGES) {
      /* A uuid or a clock-derived id would contain long digit or hex runs. */
      expect(message.id).toMatch(/^sample-[a-z]+-[a-z]+$/);
    }
  });

  it('is frozen in order, so a snapshot cannot reorder between runs', () => {
    expect(SAMPLE_MESSAGES.map((s) => s.message.id)).toEqual([
      'sample-plain-kick',
      'sample-badges-twitch',
      'sample-mention-youtube',
      'sample-emotes-kick',
      'sample-paint-twitch',
      'sample-moderation-tiktok',
      'sample-event-youtube',
      'sample-gift-tiktok',
      'sample-pin-kick',
    ]);
  });
});

describe('pin selection', () => {
  it('resolves to a real sample', () => {
    const pin = samplePin();
    expect(pin).not.toBeNull();
    expect(pin?.msg.id).toBe(SAMPLE_PIN_ID);
    expect(pin?.pinnedBy).toBe(SAMPLE_PIN_BY);
  });

  it('names a pinner who is themselves a sample author, not an invented user', () => {
    const authors = SAMPLE_MESSAGES.map((s) => s.message.identity.username);
    expect(authors).toContain(SAMPLE_PIN_BY);
  });

  it('does not splice the pin into the message list', () => {
    /* The overlay takes the pin as a separate prop; duplicating it into the
       list would render the same line twice. */
    const occurrences = SAMPLE_MESSAGES.filter((s) => s.message.id === SAMPLE_PIN_ID);
    expect(occurrences).toHaveLength(1);
  });
});

describe('samplePlatforms', () => {
  it('lists platforms in first-appearance order, without repeats', () => {
    expect(samplePlatforms()).toEqual(['kick', 'twitch', 'youtube', 'tiktok']);
  });
});
