/** mulberry32: tiny seeded PRNG. Same seed, same sequence, which is what makes creatures repeatable. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)];
}

/** Random value in [min, max). */
export function between(rand: () => number, min: number, max: number): number {
  return min + rand() * (max - min);
}

/** First 32 bits of SHA-256 of the bytes: the same photo always hatches the same creature. */
export async function seedFromBlob(blob: Blob): Promise<number> {
  const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return new DataView(hash).getUint32(0);
}

export function newId(): string {
  return crypto.randomUUID();
}
