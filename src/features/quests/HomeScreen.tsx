import { useEffect, useState } from 'react';
import { Compass, ListChecks, Radio, Smartphone } from 'lucide-react';
import { LinkButton } from '../../components/Button';
import { ModelStatus } from '../../components/ModelStatus';
import { Link } from '../../app/router';
import { useHomeBase } from '../../app/homebase';
import { allCreatures } from '../../lib/db/database';
import type { Creature } from '../creatures/creatureSchemas';
import { SpecimenSheet } from '../landing/SpecimenSheet';
import { TrailSteps } from '../landing/TrailSteps';
import { useActiveQuest } from './useActiveQuest';

export function HomeScreen() {
  const { quest } = useActiveQuest();
  const { role } = useHomeBase();
  const [creatures, setCreatures] = useState<Creature[] | null>(null);

  useEffect(() => {
    allCreatures().then(setCreatures);
  }, []);

  return (
    <div className="grid gap-16 lg:gap-12">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
        <section className="anim-rise grid content-start gap-6">
          <h1 className="text-6xl leading-[0.92] font-extrabold tracking-tight sm:text-8xl xl:text-9xl">Side Quest</h1>
          <p className="max-w-md text-xl sm:text-2xl">Your computer has enough quests. Go find one outside.</p>
          <p className="max-w-md text-fog">Gemma writes the quest and checks your photo, right in your browser.</p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <LinkButton href="/quest" icon={<Compass className="size-5" aria-hidden />} className="text-lg">
              {quest ? 'Continue quest' : 'Start a quest'}
            </LinkButton>
            <LinkButton href="/hunt" variant="secondary" icon={<ListChecks className="size-5" aria-hidden />} className="text-lg">
              Scavenger hunt
            </LinkButton>
          </div>
          <ModelStatus className="justify-self-start" />
          {quest && <p className="text-sm text-fog">Current: {quest.title}</p>}
          {role === 'base' && (
            <Link href="/base" className="inline-flex items-center gap-2 justify-self-start rounded-md text-moss hover:underline">
              <Radio className="size-4" aria-hidden />
              Home base is running. Pair your phone
            </Link>
          )}
          {role === 'solo' && (
            <Link href="/account" className="inline-flex items-center gap-2 justify-self-start rounded-md text-moss hover:underline">
              <Smartphone className="size-4" aria-hidden />
              Sign in to play with your phone
            </Link>
          )}
        </section>

        <div className="anim-rise" style={{ animationDelay: '120ms' }}>
          {creatures && <SpecimenSheet creatures={creatures} />}
        </div>
      </div>

      <TrailSteps />
    </div>
  );
}
