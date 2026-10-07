import { useEffect, useState } from 'react';
import { Compass } from 'lucide-react';
import { LinkButton } from '../../components/Button';
import { RarityChip } from '../../components/RarityChip';
import { Link } from '../../app/router';
import { allCreatures } from '../../lib/db/database';
import type { Creature } from '../creatures/creatureSchemas';
import { CreatureRenderer } from '../creatures/CreatureRenderer';
import { Egg } from '../creatures/Egg';

export const shortDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function CollectionScreen() {
  const [creatures, setCreatures] = useState<Creature[] | null>(null);
  useEffect(() => {
    allCreatures().then(setCreatures);
  }, []);
  if (!creatures) return null;

  return (
    <div className="grid gap-6">
      <h1 className="text-4xl font-extrabold tracking-tight">Your creatures</h1>

      {creatures.length === 0 ? (
        <div className="grid justify-items-center gap-4 rounded-3xl border border-dashed border-ink-3 px-6 py-14 text-center">
          <Egg className="w-28 opacity-80" />
          <p className="text-fog">Nothing hatched yet. Every creature starts with a quest.</p>
          <LinkButton href="/quest" icon={<Compass className="size-5" aria-hidden />}>
            Start a quest
          </LinkButton>
        </div>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,10rem),1fr))] gap-4">
          {creatures.map((c) => (
            <li key={c.id}>
              <Link
                href={`/creature/${c.id}`}
                className="paper grid h-full gap-1 rounded-2xl p-3 transition-transform duration-150 hover:-translate-y-0.5"
              >
                <CreatureRenderer creature={c} className="w-full" />
                <span className="truncate font-display text-lg font-bold">{c.name}</span>
                <span className="truncate text-sm text-bark-2">{c.species}</span>
                <span className="flex items-center justify-between gap-2 pt-1">
                  <RarityChip rarity={c.rarity} />
                  <span className="font-mono text-xs text-bark-2">{shortDate(c.discoveredAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
