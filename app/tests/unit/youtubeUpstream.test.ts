import { describe, expect, it } from 'vitest';
import {
  liveShortVideoIdFromHtml,
  mergeYouTubeLiveVideoIds,
} from '@/lib/server/youtubeUpstream';
import {
  shouldSendYouTubeSseEvent,
  youtubeSseSince,
} from '@/pages/api/youtube/stream';

describe('YouTube live broadcast discovery', () => {
  it('finds the live Short without mistaking ordinary Shorts for live broadcasts', () => {
    const html = [
      '"shortsLockupViewModel":{"entityId":"shorts-shelf-item-AAAAAAAAAAA","overlayMetadata":{"primaryText":"old short"}}',
      '"shortsLockupViewModel":{"entityId":"shorts-shelf-item-BBBBBBBBBBB","overlayMetadata":{"primaryText":"LIVE"},"badgeStyle":"THUMBNAIL_OVERLAY_BADGE_STYLE_LIVE"}',
      '"shortsLockupViewModel":{"entityId":"shorts-shelf-item-CCCCCCCCCCC","overlayMetadata":{"primaryText":"another short"}}',
    ].join('');
    expect(liveShortVideoIdFromHtml(html)).toBe('BBBBBBBBBBB');
  });

  it('keeps the featured broadcast first and de-duplicates a Short that resolves to the same video', () => {
    expect(mergeYouTubeLiveVideoIds('AAAAAAAAAAA', 'BBBBBBBBBBB'))
      .toEqual(['AAAAAAAAAAA', 'BBBBBBBBBBB']);
    expect(mergeYouTubeLiveVideoIds('AAAAAAAAAAA', 'AAAAAAAAAAA'))
      .toEqual(['AAAAAAAAAAA']);
    expect(mergeYouTubeLiveVideoIds(null, 'BBBBBBBBBBB'))
      .toEqual(['BBBBBBBBBBB']);
  });
});

describe('YouTube shared SSE session cutoff', () => {
  it('parses a valid browser-source start timestamp', () => {
    expect(youtubeSseSince('10000')).toBe(10_000);
    expect(youtubeSseSince(['12000', '13000'])).toBe(12_000);
    expect(youtubeSseSince('bad')).toBeNull();
    expect(youtubeSseSince('0')).toBeNull();
  });

  it('drops buffered action batches from before this browser source while preserving status/control data', () => {
    const since = 10_000;
    expect(shouldSendYouTubeSseEvent({ type: 'actions', timestamp: 9_999 }, since)).toBe(false);
    expect(shouldSendYouTubeSseEvent({ type: 'actions', timestamp: 10_000 }, since)).toBe(true);
    expect(shouldSendYouTubeSseEvent({ type: 'status' }, since)).toBe(true);
  });
});
