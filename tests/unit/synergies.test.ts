import { describe, expect, it, vi } from 'vitest';
import { DamageSystem, Health } from '../../src/combat/damage';
import { EntityRegistry } from '../../src/core/entities';
import { EventBus } from '../../src/core/events';
import type { EntityId, GameEvents } from '../../src/core/events';
import type { Vec3 } from '../../src/core/math';
import { Stats } from '../../src/core/stats';
import bladeDancerRaw from '../../src/data/synergies/bladeDancer.json';
import resonancePistoleroRaw from '../../src/data/synergies/resonancePistolero.json';
import stormGunnerRaw from '../../src/data/synergies/stormGunner.json';
import {
  loadSynergyDefinitions,
  SynergySystem,
  synergyDefinitions,
} from '../../src/progression/synergies';
import type {
  SynergyContext,
  SynergyDefinition,
} from '../../src/progression/synergies';

const BUILD = ['#build_blade', '#build_gunner', '#build_resonance'];

function setupArea(
  effects: unknown[],
  when: unknown = { event: 'damage_dealt' },
) {
  const bus = new EventBus();
  const registry = new EntityRegistry(bus);
  const damage = new DamageSystem(bus, registry);
  const user = registry.create('player', 'player');
  const target = registry.create('dummy', 'enemy');
  const edge = registry.create('dummy', 'enemy');
  const far = registry.create('dummy', 'enemy');
  const missing = registry.create('dummy', 'enemy');
  const health = new Health(() => 100);
  health.set(50);
  damage.register(user, health);
  for (const id of [target, edge, far, missing])
    damage.register(id, new Health(() => 100));
  const positions = new Map<EntityId, Vec3>([
    [target, { x: 10, y: 0, z: 0 }],
    [edge, { x: 10, y: 3, z: 4 }],
    [far, { x: 10, y: 0, z: 5.01 }],
  ]);
  const applyStatus = vi.fn();
  const ctx: SynergyContext = {
    user,
    damage,
    stats: new Stats({ damage: 1 }),
    addEnergy: vi.fn(),
    coolWeapon: vi.fn(),
    heal: (amount) => health.heal(amount),
    userPosition: () => ({ x: 10, y: 0, z: 0 }),
    applyStatus,
    targets: () => [target, edge, far, missing],
    position: (id) => positions.get(id) ?? null,
  };
  const system = new SynergySystem(
    bus,
    ctx,
    loadSynergyDefinitions([
      { id: 'area', name: 'Obszar', requires: [], when, effects, cooldownS: 2 },
    ]),
  );
  const triggered = vi.fn();
  const explosion = vi.fn();
  bus.on('synergy_triggered', triggered);
  bus.on('explosion', explosion);
  const deal = vi.spyOn(damage, 'deal');
  const hit = (
    source: EntityId | null = user,
    recipient = target,
    tags = ['#melee'],
  ) =>
    bus.emit('damage_dealt', {
      source,
      target: recipient,
      amount: 1,
      tags,
      point: null,
      dir: null,
      knockback: 0,
      killed: false,
    });
  return {
    bus,
    ctx,
    system,
    health,
    damage,
    deal,
    user,
    target,
    edge,
    far,
    positions,
    applyStatus,
    triggered,
    explosion,
    hit,
  };
}

