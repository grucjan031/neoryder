import {
  AdditiveBlending,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  NormalBlending,
  PlaneGeometry,
  Quaternion,
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
import type { WeatherProfile } from '../render/weatherSchema';

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
  private readonly tilt = new Quaternion();
  private readonly tiltMatrix = new Matrix4();
  private readonly cameraPosition = new Vector3();
  private readonly direction = new Vector3();
  private readonly up = new Vector3(0, 1, 0);
  private readonly splashColor = new Color();
  private readonly flakeColor = new Color();
  private readonly flakeMask = { value: 0 };
  private readonly flakeSoftEdge = { value: tuning.weather.flakeSoftEdge };
  private readonly ashEdgeRoughness = {
    value: tuning.weather.ashEdgeRoughness,
  };
  private readonly ashEdgeFrequency = {
    value: tuning.weather.ashEdgeFrequency,
  };
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
  private profile?: WeatherProfile;
  private elapsed = 0;
  private nextFlash = 0;
  private windZ = 0;
  private dust?: CityParticleBatch;
  private dustBudget = 0;

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
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, {
        flakeMask: this.flakeMask,
        flakeSoftEdge: this.flakeSoftEdge,
        ashEdgeRoughness: this.ashEdgeRoughness,
        ashEdgeFrequency: this.ashEdgeFrequency,
      });
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying vec2 vFlakeUv;',
        )
        .replace(
          '#include <uv_vertex>',
          '#include <uv_vertex>\nvFlakeUv = uv;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec2 vFlakeUv;
          uniform float flakeMask, flakeSoftEdge, ashEdgeRoughness, ashEdgeFrequency;
          float ashHash(vec2 cell) {
            return fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
          }`,
        )
        .replace(
          '#include <alphamap_fragment>',
          `#include <alphamap_fragment>
          if (flakeMask > 0.0) {
            vec2 p = vFlakeUv * 2.0 - 1.0;
            float edge = 1.0;
            if (flakeMask > 1.0) {
              vec2 pos = p * ashEdgeFrequency;
              vec2 cell = floor(pos), f = smoothstep(vec2(0.0), vec2(1.0), fract(pos));
              float noise = mix(mix(ashHash(cell), ashHash(cell + vec2(1, 0)), f.x),
                mix(ashHash(cell + vec2(0, 1)), ashHash(cell + vec2(1, 1)), f.x), f.y);
              edge -= ashEdgeRoughness * noise;
            }
            diffuseColor.a *= 1.0 - smoothstep(edge - flakeSoftEdge, edge, length(p));
          }`,
        );
    };
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

  setProfile(profile: WeatherProfile): void {
    this.profile = profile;
    const p = profile.precipitation;
    Object.assign(this.params, {
      enabled: p.kind !== 'none',
      density: p.density,
      speed: p.speed,
      color: p.color,
      opacity: p.opacity,
    });
    const flakes = p.kind === 'snow' || p.kind === 'ash' ? p.flakes : undefined;
    this.flakeMask.value = flakes ? (p.kind === 'ash' ? 2 : 1) : 0;
    this.rain.material.blending = flakes ? NormalBlending : AdditiveBlending;
    this.rain.material.needsUpdate = true;
    if (flakes) {
      this.rain.material.color.set('#ffffff');
      for (let i = 0; i < this.capacity; i++) {
        this.flakeColor.set(i % 2 === 0 ? p.color : flakes.secondaryColor);
        this.rain.setColorAt(i, this.flakeColor);
      }
    } else if (this.rain.instanceColor) {
      this.flakeColor.set('#ffffff');
      for (let i = 0; i < this.capacity; i++)
        this.rain.setColorAt(i, this.flakeColor);
    }
    if (this.rain.instanceColor) this.rain.instanceColor.needsUpdate = true;
    this.stormEnabled = profile.lightning.enabled;
    this.flash = 0;
    this.elapsed = 0;
    this.nextFlash = this.rng.float(
      profile.lightning.minIntervalS,
      profile.lightning.maxIntervalS,
    );
    this.splashes.pool.clear();
    this.splashDrops.pool.clear();
    this.dust?.pool.clear();
    this.dustBudget = 0;
    if (profile.dust.density > 0 && !this.dust) {
      this.dust = new CityParticleBatch(
        tuning.weather.dustMax,
        'steam',
        profile.dust.opacity,
      );
      this.dust.mesh.userData.noOutline = true;
      this.root.add(this.dust.mesh);
    }
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
    this.root.visible = true;
    this.elapsed += dt;
    const profile = this.profile;
    if (profile) {
      const w = profile.wind;
      const strength =
        w.strength *
        (1 +
          w.gustStrength *
            Math.sin((this.elapsed * Math.PI * 2) / w.gustPeriodS));
      const length = Math.hypot(w.direction.x, w.direction.z);
      this.params.windX = (w.direction.x / length) * strength;
      this.windZ = (w.direction.z / length) * strength;
    }
    camera.getWorldPosition(this.cameraPosition);
    const center = this.cameraPosition;
    const count = this.params.enabled
      ? Math.floor(
          this.drops.length * Math.max(0, Math.min(1, this.params.density)),
        )
      : 0;
    this.rain.count = count;
    const flakes =
      profile &&
      (profile.precipitation.kind === 'snow' ||
        profile.precipitation.kind === 'ash')
        ? profile.precipitation.flakes
        : undefined;
    this.rain.material.color.set(flakes ? '#ffffff' : this.params.color);
    this.flakeSoftEdge.value = tuning.weather.flakeSoftEdge;
    this.ashEdgeRoughness.value = tuning.weather.ashEdgeRoughness;
    this.ashEdgeFrequency.value = tuning.weather.ashEdgeFrequency;
    const flakeNearSq = tuning.weather.flakeNearM ** 2;
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
      .set(-this.params.windX, Math.max(0, this.params.speed), -this.windZ)
      .normalize();
    const length =
      flakes?.sizeM ??
      Math.hypot(this.params.windX, this.params.speed, this.windZ) *
        (profile?.precipitation.exposureS ?? t.rainExposureS);
    const width =
      flakes?.sizeM ?? profile?.precipitation.widthM ?? t.rainStreakWidthM;
    // Konserwatywna obwiednia całej smugi zapobiega wystawaniu końca spod dachu.
    this.rainHalfSize.set(
      (Math.abs(this.direction.x) * length + width) / 2,
      (Math.abs(this.direction.y) * length + width) / 2,
      (Math.abs(this.direction.z) * length + width) / 2,
    );
    const unchanged =
      !profile &&
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
    // Pochylenie smugi jest wspólne dla klatki; kropla dokłada tylko obrót wokół Y do kamery.
    const q = this.tiltMatrix.makeRotationFromQuaternion(
      this.tilt.setFromUnitVectors(this.up, flakes ? this.up : this.direction),
    ).elements;
    const q0x = q[0]!,
      q0y = q[1]!,
      q0z = q[2]!;
    const q1x = q[4]! * length,
      q1y = q[5]! * length,
      q1z = q[6]! * length;
    const q2x = q[8]!,
      q2y = q[9]!,
      q2z = q[10]!;
    const out = this.rain.instanceMatrix.array;
    // Krople poza rysowaną pulą są tylko losowane w pierwszej klatce (stała kolejność RNG);
    // zawijanie jest okresowe, więc wystarczy je wykonać, gdy kropla wróci do puli.
    const active = unchanged ? 0 : this.initialized ? count : this.drops.length;
    for (let i = 0; i < active; i++) {
      const p = this.drops[i]!;
      if (!this.initialized)
        p.set(
          center.x + this.rng.float(-t.rainWidthM / 2, t.rainWidthM / 2),
          center.y + this.rng.float(-t.rainHeightM / 2, t.rainHeightM / 2),
          center.z + this.rng.float(-t.rainDepthM / 2, t.rainDepthM / 2),
        );
      const oldY = p.y;
      if (i < count) {
        if (flakes) {
          const phase = (this.elapsed * Math.PI * 2) / flakes.swayPeriodS + i;
          const flutter = flakes.swayM * ((Math.PI * 2) / flakes.swayPeriodS);
          const scatter = 1 + flakes.windScatter * Math.sin(i);
          p.x += (this.params.windX * scatter + Math.cos(phase) * flutter) * dt;
          p.z += (this.windZ * scatter + Math.sin(phase) * flutter) * dt;
        } else {
          p.x += this.params.windX * dt;
          p.z += this.windZ * dt;
        }
        p.y -= Math.max(0, this.params.speed) * dt;
      }
      if (
        !flakes &&
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
      const o = i * 16;
      out[o + 3] = 0;
      out[o + 7] = 0;
      out[o + 11] = 0;
      out[o + 12] = p.x;
      out[o + 13] = p.y;
      out[o + 14] = p.z;
      out[o + 15] = 1;
      if (
        p.y < this.floorY ||
        (flakes && p.distanceToSquared(center) < flakeNearSq) ||
        isRainSheltered(p, this.shelters, this.rainHalfSize)
      ) {
        out.fill(0, o, o + 11);
        continue;
      }
      // cos/sin kąta atan2(dx, dz) bez funkcji trygonometrycznych.
      const dx = center.x - p.x;
      const dz = center.z - p.z;
      const h = Math.hypot(dx, dz);
      const c = h > 0 ? dz / h : 1;
      const s = h > 0 ? dx / h : 0;
      out[o] = (c * q0x - s * q2x) * width;
      out[o + 1] = (c * q0y - s * q2y) * width;
      out[o + 2] = (c * q0z - s * q2z) * width;
      out[o + 4] = q1x;
      out[o + 5] = q1y;
      out[o + 6] = q1z;
      out[o + 8] = s * q0x + c * q2x;
      out[o + 9] = s * q0y + c * q2y;
      out[o + 10] = s * q0z + c * q2z;
    }
    this.initialized = true;
    if (!unchanged) {
      // Do GPU trafia tylko rysowany zakres; zakresy z nierenderowanych klatek nie narastają.
      this.rain.instanceMatrix.clearUpdateRanges();
      if (count > 0) {
        this.rain.instanceMatrix.addUpdateRange(0, count * 16);
        this.rain.instanceMatrix.needsUpdate = true;
      }
    }
    this.splashes.render(camera, t.splashGrowth);
    this.splashDrops.render(camera);
    if (profile) {
      this.flash = Math.max(0, this.flash - dt / profile.lightning.decayS);
      if (this.stormEnabled && this.elapsed >= this.nextFlash && dt > 0) {
        this.flash = profile.lightning.brightness;
        this.nextFlash =
          this.elapsed +
          this.rng.float(
            profile.lightning.minIntervalS,
            profile.lightning.maxIntervalS,
          );
      }
      this.updateDust(dt, camera, profile);
      return;
    }
    this.flash = Math.max(0, this.flash - dt / t.stormFlashS);
    if (
      this.stormEnabled &&
      this.params.enabled &&
      dt > 0 &&
      this.rng.chance(1 - Math.exp(-dt * t.stormRate))
    )
      this.flash = 1;
  }

  private updateDust(
    dt: number,
    camera: Camera,
    profile: WeatherProfile,
  ): void {
    if (!this.dust) return;
    const p = profile.dust;
    this.dust.mesh.visible = p.density > 0;
    this.dust.setOpacity(p.opacity);
    this.dust.pool.step(dt);
    this.dustBudget += (dt * tuning.weather.dustMax * p.density) / p.lifeS;
    while (this.dustBudget >= 1) {
      this.dustBudget--;
      const d = this.dust.pool.spawn(p.lifeS);
      d.x =
        this.cameraPosition.x +
        this.rng.float(-tuning.city.rainWidthM / 2, tuning.city.rainWidthM / 2);
      d.y =
        this.cameraPosition.y +
        this.rng.float(
          -tuning.city.rainHeightM / 2,
          tuning.city.rainHeightM / 2,
        );
      d.z =
        this.cameraPosition.z +
        this.rng.float(-tuning.city.rainDepthM / 2, tuning.city.rainDepthM / 2);
      d.vx = this.params.windX;
      d.vz = this.windZ;
      d.size = p.sizeM;
      d.color = this.splashColor.set(p.color).getHex();
    }
    this.dust.render(camera);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.flash = 0;
    this.splashes.pool.clear();
    this.splashDrops.pool.clear();
    this.dust?.pool.clear();
    disposeCityGroup(this.root);
  }
}
