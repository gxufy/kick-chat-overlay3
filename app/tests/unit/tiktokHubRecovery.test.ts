import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({ last: null as any }));

vi.mock('tiktok-live-connector', () => {
  class FakeTikTokConnection {
    handlers = new Map<string, Array<(data: any) => void>>();
    constructor() { fake.last = this; }
    on(event: string, handler: (data: any) => void) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
      return this;
    }
    connect() { return Promise.resolve({}); }
    disconnect() {}
    emit(event: string, data: any) {
      for (const handler of this.handlers.get(event) ?? []) handler(data);
    }
  }
  return {
    TikTokLiveConnection: FakeTikTokConnection,
    ControlEvent: { CONNECTED: 'CONNECTED', DISCONNECTED: 'DISCONNECTED' },
    WebcastEvent: {
      STREAM_END: 'STREAM_END', CHAT: 'CHAT', IM_DELETE: 'IM_DELETE', GIFT: 'GIFT',
      SUB_NOTIFY: 'SUB_NOTIFY', FOLLOW: 'FOLLOW', SHARE: 'SHARE', ROOM_PIN: 'ROOM_PIN',
    },
  };
});

import {
  TIKTOK_RECENT_MAX,
  resetTikTokHubForTests,
  subscribe,
  tikTokBufferedEventMatchesDelete,
} from '@/lib/tiktokHub';

beforeEach(() => {
  vi.useFakeTimers();
  fake.last = null;
  resetTikTokHubForTests();
});

afterEach(() => {
  resetTikTokHubForTests();
  vi.useRealTimers();
});

describe('TikTok shared-hub recovery', () => {
  it('keeps 100 recovery events and matches moderation deletes by message or author', () => {
    expect(TIKTOK_RECENT_MAX).toBe(100);
    expect(tikTokBufferedEventMatchesDelete({ id: 'm1', senderId: 'u1' }, { id: 'm1' })).toBe(true);
    expect(tikTokBufferedEventMatchesDelete({ id: 'm1', senderId: 'u1' }, { senderId: 'u1' })).toBe(true);
    expect(tikTokBufferedEventMatchesDelete({ id: 'm1', senderId: 'u1' }, { id: 'other' })).toBe(false);
  });

  it('replays a delete tombstone, not the deleted row, when moderation happens during SSE downtime', async () => {
    const first: any[] = [];
    const unsubscribeFirst = subscribe('streamer', (data) => first.push(data));
    await Promise.resolve();

    fake.last.emit('CHAT', {
      common: { msgId: 'message-1' },
      user: { userId: 'user-1', nickname: 'viewer' },
      content: 'delete me',
    });
    expect(first.some((event) => event.type === 'chat' && event.id === 'message-1')).toBe(true);

    unsubscribeFirst();
    fake.last.emit('IM_DELETE', { deleteMsgIdsList: ['message-1'] });

    const recovered: any[] = [];
    const unsubscribeRecovered = subscribe('streamer', (data) => recovered.push(data));
    expect(recovered.some((event) => event.type === 'chat' && event.id === 'message-1')).toBe(false);
    expect(recovered.some((event) => event.type === 'delete' && event.id === 'message-1')).toBe(true);
    unsubscribeRecovered();
  });

  it('prunes an author while retaining the author-delete tombstone for reconnecting overlays', async () => {
    const unsubscribeFirst = subscribe('streamer', () => {});
    await Promise.resolve();
    for (const id of ['m1', 'm2']) {
      fake.last.emit('CHAT', {
        common: { msgId: id },
        user: { userId: 'user-1', nickname: 'viewer' },
        content: id,
      });
    }
    fake.last.emit('CHAT', {
      common: { msgId: 'keep' },
      user: { userId: 'user-2', nickname: 'other' },
      content: 'keep',
    });
    unsubscribeFirst();
    fake.last.emit('IM_DELETE', { deleteUserIdsList: ['user-1'] });

    const recovered: any[] = [];
    const unsubscribeRecovered = subscribe('streamer', (data) => recovered.push(data));
    expect(recovered.filter((event) => event.type === 'chat').map((event) => event.id)).toEqual(['keep']);
    expect(recovered.some((event) => event.type === 'delete' && event.senderId === 'user-1')).toBe(true);
    unsubscribeRecovered();
  });
});
