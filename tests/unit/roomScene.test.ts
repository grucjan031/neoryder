import { afterEach, expect, it, vi } from 'vitest';
import { Mesh, Scene as ThreeScene } from 'three';
import type { DamageSystem } from '../../src/combat/damage';
import { powerDefinitions } from '../../src/combat/powers/registry';
import type { RoomDefinition } from '../../src/world/roomSchema';
import { RoomScene } from '../../src/scenes/roomScene';
import type { RoomSceneOptions } from '../../src/scenes/roomScene';
import { EventBus } from '../../src/core/events';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import type { RunState } from '../../src/core/runTypes';
import type { Action, InputSnapshot } from '../../src/core/input';
import { Rng } from '../../src/core/rng';
import { Stats } from '../../src/core/stats';
import { tuning } from '../../src/core/tuning';
import { initPhysics } from '../../src/physics';
import { loadImplant } from '../../src/progression/implantSchema';
import { loadoutDefinitions } from '../../src/progression/loadout';
import { roomDefinitions } from '../../src/world/rooms';
import { loadWaves } from '../../src/world/waves';
import { CommandRegistry } from '../../src/ui/debugCommands';
import wavesData from '../../src/data/waves/roomTest.json';

const idle: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};
const press = (action: Action): InputSnapshot => ({
  ...idle,
  held: new Set([action]),
  pressed: new Set([action]),
});
const active = new Set<RoomScene>();

function runState(overrides: Partial<RunState> = {}): RunState {
  const loadoutId = overrides.loadoutId ?? 'classic';
  return {
    seed: 'room-unit',
    sectorId: 'test',
    loadoutId,
    loadout: loadoutDefinitions.get(loadoutId)!,
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
    hp: 37,
    energy: 23,
    credits: 0,
    implants: [],
    stats: { kills: 0, damage: { melee: 0, power: 0, gun: 0, other: 0 } },
    ...overrides,
  };
}

async function setup(
  run = runState(),
  bus = new EventBus(),
  roomId: string | RoomDefinition = 'combatYard',
  options: RoomSceneOptions = {},
) {
  const room =
    typeof roomId === 'string' ? roomDefinitions.get(roomId)! : roomId;
  const waves = loadWaves({ ...wavesData, spawnPoints: room.spawnPoints });
  const scene = new RoomScene(room, run, waves, {
    loadModels: false,
    ...options,
  });
  const commands = new CommandRegistry();
  const three = new ThreeScene();
  await scene.init(
    {
      bus,
      commands,
      rng: new Rng(run.seed).fork(`room:${run.currentNodeId}`),
      loop: new GameLoop({ step() {}, render() {} }),
      tuning: structuredClone(tuning),
      debug: false,
    },
    three,
  );
  active.add(scene);
  return { scene, commands, three, bus };
}

function dispose(scene: RoomScene): void {
  scene.dispose();
  active.delete(scene);
}

function untilFighting(scene: RoomScene): void {
  for (let i = 0; i < 300 && scene.query('phase') !== 'fighting'; i++)
    scene.step(SIM_DT, idle);
  expect(scene.query('phase')).toBe('fighting');
}

// EventBus celowo nie udostępnia licznika w publicznym kontrakcie.
function handlerCount(bus: EventBus): number {
  const handlers = Reflect.get(bus, 'handlers') as Map<unknown, unknown[]>;
  return [...handlers.values()].reduce((total, list) => total + list.length, 0);
}

it('zagłuszenie gracza blokuje Pchnięcie bez kosztu energii, po wygaśnięciu moc działa', async () => {
  const { scene, bus } = await setup(runState({ energy: 100 }));
  const denied = vi.fn();
  const used = vi.fn();
  const expired = vi.fn();
  const applied = vi.fn();
  bus.on('power_denied', denied);
  bus.on('power_used', used);
  bus.on('status_expired', expired);
  bus.on('status_applied', applied);
  // Nakładamy status przez rzeczywiste obrażenia, bez rozszerzania API sceny.
  const damage = Reflect.get(scene, 'damage') as DamageSystem;
  damage.deal(scene.playerId, {
    source: null,
    amount: 2,
    tags: ['#power'],
    statuses: [{ id: 'jammed', durationS: 3 }],
  });
  expect(applied).toHaveBeenCalledExactlyOnceWith({
    target: scene.playerId,
    status: 'jammed',
    stacks: 1,
    durationS: 3,
    source: null,
  });
  const energyBefore = scene.exportState().energy;
  scene.step(SIM_DT, press('power'));
  expect(denied).toHaveBeenCalledExactlyOnceWith({
    power: 'push',
    user: scene.playerId,
    reason: 'jammed',
  });
  expect(used).not.toHaveBeenCalled();
  expect(scene.exportState().energy).toBe(energyBefore);

  for (let i = 1; i < Math.round(3 / SIM_DT); i++) scene.step(SIM_DT, idle);
  expect(expired).toHaveBeenCalledExactlyOnceWith({
    target: scene.playerId,
    status: 'jammed',
  });
  expect(used).not.toHaveBeenCalled();
  scene.step(SIM_DT, press('power'));
  expect(used).toHaveBeenCalledExactlyOnceWith({
    power: 'push',
    user: scene.playerId,
  });
  expect(denied).toHaveBeenCalledTimes(1);
  expect(scene.exportState().energy).toBe(
    energyBefore - powerDefinitions.get('push')!.cost,
  );
});

