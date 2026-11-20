import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import { EntityRegistry } from '../../src/core/entities';
import type { Action, InputSnapshot } from '../../src/core/input';
import type { Vec3 } from '../../src/core/math';
import { SIM_DT } from '../../src/core/loop';
import { Stats } from '../../src/core/stats';
import { tuning } from '../../src/core/tuning';
import { DamageSystem, Health } from '../../src/combat/damage';
import { PlayerEnergy } from '../../src/combat/powers/energy';
import {
  loadPush,
  pushDefinition,
  ResonancePush,
} from '../../src/combat/powers/push';
import type { PushTarget } from '../../src/combat/powers/push';

const input = (pressed: Action[] = []): InputSnapshot => ({
  held: new Set(pressed),
  pressed: new Set(pressed),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
});

function setup(opts: { targets?: Vec3[]; wallAt?: number | null } = {}) {
  const t = structuredClone(tuning);
  const bus = new EventBus();
  const registry = new EntityRegistry(bus);
  const damage = new DamageSystem(bus, registry);
  const player = registry.create('player', 'player');
  const stats = new Stats({ maxEnergy: 100, energyRegen: 25 });
  const energy = new PlayerEnergy(player, stats, bus, t);
  const targets: PushTarget[] = (opts.targets ?? [{ x: 0, y: 1, z: -3 }]).map(
    (position) => {
      const id = registry.create('dummy', 'enemy');
      damage.register(id, new Health(() => 200));
      return { id, position };
    },
  );
  const push = new ResonancePush(
    pushDefinition,
    {
      owner: player,
      damage,
      energy,
      aim: () => ({ origin: { x: 0, y: 1, z: 0 }, dir: { x: 0, y: 0, z: -1 } }),
      targets: () => targets,
      castWall: (_origin, _dir, max) =>
        opts.wallAt !== undefined && opts.wallAt !== null && opts.wallAt <= max
          ? opts.wallAt
          : null,
    },
    bus,
    t,
  );
  const log: { type: keyof GameEvents; payload: unknown }[] = [];
  for (const type of [
    'damage_dealt',
    'power_used',
    'power_denied',
    'hitstop',
    'energy_changed',
  ] as const)
    bus.on(type, (payload) => log.push({ type, payload }));
  const step = (snapshot: InputSnapshot = input(), n = 1) => {
    for (let i = 0; i < n; i++) {
      energy.step(SIM_DT);
      push.step(SIM_DT, snapshot);
    }
  };
  const hits = () =>
    log
      .filter((e) => e.type === 'damage_dealt')
      .map((e) => e.payload as GameEvents['damage_dealt']);
  return {
    t,
    bus,
    registry,
    damage,
    player,
    energy,
    push,
    targets,
    log,
    step,
    hits,
  };
}

describe('dane mocy', () => {
  it('walidacja', () => {
    expect(pushDefinition.cost).toBeGreaterThan(0);
    expect(() => loadPush({ ...pushDefinition, coneAngleDeg: 270 })).toThrow(
      /mocy/,
    );
  });
});

