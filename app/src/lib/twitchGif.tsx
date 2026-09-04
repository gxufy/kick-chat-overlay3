import React from 'react';
import { handleAssetError } from './render/imageFallback';

export const DEFAULT_TWITCH_GIF_SIZE_PX = 100;
export const MIN_TWITCH_GIF_SIZE_PX = 16;
export const MAX_TWITCH_GIF_SIZE_PX = 512;

/**
 * Twitch's GIF tag can contain provider metadata before the actual asset URL.
 * Extract only an HTTPS URL and reject anything that cannot be parsed safely.
 */
export function parseTwitchGifTag(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw) return undefined;
  const match = raw.match(/https:\/\/[^\s]+/i);
  if (!match) return undefined;
  try {
    const url = new URL(match[0]);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Normalize the public gifSize= setting to a bounded pixel value. */
export function normalizeTwitchGifSize(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed)) return DEFAULT_TWITCH_GIF_SIZE_PX;
  return Math.min(MAX_TWITCH_GIF_SIZE_PX, Math.max(MIN_TWITCH_GIF_SIZE_PX, Math.round(parsed)));
}

/**
 * The render node used when Twitch marks a chat line as a native GIF message.
 * Width remains natural but can never escape the overlay viewport.
 */
export function renderTwitchGif(url: string, size: number): React.ReactNode {
  const px = normalizeTwitchGifSize(size);
  return (
    <img
      className="ck-twitch-gif"
      src={url}
      alt="GIF"
      draggable={false}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={handleAssetError}
      style={{
        display: 'inline-block',
        width: 'auto',
        height: 'auto',
        maxWidth: '100%',
        maxHeight: `${px}px`,
        objectFit: 'contain',
        verticalAlign: 'middle',
      }}
    />
  );
}
