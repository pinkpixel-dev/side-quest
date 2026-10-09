import { useState } from 'react';
import { Laptop, LogIn, LogOut, QrCode, Smartphone, Trash2 } from 'lucide-react';
import { Button, LinkButton, buttonClass } from '../../components/Button';
import { useHomeBase } from '../../app/homebase';
import { navigate } from '../../app/router';
import { GITHUB_SIGN_IN_URL, type DeviceRole } from '../../lib/home/account';

const ROLES: { role: DeviceRole; label: string; icon: typeof Laptop }[] = [
  { role: 'base', label: 'Home base', icon: Laptop },
  { role: 'field', label: 'Phone', icon: Smartphone },
];

export function AccountScreen() {
  const { account, setDeviceRole, signOut, deleteAccount } = useHomeBase();
  const [busy, setBusy] = useState<'out' | 'delete' | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const failed = new URLSearchParams(location.search).get('signin') === 'failed';

  const run = async (kind: 'out' | 'delete', action: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await action();
      navigate('/', { replace: true });
    } catch (err) {
      setError((err as Error).message || 'That didn’t work. Check your connection and try again.');
      setBusy(null);
    }
  };

  if (!account) {
    return (
      <div className="grid max-w-xl gap-6">
        <h1 className="text-4xl font-extrabold tracking-tight">Account</h1>
        <p className="text-lg text-fog">Sign in on your computer, then scan a code with your phone. Gemma stays on your computer.</p>
        {failed && (
          <p className="text-blush" role="alert">
            GitHub sign-in didn’t go through. Try again.
          </p>
        )}
        {/* A real navigation, not the in-app router: GitHub takes over the page. */}
        <a href={GITHUB_SIGN_IN_URL} className={buttonClass('primary', 'justify-self-start text-lg')}>
          <LogIn className="size-5" aria-hidden />
          Sign in with GitHub
        </a>
      </div>
    );
  }

  const { user, role } = account;
  return (
    <div className="grid max-w-xl gap-10">
      <section className="grid gap-5">
        <h1 className="text-4xl font-extrabold tracking-tight">Account</h1>
        <div className="flex items-center gap-4">
          {user.avatarUrl && <img src={user.avatarUrl} alt="" className="size-14 rounded-full border border-ink-3" />}
          <div className="grid">
            <span className="text-xl font-semibold">{user.name ?? user.login}</span>
            <span className="font-mono text-sm text-fog">@{user.login}</span>
          </div>
        </div>
      </section>

      <section className="grid gap-3">
        <h2 id="device-role" className="text-xl font-semibold">
          This device
        </h2>
        <div role="group" aria-labelledby="device-role" className="flex flex-wrap gap-2">
          {ROLES.map(({ role: r, label, icon: Icon }) => (
            <Button
              key={r}
              variant={role === r ? 'primary' : 'secondary'}
              aria-pressed={role === r}
              icon={<Icon className="size-5" aria-hidden />}
              onClick={() => setDeviceRole(r)}
            >
              {label}
            </Button>
          ))}
        </div>
        {role === 'base' && (
          <LinkButton href="/base" variant="ghost" icon={<QrCode className="size-5" aria-hidden />} className="justify-self-start">
            Sign in your phone
          </LinkButton>
        )}
      </section>

      <section className="grid gap-3">
        <Button variant="secondary" className="justify-self-start" loading={busy === 'out'} disabled={!!busy} icon={<LogOut className="size-5" aria-hidden />} onClick={() => run('out', signOut)}>
          Sign out
        </Button>
        {!confirming ? (
          <Button variant="ghost" className="justify-self-start" disabled={!!busy} icon={<Trash2 className="size-5" aria-hidden />} onClick={() => setConfirming(true)}>
            Delete account
          </Button>
        ) : (
          <div className="grid gap-3 rounded-2xl border border-blush/40 p-5">
            <p>This deletes your account and every photo stored with it, on every device. Creatures already on your devices stay.</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="danger"
                loading={busy === 'delete'}
                disabled={!!busy}
                icon={<Trash2 className="size-5" aria-hidden />}
                onClick={() => run('delete', deleteAccount)}
              >
                Delete everything
              </Button>
              <Button variant="ghost" disabled={!!busy} onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
        {error && (
          <p className="text-blush" role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
