import { between, seededRandom } from '../../lib/random';
import type { CreatureBody } from './creatureSchemas';

export type Point = [number, number];

export const CENTER: Point = [100, 120];

/** Closed Catmull-Rom spline through the points, as SVG cubic Beziers. Gives soft, squishy outlines. */
export function smoothClosedPath(points: Point[]): string {
  const n = points.length;
  const at = (i: number) => points[(i + n) % n];
  let d = `M${at(0)[0].toFixed(1)},${at(0)[1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1: Point = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Point = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return `${d}Z`;
}

export interface BodyShape {
  path: string;
  /** Outline points the path runs through, for anchoring ears and tails. */
  points: Point[];
  rx: number;
  ry: number;
  top: number;
  bottom: number;
}

/** Outline points for each body type. Angles start at the right and go clockwise (SVG y is down). */
export function bodyShape(body: CreatureBody, seed: number): BodyShape {
  const rand = seededRandom(seed ^ 0x51ed);
  const [cx, cy] = CENTER;
  let rx = between(rand, 50, 60);
  let ry = between(rand, 44, 54);
  const points: Point[] = [];
  const around = (count: number, radius: (t: number, i: number) => [number, number]) => {
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2;
      const [rxf, ryf] = radius(t, i);
      points.push([cx + Math.cos(t) * rx * rxf, cy + Math.sin(t) * ry * ryf]);
    }
  };

  switch (body) {
    case 'round':
      ry = rx * between(rand, 0.92, 1);
      around(12, () => [1, 1]);
      break;
    case 'blob':
      around(9, () => {
        const j = between(rand, 0.9, 1.08);
        return [j, j];
      });
      break;
    case 'fuzzy':
      // Alternating radii make a soft, fluffy fringe.
      around(26, (_, i) => (i % 2 ? [0.9, 0.9] : [1.04, 1.04]));
      break;
    case 'pebble': {
      rx = between(rand, 60, 68);
      ry = between(rand, 38, 44);
      const tilt = between(rand, -0.08, 0.08);
      around(14, (t) => {
        // Superellipse-ish: flatter sides, rounded corners.
        const k = 0.75;
        const f = 1 / Math.pow(Math.abs(Math.cos(t)) ** (2 / k) + Math.abs(Math.sin(t)) ** (2 / k), k / 2);
        return [f, f * (1 + tilt * Math.cos(t))];
      });
      break;
    }
    case 'droplet':
      ry = between(rand, 50, 56);
      around(16, (t) => {
        // Narrows to a soft point at the top (sin t = -1).
        const w = Math.pow((1 + Math.sin(t)) / 2, 0.6);
        return [Math.max(w, 0.04), Math.sin(t) < 0 ? 1.3 : 1];
      });
      break;
    case 'sprout':
      ry = between(rand, 46, 52);
      around(10, () => {
        const j = between(rand, 0.95, 1.04);
        return [j, j];
      });
      break;
  }

  const ys = points.map((p) => p[1]);
  return { path: smoothClosedPath(points), points, rx, ry, top: Math.min(...ys), bottom: Math.max(...ys) };
}

/** The outline point closest to a target, so parts sit on the body whatever its shape. */
export function nearestPoint(points: Point[], [tx, ty]: Point): Point {
  let best = points[0];
  let bestD = Infinity;
  for (const p of points) {
    const d = (p[0] - tx) ** 2 + (p[1] - ty) ** 2;
    if (d < bestD) [best, bestD] = [p, d];
  }
  return best;
}

/** Four-point sparkle centered on (x, y). */
export function starPath(x: number, y: number, r: number): string {
  const i = r * 0.28;
  return `M${x},${y - r} Q${x + i},${y - i} ${x + r},${y} Q${x + i},${y + i} ${x},${y + r} Q${x - i},${y + i} ${x - r},${y} Q${x - i},${y - i} ${x},${y - r}Z`;
}
