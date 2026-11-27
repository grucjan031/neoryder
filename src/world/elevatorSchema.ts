import { z } from 'zod';
import type { Vec3 } from '../core/math';
import {
  contains,
  intersects,
  orientedBox,
  type Box,
} from './mapAuditGeometry';
import type { RoomDefinition } from './roomSchema';

export const cabinHeight = 2.65;
export const slab = 0.08;
export const sides = ['n', 's', 'e', 'w'] as const;
export type Side = (typeof sides)[number];
const doorSideSchema = z
  .enum(['n', 's', 'e', 'w', 'N', 'S', 'E', 'W'])
  .transform((side): Side => side.toLowerCase() as Side);

export const elevatorSchema = z
  .object({
    id: z.string().min(1),
    x: z.number().finite(),
    z: z.number().finite(),
    width: z.number().finite().positive(),
    depth: z.number().finite().positive(),
    stops: z
      .array(z.object({ y: z.number().finite(), doorSide: doorSideSchema }))
      .min(2),
    startStop: z.number().int().nonnegative(),
    model: z
      .string()
      .regex(/^[a-z0-9_]+$/)
      .optional(),
  })
  .superRefine((e, ctx) => {
    if (e.startStop >= e.stops.length)
      ctx.addIssue({
        code: 'custom',
        path: ['startStop'],
        message: 'Brak przystanku początkowego.',
      });
    e.stops.forEach((s, i) => {
      if (i && s.y <= e.stops[i - 1]!.y)
        ctx.addIssue({
          code: 'custom',
          path: ['stops', i, 'y'],
          message: 'Przystanki muszą mieć rosnącą wysokość.',
        });
    });
  });
export type ElevatorDefinition = z.infer<typeof elevatorSchema>;

/** Współrzędne względem środka ściany. Dodatni offset prowadzi na podest. */
export function facePoint(
  e: ElevatorDefinition,
  side: Side | Uppercase<Side>,
  y: number,
  offset = 0,
  along = 0,
): Vec3 {
  const s = side.toLowerCase();
  const dx = Number(s === 'e') - Number(s === 'w');
  const dz = Number(s === 's') - Number(s === 'n');
  return {
    x: e.x + dx * (e.width / 2 + offset) + dz * along,
    y,
    z: e.z + dz * (e.depth / 2 + offset) - dx * along,
  };
}

export function validateElevators(
  elevators: ElevatorDefinition[],
  blocks: RoomDefinition['blocks'],
  ctx: z.RefinementCtx,
): void {
  const epsilon = 1e-6;
  const shapes = blocks.map((b) =>
    orientedBox(b.position, b.size, b.rotation),
  );
  const shafts: Box[] = [];
  for (const [i, e] of elevators.entries()) {
    const issue = (message: string) =>
      ctx.addIssue({ code: 'custom', path: ['elevators', i], message });
    if (elevators.slice(0, i).some((other) => other.id === e.id))
      issue('Powtórzone id windy.');
    if (!e.stops.length) continue;
    const low = e.stops[0]!.y - slab,
      high = e.stops.at(-1)!.y + cabinHeight + slab;
    const shaft = orientedBox(
      { x: e.x, y: (low + high) / 2, z: e.z },
      { x: e.width, y: high - low, z: e.depth },
    );
    if ([...shapes, ...shafts].some((b) => intersects(shaft, b, -epsilon)))
      issue('Bryła przecina szyb windy.');
    shafts.push(shaft);
    for (const stop of e.stops) {
      const p = facePoint(e, stop.doorSide, stop.y, epsilon);
      const supported = blocks.some((b, j) => {
        if (
          !b.walkable ||
          b.rotation?.x ||
          b.rotation?.z ||
          Math.abs(b.position.y + b.size.y / 2 - p.y) > epsilon
        )
          return false;
        return contains(shapes[j]!, { x: p.x, y: b.position.y, z: p.z }, 0);
      });
      if (!supported)
        issue(`Brak poziomego podestu walkable przy drzwiach na y=${stop.y}.`);
    }
  }
}
