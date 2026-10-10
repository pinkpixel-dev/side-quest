import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { allFinds, allHunts, type LocalFind } from '../lib/db/database';
import { baseApi, fieldApi, findHomeServer, loadPairing, savePairing, type Pairing } from '../lib/home/client';
import { HOSTED_PAIRING, accountApi, loadAccount, saveAccount, type Account, type DeviceRole } from '../lib/home/account';
import type { BaseSession, HelloResponse } from '../lib/home/protocol';
import { processFind, processHunt, writeHuntForPhone, writeQuestForPhone } from '../features/base/baseWorker';
import { syncHunts } from '../features/hunts/huntSync';
import type { Hunt } from '../features/hunts/huntSchemas';
import { syncFinds } from '../features/field/fieldSync';
import { syncCollection } from '../features/collection/collectionSync';
import { useGemma } from './gemma';

/**
 * solo  - this device runs Gemma and does everything itself
 * base  - runs Gemma for the phone (and can still play solo): either the laptop next to
 *         `npm run home`, or a signed-in device on the hosted site
 * field - the phone: quests + camera, Gemma's work happens at home. Paired to `npm run home`,
 *         or signed in on the hosted site
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
  /** Field hunts that are on their way home or back with news. */
  hunts: Hunt[];
  sync(): Promise<void>;
  pair(p: Pairing): Promise<void>;
  unpair(): Promise<void>;
  // hosted site
  /** Signed in on the hosted site. null when signed out or using `npm run home`. */
  account: Account | null;
  /** The phone just redeemed a QR code: remember the account and become a field device. */
  linkedAsPhone(): Promise<void>;
  setDeviceRole(role: DeviceRole): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
  // base
  /** `npm run home` only: the pairing QR from the local server. */
  session: BaseSession | null;
  waiting: number;
  busyWith: string | null;
  events: BaseEvent[];
}

const HomeBaseContext = createContext<HomeBaseValue | null>(null);
const BASE_TICK_MS = 4_000;
/** Nothing to do last time: check less often. Every check-in on the hosted site is a request. */
const BASE_IDLE_MS = 20_000;
const FIELD_TICK_MS = 10_000;
/** Collection sync is cheap when nothing changed (one small list), but there's no rush either. */
const COLLECTION_TICK_MS = 5 * 60_000;

