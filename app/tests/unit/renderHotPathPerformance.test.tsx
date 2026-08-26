import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buildParsedMessage, NO_COSMETICS } from '@/lib/multichatMessageModel';
import { renderMessageText, type MentionContext } from '@/lib/render';
import type { SevenTVEmote } from '@/lib/kick';
import type { UnifiedMessage } from '@/lib/types';

const message: UnifiedMessage = {
  platform: 'twitch',
  id: 'hot-path',
  senderId: 'user-1',
  username: 'user',
  color: '#ffffff',
  badges: [],
  text: 'Wave',
  emotes: [],
  timestamp: 1,
  kind: 'chat',
};

const emote = (image: string): SevenTVEmote => ({
  name: 'Wave',
  image,
  height: 32,
  width: 32,
  zeroWidth: false,
  upscale: false,
});

class CountingColorMap extends Map<string, string> {
  writes = 0;

  override set(key: string, value: string): this {
    this.writes++;
    return super.set(key, value);
  }
}

const config = {
  sevenTVEmotesEnabled: false,
  sevenTVCosmeticsEnabled: false,
  paintShadows: true,
};

describe('render hot-path caches', () => {
  it('preserves first-match semantics when a 7TV set contains duplicate names', () => {
    const set = [emote('https://cdn.example/first.webp'), emote('https://cdn.example/second.webp')];
    const nodes = renderMessageText(message, set);
    const { container } = render(<>{nodes}</>);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://cdn.example/first.webp');
  });

  it('writes one mention-color key when upstream and display names are identical', () => {
    const colors = new CountingColorMap();
    const mentions: MentionContext = { enabled: true, colors };

    const parsed = buildParsedMessage(message, config, NO_COSMETICS, mentions, 1);

    expect(parsed.identity.color).toBe('#ffffff');
    expect(colors.writes).toBe(1);
    expect(colors.get('user')).toBe('#ffffff');
  });

  it('still records both YouTube handle and display-name aliases', () => {
    const colors = new CountingColorMap();
    const mentions: MentionContext = { enabled: true, colors };
    const youtube: UnifiedMessage = {
      ...message,
      platform: 'youtube',
      id: 'youtube-hot-path',
      senderId: 'channel-1',
      username: '@Creator',
    };

    const parsed = buildParsedMessage(youtube, config, NO_COSMETICS, mentions, 1);

    expect(parsed.identity.username).toBe('Creator');
    expect(colors.writes).toBe(2);
    expect(colors.get('@creator')).toBe('#ffffff');
    expect(colors.get('creator')).toBe('#ffffff');
  });
});
