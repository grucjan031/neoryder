import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  FogExp2,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
} from 'three';
import type { Scene as ThreeScene } from 'three';
import type { GameContext } from '../core/context';
import type { InputSnapshot } from '../core/input';
import { SignRenderer } from '../render/city/signs';
import { CityLights } from '../render/city/lights';
import { DecalRenderer } from '../render/city/decals';
import { cityVertex, disposeCityGroup } from '../render/city/resources';
import { Weather } from '../vfx/weather';
import { AmbientFx } from '../vfx/ambientFx';
import type {
  CityLightDef,
  SignDef,
  FlickerDef,
} from '../world/dressingSchema';
import type { Scene } from './index';

const colors = [
  '#ffae1a',
  '#6dff4a',
  '#8a5cff',
  '#3d7bff',
  '#fff1d6',
  '#ffae1a',
];
// Od wejścia: bursztyn = buzz, zieleń = fail, fiolet = pulse (powtórzone dalej).
const patterns: FlickerDef['pattern'][] = ['buzz', 'fail', 'pulse'];
const signs: SignDef[] = colors.map((tint, i) => ({
  kind: 'neon',
  texture: ['ramen', 'hotel', 'bar_24h', 'karaoke', 'sake', 'open'][i]!,
  position: {
    x: i === 0 ? -3.8 : i === 1 ? 3.8 : i % 2 ? 5.76 : -5.76,
    y: i < 2 ? 4.5 : 3.2 + (i % 2) * 1.3,
    z: i < 2 ? -21.7 : 4 - i * 4,
  },
  size: { w: i < 2 ? 3.4 : 3, h: 1.4 },
  yaw: i < 2 ? 0 : i % 2 ? -Math.PI / 2 : Math.PI / 2,
  tint,
  flicker: { pattern: patterns[i % patterns.length]! },
}));
signs.push(
  {
    kind: 'holo',
    texture: 'holo_android',
    position: { x: -3.6, y: 2.8, z: -8 },
    size: { w: 1.3, h: 2.6 },
    yaw: 0.3,
    tint: '#8a5cff',
    flicker: 0.4,
  },
  {
    kind: 'holo',
    texture: 'holo_koi',
    position: { x: 3.6, y: 3, z: -15 },
    size: { w: 3, h: 1.5 },
    yaw: -0.4,
    tint: '#3d7bff',
    flicker: 0.2,
  },
);
const lights: CityLightDef[] = colors.map((color, i) => ({
  position: { x: i % 2 ? 4.7 : -4.7, y: 3.3, z: 3 - i * 4 },
  color,
  intensity: 24,
  range: 10,
  flicker: { pattern: patterns[i % patterns.length]! },
}));

/** Samodzielny pokaz oprawy; WASD, mysz, Spacja/Ctrl pionowo, Shift szybciej. */
export class CityFxTest implements Scene {
  readonly id = 'city-fx-test';
  private readonly root = new Group();
  private readonly position = new Vector3(0, 2.3, 10);
  private readonly previous = this.position.clone();
  private yaw = 0;
  private pitch = -0.035;
  private worldDt = 0;
  private ctx!: GameContext;
  private three!: ThreeScene;
  private previousBackground: ThreeScene['background'] = null;
  private previousFog: ThreeScene['fog'] = null;
  private previousAtmosphere?: { skyGradient: number; fogStrength: number };
  private signRenderer!: SignRenderer;
  private decalRenderer!: DecalRenderer;
  private cityLights!: CityLights;
  private weather!: Weather;
  private ambient!: AmbientFx;
  private off?: () => void;
  private offStorm?: () => void;

