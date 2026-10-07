import { FALLBACK_QUESTS } from './fallbackQuests';
import type { QuestCategory } from './questSchemas';

export const QUEST_SYSTEM = `You write tiny outdoor quests for Side Quest, a game that gets people off their screens.
Every quest must:
- work in an ordinary neighborhood, yard, park, or city street, in any season
- need no special equipment and take 5 to 30 minutes
- reward noticing things up close, not traveling far
- be checkable from a single photo
- feel playful, not educational or clinical
Never ask the player to: enter private property, climb anything, go into roads or traffic, enter water, touch or approach animals, touch unknown plants, eat or taste anything, approach or photograph strangers, go out at night or somewhere isolated, enter abandoned buildings, or pick, collect, or damage anything.
Reply with one JSON object and nothing else.`;

export const QUEST_SHAPE =
  'title (2-4 words), description (one sentence), category, difficulty ("easy" or "medium"), estimatedMinutes (5-30), validationHint (what the photo should show)';

export function questPrompt(category: QuestCategory, avoidTitles: string[], exampleCount = 3): string {
  const examples = [...FALLBACK_QUESTS]
    .sort(() => Math.random() - 0.5)
    .slice(0, exampleCount)
    .map((q) => JSON.stringify(q))
    .join('\n');
  const avoid = avoidTitles.length ? `\nDon't reuse these ideas: ${avoidTitles.join(', ')}.` : '';
  return `Write one new quest in the "${category}" category.${avoid}

Good examples of the style:
${examples}

Return JSON with keys: ${QUEST_SHAPE}.`;
}
