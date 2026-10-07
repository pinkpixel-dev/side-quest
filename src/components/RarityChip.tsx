import { Sparkle } from 'lucide-react';
import type { Rarity } from '../features/creatures/creatureSchemas';

const styles: Record<Rarity, string> = {
  common: 'border-bark/25 text-bark-2',
  uncommon: 'border-moss-ink/40 bg-moss/40 text-moss-ink',
  rare: 'border-blush-ink/30 bg-blush text-blush-ink',
};

/** Rarity reads from the label and icon, not only the color. */
export function RarityChip({ rarity, className = '' }: { rarity: Rarity; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-xs capitalize ${styles[rarity]} ${className}`}
    >
      {rarity === 'rare' && <Sparkle className="size-3" aria-hidden />}
      {rarity}
    </span>
  );
}
