import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderMessageText } from '@/lib/render';
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

describe('render hot-path caches', () => {
  it('preserves first-match semantics when a 7TV set contains duplicate names', () => {
    const set = [emote('https://cdn.example/first.webp'), emote('https://cdn.example/second.webp')];
    const nodes = renderMessageText(message, set);
    const { container } = render(<>{nodes}</>);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://cdn.example/first.webp');
  });
});
