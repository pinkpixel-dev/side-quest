import { Egg, X } from 'lucide-react';
import { Button } from '../../components/Button';
import { useHomeBase } from '../../app/homebase';
import { navigate } from '../../app/router';
import type { LocalFind } from '../../lib/db/database';
import { markSeen, retryFind } from './fieldSync';
import { markHuntSeen } from '../hunts/huntSync';
import { foundCount, type Hunt } from '../hunts/huntSchemas';

/** Top-of-screen note when a find sent home has been judged. One at a time, oldest first. */
export function FieldNotices() {
  const { role, finds, hunts, sync } = useHomeBase();
  if (role !== 'field') return null;
  const find = finds
    .filter((f) => !f.seen && f.status !== 'queued' && f.status !== 'waiting')
    .sort((a, b) => a.createdAt - b.createdAt)[0];
  if (!find) {
    const hunt = hunts.filter((h) => h.status === 'completed' && h.seen === false).sort((a, b) => a.createdAt - b.createdAt)[0];
    return hunt ? <HuntNotice hunt={hunt} sync={sync} /> : null;
  }

  const done = async (action: (f: LocalFind) => Promise<void>, to?: string) => {
    await action(find);
    await sync();
    if (to) navigate(to);
  };
  const hatched = find.status === 'hatched';

  return (
    <div className="px-4 sm:px-8" role="status" aria-live="polite">
      <div className="anim-rise flex flex-wrap items-center gap-3 rounded-2xl border border-ink-3 bg-ink-2 p-3 pl-4">
        <Egg className={`size-5 shrink-0 ${hatched ? 'text-moss' : 'text-blush'}`} aria-hidden />
        <p className="min-w-0 flex-1">
          {hatched
            ? `Something hatched from "${find.quest.title}"!`
            : `Gemma couldn't spot it in your "${find.quest.title}" photo.`}
        </p>
        {hatched ? (
          <Button className="min-h-10 px-4" onClick={() => done(markSeen, `/unlock/${find.creatureId}`)}>
            See it
          </Button>
        ) : (
          <Button className="min-h-10 px-4" onClick={() => done(retryFind, '/proof')}>
            Try again
          </Button>
        )}
        <button
          type="button"
          onClick={() => done(markSeen)}
          className="grid size-10 place-items-center rounded-lg text-fog hover:bg-ink-3 hover:text-snow"
          aria-label="Dismiss"
          title="Dismiss"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function HuntNotice({ hunt, sync }: { hunt: Hunt; sync(): Promise<void> }) {
  const done = async (to?: string) => {
    await markHuntSeen(hunt);
    await sync();
    if (to) navigate(to);
  };
  const hatched = !!hunt.creatureId;

  return (
    <div className="px-4 sm:px-8" role="status" aria-live="polite">
      <div className="anim-rise flex flex-wrap items-center gap-3 rounded-2xl border border-ink-3 bg-ink-2 p-3 pl-4">
        <Egg className={`size-5 shrink-0 ${hatched ? 'text-moss' : 'text-blush'}`} aria-hidden />
        <p className="min-w-0 flex-1">
          Your "{hunt.title}" hunt is back: {foundCount(hunt)} of {hunt.items.length} found
          {hatched ? ', and something hatched!' : '.'}
        </p>
        <Button className="min-h-10 px-4" onClick={() => done(hatched ? `/unlock/${hunt.creatureId}` : `/hunt/${hunt.id}`)}>
          See it
        </Button>
        <button
          type="button"
          onClick={() => done()}
          className="grid size-10 place-items-center rounded-lg text-fog hover:bg-ink-3 hover:text-snow"
          aria-label="Dismiss"
          title="Dismiss"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
