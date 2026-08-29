import { describe, expect, it } from 'vitest';
import { purgePlatformChat } from '@/lib/platformChatVisibility';
import type { Platform } from '@/lib/types';

type Message = { id: string; platform: Platform };

const allPlatforms: Platform[] = ['kick', 'twitch', 'youtube', 'tiktok'];

function messages(prefix: string): Message[] {
  return allPlatforms.map((platform) => ({ id: `${prefix}-${platform}`, platform }));
}

describe('platform chat visibility purge', () => {
  it.each(allPlatforms)('removes %s from backing, pending, and already-presented chat', (platform) => {
    const result = purgePlatformChat({
      backing: messages('backing'),
      pending: messages('pending'),
      presented: messages('presented'),
    }, platform);

    for (const store of [result.backing, result.pending, result.presented]) {
      expect(store.some((message) => message.platform === platform)).toBe(false);
      expect(store).toHaveLength(allPlatforms.length - 1);
      for (const other of allPlatforms.filter((candidate) => candidate !== platform)) {
        expect(store.some((message) => message.platform === other)).toBe(true);
      }
    }
  });

  it('does not mutate the input arrays', () => {
    const backing = messages('backing');
    const pending = messages('pending');
    const presented = messages('presented');

    purgePlatformChat({ backing, pending, presented }, 'youtube');

    expect(backing).toHaveLength(4);
    expect(pending).toHaveLength(4);
    expect(presented).toHaveLength(4);
  });
});
