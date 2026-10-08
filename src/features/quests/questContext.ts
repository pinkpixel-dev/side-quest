// Pure: the home server imports this at runtime, so no browser-only imports here.

export const SETTINGS = ['city', 'suburb', 'park', 'countryside', 'open'] as const;
export const WEATHERS = ['sunny', 'cloudy', 'rainy', 'snowy', 'windy', 'hot'] as const;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export const TIMES = ['morning', 'afternoon', 'evening', 'night'] as const;

export type QuestSetting = (typeof SETTINGS)[number];
export type Weather = (typeof WEATHERS)[number];
export type Season = (typeof SEASONS)[number];
export type TimeOfDay = (typeof TIMES)[number];

/** Where and when the player is. Nothing more precise than this ever gets asked or stored. */
export interface QuestContext {
  setting: QuestSetting;
  weather: Weather;
  season: Season;
  time: TimeOfDay;
}

export const SETTING_LABELS: Record<QuestSetting, string> = {
  city: 'City',
  suburb: 'Suburb',
  park: 'Park',
  countryside: 'Countryside',
  open: 'Beach / desert',
};

export function timeOfDay(date = new Date()): TimeOfDay {
  const h = date.getHours();
  return h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'afternoon' : h >= 17 && h < 21 ? 'evening' : 'night';
}

/** Same key, same kind of quest. The home base drops pre-written quests when it changes. */
export const contextKey = (c: QuestContext) => `${c.setting}/${c.weather}/${c.season}/${c.time}`;

/** Loose check for context that arrived over the network. */
export function isQuestContext(value: unknown): value is QuestContext {
  const c = value as QuestContext | null;
  return (
    !!c &&
    (SETTINGS as readonly string[]).includes(c.setting) &&
    (WEATHERS as readonly string[]).includes(c.weather) &&
    (SEASONS as readonly string[]).includes(c.season) &&
    (TIMES as readonly string[]).includes(c.time)
  );
}
