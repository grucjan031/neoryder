import { afterEach, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Scene as ThreeScene } from 'three';
import { BossTest } from '../../src/scenes/bossTest';
import { scenes } from '../../src/scenes';
import { CommandRegistry } from '../../src/ui/debugCommands';
import { EventBus } from '../../src/core/events';
import { Rng } from '../../src/core/rng';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { tuning } from '../../src/core/tuning';
import type { InputSnapshot } from '../../src/core/input';

const input: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};
let active: BossTest | undefined;
afterEach(() => {
  active?.dispose();
  active = undefined;
});

async function orbisScene() {
  const scene = new BossTest(false, '?scene=boss-test&boss=orbisDirector');
  active = scene;
  const commands = new CommandRegistry();
  const bus = new EventBus();
  const spawned = vi.fn();
  bus.on('boss_spawned', spawned);
  await scene.init(
    {
      bus,
      commands,
      rng: new Rng('orbis'),
      loop: new GameLoop({ step() {}, render() {} }),
      tuning: structuredClone(tuning),
      debug: false,
      camera: new PerspectiveCamera(),
    },
    new ThreeScene(),
  );
  const step = (ticks: number, controls: InputSnapshot = input) => {
    for (let i = 0; i < ticks; i++) scene.step(SIM_DT, controls);
  };
  return { scene, commands, bus, spawned, step };
}

it('wybiera Orbis dla areny, TTK i resetu, przywołuje drony i czasowo zagłusza moc', async () => {
  const { scene, commands, bus, spawned, step } = await orbisScene();
  expect(spawned.mock.calls[0]![0].name).toBe('Dyrektor Systemów Orbis Grid');
  expect(commands.execute('boss ttk')).toMatch(
    /TTK orbisDirector \(blaster\): \d+\.\d{3} s.*faza 1 .*faza 2 .*faza 3 /,
  );
  const denied = vi.fn(),
    used = vi.fn(),
    drones = vi.fn();
  bus.on('power_denied', denied);
  bus.on('power_used', used);
  bus.on('entity_spawned', ({ kind }) => {
    if (kind === 'drone') drones();
  });
  commands.execute('boss pattern gridHack');
  scene.render(0.5);
  step(90);
  const barrier = { ...input, pressed: new Set(['power2'] as const) };
  step(1, barrier);
  expect(denied).toHaveBeenCalledWith(
    expect.objectContaining({ reason: 'jammed' }),
  );
  expect(commands.execute('boss phase 3')).toBe('Faza bossa: 3');
  step(65);
  expect(commands.execute('boss pattern summon')).toBe('Wzorzec bossa: summon');
  step(80);
  expect(drones).toHaveBeenCalledTimes(2);
  step(1, barrier);
  expect(used).toHaveBeenCalledWith(
    expect.objectContaining({ power: 'barrier' }),
  );
  scene.reset();
  expect(scene.query('enemies')).toBe(1);
  expect(scene.query('bosses')).toEqual([
    { id: expect.any(Number), phase: 1, hp: 720 },
  ]);
});

it('parowanie ostrzem w boss-test przerywa atak i otwiera ograniczone okno kontry', async () => {
  const { scene, commands, bus, step } = await orbisScene();
  const parried = vi.fn(),
    stunned = vi.fn();
  bus.on('parry_success', parried);
  bus.on('enemy_stunned', stunned);
  commands.execute('boss pattern fan');
  step(77);
  step(30, { ...input, held: new Set(['block']) });
  step(25);
  expect(parried).toHaveBeenCalledOnce();
  expect(stunned).toHaveBeenCalledWith(
    expect.objectContaining({ durationS: tuning.enemies.reflectCounterS }),
  );
  const hp = () => (scene.query('bosses') as { hp: number }[])[0]!.hp;
  const before = hp();
  commands.execute('hit 10');
  expect(before - hp()).toBeCloseTo(10 * tuning.enemies.reflectCounterMult);
  step(Math.ceil(tuning.enemies.reflectCounterS / SIM_DT));
  const after = hp();
  commands.execute('hit 10');
  expect(after - hp()).toBeCloseTo(10);
});

