import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import ChatOverlay from '@/components/overlay/ChatOverlay';
import { buildParsedMessage } from '@/lib/multichatMessageModel';
import { MULTICHAT_GENERATOR_DEFAULTS, MultichatQuerySchema, buildMultichatQuery } from '@/lib/multichatConfig';
import { SAMPLE_COSMETICS, SAMPLE_MESSAGES } from '@/features/multichat/samples';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const channels = { kick: '', twitch: 'gxufy', youtube: '', tiktok: '' };

describe('bChat-style smooth message handling', () => {
  it('keeps legacy/default URLs unchanged and serializes only when enabled', () => {
    expect(MultichatQuerySchema.parse({}).smoothScroll).toBe(false);
    const off = new URLSearchParams(buildMultichatQuery(channels, MULTICHAT_GENERATOR_DEFAULTS));
    const on = new URLSearchParams(buildMultichatQuery(channels, {
      ...MULTICHAT_GENERATOR_DEFAULTS,
      smoothScroll: true,
    }));
    expect(off.has('smoothScroll')).toBe(false);
    expect(on.get('smoothScroll')).toBe('1');
  });

  it('accepts both 1 and true query spellings', () => {
    expect(MultichatQuerySchema.parse({ smoothScroll: '1' }).smoothScroll).toBe(true);
    expect(MultichatQuerySchema.parse({ smoothScroll: 'true' }).smoothScroll).toBe(true);
    expect(MultichatQuerySchema.parse({ smoothScroll: '0' }).smoothScroll).toBe(false);
  });

  it('does not stack the legacy height ghost on top of smooth scrolling', async () => {
    const config = MultichatQuerySchema.parse({ twitch: 'gxufy', animation: 'slide', smoothScroll: '1', msgSlideIn: '1' });
    const raw = SAMPLE_MESSAGES[0].message;
    const parsed = buildParsedMessage(raw, config, SAMPLE_COSMETICS, { enabled: config.mentionColor, colors: new Map() }, raw.timestamp);
    const { container } = render(<ChatOverlay config={config} messages={[parsed]} fadingIds={new Set()} pinnedMessage={null} showLoader={false} sourceTagExplicit />);
    await waitFor(() => expect(container.querySelector('.gx-bchat-slide-in')).not.toBeNull());
    expect(container.querySelector('[data-slide-ghost]')).toBeNull();
  });
});
