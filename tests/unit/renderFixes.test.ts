import { afterEach, expect, it, vi } from 'vitest';
import { loadoutDefinitions } from '../../src/progression/loadout';
import {
  AdditiveBlending,
  Color,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Texture,
  Vector3,
} from 'three';
import type { Material, WebGLRenderer } from 'three';
import { BloomPass, isSeeThrough } from '../../src/render/bloom';
import { selectCityLights, CityLights } from '../../src/render/city/lights';
import { CityTextures } from '../../src/render/city/resources';
import { hideNoOutline } from '../../src/render/noOutline';
import { SceneAtmosphere } from '../../src/render/sceneAtmosphere';
import { Panorama } from '../../src/render/panorama';
import { RoomScene } from '../../src/scenes/roomScene';
import { EventBus } from '../../src/core/events';
import { GameLoop } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import { Weather } from '../../src/vfx/weather';
import { roomDefinitions } from '../../src/world/rooms';
import { loadWaves } from '../../src/world/waves';
import { CommandRegistry } from '../../src/ui/debugCommands';
import wavesData from '../../src/data/waves/roomTest.json';

const defaults = structuredClone(tuning.city);
const panoramaDefault = tuning.render.panoramaEnabled;
afterEach(() => {
  Object.assign(tuning.city, defaults);
  tuning.render.panoramaEnabled = panoramaDefault;
  vi.restoreAllMocks();
});

function maskRenderer(onRender: () => void) {
  const clear = new Color();
  return {
    getClearColor: (out: Color) => out.copy(clear),
    getClearAlpha: () => 1,
    setClearColor: () => undefined,
    setRenderTarget: () => undefined,
    getRenderTarget: () => null,
    autoClear: true,
    render: vi.fn(onRender),
  } as unknown as WebGLRenderer;
}

