import { useId } from 'react';
import { between, pick, seededRandom } from '../../lib/random';
import type { Creature } from './creatureSchemas';
import { CENTER, bodyShape, starPath } from './shapes';

const INK = 'oklch(0.22 0.02 130)';
const CHEEK = 'oklch(0.78 0.11 5)';
const LEAF = 'oklch(0.7 0.15 138)';
const BARK = 'oklch(0.5 0.07 60)';
const STONE = 'oklch(0.72 0.01 90)';
const STROKE = { stroke: INK, strokeWidth: 3.2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

export type CreatureLook = Pick<Creature, 'body' | 'eyeStyle' | 'accessory' | 'palette' | 'seed' | 'rarity' | 'name'>;

interface Props {
  creature: CreatureLook;
  className?: string;
  /** Gentle idle bob. Off in grids so a full collection isn't a wall of motion. */
  animate?: boolean;
}

/** Layered SVG creature: shadow, feet, body, belly, spots, face, accessory, rarity extras. */
export function CreatureRenderer({ creature, className = '', animate = false }: Props) {
  const clipId = useId();
  const { body, eyeStyle, accessory, palette, seed, rarity } = creature;
  const shape = bodyShape(body, seed);
  const rand = seededRandom(seed);
  const [cx, cy] = CENTER;

  const eyeY = cy - shape.ry * between(rand, 0.05, 0.25);
  const eyeGap = shape.rx * between(rand, 0.3, 0.42);
  const eyeR = between(rand, 5.5, 8);
  const mouth = pick(rand, ['smile', 'cat', 'o'] as const);
  const spots = Math.floor(between(rand, 0, 4));
  const headX = cx + between(rand, -12, 12);
  const tilt = between(rand, -25, 25);

  return (
    <svg viewBox="0 0 200 200" role="img" aria-label={`${creature.name}, a ${body} creature`} className={className}>
      <defs>
        <clipPath id={clipId}>
          <path d={shape.path} />
        </clipPath>
      </defs>

      <ellipse cx={cx} cy={shape.bottom + 7} rx={shape.rx * 0.75} ry={7} fill="oklch(0 0 0 / 0.28)" />

      <g className={animate ? 'anim-bob' : undefined}>
        {/* Feet sit behind the body so it overlaps them. */}
        {[-1, 1].map((side) => (
          <ellipse
            key={side}
            cx={cx + side * shape.rx * 0.42}
            cy={shape.bottom - 3}
            rx={11}
            ry={7.5}
            fill={palette.primary}
            {...STROKE}
          />
        ))}

        {body === 'sprout' && <SproutTop x={cx} y={shape.top + 4} />}

        <path d={shape.path} fill={palette.primary} />
        <g clipPath={`url(#${clipId})`}>
          <ellipse cx={cx} cy={cy + shape.ry * 0.45} rx={shape.rx * 0.6} ry={shape.ry * 0.5} fill={palette.secondary} />
          {Array.from({ length: spots }, (_, i) => (
            <circle
              key={i}
              cx={cx + between(rand, -shape.rx, shape.rx) * 0.8}
              cy={cy + between(rand, -shape.ry, 0) * 0.8}
              r={between(rand, 4, 9)}
              fill={palette.accent}
              opacity={0.6}
            />
          ))}
          {rarity === 'uncommon' && (
            <ellipse
              cx={cx}
              cy={cy + shape.ry * 0.45}
              rx={shape.rx * 0.6}
              ry={shape.ry * 0.5}
              fill="none"
              stroke={palette.accent}
              strokeWidth={4}
            />
          )}
        </g>
        <path d={shape.path} fill="none" {...STROKE} />

        {[-1, 1].map((side) => (
          <ellipse
            key={side}
            cx={cx + side * (eyeGap + eyeR * 1.4)}
            cy={eyeY + eyeR * 2.2}
            rx={7}
            ry={4.5}
            fill={CHEEK}
            opacity={0.75}
          />
        ))}
        {[-1, 1].map((side) => (
          <Eye key={side} x={cx + side * eyeGap} y={eyeY} r={eyeR} style={eyeStyle} />
        ))}
        <Mouth x={cx} y={eyeY + eyeR + 11} kind={mouth} />

        {!(body === 'sprout' && accessory === 'leaf') && (
          <Accessory kind={accessory} x={body === 'sprout' ? cx + 22 : headX} y={shape.top + 6} tilt={tilt} accent={palette.accent} />
        )}
      </g>

      {rarity === 'rare' &&
        [
          [34, 52, 9],
          [168, 70, 7],
          [158, 150, 6],
          [42, 140, 5],
        ].map(([x, y, r], i) => (
          <path
            key={i}
            d={starPath(x, y, r)}
            fill={palette.accent}
            className="anim-twinkle"
            style={{ animationDelay: `${i * 0.4}s` }}
          />
        ))}
    </svg>
  );
}

function Eye({ x, y, r, style }: { x: number; y: number; r: number; style: Creature['eyeStyle'] }) {
  switch (style) {
    case 'sleepy':
      return <path d={`M${x - r},${y} Q${x},${y + r * 1.1} ${x + r},${y}`} fill="none" {...STROKE} />;
    case 'wide':
      return (
        <g>
          <circle cx={x} cy={y} r={r * 1.45} fill="oklch(0.98 0.005 95)" {...STROKE} strokeWidth={2.5} />
          <circle cx={x} cy={y + 1} r={r * 0.75} fill={INK} />
          <circle cx={x + r * 0.3} cy={y - r * 0.2} r={r * 0.25} fill="white" />
        </g>
      );
    case 'sparkle':
      return (
        <g>
          <circle cx={x} cy={y} r={r * 1.05} fill={INK} />
          <path d={starPath(x + r * 0.35, y - r * 0.35, r * 0.55)} fill="white" />
          <circle cx={x - r * 0.4} cy={y + r * 0.45} r={r * 0.18} fill="white" />
        </g>
      );
    default:
      return (
        <g>
          <circle cx={x} cy={y} r={r * 0.85} fill={INK} />
          <circle cx={x + r * 0.3} cy={y - r * 0.3} r={r * 0.28} fill="white" />
        </g>
      );
  }
}

function Mouth({ x, y, kind }: { x: number; y: number; kind: 'smile' | 'cat' | 'o' }) {
  if (kind === 'o') return <ellipse cx={x} cy={y + 1} rx={4} ry={5} fill={INK} />;
  if (kind === 'cat')
    return <path d={`M${x - 8},${y - 1} Q${x - 4},${y + 5} ${x},${y} Q${x + 4},${y + 5} ${x + 8},${y - 1}`} fill="none" {...STROKE} strokeWidth={2.6} />;
  return <path d={`M${x - 7},${y - 1} Q${x},${y + 7} ${x + 7},${y - 1}`} fill="none" {...STROKE} strokeWidth={2.8} />;
}

function SproutTop({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path d={`M${x},${y + 6} C${x - 2},${y - 8} ${x + 2},${y - 14} ${x},${y - 22}`} fill="none" {...STROKE} stroke={LEAF} strokeWidth={4} />
      <path d={`M${x},${y - 18} C${x - 10},${y - 34} ${x - 30},${y - 30} ${x - 32},${y - 22} C${x - 22},${y - 12} ${x - 8},${y - 12} ${x},${y - 18}Z`} fill={LEAF} {...STROKE} />
      <path d={`M${x},${y - 20} C${x + 8},${y - 36} ${x + 26},${y - 34} ${x + 28},${y - 26} C${x + 20},${y - 16} ${x + 8},${y - 14} ${x},${y - 20}Z`} fill={LEAF} {...STROKE} />
    </g>
  );
}

function Accessory({ kind, x, y, tilt, accent }: { kind: Creature['accessory']; x: number; y: number; tilt: number; accent: string }) {
  const t = `rotate(${tilt} ${x} ${y})`;
  switch (kind) {
    case 'leaf':
      return (
        <g transform={t}>
          <path d={`M${x},${y} C${x - 14},${y - 10} ${x - 10},${y - 30} ${x},${y - 36} C${x + 10},${y - 30} ${x + 14},${y - 10} ${x},${y}Z`} fill={LEAF} {...STROKE} />
          <path d={`M${x},${y - 3} V${y - 28}`} stroke={INK} strokeWidth={2} strokeLinecap="round" />
        </g>
      );
    case 'flower':
      return (
        <g transform={t}>
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx={x} cy={y - 18} rx={6} ry={9} transform={`rotate(${a} ${x} ${y - 10})`} fill={accent} {...STROKE} strokeWidth={2.4} />
          ))}
          <circle cx={x} cy={y - 10} r={5.5} fill="oklch(0.88 0.15 90)" {...STROKE} strokeWidth={2.4} />
        </g>
      );
    case 'twig':
      return (
        <g transform={t} fill="none" {...STROKE} stroke={BARK} strokeWidth={4.5}>
          <path d={`M${x},${y + 2} L${x + 2},${y - 30}`} />
          <path d={`M${x + 1},${y - 16} L${x + 12},${y - 26}`} />
          <ellipse cx={x + 14} cy={y - 30} rx={5} ry={3.5} fill={LEAF} stroke={INK} strokeWidth={2.4} />
        </g>
      );
    case 'mushroom':
      return (
        <g transform={t}>
          <rect x={x - 5} y={y - 16} width={10} height={18} rx={4} fill="oklch(0.95 0.02 90)" {...STROKE} strokeWidth={2.6} />
          <path d={`M${x - 20},${y - 14} C${x - 20},${y - 36} ${x + 20},${y - 36} ${x + 20},${y - 14}Z`} fill="oklch(0.66 0.17 30)" {...STROKE} strokeWidth={2.6} />
          <circle cx={x - 8} cy={y - 23} r={3} fill="white" />
          <circle cx={x + 6} cy={y - 27} r={2.5} fill="white" />
        </g>
      );
    case 'stone':
      return (
        <g transform={t}>
          <path d={`M${x - 15},${y + 1} C${x - 17},${y - 16} ${x + 14},${y - 20} ${x + 15},${y - 2} C${x + 8},${y + 4} ${x - 8},${y + 4} ${x - 15},${y + 1}Z`} fill={STONE} {...STROKE} strokeWidth={2.6} />
          <path d={`M${x - 6},${y - 9} q5,-3 9,0`} stroke="white" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.7} />
        </g>
      );
    default:
      // No accessory: a little antenna instead, so every creature has something up top.
      return (
        <g transform={t}>
          <path d={`M${x},${y + 4} Q${x - 4},${y - 12} ${x + 2},${y - 22}`} fill="none" {...STROKE} strokeWidth={2.8} />
          <circle cx={x + 2} cy={y - 24} r={5} fill={accent} {...STROKE} strokeWidth={2.6} />
        </g>
      );
  }
}
