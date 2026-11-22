import type { Vec3 } from '../math';
import type { GamepadTuning, Stick } from './gamepad';

export function assistAim(
  look: Stick,
  moving: boolean,
  yaw: number,
  pitch: number,
  eye: Vec3,
  targets: readonly Vec3[],
  t: GamepadTuning['aim'],
  visible: (dir: Vec3, distance: number) => boolean,
): Stick {
  if (!moving && !look.x && !look.y) return look;
  const frictionRadius = (t.frictionRadiusDeg * Math.PI) / 180;
  const magnetismRadius = (t.magnetismRadiusDeg * Math.PI) / 180;
  let closest = Math.max(frictionRadius, magnetismRadius);
  let offset: Stick | undefined;
  for (const target of targets) {
    const x = target.x - eye.x;
    const y = target.y - eye.y;
    const z = target.z - eye.z;
    const range = Math.hypot(x, y, z);
    if (!range || range > t.rangeM) continue;
    const yawError = Math.atan2(-x, -z) - yaw;
    const dx = Math.atan2(Math.sin(yawError), Math.cos(yawError));
    const dy = Math.atan2(y, Math.hypot(x, z)) - pitch;
    const angle = Math.hypot(dx * Math.cos(pitch), dy);
    if (
      angle >= closest ||
      !visible({ x: x / range, y: y / range, z: z / range }, range)
    )
      continue;
    closest = angle;
    offset = { x: dx, y: dy };
  }
  if (!offset) return look;
  const falloff = (radius: number) =>
    radius > 0 ? Math.max(0, 1 - closest / radius) : 0;
  const friction =
    1 - Math.min(1, Math.max(0, t.friction)) * falloff(frictionRadius);
  const pull = moving ? t.magnetism * falloff(magnetismRadius) : 0;
  return {
    x: look.x * friction - offset.x * pull,
    y: look.y * friction - offset.y * pull,
  };
}
