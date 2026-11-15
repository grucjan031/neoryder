import hideout from '../../src/data/hub/hideout.json';
import { afterEach, expect, it, vi } from 'vitest';
import { Scene as ThreeScene } from 'three';
import { EventBus } from '../../src/core/events';
import type { InputSnapshot } from '../../src/core/input';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import type { HubStationId } from '../../src/core/metaTypes';
import { Rng } from '../../src/core/rng';
import { createMemorySaveStore } from '../../src/core/save';
import { loadMetaManager } from '../../src/progression/metaSave';
import { tuning } from '../../src/core/tuning';
import { HubScene } from '../../src/scenes/hub';
import type { HubScreenActions, HubScreens } from '../../src/ui/hubScreens';
import { CommandRegistry } from '../../src/ui/debugCommands';

const idle: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};
const walkForward: InputSnapshot = {
  ...idle,
  held: new Set(['moveForward']),
};
const interact: InputSnapshot = {
  ...idle,
  held: new Set(['power2']),
  pressed: new Set(['power2']),
};
const holdInteract: InputSnapshot = { ...idle, held: new Set(['power2']) };

class FakeScreens implements HubScreens {
  shown: { station: HubStationId; actions: HubScreenActions }[] = [];
  hidden = 0;
  disposed = 0;
  refreshed = 0;
  show(station: HubStationId, actions: HubScreenActions): void {
    this.shown.push({ station, actions });
  }
  hide(): void {
    this.hidden++;
  }
  refresh(): void {
    this.refreshed++;
  }
  dispose(): void {
    this.disposed++;
  }
}

// EventBus celowo nie udostępnia licznika w publicznym kontrakcie.
function handlerCount(bus: EventBus): number {
  const handlers = Reflect.get(bus, 'handlers') as Map<unknown, unknown[]>;
  return [...handlers.values()].reduce((total, list) => total + list.length, 0);
}

const active = new Set<HubScene>();
afterEach(() => {
  for (const scene of active) scene.dispose();
  active.clear();
  vi.restoreAllMocks();
});

async function setup(params = '') {
  const bus = new EventBus();
  const baseline = handlerCount(bus);
  const commands = new CommandRegistry();
  const screens = new FakeScreens();
  const navigate = vi.fn();
  const resume = vi.fn();
  const metaStore = createMemorySaveStore();
  const scene = new HubScene({
    screens,
    metaStore,
    navigate,
    params: new URLSearchParams(params),
    loadModels: false,
  });
  const opened: HubStationId[] = [];
  bus.on('hub_station_opened', ({ station }) => opened.push(station));
  await scene.init(
    {
      bus,
      commands,
      rng: new Rng('hub-unit'),
      loop: new GameLoop({ step() {}, render() {} }),
      tuning: structuredClone(tuning),
      debug: true,
      resume,
    },
    new ThreeScene(),
  );
  active.add(scene);
  return {
    scene,
    bus,
    commands,
    screens,
    navigate,
    resume,
    opened,
    baseline,
    metaStore,
  };
}

const position = (scene: HubScene) =>
  scene.query('playerPos') as { x: number; y: number; z: number };

it('startuje na playerSpawn bez otwartej stacji i bez wrogów', async () => {
  const { scene, screens } = await setup();
  expect(scene.id).toBe('hub');
  expect(scene.query('hubStation')).toBeNull();
  expect(screens.shown).toEqual([]);
  expect(position(scene).x).toBeCloseTo(0);
  expect(position(scene).z).toBeCloseTo(0.8);
  expect(scene.query('enemies')).toBeUndefined();
});

it('hub open pokazuje nakładkę i emituje zdarzenie, hub close ją zamyka i wznawia grę', async () => {
  const { scene, commands, screens, opened, resume } = await setup();
  expect(commands.execute('hub open missions')).toBe('Stacja: missions');
  expect(scene.query('hubStation')).toBe('missions');
  expect(opened).toEqual(['missions']);
  expect(screens.shown.map((entry) => entry.station)).toEqual(['missions']);
  expect(commands.execute('hub open talents')).toContain('już otwarta');
  expect(commands.execute('hub close')).toBe('Zamknięto: missions');
  expect(scene.query('hubStation')).toBeNull();
  expect(screens.hidden).toBe(1);
  expect(resume).toHaveBeenCalledOnce();
  expect(commands.execute('hub close')).toContain('Żadna stacja');
  expect(commands.execute('hub open nieznana')).toContain('Użycie');
});

