export type TwitchHypeTrainState =
  | { active: false }
  | { active: true; level: number; progression: number; goal: number };

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function parseTwitchHypeTrainState(value: unknown): TwitchHypeTrainState | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const state = value as Record<string, unknown>;
  if (state.active === false) return { active: false };
  if (
    state.active !== true || !finite(state.level) || !finite(state.progression) || !finite(state.goal) ||
    state.level < 1 || state.progression < 0 || state.goal <= 0
  ) return null;
  return { active: true, level: state.level, progression: state.progression, goal: state.goal };
}

export async function fetchTwitchHypeTrain(
  login: string,
  signal?: AbortSignal,
): Promise<TwitchHypeTrainState> {
  const response = await fetch(`/api/twitch/hype-train?channel=${encodeURIComponent(login)}`, { signal });
  if (!response.ok) throw new Error('Twitch Hype Train lookup failed.');
  const parsed = parseTwitchHypeTrainState(await response.json());
  if (!parsed) throw new Error('Twitch Hype Train lookup failed.');
  return parsed;
}