it('registers boss-test, starts with only the boss, changes phases, resets and cleans up commands/world', async () => {
  expect((await scenes['boss-test']?.())?.().id).toBe('boss-test');
  const scene = new BossTest(false);
  const commands = new CommandRegistry(),
    bus = new EventBus(),
    three = new ThreeScene();
  const spawned = vi.fn(),
    phase = vi.fn();
  bus.on('boss_spawned', spawned);
  bus.on('boss_phase', phase);
  await scene.init(
    {
      bus,
      rng: new Rng('boss-test'),
      loop: new GameLoop({ step() {}, render() {} }),
      tuning: structuredClone(tuning),
      debug: false,
      camera: new PerspectiveCamera(),
      commands,
    },
    three,
  );
  active = scene;
  expect(scene.query('enemies')).toBe(1);
  expect(scene.query('bosses')).toEqual([
    { id: expect.any(Number), phase: 1, hp: 900 },
  ]);
  expect(spawned).toHaveBeenCalledOnce();
  expect(phase).not.toHaveBeenCalled();
  const ttk = commands.execute('boss ttk');
  expect(ttk).toMatch(/TTK securityChief \(blaster\): \d+\.\d{3} s/);
  expect(ttk).toMatch(/faza 1 .*faza 2 .*faza 3 /);
  expect(phase).not.toHaveBeenCalled();
  for (const bad of [
    'boss phase',
    'boss phase 0',
    'boss phase 4',
    'boss phase 1.5',
    'boss phase 2 extra',
  ])
    expect(commands.execute(bad)).toMatch(/Podaj/);
  expect(commands.execute('boss phase 2')).toBe('Faza bossa: 2');
  expect(scene.query('bosses')).toEqual([
    { id: expect.any(Number), phase: 2, hp: 585 },
  ]);
  commands.execute('hit 9999');
  expect(scene.query('enemies')).toBe(1);
  commands.execute('god');
  for (let i = 0; i < 80; i++) scene.step(SIM_DT, input);
  commands.execute('kill all');
  expect(scene.query('bosses')).toEqual([
    { id: expect.any(Number), phase: 3, hp: 270 },
  ]);
  scene.render(0.5);
  scene.reset();
  expect(scene.query('bosses')).toEqual([
    { id: expect.any(Number), phase: 1, hp: 900 },
  ]);
  expect(spawned).toHaveBeenCalledTimes(2);
  scene.dispose();
  active = undefined;
  expect(three.children).toHaveLength(0);
  expect(commands.help()).toBe('');
});

it('boss pattern summon|shield wymusza wzorce: wezwanie tworzy Tarczowników wokół bossa', async () => {
  const scene = new BossTest(false);
  const commands = new CommandRegistry();
  await scene.init(
    {
      bus: new EventBus(),
      rng: new Rng('boss-pattern'),
      loop: new GameLoop({ step() {}, render() {} }),
      tuning: structuredClone(tuning),
      debug: false,
      camera: new PerspectiveCamera(),
      commands,
    },
    new ThreeScene(),
  );
  active = scene;
  for (const bad of [
    'boss pattern',
    'boss pattern slam',
    'boss pattern summon x',
  ])
    expect(commands.execute(bad)).toMatch(/Podaj/);
  commands.execute('god');
  expect(commands.execute('boss pattern summon')).toBe('Wzorzec bossa: summon');
  for (let i = 0; i < 80; i++) scene.step(SIM_DT, input);
  expect(scene.query('enemies')).toBe(3);
  expect(commands.execute('boss pattern shield')).toBe('Wzorzec bossa: shield');
  commands.execute('kill all');
  for (let i = 0; i < 5; i++) scene.step(SIM_DT, input);
  // kill all zabija sługi; boss ginie dopiero po trzech progach faz.
  expect(scene.query('enemies')).toBe(1);
});

it('dispose przed końcem init nie rejestruje komendy boss ttk', async () => {
  const scene = new BossTest(false, '?scene=boss-test&boss=orbisDirector');
  const commands = new CommandRegistry();
  const pending = scene.init(
    {
      bus: new EventBus(),
      commands,
      rng: new Rng('late'),
      loop: new GameLoop({ step() {}, render() {} }),
      tuning: structuredClone(tuning),
      debug: false,
      camera: new PerspectiveCamera(),
    },
    new ThreeScene(),
  );
  scene.dispose();
  await pending;
  expect(commands.execute('boss ttk')).not.toMatch(/TTK/);
});

it('podpowiedź lasera liczy wysokość względem podłogi bossa', async () => {
  const { BossFieldView } = await import('../../src/render/bossFieldView');
  const view = new BossFieldView();
  const hint = (floorY: number) =>
    view.render(
      {
        definition: { body: { controllerOffset: 0.02, radius: 0.4 } },
        current: {
          state: 'swing',
          stateTimeS: 0,
          position: { x: 0, y: floorY + 0.02, z: 0 },
          field: {
            kind: 'laser',
            center: { x: 0, y: floorY + 0.35, z: 3 },
            yaw: 0,
            halfLengthM: 6,
            radiusM: 0.08,
          },
        },
      } as never,
      1,
    );
  const onGround = hint(0);
  expect(hint(2)).toBe(onGround);
  view.dispose();
});
