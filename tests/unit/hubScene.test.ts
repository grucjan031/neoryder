import { afterEach, expect, it, vi } from 'vitest';
import { Scene as ThreeScene } from 'three';
import { EventBus } from '../../src/core/events';
import type { InputSnapshot } from '../../src/core/input';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import type { HubStationId } from '../../src/core/metaTypes';
import { Rng } from '../../src/core/rng';
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

class FakeScreens implements HubScreens {
  shown: { station: HubStationId; actions: HubScreenActions }[] = [];
  hidden = 0;
  disposed = 0;
  show(station: HubStationId, actions: HubScreenActions): void {
    this.shown.push({ station, actions });
  }
  hide(): void {
    this.hidden++;
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
  const scene = new HubScene({
    screens,
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
  return { scene, bus, commands, screens, navigate, resume, opened, baseline };
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

it('wejście w strefę otwiera stację, a Zamknij z akcji nakładki nie otwiera jej ponownie bez wyjścia', async () => {
  const { scene, commands, screens, opened } = await setup();
  commands.execute('hub tp 6 -4.4');
  scene.step(SIM_DT, idle);
  scene.step(SIM_DT, idle);
  expect(opened).toEqual(['talents']);
  screens.shown[0]!.actions.close();
  expect(scene.query('hubStation')).toBeNull();
  for (let i = 0; i < 10; i++) scene.step(SIM_DT, idle);
  expect(opened).toEqual(['talents']);
  // Wyjście poza promień z marginesem, potem powrót.
  commands.execute('hub tp 0 0.8');
  scene.step(SIM_DT, idle);
  commands.execute('hub tp 6 -4.4');
  scene.step(SIM_DT, idle);
  scene.step(SIM_DT, idle);
  expect(opened).toEqual(['talents', 'talents']);
});

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

it('przyciski misji i poligonu nawigują, zachowując debug', async () => {
  const { scene, commands, screens, navigate } = await setup('debug=1');
  expect(scene).toBeDefined();
  commands.execute('hub open missions');
  screens.shown[0]!.actions.startRun?.();
  const run = new URLSearchParams(
    (navigate.mock.calls[0]![0] as string).slice(1),
  );
  expect(run.get('scene')).toBe('run');
  expect(run.get('loadout')).toBe('classic');
  expect(run.get('seed')).toBeTruthy();
  expect(run.get('debug')).toBe('1');
  commands.execute('hub close');
  commands.execute('hub open arena');
  screens.shown[1]!.actions.openArena?.();
  expect(navigate.mock.calls[1]![0]).toBe('?scene=arena&debug=1');
  expect(screens.shown[0]!.actions.openArena).toBeUndefined();
  expect(screens.shown[1]!.actions.startRun).toBeUndefined();
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
