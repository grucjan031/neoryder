import {
  AdditiveBlending,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Vector3,
} from 'three';
import type { Camera } from 'three';
import { Rng } from '../core/rng';
import { tuning } from '../core/tuning';
import { getLiteFx } from '../render/fxMode';
import { CityParticleBatch } from '../render/city/particles';
import { disposeCityGroup } from '../render/city/resources';
import type { Vec3 } from '../core/math';
import type { RainShelterDef } from '../world/dressingSchema';

/** Granice strefy włącznie; odczyt bez alokacji i bez zmiany RNG pogody. */
export function isRainSheltered(
  point: Vec3,
  shelters: readonly RainShelterDef[],
  halfSize?: Vec3,
): boolean {
  for (const { position, size } of shelters) {
    if (
      Math.abs(point.x - position.x) <= size.x / 2 + (halfSize?.x ?? 0) &&
      Math.abs(point.y - position.y) <= size.y / 2 + (halfSize?.y ?? 0) &&
      Math.abs(point.z - position.z) <= size.z / 2 + (halfSize?.z ?? 0)
    )
      return true;
  }
  return false;
}

export interface RainParams {
  enabled: boolean;
  density: number;
  speed: number;
  windX: number;
  color: string;
  opacity: number;
}

export function wrapRainAxis(
  value: number,
  center: number,
  span: number,
): number {
  return (
    center + ((((value - center + span / 2) % span) + span) % span) - span / 2
  );
}

export class Weather {
  readonly root = new Group();
  readonly rain: InstancedMesh<PlaneGeometry, MeshBasicMaterial>;
  readonly splashes: CityParticleBatch;
  readonly splashDrops: CityParticleBatch;
  readonly params: RainParams;
  flash = 0;
  stormEnabled = false;
  private readonly drops: Vector3[];
  private readonly rng: Rng;
  private readonly dummy = new Object3D();
  private readonly cameraPosition = new Vector3();
  private readonly direction = new Vector3();
  private readonly up = new Vector3(0, 1, 0);
  private readonly splashColor = new Color();
  private readonly floorPoint = new Vector3();
  private readonly rainHalfSize = new Vector3();
  private readonly splashLimit: number;
  private readonly rainState = {
    count: -1,
    windX: 0,
    speed: 0,
    floorY: 0,
    center: new Vector3(),
  };
  private initialized = false;
  private disposed = false;
  private splashBudget = 0;

  constructor(
    params: Partial<RainParams> = {},
    private readonly floorY = 0,
    seed: string | number = 'city-rain',
    private readonly shelters: readonly RainShelterDef[] = [],
  ) {
    const t = tuning.city;
    this.params = {
      enabled: true,
      density: t.rainDensity,
      speed: t.rainSpeed,
      windX: t.rainWindX,
      color: t.rainColor,
      opacity: t.rainOpacity,
      ...params,
    };
    this.rng = new Rng(seed);
    this.drops = Array.from(
      { length: Math.max(1, Math.floor(t.rainMax)) },
      () => new Vector3(),
    );
    const material = new MeshBasicMaterial({
      color: this.params.color,
      opacity: this.params.opacity,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    });
    material.userData.bloom = false;
    this.rain = new InstancedMesh(
      new PlaneGeometry(1, 1),
      material,
      this.drops.length,
    );
    this.rain.instanceMatrix.setUsage(DynamicDrawUsage);
    this.rain.frustumCulled = false;
    this.rain.userData.noOutline = true;
    this.rain.count = 0;
    this.splashLimit = Math.max(0, Math.floor(t.rainSplashMax));
    // Pierścienie i krople dzielą łączny limit rozbryzgów.
    this.splashes = new CityParticleBatch(
      Math.max(1, Math.floor(t.rainSplashMax / 2)),
      'ring',
      t.rainOpacity,
    );
    this.splashDrops = new CityParticleBatch(
      Math.max(1, Math.floor(t.rainSplashMax / 2)),
      'drop',
      t.rainOpacity,
    );
    this.splashes.mesh.userData.noOutline = true;
    this.splashDrops.mesh.userData.noOutline = true;
    this.root.add(this.rain, this.splashes.mesh, this.splashDrops.mesh);
  }

  get capacity(): number {
    return this.drops.length;
  }
  get splashCount(): number {
    return this.splashes.pool.count + this.splashDrops.pool.count;
  }

