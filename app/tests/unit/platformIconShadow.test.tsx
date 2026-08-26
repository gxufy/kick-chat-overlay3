import { cleanup, render } from '@testing-library/react';
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
