import { useEffect, useState } from 'react';
import { ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { Button, LinkButton } from '../../components/Button';
import { RarityChip } from '../../components/RarityChip';
import { getPhoto } from '../../lib/db/database';
import { CreatureRenderer } from '../creatures/CreatureRenderer';
import { useCreature } from '../creatures/useCreature';

export function CreatureDetail({ id }: { id: string }) {
  const creature = useCreature(id);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => () => void (photoUrl && URL.revokeObjectURL(photoUrl)), [photoUrl]);

  if (creature === undefined) return null;
  if (creature === null) return <p className="text-fog">That creature wandered off.</p>;

  const showPhoto = async () => {
    const photo = creature.photoId ? await getPhoto(creature.photoId) : undefined;
    if (photo) setPhotoUrl(URL.createObjectURL(photo.blob));
  };

  const discovered = new Date(creature.discoveredAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <LinkButton href="/collection" variant="ghost" icon={<ArrowLeft className="size-5" aria-hidden />} className="justify-self-start px-3">
        Collection
      </LinkButton>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
        <div className="paper grid place-items-center rounded-3xl p-6">
          <CreatureRenderer creature={creature} animate className="w-full max-w-md" />
        </div>

        <div className="grid content-start gap-5">
          <div className="grid gap-2">
            <h1 className="text-5xl font-extrabold tracking-tight">{creature.name}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg text-fog">{creature.species}</span>
              <RarityChip rarity={creature.rarity} className="paper" />
            </div>
          </div>
          <p className="text-xl leading-relaxed">{creature.description}</p>

          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-fog">Discovered</dt>
            <dd>{discovered}</dd>
            <dt className="text-fog">Quest</dt>
            <dd>{creature.questTitle}</dd>
            {creature.observations.length > 0 && (
              <>
                <dt className="text-fog">Gemma saw</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {creature.observations.map((o) => (
                    <span key={o} className="rounded-full border border-ink-3 px-2.5 py-0.5">
                      {o}
                    </span>
                  ))}
                </dd>
              </>
            )}
          </dl>

          {photoUrl ? (
            <img src={photoUrl} alt={`The photo that hatched ${creature.name}`} className="w-full rounded-2xl border border-ink-3" />
          ) : (
            creature.photoId && (
              <Button variant="secondary" icon={<ImageIcon className="size-5" aria-hidden />} onClick={showPhoto} className="justify-self-start">
                View quest photo
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