function setup(raws: readonly unknown[], tags: readonly string[] = BUILD) {
  const bus = new EventBus();
  const registry = new EntityRegistry(bus);
  const damage = new DamageSystem(bus, registry);
  const player = registry.create('player', 'player');
  const positions = new Map<EntityId, Vec3>();
  const enemies: EntityId[] = [];
  const spawn = (x: number, hp = 1000): EntityId => {
    const id = registry.create('dummy', 'enemy');
    const s = new Stats({ maxHealth: hp });
    damage.register(id, new Health(() => s.get('maxHealth')), { stats: s });
    positions.set(id, { x, y: 0, z: 0 });
    enemies.push(id);
    return id;
  };
  const statusSet = new Set<string>();
  const stats = new Stats({ dashCooldown: 1 });
  const addEnergy = vi.fn();
  const coolWeapon = vi.fn();
  const system = new SynergySystem(
    bus,
    {
      user: player,
      addEnergy,
      coolWeapon,
      stats,
      damage,
      statuses: {
        has: (t, s) => statusSet.has(`${t}:${s}`),
        stacks: () => 0,
        remaining: () => 0,
      },
      targets: () => enemies,
      position: (id) => positions.get(id) ?? null,
    },
    loadSynergyDefinitions(raws),
  );
  system.setTags(tags);
  const triggered: GameEvents['synergy_triggered'][] = [];
  bus.on('synergy_triggered', (e) => triggered.push(e));
  const dealt: GameEvents['damage_dealt'][] = [];
  bus.on('damage_dealt', (e) => dealt.push(e));
  return {
    bus,
    damage,
    player,
    spawn,
    system,
    stats,
    addEnergy,
    coolWeapon,
    triggered,
    dealt,
    statusSet,
  };
}

const parry = { projectile: 1, attacker: null } as const;

describe('SynergySystem — definicje', () => {
  it('loads and validates the three shipped definitions', () => {
    expect(synergyDefinitions.map((d) => d.id).sort()).toEqual([
      'bladeDancer',
      'bladeMastery',
      'gunMastery',
      'resonanceMastery',
      'resonancePistolero',
      'stormGunner',
    ]);
  });

  it('rejects duplicate ids', () => {
    expect(() =>
      loadSynergyDefinitions([bladeDancerRaw, bladeDancerRaw]),
    ).toThrow(/Powtórzona synergia/);
  });

  it('rejects bad effects and inconsistent conditions', () => {
    const base = {
      id: 'x',
      name: 'X',
      requires: [],
      when: { event: 'parry_success' },
    };
    expect(() =>
      loadSynergyDefinitions([{ ...base, effects: [{ kind: 'nope' }] }]),
    ).toThrow();
    expect(() => loadSynergyDefinitions([{ ...base, effects: [] }])).toThrow();
    expect(() =>
      loadSynergyDefinitions([
        {
          ...base,
          effects: [
            { kind: 'chain_on_hit', jumpRangeM: 3, damageMult: 1, tags: [] },
          ],
        },
      ]),
    ).toThrow(/chain_on_hit/);
    expect(() =>
      loadSynergyDefinitions([
        {
          ...base,
          when: { event: 'parry_success', tagsAny: ['#gun'] },
          effects: [{ kind: 'add_energy', amount: 1 }],
        },
      ]),
    ).toThrow(/tagsAny/);
    expect(() =>
      loadSynergyDefinitions([
        {
          ...base,
          effects: [{ kind: 'cool_weapon', amount: 'half' }],
        },
      ]),
    ).toThrow();
  });
});

describe('SynergySystem — requires', () => {
  it('needs every required tag', () => {
    for (const tags of [
      ['#build_blade'],
      ['#build_resonance'],
      ['#build_blade', '#build_gunner'],
    ]) {
      const { bus, addEnergy, system } = setup([bladeDancerRaw], tags);
      expect(system.active()).toEqual([]);
      bus.emit('parry_success', parry);
      expect(addEnergy).not.toHaveBeenCalled();
    }
    const { bus, addEnergy, system } = setup(
      [bladeDancerRaw],
      ['#build_blade', '#build_resonance'],
    );
    expect(system.active()).toEqual(['bladeDancer']);
    bus.emit('parry_success', parry);
    expect(addEnergy).toHaveBeenCalledWith(10);
  });

  it('setTags changes active synergies', () => {
    const { system } = setup(
      [bladeDancerRaw, resonancePistoleroRaw, stormGunnerRaw],
      [],
    );
    expect(system.active()).toEqual([]);
    system.setTags(['#build_gunner', '#build_resonance']);
    expect(system.active()).toEqual(['resonancePistolero', 'stormGunner']);
  });
});