afterEach(() => {
  for (const scene of active) scene.dispose();
  active.clear();
  vi.restoreAllMocks();
});

it('przenosi HP 37, odejmuje obrażenia, eksportuje energię i nie leczy między pokojami', async () => {
  const run = runState();
  const original = structuredClone(run);
  const { scene, commands, bus } = await setup(run);
  expect(scene.exportState()).toEqual({ hp: 37, energy: 23 });
  commands.execute('hurt 12');
  scene.step(SIM_DT, press('power'));
  scene.clear();
  const resources = scene.exportState();
  expect(resources).toEqual({ hp: 25, energy: 13 });
  expect(run).toEqual(original);
  dispose(scene);
  const next = await setup({ ...run, ...resources }, bus, 'combatPillars');
  expect(next.scene.exportState()).toEqual(resources);
  for (let i = 0; i < 30; i++) next.scene.step(SIM_DT, idle);
  expect(next.scene.query('playerHp')).toBe(25);
});

it('zamyka fizyczne drzwi i otwiera exit dopiero po ostatniej fali, emitując zdarzenia raz i w kolejności', async () => {
  const bus = new EventBus();
  const events: unknown[] = [];
  bus.on('room_entered', (payload) => events.push({ entered: payload }));
  bus.on('room_cleared', (payload) => events.push({ cleared: payload }));
  const { scene, commands, three } = await setup(runState(), bus);
  commands.execute('god');
  expect(scene.query('doors')).toEqual({
    entry: { role: 'entry', open: false },
    exit: { role: 'exit', open: false },
  });
  expect(three.getObjectByName('door:entry')?.visible).toBe(true);
  expect(events).toEqual([
    {
      entered: {
        nodeId: 'node',
        roomId: 'combatYard',
        type: 'combat',
        layer: 2,
      },
    },
  ]);
  untilFighting(scene);
  commands.execute('kill all');
  expect(events).toHaveLength(1);
  expect(scene.query('roomCleared')).toBe(false);
  untilFighting(scene);
  const cleared = vi.fn(() =>
    expect(scene.query('doors')).toMatchObject({
      exit: { open: true },
    }),
  );
  bus.on('room_cleared', cleared);
  commands.execute('kill all');
  expect(events).toEqual([
    {
      entered: {
        nodeId: 'node',
        roomId: 'combatYard',
        type: 'combat',
        layer: 2,
      },
    },
    { cleared: { nodeId: 'node', type: 'combat', timeS: expect.any(Number) } },
  ]);
  expect(scene.query('phase')).toBe('done');
  expect(scene.query('doors')).toEqual({
    entry: { role: 'entry', open: false },
    exit: { role: 'exit', open: true },
  });
  expect(three.getObjectByName('door:exit')?.visible).toBe(false);
  scene.clear();
  scene.step(SIM_DT, idle);
  expect(events).toHaveLength(2);
  expect(cleared).toHaveBeenCalledOnce();
});

it('liczy czas symulacji, a clear usuwa kolejkę fal, wrogów i pociski bez leczenia', async () => {
  const bus = new EventBus();
  const cleared = vi.fn();
  bus.on('room_cleared', cleared);
  const { scene, commands } = await setup(runState(), bus);
  commands.execute('spawn gunner 2');
  scene.step(SIM_DT, idle);
  scene.step(0, idle);
  scene.clear();
  expect(scene.query('enemies')).toBe(0);
  expect(scene.query('phase')).toBe('stopped');
  expect(cleared).toHaveBeenCalledExactlyOnceWith({
    nodeId: 'node',
    type: 'combat',
    timeS: SIM_DT,
  });
  expect(scene.exportState().hp).toBe(37);
  for (let i = 0; i < 180; i++) scene.step(SIM_DT, idle);
  expect(scene.query('enemies')).toBe(0);
});

