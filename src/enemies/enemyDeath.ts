import { normalize } from '../core/math';
import type { Vec3 } from '../core/math';
import type { Tuning } from '../core/tuning';

export function deathDirection(dir?: Vec3 | null): Vec3 {
  const flat = normalize({ x: dir?.x ?? 0, y: 0, z: dir?.z ?? 0 });
  return flat.x || flat.z ? flat : { x: 0, y: 0, z: -1 };
}

export function deathDuration(
  tags: readonly string[],
  tuning: Tuning['enemies'],
): number {
  return tags.includes('#execute') ? 0 : tuning.deathCollapseS;
}

export function deathPose(
  progress: number,
  drone: boolean,
  tuning: Tuning['enemies'],
) {
  return {
    tilt: (progress * progress * tuning.deathCollapseTiltDeg * Math.PI) / 180,
    slide: progress * tuning.deathCollapseSlideM,
    drop: drone ? progress * progress * tuning.deathCollapseDroneDropM : 0,
  };
}
