import { createContext, useCallback, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { GemmaClient, type GemmaState } from '../lib/gemma/client';
import { MODELS, type ModelKey } from '../lib/gemma/models';
import { getSetting, setSetting } from '../lib/db/database';

/** The standard build: runs as q4f16 where shader-f16 exists, q4 everywhere else. */
export const GAME_MODEL: ModelKey = 'e2b';
export const GAME_MODEL_BYTES = MODELS[GAME_MODEL].approxBytes;

export const webgpuAvailable = typeof navigator !== 'undefined' && 'gpu' in navigator;

interface GemmaContextValue {
  client: GemmaClient;
  state: GemmaState;
  supported: boolean;
  wake(): void;
}

const GemmaContext = createContext<GemmaContextValue | null>(null);
const client = new GemmaClient();

export function GemmaProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(
    (fn) => client.subscribe(fn),
    () => client.state,
  );

  const wake = useCallback(() => {
    if (webgpuAvailable && (client.state.status === 'off' || client.state.status === 'error')) client.load(GAME_MODEL);
  }, []);

  // Once the model has downloaded once, it's cached: wake it automatically on later visits.
  useEffect(() => {
    getSetting<boolean>('modelCached').then((cached) => cached && wake());
  }, [wake]);

  useEffect(() => {
    if (state.status === 'ready') setSetting('modelCached', true);
  }, [state.status]);

  return <GemmaContext value={{ client, state, supported: webgpuAvailable, wake }}>{children}</GemmaContext>;
}

export function useGemma(): GemmaContextValue {
  const ctx = useContext(GemmaContext);
  if (!ctx) throw new Error('useGemma must be used inside GemmaProvider');
  return ctx;
}
