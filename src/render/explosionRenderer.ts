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
import type { Material } from 'three';
import type { EventBus } from '../core/events';
import type { Vec3 } from '../core/math';
import { loadSettings } from '../core/save';
import type { Settings } from '../core/save';
import { tuning } from '../core/tuning';
import { getMaterial } from './materials';
import { getLiteFx } from './fxMode';

/** Magenta jest zarezerwowana dla Rezonansu (ADR 0006): tylko wybuchy z tagiem #power. */
const ELECTRIC = new Color('#fff1d6');
const FIRE = new Color('#ffb84d');
const FIRE_END = new Color('#a66b08');

/**
 * Kula ognia bez płaskiej „kopuły”: turbulentny szum rozpala brzeg i wypala dziury w miarę
 * zaniku (dissolve), środek jest jaśniejszy. Wyłączone dla wybuchów mocy i elektrycznych (uFire = 0).
 */
function addFireShader(material: Material): {
  fire: { value: number };
  burn: { value: number };
  time: { value: number };
} {
  const uniforms = {
    fire: { value: 0 },
    burn: { value: 0 },
    time: { value: 0 },
  };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFire = uniforms.fire;
    shader.uniforms.uBurn = uniforms.burn;
    shader.uniforms.uFireTime = uniforms.time;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vFireP;
        varying vec3 vFireN;
        varying vec3 vFireV;`,
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vFireP = position;
        vFireN = normalize(normalMatrix * normal);
        vFireV = normalize(-mvPosition.xyz);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vFireP;
        varying vec3 vFireN;
        varying vec3 vFireV;
        uniform float uFire, uBurn, uFireTime;
        float fireHash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }
        float fireNoise(vec3 x) {
          vec3 i = floor(x);
          vec3 f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(fireHash(i), fireHash(i + vec3(1, 0, 0)), f.x),
                         mix(fireHash(i + vec3(0, 1, 0)), fireHash(i + vec3(1, 1, 0)), f.x), f.y),
                     mix(mix(fireHash(i + vec3(0, 0, 1)), fireHash(i + vec3(1, 0, 1)), f.x),
                         mix(fireHash(i + vec3(0, 1, 1)), fireHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
        }`,
      )
      .replace(
        '#include <opaque_fragment>',
        `if (uFire > 0.5) {
          vec3 q = vFireP * 3.2 + vec3(0.0, -uFireTime * 4.0, 0.0);
          float n = fireNoise(q) * 0.6 + fireNoise(q * 2.3 + 7.1) * 0.4;
          float facing = abs(dot(normalize(vFireN), normalize(vFireV)));
          // Wypalanie: rosnący próg zjada kulę od najsłabszych miejsc szumu.
          float keep = smoothstep(uBurn - 0.12, uBurn + 0.12, n);
          float ember = keep * (1.0 - smoothstep(uBurn, uBurn + 0.22, n));
          // Środek gęstszy i jaśniejszy, brzeg miękki — kula zamiast płaskiej kopuły.
          float body = mix(0.25, 1.0, pow(facing, 0.8));
          outgoingLight = mix(outgoingLight * (0.7 + 0.6 * n), vec3(1.0, 0.95, 0.85), ember * 0.8 + pow(facing, 3.0) * 0.35 * (1.0 - uBurn));
          diffuseColor.a *= keep * body * (0.75 + 0.5 * n);
        }
        #include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () => 'explosionFireShell';
  return uniforms;
}

interface ExplosionOptions {
  floorY?: number;
  playerPosition?(): Vec3;
  burstSparks?(point: Vec3, count: number, color: number): void;
  settings?: Pick<Settings, 'flashes' | 'screenShake'>;
}

export class ExplosionRenderer {
  readonly root = new Group();
  private readonly geometry = new SphereGeometry(1, 24, 16);
  private readonly ringGeometry = new RingGeometry(
    tuning.vfx.explosionRingInnerFrac,
    1,
    32,
  );
  private readonly pool;
  private readonly off: () => void;
  private sequence = 0;
  /**
   * Rozgrzewka programu kuli ognia: niewidoczna (krycie 0) kopia jest rysowana w pierwszych
   * klatkach sceny, żeby kompilacja shadera nie zjadła pierwszego wybuchu (trwa tylko 0,3 s).
   */
  private readonly prewarm: Mesh<SphereGeometry, Material>;
  private prewarmFrames = 2;
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
        const fireShader = addFireShader(material);
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
        return {
          mesh,
          core,
          ring,
          fireShader,
          fire: false,
          age: 0,
          radius: 0,
          order: -1,
        };
      },
    );
    const first = this.pool[0]!.mesh;
    this.prewarm = new Mesh(this.geometry, first.material);
    this.prewarm.name = 'explosion-prewarm';
    this.prewarm.scale.setScalar(1e-3);
    this.prewarm.frustumCulled = false;
    this.prewarm.userData.noOutline = true;
    this.prewarm.userData.vfxPool = true;
    this.prewarm.onBeforeRender = () => {
      // Krycie 0 tylko na czas tego rysowania; pula korzysta z tego samego materiału.
      this.prewarmOpacity = (first.material as MeshBasicMaterial).opacity;
      (first.material as MeshBasicMaterial).opacity = 0;
    };
    this.prewarm.onAfterRender = () => {
      (first.material as MeshBasicMaterial).opacity = this.prewarmOpacity;
    };
    this.root.add(this.prewarm);
    if (getLiteFx()) {
      this.prewarm.visible = false;
      this.prewarmFrames = 0;
    }
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
      if (!getLiteFx())
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

  private prewarmOpacity = 0;

  render(frameDt: number): void {
    if (this.prewarmFrames > 0 && --this.prewarmFrames === 0)
      this.prewarm.visible = false;
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
    if (getLiteFx()) {
      slot.mesh.visible = false;
      slot.core.visible = false;
      slot.ring.visible = false;
      return;
    }
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
    slot.fireShader.fire.value = slot.fire ? 1 : 0;
    if (!slot.fire) return;
    slot.fireShader.burn.value = progress * 0.95;
    slot.fireShader.time.value = slot.age + slot.order * 3.7;
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
