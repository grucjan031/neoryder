import type { EntityId, EventBus } from '../core/events';
import type { Tuning } from '../core/tuning';
import type { PlayerState } from './playerController';
import { loadSettings } from '../core/save';

/** Wynik kamery na klatkę. Scena przepisuje go na PerspectiveCamera (rotacja 'YXZ'). */
export interface CameraPose {
  position: { x: number; y: number; z: number };
  pitch: number;
  yaw: number;
  roll: number;
  fov: number;
}

/** Amplituda wstrząsu z traumy: trauma² × shakeMax, zawsze w [0, shakeMax]. */
export function shakeAmplitude(trauma: number, shakeMax: number): number {
  const t = Math.min(1, Math.max(0, Number.isFinite(trauma) ? trauma : 0));
  return t * t * Math.max(0, shakeMax);
}

/** Gładki pseudo-szum w [-1, 1] (suma sinusów o niewspółmiernych częstotliwościach). */
function smoothNoise(t: number, seed: number): number {
  return (
    (Math.sin(t * 1.0 + seed) +
      Math.sin(t * 2.17 + seed * 1.7) * 0.5 +
      Math.sin(t * 4.33 + seed * 2.3) * 0.25) /
    1.75
  );
}

const DEG = Math.PI / 180;

/**
 * Kamera FPP: interpolacja pozycji oczu, wstrząs (model traumy), kick FOV przy sprincie i dashu,
 * kołysanie przy bieganiu, ugięcie przy lądowaniu, płynna zmiana wysokości oczu (slide/przysiad).
 * Działa w czasie rzeczywistym klatki, więc wstrząs trwa także podczas hitstopu.
 */
export class FpsCamera {
  private trauma = 0;
  private decayPerS = 0;
  private time = 0;
  private fov: number;
  private bobPhase = 0;
  private bobWeight = 0;
  private dip = 0;
  private eye: number;
  private readonly off: (() => void)[] = [];

  constructor(
    private readonly tuning: Tuning,
    private readonly playerId: EntityId,
    bus?: EventBus,
    private readonly settings: Pick<
      import('../core/save').Settings,
      'screenShake'
    > = loadSettings(),
  ) {
    this.fov = tuning.camera.fov;
    this.eye = tuning.player.eyeHeight;
    if (!bus) return;
    this.off.push(
      bus.on('camera_shake', ({ intensity, durationS }) =>
        this.addTrauma(intensity, durationS),
      ),
      bus.on('damage_dealt', ({ source, target, amount }) => {
        const c = this.tuning.camera;
        const base = Math.min(1, amount / Math.max(1, c.shakeDamageRef));
        if (target === this.playerId) this.addTrauma(base, 0.35);
        else if (source === this.playerId)
          this.addTrauma(base * c.shakeOnHitScale, 0.2);
      }),
      bus.on('player_landed', ({ id, speed }) => {
        if (id !== this.playerId || speed < 3) return;
        const c = this.tuning.camera;
        this.dip = Math.max(
          this.dip,
          Math.min(c.landingDipMax, speed * c.landingDipPerSpeed),
        );
      }),
    );
  }

  /** Dodaje traumę (0..1); całość wygasa liniowo w durationS od ostatniego dodania. */
  addTrauma(intensity: number, durationS: number): void {
    if (!(intensity > 0)) return;
    this.trauma = Math.min(1, this.trauma + intensity);
    this.decayPerS = this.trauma / Math.max(1e-3, durationS);
  }

  get currentTrauma(): number {
    return this.trauma;
  }

  get currentFov(): number {
    return this.fov;
  }

  /**
   * `aim` 0–1 (celowanie): FOV zbliża się do bazowego × `aimFovScale` (domyślnie
   * `tuning.player.aim.fovScale`); bez dodatkowego wstrząsu.
   */
  update(
    frameDt: number,
    prev: PlayerState,
    cur: PlayerState,
    alpha: number,
    aim = 0,
    aimFovScale = this.tuning.player.aim.fovScale,
  ): CameraPose {
    const c = this.tuning.camera;
    const p = this.tuning.player;
    const dt = Math.max(0, Math.min(frameDt, 0.1));
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - this.decayPerS * dt);

    // FOV: baza czytana na żywo + kick przy sprincie / dashu, wygładzony wykładniczo.
    const targetFov =
      c.fov +
      (cur.sprinting ? c.sprintFovKick : 0) +
      (cur.dashS > 0 ? c.dashFovKick : 0);
    this.fov += (targetFov - this.fov) * (1 - Math.exp(-c.fovLerpRate * dt));

    // Wysokość oczu liczona od stóp, wygładzona przy zmianie kapsuły.
    const eyeTarget = cur.height - (p.capsuleHeight - p.eyeHeight);
    this.eye += (eyeTarget - this.eye) * (1 - Math.exp(-c.eyeLerpRate * dt));
    this.dip *= Math.exp(-c.landingRecoverRate * dt);

    // Kołysanie: faza z przebytej drogi, waga płynnie wygasa po zatrzymaniu.
    const speed = Math.hypot(cur.velocity.x, cur.velocity.z);
    const bobbing =
      c.bobEnabled > 0 && cur.grounded && !cur.sliding && speed > 0.5;
    this.bobWeight +=
      ((bobbing ? Math.min(1, speed / p.walkSpeed) : 0) - this.bobWeight) *
      (1 - Math.exp(-10 * dt));
    this.bobPhase += ((speed * dt) / Math.max(0.1, c.bobStride)) * Math.PI * 2;
    const bobY =
      Math.abs(Math.sin(this.bobPhase)) * c.bobAmount * this.bobWeight;
    const bobX = Math.cos(this.bobPhase) * c.bobAmount * 0.5 * this.bobWeight;

    const lerp = (a: number, b: number) => a + (b - a) * alpha;
    const feetPrev = prev.position.y - prev.height / 2;
    const feetCur = cur.position.y - cur.height / 2;
    const yaw = lerp(prev.yaw, cur.yaw);
    const pitch = lerp(prev.pitch, cur.pitch);

    const amp =
      shakeAmplitude(this.trauma, c.shakeMax) * this.settings.screenShake;
    const t = this.time * c.shakeFrequency;
    const shakePitch = amp * c.shakeMaxAngleDeg * DEG * smoothNoise(t, 1.3);
    const shakeYaw = amp * c.shakeMaxAngleDeg * DEG * smoothNoise(t, 7.1);
    const roll = amp * c.shakeMaxAngleDeg * DEG * smoothNoise(t, 3.7);
    const offX = amp * c.shakeMaxOffset * smoothNoise(t, 11.9);
    const offY = amp * c.shakeMaxOffset * smoothNoise(t, 5.3);

    // Przesunięcie boczne kołysania i wstrząsu w osi "w prawo" kamery.
    const side = bobX + offX;
    return {
      position: {
        x: lerp(prev.position.x, cur.position.x) + Math.cos(yaw) * side,
        y: lerp(feetPrev, feetCur) + this.eye - bobY - this.dip + offY,
        z: lerp(prev.position.z, cur.position.z) - Math.sin(yaw) * side,
      },
      pitch: pitch + shakePitch,
      yaw: yaw + shakeYaw,
      roll,
      fov: this.fov * (1 + (aimFovScale - 1) * Math.min(1, Math.max(0, aim))),
    };
  }

  dispose(): void {
    for (const off of this.off.splice(0)) off();
  }
}