it('stacja wymaga patrzenia i zbocza E; nakładka ignoruje E, po zamknięciu można otworzyć ją ponownie', async () => {
  const { scene, commands, screens, opened } = await setup();
  commands.execute('hub tp 6 -3.2 180');
  scene.step(SIM_DT, idle);
  expect(scene.query('hubFocus')).toBeNull();
  scene.step(SIM_DT, interact);
  expect(opened).toEqual([]);
  expect(commands.execute('hub look talents')).toBe('Patrzysz na: talents');
  scene.step(SIM_DT, holdInteract);
  expect(scene.query('hubFocus')).toBe('talents');
  expect(scene.query('hubStation')).toBeNull();
  expect(screens.shown).toEqual([]);
  scene.step(SIM_DT, interact);
  expect(scene.query('hubStation')).toBe('talents');
  expect(opened).toEqual(['talents']);
  scene.step(SIM_DT, interact);
  expect(screens.shown).toHaveLength(1);
  expect(opened).toEqual(['talents']);
  screens.shown[0]!.actions.close();
  expect(scene.query('hubStation')).toBeNull();
  for (let i = 0; i < 10; i++) scene.step(SIM_DT, holdInteract);
  expect(opened).toEqual(['talents']);
  scene.step(SIM_DT, idle);
  scene.step(SIM_DT, interact);
  expect(opened).toEqual(['talents', 'talents']);
});

it.each([false, true])(
  'odrzuca zaległe E po zamknięciu nakładki (kroki przy otwartej: %s)',
  async (stepsWhileOpen) => {
    const { scene, commands, screens, opened } = await setup();
    commands.execute('hub tp 6 -3.2');
    commands.execute('hub look talents');
    scene.step(SIM_DT, interact);
    expect(scene.query('hubStation')).toBe('talents');
    // E przy otwartej nakładce: snapshot może zostać dostarczony dopiero po wznowieniu pętli.
    if (stepsWhileOpen) scene.step(SIM_DT, interact);
    screens.shown[0]!.actions.close();
    scene.step(SIM_DT, interact);
    expect(scene.query('hubStation')).toBeNull();
    scene.step(SIM_DT, holdInteract);
    expect(opened).toEqual(['talents']);
    scene.step(SIM_DT, idle);
    scene.step(SIM_DT, interact);
    expect(scene.query('hubStation')).toBe('talents');
    expect(opened).toEqual(['talents', 'talents']);
  },
);

it.each(['workshop', 'missions', 'talents', 'arena'] as const)(
  'hub look i E otwierają stację %s tylko w zasięgu',
  async (id) => {
    const { scene, commands, opened } = await setup();
    const stations = scene.query('stations') as {
      id: HubStationId;
      x: number;
      z: number;
    }[];
    const station = stations.find((station) => station.id === id)!;
    commands.execute(`hub tp ${station.x} ${station.z}`);
    commands.execute(`hub look ${id}`);
    scene.step(SIM_DT, idle);
    expect(scene.query('hubFocus')).toBe(id);
    expect(scene.query('hubStation')).toBeNull();
    scene.step(SIM_DT, interact);
    expect(opened).toEqual([id]);
    commands.execute('hub close');
    commands.execute('hub tp 0 0.8');
    commands.execute(`hub look ${id}`);
    scene.step(SIM_DT, interact);
    expect(scene.query('hubFocus')).toBeNull();
    expect(scene.query('hubStation')).toBeNull();
    expect(commands.execute('hub look nieznana')).toContain('Użycie');
    expect(commands.execute(`hub look ${id} extra`)).toContain('Użycie');
  },
);

it('przy otwartej nakładce ruch gracza jest zatrzymany', async () => {
  const { scene, commands } = await setup();
  commands.execute('hub open workshop');
  const before = position(scene);
  for (let i = 0; i < 30; i++) scene.step(SIM_DT, walkForward);
  expect(position(scene)).toEqual(before);
  commands.execute('hub close');
  for (let i = 0; i < 30; i++) scene.step(SIM_DT, walkForward);
  expect(position(scene).z).toBeLessThan(before.z - 0.5);
});

