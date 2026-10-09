import { useState } from 'react';
import { Egg as EggIcon, ListChecks, MapPinned, Send, Sparkles, Trash2 } from 'lucide-react';
import { Button, LinkButton } from '../../components/Button';
import { ModelStatus } from '../../components/ModelStatus';
import { ModeTabs } from '../../components/ModeTabs';
import { useGemma } from '../../app/gemma';
import { useHomeBase } from '../../app/homebase';
import { navigate } from '../../app/router';
import { fieldApi } from '../../lib/home/client';
import { preparePhoto } from '../../lib/images/preprocess';
import { Egg } from '../creatures/Egg';
import { ContextForm, contextSummary } from '../quests/ContextForm';
import type { QuestContext } from '../quests/questContext';
import { useQuestContext } from '../quests/useQuestContext';
import { HuntItemRow } from './HuntItemRow';
import { HUNT_SIZE, MIN_TO_HATCH, foundCount, snappedCount, type Hunt } from './huntSchemas';
import { abandonHunt, finishHunt, snapItem, startHunt } from './huntService';
import { submitHunt } from './huntSync';
import { useHunt, useThumbs } from './useHunt';

/** `hatching` flips on once every photo is checked and enough were found: Gemma is now designing the creature. */
type Checking = { done: number; total: number; current?: string; hatching?: boolean };

export function HuntScreen({ id }: { id?: string }) {
  const { client, state } = useGemma();
  const { role, pairing, sync } = useHomeBase();
  const field = role === 'field';
  const { hunt, setHunt } = useHunt(id);
  const thumbs = useThumbs(hunt);
  const { loaded, save } = useQuestContext();
  const context = loaded?.context ?? null;
  const [starting, setStarting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [snapping, setSnapping] = useState<string | null>(null);
  const [checking, setChecking] = useState<Checking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);

  const start = async (ctx: QuestContext | null = context) => {
    setStarting(true);
    setError(null);
    try {
      const fromHome = field && pairing ? () => fieldApi(pairing).nextHunt(ctx) : undefined;
      setHunt(await startHunt(client, ctx, fromHome));
    } finally {
      setStarting(false);
    }
  };

  const snap = async (itemId: string, file: File) => {
    if (!hunt) return;
    setSnapping(itemId);
    setError(null);
    try {
      const { blob } = await preparePhoto(file);
      setHunt(await snapItem(hunt, itemId, blob));
    } catch (err) {
      console.error('Saving a hunt photo failed', err);
      setError("That photo didn't save. Try another one.");
    } finally {
      setSnapping(null);
    }
  };

  const finish = async () => {
    if (!hunt) return;
    setError(null);
    if (field) {
      try {
        setHunt(await submitHunt(hunt));
        sync();
      } catch (err) {
        setError(`Couldn't save this hunt on your phone: ${err instanceof Error ? err.message : String(err)}`);
      }
      return;
    }
    const snapped = hunt.items.filter((i) => i.photoId);
    setChecking({ done: 0, total: snapped.length, current: snapped[0]?.id });
    try {
      // Show each verdict as it lands rather than all at the end.
      let live = hunt;
      const done = await finishHunt(client, hunt, (n, total, last) => {
        if (last) live = { ...live, items: live.items.map((i) => (i.id === last.id ? { ...i, ...last } : i)) };
        setHunt(live);
        const hatching = n === total && live.items.filter((i) => i.found).length >= MIN_TO_HATCH;
        setChecking({ done: n, total, current: snapped[n]?.id, hatching });
      });
      setHunt(done);
    } catch (err) {
      console.error('Checking the hunt failed', err);
      setError('Gemma lost the thread partway through. Give it another go.');
      setHunt(hunt);
    } finally {
      setChecking(null);
    }
  };

  const quit = async () => {
    if (!hunt) return;
    if (!confirmQuit) return setConfirmQuit(true);
    setConfirmQuit(false);
    await abandonHunt(hunt);
    setHunt(null);
  };

  /** Back to the start card. A past hunt opened by id lives at its own URL, so leave it. */
  const reset = () => (id ? navigate('/hunt') : setHunt(null));

  const submitContext = async (ctx: QuestContext) => {
    await save(ctx);
    setEditing(false);
    await start(ctx);
  };

  if (hunt === undefined || loaded === undefined) return null;
  const showForm = editing || (!hunt && !context);
  const snapped = hunt ? snappedCount(hunt) : 0;
  const active = hunt?.status === 'active' && !checking;
  const ready = state.status === 'ready';

  return (
    <div className="grid gap-6">
      <ModeTabs />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start lg:gap-12">
        <article
          aria-busy={starting || !!checking}
          className="paper journal anim-rise grid min-h-80 content-start gap-4 rounded-3xl p-5 shadow-[0_1px_0_oklch(1_0_0/0.4)_inset] sm:p-10"
        >
          {showForm ? (
            <ContextForm
              initial={loaded.draft}
              onSubmit={submitContext}
              onCancel={editing ? () => setEditing(false) : undefined}
              submitLabel="Get a hunt"
            />
          ) : hunt ? (
            <>
              <div className="flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-wide text-bark-2">
                <span>Scavenger hunt</span>
                {hunt.source === 'gemma' && (
                  <span className="inline-flex items-center gap-1 normal-case tracking-normal">
                    · <Sparkles className="size-3" aria-hidden /> written by Gemma
                  </span>
                )}
                {hunt.status === 'completed' && (
                  <span className="stamp anim-stamp ml-auto text-base">
                    {foundCount(hunt)}/{hunt.items.length} found
                  </span>
                )}
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{hunt.title}</h1>
              <Progress hunt={hunt} />
              <ol className="grid">
                {hunt.items.map((item, i) => (
                  <HuntItemRow
                    key={item.id}
                    item={item}
                    index={i}
                    thumb={item.photoId ? thumbs[item.photoId] : undefined}
                    editable={active}
                    busy={snapping === item.id}
                    checking={checking?.current === item.id}
                    onPick={(file) => snap(item.id, file)}
                  />
                ))}
              </ol>
            </>
          ) : (
            <div className="grid content-start gap-3">
              <ListChecks className="size-10 text-bark-2" aria-hidden />
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Scavenger hunt</h1>
              <p className="max-w-md text-xl">
                Find {HUNT_SIZE} things. Snap {MIN_TO_HATCH} or more to hatch a creature.
              </p>
              {starting && (
                <p className="text-bark-2" role="status">
                  {ready && !field ? 'Gemma is writing your list…' : 'Putting a list together…'}
                </p>
              )}
            </div>
          )}
        </article>

        <aside className="grid content-start gap-3 lg:pt-4" aria-live="polite">
          {!showForm && !hunt && (
            <>
              <Button
                icon={<ListChecks className="size-5" aria-hidden />}
                loading={starting}
                onClick={() => start()}
                className="text-lg"
              >
                Start a hunt
              </Button>
              <ContextLink context={context} onClick={() => setEditing(true)} />
            </>
          )}

          {checking && (
            <div className="grid justify-items-center gap-3 rounded-2xl border border-ink-3 bg-ink-2 p-6" role="status">
              <Egg className={`w-28 ${checking.hatching ? 'anim-hatching' : 'anim-wobble'}`} />
              {checking.hatching ? (
                <p className="anim-pulse font-display text-lg font-bold text-moss">Hatching…</p>
              ) : (
                <p className="text-fog">
                  Checking {Math.min(checking.done + 1, checking.total)} of {checking.total}…
                </p>
              )}
            </div>
          )}

          {active && (
            <>
              <Button
                icon={field ? <Send className="size-5" aria-hidden /> : <Sparkles className="size-5" aria-hidden />}
                disabled={snapped < MIN_TO_HATCH || (!field && !ready)}
                onClick={finish}
                className="text-lg"
              >
                {field ? 'Send hunt home' : 'Show Gemma'}
              </Button>
              {snapped < MIN_TO_HATCH && <p className="text-sm text-fog">Snap {MIN_TO_HATCH - snapped} more to finish.</p>}
              <Button
                variant="ghost"
                icon={<Trash2 className="size-5" aria-hidden />}
                onClick={quit}
                onBlur={() => setConfirmQuit(false)}
              >
                {confirmQuit ? 'Tap again to drop it' : 'Drop this hunt'}
              </Button>
            </>
          )}

          {hunt && (hunt.status === 'queued' || hunt.status === 'waiting') && (
            <>
              <div className="grid justify-items-center gap-3 rounded-2xl border border-ink-3 bg-ink-2 p-6" role="status">
                <Egg className="anim-bob w-28" />
                <p className="text-center text-fog">On its way home. Gemma will check it while you keep exploring.</p>
              </div>
              <NewHunt onClick={reset} />
            </>
          )}

          {hunt?.status === 'completed' && <Results hunt={hunt} onNew={reset} />}

          {error && <p className="text-sm text-blush">{error}</p>}
          {(field || !ready) && !checking && <ModelStatus className="justify-self-start" />}
        </aside>
      </div>
    </div>
  );
}

