import { Camera, Compass, Egg } from 'lucide-react';

const STEPS = [
  { icon: Compass, title: 'Get a quest', text: 'Gemma writes a tiny task for wherever you are.' },
  { icon: Camera, title: 'Find it, snap it', text: 'Go outside and take a photo of what you found.' },
  { icon: Egg, title: 'Hatch something', text: 'If Gemma agrees, a creature hatches from your photo.' },
];

/** How a quest goes, as stops along one dashed trail: down the side on phones, across on desktop. */
export function TrailSteps() {
  return (
    <section aria-labelledby="how-it-goes" className="grid gap-6">
      <h2 id="how-it-goes" className="text-2xl font-extrabold tracking-tight">
        How it goes
      </h2>
      <ol className="relative grid gap-8 before:absolute before:top-6 before:bottom-6 before:left-6 before:border-l-2 before:border-dashed before:border-ink-3 md:grid-cols-3 md:gap-6 md:before:top-6 md:before:right-[calc(33.333%-1rem)] md:before:bottom-auto md:before:left-6 md:before:border-t-2 md:before:border-l-0">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="relative grid grid-cols-[3rem_minmax(0,1fr)] items-start gap-4 md:grid-cols-1">
            <span className="grid size-12 place-items-center rounded-full border-2 border-moss bg-ink text-moss">
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="grid gap-1 pt-1 md:pt-0">
              <span className="font-mono text-xs text-fog">Stop {i + 1}</span>
              <span className="font-display text-xl font-bold">{title}</span>
              <span className="max-w-xs text-fog">{text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