it('trzy pokoje na wspólnym busie usuwają wszystkie handlery i zwalniają osobne światy dokładnie raz', async () => {
  const rapier = await initPhysics();
  const free = vi.spyOn(rapier.World.prototype, 'free');
  const bus = new EventBus();
  const external = vi.fn();
  bus.on('health_changed', external);
  const baseline = handlerCount(bus);
  for (const room of ['combatYard', 'combatPillars', 'combatYard']) {
    const { scene, commands, three } = await setup(
      runState({ loadoutId: 'resonance' }),
      bus,
      room,
    );
    expect(handlerCount(bus)).toBeGreaterThan(baseline);
    commands.execute('spawn assaulter 1');
    scene.step(SIM_DT, press('power'));
    scene.render(1);
    dispose(scene);
    scene.dispose();
    expect(handlerCount(bus)).toBe(baseline);
    expect(three.children).toHaveLength(0);
    expect(commands.execute('hold gun')).toContain('Nieznana komenda');
    expect(commands.execute('hurt 1')).toContain('Nieznana komenda');
  }
  expect(free).toHaveBeenCalledTimes(3);
  expect(new Set(free.mock.contexts).size).toBe(3);
  expect(external).toHaveBeenCalled();
});

it('nakłada implanty ze źródłem na obie instancje Stats przed przywróceniem zasobów', async () => {
  const implant = loadImplant({
    id: 'testImplant',
    name: 'Test',
    rarity: 'common',
    tags: ['#gun'],
    modifiers: [
      { stat: 'maxHealth', type: 'flat', value: 50 },
      { stat: 'maxEnergy', type: 'flat', value: 50 },
      { stat: 'moveSpeed', type: 'mult', value: 2 },
      { stat: 'damageTaken', type: 'mult', value: 0.5 },
    ],
  });
  const add = vi.spyOn(Stats.prototype, 'add');
  const { scene, commands } = await setup(
    runState({ hp: 137, energy: 123, implants: [implant.id] }),
    new EventBus(),
    'combatYard',
    { implantDefinitions: new Map([[implant.id, implant]]) },
  );
  expect(scene.exportState()).toEqual({ hp: 137, energy: 123 });
  commands.execute('hurt 20');
  expect(scene.exportState().hp).toBe(127);
  const stats = new Set<Stats>();
  add.mock.calls.forEach(([modifier], i) => {
    const instance = add.mock.contexts[i];
    if (modifier.source === 'implant:testImplant' && instance instanceof Stats)
      stats.add(instance);
  });
  expect(stats.size).toBe(2);
  for (const instance of stats)
    expect(
      instance.modifiers().filter((m) => m.source === 'implant:testImplant'),
    ).toHaveLength(4);
});

it('HeldItem bierze startHeld z loadoutu, rozdziela atak i strzał; PPM z bronią celuje, ŚPM przywraca ostrze', async () => {
  const { scene, commands, bus } = await setup(
    runState({ loadoutId: 'gunner' }),
  );
  const swing = vi.fn();
  const fired = vi.fn();
  bus.on('melee_swing', swing);
  bus.on('weapon_fired', fired);
  expect(scene.heldView().held).toBe('gun');
  scene.step(SIM_DT, press('attack'));
  expect(fired).toHaveBeenCalledOnce();
  expect(swing).not.toHaveBeenCalled();
  commands.execute('hold blade');
  scene.step(SIM_DT, press('attack'));
  expect(swing).toHaveBeenCalledOnce();
  expect(fired).toHaveBeenCalledOnce();
  commands.execute('hold gun');
  scene.step(SIM_DT, press('block'));
  expect(scene.heldView().held).toBe('gun');
  scene.step(SIM_DT, press('bladeThrow'));
  expect(scene.heldView().held).toBe('blade');
  expect(commands.execute('hold missing')).toBe('Użycie: hold blade|gun');
});

it('śmierć zatrzymuje fale i nie otwiera wyjścia ani nie emituje room_cleared', async () => {
  const bus = new EventBus();
  const cleared = vi.fn();
  bus.on('room_cleared', cleared);
  const { scene, commands } = await setup(runState(), bus);
  commands.execute('hurt 100');
  scene.clear();
  scene.step(SIM_DT, idle);
  expect(scene.query('dead')).toBe(true);
  expect(scene.query('phase')).toBe('stopped');
  expect(scene.exportState().hp).toBe(0);
  expect(scene.query('doors')).toMatchObject({ exit: { open: false } });
  expect(cleared).not.toHaveBeenCalled();
});

it('te same dane i seed dają te same fale w kolejnych światach', async () => {
  const bus = new EventBus();
  const logs: unknown[] = [];
  for (let i = 0; i < 2; i++) {
    const { scene, commands } = await setup(runState(), bus);
    commands.execute('god');
    untilFighting(scene);
    commands.execute('kill all');
    untilFighting(scene);
    logs.push(scene.query('spawnLog'));
    dispose(scene);
  }
  expect(logs[0]).toEqual(logs[1]);
});

