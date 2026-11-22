import { afterEach, describe, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Scene as ThreeScene } from 'three';
import { EventBus } from '../../src/core/events';
import { GameLoop } from '../../src/core/loop';
import { tuning } from '../../src/core/tuning';
import { Arena, ARENA_MUTATORS_SCENE } from '../../src/scenes/arena';
import { CommandRegistry } from '../../src/ui/debugCommands';
import { Weapon } from '../../src/combat/weapons/weapon';
import {
  loadWeapon,
  weaponDefinitions,
} from '../../src/combat/weapons/weaponSchema';
import { Rng } from '../../src/core/rng';
import { Stats } from '../../src/core/stats';
import {
  arenaMutatorSchema,
  arenaMutators,
  rollArenaMutator,
} from '../../src/world/arenaMutators';

describe('mutatory areny', () => {
  it('wszystkie definicje przechodzą schemat, a nieprawidłowe są odrzucane', () => {
    expect(arenaMutators.size).toBeGreaterThanOrEqual(4);
    for (const def of arenaMutators.values())
      expect(arenaMutatorSchema.safeParse(def).success).toBe(true);
    const base = {
      id: 'x',
      name: 'X',
      description: 'opis',
    };
    expect(
      arenaMutatorSchema.safeParse({
        ...base,
        effect: { stat: 'gravityScale', value: 2 },
      }).success,
    ).toBe(false);
    expect(
      arenaMutatorSchema.safeParse({
        ...base,
        effect: { stat: 'nieznany', value: 1 },
      }).success,
    ).toBe(false);
    expect(
      arenaMutatorSchema.safeParse({
        ...base,
        extra: 1,
        effect: { stat: 'moveSpeed', value: 1.2 },
      }).success,
    ).toBe(false);
  });

  it('losowanie jest deterministyczne dla seeda i nie zużywa głównego Rng', () => {
    const a = new Rng('seed-1');
    const b = new Rng('seed-1');
    expect(rollArenaMutator(a).id).toBe(rollArenaMutator(b).id);
    expect(a.getState()).toBe(new Rng('seed-1').getState());
    const ids = new Set(
      Array.from(
        { length: 60 },
        (_, i) => rollArenaMutator(new Rng(`s${i}`)).id,
      ),
    );
    expect(ids.size).toBeGreaterThan(1);
  });

  it('modyfikatory nakładają się i znikają przez Stats', () => {
    const stats = new Stats({ gravityScale: 1, arenaLightScale: 1 });
    const gravity = arenaMutators.get('low-gravity')!;
    stats.add({
      stat: 'gravityScale',
      value: gravity.effect.value,
      type: 'mult',
      source: 'arena:mutator',
    });
    expect(stats.get('gravityScale')).toBeCloseTo(gravity.effect.value);
    stats.removeBySource('arena:mutator');
    expect(stats.get('gravityScale')).toBe(1);

    const ammo = arenaMutators.get('limited-ammo')!;
    stats.add({
      stat: 'ammoCapacity',
      value: ammo.effect.value,
      type: 'flat',
      source: 'arena:mutator',
    });
    expect(stats.get('ammoCapacity')).toBe(ammo.effect.value);
    stats.removeBySource('arena:mutator');
    expect(stats.get('ammoCapacity')).toBe(0);
  });

  it('ciemność tylko przyciemnia światło ogólne', () => {
    const dark = arenaMutators.get('darkness')!.effect;
    expect(dark.stat).toBe('arenaLightScale');
    expect(dark.value).toBeLessThan(1);
    expect(dark.value).toBeGreaterThan(0);
  });
});

const active: Arena[] = [];
afterEach(() => {
  for (const scene of active.splice(0)) scene.dispose();
  vi.restoreAllMocks();
});

async function setupArena(mutators: boolean) {
  const scene = mutators
    ? new Arena(false, true, ARENA_MUTATORS_SCENE)
    : new Arena(false);
  const commands = new CommandRegistry();
  await scene.init(
    {
      bus: new EventBus(),
      rng: new Rng('mutator-scene'),
      loop: new GameLoop({ step() {}, render() {} }),
      tuning: structuredClone(tuning),
      debug: false,
      camera: new PerspectiveCamera(),
      commands,
    },
    new ThreeScene(),
  );
  active.push(scene);
  return { scene, commands };
}

describe('arena z mutatorem', () => {
  it('mutator zmienia stan areny, a zwykła arena go nie ma', async () => {
    const plain = await setupArena(false);
    expect(plain.scene.query('mutator')).toBeFalsy();
    expect(plain.commands.execute('mutator')).toContain('Nieznana');

    const { scene, commands } = await setupArena(true);
    commands.execute('mutator low-gravity');
    const g = tuning.physics.gravity;
    expect((scene.query('mutator') as { gravity: number }).gravity).toBeCloseTo(
      g * 0.5,
    );
    commands.execute('mutator limited-ammo');
    expect((scene.query('mutator') as { ammo: number }).ammo).toBe(
      arenaMutators.get('limited-ammo')!.effect.value,
    );
    commands.execute('mutator darkness');
    const q = scene.query('mutator') as { lightScale: number; ammo: unknown };
    expect(q.lightScale).toBeCloseTo(0.2);
    expect(q.ammo).toBeNull();
  });
});

describe('limit amunicji broni', () => {
  it('broń nie strzela po wyczerpaniu puli', () => {
    const def = weaponDefinitions.get('pistol')!;
    let left = 2;
    const spawn = vi.fn(() => 1);
    const weapon = new Weapon(
      1,
      { bus: new EventBus(), rng: new Rng('ammo'), tuning },
      new Stats({ heatCapacity: 1000, coolingRate: 0 }),
      {
        projectiles: { spawn },
        ammo: { available: () => left > 0, consume: () => void left-- },
      },
      loadWeapon(def),
    );
    const input = {
      triggerHeld: true,
      origin: { x: 0, y: 0, z: 0 },
      dir: { x: 0, y: 0, z: -1 },
    };
    for (let i = 0; i < 400; i++)
      weapon.step(1 / 60, { ...input, triggerHeld: i % 2 === 0 });
    expect(spawn.mock.calls.length).toBe(2);
    expect(left).toBe(0);
  });
});