describe('SynergySystem — warunki', () => {
  it('enemy_killed: only the player as killer, with matching tagsAny', () => {
    const { bus, coolWeapon, spawn, player, triggered } = setup([
      resonancePistoleroRaw,
    ]);
    const a = spawn(0);
    bus.emit('enemy_killed', { id: a, killer: player, tags: ['#gun'] });
    bus.emit('enemy_killed', { id: a, killer: null, tags: ['#power'] });
    bus.emit('enemy_killed', { id: a, killer: a, tags: ['#power'] });
    expect(coolWeapon).not.toHaveBeenCalled();
    bus.emit('enemy_killed', {
      id: a,
      killer: player,
      tags: ['#melee', '#power'],
    });
    expect(coolWeapon).toHaveBeenCalledExactlyOnceWith('full');
    expect(triggered).toEqual([
      { synergy: 'resonancePistolero', user: player },
    ]);
  });

  it('damage_dealt: source must be the player, tagsAny and targetStatus must match', () => {
    const { damage, player, spawn, statusSet, system, dealt } = setup([
      stormGunnerRaw,
    ]);
    const a = spawn(0);
    const b = spawn(3);
    // Bez statusu: nic.
    damage.deal(a, { amount: 10, source: player, tags: ['#gun'] });
    expect(dealt).toHaveLength(1);
    statusSet.add(`${a}:overload`);
    // Zły tag.
    damage.deal(a, { amount: 10, source: player, tags: ['#melee'] });
    expect(dealt).toHaveLength(2);
    // Obce źródło.
    damage.deal(a, { amount: 10, source: b, tags: ['#gun'] });
    expect(dealt.filter((e) => e.tags.includes('#elektrycznosc'))).toHaveLength(
      0,
    );
    expect(system.active()).toEqual(['stormGunner']);
    // Wszystko pasuje.
    damage.deal(a, { amount: 10, source: player, tags: ['#gun'] });
    expect(dealt.filter((e) => e.tags.includes('#elektrycznosc'))).toHaveLength(
      1,
    );
  });

  it('power_used, dash_used, projectile_reflected match only the player', () => {
    const defs = (event: string) => ({
      id: event,
      name: event,
      requires: [],
      when: { event },
      effects: [{ kind: 'add_energy', amount: 1 }],
    });
    const { bus, player, addEnergy } = setup([
      defs('power_used'),
      defs('dash_used'),
      defs('projectile_reflected'),
    ]);
    const dir = { x: 0, y: 0, z: 1 };
    bus.emit('power_used', { power: 'push', user: player + 1 });
    bus.emit('dash_used', { user: player + 1, dir });
    bus.emit('projectile_reflected', { id: 1, newOwner: player + 1 });
    expect(addEnergy).not.toHaveBeenCalled();
    bus.emit('power_used', { power: 'push', user: player });
    bus.emit('dash_used', { user: player, dir });
    bus.emit('projectile_reflected', { id: 1, newOwner: player });
    expect(addEnergy).toHaveBeenCalledTimes(3);
  });

  it('does not react to other events', () => {
    const { bus, addEnergy, player } = setup([bladeDancerRaw]);
    bus.emit('power_used', { power: 'push', user: player });
    expect(addEnergy).not.toHaveBeenCalled();
  });
});

