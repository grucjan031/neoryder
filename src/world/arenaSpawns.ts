import type { Vec3 } from '../core/math';
import type { Rng } from '../core/rng';
import type { RoomDefinition } from './roomSchema';

const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);

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
