import { afterEach, expect, it, vi } from 'vitest';
import { Scene } from 'three';
import { EventBus } from '../../src/core/events';
import type { Action, InputSnapshot } from '../../src/core/input';
import type { Vec3 } from '../../src/core/math';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import wavesData from '../../src/data/waves/roomTest.json';
import { RoomScene } from '../../src/scenes/roomScene';
import { roomTestRun } from '../../src/scenes/roomTest';
import { CommandRegistry } from '../../src/ui/debugCommands';
import type { GrabPuzzleState } from '../../src/world/grabPuzzle';
import { roomDefinitions } from '../../src/world/rooms';

const idle: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};
const rooms: RoomScene[] = [];

afterEach(() => {
  for (const room of rooms.splice(0)) room.dispose();
});

async function setup(id: string, grab = false, objectives?: string[]) {
  const definition = roomDefinitions.get(id)!;
  const run = roomTestRun(definition, new URLSearchParams());
  if (grab) run.loadout = { ...run.loadout, powers: ['grab'] };
  const scene = new RoomScene(definition, run, wavesData, {
    loadModels: false,
    ...(objectives
      ? {
          node: {
            id: 'test',
            layer: 1,
            index: 0,
            type: 'puzzle' as const,
            next: [],
            fixed: { roomId: id, objectives },
          },
        }
      : {}),
  });
  rooms.push(scene);
  const bus = new EventBus();
  const commands = new CommandRegistry();
  const cleared = vi.fn();
  const skipped = vi.fn();
  const powerUsed = vi.fn();
  bus.on('room_cleared', cleared);
  bus.on('puzzle_skipped', skipped);
  bus.on('power_used', powerUsed);
  await scene.init(
    {
      bus,
      commands,
      rng: new Rng(run.seed),
      loop: new GameLoop({ step() {}, render() {} }),
      tuning: structuredClone(tuning),
      debug: true,
    },
    new Scene(),
  );
  const state = () => scene.query('puzzle') as GrabPuzzleState;
  const step = (
    held: Action[] = [],
    pressed: Action[] = [],
    released: Action[] = [],
  ) =>
    scene.step(SIM_DT, {
      ...idle,
      held: new Set(held),
      pressed: new Set(pressed),
      released: new Set(released),
    });
  const player = () => scene.query('playerPos') as Vec3;
  const lineUp = () => {
    const x = definition.puzzle!.object.position.x;
    const side = player().x < x ? 'moveRight' : 'moveLeft';
    for (let i = 0; i < 60 && Math.abs(player().x - x) > 0.15; i++)
      step([side]);
    expect(Math.abs(player().x - x)).toBeLessThanOrEqual(0.15);
  };
  return {
    scene,
    commands,
    cleared,
    skipped,
    powerUsed,
    step,
    state,
    player,
    lineUp,
  };
}

it.each(['puzzlePlate', 'puzzleLaser'])(
  'pozwala popchnąć obiekt od spawnu do celu bez Chwytu w %s',
  async (id) => {
    const { scene, cleared, step, state, lineUp } = await setup(id);
    expect(state()).toMatchObject({ outcome: null, engaged: false });
    expect(scene.query('phase')).toBe('stopped');
    if (id === 'puzzleLaser')
      expect(scene.query('hazards')).toMatchObject([{ phase: 'on' }]);
    lineUp();
    for (let i = 0; i < 180 && !state().outcome; i++) step(['moveForward']);
    expect(state()).toMatchObject({ outcome: 'solved', engaged: true });
    expect(cleared).toHaveBeenCalledExactlyOnceWith({
      nodeId: 'test',
      type: 'puzzle',
      timeS: expect.any(Number),
    });
    for (let i = 0; i < 120; i++) step(['moveForward']);
    expect(cleared).toHaveBeenCalledOnce();
    expect(scene.exportState().hp).toBe(scene.query('playerMaxHp'));
    if (id === 'puzzleLaser')
      expect(scene.query('hazards')).toMatchObject([{ phase: 'off' }]);
  },
);