describe('SynergySystem — efekty', () => {
  it('cool_weapon accepts a number', () => {
    const { bus, coolWeapon } = setup([
      {
        id: 'c',
        name: 'C',
        requires: [],
        when: { event: 'parry_success' },
        effects: [{ kind: 'cool_weapon', amount: 25 }],
      },
    ]);
    bus.emit('parry_success', parry);
    expect(coolWeapon).toHaveBeenCalledWith(25);
  });

  it('stat_modifier_timed expires and refreshes without stacking', () => {
    const { bus, stats, system } = setup([bladeDancerRaw]);
    expect(stats.get('dashCooldown')).toBe(1);
    bus.emit('parry_success', parry);
    expect(stats.get('dashCooldown')).toBeCloseTo(0.5);
    system.step(2);
    expect(stats.get('dashCooldown')).toBeCloseTo(0.5);
    bus.emit('parry_success', parry);
    expect(stats.modifiers('dashCooldown')).toHaveLength(1);
    expect(stats.get('dashCooldown')).toBeCloseTo(0.5);
    system.step(2); // 2 s od odświeżenia — jeszcze działa
    expect(stats.get('dashCooldown')).toBeCloseTo(0.5);
    system.step(0); // dt <= 0 nic nie zmienia
    system.step(-1);
    expect(stats.get('dashCooldown')).toBeCloseTo(0.5);
    system.step(1.01);
    expect(stats.modifiers('dashCooldown')).toHaveLength(0);
    expect(stats.get('dashCooldown')).toBe(1);
    expect(stats.modifiers()).toHaveLength(0);
  });

  it('chain_on_hit hits the nearest other target in range for scaled damage', () => {
    const { damage, player, spawn, statusSet, dealt } = setup([stormGunnerRaw]);
    const a = spawn(0);
    const far = spawn(5.5);
    const near = spawn(-2);
    spawn(10);
    statusSet.add(`${a}:overload`);
    damage.deal(a, { amount: 20, source: player, tags: ['#gun'] });
    const chained = dealt.filter((e) => e.tags.includes('#synergy'));
    expect(chained).toHaveLength(1);
    expect(chained[0]).toMatchObject({
      target: near,
      amount: 10,
      source: player,
      tags: ['#elektrycznosc', '#synergy'],
    });
    expect(far).not.toBe(near);
  });

  it('chain_on_hit does nothing when no other target is in range', () => {
    const { damage, player, spawn, statusSet, dealt, triggered } = setup([
      stormGunnerRaw,
    ]);
    const a = spawn(0);
    spawn(6.5);
    statusSet.add(`${a}:overload`);
    damage.deal(a, { amount: 20, source: player, tags: ['#gun'] });
    expect(dealt).toHaveLength(1);
    // Łańcuch bez celu nie jest wyzwoleniem: bez synergy_triggered i bez odnowienia.
    expect(triggered).toHaveLength(0);
  });
});

describe('SynergySystem — pętle, odnowienie, cykl życia', () => {
  it('events tagged #synergy never trigger synergies', () => {
    const { bus, damage, player, spawn, statusSet, dealt, coolWeapon } = setup([
      stormGunnerRaw,
      {
        id: 'k',
        name: 'K',
        requires: [],
        when: { event: 'enemy_killed' },
        effects: [{ kind: 'cool_weapon', amount: 'full' }],
      },
    ]);
    const a = spawn(0);
    const b = spawn(2, 5);
    statusSet.add(`${a}:overload`);
    statusSet.add(`${b}:overload`);
    // Łańcuch zabija b — ani kolejny łańcuch, ani zabójstwo z #synergy nie wyzwalają.
    damage.deal(a, { amount: 100, source: player, tags: ['#gun'] });
    expect(dealt.filter((e) => e.tags.includes('#synergy'))).toHaveLength(1);
    expect(coolWeapon).not.toHaveBeenCalled();
    bus.emit('enemy_killed', { id: b, killer: player, tags: ['#synergy'] });
    expect(coolWeapon).not.toHaveBeenCalled();
  });

  it('cooldownS blocks re-triggering until simulation time passes', () => {
    const { bus, addEnergy, system } = setup([
      {
        id: 'cd',
        name: 'CD',
        requires: [],
        when: { event: 'parry_success' },
        effects: [{ kind: 'add_energy', amount: 1 }],
        cooldownS: 2,
      },
    ]);
    bus.emit('parry_success', parry);
    bus.emit('parry_success', parry);
    expect(addEnergy).toHaveBeenCalledTimes(1);
    system.step(1.9);
    bus.emit('parry_success', parry);
    expect(addEnergy).toHaveBeenCalledTimes(1);
    system.step(0.2);
    bus.emit('parry_success', parry);
    expect(addEnergy).toHaveBeenCalledTimes(2);
  });

  it('emits synergy_triggered once per trigger', () => {
    const { bus, player, triggered } = setup([bladeDancerRaw]);
    bus.emit('parry_success', parry);
    expect(triggered).toEqual([{ synergy: 'bladeDancer', user: player }]);
  });

  it('reset removes modifiers and cooldowns', () => {
    const { bus, addEnergy, stats, system } = setup([
      { ...(bladeDancerRaw as SynergyDefinition), cooldownS: 10 },
    ]);
    bus.emit('parry_success', parry);
    expect(stats.get('dashCooldown')).toBeCloseTo(0.5);
    system.reset();
    expect(stats.get('dashCooldown')).toBe(1);
    bus.emit('parry_success', parry);
    expect(addEnergy).toHaveBeenCalledTimes(2);
  });

  it('dispose detaches listeners and clears modifiers', () => {
    const { bus, addEnergy, stats, system } = setup([bladeDancerRaw]);
    bus.emit('parry_success', parry);
    system.dispose();
    expect(stats.modifiers()).toHaveLength(0);
    bus.emit('parry_success', parry);
    expect(addEnergy).toHaveBeenCalledTimes(1);
  });
});

