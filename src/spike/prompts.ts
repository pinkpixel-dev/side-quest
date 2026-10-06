export interface SpikeQuest {
  title: string;
  description: string;
  validationHint: string;
}

export const SPIKE_QUESTS: SpikeQuest[] = [
  {
    title: 'Nature Wins',
    description: 'Find somewhere a plant is growing through, around, or on something humans built.',
    validationHint: 'Look for visible plant growth interacting with a clearly human-made object or surface.',
  },
  {
    title: 'Tiny Things',
    description: 'Find something tiny that most people would walk past.',
    validationHint: 'A small natural or found object shown up close, filling much of the frame.',
  },
  {
    title: 'Leaf Lineup',
    description: 'Find three completely different leaf shapes.',
    validationHint: 'At least two or three leaves with clearly different outlines are visible.',
  },
];

export const RARITIES = ['common', 'uncommon', 'rare'] as const;

export const SYSTEM_PROMPT = `You are the judge and creature maker for Side Quest, a casual outdoor exploration game.
Judge generously: the question is whether the photo reasonably matches the spirit of the quest, not whether it proves anything. When unsure, lean toward passing.
Reply with a single JSON object and nothing else.`;

/** One call does validation, observations and creature traits, so the image is encoded once. */
export function questPrompt(quest: SpikeQuest, rarity: (typeof RARITIES)[number]): string {
  return `Quest: "${quest.title}". ${quest.description}
What counts: ${quest.validationHint}

Look at the photo, then return JSON with exactly these keys:
{
  "passed": boolean,
  "confidence": "low" | "medium" | "high",
  "reason": one short friendly sentence about what you see,
  "observations": 2 to 4 short noun phrases describing the scene,
  "creature": null if not passed, otherwise {
    "name": short playful one-word name, not a generic fantasy name,
    "species": two or three words, like "Concrete Garden Creature",
    "description": one or two funny sentences about where it lives or what it likes,
    "body": "blob" | "round" | "sprout" | "pebble" | "fuzzy" | "droplet",
    "eyeStyle": "dot" | "wide" | "sleepy" | "sparkle",
    "accessory": "leaf" | "flower" | "twig" | "mushroom" | "stone" | "none"
  }
}
The creature is ${rarity}. Base it on what is actually in the photo.`;
}