describe('energia', () => {
  it('użycie zużywa energię, brak energii = odmowa no_energy', () => {
    const c = setup();
    c.step(input(['power']));
    expect(c.energy.current).toBe(100 - pushDefinition.cost);
    c.energy.set(pushDefinition.cost - 1);
    c.step(input(), 60);
    c.step(input(['power']));
    const denied = c.log
      .filter((e) => e.type === 'power_denied')
      .map((e) => e.payload);
    expect(denied).toEqual([
      { power: 'push', user: c.player, reason: 'no_energy' },
    ]);
  });

  it('odnowienie: drugie użycie od razu = odmowa cooldown', () => {
    const c = setup();
    c.step(input(['power']));
    c.step(input(['power']));
    expect(
      c.log
        .filter((e) => e.type === 'power_denied')
        .map((e) => (e.payload as GameEvents['power_denied']).reason),
    ).toEqual(['cooldown']);
    expect(c.log.filter((e) => e.type === 'power_used')).toHaveLength(1);
  });

  it('regeneracja dopiero po energyRegenDelayS bez użycia', () => {
    const c = setup();
    c.step(input(['power']));
    const after = c.energy.current;
    c.step(input(), Math.floor(c.t.powers.energyRegenDelayS / SIM_DT) - 2);
    expect(c.energy.current).toBe(after);
    c.step(input(), 30);
    expect(c.energy.current).toBeGreaterThan(after);
  });

  it('zabójstwo wręcz i parowanie ładują energię', () => {
    const c = setup();
    c.energy.set(10);
    c.bus.emit('enemy_killed', { id: 99, killer: c.player, tags: ['#melee'] });
    expect(c.energy.current).toBe(10 + c.t.powers.meleeKillEnergy);
    c.bus.emit('enemy_killed', { id: 98, killer: c.player, tags: ['#gun'] });
    expect(c.energy.current).toBe(10 + c.t.powers.meleeKillEnergy);
    c.bus.emit('parry_success', {
      defender: c.player,
      projectile: 5,
      attacker: 6,
    });
    expect(c.energy.current).toBe(
      10 + c.t.powers.meleeKillEnergy + c.t.powers.parryEnergy,
    );
    // Parowanie wręcz (melee_parried + parry_success) ładuje energię dokładnie raz; cudze parowanie nic.
    c.bus.emit('melee_parried', {
      defender: c.player,
      attacker: 6,
      point: { x: 0, y: 1, z: 0 },
    });
    c.bus.emit('parry_success', {
      defender: c.player,
      projectile: null,
      attacker: 6,
    });
    c.bus.emit('parry_success', {
      defender: 6,
      projectile: null,
      attacker: c.player,
    });
    expect(c.energy.current).toBe(
      10 + c.t.powers.meleeKillEnergy + 2 * c.t.powers.parryEnergy,
    );
  });

  it('emituje energy_changed dla HUD', () => {
    const c = setup();
    c.step(input(['power']));
    const last = c.log
      .filter((e) => e.type === 'energy_changed')
      .at(-1)?.payload;
    expect(last).toEqual({ id: c.player, current: 90, max: 100 });
  });
});

describe('Pchnięcie', () => {
  it('cel w stożku odrzucony (knockback, #power), poza stożkiem i zasięgiem nietknięty', () => {
    const c = setup({
      targets: [
        { x: 0.5, y: 1, z: -3 }, // w stożku
        { x: 4, y: 1, z: -1 }, // poza kątem
        { x: 0, y: 1, z: -20 }, // poza zasięgiem
        { x: 0, y: 1, z: 3 }, // za plecami
      ],
    });
    expect(c.push.use()).toBe(1);
    const hits = c.hits();
    expect(hits).toHaveLength(1);
    expect(hits[0]?.target).toBe(c.targets[0]?.id);
    expect(hits[0]?.knockback).toBe(pushDefinition.knockback);
    expect(hits[0]?.tags).toContain('#power');
    expect(hits[0]?.dir?.z).toBeLessThan(0);
    expect(c.log.find((e) => e.type === 'hitstop')?.payload).toEqual({
      ms: c.t.powers.pushHitstopMs,
    });
  });

  it('odrzut w ścianę zadaje dodatkowe obrażenia po czasie lotu', () => {
    const c = setup({ wallAt: 2 });
    c.push.use();
    expect(c.hits().map((h) => h.amount)).toEqual([pushDefinition.damage]);
    const flightSteps = Math.ceil(2 / pushDefinition.knockback / SIM_DT);
    c.step(input(), flightSteps - 2);
    expect(c.hits()).toHaveLength(1);
    c.step(input(), 3);
    const slam = c.hits()[1];
    expect(slam?.amount).toBe(pushDefinition.wallSlamDamage);
    expect(slam?.tags).toContain('#wall');
  });

  it('ściana dalej niż wallSlamRange — bez dodatkowych obrażeń', () => {
    const c = setup({ wallAt: pushDefinition.wallSlamRange + 1 });
    c.push.use();
    c.step(input(), 120);
    expect(c.hits()).toHaveLength(1);
  });
});
