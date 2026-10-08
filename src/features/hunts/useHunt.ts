import { useEffect, useRef, useState } from 'react';
import { getHunt, getPhoto, getSetting } from '../../lib/db/database';
import type { Hunt } from './huntSchemas';

/** A specific hunt, or the active one. `undefined` while loading, `null` when there isn't one. */
export function useHunt(id?: string) {
  const [hunt, setHunt] = useState<Hunt | null | undefined>(undefined);

  useEffect(() => {
    (async () => {
      if (id) return setHunt((await getHunt(id)) ?? null);
      const activeId = await getSetting<string | null>('activeHuntId');
      const found = activeId ? await getHunt(activeId) : undefined;
      setHunt(found?.status === 'active' ? found : null);
    })();
  }, [id]);

  return { hunt, setHunt };
}

/** Object URLs for each snapped item's photo, keyed by photoId. Revoked when they're replaced or on unmount. */
export function useThumbs(hunt: Hunt | null | undefined): Record<string, string> {
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const live = useRef<Record<string, string>>({});
  const key = hunt?.items.map((i) => i.photoId ?? '').join(',') ?? '';

  // Swap in the new set before revoking the old one, so a retake doesn't flash broken images.
  useEffect(() => {
    const ids = key.split(',').filter(Boolean);
    let cancelled = false;
    (async () => {
      const made: Record<string, string> = {};
      for (const id of ids) {
        const photo = await getPhoto(id);
        if (photo) made[id] = URL.createObjectURL(photo.blob);
      }
      if (cancelled) return revokeAll(made);
      revokeAll(live.current);
      live.current = made;
      setThumbs(made);
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  useEffect(() => () => revokeAll(live.current), []);

  return thumbs;
}

const revokeAll = (urls: Record<string, string>) => Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
