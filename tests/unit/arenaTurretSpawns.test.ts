import { afterEach, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Scene as ThreeScene } from 'three';
import { EventBus } from '../../src/core/events';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import type { InputSnapshot } from '../../src/core/input';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import waves from '../../src/data/waves/arena.json';
import type { EnemyManager } from '../../src/enemies/manager';
import { Arena } from '../../src/scenes/arena';
import { CommandRegistry } from '../../src/ui/debugCommands';
import type { WaveDirector } from '../../src/world/waves';

const idle: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};
const active = new Set<Arena>();

afterEach(() => {
  for (const scene of active) scene.dispose();
  active.clear();
});

it.each(waves.spawnPoints)(
  'wieżyczka ze spawnu ($x, $z) ostrzeliwuje gracza w dostępnej części areny',
  async ({ x, z }) => {
    const scene = new Arena(false);
    const bus = new EventBus();
    const commands = new CommandRegistry();
    await scene.init(
      {
        bus,
        commands,
        camera: new PerspectiveCamera(),
        rng: new Rng('arena-turret-spawns'),
        loop: new GameLoop({ step() {}, render() {} }),
        tuning: structuredClone(tuning),
        debug: false,
      },
      new ThreeScene(),
    );
    active.add(scene);
    // Izolujemy wieżyczkę od fal, zachowując geometrię, fizykę i AI areny.
    const director = Reflect.get(scene, 'director') as WaveDirector;
    director.stop();
    const manager = Reflect.get(scene, 'manager') as EnemyManager;
    const turret = manager.spawn('turret', { x, y: 0, z });
    // Pozycje przy centrum omijają filary i mieszczą się w zasięgu 20 m.
    commands.execute(x === 0 ? 'tp 4 0' : `tp 0 ${z < 0 ? -4 : 4}`);
    const fired = vi.fn();
    bus.on('projectile_spawned', fired);
    for (let i = 0; i < 360 && fired.mock.calls.length === 0; i++)
      scene.step(SIM_DT, idle);
    expect(fired).toHaveBeenCalled();
    expect(turret.current.position).toEqual({ x, y: 0, z });
  },
);
