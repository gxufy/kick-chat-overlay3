
import type { SevenTVBadge, SevenTVPaint, Entitlements } from './kick';

const PAINT_FIELDS = 'id name function color angle shape image_url repeat stops { at color } shadows { x_offset y_offset radius color }';

export interface CosmeticsStores {
  paints: SevenTVPaint[];
  badges: SevenTVBadge[];
  entitlements: Entitlements;
}

export interface CosmeticsFetcher {
  /** queue a chatter for cosmetics lookup (no-op if already seen) */
  want(platform: 'kick' | 'twitch', senderId: string): void;
  stop(): void;
}

export function createCosmeticsFetcher(
  stores: CosmeticsStores,
  onApplied: (keys: string[]) => void,
): CosmeticsFetcher {
  const seen = new Set<string>();
  const queue: Array<{ platform: 'kick' | 'twitch'; senderId: string }> = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let activeController: AbortController | null = null;

  async function flush() {
    timer = null;
    if (stopped || !queue.length) return;
    const batch = queue.splice(0, 40);
    if (queue.length) schedule();

    // one aliased query per batch: u0: userByConnection(...) { ... }
    const parts = batch.map((b, i) =>
      `u${i}: userByConnection(platform: ${b.platform.toUpperCase()}, id: ${JSON.stringify(b.senderId)}) { style { paint { ${PAINT_FIELDS} } badge { id tooltip host { url } } } }`
    );
    let data: unknown;
    activeController = new AbortController();
    try {
      const response = await fetch('https://7tv.io/v3/gql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `query { ${parts.join(' ')} }` }),
        signal: activeController.signal,
      });
      if (!response.ok) throw new Error('request failed');
      const body: unknown = await response.json();
      data = typeof body === 'object' && body !== null && !Array.isArray(body)
        ? (body as Record<string, unknown>).data
        : null;
    } catch {
      for (const b of batch) seen.delete(`${b.platform}:${b.senderId}`);
      return;
    } finally {
      activeController = null;
    }
    if (stopped || typeof data !== 'object' || data === null || Array.isArray(data)) {
      for (const b of batch) seen.delete(`${b.platform}:${b.senderId}`);
      return;
    }
    const result = data as Record<string, unknown>;

    const applied: string[] = [];
    batch.forEach((b, i) => {
      const user = result[`u${i}`];
      const style = typeof user === 'object' && user !== null && !Array.isArray(user)
        ? (user as Record<string, unknown>).style
        : null;
      if (typeof style !== 'object' || style === null || Array.isArray(style)) {
        seen.delete(`${b.platform}:${b.senderId}`);
        return;
      }
      const value = style as Record<string, unknown>;
      const key = `${b.platform}:${b.senderId}`;
      const ent: { badge?: string; paint?: string } = { ...stores.entitlements[key] };

      const paint = value.paint;
      if (typeof paint === 'object' && paint !== null && !Array.isArray(paint)) {
        const p = paint as Record<string, unknown>;
        const validFunctions = new Set(['LINEAR_GRADIENT', 'RADIAL_GRADIENT', 'URL']);
        if (typeof p.id === 'string' && p.id && typeof p.function === 'string' && validFunctions.has(p.function)) {
          const mapped: SevenTVPaint = {
            id: p.id,
            func: p.function,
            angle: typeof p.angle === 'number' ? p.angle : 0,
            color: typeof p.color === 'number' ? p.color : 0,
            repeat: p.repeat === true,
            shadows: Array.isArray(p.shadows) ? p.shadows : [],
            stops: Array.isArray(p.stops) ? p.stops : [],
            image_url: typeof p.image_url === 'string' ? p.image_url : undefined,
            shape: typeof p.shape === 'string' ? p.shape : undefined,
          };
          stores.paints = [...stores.paints.filter((existing) => existing.id !== mapped.id), mapped];
          ent.paint = mapped.id;
        }
      }
      const badge = value.badge;
      if (typeof badge === 'object' && badge !== null && !Array.isArray(badge)) {
        const bValue = badge as Record<string, unknown>;
        const hostValue = bValue.host;
        const host = typeof hostValue === 'object' && hostValue !== null && !Array.isArray(hostValue)
          ? (hostValue as Record<string, unknown>).url
          : null;
        if (typeof bValue.id === 'string' && bValue.id && typeof host === 'string' && host.startsWith('//')) {
          const mapped: SevenTVBadge = { id: bValue.id, image: `https:${host}/3x` };
          stores.badges = [...stores.badges.filter((existing) => existing.id !== mapped.id), mapped];
          ent.badge = mapped.id;
        }
      }
      if (ent.paint || ent.badge) {
        stores.entitlements[key] = ent;
        applied.push(key);
      } else {
        seen.delete(key);
      }
    });
    if (applied.length) onApplied(applied);
  }

  function schedule() {
    if (!timer) timer = setTimeout(flush, 400);
  }

  return {
    want(platform, senderId) {
      if (stopped || !senderId) return;
      const key = `${platform}:${senderId}`;
      if (seen.has(key)) return;
      seen.add(key);
      queue.push({ platform, senderId });
      schedule();
    },
    stop() {
      stopped = true;
      queue.length = 0;
      if (timer) clearTimeout(timer);
      timer = null;
      activeController?.abort();
      activeController = null;
    },
  };
}
