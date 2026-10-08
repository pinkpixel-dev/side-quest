import { useEffect, useRef, useState } from 'react';
import { Camera, Clock, MapPinned, Shuffle, Sparkles } from 'lucide-react';
import { Button, LinkButton } from '../../components/Button';
import { ModelStatus } from '../../components/ModelStatus';
import { ModeTabs } from '../../components/ModeTabs';
import { useGemma } from '../../app/gemma';
import { useHomeBase } from '../../app/homebase';
import { fieldApi } from '../../lib/home/client';
import { ContextForm, contextSummary } from './ContextForm';
import type { QuestContext } from './questContext';
import { startNewQuest } from './questService';
import type { Quest } from './questSchemas';
import { useActiveQuest } from './useActiveQuest';
import { useQuestContext } from './useQuestContext';

export function QuestScreen() {
  const { client, state } = useGemma();
  const { role, pairing, finds } = useHomeBase();
  const { quest, setQuest } = useActiveQuest();
  const onTheWay = finds.filter((f) => f.status === 'queued' || f.status === 'waiting').length;
  const { loaded, save } = useQuestContext();
  const context = loaded?.context ?? null;
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const started = useRef(false);

  const next = async (previous?: Quest, ctx: QuestContext | null = context) => {
    setBusy(true);
    try {
      const fromHome = role === 'field' && pairing ? () => fieldApi(pairing).nextQuest(ctx) : undefined;
      setQuest(await startNewQuest(client, previous, fromHome, ctx));
    } finally {
      setBusy(false);
    }
  };

  // No quest in progress and we know where the player is: hand one out right away.
  useEffect(() => {
    if (quest === null && context && role !== 'checking' && !started.current) {
      started.current = true;
      next();
    }
  });

  // Ask first when there's nothing to show yet, or when the player taps Change.
  const showForm = editing || (loaded !== undefined && !context && quest === null);

  const submitContext = async (ctx: QuestContext) => {
    await save(ctx);
    setEditing(false);
    started.current = true;
    // A quest written for somewhere else is no use now.
    await next(quest ?? undefined, ctx);
  };

  return (
    <div className="grid gap-6">
      <ModeTabs />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start lg:gap-12">
        <article
          aria-busy={!showForm && (busy || !quest)}
          className="paper anim-rise relative grid min-h-80 content-start gap-5 rounded-3xl p-6 shadow-[0_1px_0_oklch(1_0_0/0.4)_inset] sm:p-10"
        >
          {showForm && loaded ? (
            <ContextForm
              initial={loaded.draft}
              onSubmit={submitContext}
              onCancel={editing ? () => setEditing(false) : undefined}
            />
          ) : quest ? (
            <>
              <div className="flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-wide text-bark-2">
                <span>{quest.category.replace('-', ' ')}</span>
                {quest.source === 'gemma' && (
                  <span className="inline-flex items-center gap-1 normal-case tracking-normal">
                    · <Sparkles className="size-3" aria-hidden /> written by Gemma
                  </span>
                )}
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">{quest.title}</h1>
              <p className="max-w-xl text-xl leading-relaxed sm:text-2xl">{quest.description}</p>
              <p className="flex items-center gap-2 text-sm text-bark-2">
                <Clock className="size-4" aria-hidden />
                {quest.estimatedMinutes} min · <span className="capitalize">{quest.difficulty}</span>
              </p>
            </>
          ) : (
            <p className="self-center justify-self-center text-bark-2" role="status">
              {state.status === 'ready' ? 'Gemma is writing a quest…' : 'Finding a quest…'}
            </p>
          )}
        </article>

        <aside className="grid gap-3 lg:pt-4">
          {!showForm && (
            <>
              <LinkButton href="/proof" icon={<Camera className="size-5" aria-hidden />} className="text-lg">
                I found it
              </LinkButton>
              <Button
                variant="secondary"
                icon={<Shuffle className="size-5" aria-hidden />}
                loading={busy}
                disabled={!quest}
                onClick={() => next(quest ?? undefined)}
              >
                Another quest
              </Button>
              <button
                type="button"
                onClick={() => setEditing(true)}
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
            </>
          )}
          <ModelStatus className="justify-self-start" />
          {onTheWay > 0 && (
            <p className="text-sm text-fog">
              {onTheWay === 1 ? '1 find on its way home' : `${onTheWay} finds on their way home`}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
