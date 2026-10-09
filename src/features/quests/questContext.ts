// Pure: the home server imports this at runtime, so no browser-only imports here.

export const SETTINGS = ['city', 'suburb', 'park', 'countryside', 'beach', 'desert'] as const;
export const WEATHERS = ['sunny', 'cloudy', 'rainy', 'snowy', 'windy', 'hot'] as const;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export const TIMES = ['morning', 'afternoon', 'evening', 'night'] as const;

export type QuestSetting = (typeof SETTINGS)[number];
export type Weather = (typeof WEATHERS)[number];
export type Season = (typeof SEASONS)[number];
export type TimeOfDay = (typeof TIMES)[number];

/** Longest place name the form accepts. Plenty for "Buenos Aires, Argentina". */
export const PLACE_MAX = 60;

/** Where and when the player is. The place is whatever they typed, as vague as they like. */
export interface QuestContext {
  setting: QuestSetting;
  weather: Weather;
  season: Season;
  time: TimeOfDay;
  /** Optional, e.g. "Hawaii" or "London". Steers Gemma toward things that live there. */
  place?: string;
}

/** Trims a typed place to one short line. Empty means no place. */
export function cleanPlace(place: string | undefined): string | undefined {
  const clean = place?.replace(/[\s"]+/g, ' ').trim().slice(0, PLACE_MAX);
  return clean || undefined;
}

export const SETTING_LABELS: Record<QuestSetting, string> = {
  city: 'City',
  suburb: 'Suburb',
  park: 'Park',
  countryside: 'Countryside',
  beach: 'Beach',
  desert: 'Desert',
};

export function timeOfDay(date = new Date()): TimeOfDay {
  const h = date.getHours();
  return h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'afternoon' : h >= 17 && h < 21 ? 'evening' : 'night';
}

/** Same key, same kind of quest. The home base drops pre-written quests when it changes. */
export const contextKey = (c: QuestContext) =>
  `${c.setting}/${c.weather}/${c.season}/${c.time}/${cleanPlace(c.place)?.toLowerCase() ?? ''}`;

/** Loose check for context that arrived over the network. */
export function isQuestContext(value: unknown): value is QuestContext {
  const c = value as QuestContext | null;
  return (
    !!c &&
    (SETTINGS as readonly string[]).includes(c.setting) &&
    (WEATHERS as readonly string[]).includes(c.weather) &&
    (SEASONS as readonly string[]).includes(c.season) &&
    (TIMES as readonly string[]).includes(c.time) &&
    (c.place === undefined || (typeof c.place === 'string' && c.place.length <= PLACE_MAX))
  );
}
