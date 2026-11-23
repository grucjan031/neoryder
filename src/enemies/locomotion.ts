import type { Tuning } from '../core/tuning';
import type { EnemySnapshot } from './types';

export function angleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export function turnToward(
  yaw: number,
  heading: number,
  rateDeg: number,
  dt: number,
): number {
  const limit = ((rateDeg * Math.PI) / 180) * dt;
  return yaw + Math.max(-limit, Math.min(limit, angleDelta(yaw, heading)));
}

// Maximum arrival speed with discrete braking. The final step can reach the target exactly.
export function arrivalSpeed(
  distance: number,
  braking: number,
  dt: number,
): number {
  distance = Math.max(0, distance);
  if (distance === 0 || dt <= 0) return 0;
  if (braking <= 0) return distance / dt;
  const steps = Math.max(
    1,
    Math.ceil((Math.sqrt(1 + (8 * distance) / (braking * dt * dt)) - 1) / 2),
  );
  return distance / (steps * dt) + (braking * dt * (steps - 1)) / 2;
}

export function steerVelocity(
  velocity: { x: number; z: number },
  x: number,
  z: number,
  acceleration: number,
  braking: number,
  dt: number,
): void {
  const dx = x - velocity.x,
    dz = z - velocity.z;
  const length = Math.hypot(dx, dz);
  if (!length) return;
  const rate = dx * velocity.x + dz * velocity.z < 0 ? braking : acceleration;
  const fraction = Math.min(1, (rate * dt) / length);
  velocity.x += dx * fraction;
  velocity.z += dz * fraction;
}

const horizontalEpsilonM = 1e-5;

export function updateBodyPose(
  previous: EnemySnapshot,
  current: EnemySnapshot,
  turnRate: number,
  dt: number,
  t: Tuning['enemies'],
): void {
  const dx = current.position.x - previous.position.x,
    dz = current.position.z - previous.position.z;
  const oldYaw = previous.bodyYaw ?? previous.yaw;
  // Ruch czysto pionowy (dron) nie ma kierunku poziomego: atan2(0, 0) skręcałby korpus na północ.
  const offset =
    current.speed > 0 && Math.hypot(dx, dz) > horizontalEpsilonM
      ? angleDelta(current.yaw, Math.atan2(dx, dz))
      : 0;
  const goal =
    current.yaw +
    Math.max(-t.torsoAimLimitRad, Math.min(t.torsoAimLimitRad, offset));
  current.bodyYaw = turnToward(oldYaw, goal, turnRate, dt);
  const turn = angleDelta(oldYaw, current.bodyYaw);
  const maxTurn = (dt * turnRate * Math.PI) / 180;
  const bank =
    maxTurn > 1e-9
      ? -t.turnLeanRad *
        Math.min(1, current.speed) *
        Math.max(-1, Math.min(1, turn / maxTurn))
      : 0;
  const weight = 1 - Math.exp(-dt / Math.max(dt, t.animationFadeS));
  current.lean = (previous.lean ?? 0) + (bank - (previous.lean ?? 0)) * weight;
}
