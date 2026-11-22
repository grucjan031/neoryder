// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { Scene as ThreeScene } from 'three';
import { EventBus } from '../../src/core/events';
import { FeelSystem } from '../../src/core/feel';
import type { Action, InputSnapshot } from '../../src/core/input';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import { MeleeTest } from '../../src/scenes/meleeTest';
import { Arena } from '../../src/scenes/arena';
import { FlyingBlade } from '../../src/render/flyingBlade';
import { CommandRegistry } from '../../src/ui/debugCommands';
import executeRewards from '../../src/data/melee/executeRewards.json';
import meleeTestData from '../../src/data/scenes/meleeTest.json';

const scenes: { dispose(): void }[] = [];
afterEach(() => {
  for (const scene of scenes.splice(0)) scene.dispose();
  vi.restoreAllMocks();
});
const input = (pressed: Action[] = []): InputSnapshot => ({
  pressed: new Set(pressed),
  held: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
});
async function setup(scene: Arena | MeleeTest, focus = false) {
  const commands = new CommandRegistry();
  const bus = new EventBus();
  const t = structuredClone(tuning);
  const three = new ThreeScene();
  await scene.init(
    {
      commands,
      bus,
      tuning: t,
      rng: new Rng('blade-review'),
      debug: false,
      loop: new GameLoop({ step() {}, render() {} }),
      feel: { playerDt: (dt) => dt * (focus ? 2 : 1), focusActive: focus },
    },
    three,
  );
  scenes.push(scene);
  return { scene, bus, commands, three, t };
}

it.each([Arena, MeleeTest])(
  'lecące ostrze jest renderowane bez kamery: %s',
  async (SceneType) => {
    const render = vi.spyOn(FlyingBlade.prototype, 'render');
    const { scene } = await setup(new SceneType(false));
    render.mockClear();
    scene.step(SIM_DT, input(['bladeThrow']));
    scene.render(0.5);
    expect(render).toHaveBeenCalledTimes(1);
    expect(render.mock.lastCall?.[0].flight).not.toBeNull();
    expect(render.mock.instances[0]).toMatchObject({ root: { visible: true } });
  },
);

it('energia melee-test regeneruje w czasie gracza', async () => {
  const { scene, commands } = await setup(new MeleeTest(false), true);
  commands.execute('energy 0');
  scene.step(SIM_DT, input());
  expect(scene.query('energy')).toBeCloseTo(25 * SIM_DT * 2);
  scene.step(0, input());
  expect(scene.query('energy')).toBeCloseTo(25 * SIM_DT * 2);
});

it('melee-test przygotowuje manekiny i wykańcza tylko ten w osi celowania', async () => {
  const { scene, bus, commands, t } = await setup(new MeleeTest(false));
  const step = vi.fn((dt: number) => scene.step(dt, input()));
  const loop = new GameLoop({ step, render() {} });
  const feel = new FeelSystem(bus, loop, t);
  try {
    expect(commands.execute('execute ready')).toBe('[]');
    commands.execute('enemyhit 20');
    commands.execute('execute prepare');
    const readyHp = 100 * t.melee.executeHpFrac;
    expect(scene.query('dummyHp')).toEqual([readyHp, readyHp, readyHp]);
    scene.step(SIM_DT, input());
    scene.render(1);
    expect(document.querySelector('.hint')?.textContent).toContain(
      meleeTestData.executeHint,
    );
    const readyIds = [...(scene.query('executable') as number[])];
    expect(readyIds).toHaveLength(3);
    expect(commands.execute('execute ready')).toBe(JSON.stringify(readyIds));
    commands.execute('energy 0');
    const granted = vi.fn();
    bus.on('energy_changed', granted);
    scene.step(SIM_DT, input(['attack']));
    expect(scene.query('dummyHp')).toEqual([readyHp, 0, readyHp]);
    expect(scene.query('executable')).toEqual([readyIds[0], readyIds[2]]);
    expect(scene.query('playerHp')).toBe(80 + executeRewards.heal);
    expect(granted).toHaveBeenLastCalledWith(
      expect.objectContaining({
        current: t.powers.meleeKillEnergy + executeRewards.energy,
      }),
    );
    expect(feel.timeScale).toBe(t.melee.executeSlowmoScale);
    loop.advance(SIM_DT * 1000);
    expect(step).toHaveBeenCalledExactlyOnceWith(0, 1);
    commands.execute('execute prepare');
    expect(scene.query('dummyHp')).toEqual([readyHp, 0, readyHp]);
    scene.reset();
    expect(scene.query('executable')).toEqual([]);
    expect(scene.query('dummyHp')).toEqual([100, 100, 100]);
  } finally {
    feel.dispose();
  }
});

it('reset kończy dash gracza, zeruje odnowienie i odświeża pozycje colliderów', async () => {
  const { scene, bus } = await setup(new MeleeTest(false));
  const used = vi.fn();
  bus.on('dash_used', used);
  scene.step(SIM_DT, input(['dash']));
  expect(used).toHaveBeenCalledTimes(1);
  scene.reset();
  scene.step(SIM_DT, input(['dash']));
  expect(used).toHaveBeenCalledTimes(2);
  scene.reset();
  // Pchnięcie przesuwa collider daleko od miejsca odrodzenia.
  scene.step(SIM_DT, input(['power']));
  for (let i = 0; i < 20; i++) scene.step(SIM_DT, input());
  expect(scene.query('dummyPos')).not.toEqual(meleeTestData.lanePositions);
  scene.reset();
  expect(scene.query('dummyPos')).toEqual(meleeTestData.lanePositions);
  scene.step(SIM_DT, input(['bladeThrow']));
  for (let i = 0; i < 9; i++) scene.step(SIM_DT, input());
  expect((scene.query('dummyHp') as number[])[1]).toBe(65);
});