function Progress({ hunt }: { hunt: Hunt }) {
  const done = hunt.status === 'completed';
  const count = done ? foundCount(hunt) : snappedCount(hunt);
  return (
    <div className="grid gap-2">
      <p className="text-sm text-bark-2">
        {count} / {hunt.items.length} {done ? 'found' : 'snapped'}
      </p>
      <div className="grid grid-cols-10 gap-1" aria-hidden>
        {hunt.items.map((item) => (
          <span key={item.id} className={`h-1.5 rounded-full ${(done ? item.found : item.photoId) ? 'bg-bark' : 'bg-bark/15'}`} />
        ))}
      </div>
    </div>
  );
}

function Results({ hunt, onNew }: { hunt: Hunt; onNew(): void }) {
  const found = foundCount(hunt);
  return (
    <>
      <div className="grid gap-1 rounded-2xl border border-ink-3 bg-ink-2 p-5">
        <h2 className="text-2xl font-bold">
          {found} of {hunt.items.length} found
        </h2>
        <p className="text-fog">
          {hunt.creatureId ? 'Something hatched from your hunt.' : `Not enough for an egg this time. You need ${MIN_TO_HATCH}.`}
        </p>
      </div>
      {hunt.creatureId && (
        <LinkButton href={`/unlock/${hunt.creatureId}`} icon={<EggIcon className="size-5" aria-hidden />} className="text-lg">
          Meet it
        </LinkButton>
      )}
      <NewHunt onClick={onNew} />
    </>
  );
}

function NewHunt({ onClick }: { onClick(): void }) {
  return (
    <Button variant="secondary" icon={<ListChecks className="size-5" aria-hidden />} onClick={onClick}>
      New hunt
    </Button>
  );
}

function ContextLink({ context, onClick }: { context: QuestContext | null; onClick(): void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-2 justify-self-start rounded-lg px-1 text-left text-sm text-fog transition-colors duration-150 hover:text-snow"
    >
      <MapPinned className="size-4 shrink-0" aria-hidden />
      {context ? (
        <span>
          {contextSummary(context)} <span className="underline underline-offset-4">Change</span>
        </span>
      ) : (
        <span className="underline underline-offset-4">Set where you are</span>
      )}
    </button>
  );
}
