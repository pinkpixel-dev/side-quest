import { FALLBACK_QUESTS } from './fallbackQuests';
import { cleanPlace, type QuestContext } from './questContext';
import type { QuestCategory, QuestDraft } from './questSchemas';

export const QUEST_SYSTEM = `You write tiny outdoor quests for Side Quest, a game that gets people off their screens.
Every quest must:
- fit the player's setting, season, weather, and time of day
- need no special equipment and take 5 to 30 minutes
- reward noticing things up close, not traveling far
- be checkable from a single photo
- be about a real, physical thing the player can point at, in plain everyday words
- feel playful, not educational or clinical
No poetry, moods, or abstract ideas: not "the essence of autumn" or "a whisper of light", but "a leaf bigger than your hand" or "a bird on a wire".
Never ask the player to: enter private property, climb anything, go into roads or traffic, enter water, touch or approach animals, touch unknown plants, eat or taste anything, approach or photograph strangers, go somewhere isolated or poorly lit, enter abandoned buildings, or pick, collect, or damage anything.
Reply with one JSON object and nothing else.`;

export const QUEST_SHAPE =
  'title (2-4 words), description (one sentence), category, difficulty ("easy" or "medium"), estimatedMinutes (5-30), validationHint (what the photo should show)';

/** Small concrete starting points. Small models get far more inventive with one to build on. */
export const QUEST_FOCUSES = [
  'something round',
  'something with stripes or spots',
  'a plant that grows here',
  'a rock or stone',
  'something red, yellow, or blue',
  'something tiny',
  'something really old',
  'a sign, label, or number',
  'something that looks like a face',
  'something the weather left behind',
  'a shadow',
  'a reflection',
  'something soft',
  'something rough or bumpy',
  'two things that match',
  'something a lot of people walk past without noticing',
  'something that only shows up this time of year',
  'something typical of this place',
  'a sign that an animal passed by',
  'something people made that nature is taking back',
] as const;

interface AnimalIdea {
  idea: string;
  /** Leave out to fit every setting. */
  settings?: QuestContext['setting'][];
  /** Bugs and squirrels mostly vanish in winter. */
  noWinter?: boolean;
  /** Only ideas that still work in a lit spot after dark. */
  night?: boolean;
  weather?: QuestContext['weather'][];
}

/** Wildlife quests get one of these instead of a general focus, so the animal suits where the player is. */
const ANIMAL_IDEAS: AnimalIdea[] = [
  { idea: 'a bird doing something with personality' },
  { idea: 'a bird perched somewhere unexpected' },
  { idea: 'a bird in flight or about to take off' },
  { idea: 'a sign that birds live nearby, like a nest, feathers, or droppings' },
  { idea: 'pigeons or sparrows going about their day', settings: ['city', 'suburb', 'park'] },
  { idea: 'a squirrel or chipmunk busy with something', settings: ['suburb', 'park', 'countryside', 'city'], noWinter: true },
  { idea: 'gulls or shorebirds', settings: ['beach'] },
  { idea: 'a crab or the little holes crabs dig in the sand', settings: ['beach'], noWinter: true },
  { idea: 'a lizard or beetle sunning itself', settings: ['desert', 'countryside', 'park'], noWinter: true },
  { idea: 'a hawk, raven, or other bird over open ground', settings: ['desert', 'countryside'] },
  { idea: 'tracks or trails left in the sand', settings: ['beach', 'desert'] },
  { idea: 'a bee, butterfly, or other insect visiting a flower', noWinter: true },
  { idea: 'ants or another tiny creature at work', noWinter: true },
  { idea: 'a spider web and whoever built it' },
  { idea: 'a snail, slug, or worm out after the rain', weather: ['rainy', 'cloudy'], noWinter: true },
  { idea: 'animal tracks pressed into snow, mud, or sand', weather: ['snowy', 'rainy'] },
  { idea: 'cows, horses, sheep, or other farm animals seen from the path', settings: ['countryside'] },
  { idea: 'moths or bugs drawn to a porch light', night: true, noWinter: true },
  { idea: 'a spider web lit up by a lamp', night: true },
];

