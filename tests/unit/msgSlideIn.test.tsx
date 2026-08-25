import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import ChatOverlay from '@/components/overlay/ChatOverlay';
import { buildParsedMessage } from '@/lib/multichatMessageModel';
import {
  MULTICHAT_GENERATOR_DEFAULTS,
  MultichatQuerySchema,
  buildMultichatQuery,
} from '@/lib/multichatConfig';
import { SAMPLE_COSMETICS, SAMPLE_MESSAGES } from '@/features/multichat/samples';

afterEach(cleanup);

const channels = { kick: 'gxufy', twitch: '', youtube: '', tiktok: '' };

describe('message slide-in', () => {
  it('is off by default and accepts boolean query syntax', () => {
    expect(MultichatQuerySchema.parse({}).msgSlideIn).toBe(false);
    expect(MultichatQuerySchema.parse({ msgSlideIn: '1' }).msgSlideIn).toBe(true);
    expect(MultichatQuerySchema.parse({ msgSlideIn: '0' }).msgSlideIn).toBe(false);
  });

  it('serializes as msgSlideIn=1 only when enabled', () => {
    const off = new URLSearchParams(
      buildMultichatQuery(channels, MULTICHAT_GENERATOR_DEFAULTS),
    );
    const on = new URLSearchParams(
      buildMultichatQuery(channels, {
        ...MULTICHAT_GENERATOR_DEFAULTS,
        msgSlideIn: true,
      }),
    );
    expect(off.has('msgSlideIn')).toBe(false);
    expect(on.get('msgSlideIn')).toBe('1');
  });

  it('marks newly mounted message rows without changing their identity', async () => {
    const config = MultichatQuerySchema.parse({
      twitch: 'somebody',
      animation: 'none',
      msgSlideIn: '1',
    });
    const raw = SAMPLE_MESSAGES[0].message;
    const parsed = buildParsedMessage(
      raw,
      config,
      SAMPLE_COSMETICS,
      { enabled: config.mentionColor, colors: new Map() },
      raw.timestamp,
    );
    const { container } = render(
      <ChatOverlay
        config={config}
        messages={[parsed]}
        fadingIds={new Set()}
        pinnedMessage={null}
        showLoader={false}
        sourceTagExplicit
      />,
    );
    await waitFor(() => {
      expect(container.querySelector('.gx-message-slide-in')).not.toBeNull();
    });
  });
});
