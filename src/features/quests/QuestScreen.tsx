import { useEffect, useRef, useState } from 'react';
import { Camera, Clock, Shuffle, Sparkles } from 'lucide-react';
import { Button, LinkButton } from '../../components/Button';
import { ModelStatus } from '../../components/ModelStatus';
import { useGemma } from '../../app/gemma';
import { startNewQuest } from './questService';
import type { Quest } from './questSchemas';
import { useActiveQuest } from './useActiveQuest';

export function QuestScreen() {
  const { client, state } = useGemma();
  const { quest, setQuest } = useActiveQuest();
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const next = async (previous?: Quest) => {
    setBusy(true);
    try {
      setQuest(await startNewQuest(client, previous));
    } finally {
      setBusy(false);
    }
  };

  // First visit with no quest in progress: hand one out right away.
  useEffect(() => {
    if (quest === null && !started.current) {
      started.current = true;
      next();
    }
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start lg:gap-12">
      <article
        aria-busy={busy || !quest}
        className="paper anim-rise relative grid min-h-80 content-start gap-5 rounded-3xl p-6 shadow-[0_1px_0_oklch(1_0_0/0.4)_inset] sm:p-10"
      >
        {quest ? (
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
        <ModelStatus className="justify-self-start" />
      </aside>
    </div>
  );
}
