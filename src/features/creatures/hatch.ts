import { between, pick, seededRandom } from '../../lib/random';
import {
  ACCESSORIES,
  BODIES,
  EXTRAS,
  EYES,
  PATTERNS,
  type CreatureAccessory,
  type CreatureExtra,
  type CreaturePattern,
  type CreatureTraits,
  type Palette,
  type Rarity,
} from './creatureSchemas';

/** Rarity is app logic, not the model's call: 70 / 25 / 5. */
export function rollRarity(seed: number): Rarity {
  const r = seededRandom(seed ^ 0x9e3779b9)();
  return r < 0.05 ? 'rare' : r < 0.3 ? 'uncommon' : 'common';
}

const PREFIXES = ['Moss', 'Peb', 'Twig', 'Sprig', 'Puff', 'Dew', 'Fern', 'Bark', 'Burr', 'Clov', 'Lich', 'Pip'];
const SUFFIXES = ['bit', 'bi', 'let', 'kin', 'bo', 'li', 'ble', 'sy', 'nook', 'pom'];
const HABITATS = ['Sidewalk', 'Garden', 'Fence', 'Puddle', 'Bark', 'Crack', 'Leaf', 'Stone', 'Hedge'];
const KINDS = ['Creature', 'Sprite', 'Critter', 'Nibbler', 'Snoozer'];
const LINES = [
  'Shows up wherever nobody remembered to tell the weeds they were not invited.',
  'Collects warm rocks and takes it personally when someone calls them gravel.',
  'Naps in the exact spot you were about to step. Somehow always forgives you.',
  'Believes every puddle is a tiny ocean and refuses to be told otherwise.',
  'Hums quietly to moss. The moss seems into it.',
  'Has strong opinions about which leaf is the good leaf.',
];

const ACCESSORY_HINTS: [RegExp, CreatureAccessory][] = [
  [/mushroom|fung/i, 'mushroom'],
  [/flower|petal|bloom|blossom/i, 'flower'],
  [/twig|branch|stick|bark/i, 'twig'],
  [/stone|rock|pebble|gravel|concrete|brick/i, 'stone'],
  [/leaf|leaves|fern|moss|grass|plant/i, 'leaf'],
];

/**
 * Deterministic stand-in for when Gemma passes the photo but its creature JSON is unusable,
 * or when there's no model at all. Leans on observations so it still fits the scene.
 */
export function localCreature(seed: number, observations: string[]): CreatureTraits {
  const rand = seededRandom(seed);
  const seen = observations.join(' ');
  const accessory = ACCESSORY_HINTS.find(([re]) => re.test(seen))?.[1] ?? pick(rand, ACCESSORIES);
  return {
    name: pick(rand, PREFIXES) + pick(rand, SUFFIXES),
    species: `${pick(rand, HABITATS)} ${pick(rand, KINDS)}`,
    description: pick(rand, LINES),
    body: pick(rand, BODIES),
    eyeStyle: pick(rand, EYES),
    accessory,
  };
}

/** Pattern and extra come from the seed, on their own stream so nothing else shifts. */
export function rollLook(seed: number): { pattern: CreaturePattern; extra: CreatureExtra } {
  const rand = seededRandom(seed ^ 0x3c6ef372);
  return { pattern: pick(rand, PATTERNS), extra: pick(rand, EXTRAS) };
}

type ShapeTraits = Pick<CreatureTraits, 'body' | 'eyeStyle' | 'accessory'>;

/**
 * Gemma has favorite picks. If its body / eyes / accessory exactly repeat a recent creature,
 * swap the body (the most visible trait) for a different one.
 */
export function avoidRepeat<T extends ShapeTraits>(traits: T, recent: ShapeTraits[], seed: number): T {
  const repeats = recent.some(
    (r) => r.body === traits.body && r.eyeStyle === traits.eyeStyle && r.accessory === traits.accessory,
  );
  if (!repeats) return traits;
  const rand = seededRandom(seed ^ 0x2545f491);
  return { ...traits, body: pick(rand, BODIES.filter((b) => b !== traits.body)) };
}

// --- palette ---------------------------------------------------------------------

type Rgb = [number, number, number];

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

const hsl = (h: number, s: number, l: number) =>
  `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Turns photo pixels (RGBA, any size) into a creature palette. Buckets colors, ranks by
 * how common and how colorful they are, then nudges lightness and saturation so the
 * creature stays cute and readable on a dark background. Pure, so it's testable.
 */
export function paletteFromPixels(data: Uint8ClampedArray, seed: number): Palette {
  const buckets = new Map<number, { rgb: Rgb; count: number }>();
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    const b = buckets.get(key);
    if (b) {
      b.rgb[0] += data[i];
      b.rgb[1] += data[i + 1];
      b.rgb[2] += data[i + 2];
      b.count++;
    } else {
      buckets.set(key, { rgb: [data[i], data[i + 1], data[i + 2]], count: 1 });
    }
  }

  const colors = [...buckets.values()]
    .map(({ rgb, count }) => {
      const [h, s, l] = rgbToHsl([rgb[0] / count, rgb[1] / count, rgb[2] / count]);
      // Colorful mid-tones beat gray concrete and blown-out sky.
      const weight = count * (0.25 + s) * (1 - Math.abs(l - 0.5));
      return { h, s, l, weight };
    })
    .sort((a, b) => b.weight - a.weight);

  const rand = seededRandom(seed);
  const main = colors[0] ?? { h: between(rand, 80, 140), s: 0.5, l: 0.5 };
  // Accent: the strongest color at least 50 degrees of hue away from the main one.
  const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
  const accent = colors.find((c) => c.s > 0.2 && hueGap(c.h, main.h) > 50) ?? {
    h: (main.h + 150 + between(rand, -20, 20)) % 360,
    s: 0.6,
    l: 0.6,
  };

  // A seeded nudge so two photos of the same green lawn don't hatch the same green creature.
  const shift = seededRandom(seed ^ 0x7a1e5d0b);
  const hue = (main.h + between(shift, -25, 25) + 360) % 360;
  const primaryS = clamp(main.s * 1.2, 0.3, 0.7);
  return {
    primary: hsl(hue, primaryS, clamp(main.l + between(shift, -0.08, 0.08), 0.48, 0.72)),
    secondary: hsl(hue, clamp(primaryS * 0.7, 0.2, 0.55), between(shift, 0.78, 0.9)),
    accent: hsl(accent.h, clamp(accent.s * 1.2, 0.45, 0.8), clamp(accent.l, 0.55, 0.7)),
  };
}

/** Reads a small thumbnail of the photo and builds a palette from it. */
export async function paletteFromPhoto(photo: Blob, seed: number): Promise<Palette> {
  const bitmap = await createImageBitmap(photo, { resizeWidth: 48, resizeHeight: 48, resizeQuality: 'low' });
  const canvas = new OffscreenCanvas(48, 48);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available.');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return paletteFromPixels(ctx.getImageData(0, 0, 48, 48).data, seed);
}
