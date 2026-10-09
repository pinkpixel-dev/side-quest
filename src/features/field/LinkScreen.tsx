import { useEffect, useRef, useState } from 'react';
import { Compass, Link2, Link2Off } from 'lucide-react';
import { LinkButton } from '../../components/Button';
import { useHomeBase } from '../../app/homebase';
import { accountApi } from '../../lib/home/account';

type Status = 'linking' | 'linked' | 'expired' | 'offline' | 'invalid';

/** Landing page for the hosted QR code: `/link#code=…` signs this phone into the laptop's account. */
export function LinkScreen() {
  const { linkedAsPhone } = useHomeBase();
  // Read once at first render: the effect below wipes the hash, and StrictMode runs effects twice.
  const [code] = useState(() => new URLSearchParams(location.hash.replace(/^#/, '')).get('code'));
  const [status, setStatus] = useState<Status>(code ? 'linking' : 'invalid');
  // Codes are single-use, so StrictMode's second effect run must not try again.
  const started = useRef(false);

  useEffect(() => {
    // Don't leave the code sitting in the address bar or history.
    history.replaceState(null, '', '/link');
    if (!code || started.current) return;
    started.current = true;
    accountApi
      .redeem(code)
      .then(linkedAsPhone)
      .then(() => setStatus('linked'))
      .catch((err: { status?: number }) => setStatus(err.status === 410 || err.status === 400 ? 'expired' : 'offline'));
  }, [code, linkedAsPhone]);

  const copy: Record<Status, { title: string; body: string }> = {
    linking: { title: 'Signing in…', body: 'Linking this phone to your home base.' },
    linked: { title: "You're in", body: 'Snap your finds out here. Your computer runs Gemma and sends the creatures back.' },
    expired: { title: 'That code expired', body: 'Codes only last a couple of minutes. Scan the new one on your computer.' },
    offline: { title: "Can't reach Side Quest", body: 'Check your signal, then scan the code again.' },
    invalid: { title: 'That link is missing its code', body: 'Scan the QR code on your computer again.' },
  };
  const ok = status === 'linked';
  const Icon = ok || status === 'linking' ? Link2 : Link2Off;

  return (
    <div className="grid max-w-lg gap-5" role="status" aria-live="polite">
      <Icon className={`size-10 ${ok ? 'text-moss' : 'text-fog'}`} aria-hidden />
      <h1 className="text-4xl font-extrabold tracking-tight">{copy[status].title}</h1>
      <p className="text-lg text-fog">{copy[status].body}</p>
      {ok && (
        <LinkButton href="/quest" icon={<Compass className="size-5" aria-hidden />} className="justify-self-start text-lg">
          Start a quest
        </LinkButton>
      )}
    </div>
  );
}