  update(dtWorldS: number, _dtRealS: number, camera: Camera): void {
    if (this.disposed) return;
    if (getLiteFx()) {
      this.root.visible = false;
      return;
    }
    const t = tuning.city;
    const dt = Math.max(0, dtWorldS);
    camera.getWorldPosition(this.cameraPosition);
    const center = this.cameraPosition;
    const count = this.params.enabled
      ? Math.floor(
          this.drops.length * Math.max(0, Math.min(1, this.params.density)),
        )
      : 0;
    this.rain.count = count;
    this.rain.material.color.set(this.params.color);
    this.rain.material.opacity = this.params.opacity;
    this.splashes.setOpacity(this.params.opacity);
    this.splashDrops.setOpacity(this.params.opacity);
    this.splashColor.set(this.params.color);
    this.splashes.pool.step(dt);
    this.splashDrops.pool.step(dt, t.sparkGravity);
    this.splashBudget =
      Math.min(1, this.splashBudget) +
      dt * t.rainSplashRate * Math.max(0, Math.min(1, this.params.density));
    this.direction
      .set(-this.params.windX, Math.max(0, this.params.speed), 0)
      .normalize();
    const length =
      Math.hypot(this.params.windX, this.params.speed) * t.rainExposureS;
    // Konserwatywna obwiednia całej smugi zapobiega wystawaniu końca spod dachu.
    this.rainHalfSize.set(
      (Math.abs(this.direction.x) * length + t.rainStreakWidthM) / 2,
      (Math.abs(this.direction.y) * length + t.rainStreakWidthM) / 2,
      t.rainStreakWidthM / 2,
    );
    const unchanged =
      dt === 0 &&
      this.initialized &&
      this.rainState.count === count &&
      this.rainState.windX === this.params.windX &&
      this.rainState.speed === this.params.speed &&
      this.rainState.floorY === this.floorY &&
      this.rainState.center.equals(center);
    this.rainState.count = count;
    this.rainState.windX = this.params.windX;
    this.rainState.speed = this.params.speed;
    this.rainState.floorY = this.floorY;
    this.rainState.center.copy(center);
    for (let i = 0; i < this.drops.length && !unchanged; i++) {
      const p = this.drops[i]!;
      if (!this.initialized)
        p.set(
          center.x + this.rng.float(-t.rainWidthM / 2, t.rainWidthM / 2),
          center.y + this.rng.float(-t.rainHeightM / 2, t.rainHeightM / 2),
          center.z + this.rng.float(-t.rainDepthM / 2, t.rainDepthM / 2),
        );
      const oldY = p.y;
      if (i < count) {
        p.x += this.params.windX * dt;
        p.y -= Math.max(0, this.params.speed) * dt;
      }
      if (
        i < count &&
        oldY > this.floorY &&
        p.y <= this.floorY &&
        this.splashBudget >= 1 &&
        this.splashLimit >= 2 &&
        dt > 0 &&
        !isRainSheltered(
          this.floorPoint.set(p.x, this.floorY, p.z),
          this.shelters,
        )
      ) {
        this.splashBudget--;
        const ring = this.splashes.pool.spawn(t.rainSplashLifeS);
        ring.x = p.x;
        ring.y = this.floorY + t.surfaceOffsetM;
        ring.z = p.z;
        ring.size = t.rainSplashRadiusM;
        ring.color = this.splashColor.getHex();
        const drop = this.splashDrops.pool.spawn(t.rainSplashLifeS);
        drop.x = p.x;
        drop.y = this.floorY + t.surfaceOffsetM;
        drop.z = p.z;
        drop.vy = this.rng.next() * t.rainSplashRiseMS;
        drop.vx = this.rng.float(-t.rainSplashDriftMS, t.rainSplashDriftMS);
        drop.vz = this.rng.float(-t.rainSplashDriftMS, t.rainSplashDriftMS);
        drop.size = t.dripSizeM;
        drop.color = ring.color;
      }
      p.x = wrapRainAxis(p.x, center.x, t.rainWidthM);
      p.y = wrapRainAxis(p.y, center.y, t.rainHeightM);
      p.z = wrapRainAxis(p.z, center.z, t.rainDepthM);
      if (i >= count) continue;
      this.dummy.position.copy(p);
      this.dummy.quaternion.setFromUnitVectors(this.up, this.direction);
      this.dummy.rotateY(Math.atan2(center.x - p.x, center.z - p.z));
      this.dummy.scale.set(t.rainStreakWidthM, length, 1);
      if (
        p.y < this.floorY ||
        isRainSheltered(p, this.shelters, this.rainHalfSize)
      )
        this.dummy.scale.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.rain.setMatrixAt(i, this.dummy.matrix);
    }
    this.initialized = true;
    if (!unchanged) this.rain.instanceMatrix.needsUpdate = true;
    this.splashes.render(camera, t.splashGrowth);
    this.splashDrops.render(camera);
    this.flash = Math.max(0, this.flash - dt / t.stormFlashS);
    if (
      this.stormEnabled &&
      this.params.enabled &&
      dt > 0 &&
      this.rng.chance(1 - Math.exp(-dt * t.stormRate))
    )
      this.flash = 1;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.flash = 0;
    this.splashes.pool.clear();
    this.splashDrops.pool.clear();
    disposeCityGroup(this.root);
  }
}
