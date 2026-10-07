import { useEffect, useState } from 'react';
import { ArrowLeft, Compass, RotateCcw, Send, Shuffle, Sparkles } from 'lucide-react';
import { Button, LinkButton } from '../../components/Button';
import { ModelStatus } from '../../components/ModelStatus';
import { useGemma } from '../../app/gemma';
import { useHomeBase } from '../../app/homebase';
import { fieldApi } from '../../lib/home/client';
import { submitFind } from '../field/fieldSync';
import { navigate } from '../../app/router';
import { preparePhoto, type PreparedImage } from '../../lib/images/preprocess';
import { hatchCreature } from '../creatures/creatureService';
import { Egg } from '../creatures/Egg';
import { startNewQuest } from '../quests/questService';
import { useActiveQuest } from '../quests/useActiveQuest';
import { judgePhoto } from './judgeService';
import { PhotoPicker } from './PhotoPicker';

type Phase =
  | { kind: 'pick' }
  | { kind: 'preview' }
  | { kind: 'judging'; since: number }
  | { kind: 'not-quite'; reason: string }
  | { kind: 'confused' }
  | { kind: 'sent' };

export function ProofScreen() {
  const { client, state, supported } = useGemma();
  const { role, pairing, sync } = useHomeBase();
  const field = role === 'field';
  const fromHome = field && pairing ? () => fieldApi(pairing).nextQuest() : undefined;
  const { quest } = useActiveQuest();
  const [phase, setPhase] = useState<Phase>({ kind: 'pick' });
  const [photo, setPhoto] = useState<(PreparedImage & { url: string }) | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  useEffect(() => {
    if (quest === null) navigate('/quest', { replace: true });
  }, [quest]);

  useEffect(() => () => void (photo && URL.revokeObjectURL(photo.url)), [photo]);

  const pick = async (file: File) => {
    setPickError(null);
    try {
      const prepared = await preparePhoto(file);
      setPhoto({ ...prepared, url: URL.createObjectURL(prepared.blob) });
      setPhase({ kind: 'preview' });
    } catch {
      setPickError("That file didn't open as a photo. Try another one.");
    }
  };

  const judge = async () => {
    if (!quest || !photo) return;
    setPhase({ kind: 'judging', since: Date.now() });
    try {
      const { judgement, seed, rarity, palette } = await judgePhoto(client, quest, photo.blob);
      if (!judgement) return setPhase({ kind: 'confused' });
      if (!judgement.passed) return setPhase({ kind: 'not-quite', reason: judgement.reason });
      const creature = await hatchCreature({ quest, photo: photo.blob, seed, rarity, palette, judgement });
      navigate(`/unlock/${creature.id}`, { replace: true });
    } catch (err) {
      console.error('Judging failed', err);
      setPhase({ kind: 'confused' });
    }
  };

  /** Field mode: queue the photo for the home base and get back outside. */
  const sendHome = async () => {
    if (!quest || !photo) return;
    setPickError(null);
    try {
      await submitFind(quest, photo.blob);
    } catch (err) {
      console.error('Saving the find failed', err);
      setPickError(`Couldn't save this find on your phone: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`);
      return;
    }
    setPhase({ kind: 'sent' });
    sync();
  };

  const newQuest = async () => {
    await startNewQuest(client, phase.kind === 'sent' ? undefined : (quest ?? undefined), fromHome);
    navigate('/quest', { replace: true });
  };

  if (!quest) return null;
  const ready = state.status === 'ready';

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-12">
      <section className="grid content-start gap-4">
        <LinkButton href="/quest" variant="ghost" icon={<ArrowLeft className="size-5" aria-hidden />} className="justify-self-start px-3">
          {quest.title}
        </LinkButton>
        <p className="text-lg text-fog">{quest.description}</p>

        {phase.kind === 'judging' ? (
          <Judging since={phase.since} />
        ) : phase.kind === 'sent' ? (
          <div className="grid aspect-[4/3] place-items-center content-center gap-4 rounded-2xl border border-ink-3 bg-ink-2" role="status">
            <Egg className="anim-bob w-36" />
            <p className="px-6 text-center text-fog">On its way home. It'll hatch while you keep exploring.</p>
          </div>
        ) : photo ? (
          <img src={photo.url} alt="Your photo" className="max-h-[60dvh] w-full rounded-2xl border border-ink-3 bg-ink-2 object-contain" />
        ) : (
          <div className="grid aspect-[4/3] place-items-center rounded-2xl border border-dashed border-ink-3 text-fog">
            Snap whatever you found.
          </div>
        )}
      </section>

      <section className="grid content-start gap-4 lg:pt-14" aria-live="polite">
        {phase.kind === 'not-quite' && (
          <Notice title="Not quite">
            {phase.reason || "Gemma couldn't spot it in this one."} Try another angle or keep exploring.
          </Notice>
        )}
        {phase.kind === 'confused' && (
          <Notice title="Gemma lost the thread">That happens sometimes. Give it another go.</Notice>
        )}

        {phase.kind === 'sent' && (
          <Button icon={<Compass className="size-5" aria-hidden />} onClick={newQuest} className="text-lg">
            Next quest
          </Button>
        )}

        {phase.kind !== 'judging' && phase.kind !== 'sent' && (
          <>
            {photo && field && phase.kind === 'preview' && (
              <Button icon={<Send className="size-5" aria-hidden />} onClick={sendHome} className="text-lg">
                Send home
              </Button>
            )}
            {photo && !field && (phase.kind === 'preview' || phase.kind === 'confused') && (
              <Button icon={<Sparkles className="size-5" aria-hidden />} disabled={!ready} onClick={judge} className="text-lg">
                {phase.kind === 'confused' ? 'Try again' : 'Show Gemma'}
              </Button>
            )}
            <PhotoPicker onPick={pick} />
            {pickError && <p className="text-sm text-blush">{pickError}</p>}
            {phase.kind === 'not-quite' && (
              <Button variant="ghost" icon={<Shuffle className="size-5" aria-hidden />} onClick={newQuest}>
                New quest
              </Button>
            )}
            {field && <ModelStatus className="justify-self-start" />}
            {!ready && !field && (
              <div className="grid justify-items-start gap-2 pt-2 text-sm text-fog">
                {supported ? 'Gemma checks your photo right here on this device.' : "This device can't run Gemma. Try desktop Chrome or Edge."}
                <ModelStatus />
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function Judging({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="grid aspect-[4/3] place-items-center content-center gap-4 rounded-2xl border border-ink-3 bg-ink-2" role="status">
      <Egg className="anim-wobble w-40" />
      <p className="text-fog">
        Gemma is taking a close look… <span className="font-mono text-sm">{Math.round((now - since) / 1000)}s</span>
      </p>
    </div>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="anim-rise grid gap-1 rounded-2xl border border-blush/40 bg-ink-2 p-5">
      <h2 className="flex items-center gap-2 text-2xl font-bold">
        <RotateCcw className="size-5 text-blush" aria-hidden />
        {title}
      </h2>
      <p className="text-fog">{children}</p>
    </div>
  );
}