  init(ctx: GameContext, three: ThreeScene): void {
    this.ctx = ctx;
    this.three = three;
    this.previousBackground = three.background;
    this.previousFog = three.fog;
    this.previousAtmosphere = {
      skyGradient: ctx.tuning.render.skyGradient,
      fogStrength: ctx.tuning.render.fogStrength,
    };
    ctx.tuning.render.skyGradient = 0;
    ctx.tuning.render.fogStrength = 0;
    three.background = new Color('#070b16');
    three.fog = new FogExp2('#242337', 0.025);
    three.add(this.root);
    const ambient = new AmbientLight('#8d9dcb', 1.2);
    const moon = new DirectionalLight('#a3b5da', 2.3);
    moon.position.set(-6, 15, 3);
    this.root.add(ambient, moon);
    const box = (
      size: [number, number, number],
      pos: [number, number, number],
      color = '#2a3344',
      metalness = 0.15,
    ): void => {
      const mesh = new Mesh(
        new BoxGeometry(...size),
        new MeshStandardMaterial({
          color,
          roughness: 0.4,
          metalness,
          flatShading: true,
        }),
      );
      mesh.position.set(...pos);
      this.root.add(mesh);
    };
    box([14, 0.25, 60], [0, -0.125, -10], '#171f2e', 0.65);
    box([1, 0.18, 44], [-5.5, 0.09, -8], '#56627a');
    box([1, 0.18, 44], [5.5, 0.09, -8], '#56627a');
    box([2, 12, 46], [-7, 6, -8]);
    box([2, 15, 46], [7, 7.5, -8], '#343d50');
    box([14, 8, 0.5], [0, 4, -22], '#2e3648');
    for (let i = 0; i < 6; i++) {
      const z = 5 - i * 4.5;
      box([0.12, 2.6, 2.6], [-5.93, 1.5, z], '#182132', 0.6);
      box([0.12, 2.6, 2.6], [5.93, 1.5, z], '#1a2333', 0.6);
      for (let j = 0; j < 9; j++) {
        box([0.18, 0.025, 2.6], [-5.82, 0.35 + j * 0.29, z], '#46526a', 0.65);
        box([0.18, 0.025, 2.6], [5.82, 0.35 + j * 0.29, z], '#46526a', 0.65);
      }
      box([0.65, 0.7, 1], [5.65, 5.5, z], '#56627a', 0.65);
      box([1.3, 0.12, 2.6], [-5.4, 6.5, z], '#374357', 0.7);
      box([12, 0.035, 0.035], [0, 7.2 + (i % 2), z], '#111827');
      box([0.6, 0.035, 0.8], [-3, 0.025, z], '#101722', 0.8);
    }
    box([0.9, 0.9, 0.9], [3.6, 0.45, -3], '#d9dde3');
    const sky = new Mesh(
      new PlaneGeometry(180, 100),
      new ShaderMaterial({
        vertexShader: cityVertex,
        fragmentShader: `varying vec2 vUv; void main() { vec3 horizon = mix(vec3(0.227,0.165,0.165), vec3(0.169,0.122,0.239), vUv.x); gl_FragColor = vec4(mix(horizon, vec3(0.027,0.043,0.086), smoothstep(0.05,0.8,vUv.y)),1.0);\n #include <colorspace_fragment>\n }`,
        depthWrite: false,
      }),
    );
    sky.position.set(0, 30, -70);
    this.root.add(sky);
    const windowMaterial = new MeshBasicMaterial({
      color: '#fff1d6',
      transparent: true,
      opacity: 0.45,
      toneMapped: false,
    });
    windowMaterial.userData.bloom = true;
    const windows = new InstancedMesh(
      new PlaneGeometry(0.22, 0.4),
      windowMaterial,
      180,
    );
    const matrix = new Matrix4();
    let index = 0;
    const rng = ctx.rng.fork('skyline');
    for (let i = 0; i < 12; i++) {
      const x = (i - 5.5) * 4,
        height = rng.float(14, 28),
        z = -38 - rng.float(0, 10);
      box([3, height, 3], [x, height / 2, z], '#161d2e');
      for (let j = 0; j < 15; j++) {
        matrix.makeTranslation(
          x + rng.float(-1.1, 1.1),
          rng.float(3, height - 1),
          z + 1.52,
        );
        windows.setMatrixAt(index++, matrix);
      }
    }
    windows.instanceMatrix.needsUpdate = true;
    this.root.add(windows);
    this.signRenderer = new SignRenderer(
      signs,
      ctx.rng.fork('city-signs').getState(),
    );
    this.cityLights = new CityLights(
      lights,
      0,
      ctx.rng.fork('city-lights').getState(),
    );
    this.decalRenderer = new DecalRenderer([
      {
        texture: 'graffiti_tag1',
        position: { x: -5.78, y: 1.5, z: -4 },
        size: { w: 1.2, h: 1.5 },
        yaw: Math.PI / 2,
        surface: 'wall',
        opacity: 0.65,
      },
      {
        texture: 'poster_torn1',
        position: { x: 5.78, y: 1.5, z: -9 },
        size: { w: 1, h: 1.6 },
        yaw: -Math.PI / 2,
        surface: 'wall',
        opacity: 0.8,
      },
      {
        texture: 'floor_arrow',
        position: { x: 0, y: 0, z: -5 },
        size: { w: 2, h: 4 },
        yaw: 0,
        surface: 'floor',
        opacity: 0.5,
      },
    ]);
    this.weather = new Weather({}, 0, ctx.rng.fork('rain').getState());
    this.ambient = new AmbientFx(
      [
        { kind: 'steam', position: { x: -3, y: 0.05, z: -2 } },
        { kind: 'steam', position: { x: 3, y: 0.05, z: -12 } },
        { kind: 'sparks', position: { x: -4.8, y: 4.5, z: -7 } },
        { kind: 'drip', position: { x: 4.6, y: 5, z: -1 } },
      ],
      0,
      ctx.rng.fork('ambient').getState(),
    );
    this.root.add(
      this.signRenderer.root,
      this.cityLights.root,
      this.decalRenderer.root,
      this.weather.root,
      this.ambient.root,
    );
    this.offStorm = ctx.commands?.register(
      'storm',
      'storm <0|1> — błyski burzy',
      (args) => {
        if (args.length !== 1 || (args[0] !== '0' && args[0] !== '1'))
          return 'Użycie: storm <0|1>';
        this.weather.stormEnabled = args[0] === '1';
        return `Burza: ${args[0]}`;
      },
    );
    this.off = ctx.commands?.register(
      'rain',
      'rain <0..1> — gęstość deszczu',
      (args) => {
        const value = Number(args[0]);
        if (
          args.length !== 1 ||
          !Number.isFinite(value) ||
          value < 0 ||
          value > 1
        )
          return 'Użycie: rain <0..1>';
        this.weather.params.density = value;
        return `Deszcz: ${value}`;
      },
    );
    this.render(1, 0);
  }

