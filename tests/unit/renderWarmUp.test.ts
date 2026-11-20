import { afterEach, expect, it, vi } from 'vitest';
import {
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshNormalMaterial,
  PerspectiveCamera,
  Scene,
  Vector2,
} from 'three';
import type { Object3D, WebGLRenderer, WebGLRenderTarget } from 'three';
import { EventBus } from '../../src/core/events';
import { GameLoop } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import { CommandRegistry } from '../../src/ui/debugCommands';
import { createRenderPipeline } from '../../src/render/outline';
import { applyQuality } from '../../src/render/quality';
import { setRenderWarmUp, warmUpRender } from '../../src/render/renderWarmUp';
import * as staticBatch from '../../src/render/staticBatch';
import { RoomScene } from '../../src/scenes/roomScene';
import { roomDefinitions } from '../../src/world/rooms';
import { RunManager } from '../../src/world/run';
import { loadWaves } from '../../src/world/waves';
import wavesData from '../../src/data/waves/roomTest.json';

afterEach(() => {
  setRenderWarmUp(undefined);
  applyQuality('high');
  vi.restoreAllMocks();
});

function fixture(compileAsync?: (scene: Object3D) => Promise<unknown>) {
  let target: WebGLRenderTarget | null = null;
  const log: string[] = [];
  const culledDuringRender: boolean[] = [];
  const watch: { scene?: Scene } = {};
  const renderer = {
    autoClear: false,
    shadowMap: { enabled: false },
    setPixelRatio: vi.fn(),
    getPixelRatio: () => 1,
    getSize: (out: Vector2) => out.set(320, 180),
    getDrawingBufferSize: (out: Vector2) => out.set(320, 180),
    getRenderTarget: () => target,
    setRenderTarget: (value: WebGLRenderTarget | null) => {
      target = value;
    },
    getClearColor: (out: Color) => out.set('#123456'),
    getClearAlpha: () => 1,
    setClearColor: vi.fn(),
    render: vi.fn((scene: Scene) => {
      log.push('render');
      if (scene === watch.scene)
        scene.traverse((object) =>
          culledDuringRender.push(object.frustumCulled),
        );
    }),
    ...(compileAsync
      ? {
          compileAsync: vi.fn(async (scene: Object3D) => {
            log.push('compile:start');
            await compileAsync(scene);
            log.push('compile:end');
          }),
        }
      : {}),
  };
  const pipeline = createRenderPipeline(renderer as unknown as WebGLRenderer);
  return { renderer, pipeline, log, culledDuringRender, watch };
}

function sceneWithMeshes() {
  const scene = new Scene();
  const group = new Group();
  const meshes = [0, 1].map(() => {
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    group.add(mesh);
    return mesh;
  });
  meshes[1]!.frustumCulled = false;
  scene.add(group);
  return { scene, meshes };
}

it('warmUp kompiluje materiały każdego przebiegu, a dopiero potem rysuje pełny przebieg bez odrzucania poza kadrem', async () => {
  const seen = new Set<unknown>();
  const f = fixture(async (target) => {
    target.traverse((object) => {
      if (object instanceof Mesh) seen.add(object.material);
    });
    await Promise.resolve();
  });
  const { scene, meshes } = sceneWithMeshes();
  const own = meshes.map((mesh) => mesh.material);
  f.watch.scene = scene;
  try {
    await f.pipeline.warmUp(scene, new PerspectiveCamera());
    expect(f.log[0]).toBe('compile:start');
    // Faza 1 niczego nie rysuje: pierwszy prawdziwy render następuje po wszystkich kompilacjach.
    expect(f.log.indexOf('render')).toBeGreaterThan(
      f.log.lastIndexOf('compile:end'),
    );
    // Przebieg normalnych kompiluje materiał nadpisujący, nie własne materiały obiektów.
    expect([...seen].some((m) => m instanceof MeshNormalMaterial)).toBe(true);
    expect([...seen]).toContain(own[0]);
    expect(meshes.map((mesh) => mesh.material)).toEqual(own);
    expect(scene.overrideMaterial).toBeNull();
    expect(f.culledDuringRender.length).toBeGreaterThan(0);
    expect(f.culledDuringRender.every((culled) => !culled)).toBe(true);
    // Flagi wracają: obiekt z własnym frustumCulled=false zostaje taki, jaki był.
    expect(meshes[0]!.frustumCulled).toBe(true);
    expect(meshes[1]!.frustumCulled).toBe(false);
    expect(scene.frustumCulled).toBe(true);
  } finally {
    f.pipeline.dispose();
  }
});

