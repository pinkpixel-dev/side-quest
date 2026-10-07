import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { allFinds, recentQuests, type LocalFind } from '../lib/db/database';
import { baseApi, fieldApi, findHomeServer, loadPairing, savePairing, type Pairing } from '../lib/home/client';
import type { BaseSession, HelloResponse } from '../lib/home/protocol';
import { processFind, writeQuestForPhone } from '../features/base/baseWorker';
import { syncFinds } from '../features/field/fieldSync';
import { useGemma } from './gemma';

/**
 * solo  - this device runs Gemma and does everything itself
 * base  - the laptop next to `npm run home`: runs Gemma for a paired phone (and can still play solo)
 * field - a paired phone: quests + camera, Gemma's work happens at home
 */
export type Role = 'checking' | 'solo' | 'base' | 'field';

export interface BaseEvent {
  at: number;
  text: string;
}

interface HomeBaseValue {
  role: Role;
  // field
  pairing: Pairing | null;
  hello: HelloResponse | null;
  /** null until the first check finishes. */
  reachable: boolean | null;
  finds: LocalFind[];
  sync(): Promise<void>;
  pair(p: Pairing): Promise<void>;
  unpair(): Promise<void>;
  // base
  session: BaseSession | null;
  waiting: number;
  busyWith: string | null;
  events: BaseEvent[];
}

const HomeBaseContext = createContext<HomeBaseValue | null>(null);
const BASE_TICK_MS = 4_000;
const FIELD_TICK_MS = 10_000;

export function HomeBaseProvider({ children }: { children: ReactNode }) {
  const { client, state } = useGemma();
  const [role, setRole] = useState<Role>('checking');
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [hello, setHello] = useState<HelloResponse | null>(null);
  const [reachable, setReachable] = useState<boolean | null>(null);
  const [finds, setFinds] = useState<LocalFind[]>([]);
  const [baseOrigin, setBaseOrigin] = useState<string | null>(null);
  const [session, setSession] = useState<BaseSession | null>(null);
  const [waiting, setWaiting] = useState(0);
  const [busyWith, setBusyWith] = useState<string | null>(null);
  const [events, setEvents] = useState<BaseEvent[]>([]);
  const busy = useRef(false);
  const gemmaReady = state.status === 'ready';

  const decide = useCallback(async () => {
    const home = await findHomeServer();
    if (home) {
      setBaseOrigin(home.origin);
      setSession(home.session);
      setRole('base');
      return;
    }
    const saved = await loadPairing();
    setPairing(saved ?? null);
    setRole(saved ? 'field' : 'solo');
  }, []);

  useEffect(() => {
    decide();
  }, [decide]);

  // --- field: talk to the home base whenever there's signal ------------------------
  const sync = useCallback(async () => {
    if (!pairing || busy.current) return;
    busy.current = true;
    try {
      setHello(await fieldApi(pairing).hello());
      setReachable(true);
      await syncFinds(pairing);
    } catch {
      setReachable(false);
    } finally {
      busy.current = false;
      setFinds(await allFinds());
    }
  }, [pairing]);

  useEffect(() => {
    if (role !== 'field') return;
    sync();
    const tick = () => document.visibilityState === 'visible' && sync();
    const timer = setInterval(tick, FIELD_TICK_MS);
    window.addEventListener('online', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [role, sync]);

  // --- base: check in, judge finds one at a time, keep a few quests ready ----------
  useEffect(() => {
    if (role !== 'base' || !baseOrigin) return;
    const api = baseApi(baseOrigin);
    let hasQr = false;
    const log = (text: string) => setEvents((e) => [{ at: Date.now(), text }, ...e].slice(0, 20));

    const tick = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        // The tunnel comes up a few seconds after the server, so keep asking until the QR exists.
        if (!hasQr) {
          const fresh = await api.session();
          setSession(fresh);
          hasQr = !!fresh?.qrSvg;
        }
        const jobs = await api.checkIn(gemmaReady);
        if (!jobs) return;
        setWaiting(jobs.waiting.length);
        if (!gemmaReady) return;
        const next = jobs.waiting[0];
        if (next) {
          setBusyWith(next.quest.title);
          const result = await processFind(client, api, next);
          log(
            result.status === 'hatched'
              ? `${result.creature?.name} hatched from "${next.quest.title}"`
              : result.status === 'not-quite'
                ? `"${next.quest.title}" was not quite it`
                : `Gemma got confused by a "${next.quest.title}" photo`,
          );
        } else if (jobs.questsReady < jobs.questsWanted) {
          setBusyWith('a new quest');
          const titles = (await recentQuests(20)).map((q) => q.title);
          const title = await writeQuestForPhone(client, api, titles);
          if (title) log(`Wrote a quest for later: "${title}"`);
        }
      } catch (err) {
        console.warn('Home base check-in failed', err);
      } finally {
        setBusyWith(null);
        busy.current = false;
      }
    };
    tick();
    const timer = setInterval(tick, BASE_TICK_MS);
    return () => clearInterval(timer);
  }, [role, baseOrigin, client, gemmaReady]);

  const pair = useCallback(async (p: Pairing) => {
    await savePairing(p);
    setPairing(p);
    setReachable(null);
    setRole('field');
  }, []);

  const unpair = useCallback(async () => {
    await savePairing(null);
    setPairing(null);
    setHello(null);
    setRole('solo');
  }, []);

  return (
    <HomeBaseContext
      value={{
        role,
        pairing,
        hello,
        reachable,
        finds,
        sync,
        pair,
        unpair,
        session,
        waiting,
        busyWith,
        events,
      }}
    >
      {children}
    </HomeBaseContext>
  );
}

export function useHomeBase(): HomeBaseValue {
  const ctx = useContext(HomeBaseContext);
  if (!ctx) throw new Error('useHomeBase must be used inside HomeBaseProvider');
  return ctx;
}
