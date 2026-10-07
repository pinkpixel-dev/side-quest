import type { ReactNode } from 'react';
import { Compass, Info, LayoutGrid } from 'lucide-react';
import { Link, matchPath, usePath } from './router';
import { HomeScreen } from '../features/quests/HomeScreen';
import { QuestScreen } from '../features/quests/QuestScreen';
import { ProofScreen } from '../features/proof/ProofScreen';
import { UnlockScreen } from '../features/creatures/UnlockScreen';
import { CollectionScreen } from '../features/collection/CollectionScreen';
import { CreatureDetail } from '../features/collection/CreatureDetail';
import { AboutScreen } from './AboutScreen';

const NAV = [
  { href: '/quest', label: 'Quest', icon: Compass, active: ['/quest', '/proof', '/unlock'] },
  { href: '/collection', label: 'Creatures', icon: LayoutGrid, active: ['/collection', '/creature'] },
  { href: '/about', label: 'About', icon: Info, active: ['/about'] },
];

function route(path: string): ReactNode {
  let p: Record<string, string> | null;
  if (path === '/') return <HomeScreen />;
  if (path === '/quest') return <QuestScreen />;
  if (path === '/proof') return <ProofScreen />;
  if (path === '/collection') return <CollectionScreen />;
  if (path === '/about') return <AboutScreen />;
  if ((p = matchPath('/unlock/:id', path))) return <UnlockScreen key={p.id} id={p.id} />;
  if ((p = matchPath('/creature/:id', path))) return <CreatureDetail key={p.id} id={p.id} />;
  return <p className="text-fog">Nothing out here. Try the quest page.</p>;
}

export function App() {
  const path = usePath();
  const isActive = (prefixes: string[]) => prefixes.some((pre) => path === pre || path.startsWith(`${pre}/`));

  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr_auto] md:grid-rows-[auto_1fr]">
      <header className="flex items-center justify-between gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2 sm:px-8 md:py-5">
        <Link href="/" className="rounded-md font-display text-xl font-extrabold tracking-tight">
          Side Quest
        </Link>
        <nav aria-label="Main" className="hidden gap-1 md:flex">
          {NAV.map(({ href, label, icon: Icon, active }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(active) ? 'page' : undefined}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-fog transition-colors duration-150 hover:bg-ink-2 hover:text-snow aria-[current=page]:text-snow aria-[current=page]:bg-ink-2"
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="w-full px-4 py-6 sm:px-8 lg:py-10">{route(path)}</main>

      {/* Phone nav sits at the bottom where thumbs are. */}
      <nav
        aria-label="Main"
        className="sticky bottom-0 grid grid-cols-3 border-t border-ink-3 bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {NAV.map(({ href, label, icon: Icon, active }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(active) ? 'page' : undefined}
            className="grid min-h-16 place-items-center content-center gap-1 text-xs text-fog aria-[current=page]:text-moss"
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
