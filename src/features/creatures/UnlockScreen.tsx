import { Compass, LayoutGrid } from 'lucide-react';
import { LinkButton } from '../../components/Button';
import { RarityChip } from '../../components/RarityChip';
import { CreatureRenderer } from './CreatureRenderer';
import { Egg } from './Egg';
import { useCreature } from './useCreature';

/** Quest complete -> egg wobbles -> creature pops in -> name and description. About two seconds. */
export function UnlockScreen({ id }: { id: string }) {
  const creature = useCreature(id);
  if (creature === undefined) return null;
  if (creature === null) return <p className="text-fog">That creature wandered off.</p>;

  const step = (ms: number) => ({ animationDelay: `${ms}ms` });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] justify-items-center gap-6 text-center">
      <p className="anim-rise font-mono text-sm uppercase tracking-widest text-moss">Quest complete</p>

      <div className="paper relative w-full max-w-sm overflow-clip rounded-3xl p-4">
        <Egg className="anim-egg-out absolute inset-4 w-[calc(100%-2rem)]" />
        <div className="anim-pop-in">
          <CreatureRenderer creature={creature} animate className="w-full" />
        </div>
        <span className="stamp anim-stamp absolute top-5 right-5 text-xl" style={step(1250)}>
          Found
        </span>
      </div>

      <div className="grid justify-items-center gap-3">
        <h1 className="anim-rise text-5xl font-extrabold tracking-tight sm:text-6xl" style={step(1500)}>
          {creature.name}
        </h1>
        <div className="anim-rise flex flex-wrap items-center justify-center gap-2" style={step(1650)}>
          <span className="text-lg text-fog">{creature.species}</span>
          <RarityChip rarity={creature.rarity} className="paper" />
        </div>
        <p className="anim-rise max-w-md text-lg" style={step(1800)}>
          {creature.description}
        </p>
      </div>

      <div className="anim-rise flex flex-wrap justify-center gap-3" style={step(2000)}>
        <LinkButton href="/quest" icon={<Compass className="size-5" aria-hidden />}>
          Next quest
        </LinkButton>
        <LinkButton href="/collection" variant="secondary" icon={<LayoutGrid className="size-5" aria-hidden />}>
          Collection
        </LinkButton>
      </div>
    </div>
  );
}
