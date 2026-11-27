import type { Vec3 } from '../core/math';
import type { Rng } from '../core/rng';
import type { Tuning } from '../core/tuning';
import type { RoomDefinition } from '../world/roomSchema';

/** Rogi i środki krawędzi podłóg oraz miejsca obok bloków, także obróconych. */
export function automaticHideSpots(
  room: RoomDefinition,
  inset: number,
): Vec3[] {
  const points: Vec3[] = [];
  for (const block of room.blocks) {
    if (block.ceiling || block.rotation?.x || block.rotation?.z) continue;
    const top = block.position.y + block.size.y / 2;
    const floor = Math.abs(top - room.playerSpawn.y) < 1e-6;
    if (
      !floor &&
      (top <= room.playerSpawn.y ||
        block.position.y - block.size.y / 2 > room.playerSpawn.y)
    )
      continue;
    const margin = floor ? -inset : inset;
    const hx = block.size.x / 2 + margin,
      hz = block.size.z / 2 + margin;
    if (hx <= 0 || hz <= 0) continue;
    const yaw = block.rotation?.y ?? 0,
      c = Math.cos(yaw),
      s = Math.sin(yaw);
    for (const [x, z] of [
      [-hx, -hz],
      [-hx, hz],
      [hx, -hz],
      [hx, hz],
      [0, -hz],
      [0, hz],
      [-hx, 0],
      [hx, 0],
    ]) {
      points.push({
        x: block.position.x + x! * c + z! * s,
        y: room.playerSpawn.y,
        z: block.position.z - x! * s + z! * c,
      });
    }
  }
  return points;
}

/** Rezerwacje trwają do końca pokoju, również po śmierci właściciela. */
export class CivilianHiding {
  private readonly reserved: Vec3[] = [];
  constructor(
    private readonly spots: readonly Vec3[],
    private readonly rng: Rng,
    private readonly params: Tuning['civilians'],
    private readonly reachable: (from: Vec3, to: Vec3) => boolean,
    private readonly visible: (from: Vec3, to: Vec3) => boolean,
  ) {}

  reserve(from: Vec3, player: Vec3): Vec3 | null {
    const candidates = this.spots
      .filter(
        (p) =>
          this.reserved.every(
            (other) =>
              Math.hypot(p.x - other.x, p.y - other.y, p.z - other.z) >=
              this.params.hideSeparationM,
          ) && this.reachable(from, p),
      )
      .map((point) => ({
        point,
        tie: this.rng.next(),
        covered: !this.visible(
          { ...point, y: point.y + this.params.crouchEyeHeightM },
          { ...player, y: player.y + this.params.eyeHeightM },
        ),
        distance: Math.hypot(point.x - player.x, point.z - player.z),
      }));
    candidates.sort(
      (a, b) =>
        Number(b.covered) - Number(a.covered) ||
        b.distance - a.distance ||
        a.tie - b.tie,
    );
    const chosen = candidates[0]?.point;
    if (!chosen) return null;
    this.reserved.push({ ...chosen });
    return { ...chosen };
  }
}
