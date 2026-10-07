import type { Quest } from '../quests/questSchemas';
import type { Rarity } from '../creatures/creatureSchemas';

export const JUDGE_SYSTEM = `You are the judge and creature maker for Side Quest, a casual outdoor exploration game.
Judge generously: ask whether the photo reasonably matches the spirit of the quest, not whether it proves anything. When unsure, lean toward passing. A blurry or partial match still counts.
Reply with one JSON object and nothing else.`;

export const JUDGE_SHAPE =
  'passed (boolean), confidence ("low"|"medium"|"high"), reason (one sentence), observations (2-4 short phrases), creature (null or {name, species, description, body, eyeStyle, accessory})';

/** One call covers validation, observations and the creature, so the image is encoded once. */
export function judgePrompt(quest: Pick<Quest, 'title' | 'description' | 'validationHint'>, rarity: Rarity): string {
  return `Quest: "${quest.title}". ${quest.description}
What counts: ${quest.validationHint}

Look at the photo, then return JSON with exactly these keys:
{
  "passed": true or false,
  "confidence": "low" | "medium" | "high",
  "reason": one short, friendly sentence about what you see,
  "observations": 2 to 4 short phrases describing the scene,
  "creature": null if not passed, otherwise {
    "name": one short playful made-up word, not a common fantasy name,
    "species": two or three words, like "Concrete Garden Creature",
    "description": one or two funny sentences about where it lives or what it likes,
    "body": "blob" | "round" | "sprout" | "pebble" | "fuzzy" | "droplet",
    "eyeStyle": "dot" | "wide" | "sleepy" | "sparkle",
    "accessory": "leaf" | "flower" | "twig" | "mushroom" | "stone" | "none"
  }
}
The creature is ${rarity}. Base it on what is really in the photo.`;
}
