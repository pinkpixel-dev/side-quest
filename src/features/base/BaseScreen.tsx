import { LoaderCircle, Radio, ScrollText } from 'lucide-react';
import { ModelStatus } from '../../components/ModelStatus';
import { useGemma } from '../../app/gemma';
import { useHomeBase } from '../../app/homebase';

const time = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** The laptop side: pairing QR, Gemma state, and what's happening with the phone's finds. */
export function BaseScreen() {
  const { session, waiting, busyWith, events } = useHomeBase();
  const { state } = useGemma();

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-14">
      <section className="grid content-start gap-4">
        <h1 className="text-4xl font-extrabold tracking-tight">Home base</h1>
        <p className="text-fog">Scan with your phone camera. Leave this tab open and Gemma handles the rest.</p>
        <div className="paper grid aspect-square place-items-center rounded-3xl p-5">
          {session?.qrSvg ? (
            // Our own server rendered this SVG from the pairing URL.
            <div className="w-full [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: session.qrSvg }} />
          ) : (
            <p className="flex items-center gap-2 text-bark-2" role="status">
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              Opening the tunnel…
            </p>
          )}
        </div>
        {session?.pairUrl && (
          <details className="text-sm text-fog">
            <summary className="cursor-pointer rounded hover:text-snow">Pairing link</summary>
            <p className="mt-2 break-all font-mono text-xs">{session.pairUrl}</p>
          </details>
        )}
      </section>

      <section className="grid content-start gap-6 lg:pt-14">
        <div className="flex flex-wrap items-center gap-3">
          <ModelStatus />
          <p className="inline-flex min-h-10 items-center gap-2 rounded-full border border-ink-3 bg-ink-2 px-4 text-sm text-fog">
            <Radio className="size-4 text-moss" aria-hidden />
            {waiting === 1 ? '1 find waiting' : `${waiting} finds waiting`}
          </p>
        </div>
        {state.status !== 'ready' && waiting > 0 && <p className="text-blush">Wake Gemma so your finds can hatch.</p>}
        {busyWith && (
          <p className="flex items-center gap-2 text-lg" role="status">
            <LoaderCircle className="size-5 animate-spin text-moss" aria-hidden />
            Gemma is working on {busyWith}…
          </p>
        )}

        <div className="grid gap-3">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <ScrollText className="size-5 text-fog" aria-hidden />
            Field log
          </h2>
          {events.length === 0 ? (
            <p className="text-fog">Quiet so far.</p>
          ) : (
            <ul className="grid gap-2">
              {events.map((e) => (
                <li key={e.at} className="flex gap-4 border-b border-ink-3 pb-2 last:border-0">
                  <span className="shrink-0 font-mono text-sm text-fog">{time(e.at)}</span>
                  <span>{e.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
