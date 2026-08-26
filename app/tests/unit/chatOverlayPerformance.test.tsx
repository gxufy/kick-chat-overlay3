import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ChatOverlay from '@/components/overlay/ChatOverlay';
import { MultichatQuerySchema } from '@/lib/multichatConfig';
import type { ParsedMessage } from '@/lib/kick';

const message: ParsedMessage = {
  id: 'twitch:performance',
  platform: 'twitch',
  kind: 'chat',
  identity: { username: 'user', color: '#fff', background: '', filter: '', badges: [] },
  message: ['hello'],
};

afterEach(cleanup);

describe('chat overlay compositor-friendly rendering', () => {
  it('uses text-shadow instead of filtering the entire animated chat subtree', () => {
    const config = MultichatQuerySchema.parse({ twitch: 'channel', animation: 'none', textShadow: 'large' });
    const { container } = render(
      <ChatOverlay
        config={config}
        messages={[message]}
        fadingIds={new Set()}
        pinnedMessage={null}
        showLoader={false}
      />,
    );
    const chat = container.querySelector('#chat_container') as HTMLElement;
    expect(chat.style.filter).toBe('');
    expect(chat.style.textShadow).toContain('black');
  });
});
