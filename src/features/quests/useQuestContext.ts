import { useCallback, useEffect, useState } from 'react';
import { loadContext, saveContext, type LoadedContext } from './contextStore';
import type { QuestContext } from './questContext';

/** The player's setting / weather / season / time. `undefined` while loading. */
export function useQuestContext() {
  const [loaded, setLoaded] = useState<LoadedContext | undefined>(undefined);

  useEffect(() => {
    loadContext().then(setLoaded);
  }, []);

  const save = useCallback(async (context: QuestContext) => {
    await saveContext(context);
    setLoaded({ context, draft: context });
  }, []);

  return { loaded, save };
}