it.each([
  { id: 'puzzlePlate', pitch: -23 },
  { id: 'puzzleLaser', pitch: -17 },
])(
  'rejestruje obiekt dla mocy Chwyt i zalicza cel w $id',
  async ({ id, pitch }) => {
    const { commands, cleared, powerUsed, step, state, lineUp } = await setup(
      id,
      true,
    );
    expect(JSON.parse(commands.execute('puzzle status'))).toEqual(state());
    lineUp();
    commands.execute(`look 0 ${pitch}`);
    step(['power'], ['power']);
    expect(powerUsed).toHaveBeenCalledWith(
      expect.objectContaining({ power: 'grab' }),
    );
    expect(state().outcome).toBeNull();
    for (let i = 0; i < 120 && !state().engaged; i++)
      step(['power', 'moveForward']);
    expect(state().engaged).toBe(true);
    for (let i = 0; i < 60 && !state().outcome; i++) step(['power']);
    expect(state().outcome).toBe('solved');
    expect(cleared).toHaveBeenCalledOnce();
  },
);

it('przejście podczas przerwy wiązki nie zwalnia rygla fotonowego', async () => {
  const { scene, cleared, step, state, player } = await setup('puzzleLaser');
  for (let i = 0; i < 120 && player().z > -0.7; i++) step(['moveForward']);
  const phase = () => (scene.query('hazards') as { phase: string }[])[0]!.phase;
  for (let i = 0; i < 900 && phase() !== 'off'; i++) step();
  expect(phase()).toBe('off');
  for (let i = 0; i < 120; i++) step(['moveForward']);
  expect(scene.exportState().hp).toBe(scene.query('playerMaxHp'));
  expect(player().z).toBeLessThan(-5.5);
  expect(player().z).toBeGreaterThan(-6.5);
  expect(state().outcome).toBeNull();
  expect(cleared).not.toHaveBeenCalled();
  expect(scene.query('doors')).toMatchObject({ exit: { open: false } });
});

it('odzyskuje osłonę wypchniętą ku aparaturze i pozwala otworzyć oraz minąć bramę', async () => {
  const { scene, cleared, commands, step, state, player } =
    await setup('puzzleLaser');
  const start = state().position;
  commands.execute('tp -2.9 0.9 0 0');
  for (let i = 0; i < 120 && state().position.x < 1.8; i++) step(['moveRight']);
  expect(state().position.x).toBeGreaterThanOrEqual(1.8);
  for (let i = 0; i < 60 && state().position.x > 0; i++) step(['moveRight']);
  expect(state().position).toEqual(start);
  expect(cleared).not.toHaveBeenCalled();
  commands.execute('tp -1.5 4 0 0');
  for (let i = 0; i < 180 && !state().outcome; i++) step(['moveForward']);
  expect(state().outcome).toBe('solved');
  expect(scene.query('doors')).toMatchObject({ exit: { open: true } });
  commands.execute('tp 0 -4.8 0 0');
  for (let i = 0; i < 30; i++) step(['moveForward']);
  expect(player().z).toBeLessThan(-6.5);
});

it('czeka z odzyskaniem uniesionej osłony na puszczenie Chwytu i wolne stanowisko', async () => {
  const { commands, step, state, cleared } = await setup('puzzleLaser', true);
  const start = state().position;
  commands.execute('tp -1.5 4 0 -17');
  step(['power'], ['power']);
  commands.execute('tp -1.5 0.9 0 80');
  step(['power']);
  expect(state().position.y).toBeGreaterThan(3);
  step([], [], ['power']);
  for (let i = 0; i < 12; i++) step();
  expect(state().position.y).toBeGreaterThan(3);
  commands.execute('tp 0 4 0 0');
  step();
  expect(state().position).toEqual(start);
  expect(cleared).not.toHaveBeenCalled();
});

it('uznaje wolną osłonę przy końcu wiązki poza oznaczonym torem', async () => {
  const { commands, scene, step, state } = await setup('puzzleLaser', true);
  commands.execute('tp -1.5 4 0 -17');
  step(['power'], ['power']);
  commands.execute('tp 0.5 -1.9 -90 -17');
  step(['power']);
  expect(state()).toMatchObject({ engaged: true, outcome: null });
  step([], [], ['power']);
  for (let i = 0; i < 60 && !state().outcome; i++) step();
  expect(state().position.x).toBeGreaterThan(3);
  expect(state().outcome).toBe('solved');
  expect(scene.query('hazards')).toMatchObject([{ phase: 'off' }]);
});

