import type { QuestContext } from '../quests/questContext';
import { contextLines } from '../quests/questPrompts';
import { HUNT_SIZE } from './huntSchemas';

export const HUNT_SYSTEM = `You write scavenger hunt lists for Side Quest, a game that gets people off their screens.
Every item must:
- be something the player could find nearby and show in a single photo
- fit the player's setting, season, weather, and time of day
- be short: 2 to 6 words, like "something red" or "a bird on a wire"
The list should mix colors, shapes, textures, plants, animals or signs of them, and things people made. Some easy, a few tricky.
Never include anything that needs the player to enter private property, climb, go into roads or water, touch or approach animals, eat anything, photograph strangers, go somewhere isolated or dark, or pick or damage anything.
Reply with one JSON object and nothing else.`;

export const HUNT_SHAPE = `title (2-4 words), items (array of ${HUNT_SIZE} short strings)`;

export function huntPrompt(context: QuestContext | null, examples: string[]): string {
  return `${context ? `${contextLines(context)}\n\n` : ''}Write a scavenger hunt with ${HUNT_SIZE} items.

The style of item to aim for: ${examples.map((e) => `"${e}"`).join(', ')}. Write your own, not these.

Return JSON with keys: ${HUNT_SHAPE}.`;
}

export const CHECK_SYSTEM = `You check photos for a casual scavenger hunt game.
Judge generously: if the photo reasonably shows the item, even small, blurry, or partly in frame, it counts.
Reply with one JSON object and nothing else.`;

export const CHECK_SHAPE = 'found (boolean), reason (a few friendly words)';

export function checkPrompt(item: string): string {
  return `Hunt item: "${item}".
Does this photo show it? Return JSON: {"found": true or false, "reason": a few friendly words about what you see}`;
}