describe('SynergySystem — dane z GDD', () => {
  it('Pistolero Rezonansu: power kill cools the weapon fully', () => {
    const { bus, coolWeapon, player, spawn } = setup(
      synergyDefinitions.map((d) => d),
    );
    const a = spawn(0);
    bus.emit('enemy_killed', { id: a, killer: player, tags: ['#power'] });
    expect(coolWeapon).toHaveBeenCalledWith('full');
  });

  it('Tancerz ostrzy: parry gives 10 energy and halves dash cooldown for 3 s', () => {
    const { bus, addEnergy, stats, system } = setup(
      synergyDefinitions.map((d) => d),
    );
    bus.emit('parry_success', parry);
    expect(addEnergy).toHaveBeenCalledWith(10);
    expect(stats.get('dashCooldown')).toBeCloseTo(0.5);
    system.step(3.01);
    expect(stats.get('dashCooldown')).toBe(1);
  });

  it('Burzowy strzelec: gun hit on an overloaded enemy jumps within 6 m at 50%', () => {
    const { damage, player, spawn, statusSet, dealt } = setup(
      synergyDefinitions.map((d) => d),
    );
    const a = spawn(0);
    const b = spawn(6);
    statusSet.add(`${a}:overload`);
    damage.deal(a, { amount: 8, source: player, tags: ['#gun'] });
    const chained = dealt.find((e) => e.tags.includes('#synergy'));
    expect(chained).toMatchObject({ target: b, amount: 4 });
  });
});

