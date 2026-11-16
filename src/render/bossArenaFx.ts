import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
} from 'three';
import type { BufferGeometry } from 'three';
import type { EntityId, EventBus } from '../core/events';
import type { Vec3 } from '../core/math';
import type { Tuning } from '../core/tuning';
import type { BossPattern } from '../enemies/enemySchema';
import type { Enemy } from '../enemies/types';
import { getLiteFx } from './fxMode';
import type { StyleLights } from './lights';

export interface BossArenaFxOptions {
  /** Wróg po id — tylko odczyt snapshotu i definicji. */
  enemy(id: EntityId): Enemy | undefined;
  floorY: number;
  tuning: Pick<Tuning, 'vfx' | 'enemies'>;
  /** Iskry w punkcie (pula sceny); bez niej rozpad obywa się bez iskier. */
  burstSparks?(point: Vec3, count: number, color: number): void;
}

const WAVES = 4;
const COLUMNS = 4;
const SPARK_RED = 0xff3028;
const SPARK_HOT = 0xffd8bd;
/** Wysokość nad podłogą: nad kałużami i kalkomaniami, bez migotania głębi. */
const FLOOR_LIFT_M = 0.04;

const vertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vLocal;
  void main() {
    vUv = uv;
    vLocal = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const head = /* glsl */ `
  uniform vec3 uColor, uHot;
  uniform float uOpacity, uTime, uProgress, uMode, uSpread, uRays, uSize;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vLocal;
  const float PI = 3.14159265;
`;

/** Pole rażenia na podłodze. uMode: 0 uderzenie (okrąg), 1 wachlarz, 2 wezwanie, 3 tarcza. */
const zoneFragment = /* glsl */ `
  ${head}
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;
    // Kąt 0 wzdłuż lokalnego +Z (przód bossa).
    float a = atan(p.x, -p.y);
    float alpha = 0.0;
    float hot = 0.0;
    if (uMode < 0.5) {
      float rim = smoothstep(0.93, 0.955, r) * (1.0 - smoothstep(0.985, 1.0, r));
      float inside = 1.0 - step(uProgress, r);
      float front = smoothstep(uProgress - 0.14, uProgress, r) * inside;
      float ticks = step(0.5, fract(a / PI * 18.0)) * smoothstep(0.86, 0.93, r) * (1.0 - step(0.93, r));
      alpha = rim + front * 0.75 + inside * (0.1 + 0.12 * uProgress) + ticks * 0.35 + 0.035;
      hot = front * 0.7 + rim * smoothstep(0.8, 1.0, uProgress);
    } else if (uMode < 1.5) {
      float halfSpread = uSpread * 0.5;
      float sector = 1.0 - smoothstep(halfSpread, halfSpread + 0.03, abs(a));
      float t = (a + halfSpread) / max(uSpread, 1e-4) * (uRays - 1.0);
      float nearest = abs(t - floor(t + 0.5)) * uSpread / max(uRays - 1.0, 1.0);
      // Stała szerokość promienia w metrach niezależnie od odległości od bossa.
      float width = nearest * r * uSize;
      float ray = (1.0 - smoothstep(0.05, 0.16, width)) * sector;
      float reach = 1.0 - smoothstep(uProgress - 0.05, uProgress, r);
      float fade = pow(1.0 - r, 0.6) * smoothstep(0.03, 0.09, r);
      float tip = smoothstep(uProgress - 0.1, uProgress, r) * reach;
      alpha = (ray * (0.75 + tip) + sector * 0.07) * reach * fade;
      hot = ray * tip;
    } else if (uMode < 2.5) {
      float rings = pow(abs(sin((r * 3.0 - uTime * 1.3) * PI)), 10.0);
      float spokes = pow(abs(sin(a * 3.0 + uTime * 1.6)), 24.0) * smoothstep(0.35, 0.6, r);
      float rim = smoothstep(0.93, 0.96, r) * (1.0 - smoothstep(0.985, 1.0, r));
      alpha = (rings * 0.55 + spokes * 0.6 + rim) * (0.35 + 0.65 * uProgress) * (1.0 - r * 0.35);
      hot = spokes * uProgress;
    } else {
      float rings = pow(abs(sin((r * 3.0 + uTime * 1.8) * PI)), 10.0);
      float rim = smoothstep(0.93, 0.96, r) * (1.0 - smoothstep(0.985, 1.0, r));
      float core = (1.0 - smoothstep(0.0, 0.5, r)) * uProgress;
      alpha = (rings * 0.5 + rim * 0.8 + core * 0.5) * (0.35 + 0.65 * uProgress);
      hot = core;
    }
    vec3 color = mix(uColor, uHot, clamp(hot, 0.0, 1.0));
    gl_FragColor = vec4(color * 1.25, clamp(alpha * uOpacity, 0.0, 1.0));
  }
`;

/** Czoło fali: jasna krawędź na zewnętrznym brzegu i słabnący ślad do środka. */
const waveFragment = /* glsl */ `
  ${head}
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;
    float front = smoothstep(1.0 - uProgress, 0.97, r) * (1.0 - smoothstep(0.97, 1.0, r));
    float edge = smoothstep(0.93, 0.975, r) * (1.0 - smoothstep(0.975, 1.0, r));
    vec3 color = mix(uColor, uHot, edge * 0.8);
    gl_FragColor = vec4(color * 1.3, clamp((front * 0.45 + edge) * uOpacity, 0.0, 1.0));
  }
`;

const glowFragment = /* glsl */ `
  ${head}
  void main() {
    float r = length(vUv * 2.0 - 1.0);
    float glow = pow(max(0.0, 1.0 - r), 2.0);
    float ring = smoothstep(0.52, 0.56, r) * (1.0 - smoothstep(0.58, 0.62, r));
    gl_FragColor = vec4(mix(uColor, uHot, glow * 0.35), clamp((glow + ring * 0.35 * uProgress) * uOpacity, 0.0, 1.0));
  }
`;

/** Powłoka nietykalności: krawędź fresnela i pasy skanu wędrujące w górę. */
const auraFragment = /* glsl */ `
  ${head}
  void main() {
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    float fres = pow(1.0 - facing, 1.8);
    float bands = pow(abs(sin((vLocal.y * 5.0 - uTime * 2.2) * PI)), 14.0);
    float lattice = pow(abs(sin(atan(vLocal.x, vLocal.z) * 6.0)), 30.0) * 0.5;
    float a = fres * 1.1 + (bands + lattice) * (0.25 + fres * 0.6) + 0.04;
    gl_FragColor = vec4(mix(uColor, uHot, clamp(fres * 0.8 + bands * 0.4, 0.0, 1.0)) * 1.3, clamp(a * uOpacity, 0.0, 1.0));
  }
`;

/** Rozbłysk wizjera: pozioma smuga i jądro (billboard). */
const flareFragment = /* glsl */ `
  ${head}
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float streak = exp(-abs(p.y) * 26.0) * pow(max(0.0, 1.0 - abs(p.x)), 2.0);
    float core = exp(-length(p * vec2(1.0, 3.2)) * 7.0);
    float halo = exp(-length(p * vec2(1.0, 3.2)) * 2.6) * 0.35;
    float a = streak * 0.9 + core * 1.4 + halo;
    gl_FragColor = vec4(mix(uColor, uHot, clamp(core * 1.6 + streak * 0.5, 0.0, 1.0)) * 1.4, clamp(a * uOpacity, 0.0, 1.0));
  }
`;

/** Słup światła: jasny u podstawy, gaśnie ku górze; krawędzie bryły miękkie. */
const columnFragment = /* glsl */ `
  ${head}
  void main() {
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    float body = pow(facing, 1.5);
    float rise = pow(1.0 - vUv.y, 1.6);
    float streaks = 0.75 + 0.25 * sin(vUv.x * PI * 16.0 + uTime * 3.0);
    gl_FragColor = vec4(mix(uColor, uHot, body * rise) * 1.3, clamp(body * rise * streaks * uOpacity, 0.0, 1.0));
  }
`;

type FxMesh = Mesh<BufferGeometry, ShaderMaterial>;

interface Wave {
  mesh: FxMesh;
  age: number;
  life: number;
  radius: number;
  delay: number;
  strength: number;
}

interface Column {
  mesh: FxMesh;
  age: number;
  life: number;
  radius: number;
  height: number;
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const easeOut = (v: number): number => 1 - (1 - clamp01(v)) ** 3;

/**
 * Oprawa walki z bossem (kosmetyka): zapowiedź wejścia, poświata pod bossem, pola rażenia
 * telegrafów na podłodze, fale i powłoka nietykalności przy zmianie fazy, rozpad po śmierci
 * oraz nastrój świateł areny. Słucha `EventBus` i czyta snapshot bossa; nie zmienia symulacji
 * poza istniejącymi zdarzeniami „feel” (`camera_shake`, `slowmo`). W `fx=lite` wyłączona.
 */
export class BossArenaFx {
  readonly root = new Group();
  private readonly off: (() => void)[] = [];
  private readonly lite = getLiteFx();
  private readonly color: Color;
  private readonly hot: Color;
  private readonly plane = new PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  private readonly quad = new PlaneGeometry(2, 2);
  private readonly shell = new IcosahedronGeometry(1, 3);
  private readonly tube = new CylinderGeometry(1, 1, 1, 20, 1, true).translate(
    0,
    0.5,
    0,
  );
  private readonly materials: ShaderMaterial[] = [];
  private readonly glow: FxMesh;
  private readonly zone: FxMesh;
  private readonly aura: FxMesh;
  private readonly flare: FxMesh;
  private readonly waves: Wave[] = [];
  private readonly columns: Column[] = [];
  private readonly pendingMinions: EntityId[] = [];
  private bossId: EntityId | null = null;
  private phase = 1;
  private phases = 1;
  private timeS = 0;
  /** Czas od pojawienia się bossa; −1 = bez zapowiedzi. */
  private introS = -1;
  private woke = false;
  /** Czas od śmierci bossa; −1 = żyje. */
  private deathS = -1;
  private deathSparks = 0;
  private readonly deathPoint = { x: 0, y: 0, z: 0 };
  private flarePulse = 0;
  private lightFlash = 0;
  private tint = 0;
  private lastState: string | undefined;
  private lastKind: string | undefined;

  constructor(
    private readonly bus: EventBus,
    private readonly opts: BossArenaFxOptions,
  ) {
    this.root.name = 'boss-arena-fx';
    this.color = new Color(opts.tuning.vfx.bossColor);
    this.hot = new Color(opts.tuning.vfx.bossHotColor);
    this.glow = this.mesh(this.plane, glowFragment);
    this.zone = this.mesh(this.plane, zoneFragment);
    this.aura = this.mesh(this.shell, auraFragment);
    this.flare = this.mesh(this.quad, flareFragment);
    this.flare.onBeforeRender = (_r, _s, camera) => {
      this.flare.quaternion.copy(camera.quaternion);
      this.flare.updateMatrixWorld();
    };
    for (let i = 0; i < WAVES; i++)
      this.waves.push({
        mesh: this.mesh(this.plane, waveFragment),
        age: 0,
        life: 0,
        radius: 1,
        delay: 0,
        strength: 1,
      });
    for (let i = 0; i < COLUMNS; i++)
      this.columns.push({
        mesh: this.mesh(this.tube, columnFragment),
        age: 0,
        life: 0,
        radius: 1,
        height: 1,
      });
    if (this.lite) return;
    this.off.push(
      bus.on('boss_spawned', ({ id }) => {
        this.bossId = id;
        this.phase = 1;
        this.introS = 0;
        this.woke = false;
        this.deathS = -1;
        this.tint = 0;
      }),
      bus.on('boss_phase', ({ id, phase, phases }) => {
        if (id !== this.bossId) return;
        this.phase = phase;
        this.phases = phases;
        const boss = this.opts.enemy(id);
        if (!boss) return;
        const t = this.opts.tuning.vfx;
        const p = boss.current.position;
        this.wave(p, t.bossWaveRadiusM, t.bossWaveS, 0, 1);
        this.wave(p, t.bossWaveRadiusM * 0.6, t.bossWaveS * 0.8, 0.14, 0.6);
        this.flarePulse = 1;
        this.lightFlash = 1;
        this.bus.emit('camera_shake', {
          intensity: t.bossPhaseShake,
          durationS: t.bossPhaseShakeS,
          dir: null,
        });
      }),
      bus.on('entity_spawned', ({ id }) => {
        if (this.bossId !== null && id !== this.bossId)
          this.pendingMinions.push(id);
      }),
      bus.on('enemy_killed', ({ id }) => {
        if (id !== this.bossId) return;
        const boss = this.opts.enemy(id);
        if (boss) this.die(boss);
      }),
    );
  }

  private mesh(geometry: BufferGeometry, fragment: string): FxMesh {
    const material = new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        uColor: { value: this.color },
        uHot: { value: this.hot },
        uOpacity: { value: 0 },
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uMode: { value: 0 },
        uSpread: { value: 1 },
        uRays: { value: 5 },
        uSize: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    material.userData.bloom = true;
    this.materials.push(material);
    const mesh = new Mesh(geometry, material);
    mesh.userData.noOutline = true;
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.renderOrder = 6;
    this.root.add(mesh);
    return mesh;
  }

  private wave(
    at: Vec3,
    radius: number,
    life: number,
    delay: number,
    strength: number,
  ): void {
    const slot =
      this.waves.find((w) => w.age >= w.life) ??
      this.waves.reduce((a, b) => (a.age > b.age ? a : b));
    slot.age = 0;
    slot.life = life;
    slot.delay = delay;
    slot.radius = radius;
    slot.strength = strength;
    slot.mesh.position.set(at.x, this.opts.floorY + FLOOR_LIFT_M, at.z);
  }

  private column(at: Vec3, radius: number, height: number, life: number): void {
    const slot =
      this.columns.find((c) => c.age >= c.life) ??
      this.columns.reduce((a, b) => (a.age > b.age ? a : b));
    slot.age = 0;
    slot.life = life;
    slot.radius = radius;
    slot.height = height;
    slot.mesh.position.set(at.x, this.opts.floorY, at.z);
  }

  private die(boss: Enemy): void {
    const t = this.opts.tuning.vfx;
    const p = boss.current.position;
    this.deathS = 0;
    this.deathSparks = 0;
    this.pendingMinions.length = 0;
    this.deathPoint.x = p.x;
    this.deathPoint.y = this.opts.floorY + (boss.definition.body?.centerY ?? 1);
    this.deathPoint.z = p.z;
    this.wave(p, t.bossWaveRadiusM * 0.35, 0.3, 0, 1.2);
    this.wave(p, t.bossWaveRadiusM * 1.15, t.bossWaveS * 1.25, 0.18, 1);
    this.wave(p, t.bossWaveRadiusM * 1.15, t.bossWaveS * 1.7, 0.5, 0.5);
    this.column(p, 1.5, 34, t.bossDeathFxS);
    this.flarePulse = 1;
    this.lightFlash = 1.4;
    this.bus.emit('camera_shake', {
      intensity: t.bossDeathShake,
      durationS: t.bossDeathShakeS,
      dir: null,
    });
    this.bus.emit('slowmo', {
      timeScale: t.bossDeathSlowmo,
      durationS: t.bossDeathSlowmoS,
    });
  }

  private pattern(boss: Enemy, kind: string): BossPattern | undefined {
    const phases = boss.definition.boss?.phases ?? [];
    return (
      phases[this.phase - 1]?.patterns.find((p) => p.kind === kind) ??
      phases.flatMap((p) => p.patterns).find((p) => p.kind === kind)
    );
  }

  /** Nastrój areny: przyciemnienie na wejściu, błysk i czerwony odcień wg fazy. Wołać po `lights.sync()`. */
  applyLights(lights: StyleLights): void {
    if (this.lite || this.bossId === null) return;
    const t = this.opts.tuning.vfx;
    let level = 1;
    if (this.introS >= 0 && this.introS < t.bossIntroS) {
      const rise = easeOut(
        (this.introS - t.bossWakeAtS) / (t.bossIntroS - t.bossWakeAtS),
      );
      level = t.bossIntroDim + (1 - t.bossIntroDim) * rise;
    }
    if (this.deathS >= 0) {
      // Po błysku arena przygasa i wraca do spokoju: „cisza” po walce.
      const calm = clamp01(this.deathS / t.bossDeathFxS);
      level *= 0.6 + 0.4 * calm * calm;
    }
    level *= 1 + this.lightFlash * (t.bossPhaseFlash - 1);
    lights.hemisphere.intensity *= level;
    lights.key.intensity *= level;
    if (this.tint > 1e-3) {
      lights.hemisphere.color.lerp(this.color, this.tint);
      lights.hemisphere.groundColor.lerp(this.color, this.tint * 0.5);
      lights.key.color.lerp(this.color, this.tint * 0.7);
    }
  }

  render(alpha: number, frameDt: number): void {
    if (this.lite) return;
    const dt = Math.max(0, Math.min(frameDt, 0.1));
    const t = this.opts.tuning.vfx;
    this.timeS += dt;
    for (const m of this.materials) m.uniforms.uTime!.value = this.timeS;
    this.flarePulse = Math.max(0, this.flarePulse - dt * 2.2);
    this.lightFlash = Math.max(0, this.lightFlash - dt * 2.6);
    this.stepWaves(dt);
    this.stepColumns(dt);
    const boss =
      this.bossId === null ? undefined : this.opts.enemy(this.bossId);
    const alive = !!boss && !boss.removed && boss.current.state !== 'dead';
    const tintTarget =
      alive && this.phases > 1
        ? (t.bossPhaseTint * (this.phase - 1)) / (this.phases - 1)
        : 0;
    this.tint += (tintTarget - this.tint) * (1 - Math.exp(-dt * 3));
    if (this.deathS >= 0) this.stepDeath(dt);
    if (!boss || !alive) {
      this.glow.visible = this.deathS >= 0 && this.deathS < 0.9;
      if (this.glow.visible) {
        const k = this.deathS / 0.9;
        this.glow.scale.setScalar(t.bossGlowRadiusM * (1.4 + k * 1.6));
        this.glow.material.uniforms.uOpacity!.value = (1 - k) * 0.9;
      }
      this.zone.visible = this.aura.visible = false;
      this.flare.visible = this.deathS >= 0 && this.flarePulse > 0.01;
      if (this.flare.visible) {
        this.flare.position.set(
          this.deathPoint.x,
          this.deathPoint.y,
          this.deathPoint.z,
        );
        this.flare.scale.set(9 * this.flarePulse, 2.6 * this.flarePulse, 1);
        this.flare.material.uniforms.uOpacity!.value = this.flarePulse;
      }
      this.lastState = undefined;
      return;
    }
    this.resolveMinions();
    const a = boss.previous;
    const b = boss.current;
    const k = clamp01(alpha);
    const x = a.position.x + (b.position.x - a.position.x) * k;
    const z = a.position.z + (b.position.z - a.position.z) * k;
    const yaw =
      a.yaw + Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw)) * k;
    const floor = this.opts.floorY + FLOOR_LIFT_M;
    const time =
      a.state === b.state
        ? a.stateTimeS + (b.stateTimeS - a.stateTimeS) * k
        : b.stateTimeS;

    // Zapowiedź: po chwili ciemności wizjer rozbłyska i od bossa idzie fala.
    let presence = 1;
    if (this.introS >= 0) {
      this.introS += dt;
      if (!this.woke && this.introS >= t.bossWakeAtS) {
        this.woke = true;
        this.flarePulse = 1;
        this.wave(b.position, t.bossWaveRadiusM, t.bossWaveS * 1.2, 0, 0.9);
      }
      presence = this.woke ? clamp01((this.introS - t.bossWakeAtS) / 0.35) : 0;
      if (this.introS >= t.bossIntroS) this.introS = -1;
    }

    const telegraph = b.state === 'telegraph' && !!b.attack;
    const shift = b.state === 'recovery' && !b.attack;
    if (telegraph && this.lastState !== 'telegraph') this.flarePulse = 0.85;
    // Trafienie uderzenia: krótki błysk pola i fala o promieniu ataku.
    if (b.state === 'swing' && this.lastState === 'telegraph') {
      const slam =
        this.lastKind === 'slam' ? this.pattern(boss, 'slam') : undefined;
      if (slam?.kind === 'slam')
        this.wave(b.position, slam.radiusM, 0.28, 0, 1.3);
    }
    this.lastState = b.state;
    this.lastKind = b.attack?.kind;

    // Poświata pod bossem: tętno przyspiesza z fazą.
    const beat = 0.5 + 0.5 * Math.sin(this.timeS * (2.2 + this.phase * 1.4));
    this.glow.visible = presence > 0.01;
    this.glow.position.set(x, floor, z);
    this.glow.scale.setScalar(
      t.bossGlowRadiusM * (1 + (this.phase - 1) * 0.22),
    );
    this.glow.material.uniforms.uOpacity!.value =
      presence *
      (0.3 + this.phase * 0.08 + beat * 0.12 + (telegraph ? 0.25 : 0));
    this.glow.material.uniforms.uProgress!.value = this.phase / this.phases;

    this.zone.visible = false;
    if (telegraph && b.attack) {
      const pattern = this.pattern(boss, b.attack.kind);
      const progress = clamp01(time / Math.max(b.attack.telegraphS, 1e-3));
      const u = this.zone.material.uniforms;
      let radius = 0;
      if (pattern?.kind === 'slam') {
        radius = pattern.radiusM;
        u.uMode!.value = 0;
      } else if (pattern?.kind === 'fan') {
        radius = t.bossFanLengthM;
        u.uMode!.value = 1;
        u.uSpread!.value = Math.max((pattern.spreadDeg * Math.PI) / 180, 0.02);
        u.uRays!.value = pattern.projectileCount;
      } else if (pattern?.kind === 'summon') {
        radius = 3.2;
        u.uMode!.value = 2;
      } else if (pattern?.kind === 'shield') {
        radius = 2.8;
        u.uMode!.value = 3;
      }
      if (radius > 0) {
        this.zone.visible = true;
        this.zone.position.set(x, floor + 0.01, z);
        this.zone.rotation.y = yaw;
        this.zone.scale.setScalar(radius);
        u.uSize!.value = radius;
        u.uProgress!.value = progress;
        // Wejście w 80 ms, pulsowanie tuż przed trafieniem.
        const urgency = progress > 0.75 ? 0.75 + 0.25 * Math.sin(time * 40) : 1;
        u.uOpacity!.value = clamp01(time / 0.08) * urgency;
      }
    }

    // Nietykalność przejścia fazy: powłoka gaśnie razem z końcem osłony.
    const shiftS = Math.max(this.opts.tuning.enemies.phaseShiftS, 1e-3);
    const body = boss.definition.body;
    this.aura.visible = shift && time < shiftS && !!body;
    if (this.aura.visible && body) {
      const left = 1 - time / shiftS;
      const pop = 1 + 0.35 * (1 - easeOut(time / 0.25));
      const r = t.bossAuraRadiusM * pop;
      this.aura.position.set(x, this.opts.floorY + body.centerY, z);
      this.aura.scale.set(r, (body.height / 2 + 0.35) * pop, r);
      this.aura.material.uniforms.uOpacity!.value =
        clamp01(left * 4) * (0.75 + 0.25 * Math.sin(this.timeS * 18));
    }

    // Rozbłysk wizjera: przebudzenie, start telegrafu, zmiana fazy.
    this.flare.visible = this.flarePulse > 0.01 && !!body;
    if (this.flare.visible && body) {
      const reach = body.radius + 0.1;
      this.flare.position.set(
        x + Math.sin(yaw) * reach,
        this.opts.floorY + body.headY,
        z + Math.cos(yaw) * reach,
      );
      const s = 0.6 + this.flarePulse * 0.9;
      this.flare.scale.set(3.4 * s, 0.9 * s, 1);
      this.flare.material.uniforms.uOpacity!.value = this.flarePulse;
    }
  }

  private stepWaves(dt: number): void {
    for (const w of this.waves) {
      if (w.age >= w.life) {
        w.mesh.visible = false;
        continue;
      }
      if (w.delay > 0) {
        w.delay -= dt;
        w.mesh.visible = false;
        continue;
      }
      w.age += dt;
      const k = clamp01(w.age / w.life);
      w.mesh.visible = k < 1;
      w.mesh.scale.setScalar(Math.max(0.01, w.radius * easeOut(k)));
      const u = w.mesh.material.uniforms;
      u.uProgress!.value = 0.12 + 0.3 * (1 - k);
      u.uOpacity!.value = (1 - k) ** 1.5 * w.strength;
    }
  }

  private stepColumns(dt: number): void {
    for (const c of this.columns) {
      if (c.age >= c.life) {
        c.mesh.visible = false;
        continue;
      }
      c.age += dt;
      const k = clamp01(c.age / c.life);
      c.mesh.visible = k < 1;
      const r = c.radius * (0.25 + 0.75 * (1 - easeOut(k)));
      c.mesh.scale.set(r, c.height, r);
      c.mesh.material.uniforms.uOpacity!.value =
        Math.min(1, k * 14) * (1 - k) ** 1.2;
    }
  }

  private stepDeath(dt: number): void {
    this.deathS += dt;
    // Trzy rzuty iskier: wybuch, żar, dogasanie.
    const bursts: [number, number, number][] = [
      [0, 46, SPARK_HOT],
      [0.16, 34, SPARK_RED],
      [0.42, 22, SPARK_RED],
    ];
    while (this.deathSparks < bursts.length) {
      const [at, count, color] = bursts[this.deathSparks]!;
      if (this.deathS < at) break;
      this.opts.burstSparks?.({ ...this.deathPoint }, count, color);
      this.deathSparks++;
    }
    if (this.deathS > this.opts.tuning.vfx.bossDeathFxS + 0.5) {
      this.deathS = -1;
      this.bossId = null;
    }
  }

  /** Słup światła w miejscu, gdzie boss wezwał sługę (pozycja znana dopiero po spawnie). */
  private resolveMinions(): void {
    for (const id of this.pendingMinions.splice(0)) {
      const minion = this.opts.enemy(id);
      if (minion && minion.definition.kind !== 'boss')
        this.column(minion.current.position, 0.9, 9, 0.7);
    }
  }

  dispose(): void {
    for (const off of this.off.splice(0)) off();
    this.root.removeFromParent();
    this.root.clear();
    for (const m of this.materials) m.dispose();
    this.plane.dispose();
    this.quad.dispose();
    this.shell.dispose();
    this.tube.dispose();
  }
}
