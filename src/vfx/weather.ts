import {
  AdditiveBlending,
  Color,
  DataTexture,
  DoubleSide,
  FloatType,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Matrix3,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  NormalBlending,
  PlaneGeometry,
  Quaternion,
  RGBAFormat,
  Vector2,
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

/**
 * Ruch kropli liczy shader wierzchołków. Atrybuty (stałe po inicjalizacji): `rainStart` — położenie
 * początkowe względem kotwicy, `rainSeed` — (faza, sin(i), parzystość). CPU co klatkę zmienia tylko
 * uniformy: sumy przebytej drogi (`rainShift`, `rainScatter`, `rainSway`), środek zawijania
 * (kamera), pochylenie smugi i rozmiary. Równania muszą odpowiadać `Weather.dropCenter`.
 */
export const RAIN_VERTEX_DECLARATIONS = /* glsl */ `
attribute vec3 rainStart;
attribute vec3 rainSeed;
uniform vec3 rainCenter;
uniform vec3 rainShift;
uniform vec3 rainSpan;
uniform vec3 rainHalf;
uniform vec2 rainScatter;
uniform vec2 rainSway;
uniform vec2 rainSize;
uniform mat3 rainTilt;
uniform float rainFloorY;
uniform float rainNearSq;
uniform float rainShelterCount;
uniform float rainTintMode;
uniform vec3 rainTintA;
uniform vec3 rainTintB;
uniform sampler2D rainShelters;
varying vec3 vRainTint;
`;

export const RAIN_VERTEX_POSITION = /* glsl */ `
vec3 rainRel = rainStart + rainShift;
rainRel.xz += rainSeed.y * rainScatter;
float rainPhase = rainSway.y + rainSeed.x;
rainRel.x += rainSway.x * sin(rainPhase);
rainRel.z -= rainSway.x * cos(rainPhase);
rainRel = mod(rainRel + 0.5 * rainSpan, rainSpan) - 0.5 * rainSpan;
vec3 rainPos = rainCenter + rainRel;
bool rainHidden = rainPos.y < rainFloorY || dot(rainRel, rainRel) < rainNearSq;
for (int s = 0; s < int(rainShelterCount) && !rainHidden; s++) {
  vec3 shelterCenter = texelFetch(rainShelters, ivec2(0, s), 0).xyz;
  vec3 shelterHalf = texelFetch(rainShelters, ivec2(1, s), 0).xyz;
  rainHidden = all(lessThanEqual(abs(rainPos - shelterCenter), shelterHalf + rainHalf));
}
vec2 rainToCamera = rainCenter.xz - rainPos.xz;
float rainDistance = length(rainToCamera);
float rainCos = rainDistance > 0.0 ? rainToCamera.y / rainDistance : 1.0;
float rainSin = rainDistance > 0.0 ? rainToCamera.x / rainDistance : 0.0;
vec3 rainAxisX = (rainCos * rainTilt[0] - rainSin * rainTilt[2]) * rainSize.x;
vec3 rainAxisY = rainTilt[1] * rainSize.y;
vec3 transformed = rainHidden ? rainPos : rainPos + rainAxisX * position.x + rainAxisY * position.y;
vRainTint = rainTintMode > 0.5 ? (rainSeed.z > 0.5 ? rainTintB : rainTintA) : vec3(1.0);
`;

/** Strefy bez deszczu dla shadera: dwa teksele na strefę (środek, połowa wymiarów). */
function shelterTexture(shelters: readonly RainShelterDef[]): DataTexture {
  const data = new Float32Array(Math.max(1, shelters.length) * 8);
  shelters.forEach(({ position, size }, i) => {
    data.set([position.x, position.y, position.z, 0], i * 8);
    data.set([size.x / 2, size.y / 2, size.z / 2, 0], i * 8 + 4);
  });
  const texture = new DataTexture(
    data,
    2,
    Math.max(1, shelters.length),
    RGBAFormat,
    FloatType,
  );
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export class Weather {
  readonly root = new Group();
  readonly rain: Mesh<InstancedBufferGeometry, MeshBasicMaterial>;
  readonly splashes: CityParticleBatch;
  readonly splashDrops: CityParticleBatch;
  readonly params: RainParams;
  flash = 0;
  stormEnabled = false;
  private readonly rng: Rng;
  private readonly dropCount: number;
  private readonly dropStart: Float32Array;
  private readonly dropSeed: Float32Array;
  private readonly tilt = new Quaternion();
  private readonly tiltMatrix = new Matrix4();
  private readonly tilt3 = new Matrix3();
  private readonly shelterTexture: DataTexture;
  readonly rainUniforms = {
    rainCenter: { value: new Vector3() },
    rainShift: { value: new Vector3() },
    rainSpan: { value: new Vector3() },
    rainHalf: { value: new Vector3() },
    rainScatter: { value: new Vector2() },
    rainSway: { value: new Vector2() },
    rainSize: { value: new Vector2() },
    rainTilt: { value: new Matrix3() },
    rainFloorY: { value: 0 },
    rainNearSq: { value: 0 },
    rainShelterCount: { value: 0 },
    rainTintMode: { value: 0 },
    rainTintA: { value: new Color() },
    rainTintB: { value: new Color() },
    rainShelters: { value: null as DataTexture | null },
  };
  private readonly cameraPosition = new Vector3();
  private readonly direction = new Vector3();
  private readonly up = new Vector3(0, 1, 0);
  private readonly splashColor = new Color();
  private readonly dropPoint = new Vector3();
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
  /** Droga przebyta przez wszystkie krople (suma wiatru i opadania), niezależnie od kamery. */
  private readonly travel = new Vector3();
  private readonly anchor = new Vector3();
  private readonly shift = new Vector3();
  private scatterTravel = new Vector2();
  private swayM = 0;
  private swayPhase = 0;
  private fallTimeS = 0;
  private flakeNearSq = 0;
  private dropsDrawn = 0;
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
    this.dropCount = Math.max(1, Math.floor(t.rainMax));
    this.dropStart = new Float32Array(this.dropCount * 3);
    this.dropSeed = new Float32Array(this.dropCount * 3);
    for (let i = 0; i < this.dropCount; i++) {
      this.dropSeed[i * 3] = i % (Math.PI * 2);
      this.dropSeed[i * 3 + 1] = Math.sin(i);
      this.dropSeed[i * 3 + 2] = i % 2;
    }
    this.shelterTexture = shelterTexture(shelters);
    this.rainUniforms.rainShelters.value = this.shelterTexture;
    this.rainUniforms.rainShelterCount.value = shelters.length;
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
      Object.assign(shader.uniforms, this.rainUniforms, {
        flakeMask: this.flakeMask,
        flakeSoftEdge: this.flakeSoftEdge,
        ashEdgeRoughness: this.ashEdgeRoughness,
        ashEdgeFrequency: this.ashEdgeFrequency,
      });
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>\nvarying vec2 vFlakeUv;\n${RAIN_VERTEX_DECLARATIONS}`,
        )
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvFlakeUv = uv;')
        .replace('#include <begin_vertex>', RAIN_VERTEX_POSITION);
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec2 vFlakeUv;
          varying vec3 vRainTint;
          uniform float flakeMask, flakeSoftEdge, ashEdgeRoughness, ashEdgeFrequency;
          float ashHash(vec2 cell) {
            return fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
          }`,
        )
        .replace(
          '#include <color_fragment>',
          '#include <color_fragment>\ndiffuseColor.rgb *= vRainTint;',
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
    const geometry = new InstancedBufferGeometry();
    const quad = new PlaneGeometry(1, 1);
    geometry.index = quad.index;
    geometry.setAttribute('position', quad.getAttribute('position'));
    geometry.setAttribute('uv', quad.getAttribute('uv'));
    geometry.setAttribute('normal', quad.getAttribute('normal'));
    geometry.setAttribute(
      'rainStart',
      new InstancedBufferAttribute(this.dropStart, 3),
    );
    geometry.setAttribute(
      'rainSeed',
      new InstancedBufferAttribute(this.dropSeed, 3),
    );
    geometry.instanceCount = 0;
    this.rain = new Mesh(geometry, material);
    this.rain.frustumCulled = false;
    this.rain.userData.noOutline = true;
    this.rain.visible = false;
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
    return this.dropCount;
  }

  /** Liczba rysowanych kropli w ostatniej klatce. */
  get rainCount(): number {
    return this.dropsDrawn;
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
    this.rainUniforms.rainTintMode.value = flakes ? 1 : 0;
    if (flakes) {
      this.rain.material.color.set('#ffffff');
      this.rainUniforms.rainTintA.value.set(p.color);
      this.rainUniforms.rainTintB.value.set(flakes.secondaryColor);
    }
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
          this.dropCount * Math.max(0, Math.min(1, this.params.density)),
        )
      : 0;
    this.dropsDrawn = count;
    this.rain.geometry.instanceCount = count;
    this.rain.visible = count > 0;
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
    if (!this.initialized) this.seedDrops(center);
    // Pochylenie smugi jest wspólne dla klatki; kropla dokłada tylko obrót wokół Y do kamery.
    this.tiltMatrix.makeRotationFromQuaternion(
      this.tilt.setFromUnitVectors(this.up, flakes ? this.up : this.direction),
    );
    this.tilt3.setFromMatrix4(this.tiltMatrix);
    // Wszystkie krople przebywają tę samą drogę; różnice (rozrzut, kołysanie płatków) liczy shader.
    this.travel.x += this.params.windX * dt;
    this.travel.z += this.windZ * dt;
    this.travel.y -= Math.max(0, this.params.speed) * dt;
    this.fallTimeS += dt;
    this.flakeNearSq = flakes ? tuning.weather.flakeNearM ** 2 : 0;
    this.swayM = flakes?.swayM ?? 0;
    this.swayPhase = flakes
      ? ((this.fallTimeS * Math.PI * 2) / flakes.swayPeriodS) % (Math.PI * 2)
      : 0;
    this.scatterTravel.set(
      flakes ? flakes.windScatter * this.travel.x : 0,
      flakes ? flakes.windScatter * this.travel.z : 0,
    );
    this.shift.set(
      wrapRainAxis(this.anchor.x + this.travel.x - center.x, 0, t.rainWidthM),
      wrapRainAxis(this.anchor.y + this.travel.y - center.y, 0, t.rainHeightM),
      wrapRainAxis(this.anchor.z + this.travel.z - center.z, 0, t.rainDepthM),
    );
    const u = this.rainUniforms;
    u.rainCenter.value.copy(center);
    u.rainShift.value.copy(this.shift);
    u.rainSpan.value.set(t.rainWidthM, t.rainHeightM, t.rainDepthM);
    u.rainHalf.value.copy(this.rainHalfSize);
    u.rainScatter.value.copy(this.scatterTravel);
    u.rainSway.value.set(this.swayM, this.swayPhase);
    u.rainSize.value.set(width, length);
    u.rainTilt.value.copy(this.tilt3);
    u.rainFloorY.value = this.floorY;
    u.rainNearSq.value = this.flakeNearSq;
    if (!flakes && count > 0 && dt > 0) this.spawnSplashes(count, dt);
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

  /** Środek kropli w świecie (te same równania co `RAIN_VERTEX_POSITION`, bez ukrywania). */
  dropCenter(index: number, out: Vector3): Vector3 {
    const t = tuning.city;
    const k = index * 3;
    const sinI = this.dropSeed[k + 1]!;
    const phase = this.swayPhase + this.dropSeed[k]!;
    const center = this.rainUniforms.rainCenter.value;
    return out.set(
      center.x +
        wrapRainAxis(
          this.dropStart[k]! +
            this.shift.x +
            sinI * this.scatterTravel.x +
            this.swayM * Math.sin(phase),
          0,
          t.rainWidthM,
        ),
      center.y +
        wrapRainAxis(this.dropStart[k + 1]! + this.shift.y, 0, t.rainHeightM),
      center.z +
        wrapRainAxis(
          this.dropStart[k + 2]! +
            this.shift.z +
            sinI * this.scatterTravel.y -
            this.swayM * Math.cos(phase),
          0,
          t.rainDepthM,
        ),
    );
  }

  /**
   * Macierz kropli taka, jaką rysuje shader (referencja CPU: testy, rozbryzgi). Zerowa skala
   * oznacza kroplę ukrytą: pod podłogą, zbyt blisko kamery (płatki) albo w strefie osłoniętej.
   */
  dropMatrix(index: number, out: Matrix4): Matrix4 {
    const p = this.dropCenter(index, this.dropPoint);
    const u = this.rainUniforms;
    const center = u.rainCenter.value;
    const rel = this.floorPoint.copy(p).sub(center);
    const e = out.elements;
    e.fill(0);
    e[12] = p.x;
    e[13] = p.y;
    e[14] = p.z;
    e[15] = 1;
    if (
      p.y < this.floorY ||
      rel.lengthSq() < u.rainNearSq.value ||
      isRainSheltered(p, this.shelters, u.rainHalf.value)
    )
      return out;
    const q = this.tiltMatrix.elements;
    const width = u.rainSize.value.x;
    const length = u.rainSize.value.y;
    const dx = center.x - p.x;
    const dz = center.z - p.z;
    const h = Math.hypot(dx, dz);
    const c = h > 0 ? dz / h : 1;
    const s = h > 0 ? dx / h : 0;
    e[0] = (c * q[0]! - s * q[8]!) * width;
    e[1] = (c * q[1]! - s * q[9]!) * width;
    e[2] = (c * q[2]! - s * q[10]!) * width;
    e[4] = q[4]! * length;
    e[5] = q[5]! * length;
    e[6] = q[6]! * length;
    e[8] = s * q[0]! + c * q[8]!;
    e[9] = s * q[1]! + c * q[9]!;
    e[10] = s * q[2]! + c * q[10]!;
    return out;
  }

  /** Położenia początkowe losowane raz, przy pierwszej klatce (stała kolejność RNG). */
  private seedDrops(center: Vector3): void {
    const t = tuning.city;
    this.anchor.copy(center);
    for (let i = 0; i < this.dropCount; i++) {
      this.dropStart[i * 3] = this.rng.float(
        -t.rainWidthM / 2,
        t.rainWidthM / 2,
      );
      this.dropStart[i * 3 + 1] = this.rng.float(
        -t.rainHeightM / 2,
        t.rainHeightM / 2,
      );
      this.dropStart[i * 3 + 2] = this.rng.float(
        -t.rainDepthM / 2,
        t.rainDepthM / 2,
      );
    }
    const start = this.rain.geometry.getAttribute('rainStart');
    start.needsUpdate = true;
    this.initialized = true;
  }

  /**
   * Rozbryzg powstaje tam, gdzie losowo wybrana kropla przecina w tej klatce podłogę.
   * Pozycje liczy `dropCenter`, więc nie trzeba przeglądać wszystkich kropli.
   */
  private spawnSplashes(count: number, dt: number): void {
    const t = tuning.city;
    if (this.splashLimit < 2) return;
    const fall = Math.max(0, this.params.speed) * dt;
    const p = this.dropPoint;
    let spawned = 0;
    while (this.splashBudget >= 1 && spawned < this.splashLimit) {
      let hit = false;
      for (let probe = 0; probe < tuning.weather.splashProbes; probe++) {
        this.dropCenter(this.rng.int(0, count - 1), p);
        if (p.y > this.floorY || p.y + fall <= this.floorY) continue;
        if (
          isRainSheltered(
            this.floorPoint.set(p.x, this.floorY, p.z),
            this.shelters,
          )
        )
          continue;
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
        hit = true;
        break;
      }
      if (!hit) break;
      this.splashBudget--;
      spawned++;
    }
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
    this.shelterTexture.dispose();
    disposeCityGroup(this.root);
  }
}
