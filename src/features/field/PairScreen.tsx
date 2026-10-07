import { useEffect, useState } from 'react';
import { Compass, Link2, Link2Off } from 'lucide-react';
import { LinkButton } from '../../components/Button';
import { useHomeBase } from '../../app/homebase';
import { fieldApi, pairingFromHash } from '../../lib/home/client';

type Status = 'pairing' | 'paired' | 'unreachable' | 'invalid';

/** Landing page for the QR code: `/pair#token=…` (and `&base=…` when served from the deployed site). */
export function PairScreen() {
  const { pair } = useHomeBase();
  // Read once at first render: the effect below wipes the hash, and StrictMode runs effects twice.
  const [pairing] = useState(() => pairingFromHash(location.hash, location.origin));
  const [status, setStatus] = useState<Status>(pairing ? 'pairing' : 'invalid');

  useEffect(() => {
    // Don't leave the token sitting in the address bar or history.
    history.replaceState(null, '', '/pair');
    if (!pairing) return;
    fieldApi(pairing)
      .hello()
      .then(async () => {
        await pair(pairing);
        setStatus('paired');
      })
      .catch(() => setStatus('unreachable'));
  }, [pair, pairing]);

  const copy: Record<Status, { title: string; body: string }> = {
    pairing: { title: 'Pairing…', body: 'Saying hi to your home base.' },
    paired: {
      title: 'Paired',
      body: 'Snap your finds out here. Your home base runs Gemma and sends the creatures back.',
    },
    unreachable: {
      title: "Can't reach home base",
      body: 'Make sure home base is still running on your computer, wait a few seconds, then scan the QR again.',
    },
    invalid: { title: 'That link is missing its key', body: 'Scan the QR code from your home base again.' },
  };
  const ok = status === 'paired';
  const Icon = status === 'unreachable' || status === 'invalid' ? Link2Off : Link2;

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
