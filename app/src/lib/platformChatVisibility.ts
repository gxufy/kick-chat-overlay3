import type { Platform } from './types';

export type PlatformTaggedMessage = {
  platform?: Platform;
};

export type PlatformChatStores<T extends PlatformTaggedMessage> = {
  /** Canonical messages retained by the overlay runtime. */
  backing: readonly T[];
  /** Rows waiting for the next fixed 200 ms presentation tick. */
  pending: readonly T[];
  /** Rows already handed to ChatOverlay / currently eligible to be on screen. */
  presented: readonly T[];
};

export type PurgedPlatformChatStores<T extends PlatformTaggedMessage> = {
  backing: T[];
  pending: T[];
  presented: T[];
};

/**
 * Remove one platform from every chat-presentation layer in one synchronous step.
 *
 * Platform `off` commands are runtime visibility controls, not connector stops:
 * the connector remains alive so its own moderator/broadcaster can issue the
 * matching `on` command later. That means hiding cannot rely only on filtering the
 * canonical backing array. A row can already exist in the presented cache or be
 * waiting in the 200 ms ingress bucket, and either cache can otherwise keep/re-add
 * the supposedly hidden platform after the command runs.
 */
export function purgePlatformChat<T extends PlatformTaggedMessage>(
  stores: PlatformChatStores<T>,
  platform: Platform,
): PurgedPlatformChatStores<T> {
  const keep = (message: T) => message.platform !== platform;
  return {
    backing: stores.backing.filter(keep),
    pending: stores.pending.filter(keep),
    presented: stores.presented.filter(keep),
  };
}
