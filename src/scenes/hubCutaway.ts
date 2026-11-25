import { tuning, type Tuning } from '../core/tuning';
import type { Vec3 } from '../core/math';

export type CutawayKind = 'noodles' | 'cat';
type Settings = Tuning['hub']['cutaway'];
export interface Shot {
  playerPos: Vec3;
  playerYaw: number;
  targetPos: Vec3;
}
const unit = (x: number) => Math.max(0, Math.min(1, x));
export const ease = (x: number) => unit(x) ** 2 * (3 - 2 * unit(x));
export function noodlesState(t: number, p = tuning.hub.cutaway.noodlesPhases) {
  let start = 0;
  for (const phase of [
    'serve',
    'pickUp',
    'eat',
    'putDown',
    'push',
    'take',
    'return',
  ] as const) {
    const end = phase === 'return' ? 1 : p[phase];
    if (t < end || phase === 'return') {
      const progress = unit((t - start) / (end - start));
      const fill =
        t < p.pickUp || t >= p.take
          ? 1
          : 1 - unit((t - p.pickUp) / (p.eat - p.pickUp));
      return { phase, progress, fill, visible: t < p.hide || t >= p.take };
    }
    start = end;
  }
  throw new Error('Brak fazy ramenu');
}
export function catState(t: number, p = tuning.hub.cutaway.catPhases) {
  if (t < p.kneel)
    return { phase: 'kneel' as const, progress: unit(t / p.kneel) };
  if (t < p.stroke)
    return {
      phase: 'stroke' as const,
      progress: unit((t - p.kneel) / (p.stroke - p.kneel)),
    };
  return {
    phase: 'rise' as const,
    progress: unit((t - p.stroke) / (1 - p.stroke)),
  };
}

export class HubCutaway {
  kind: CutawayKind | null = null;
  shot: Shot | null = null;
  private previous = 0;
  private elapsed = 0;
  private skipBlend = 1;
  constructor(private readonly settings: Settings = tuning.hub.cutaway) {}
  get active() {
    return this.kind !== null;
  }
  private get duration() {
    return this.kind === 'cat' ? this.settings.catS : this.settings.noodlesS;
  }
  start(kind: CutawayKind, shot: Shot) {
    if (this.active) return;
    this.kind = kind;
    this.shot = {
      playerPos: { ...shot.playerPos },
      playerYaw: shot.playerYaw,
      targetPos: { ...shot.targetPos },
    };
    this.elapsed = this.previous = 0;
    this.skipBlend = 1;
  }
  step(dt: number) {
    if (!this.active || dt <= 0) return;
    this.previous = this.elapsed;
    this.elapsed = Math.min(this.duration, this.elapsed + dt);
    if (this.elapsed >= this.duration) {
      this.kind = null;
      this.shot = null;
    }
  }
  skip() {
    if (!this.active || this.elapsed >= this.duration - this.settings.blendOutS)
      return;
    this.skipBlend = this.cameraBlend(1);
    this.previous = this.elapsed = this.duration - this.settings.blendOutS;
  }
  t(alpha: number) {
    return this.active
      ? unit(
          (this.previous + (this.elapsed - this.previous) * unit(alpha)) /
            this.duration,
        )
      : 0;
  }
  cameraBlend(alpha: number) {
    const time = this.t(alpha) * this.duration;
    return Math.min(
      ease(time / this.settings.blendInS),
      this.skipBlend * ease((this.duration - time) / this.settings.blendOutS),
    );
  }
}

export interface ShotSphere {
  center: Vec3;
  radius: number;
  owner: string;
}

interface Subjects {
  head: Vec3;
  chest: Vec3;
  focus: Vec3;
  hela?: Vec3;
}

function intersects(a: Vec3, b: Vec3, sphere: ShotSphere) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    dz = b.z - a.z;
  const x = sphere.center.x - a.x,
    y = sphere.center.y - a.y,
    z = sphere.center.z - a.z;
  const t = unit(
    (x * dx + y * dy + z * dz) / (dx * dx + dy * dy + dz * dz || 1),
  );
  return Math.hypot(x - t * dx, y - t * dy, z - t * dz) < sphere.radius;
}

export function subjectOcclusions(
  position: Vec3,
  subjects: Subjects,
  obstacles: readonly ShotSphere[],
) {
  let count = 0;
  for (const sphere of obstacles) {
    if (
      sphere.owner !== 'player' &&
      intersects(position, subjects.head, sphere)
    )
      count++;
    if (intersects(position, subjects.focus, sphere)) count++;
    if (
      subjects.hela &&
      sphere.owner !== 'hela' &&
      sphere.owner !== 'player' &&
      intersects(position, subjects.hela, sphere)
    )
      count++;
  }
  return count;
}

export function shotCamera(
  { playerPos, targetPos, playerYaw }: Shot,
  kind: CutawayKind,
  subjects: Subjects,
  obstacles: readonly ShotSphere[],
  ray: (origin: Vec3, dir: Vec3, maxM: number) => number,
  s: Settings = tuning.hub.cutaway,
) {
  const cat = kind === 'cat';
  const anchor = cat ? subjects.chest : subjects.head;
  const look = {
    x: (anchor.x + subjects.focus.x) / 2,
    y: playerPos.y + (cat ? s.catFocusM : s.focusHeightM),
    z: (anchor.z + subjects.focus.z) / 2,
  };
  const angle =
    targetPos.x === playerPos.x && targetPos.z === playerPos.z
      ? playerYaw + Math.PI
      : Math.atan2(targetPos.x - playerPos.x, targetPos.z - playerPos.z);
  const length = cat ? s.catDistanceM : s.distanceM;
  const y = playerPos.y + (cat ? s.catEyeM : s.heightM);
  const distance = Math.sqrt(Math.max(0, length ** 2 - (y - look.y) ** 2));
  function candidate(degrees: number) {
    const yaw = angle + (degrees * Math.PI) / 180;
    const position = {
      x: look.x + Math.sin(yaw) * distance,
      y,
      z: look.z + Math.cos(yaw) * distance,
    };
    const dir = {
      x: (position.x - look.x) / length,
      y: (y - look.y) / length,
      z: (position.z - look.z) / length,
    };
    const max = length + s.wallPadM;
    const blocked = (to: Vec3) => {
      const d = Math.hypot(
        to.x - position.x,
        to.y - position.y,
        to.z - position.z,
      );
      const unit = {
        x: (to.x - position.x) / d,
        y: (to.y - position.y) / d,
        z: (to.z - position.z) / d,
      };
      return Number(ray(position, unit, d) < d - s.wallPadM);
    };
    // Ściana za kamerą albo bryła kryjówki między kamerą a głową / celem.
    const wall =
      Number(ray(look, dir, max) < max) +
      blocked(subjects.head) +
      blocked(subjects.focus);
    return {
      look,
      position,
      degrees,
      wall,
      occlusions: wall + subjectOcclusions(position, subjects, obstacles),
    };
  }
  const [first = 70, ...rest] = cat ? s.catAnglesDeg : s.noodlesAnglesDeg;
  let best = candidate(first);
  for (const degrees of rest) {
    if (best.occlusions === 0) break;
    const next = candidate(degrees);
    if (next.occlusions < best.occlusions) best = next;
  }
  return best;
}
