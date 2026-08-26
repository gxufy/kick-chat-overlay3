import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTikTokConnector } from '@/lib/connectors/tiktok';
import type { UnifiedMessage, UnifiedPin } from '@/lib/types';

type MessageHandler = (event: { data: string }) => void;

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  onmessage: MessageHandler | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  emit(data: object): void {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  fail(): void {
    this.onerror?.();
  }

  close(): void {
    this.closed = true;
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeEventSource.instances.length = 0;
  vi.stubGlobal('EventSource', FakeEventSource);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function connectFixture() {
  const messages: UnifiedMessage[] = [];
  const pins: (UnifiedPin | null)[] = [];
  const statuses: string[] = [];
  const deletes: Array<{ id?: string; senderId?: string }> = [];
  const connector = createTikTokConnector({
    channel: '@gxufy',
    onMessage: message => messages.push(message),
    onDelete: deletion => deletes.push(deletion),
    onPin: pin => pins.push(pin),
    onStatus: (status, detail) => statuses.push(detail ? `${status}:${detail}` : status),
  });
  connector.start();
  return { connector, messages, pins, statuses, deletes };
}

describe('TikTok SSE ingestion', () => {
  it('drops replayed message ids after an SSE reconnect', async () => {
    const fixture = connectFixture();
    const first = FakeEventSource.instances[0];
    expect(first.url).toBe('/api/tiktok/chat?user=%40gxufy');

    first.emit({ type: 'status', status: 'connected' });
    first.emit({ type: 'chat', id: 123, senderId: 'u1', username: 'one', text: 'hello', timestamp: 1 });
    first.emit({
      type: 'gift', id: 'gift-1', senderId: 'u2', username: 'two',
      text: '😀 wow', giftIcon: 'https://example.test/gift.png', timestamp: 2,
    });

    expect(fixture.messages.map(message => message.id)).toEqual(['123', 'gift-1']);
    expect(fixture.messages[1].emotes).toEqual([{
      begin: 6,
      end: 10,
      text: 'gift',
      url: 'https://example.test/gift.png',
    }]);

    first.fail();
    expect(first.closed).toBe(true);
    await vi.advanceTimersByTimeAsync(5_000);

    const second = FakeEventSource.instances[1];
    expect(second).toBeDefined();
    /* The hub replays recent rows to a new subscriber. They must not traverse
       the overlay pipeline a second time. */
    second.emit({ type: 'chat', id: 123, senderId: 'u1', username: 'one', text: 'hello', timestamp: 1 });
    second.emit({ type: 'gift', id: 'gift-1', senderId: 'u2', username: 'two', text: '😀 wow', timestamp: 2 });
    second.emit({ type: 'chat', id: '124', senderId: 'u3', username: 'three', text: 'new', timestamp: 3 });

    expect(fixture.messages.map(message => message.id)).toEqual(['123', 'gift-1', '124']);
    expect(fixture.statuses).toEqual(['connecting', 'connected', 'connecting']);
    fixture.connector.stop();
  });

  it('keeps pin replay stateful and does not collapse events without ids', () => {
    const fixture = connectFixture();
    const source = FakeEventSource.instances[0];

    source.emit({ type: 'follow', username: 'one', text: 'one followed', timestamp: 1 });
    source.emit({ type: 'follow', username: 'one', text: 'one followed again', timestamp: 2 });
    source.emit({ type: 'pin', id: 'pin-1', senderId: 'u1', username: 'one', text: 'pinned', timestamp: 3 });
    source.emit({ type: 'pin', id: 'pin-1', senderId: 'u1', username: 'one', text: 'pinned', timestamp: 3 });

    expect(fixture.messages).toHaveLength(2);
    expect(fixture.messages.every(message => message.id === '')).toBe(true);
    /* Pins are current-state replay, not feed rows, so reapplying one is safe and
       lets a reconnect restore the banner even if its feed id was seen already. */
    expect(fixture.pins.map(pin => pin?.message.id)).toEqual(['pin-1', 'pin-1']);
    fixture.connector.stop();
  });
});