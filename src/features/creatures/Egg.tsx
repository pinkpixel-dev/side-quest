/** The mystery egg shown while Gemma looks at the photo and right before a creature hatches. */
export function Egg({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" aria-hidden className={className}>
      <ellipse cx={100} cy={176} rx={42} ry={7} fill="oklch(0 0 0 / 0.28)" />
      <path
        d="M100,36 C136,36 152,96 152,124 C152,154 128,172 100,172 C72,172 48,154 48,124 C48,96 64,36 100,36Z"
        fill="oklch(0.94 0.028 95)"
        stroke="oklch(0.22 0.02 130)"
        strokeWidth={3.2}
      />
      <circle cx={82} cy={92} r={7} fill="oklch(0.86 0.17 128)" />
      <circle cx={118} cy={120} r={9} fill="oklch(0.86 0.17 128)" />
      <circle cx={88} cy={142} r={5} fill="oklch(0.8 0.1 5)" />
      <circle cx={122} cy={78} r={4} fill="oklch(0.8 0.1 5)" />
    </svg>
  );
}