it('przywraca ładunek wypchnięty do doku i otwiera przejście dopiero po zważeniu', async () => {
  const { scene, commands, cleared, step, state } = await setup('puzzlePlate');
  const start = state().position;
  commands.execute('tp -1.7 1.35 0 0');
  for (let i = 0; i < 100 && state().position.x < 1.7; i++) step(['moveRight']);
  expect(state().position.x).toBeGreaterThanOrEqual(1.7);
  for (let i = 0; i < 100 && state().position.x > 0; i++) step(['moveRight']);
  expect(state().position).toEqual(start);
  expect(cleared).not.toHaveBeenCalled();

  const doorZ = roomDefinitions
    .get('puzzlePlate')!
    .doors.find((d) => d.role === 'exit')!.position.z;
  const approach = () => {
    commands.execute('tp 0 -4.8 0 0');
    for (let i = 0; i < 30; i++) step(['moveForward']);
    return (scene.query('playerPos') as { z: number }).z;
  };
  expect(approach()).toBeGreaterThan(doorZ);
  expect(scene.query('doors')).toMatchObject({ exit: { open: false } });
  commands.execute('tp 0 4 0 0');
  for (let i = 0; i < 180 && !state().outcome; i++) step(['moveForward']);
  expect(cleared).toHaveBeenCalledOnce();
  expect(scene.query('doors')).toMatchObject({ exit: { open: true } });
  expect(approach()).toBeLessThan(doorZ);
});

it('czeka z powrotem skrzyni na zwolnienie Chwytu i opróżnienie stanowiska', async () => {
  const { commands, step, state } = await setup('puzzlePlate', true);
  const start = state().position;
  commands.execute('tp 0 4 0 -23');
  step(['power'], ['power']);
  commands.execute('tp 0 1.35 -90 0');
  step(['power']);
  expect(state().position.x).toBeGreaterThan(2.2);
  step([], [], ['power']);
  for (let i = 0; i < 20; i++) step();
  expect(state().position.x).toBeGreaterThan(2.2);
  commands.execute('tp 0 4 0 0');
  for (let i = 0; i < 10 && state().position.x > 0; i++) step();
  expect(state().position).toEqual(start);
  expect(state().outcome).toBeNull();
});

it('emituje pominięcie raz i nie emituje ukończenia zagadki', async () => {
  const { scene, cleared, skipped, step, state } = await setup('puzzlePlate');
  step([], ['map']);
  step([], ['map']);
  scene.clear();
  expect(state().outcome).toBe('skipped');
  expect(skipped).toHaveBeenCalledExactlyOnceWith({ nodeId: 'test' });
  expect(cleared).not.toHaveBeenCalled();
});

it('nie pozwala pominąć zagadki w węźle z celami misji', async () => {
  const { scene, skipped, step, state } = await setup('puzzlePlate', false, [
    'o1',
  ]);
  step([], ['map']);
  expect(state().outcome).toBeNull();
  expect(skipped).not.toHaveBeenCalled();
  expect(scene.query('phase')).toBe('stopped');
});

it('pominięcie w oknie potwierdzenia zeruje stan celu i gasi blokadę lasera', async () => {
  const { commands, step, state, scene } = await setup('puzzleLaser');
  commands.execute('tp -1.5 4 0 0');
  for (let i = 0; i < 180 && !state().engaged; i++) step(['moveForward']);
  expect(state().engaged).toBe(true);
  step([], ['map']);
  expect(state()).toMatchObject({ outcome: 'skipped', engaged: false });
  step();
  expect(scene.query('hazards')).toMatchObject([{ phase: 'on' }]);
});

it('reset przywraca zagadkę, obiekt i drzwi po rozwiązaniu', async () => {
  const { scene, commands, step, state } = await setup('puzzlePlate');
  const start = { ...state().position };
  commands.execute('tp 0 4 0 0');
  for (let i = 0; i < 180 && !state().outcome; i++) step(['moveForward']);
  expect(state().outcome).toBe('solved');
  scene.reset();
  expect(state()).toMatchObject({ outcome: null, engaged: false });
  expect(state().position).toEqual(start);
  for (let i = 0; i < 20; i++) step();
  expect(state().outcome).toBeNull();
});

it('zaliczenie wymaga utrzymania celu, a reset zeruje licznik', async () => {
  const { scene, commands, step, state } = await setup('puzzlePlate');
  commands.execute('tp 0 4 0 0');
  let engagedSteps = 0;
  for (let i = 0; i < 180 && !state().outcome; i++) {
    step(['moveForward']);
    if (state().engaged) engagedSteps++;
  }
  // Zaliczenie wymaga ciągłego utrzymania celu przez confirmS (>= 1 krok).
  expect(engagedSteps).toBeGreaterThanOrEqual(1);
  expect(state().outcome).toBe('solved');
  scene.reset();
  step();
  expect(state().engaged).toBe(false);
});