  step(dt: number, input: InputSnapshot): void {
    this.worldDt += dt;
    this.previous.copy(this.position);
    if (!(dt > 0)) return;
    this.yaw -= input.lookDelta.x * this.ctx.tuning.player.lookSensitivity;
    this.pitch = Math.max(
      -Math.PI / 2 + 0.01,
      Math.min(
        Math.PI / 2 - 0.01,
        this.pitch - input.lookDelta.y * this.ctx.tuning.player.lookSensitivity,
      ),
    );
    const forward =
      Number(input.held.has('moveForward')) -
      Number(input.held.has('moveBack'));
    const right =
      Number(input.held.has('moveRight')) - Number(input.held.has('moveLeft'));
    const speed =
      (input.held.has('sprint')
        ? this.ctx.tuning.player.sprintSpeed
        : this.ctx.tuning.player.walkSpeed) * dt;
    this.position.x +=
      (right * Math.cos(this.yaw) - forward * Math.sin(this.yaw)) * speed;
    this.position.z +=
      (-forward * Math.cos(this.yaw) - right * Math.sin(this.yaw)) * speed;
    this.position.y = Math.max(
      0.3,
      this.position.y +
        (Number(input.held.has('jump')) - Number(input.held.has('crouch'))) *
          speed,
    );
  }

  render(alpha: number, frameDt = 0): void {
    const camera = this.ctx.camera;
    if (!camera) {
      this.worldDt = 0;
      return;
    }
    camera.position.lerpVectors(this.previous, this.position, alpha);
    camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    camera.updateMatrixWorld();
    const city = this.ctx.tuning.city;
    Object.assign(this.weather.params, {
      speed: city.rainSpeed,
      windX: city.rainWindX,
      color: city.rainColor,
      opacity: city.rainOpacity,
    });
    this.signRenderer.update(this.worldDt, frameDt, camera);
    this.cityLights.update(this.worldDt, frameDt, camera);
    this.weather.update(this.worldDt, frameDt, camera);
    this.ambient.update(this.worldDt, frameDt, camera);
    this.ctx.tuning.render.skyFlash = this.weather.flash * city.stormFlash;
    this.worldDt = 0;
  }

  query(name: string): unknown {
    if (name === 'city')
      return {
        rain: this.weather.rain.count,
        splashes: this.weather.splashCount,
        lights: this.cityLights.pool.length,
        steam: this.ambient.steam.pool.count,
        sparks: this.ambient.sparks.pool.count,
      };
    return undefined;
  }

  dispose(): void {
    this.off?.();
    this.offStorm?.();
    this.ctx.tuning.render.skyFlash = 0;
    this.signRenderer.dispose();
    this.decalRenderer.dispose();
    this.cityLights.dispose();
    this.weather.dispose();
    this.ambient.dispose();
    disposeCityGroup(this.root);
    this.three.background = this.previousBackground;
    this.three.fog = this.previousFog;
    if (this.previousAtmosphere)
      Object.assign(this.ctx.tuning.render, this.previousAtmosphere);
  }
}