/** An animal idea that suits the player's setting, season, weather, and time. Birds fit everywhere, so there's always one. */
export function animalIdea(context: QuestContext | null, pick = Math.random): string {
  const fits = ANIMAL_IDEAS.filter(
    (a) =>
      !context ||
      ((!a.settings || a.settings.includes(context.setting)) &&
        !(a.noWinter && context.season === 'winter') &&
        !!a.night === (context.time === 'night') &&
        (!a.weather || a.weather.includes(context.weather))),
  );
  // Nothing fits at night in winter, so fall back to webs and lights, which mostly still work.
  const pool = fits.length ? fits : ANIMAL_IDEAS.filter((a) => a.night);
  return pool[Math.floor(pick() * pool.length)].idea;
}

/** Animals move and might not turn up, so wildlife quests always accept a clear sign of one. */
const WILDLIFE_NOTE =
  'Animals move and might not show up, so the quest must accept the animal or a clear sign of it, photographed from a distance. Never ask the player to follow, feed, or get close to it.';

const SETTING_NOTES: Record<QuestContext['setting'], string> = {
  city: 'a city: streets, buildings, sidewalks, and small patches of green. Do not depend on forests, logs, or wild plants',
  suburb: 'a suburb: yards, sidewalks, gardens, and street trees',
  park: 'a park: lawns, trees, paths, and benches',
  countryside: 'the countryside: fields, hedges, trees, and dirt paths',
  beach: 'a beach: sand, shells, seaweed, rocks, driftwood, and shorebirds. Do not depend on trees or leaves',
  desert: 'a desert: sand, rocks, cacti, dry shrubs, and lizards. Do not depend on water, trees, or leaves',
};

const WEATHER_NOTES: Partial<Record<QuestContext['weather'], string>> = {
  rainy: 'It is raining, so the quest should work from under cover or in a quick dash. Puddles, drips, and wet surfaces are fair game.',
  snowy: 'There is snow, so lean into snow, frost, ice, and tracks. Keep the player on cleared, safe ground.',
  hot: 'It is hot, so keep it short and in the shade if possible.',
  windy: 'It is windy, so things that move, sway, or got blown around are great.',
};

const TIME_NOTES: Partial<Record<QuestContext['time'], string>> = {
  evening: 'It is evening, so the light is low and changing.',
  night:
    'It is dark out. The quest must work in a well-lit spot close to home, like a porch, a lit sidewalk, a shop window, or the view from a window. Streetlights, lit windows, the moon, shop signs, and bugs around a lamp are good subjects.',
};

export function contextLines(context: QuestContext): string {
  const place = cleanPlace(context.place);
  return [
    `The player is in ${SETTING_NOTES[context.setting]}.`,
    place &&
      `They are in or near ${place}. Only pick plants, animals, and everyday sights that are actually common there.`,
    `It is ${context.season}, ${context.weather}, ${context.time === 'night' ? 'at night' : `in the ${context.time}`}.`,
    WEATHER_NOTES[context.weather],
    TIME_NOTES[context.time],
  ]
    .filter(Boolean)
    .join('\n');
}

export function questPrompt(
  category: QuestCategory,
  recent: Pick<QuestDraft, 'title' | 'description'>[],
  focus: string,
  context: QuestContext | null,
  exampleCount = 3,
): string {
  const examples = [...FALLBACK_QUESTS]
    .sort(() => Math.random() - 0.5)
    .slice(0, exampleCount)
    .map(({ title, description, category, difficulty, estimatedMinutes, validationHint }) =>
      JSON.stringify({ title, description, category, difficulty, estimatedMinutes, validationHint }),
    )
    .join('\n');
  const avoid = recent.length
    ? `\n\nRecently played. Write something clearly different in subject and action, not a reworded version:\n${recent
        .map((q) => `- ${q.title}: ${q.description}`)
        .join('\n')}`
    : '';
  return `${context ? `${contextLines(context)}\n\n` : ''}Write one new quest in the "${category}" category, built around this idea: ${focus}.${category === 'wildlife' ? `\n${WILDLIFE_NOTE}` : ''}${avoid}

Good examples of the style:
${examples}

Return JSON with keys: ${QUEST_SHAPE}.`;
}
