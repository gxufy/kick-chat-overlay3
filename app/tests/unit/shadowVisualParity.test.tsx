import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ChatOverlay from '@/components/overlay/ChatOverlay';
import { MultichatQuerySchema } from '@/lib/multichatConfig';
import type { ParsedMessage } from '@/lib/kick';

const config = MultichatQuerySchema.parse({
  twitch: 'gxufy',
  textShadow: 'medium',
  smoothScroll: '1',
});

function message(overrides: Partial<ParsedMessage['identity']> = {}): ParsedMessage {
  return {
    id: 'twitch:visual-shadow',
    platform: 'twitch',
    timestamp: 1,
    identity: {
      username: 'ColorUser',
      color: '#ff4f8b',
      background: '',
      filter: '',
      badges: [],
      ...overrides,
    },
    message: ['hello'],
  };
}

afterEach(cleanup);

describe('pre-optimization username shadow parity', () => {
  it('keeps the old drop-shadow treatment on normal colored usernames', () => {
    render(
      <ChatOverlay
        config={config}
        messages={[message()]}
        fadingIds={new Set()}
        pinnedMessage={null}
        showLoader={false}
      />,
    );

    const name = screen.getByText('ColorUser');
    expect(name.style.filter).toBe('drop-shadow(2px 2px 0.35rem black)');
    expect(name.style.textShadow).toBe('none');
    expect(name.style.color).toBe('rgb(255, 79, 139)');
  });

  it('adds the old black shadow after a 7TV paint own filter instead of replacing it', () => {
    render(
      <ChatOverlay
        config={config}
        messages={[message({
          background: 'linear-gradient(90deg, #ff0055, #6f5cff)',
          filter: 'drop-shadow(0px 0px 2px rgba(255,0,85,0.8))',
        })]}
        fadingIds={new Set()}
        pinnedMessage={null}
        showLoader={false}
      />,
    );

    const name = screen.getByText('ColorUser');
    expect(name.style.filter).toContain('drop-shadow(0px 0px 2px rgba(255,0,85,0.8))');
    expect(name.style.filter).toContain('drop-shadow(2px 2px 0.35rem black)');
    expect(name.style.textShadow).toBe('none');
  });

  it('keeps the paint but removes every painted-name drop-shadow when paintShadows is off', () => {
    render(
      <ChatOverlay
        config={{ ...config, paintShadows: false }}
        messages={[message({
          background: 'linear-gradient(90deg, #ff0055, #6f5cff)',
          filter: '',
        })]}
        fadingIds={new Set()}
        pinnedMessage={null}
        showLoader={false}
      />,
    );

    const name = screen.getByText('ColorUser');
    expect(name.style.filter).toBe('');
    expect(name.style.backgroundImage).toContain('linear-gradient');
    expect(name.style.textShadow).toBe('none');
  });
});