it('warmUp przywraca renderer.render i flagi także po błędzie, a bez compileAsync tylko rysuje', async () => {
  const f = fixture();
  const draw = f.renderer.render;
  const { scene, meshes } = sceneWithMeshes();
  try {
    await f.pipeline.warmUp(scene, new PerspectiveCamera());
    expect(draw).toHaveBeenCalled();
    draw.mockImplementation(() => {
      throw new Error('GPU');
    });
    await expect(
      f.pipeline.warmUp(scene, new PerspectiveCamera()),
    ).rejects.toThrow('GPU');
    expect(meshes[0]!.frustumCulled).toBe(true);
    expect(f.renderer.render).toBe(draw);
  } finally {
    f.pipeline.dispose();
  }
});

it('warmUp przerwany limitem czasu nie rysuje prawdziwego przebiegu', async () => {
  const f = fixture(() => new Promise(() => {}));
  const { scene } = sceneWithMeshes();
  setRenderWarmUp((cancelled) =>
    f.pipeline.warmUp(scene, new PerspectiveCamera(), cancelled),
  );
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    await warmUpRender(20);
    expect(warn).toHaveBeenCalled();
    expect(f.renderer.render).not.toHaveBeenCalled();
  } finally {
    f.pipeline.dispose();
  }
});

it('warmUpRender jest pusty bez renderera i woła zarejestrowaną rozgrzewkę', async () => {
  await expect(warmUpRender()).resolves.toBeUndefined();
  const warm = vi.fn(async () => {});
  setRenderWarmUp(warm);
  await warmUpRender();
  expect(warm).toHaveBeenCalledOnce();
  setRenderWarmUp(undefined);
  await warmUpRender();
  expect(warm).toHaveBeenCalledOnce();
});

it('ciężkie kroki areny (scalanie statyki, nawigacja) kończą się w init(), przed pierwszym render i step', async () => {
  const room = roomDefinitions.get('arenaRooftops')!;
  const bus = new EventBus();
  const commands = new CommandRegistry();
  const run = new RunManager(bus, {
    generateMap: () => ({ sectorId: 'unused', layers: [] }),
  });
  run.newRun('warm', 'classic', { modeId: 'conquest', arenaId: room.id });
  run.selectNode('conquest');
  const scene = new RoomScene(
    room,
    run.state,
    loadWaves({ ...wavesData, spawnPoints: room.spawnPoints }),
    { loadModels: false },
  );
  const batch = vi.spyOn(staticBatch, 'batchStaticGeometry');
  const step = vi.spyOn(scene, 'step');
  const render = vi.spyOn(scene, 'render');
  try {
    await scene.init(
      {
        bus,
        rng: new Rng('warm'),
        loop: new GameLoop({ step() {}, render() {} }),
        tuning: structuredClone(tuning),
        debug: false,
        commands,
        camera: new PerspectiveCamera(),
      },
      new Scene(),
    );
    expect(batch).toHaveBeenCalled();
    expect(Reflect.get(scene, 'navigation')).toBeDefined();
    // init() kończy się jednym render(1) zasiewającym widoki; step() nie biegnie.
    expect(render).toHaveBeenCalledTimes(1);
    expect(step).not.toHaveBeenCalled();
  } finally {
    scene.dispose();
  }
}, 60_000);
