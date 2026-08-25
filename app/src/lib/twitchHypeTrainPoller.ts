import { fetchTwitchHypeTrain, type TwitchHypeTrainState } from './twitchHypeTrainClient';

export const HYPE_TRAIN_INACTIVE_INTERVAL_MS = 60_000;
export const HYPE_TRAIN_ACTIVE_INTERVAL_MS = 15_000;

export function startTwitchHypeTrainPoller(opts: {
  login: string;
  onState(state: TwitchHypeTrainState): void;
  onError?(): void;
}): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let controller: AbortController | null = null;
  let lastSerialized = '';

  function schedule(ms: number): void {
    if (!stopped) timer = setTimeout(poll, ms);
  }

  async function poll(): Promise<void> {
    timer = null;
    if (stopped) return;
    controller = new AbortController();
    try {
      const state = await fetchTwitchHypeTrain(opts.login, controller.signal);
      if (stopped) return;
      const serialized = JSON.stringify(state);
      if (serialized !== lastSerialized) {
        lastSerialized = serialized;
        try { opts.onState(state); } catch { /* consumer fault */ }
      }
      schedule(state.active ? HYPE_TRAIN_ACTIVE_INTERVAL_MS : HYPE_TRAIN_INACTIVE_INTERVAL_MS);
    } catch {
      if (stopped) return;
      try { opts.onError?.(); } catch { /* consumer fault */ }
      schedule(lastSerialized.includes('"active":true')
        ? HYPE_TRAIN_ACTIVE_INTERVAL_MS
        : HYPE_TRAIN_INACTIVE_INTERVAL_MS);
    } finally {
      controller = null;
    }
  }

  void poll();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    controller?.abort();
  };
}
