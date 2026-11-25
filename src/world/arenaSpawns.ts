import type { Vec3 } from '../core/math';
import { distance as distance3D } from '../core/math';
import type { ArenaNavigation } from './arenaNavigation';
import type { Rng } from '../core/rng';
import type { RoomDefinition } from './roomSchema';

type GroundPoint = Pick<Vec3, 'x' | 'z'>;
const distance = (a: GroundPoint, b: GroundPoint) =>
  Math.hypot(a.x - b.x, a.z - b.z);

export function pickWaveSpawnByDistance<T extends GroundPoint>(
  points: readonly T[],
  player: GroundPoint,
  minM: number,
  rng: Rng,
): T | null {
  if (!points.length) return null;
  const far = points.filter((point) => distance(point, player) >= minM);
  return rng.pick(far.length ? far : points);
}

export function arenaSpawnPoints(room: RoomDefinition): Vec3[] {
  const spawns: readonly { x: number; y?: number | undefined; z: number }[] =
    room.arena?.spawnPoints ?? room.spawnPoints;
  return spawns.map(({ x, y, z }) => ({
    x,
    y: (room.arena?.spawnRing ? y : undefined) ?? room.playerSpawn.y,
    z,
  }));
}

export function spawnOcclusion(
  origin: Vec3,
  targetHeightM: number,
  cast: (origin: Vec3, direction: Vec3, length: number) => number | null,
): (spawn: Vec3) => boolean {
  return (spawn) => {
    const x = spawn.x - origin.x;
    const y = spawn.y + targetHeightM - origin.y;
    const z = spawn.z - origin.z;
    const length = Math.hypot(x, y, z);
    return (
      length > 0 &&
      cast(origin, { x: x / length, y: y / length, z: z / length }, length) !==
        null
    );
  };
}

export function selectArenaSpawn(
  ring: { minM: number; maxM: number },
  safe: readonly Vec3[],
  player: Vec3,
  targets: readonly Vec3[],
  rng: Rng,
  occluded?: (spawn: Vec3) => boolean,
): Vec3 | null {
  const allowed = safe.filter((spawn) => distance(spawn, player) >= ring.minM);
  if (!allowed.length) return null;
  const inside = allowed.filter(
    (spawn) => distance(spawn, player) <= ring.maxM,
  );
  const hidden = occluded ? inside.filter(occluded) : [];
  const candidates = hidden.length ? hidden : inside.length ? inside : allowed;
  const score = (spawn: Vec3) =>
    inside.length && targets.length
      ? Math.min(...targets.map((target) => distance(spawn, target)))
      : distance(spawn, player);
  const best = Math.min(...candidates.map(score));
  return { ...rng.pick(candidates.filter((spawn) => score(spawn) === best)) };
}

export function selectWaveSpawn(
  points: readonly Vec3[],
  playerFeet: Vec3,
  minM: number,
  maxM: number,
  navigation: Pick<ArenaNavigation, 'path'>,
  hidden: (point: Vec3) => boolean,
  rng: Rng,
): Vec3 | null {
  type Candidate = { point: Vec3; length: number };
  const hiddenInRange: Candidate[] = [];
  const hiddenBeyondRange: Candidate[] = [];
  const visible: Candidate[] = [];
  for (const point of points) {
    const path = navigation.path(point, playerFeet);
    if (!path.length) continue;
    let length = 0;
    let previous = point;
    for (const step of path) {
      length += distance3D(previous, step);
      previous = step;
    }
    if (length < minM) continue;
    const candidate = { point, length };
    if (!hidden(point)) visible.push(candidate);
    else if (length <= maxM) hiddenInRange.push(candidate);
    else hiddenBeyondRange.push(candidate);
  }
  const eligible = [hiddenInRange, hiddenBeyondRange, visible].find(
    (group) => group.length > 0,
  );
  if (!eligible) return pickWaveSpawnByDistance(points, playerFeet, minM, rng);
  // Krótsza z dwóch losowych tras preferuje bliskie pomieszczenia, zachowując różnorodność spawnu.
  const first = rng.pick(eligible);
  const second = rng.pick(eligible);
  return { ...(first.length <= second.length ? first.point : second.point) };
}
