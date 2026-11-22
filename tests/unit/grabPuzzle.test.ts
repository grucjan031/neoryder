import { afterEach, expect, it, vi } from 'vitest';
import { Scene } from 'three';
import { EventBus } from '../../src/core/events';
import type { Action, InputSnapshot } from '../../src/core/input';
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
  const step = (held: Action[] = [], pressed: Action[] = []) =>
    scene.step(SIM_DT, {
      ...idle,
      held: new Set(held),
      pressed: new Set(pressed),
    });
  return { scene, commands, cleared, skipped, powerUsed, step, state };
}

it.each([
  { id: 'puzzlePlate', x: 0 },
  { id: 'puzzleLaser', x: -1.5 },
])('pozwala popchnąć obiekt do celu bez Chwytu w $id', async ({ id, x }) => {
  const { scene, commands, cleared, step, state } = await setup(id);
  expect(state()).toMatchObject({ outcome: null, engaged: false });
  expect(scene.query('phase')).toBe('stopped');
  if (id === 'puzzleLaser')
    expect(scene.query('hazards')).toMatchObject([{ phase: 'on' }]);
  commands.execute(`tp ${x} 4 0 0`);
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
});

it.each([
  { id: 'puzzlePlate', x: 0, pitch: -23 },
  { id: 'puzzleLaser', x: -1.5, pitch: -17 },
])(
  'rejestruje obiekt dla mocy Chwyt i zalicza cel w $id',
  async ({ id, x, pitch }) => {
    const { commands, cleared, powerUsed, step, state } = await setup(id, true);
    expect(JSON.parse(commands.execute('puzzle status'))).toEqual(state());
    commands.execute(`tp ${x} 4 0 ${pitch}`);
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
