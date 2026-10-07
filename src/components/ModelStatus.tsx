import { CircleAlert, CloudOff, Download, LoaderCircle, Radio, Sparkles } from 'lucide-react';
import { GAME_MODEL_BYTES, useGemma } from '../app/gemma';
import { useHomeBase } from '../app/homebase';
import { formatBytes } from '../lib/gemma/models';

/** Small, unobtrusive Gemma state. Becomes the download button when the model isn't cached yet. */
export function ModelStatus({ className = '' }: { className?: string }) {
  const { state, supported, wake } = useGemma();
  const { role, reachable, hello } = useHomeBase();
  const pill = `inline-flex min-h-10 items-center gap-2 rounded-full border border-ink-3 bg-ink-2 px-4 text-sm ${className}`;

  // A paired phone doesn't run Gemma: show the link to home base instead.
  if (role === 'field') {
    const [Icon, text, tip] =
      reachable === null
        ? [LoaderCircle, 'Checking home base…', '']
        : !reachable
          ? [CloudOff, 'No signal · finds will wait', 'Photos stay queued on this phone and send when you are back online.']
          : hello?.baseOnline
            ? [Radio, 'Home base online', 'Gemma is ready at home.']
            : [CloudOff, 'Home base tab closed', 'Finds will wait until the Side Quest tab on your computer is open.'];
    return (
      <p className={`${pill} text-fog`} role="status" title={tip || undefined}>
        <Icon className={`size-4 ${reachable && hello?.baseOnline ? 'text-moss' : 'text-fog'} ${reachable === null ? 'animate-spin' : ''}`} aria-hidden />
        {text}
      </p>
    );
  }

  if (!supported) {
    return (
      <p className={`${pill} text-fog`} title="Gemma runs on your GPU through WebGPU. Try desktop Chrome or Edge.">
        <CircleAlert className="size-4 text-blush" aria-hidden />
        Gemma needs WebGPU
      </p>
    );
  }

  switch (state.status) {
    case 'off':
      return (
        <button
          type="button"
          onClick={wake}
          className={`${pill} text-snow transition-colors duration-150 hover:border-moss/60 hover:bg-ink-3`}
          title="Downloads once, then stays cached in this browser. Wi-Fi recommended."
        >
          <Download className="size-4 text-moss" aria-hidden />
          Wake Gemma
          <span className="font-mono text-xs text-fog">{formatBytes(GAME_MODEL_BYTES)}</span>
        </button>
      );
    case 'loading': {
      const pct = state.total ? Math.round((state.loaded / state.total) * 100) : 0;
      return (
        <p className={`${pill} text-fog`} role="status" aria-live="polite">
          <LoaderCircle className="size-4 animate-spin text-moss" aria-hidden />
          {state.total ? `Waking Gemma… ${pct}%` : 'Waking Gemma…'}
        </p>
      );
    }
    case 'ready':
      return (
        <p className={`${pill} text-fog`} role="status">
          <Sparkles className="size-4 text-moss" aria-hidden />
          Gemma ready
        </p>
      );
    case 'error':
      return (
        <button
          type="button"
          onClick={wake}
          className={`${pill} text-fog hover:bg-ink-3`}
          title={state.message}
        >
          <CircleAlert className="size-4 text-blush" aria-hidden />
          Gemma couldn't start · Retry
        </button>
      );
  }
}