export function HomeBaseProvider({ children }: { children: ReactNode }) {
  const { client, state } = useGemma();
  const [role, setRole] = useState<Role>('checking');
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [hello, setHello] = useState<HelloResponse | null>(null);
  const [reachable, setReachable] = useState<boolean | null>(null);
  const [finds, setFinds] = useState<LocalFind[]>([]);
  const [hunts, setHunts] = useState<Hunt[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  /** '' on the hosted site (same origin), the local server's origin with `npm run home`. */
  const [baseOrigin, setBaseOrigin] = useState<string | null>(null);
  const [session, setSession] = useState<BaseSession | null>(null);
  const [waiting, setWaiting] = useState(0);
  const [busyWith, setBusyWith] = useState<string | null>(null);
  const [events, setEvents] = useState<BaseEvent[]>([]);
  const busy = useRef(false);
  const gemmaReady = state.status === 'ready';

  const applyAccount = useCallback((a: Account) => {
    setAccount(a);
    if (a.role === 'base') {
      setPairing(null);
      setSession(null);
      setBaseOrigin('');
      setRole('base');
    } else {
      setBaseOrigin(null);
      setPairing(HOSTED_PAIRING);
      setReachable(null);
      setRole('field');
    }
  }, []);

  /** Signed out: back to a `npm run home` pairing if this phone has one, otherwise solo. */
  const signedOut = useCallback(async () => {
    await saveAccount(null);
    setAccount(null);
    setBaseOrigin(null);
    setHello(null);
    const saved = await loadPairing();
    setPairing(saved ?? null);
    setRole(saved ? 'field' : 'solo');
  }, []);

  const decide = useCallback(async () => {
    const home = await findHomeServer();
    if (home) {
      setBaseOrigin(home.origin);
      setSession(home.session);
      setRole('base');
      return;
    }
    // Start from what this device remembers, so a phone with no signal still works.
    const saved = await loadAccount();
    if (saved) applyAccount(saved);
    else {
      const pairing = await loadPairing();
      setPairing(pairing ?? null);
      setRole(pairing ? 'field' : 'solo');
    }
    // The link page signs in on its own as a phone. Checking here too could race it and pick 'base'.
    if (location.pathname === '/link') return;
    // Then ask the site: picks up a fresh GitHub sign-in, or a sign-out from elsewhere.
    try {
      const user = await accountApi.me();
      if (user) {
        // Signing in with GitHub makes this device the home base. A QR-linked phone saved 'field' already.
        const next: Account = { user, role: saved?.role ?? 'base' };
        await saveAccount(next);
        applyAccount(next);
      } else if (saved) await signedOut();
    } catch {
      // Offline, or no hosted API here (`npm run home`, plain `vite`). Keep what we had.
    }
  }, [applyAccount, signedOut]);

  useEffect(() => {
    decide();
  }, [decide]);

  // --- signed in: the collection follows the account to every device ----------------
  const userId = account?.user.id;
  useEffect(() => {
    if (!userId) return;
    let running = false;
    const run = async () => {
      if (running || document.visibilityState !== 'visible') return;
      running = true;
      try {
        await syncCollection();
      } catch (err) {
        console.warn('Collection sync failed', err);
      } finally {
        running = false;
      }
    };
    run();
    const timer = setInterval(run, COLLECTION_TICK_MS);
    document.addEventListener('visibilitychange', run);
    window.addEventListener('online', run);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', run);
      window.removeEventListener('online', run);
    };
  }, [userId]);

  // --- field: talk to the home base whenever there's signal ------------------------
  const sync = useCallback(async () => {
    if (!pairing || busy.current) return;
    busy.current = true;
    try {
      setHello(await fieldApi(pairing).hello());
      setReachable(true);
      await syncFinds(pairing);
      await syncHunts(pairing);
    } catch {
      setReachable(false);
    } finally {
      busy.current = false;
      setFinds(await allFinds());
      setHunts((await allHunts()).filter((h) => h.status === 'queued' || h.status === 'waiting' || h.seen === false));
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
    if (role !== 'base' || baseOrigin === null) return;
    const api = baseApi(baseOrigin);
    const hosted = baseOrigin === '';
    // The hosted base makes its own QR (see PhoneLinkQr), so it never asks for a local session.
    let hasQr = hosted;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const log = (text: string) => setEvents((e) => [{ at: Date.now(), text }, ...e].slice(0, 20));

    /** Returns true when there was something to do, so the next check comes sooner. */
    const tick = async (): Promise<boolean> => {
      if (busy.current) return true;
      busy.current = true;
      let worked = false;
      try {
        // The tunnel comes up a few seconds after the server, so keep asking until the QR exists.
        if (!hasQr) {
          const fresh = await api.session();
          setSession(fresh);
          hasQr = !!fresh?.qrSvg;
        }
        const jobs = await api.checkIn(gemmaReady);
        if (!jobs) return false;
        setWaiting(jobs.waiting.length + jobs.huntsWaiting.length);
        if (!gemmaReady) return false;
        const next = jobs.waiting[0];
        worked = !!next || !!jobs.huntsWaiting[0] || jobs.questsReady < jobs.questsWanted || jobs.huntsReady < jobs.huntsWanted;
        const hunt = jobs.huntsWaiting[0];
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
        } else if (hunt) {
          setBusyWith(`the "${hunt.title}" hunt`);
          const result = await processHunt(client, api, hunt);
          const found = result.items.filter((i) => i.found).length;
          log(
            result.creature
              ? `${result.creature.name} hatched from the "${hunt.title}" hunt (${found}/${hunt.items.length} found)`
              : `"${hunt.title}" hunt checked: ${found}/${hunt.items.length} found`,
          );
        } else if (jobs.questsReady < jobs.questsWanted) {
          setBusyWith('a new quest');
          const title = await writeQuestForPhone(client, api, jobs.context);
          if (title) log(`Wrote a quest for later: "${title}"`);
        } else if (jobs.huntsReady < jobs.huntsWanted) {
          setBusyWith('a new hunt list');
          const title = await writeHuntForPhone(client, api, jobs.context);
          if (title) log(`Wrote a hunt for later: "${title}"`);
        }
      } catch (err) {
        console.warn('Home base check-in failed', err);
      } finally {
        setBusyWith(null);
        busy.current = false;
      }
      return worked;
    };
    const loop = async () => {
      const worked = await tick();
      if (!stopped) timer = setTimeout(loop, worked || !hasQr ? BASE_TICK_MS : BASE_IDLE_MS);
    };
    loop();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
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

  const linkedAsPhone = useCallback(async () => {
    const user = await accountApi.me();
    if (!user) throw new Error('Signed out');
    const next: Account = { user, role: 'field' };
    await saveAccount(next);
    applyAccount(next);
  }, [applyAccount]);

  const setDeviceRole = useCallback(
    async (deviceRole: DeviceRole) => {
      if (!account) return;
      const next = { ...account, role: deviceRole };
      await saveAccount(next);
      applyAccount(next);
    },
    [account, applyAccount],
  );

  const signOut = useCallback(async () => {
    await accountApi.signOut();
    await signedOut();
  }, [signedOut]);

  const deleteAccount = useCallback(async () => {
    await accountApi.deleteAccount();
    await signedOut();
  }, [signedOut]);

  return (
    <HomeBaseContext
      value={{
        role,
        pairing,
        hello,
        reachable,
        finds,
        hunts,
        sync,
        pair,
        unpair,
        account,
        linkedAsPhone,
        setDeviceRole,
        signOut,
        deleteAccount,
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
