import { useEffect, useState } from 'react';
import { ArrowRight, Compass } from 'lucide-react';
import { LinkButton } from '../../components/Button';
import { ModelStatus } from '../../components/ModelStatus';
import { Link } from '../../app/router';
import { allCreatures } from '../../lib/db/database';
import type { Creature } from '../creatures/creatureSchemas';
import { CreatureRenderer } from '../creatures/CreatureRenderer';
import { useActiveQuest } from './useActiveQuest';

export function HomeScreen() {
  const { quest } = useActiveQuest();
  const [creatures, setCreatures] = useState<Creature[] | null>(null);

  useEffect(() => {
    allCreatures().then(setCreatures);
  }, []);

  const count = creatures?.length ?? 0;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
      <section className="anim-rise grid gap-6">
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl">Side Quest</h1>
        <p className="max-w-md text-lg text-fog sm:text-xl">
          Your computer has enough quests. Go find one outside.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <LinkButton href="/quest" icon={<Compass className="size-5" aria-hidden />} className="text-lg">
            {quest ? 'Continue quest' : 'Start a quest'}
          </LinkButton>
          <ModelStatus />
        </div>
        {quest && <p className="text-sm text-fog">Current: {quest.title}</p>}
      </section>

      <section aria-labelledby="home-creatures" className="anim-rise grid gap-4" style={{ animationDelay: '120ms' }}>
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="home-creatures" className="text-xl font-semibold">
            {count === 1 ? '1 creature discovered' : `${count} creatures discovered`}
          </h2>
          {count > 0 && (
            <Link href="/collection" className="inline-flex items-center gap-1 rounded-md text-sm text-fog hover:text-snow">
              See all <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>
        {creatures && count === 0 && (
          <div className="grid place-items-center rounded-2xl border border-dashed border-ink-3 px-6 py-12 text-center text-fog">
            Nothing hatched yet. They're all outside.
          </div>
        )}
        {count > 0 && (
          <ul className="grid grid-cols-3 gap-3">
            {creatures!.slice(0, 3).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/creature/${c.id}`}
                  className="paper grid rounded-2xl p-2 transition-transform duration-150 hover:-translate-y-0.5"
                >
                  <CreatureRenderer creature={c} className="w-full" />
                  <span className="truncate px-1 pb-1 text-center font-display font-semibold">{c.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