describe('Z4 — nowe efekty wyzwalaczy', () => {
  const blast = {
    kind: 'explode',
    at: 'target',
    radiusM: 5,
    damage: 12,
    knockback: 8,
    tags: ['#fire'],
  };
  const burn = {
    kind: 'apply_status_area',
    at: 'target',
    radiusM: 0,
    status: 'burning',
    durationS: 2,
    stacks: 1,
  };

  it('leczy; brak funkcji nie emituje wyzwolenia ani nie zużywa odnowienia', () => {
    const h = setupArea([{ kind: 'heal', amount: 8 }]);
    const heal = h.ctx.heal;
    delete h.ctx.heal;
    h.hit();
    expect(h.health.current).toBe(50);
    expect(h.triggered).not.toHaveBeenCalled();
    h.ctx.heal = heal;
    h.hit();
    h.hit();
    expect(h.health.current).toBe(58);
    expect(h.triggered).toHaveBeenCalledTimes(1);
    h.system.step(2);
    h.hit();
    expect(h.health.current).toBe(66);
  });

  it('wybuch trafia cel i granicę sfery, zachowuje kredyt, odrzut i nie tworzy pętli', () => {
    const h = setupArea([blast]);
    h.hit();
    expect(h.damage.health(h.target)?.current).toBe(88);
    expect(h.damage.health(h.edge)?.current).toBe(88);
    expect(h.damage.health(h.far)?.current).toBe(100);
    expect(h.deal).toHaveBeenCalledTimes(2);
    expect(h.deal).toHaveBeenCalledWith(h.edge, {
      amount: 12,
      source: h.user,
      tags: ['#fire', '#synergy'],
      point: { x: 10, y: 0, z: 0 },
      dir: { x: 0, y: 0.6, z: 0.8 },
      knockback: 8,
    });
    expect(h.deal).toHaveBeenCalledWith(
      h.target,
      expect.objectContaining({ dir: { x: 0, y: 0, z: 0 } }),
    );
    expect(h.explosion).toHaveBeenCalledExactlyOnceWith({
      point: { x: 10, y: 0, z: 0 },
      radiusM: 5,
      owner: h.user,
      tags: ['#fire', '#synergy'],
    });
    expect(h.triggered).toHaveBeenCalledTimes(1);
  });

  it('wybuch po zabójstwie ignoruje martwy cel, ale rani sąsiada bez kolejnej eksplozji', () => {
    const h = setupArea([{ ...blast, damage: 200 }], { event: 'enemy_killed' });
    h.damage.deal(h.target, { source: h.user, amount: 100, tags: ['#gun'] });
    expect(h.damage.health(h.target)?.dead).toBe(true);
    expect(h.damage.health(h.edge)?.dead).toBe(true);
    expect(h.damage.health(h.far)?.current).toBe(100);
    expect(h.explosion).toHaveBeenCalledTimes(1);
    expect(h.triggered).toHaveBeenCalledTimes(1);
  });

  it('radiusM = 0 nakłada status tylko na cel nawet bez jego pozycji', () => {
    const h = setupArea([burn]);
    h.positions.clear();
    h.hit();
    expect(h.applyStatus).toHaveBeenCalledExactlyOnceWith(h.target, {
      id: 'burning',
      durationS: 2,
      stacks: 1,
    });
    expect(h.triggered).toHaveBeenCalledTimes(1);
  });

  it('obszar statusu uwzględnia promień, stosy i pozycję użytkownika', () => {
    const h = setupArea(
      [{ ...burn, at: 'user', radiusM: 5, status: 'overload', stacks: 2 }],
      { event: 'dash_used' },
    );
    h.bus.emit('dash_used', { user: h.user, dir: { x: 1, y: 0, z: 0 } });
    expect(h.applyStatus.mock.calls).toEqual([
      [h.target, { id: 'overload', durationS: 2, stacks: 2 }],
      [h.edge, { id: 'overload', durationS: 2, stacks: 2 }],
    ]);
  });

  it('brak applyStatus i pusty obszar nie zużywają odnowienia', () => {
    const h = setupArea([{ ...burn, radiusM: 5 }]);
    delete h.ctx.applyStatus;
    h.hit();
    expect(h.triggered).not.toHaveBeenCalled();
    h.ctx.applyStatus = h.applyStatus;
    const targets = h.ctx.targets;
    h.ctx.targets = () => [];
    h.hit();
    expect(h.triggered).not.toHaveBeenCalled();
    h.ctx.targets = targets;
    h.hit();
    expect(h.applyStatus).toHaveBeenCalledTimes(2);
  });

  it.each(['explode', 'apply_status_area'])(
    '%s pomija brak pozycji bez odnowienia',
    (kind) => {
      const effect = kind === 'explode' ? blast : { ...burn, radiusM: 5 };
      const h = setupArea([{ ...effect, at: 'user' }], { event: 'dash_used' });
      const fire = () =>
        h.bus.emit('dash_used', { user: h.user, dir: { x: 1, y: 0, z: 0 } });
      delete h.ctx.userPosition;
      fire();
      h.ctx.userPosition = () => null;
      fire();
      expect(h.triggered).not.toHaveBeenCalled();
      h.ctx.userPosition = () => ({ x: 10, y: 0, z: 0 });
      fire();
      expect(h.triggered).toHaveBeenCalledTimes(1);
    },
  );

  it('targetIsUser wybiera otrzymane obrażenia, także bez źródła, i ignoruje #synergy', () => {
    const h = setupArea([{ kind: 'heal', amount: 4 }], {
      event: 'damage_dealt',
      targetIsUser: true,
    });
    h.hit();
    h.hit(h.edge, h.target);
    h.hit(h.target, h.user, ['#synergy']);
    expect(h.triggered).not.toHaveBeenCalled();
    h.hit(h.target, h.user);
    expect(h.health.current).toBe(54);
    h.system.step(2);
    h.hit(null, h.user);
    expect(h.health.current).toBe(58);
  });

  it.each([undefined, false])(
    'targetIsUser=%s zachowuje filtr źródła gracza',
    (targetIsUser) => {
      const h = setupArea([{ kind: 'heal', amount: 4 }], {
        event: 'damage_dealt',
        targetIsUser,
      });
      h.hit(h.target, h.user);
      expect(h.triggered).not.toHaveBeenCalled();
      h.hit();
      expect(h.health.current).toBe(54);
    },
  );

  it('walidacja odrzuca cel przy zdarzeniu bez celu i błędne parametry efektów', () => {
    for (const event of [
      'dash_used',
      'power_used',
      'parry_success',
      'projectile_reflected',
    ]) {
      expect(() => setupArea([blast], { event })).toThrow(/target/);
      expect(() => setupArea([burn], { event })).toThrow(/target/);
    }
    for (const effect of [
      { ...blast, radiusM: -1 },
      { ...blast, radiusM: 0 },
      { ...blast, damage: -1 },
      { ...blast, knockback: -1 },
      { ...burn, radiusM: -1 },
      { ...burn, status: 'unknown' },
      { ...burn, durationS: 0 },
      { ...burn, stacks: 0 },
      { ...burn, stacks: 1.5 },
      { kind: 'heal', amount: 0 },
      { kind: 'heal', amount: -1 },
    ])
      expect(() => setupArea([effect])).toThrow();
    expect(() =>
      setupArea([burn], { event: 'enemy_killed', targetIsUser: false }),
    ).toThrow(/targetIsUser/);
  });
});

