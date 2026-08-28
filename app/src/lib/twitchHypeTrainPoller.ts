import { fetchTwitchHypeTrain, type TwitchHypeTrainState } from './twitchHypeTrainClient';
import {
  runtimeEventFeatureVisible,
  subscribeRuntimeEventVisibility,
} from './multichatEventRuntime';

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

  function emit(state: TwitchHypeTrainState): void {
    const serialized = JSON.stringify(state);
    if (serialized === lastSerialized) return;
    lastSerialized = serialized;
    try { opts.onState(state); } catch { /* consumer fault */ }
  }

  function clearTimer(): void {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
  }

  function schedule(ms: number): void {
    if (!stopped && runtimeEventFeatureVisible('hypetrain')) {
      timer = setTimeout(poll, ms);
    }
  }

  async function poll(): Promise<void> {
    timer = null;
    if (stopped) return;
    if (!runtimeEventFeatureVisible('hypetrain')) {
      emit({ active: false });
      return;
    }

    const ownedController = new AbortController();
    controller = ownedController;
    try {
      const state = await fetchTwitchHypeTrain(opts.login, ownedController.signal);
      if (stopped || ownedController.signal.aborted) return;
      if (!runtimeEventFeatureVisible('hypetrain')) {
        emit({ active: false });
        return;
      }
      emit(state);
      schedule(state.active ? HYPE_TRAIN_ACTIVE_INTERVAL_MS : HYPE_TRAIN_INACTIVE_INTERVAL_MS);
    } catch {
      if (stopped || ownedController.signal.aborted) return;
      if (!runtimeEventFeatureVisible('hypetrain')) {
        emit({ active: false });
        return;
      }
      try { opts.onError?.(); } catch { /* consumer fault */ }
      schedule(lastSerialized.includes('"active":true')
        ? HYPE_TRAIN_ACTIVE_INTERVAL_MS
        : HYPE_TRAIN_INACTIVE_INTERVAL_MS);
    } finally {
      if (controller === ownedController) controller = null;
    }
  }

  const unsubscribe = subscribeRuntimeEventVisibility((target) => {
    if (target !== 'all' && target !== 'hypetrain') return;
    if (!runtimeEventFeatureVisible('hypetrain')) {
      clearTimer();
      controller?.abort();
      controller = null;
      emit({ active: false });
      return;
    }
    clearTimer();
    controller?.abort();
    controller = null;
    void poll();
  });

  void poll();
  return () => {
    stopped = true;
    unsubscribe();
    clearTimer();
    controller?.abort();
    controller = null;
  };
}
