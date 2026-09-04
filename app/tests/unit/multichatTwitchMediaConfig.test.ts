import { describe, expect, it } from 'vitest';
import {
  MULTICHAT_WORKSPACE_DEFAULTS,
  MultichatQuerySchema,
  buildMultichatQuery,
} from '@/lib/multichatConfig';

describe('MultiChat Twitch media and Google Font config', () => {
  it('keeps GIFs off by default and bounds direct URL gifSize', () => {
    expect(MultichatQuerySchema.parse({}).gifs).toBe(false);
    expect(MultichatQuerySchema.parse({}).gifSize).toBe(100);
    expect(MultichatQuerySchema.parse({ gifs: 'true', gifSize: '9999' }).gifSize).toBe(512);
  });

  it('keeps arbitrary font family text available to the renderer', () => {
    expect(MultichatQuerySchema.parse({ font: 'Press Start 2P' }).font).toBe('Press Start 2P');
  });

  it('serializes Google font override through the existing font parameter', () => {
    const query = buildMultichatQuery(
      { kick: '', twitch: 'streamer', youtube: '', tiktok: '' },
      { ...MULTICHAT_WORKSPACE_DEFAULTS, googleFont: 'Press Start 2P' },
    );
    const params = new URLSearchParams(query);
    expect(params.get('font')).toBe('Press Start 2P');
    expect(params.has('googleFont')).toBe(false);
  });

  it('emits GIF size only while GIF rendering is enabled', () => {
    const channels = { kick: '', twitch: 'streamer', youtube: '', tiktok: '' };
    const disabled = new URLSearchParams(buildMultichatQuery(channels, MULTICHAT_WORKSPACE_DEFAULTS));
    expect(disabled.has('gifs')).toBe(false);
    expect(disabled.has('gifSize')).toBe(false);

    const enabled = new URLSearchParams(buildMultichatQuery(channels, {
      ...MULTICHAT_WORKSPACE_DEFAULTS,
      gifs: true,
      gifSize: '180',
    }));
    expect(enabled.get('gifs')).toBe('true');
    expect(enabled.get('gifSize')).toBe('180');
  });
});