describe('F3 tag counts and implant triggers', () => {
  it('requires two sources and retains the presence requirements', () => {
    const def = { ...bladeDancerRaw, requiresCount: { '#melee': 2 } };
    const { system } = setup([def], [...BUILD, '#melee']);
    expect(system.active()).toEqual([]);
    system.setTags([...BUILD, '#melee', '#melee']);
    expect(system.active()).toEqual(['bladeDancer']);
    system.setTags(['#melee', '#melee']);
    expect(system.active()).toEqual([]);
  });
  it('implant effects share cooldowns, reject synergy damage and detach timed effects', () => {
    const { system, bus, player, addEnergy, stats } = setup([]);
    system.setImplantTriggers([
      {
        implantId: 'trigger',
        trigger: {
          when: { event: 'damage_dealt' },
          cooldownS: 2,
          effects: [
            { kind: 'add_energy', amount: 4 },
            {
              kind: 'stat_modifier_timed',
              stat: 'damage',
              type: 'flat',
              value: 3,
              durationS: 4,
            },
          ],
        },
      },
    ]);
    const hit = (tags: string[]) =>
      bus.emit('damage_dealt', {
        source: player,
        target: 100,
        amount: 10,
        tags,
        point: null,
        dir: null,
        knockback: 0,
        killed: false,
      });
    hit(['#synergy']);
    expect(addEnergy).not.toHaveBeenCalled();
    hit(['#melee']);
    hit(['#melee']);
    expect(addEnergy).toHaveBeenCalledTimes(1);
    system.step(2);
    hit(['#melee']);
    expect(addEnergy).toHaveBeenCalledTimes(2);
    expect(stats.get('damage')).toBe(3);
    system.setImplantTriggers([]);
    expect(stats.get('damage')).toBe(0);
    system.step(5);
    hit(['#melee']);
    expect(addEnergy).toHaveBeenCalledTimes(2);
  });
});
