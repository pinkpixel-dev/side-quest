import type { QuestContext } from '../quests/questContext';

interface LibraryItem {
  text: string;
  /** Leave out to fit every setting. */
  settings?: QuestContext['setting'][];
  noWinter?: boolean;
  /** Leave out when it works both day and night. */
  when?: 'day' | 'night';
  weather?: QuestContext['weather'][];
}

const NOT_SANDY: QuestContext['setting'][] = ['city', 'suburb', 'park', 'countryside'];
const GREEN: QuestContext['setting'][] = ['suburb', 'park', 'countryside'];
const BUILT: QuestContext['setting'][] = ['city', 'suburb', 'park'];

/**
 * Hand-written hunt items. Used when Gemma isn't ready, to top up a short Gemma list, and
 * on the phone when home base hasn't written one. Every context has at least ten that fit.
 */
export const HUNT_ITEMS: LibraryItem[] = [
  // Works almost anywhere, any time.
  { text: 'something red' },
  { text: 'something perfectly round' },
  { text: 'a number' },
  { text: 'a reflection' },
  { text: 'something older than you' },
  { text: 'something that looks like a face' },
  { text: 'a shadow with a cool shape' },
  { text: 'something soft' },
  { text: 'something rough or bumpy' },
  { text: 'two things that match' },
  { text: 'a straight line made by nature', when: 'day' },
  { text: 'a star shape' },
  { text: 'something broken but still useful' },
  { text: 'an arrow' },
  { text: 'the letter S' },
  { text: 'something striped' },
  { text: 'something tiny' },

  // Daylight.
  { text: 'something yellow', when: 'day' },
  { text: 'something blue that is not the sky', when: 'day' },
  { text: 'a cloud with a shape', when: 'day' },
  { text: 'a bird', when: 'day' },
  { text: 'a feather', when: 'day' },
  { text: 'a sign that an animal was here', when: 'day' },
  { text: 'something purple', when: 'day' },
  { text: 'a rock with a pattern', when: 'day' },
  { text: 'your own shadow', when: 'day', weather: ['sunny', 'hot', 'windy', 'snowy'] },

  // Green places.
  { text: 'a leaf bigger than your hand', settings: NOT_SANDY, noWinter: true, when: 'day' },
  { text: 'a flower', settings: NOT_SANDY, noWinter: true },
  { text: 'moss', settings: NOT_SANDY, when: 'day' },
  { text: 'tree bark up close', settings: NOT_SANDY },
  { text: 'a pinecone, acorn, or seed pod', settings: GREEN, when: 'day' },
  { text: 'a mushroom', settings: GREEN, noWinter: true, when: 'day' },
  { text: 'a squirrel or signs of one', settings: [...GREEN, 'city'], noWinter: true, when: 'day' },
  { text: 'a bug or a spider web', settings: NOT_SANDY, noWinter: true },
  { text: 'a fence post', settings: GREEN, when: 'day' },
  { text: 'a heart shape in nature', settings: NOT_SANDY, when: 'day' },
  { text: 'grass taller than your ankle', settings: GREEN, noWinter: true, when: 'day' },

  // Built places.
  { text: 'a door with character', settings: BUILT },
  { text: 'a plant growing out of a crack', settings: BUILT, noWinter: true, when: 'day' },
  { text: 'a bench', settings: BUILT },
  { text: 'a mailbox', settings: ['city', 'suburb'] },
  { text: 'a bike', settings: ['city', 'suburb', 'park'] },
  { text: 'a funny sign', settings: ['city', 'suburb'] },
  { text: 'a pigeon or a sparrow', settings: ['city', 'suburb', 'park'], when: 'day' },
  { text: 'a lamppost', settings: BUILT },
  { text: 'a mural or graffiti', settings: ['city'] },
  { text: 'a window box or potted plant', settings: ['city', 'suburb'], noWinter: true },

  // Sand underfoot.
  { text: 'footprints in sand or dirt', settings: ['beach', 'desert', 'countryside'], when: 'day' },
  { text: 'a wavy pattern in sand', settings: ['beach', 'desert'], when: 'day' },

  // Beach.
  { text: 'a shell', settings: ['beach'], when: 'day' },
  { text: 'a gull or shorebird', settings: ['beach'], when: 'day' },
  { text: 'a smooth stone', settings: ['beach', 'countryside', 'park'] },
  { text: 'driftwood', settings: ['beach'], when: 'day' },
  { text: 'seaweed on the sand', settings: ['beach'], when: 'day' },
  { text: 'a crab or a crab hole', settings: ['beach'], noWinter: true, when: 'day' },
  { text: 'a boat', settings: ['beach'] },
  { text: 'a beach umbrella or towel', settings: ['beach'], noWinter: true, when: 'day' },
  { text: 'a dune plant', settings: ['beach'], when: 'day' },

  // Desert.
  { text: 'a cactus', settings: ['desert'] },
  { text: 'a lizard or its tracks', settings: ['desert'], noWinter: true, when: 'day' },
  { text: 'cracked dry ground', settings: ['desert'], when: 'day' },
  { text: 'a dry shrub or tumbleweed', settings: ['desert'] },
  { text: 'a sun-bleached stick or bone', settings: ['desert'], when: 'day' },
  { text: 'a red or orange rock', settings: ['desert'], when: 'day' },
  { text: 'a hawk or raven', settings: ['desert'], when: 'day' },

  // Countryside.
  { text: 'a farm animal seen from the path', settings: ['countryside'], when: 'day' },
  { text: 'a wildflower', settings: ['countryside', 'park'], noWinter: true, when: 'day' },
  { text: 'a gate', settings: ['countryside', 'suburb'] },
  { text: 'a hay bale or a field row', settings: ['countryside'], when: 'day' },

  // Weather.
  { text: 'a puddle with a reflection', weather: ['rainy', 'cloudy'] },
  { text: 'raindrops on something', weather: ['rainy'] },
  { text: 'a snail or worm', weather: ['rainy'], noWinter: true },
  { text: 'snow on something small', weather: ['snowy'] },
  { text: 'animal tracks in snow', weather: ['snowy'], when: 'day' },
  { text: 'an icicle or frost', weather: ['snowy'] },
  { text: 'something moving in the wind', weather: ['windy'] },
  { text: 'a shady spot', weather: ['hot', 'sunny'], when: 'day' },

  // Night, from a well-lit spot.
  { text: 'the moon', when: 'night' },
  { text: 'a colored light', when: 'night' },
  { text: 'a lit-up window', when: 'night' },
  { text: 'a long shadow from a streetlight', when: 'night' },
  { text: 'a glowing sign', settings: ['city', 'suburb'], when: 'night' },
  { text: 'bugs around a light', when: 'night', noWinter: true },
  { text: 'a reflection of a light', when: 'night' },
  { text: 'a plant lit up by a lamp', when: 'night' },
];

export const HUNT_TITLES = [
  'Pocket Safari',
  'Ten Little Things',
  'Neighborhood Sweep',
  'Eyes Open',
  'The Big Notice',
  'Field Notes',
  'Out and About',
  'Look Closer',
];

export function fitsContext(item: LibraryItem, context: QuestContext | null): boolean {
  if (!context) return item.when !== 'night';
  const night = context.time === 'night';
  return (
    (!item.settings || item.settings.includes(context.setting)) &&
    !(item.noWinter && context.season === 'winter') &&
    (item.when === undefined || (item.when === 'night') === night) &&
    (!item.weather || item.weather.includes(context.weather))
  );
}

/** Every library item that suits where and when the player is. */
export const libraryItemsFor = (context: QuestContext | null): string[] =>
  HUNT_ITEMS.filter((i) => fitsContext(i, context)).map((i) => i.text);