it('maska bloomu ukrywa przezroczyste siatki zamiast zasłaniać nimi neony, a potem je przywraca', () => {
  const scene = new Scene();
  const glass = new MeshBasicMaterial({ transparent: true });
  const additive = new MeshBasicMaterial({
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const solid = new MeshStandardMaterial();
  const neon = new MeshBasicMaterial({ color: '#ff00ff' });
  const geometry = new PlaneGeometry();
  const meshes = [glass, additive, solid, neon].map(
    (m) => new Mesh(geometry, m),
  );
  const rain = new InstancedMesh(geometry, glass, 4);
  scene.add(...meshes, rain);
  const seen: { visible: boolean; material: Material | Material[] }[] = [];
  const renderer = maskRenderer(() => {
    if (seen.length) return;
    for (const m of [...meshes, rain])
      seen.push({ visible: m.visible, material: m.material });
  });
  const pass = new BloomPass(64, 64);
  pass.render(renderer, scene, new PerspectiveCamera());
  expect(seen.map((s) => s.visible)).toEqual([false, false, true, true, false]);
  expect(seen[2]!.material).not.toBe(solid);
  expect(seen[3]!.material).toBe(neon);
  expect(meshes.map((m) => m.visible)).toEqual([true, true, true, true]);
  expect(rain.visible).toBe(true);
  expect(meshes[0]!.material).toBe(glass);
  expect(meshes[2]!.material).toBe(solid);
  expect(isSeeThrough(solid)).toBe(false);
  expect(isSeeThrough(neon)).toBe(false);
  pass.dispose();
});

const defs = [
  { position: new Vector3(0, 0, -10), range: 3, color: '#fff', intensity: 1 },
  { position: new Vector3(0, 0, -5), range: 3, color: '#fff', intensity: 1 },
  { position: new Vector3(0, 0, 50), range: 3, color: '#fff', intensity: 1 },
];

it('selectCityLights zapisuje do podanej tablicy i zachowuje kolejność', () => {
  const camera = new PerspectiveCamera(60, 1, 0.1, 100);
  camera.updateMatrixWorld();
  const out: number[] = [9, 9, 9];
  const result = selectCityLights(defs, camera, 5, out);
  expect(result).toBe(out);
  expect(out).toEqual([1, 0]);
  expect(selectCityLights(defs, camera, 1, out)).toEqual([1]);
});

it('CityLights.update używa tych samych obiektów roboczych między klatkami', () => {
  const lights = new CityLights(defs);
  const camera = new PerspectiveCamera(60, 1, 0.1, 100);
  lights.update(0, 0.016, camera);
  const first = lights as unknown as Record<string, unknown>;
  const { selected, wanted, assigned } = first;
  lights.update(0, 0.016, camera);
  expect(first.selected).toBe(selected);
  expect(first.wanted).toBe(wanted);
  expect(first.assigned).toBe(assigned);
  lights.dispose();
});

it('Weather nie wysyła instanceMatrix przy dt=0 bez zmian, ale robi to po ruchu kamery', () => {
  tuning.city.rainMax = 40;
  const weather = new Weather({ density: 1 });
  const camera = new PerspectiveCamera();
  weather.update(0.016, 0.016, camera);
  const version = weather.rain.instanceMatrix.version;
  weather.update(0, 0, camera);
  expect(weather.rain.instanceMatrix.version).toBe(version);
  camera.position.x += 3;
  weather.update(0, 0, camera);
  expect(weather.rain.instanceMatrix.version).toBeGreaterThan(version);
  weather.dispose();
});

it('hideNoOutline ukrywa i przywraca obiekty, także przy wielokrotnym przywracaniu', () => {
  const scene = new Scene();
  const mesh = new Mesh();
  mesh.userData.noOutline = true;
  scene.add(mesh);
  const restore = hideNoOutline(scene);
  expect(mesh.visible).toBe(false);
  restore();
  restore();
  expect(mesh.visible).toBe(true);
});

it('panele panoramy mają flagę noOutline', () => {
  tuning.render.panoramaEnabled = 1;
  const panorama = new Panorama('seed', 0);
  panorama.sync(0);
  const panels = panorama.children.filter(
    (c) => c instanceof Mesh && !(c instanceof InstancedMesh),
  );
  expect(panels).toHaveLength(3);
  for (const panel of panels) expect(panel.userData.noOutline).toBe(true);
  panorama.dispose();
});

it('SceneAtmosphere.sync po dispose nic nie tworzy', () => {
  const scene = new Scene();
  const atmosphere = new SceneAtmosphere(scene, 'white', 'x', 0);
  atmosphere.dispose();
  const count = scene.children.length;
  atmosphere.sync(0.1);
  expect(scene.children).toHaveLength(count);
});

it('CityTextures zwalnia zastępczą teksturę po załadowaniu i cache-uje po (folder, id)', () => {
  const loads: ((t: Texture) => void)[] = [];
  const textures = new CityTextures((_url, ok) => loads.push(ok));
  const accepted: Texture[] = [];
  textures.request('signs', 'a', (t) => accepted.push(t));
  const fallback = accepted[0]!;
  const dispose = vi.spyOn(fallback, 'dispose');
  const real = new Texture();
  loads[0]!(real);
  expect(dispose).toHaveBeenCalled();
  textures.request('signs', 'a', (t) => accepted.push(t));
  expect(accepted[2]).toBe(real);
  expect(loads).toHaveLength(1);
  textures.dispose();
});

it('RoomScene woła CityDressing.render po ustawieniu kamery i ma strażnik disposed w init', async () => {
  const room = roomDefinitions.get('alleyMarket')!;
  const waves = loadWaves({ ...wavesData, spawnPoints: room.spawnPoints });
  const run = {
    seed: 's',
    sectorId: 'test',
    loadoutId: 'classic',
    loadout: loadoutDefinitions.get('classic')!,
    talents: [],
    threatLevel: 0,
    startedAtMs: 0,
    elapsedS: 0,
    map: {
      sectorId: 'test',
      layers: [[{ id: 'node', layer: 2, index: 0, type: 'combat', next: [] }]],
    },
    currentNodeId: 'node',
    visited: [],
    hp: 100,
    energy: 50,
    credits: 0,
    implants: [],
    stats: { kills: 0, damage: { melee: 0, power: 0, gun: 0, other: 0 } },
  } as unknown as ConstructorParameters<typeof RoomScene>[1];
  const camera = new PerspectiveCamera(75, 1, 0.1, 220);
  camera.position.set(100, 100, 100);
  const make = () => {
    const scene = new RoomScene(room, run, waves, { loadModels: false });
    const three = new Scene();
    const init = scene.init(
      {
        bus: new EventBus(),
        commands: new CommandRegistry(),
        rng: new Rng('s'),
        loop: new GameLoop({ step() {}, render() {} }),
        tuning: structuredClone(tuning),
        debug: false,
        camera,
      } as unknown as Parameters<RoomScene['init']>[0],
      three,
    );
    return { scene, three, init };
  };
  const first = make();
  await first.init;
  const dressing = Reflect.get(first.scene, 'dressing') as {
    render: (dt: number, camera: PerspectiveCamera) => void;
  };
  expect(dressing).toBeTruthy();
  const positions: Vector3[] = [];
  const original = dressing.render.bind(dressing);
  dressing.render = (dt, cam) => {
    positions.push(new Vector3().setFromMatrixPosition(cam.matrixWorld));
    original(dt, cam);
  };
  first.scene.render(1, 1 / 60);
  expect(positions).toHaveLength(1);
  expect(positions[0]!.distanceTo(camera.position)).toBeLessThan(1e-6);
  expect(camera.position.x).not.toBe(100);
  first.scene.dispose();

  const second = make();
  second.scene.dispose();
  await second.init;
  expect(second.three.children).toHaveLength(0);
});
