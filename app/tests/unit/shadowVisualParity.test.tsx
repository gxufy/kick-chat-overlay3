import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ChatOverlay from '@/components/overlay/ChatOverlay';
import { MultichatQuerySchema } from '@/lib/multichatConfig';
import type { ParsedMessage } from '@/lib/kick';

const config = MultichatQuerySchema.parse({
  twitch: 'gxufy',
  textShadow: 'medium',
  stroke: 'thin',
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

describe('bChat shadow, stroke, and paint composition', () => {
  it('uses bChat row drop-shadow geometry and diagonal text-shadow stroke', () => {
    const { container } = render(
      <ChatOverlay
        config={config}
        messages={[message()]}
        fadingIds={new Set()}
        pinnedMessage={null}
        showLoader={false}
      />,
    );

    const name = screen.getByText('ColorUser');
    const row = name.closest('.gx-message-row') as HTMLElement;
    const chat = container.querySelector('#chat_container') as HTMLElement;

    expect(row.style.filter).toBe('drop-shadow(2px 2px 3px rgba(0, 0, 0, 0.7))');
    expect(chat.style.textShadow).toBe('1px 1px 0 black, -1px 1px 0 black, 1px -1px 0 black, -1px -1px 0 black');
    expect(chat.style.webkitTextStroke).toBe('');
    expect(name.style.filter).toBe('');
    expect(name.style.color).toBe('rgb(255, 79, 139)');
  });

  it('keeps 7TV paint shadow on the painted name and the bChat black shadow on the row', () => {
    const { container } = render(
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
    const row = name.closest('.gx-message-row') as HTMLElement;
    expect(row.style.filter).toBe('drop-shadow(2px 2px 3px rgba(0, 0, 0, 0.7))');
    expect(name.style.filter).toBe('drop-shadow(0px 0px 2px rgba(255,0,85,0.8))');
    expect(name.style.filter).not.toContain('2px 2px 3px');
    expect(name.style.textShadow).toBe('none');
    expect(container.querySelector('#chat_container')).not.toBeNull();
  });

  it('uses a direct paint stroke when paint shadows are off, just like bChat', () => {
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
    expect(name.style.webkitTextStroke).toBe('1px black');
  });

  it('maps large shadow to bChat full-opacity default and none to no filter', () => {
    const large = render(
      <ChatOverlay
        config={{ ...config, textShadow: 'large' }}
        messages={[message()]}
        fadingIds={new Set()}
        pinnedMessage={null}
        showLoader={false}
      />,
    );
    expect((large.container.querySelector('.gx-message-row') as HTMLElement).style.filter)
      .toBe('drop-shadow(2px 2px 3px rgba(0, 0, 0, 1))');
    cleanup();

    const none = render(
      <ChatOverlay
        config={{ ...config, textShadow: 'none' }}
        messages={[message()]}
        fadingIds={new Set()}
        pinnedMessage={null}
        showLoader={false}
      />,
    );
    expect((none.container.querySelector('.gx-message-row') as HTMLElement).style.filter).toBe('');
  });
});
