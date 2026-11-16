import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
} from 'three';
import type { EventBus } from '../core/events';
import type { Vec3 } from '../core/math';
import { loadSettings } from '../core/save';
import type { Settings } from '../core/save';
import { tuning } from '../core/tuning';
import { getMaterial } from './materials';

/** Magenta jest zarezerwowana dla Rezonansu (ADR 0006): tylko wybuchy z tagiem #power. */
const ELECTRIC = new Color('#fff1d6');
const FIRE = new Color('#ffb84d');
const FIRE_END = new Color('#a66b08');

interface ExplosionOptions {
  floorY?: number;
  playerPosition?(): Vec3;
  burstSparks?(point: Vec3, count: number, color: number): void;
  settings?: Pick<Settings, 'flashes' | 'screenShake'>;
}

export class ExplosionRenderer {
  readonly root = new Group();
  private readonly geometry = new SphereGeometry(1, 12, 8);
  private readonly ringGeometry = new RingGeometry(
    tuning.vfx.explosionRingInnerFrac,
    1,
    32,
  );
  private readonly pool;
  private readonly off: () => void;
  private sequence = 0;
  private readonly powerColor = getMaterial('power').color.clone();

  constructor(
    bus: EventBus,
    private readonly options: ExplosionOptions = {},
  ) {
    this.pool = Array.from(
      { length: Math.max(1, Math.floor(tuning.vfx.maxExplosions)) },
      () => {
        const material = getMaterial('power').clone();
        material.transparent = true;
        material.depthWrite = false;
        const mesh = new Mesh(this.geometry, material);
        mesh.name = 'explosion-shell';
        const core = new Mesh(
          this.geometry,
          new MeshBasicMaterial({
            color: ELECTRIC.clone().multiplyScalar(
              tuning.vfx.explosionFlashBrightness,
            ),
            transparent: true,
            blending: AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          }),
        );
        core.name = 'explosion-core';
        core.material.userData.bloom = true;
        const ring = new Mesh(
          this.ringGeometry,
          new MeshBasicMaterial({
            color: FIRE,
            transparent: true,
            blending: AdditiveBlending,
            depthWrite: false,
            side: DoubleSide,
            toneMapped: false,
          }),
        );
        ring.name = 'explosion-ring';
        ring.material.userData.bloom = true;
        ring.rotation.x = -Math.PI / 2;
        for (const effect of [mesh, core, ring]) {
          effect.visible = false;
          effect.userData.noOutline = effect !== mesh;
        }
        this.root.add(mesh, core, ring);
        return { mesh, core, ring, fire: false, age: 0, radius: 0, order: -1 };
      },
    );
    this.off = bus.on('explosion', ({ point, radiusM, tags }) => {
      const slot =
        this.pool.find(
          (p) => !p.mesh.visible && !p.core.visible && !p.ring.visible,
        ) ?? this.pool.reduce((a, b) => (a.order < b.order ? a : b));
      slot.age = 0;
      slot.radius = radiusM;
      slot.order = this.sequence++;
      slot.fire =
        !tags.includes('#power') &&
        !tags.includes('#elektrycznosc') &&
        (tags.includes('#fire') ||
          (tags.includes('#hazard') && tags.includes('#explosion')));
      slot.mesh.userData.noOutline = slot.fire;
      slot.mesh.position.set(point.x, point.y, point.z);
      slot.mesh.scale.setScalar(0);
      slot.mesh.material.opacity = tuning.vfx.explosionOpacity;
      slot.mesh.material.color.copy(
        tags.includes('#power')
          ? this.powerColor
          : tags.includes('#elektrycznosc')
            ? ELECTRIC
            : FIRE,
      );
      slot.mesh.visible = true;
      slot.core.position.copy(slot.mesh.position);
      slot.ring.position.set(
        point.x,
        (options.floorY ?? 0) + tuning.vfx.explosionRingFloorOffsetM,
        point.z,
      );
      slot.core.visible = slot.fire && this.settings.flashes;
      slot.ring.visible = slot.fire;
      this.animate(slot);
      if (!slot.fire) return;
      options.burstSparks?.(
        point,
        tuning.vfx.explosionSparkCount,
        FIRE.getHex(),
      );
      const player = options.playerPosition?.();
      if (!player || !(radiusM > 0)) return;
      const distance = Math.hypot(
        player.x - point.x,
        player.y - point.y,
        player.z - point.z,
      );
      const falloff = Math.max(
        0,
        1 - distance / (radiusM * tuning.vfx.explosionShakeRadiusScale),
      );
      // FpsCamera skaluje amplitudę przez screenShake dokładnie raz.
      if (falloff > 0 && this.settings.screenShake > 0)
        bus.emit('camera_shake', {
          intensity: tuning.vfx.explosionShakeIntensity * falloff,
          durationS: tuning.vfx.explosionShakeS,
          dir: null,
        });
      if (distance <= radiusM)
        bus.emit('hitstop', { ms: tuning.vfx.explosionHitstopMs });
    });
  }

  render(frameDt: number): void {
    for (const slot of this.pool) {
      if (!slot.mesh.visible && !slot.core.visible && !slot.ring.visible)
        continue;
      slot.age += Math.max(0, frameDt);
      this.animate(slot);
    }
  }

  private get settings(): Pick<Settings, 'flashes' | 'screenShake'> {
    return this.options.settings ?? loadSettings();
  }

  private animate(slot: (typeof this.pool)[number]): void {
    const t = tuning.vfx;
    const progress = Math.min(1, slot.age / t.explosionDurationS);
    const growth = slot.fire
      ? t.explosionFireStartRadiusScale +
        (1 - t.explosionFireStartRadiusScale) * Math.sqrt(progress)
      : progress;
    slot.mesh.scale.setScalar(slot.radius * growth);
    slot.mesh.material.opacity =
      (slot.fire ? t.explosionFireOpacity : t.explosionOpacity) *
      (1 - progress);
    slot.mesh.visible = progress < 1;
    if (!slot.fire) return;
    slot.mesh.material.color.copy(FIRE).lerp(FIRE_END, progress);
    const flash = Math.min(1, slot.age / t.explosionFlashS);
    slot.core.visible = this.settings.flashes && flash < 1;
    slot.core.scale.setScalar(slot.radius * t.explosionFlashRadiusScale);
    slot.core.material.opacity = 1 - flash;
    slot.core.material.color
      .copy(ELECTRIC)
      .multiplyScalar(t.explosionFlashBrightness);
    const wave = Math.min(1, slot.age / t.explosionRingS);
    slot.ring.visible = wave < 1;
    slot.ring.scale.setScalar(
      slot.radius * t.explosionRingRadiusScale * Math.sqrt(wave),
    );
    slot.ring.material.opacity = t.explosionRingOpacity * (1 - wave);
  }

  dispose(): void {
    this.off();
    this.root.removeFromParent();
    this.root.clear();
    for (const slot of this.pool) {
      slot.mesh.material.dispose();
      slot.core.material.dispose();
      slot.ring.material.dispose();
    }
    this.geometry.dispose();
    this.ringGeometry.dispose();
  }
}
