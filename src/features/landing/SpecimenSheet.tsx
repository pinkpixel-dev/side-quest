import { ArrowRight } from 'lucide-react';
import { Link } from '../../app/router';
import { RarityChip } from '../../components/RarityChip';
import type { Creature } from '../creatures/creatureSchemas';
import { CreatureRenderer } from '../creatures/CreatureRenderer';
import { sampleSpecimens, type Specimen } from './sampleCreatures';

/** One big plus four small fills the 4 x 2 grid. */
const SHOWN = 5;

/** A taped-in journal page of creatures: yours once you have some, examples until then. */
export function SpecimenSheet({ creatures }: { creatures: Creature[] }) {
  const mine = creatures.length > 0;
  const specimens: Specimen[] = mine ? creatures.slice(0, SHOWN) : sampleSpecimens.slice(0, SHOWN);

  return (
    // A wide sheet: the cells are square, so it's about half as tall as it is wide. That leaves
    // room for the trail below. On desktop, cap the width by the viewport height so the whole
    // landing page fits on screen without scrolling.
    <section aria-labelledby="specimens" className="paper journal grid gap-4 rounded-3xl p-4 sm:p-6 lg:ml-auto lg:w-[min(100%,calc((100dvh-42rem)*2))] lg:min-w-[30rem]">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="specimens" className="text-2xl font-extrabold tracking-tight">
          {mine ? (creatures.length === 1 ? '1 creature found' : `${creatures.length} creatures found`) : 'Spotted nearby'}
        </h2>
        {mine ? (
          <Link
            href="/collection"
            className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-md text-sm text-bark-2 transition-colors duration-150 hover:text-bark"
          >
            See all <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : (
          <span className="shrink-0 font-mono text-xs text-bark-2">Examples</span>
        )}
      </div>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {specimens.map((s, i) => (
          <li key={s.id} className={i === 0 ? 'col-span-2 sm:row-span-2' : ''}>
            <SpecimenCell specimen={s} number={i + 1} big={i === 0} href={mine ? `/creature/${s.id}` : undefined} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function SpecimenCell({ specimen, number, big, href }: { specimen: Specimen; number: number; big: boolean; href?: string }) {
  const body = (
    <>
      <span className="font-mono text-[0.7rem] text-bark-2">No. {String(number).padStart(2, '0')}</span>
      <CreatureRenderer creature={specimen} animate={big} className="w-full" />
      <span className={`truncate font-display font-bold ${big ? 'text-2xl' : 'text-sm'}`}>{specimen.name}</span>
      {big && (
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm text-bark-2">{specimen.species}</span>
          <RarityChip rarity={specimen.rarity} />
        </span>
      )}
    </>
  );
  const frame = 'grid h-full content-start gap-1 rounded-2xl border border-dashed border-bark/25 p-2 sm:p-3';

  return href ? (
    <Link href={href} className={`${frame} transition-[background-color,transform] duration-150 hover:-translate-y-0.5 hover:bg-paper-2`}>
      {body}
    </Link>
  ) : (
    <div className={frame}>{body}</div>
  );
}