it('odrzuca brak węzła, nieznany loadout i brak definicji implantu przed utworzeniem świata', () => {
  const room = roomDefinitions.get('combatYard')!;
  const waves = loadWaves(wavesData);
  expect(
    () => new RoomScene(room, runState({ currentNodeId: null }), waves),
  ).toThrow('bieżącego węzła');
  expect(
    () =>
      new RoomScene(
        room,
        runState({
          loadout: { ...loadoutDefinitions.get('classic')!, blade: 'missing' },
        }),
        waves,
      ),
  ).toThrow('Nieznany ekwipunek');
  expect(
    () => new RoomScene(room, runState({ implants: ['missing'] }), waves),
  ).toThrow('Nieznany implant');
});

it('RoomScene z loadModels=false zachowuje oprawę i stosuje materiał bloku bez ładowania dekoracji', async () => {
  const base = roomDefinitions.get('combatYard')!;
  const room = {
    ...base,
    id: 'neonUnitRoom',
    theme: 'neonStreet',
    blocks: base.blocks.map((block) => ({
      ...block,
      material: 'concrete' as const,
    })),
    decor: [{ model: 'city_missing', position: { x: 0, y: 0, z: 0 } }],
    signs: [
      {
        kind: 'neon' as const,
        texture: 'test',
        position: { x: 0, y: 2, z: 0 },
        size: { w: 1, h: 1 },
        yaw: 0,
      },
    ],
    lights: [
      {
        position: { x: 0, y: 3, z: 0 },
        color: '#ffae1a',
        intensity: 10,
        range: 8,
      },
    ],
  };
  const previous = { ...tuning.render };
  {
    const { scene, three } = await setup(runState(), new EventBus(), room);
    expect(tuning.render.interactive).toBe('#d9dde3');
    expect(three.getObjectByName('city-panorama')).toBeDefined();
    const materialNames: string[] = [];
    three.traverse((object) => {
      if ('material' in object) {
        const material = (object as import('three').Mesh).material;
        for (const m of Array.isArray(material) ? material : [material])
          materialNames.push(m.name);
      }
    });
    expect(materialNames).toContain('mat_concrete');
    scene.step(SIM_DT, idle);
    scene.render(0.5);
    dispose(scene);
    expect(three.children).toHaveLength(0);
    expect(tuning.render).toEqual(previous);
  }
});

it('rysuje oprawę z układu pokoju i zwalnia jej zasoby bez wycieku', async () => {
  const base = roomDefinitions.get('combatYard')!;
  const room: RoomDefinition = {
    ...base,
    theme: 'neonStreet',
    signs: [
      {
        kind: 'neon',
        texture: 'ramen',
        position: { x: 0, y: 3, z: -5 },
        size: { w: 2, h: 1 },
        yaw: 0,
      },
      {
        kind: 'holo',
        texture: 'holo_koi',
        position: { x: 2, y: 2, z: -5 },
        size: { w: 1, h: 2 },
        yaw: 0,
      },
    ],
    lights: [
      {
        position: { x: 0, y: 3, z: -4 },
        color: '#ffae1a',
        intensity: 10,
        range: 6,
      },
    ],
    decals: [
      {
        texture: 'puddle1',
        position: { x: 1, y: 0, z: 1 },
        size: { w: 1, h: 1 },
        yaw: 0,
        surface: 'floor',
      },
    ],
    ambientFx: [{ kind: 'steam', position: { x: 1, y: 0, z: 2 } }],
  };
  const withoutRoom = await setup(runState(), new EventBus(), base);
  const baseline = withoutRoom.three.children[0]!.children.length;
  dispose(withoutRoom.scene);
  const { scene, three } = await setup(runState(), new EventBus(), room);
  const root = three.children.find((c) => c.name === '' && c.children.length)!;
  expect(root.children.length).toBeGreaterThanOrEqual(baseline + 5);
  const disposed = new Set<unknown>();
  const resources: {
    addEventListener: (type: string, listener: () => void) => void;
  }[] = [];
  const meshes: Mesh[] = [];
  three.traverse((object) => {
    if (object instanceof Mesh && object.userData.noOutline === true)
      meshes.push(object);
  });
  expect(meshes.length).toBeGreaterThan(4);
  for (const mesh of meshes) {
    resources.push(mesh.geometry as never, mesh.material as never);
  }
  for (const resource of resources)
    resource.addEventListener('dispose', () => disposed.add(resource));
  dispose(scene);
  expect(disposed.size).toBe(new Set(resources).size);
  expect(tuning.render.skyFlash).toBe(0);
});
