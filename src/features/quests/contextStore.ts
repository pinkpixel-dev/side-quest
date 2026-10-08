import { getSetting, setSetting } from '../../lib/db/database';
import { timeOfDay, type QuestContext, type QuestSetting, type Season, type TimeOfDay, type Weather } from './questContext';

/** Weather (and a manual time pick) go stale after a few hours, so the form asks again next outing. */
export const CONTEXT_FRESH_MS = 4 * 60 * 60 * 1000;

interface SavedContext {
  setting: QuestSetting;
  season: Season;
  weather: Weather;
  /** Only set when the player picked a time other than the clock's. */
  timeOverride?: TimeOfDay;
  savedAt: number;
}

export interface LoadedContext {
  /** Ready to use, or null when the form should be shown first. */
  context: QuestContext | null;
  /** Prefill for the form, including stale answers. */
  draft: Partial<QuestContext>;
}

export async function loadContext(now = Date.now()): Promise<LoadedContext> {
  const saved = await getSetting<SavedContext>('questContext');
  const fresh = !!saved && now - saved.savedAt < CONTEXT_FRESH_MS;
  const time = (fresh && saved.timeOverride) || timeOfDay(new Date(now));
  if (!saved) return { context: null, draft: { time } };
  const draft = { setting: saved.setting, season: saved.season, time, ...(fresh ? { weather: saved.weather } : {}) };
  return { context: fresh ? { ...draft, weather: saved.weather } : null, draft };
}

export async function saveContext(context: QuestContext, now = Date.now()): Promise<void> {
  const auto = timeOfDay(new Date(now));
  await setSetting('questContext', {
    setting: context.setting,
    season: context.season,
    weather: context.weather,
    timeOverride: context.time === auto ? undefined : context.time,
    savedAt: now,
  } satisfies SavedContext);
}
