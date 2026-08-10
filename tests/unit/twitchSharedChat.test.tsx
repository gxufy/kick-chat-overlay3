import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTwitchConnector } from '@/lib/connectors/twitch';
import ChatOverlay from '@/components/overlay/ChatOverlay';
import { MultichatQuerySchema } from '@/lib/multichatConfig';
import type { UnifiedMessage } from '@/lib/types';
import type { ParsedMessage } from '@/lib/kick';

const profile = vi.hoisted(() => vi.fn());
vi.mock('@/lib/twitchProfileClient', () => ({ fetchTwitchProfile: profile }));
vi.mock('@/lib/twitchEmotes', () => ({ loadFFZRoomBadges: vi.fn(async () => ({})) }));

class FakeSocket {
  static last: FakeSocket;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];
  constructor() { FakeSocket.last = this; }
  send(value: string) { this.sent.push(value); }
  close() {}
}

beforeEach(() => {
  vi.stubGlobal('WebSocket', FakeSocket);
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
  profile.mockReset();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function connector(onMessage: (message: UnifiedMessage) => void, onMessageUpdate = vi.fn()) {
  const value = createTwitchConnector({ channel: 'local', onMessage, onMessageUpdate, onDelete: vi.fn(), onPin: vi.fn(), onStatus: vi.fn() });
  value.start();
  return { value, onMessageUpdate };
}

const irc = (id: string, sourceRoomId?: string, roomId = '100') =>
  `@room-id=${roomId};${sourceRoomId ? `source-room-id=${sourceRoomId};` : ''}display-name=Author;id=${id};user-id=9 :author!a@a PRIVMSG #local :hello\r\n`;

describe('Twitch Shared Chat connector', () => {
  it('keeps missing/equal source-room-id ordinary and marks a partner source canonically', () => {
    profile.mockResolvedValue(null);
    const messages: UnifiedMessage[] = [];
    const { value } = connector(message => messages.push(message));
    FakeSocket.last.onmessage?.({ data: irc('local') + irc('equal', '100') + irc('partner', '200') });
    expect(messages.map(message => message.sourceChannel)).toEqual([undefined, undefined, { roomId: '200' }]);
    value.stop();
  });

  it('delivers immediately and continues PING/later chat while profile lookup is pending', async () => {
    let resolve!: (value: any) => void;
    profile.mockImplementation(() => new Promise(result => { resolve = result; }));
    const messages: UnifiedMessage[] = [];
    const onMessageUpdate = vi.fn();
    const { value } = connector(message => messages.push(message), onMessageUpdate);
    FakeSocket.last.onmessage?.({ data: irc('partner', '200') });
    expect(messages).toHaveLength(1);
    expect(onMessageUpdate).not.toHaveBeenCalled();
    FakeSocket.last.onmessage?.({ data: 'PING :tmi.twitch.tv\r\n' + irc('later') });
    expect(FakeSocket.last.sent).toContain('PONG :tmi.twitch.tv');
    expect(messages.map(message => message.id)).toEqual(['partner', 'later']);
    resolve({ roomId: '200', displayName: 'Partner', profileImageUrl: 'https://cdn.example/partner.png' });
    await Promise.resolve(); await Promise.resolve();
    expect(onMessageUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 'partner', sourceChannel: expect.objectContaining({ displayName: 'Partner' }) }));
    value.stop();
  });

  it('suppresses an enrichment that resolves after stop', async () => {
    let resolve!: (value: any) => void;
    profile.mockImplementation(() => new Promise(result => { resolve = result; }));
    const onMessageUpdate = vi.fn();
    const { value } = connector(vi.fn(), onMessageUpdate);
    FakeSocket.last.onmessage?.({ data: irc('partner', '200') });
    value.stop();
    resolve({ roomId: '200', displayName: 'Partner' });
    await Promise.resolve(); await Promise.resolve();
    expect(onMessageUpdate).not.toHaveBeenCalled();
  });
});

describe('Twitch Shared Chat renderer', () => {
  const message = (kind: 'chat' | 'system'): ParsedMessage => ({
    id: `twitch:${kind}`, platform: 'twitch', kind, category: 'subscription', sourceChannel: {
      roomId: '200', displayName: 'Partner', profileImageUrl: 'https://cdn.example/partner.png',
    }, identity: { username: 'Author', color: '#fff', background: '', filter: '', badges: [] }, message: ['hello'],
  });
  it.each(['chat', 'system'] as const)('renders partner provenance separately on %s rows', (kind) => {
    const config = MultichatQuerySchema.parse({ twitch: 'local', animation: 'none' });
    const { getByTestId, container } = render(<ChatOverlay config={config} messages={[message(kind)]} fadingIds={new Set()} pinnedMessage={null} showLoader={false} />);
    expect(getByTestId('twitch-shared-source').textContent).toBe('Partner');
    expect(getByTestId('twitch-shared-source').querySelector('img')?.getAttribute('src')).toBe('https://cdn.example/partner.png');
    if (kind === 'chat') expect(container.textContent).toContain('Author');
    else expect(container.textContent).toContain('hello');
  });
});
