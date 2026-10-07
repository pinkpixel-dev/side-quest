import { useCallback, useEffect, useState } from 'react';
import { getQuest, getSetting } from '../../lib/db/database';
import type { Quest } from './questSchemas';

/** The quest in progress, if any. `undefined` while loading, `null` when there isn't one. */
export function useActiveQuest() {
  const [quest, setQuest] = useState<Quest | null | undefined>(undefined);

  const reload = useCallback(async () => {
    const id = await getSetting<string | null>('activeQuestId');
    const found = id ? await getQuest(id) : undefined;
    setQuest(found?.status === 'active' ? found : null);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { quest, setQuest, reload };
}
