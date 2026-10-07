import { useEffect, useState } from 'react';
import { getCreature } from '../../lib/db/database';
import type { Creature } from './creatureSchemas';

/** `undefined` while loading, `null` if there's no creature with that id. */
export function useCreature(id: string): Creature | null | undefined {
  const [creature, setCreature] = useState<Creature | null | undefined>(undefined);
  useEffect(() => {
    getCreature(id).then((c) => setCreature(c ?? null));
  }, [id]);
  return creature;
}
