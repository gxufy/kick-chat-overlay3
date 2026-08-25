import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildKickMessage, fetchKickHistory } from '@/lib/connectors/kick';
import type { KickChannel } from '@/lib/kick';
import { extractAssignedJson, liveViewContinuation } from '@/pages/api/youtube/live';

afterEach(() => vi.unstubAllGlobals());

describe('provider chat parity', () => {
  it('merges Kick role and image badges by sort_order without requiring selected', () => {
    const message = buildKickMessage({
      id: 'm1', content: 'hello', created_at: '2026-08-25T20:00:00Z',
      sender: {
        id: 9, username: 'Chatter', identity: {
          color: '#abcdef',
          badges: [
            { type: 'subscriber', count: 12, sort_order: 30 },
            { type: 'moderator', sort_order: 20 },
          ],
          badges_v2: [
            { name: 'level', image_url: 'https://cdn.example/level.png', sort_order: 10, metadata: { level: 44 } },
          ],
        },
      },
    });
    expect(message.badges).toEqual([
      { type: 'level', url: 'https://cdn.example/level.png', count: 44, version: '44' },
      { type: 'moderator' },
      { type: 'subscriber', count: 12, version: '12' },
    ]);
    expect(message.timestamp).toBe(Date.parse('2026-08-25T20:00:00Z'));
  });

  it('normalizes Kick reply context using readable native-emote fallback text', () => {
    const message = buildKickMessage({
      id: 'reply', type: 'reply', content: 'yep',
      sender: { id: 1, username: 'Replying', identity: {} },
      metadata: {
        original_sender: { id: 2, username: 'Original' },
        original_message: { id: 'parent', content: 'hello [emote:123:Wave]' },
      },
    });
    expect(message.reply).toEqual({
      username: 'Original', senderId: '2', messageId: 'parent', text: 'hello Wave',
    });
  });

  it('loads recent Kick rows newest-first upstream but emits them oldest-first', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { messages: [
        { id: 'new', content: 'new', sender: { id: 1, username: 'U', identity: {} } },
        { id: 'mid', content: 'mid', sender: { id: 1, username: 'U', identity: {} } },
        { id: 'old', content: 'old', sender: { id: 1, username: 'U', identity: {} } },
      ] } }),
    })));
    const channel: KickChannel = {
      id: 10, user_id: 20, slug: 'test', chatroom: { id: 30 }, subscriber_badges: [],
      user: { id: 20, username: 'test' },
    };
    expect((await fetchKickHistory(channel)).map((message) => message.id)).toEqual(['old', 'mid', 'new']);
  });

  it('selects YouTube full Live chat instead of Top chat from ytInitialData', () => {
    const html = `window.ytInitialData = ${JSON.stringify({
      contents: { liveChatRenderer: { header: { liveChatHeaderRenderer: {
        viewSelector: { sortFilterSubMenuRenderer: { subMenuItems: [
          { title: 'Top chat', continuation: { reloadContinuationData: { continuation: 'TOP' } } },
          { title: 'Live chat', continuation: { reloadContinuationData: { continuation: 'LIVE' } } },
        ] } },
      } } } },
    })};`;
    const parsed = extractAssignedJson(html, 'ytInitialData');
    expect(liveViewContinuation(parsed)).toBe('LIVE');
  });
});
