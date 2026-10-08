import { Compass, ListChecks } from 'lucide-react';
import { Link, usePath } from '../app/router';

const MODES = [
  { href: '/quest', label: 'Quest', icon: Compass },
  { href: '/hunt', label: 'Hunt', icon: ListChecks },
];

/** Single quest or scavenger hunt. Plain links, so back and forward just work. */
export function ModeTabs() {
  const path = usePath();
  return (
    <nav aria-label="Mode" className="inline-flex justify-self-start rounded-xl border border-ink-3 bg-ink-2 p-1">
      {MODES.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={path === href || path.startsWith(`${href}/`) ? 'page' : undefined}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-fog transition-colors duration-150 hover:text-snow aria-[current=page]:bg-moss aria-[current=page]:text-moss-ink"
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}