it('niecka torów nie jest pułapką: gracz staje na dnie i wychodzi skokiem na peron', async () => {
  const { scene, commands } = await setup();
  commands.execute('hub tp 0 2.0 180');
  for (let i = 0; i < 20; i++) scene.step(SIM_DT, idle);
  for (let i = 0; i < 60; i++) scene.step(SIM_DT, walkForward);
  const inTrough = position(scene);
  expect(inTrough.z).toBeGreaterThan(3.6);
  // Środek kapsuły: dno niecki 0,8 m poniżej peronu, więc oczy nadal ponad dnem.
  expect(inTrough.y).toBeGreaterThan(-0.5);
  expect(inTrough.y).toBeLessThan(0.5);
  commands.execute('hub tp 0 5 0');
  for (let i = 0; i < 20; i++) scene.step(SIM_DT, idle);
  const climb: InputSnapshot = {
    ...idle,
    held: new Set(['moveForward']),
    pressed: new Set(['jump']),
  };
  scene.step(SIM_DT, climb);
  for (let i = 0; i < 80; i++) scene.step(SIM_DT, walkForward);
  expect(position(scene).z).toBeLessThan(3.4);
  expect(position(scene).y).toBeGreaterThan(0.5);
});

it('przycisk poligonu nawiguje, zachowując debug; tablica misji nie dostaje już akcji startRun', async () => {
  const { commands, screens, navigate } = await setup('debug=1');
  commands.execute('hub open missions');
  expect(screens.shown[0]!.actions.openArena).toBeUndefined();
  expect(Object.keys(screens.shown[0]!.actions)).toEqual(['close']);
  commands.execute('hub close');
  commands.execute('hub open arena');
  screens.shown[1]!.actions.openArena?.();
  expect(navigate.mock.calls[0]![0]).toBe('?scene=arena&debug=1');
});

it('wczytuje meta z zapisu, wystawia query meta i level oraz komendy meta zapisujące stan', async () => {
  const { scene, commands, metaStore } = await setup();
  expect((scene.query('meta') as { xp: number }).xp).toBe(0);
  expect(scene.query('level')).toMatchObject({ level: 1, freePoints: 0 });
  expect(commands.execute('meta xp 500')).toContain('Poziom');
  expect((scene.query('level') as { level: number }).level).toBeGreaterThan(1);
  expect(commands.execute('meta threat 3')).toContain('max 3');
  expect((scene.query('meta') as { threat: { max: number } }).threat.max).toBe(
    3,
  );
  await vi.waitFor(async () => {
    const saved = await loadMetaManager(metaStore);
    expect(saved.state.threat.max).toBe(3);
    expect(saved.state.xp).toBe(500);
  });
});

it('zdarzenia meta odświeżają nakładkę, a dispose wyrejestrowuje komendy meta', async () => {
  const { scene, bus, commands, screens } = await setup();
  bus.emit('threat_selected', { level: 0 });
  bus.emit('level_up', { level: 2 });
  expect(screens.refreshed).toBe(2);
  commands.execute('hub open talents');
  expect(commands.execute('meta state')).toContain('"xp"');
  scene.dispose();
  active.delete(scene);
  expect(commands.execute('meta state')).toContain('Nieznana komenda');
});

it('bez debug w URL nawigacja go nie dodaje', async () => {
  const { commands, screens, navigate } = await setup();
  commands.execute('hub open arena');
  screens.shown[0]!.actions.openArena?.();
  expect(navigate).toHaveBeenCalledExactlyOnceWith('?scene=arena');
});

it('dispose nie zostawia subskrypcji EventBus ani komend i zwalnia nakładki', async () => {
  const { scene, bus, commands, screens, baseline } = await setup();
  // Jedna subskrypcja testu (opened) + subskrypcje sceny.
  expect(handlerCount(bus)).toBeGreaterThan(baseline);
  scene.dispose();
  active.delete(scene);
  // Zostaje wyłącznie subskrypcja testu (hub_station_opened).
  expect(handlerCount(bus)).toBe(baseline + 1);
  expect(screens.disposed).toBe(1);
  expect(commands.execute('hub open missions')).toContain('Nieznana komenda');
  expect(() => scene.dispose()).not.toThrow();
});

it.each(hideout.stations)(
  'blisko obiektu $id spojrzenie w środek focus i E działają',
  async (station) => {
    const { scene, commands, opened } = await setup();
    const { position, size } = station.focus;
    commands.execute(`hub tp ${position.x} ${position.z + size.z / 2 + 0.8}`);
    commands.execute(`hub look ${station.id}`);
    scene.step(SIM_DT, idle);
    expect(scene.query('hubFocus')).toBe(station.id);
    scene.step(SIM_DT, interact);
    expect(opened).toEqual([station.id]);
  },
);
