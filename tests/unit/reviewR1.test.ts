import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DamageSystem, Health } from '../../src/combat/damage';
import { PlasmaBlade } from '../../src/combat/melee/plasmaBlade';
import { plasmaBladeDefinition } from '../../src/combat/melee/bladeSchema';
import { StatusSystem } from '../../src/combat/status/statusSystem';
import { EntityRegistry } from '../../src/core/entities';
import { EventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import type { InputSnapshot } from '../../src/core/input';
import { ResourcePool } from '../../src/core/resource';
import { Stats } from '../../src/core/stats';
import { tuning } from '../../src/core/tuning';
import {
  loadSynergyDefinitions,
  SynergySystem,
} from '../../src/progression/synergies';

function setup(hp = 1000) {
  const bus = new EventBus();
  const registry = new EntityRegistry(bus);
  const damage = new DamageSystem(bus, registry);
  const user = registry.create('player', 'player');
  const first = registry.create('trooper', 'enemy');
  const second = registry.create('trooper', 'enemy');
  const stats = new Stats({ damage: 1 });
  stats.add({ stat: 'damage', type: 'percent', value: 0.35, source: 'test' });
  damage.register(user, new Health(() => 100), {
    outgoing: () => stats.get('damage'),
  });
  damage.register(first, new Health(() => hp));
  damage.register(second, new Health(() => 1000));
  const context = {
    user,
    stats,
    damage,
    addEnergy() {},
    coolWeapon() {},
    targets: () => [first, second],
    position: () => ({ x: 0, y: 0, z: 0 }),
  };
  const hits: GameEvents['damage_dealt'][] = [];
  const triggers: GameEvents['synergy_triggered'][] = [];
  bus.on('damage_dealt', (event) => hits.push(event));
  bus.on('synergy_triggered', (event) => triggers.push(event));
  return { bus, damage, user, first, second, stats, context, hits, triggers };
}

describe('R1', () => {
  it.each(['implants', 'synergies', 'damage'])(
    'documents outgoing exceptions in %s',
    (system) => {
      const doc = readFileSync(`docs/systems/${system}.md`, 'utf8');
      for (const tag of ['#hazard', '#status', '#derived'])
        expect(doc).toContain(tag);
      expect(doc).not.toContain('ataki gracza nie odczytują statystyki');
      expect(doc).not.toContain('wymaga osobnego wklejenia przez architekta');
    },
  );
  it('chain scales base 100 by 1.35 and 0.5 exactly once', () => {
    const f = setup();
    const synergy = new SynergySystem(
      f.bus,
      f.context,
      loadSynergyDefinitions([
        {
          id: 'chain',
          name: 'Test',
          requires: [],
          when: { event: 'damage_dealt' },
          effects: [
            { kind: 'chain_on_hit', jumpRangeM: 3, damageMult: 0.5, tags: [] },
          ],
        },
      ]),
    );
    expect(
      f.damage.deal(f.first, { amount: 100, source: f.user, tags: [] }),
    ).toBe(135);
    expect(f.hits.find((hit) => hit.target === f.second)?.amount).toBeCloseTo(
      67.5,
    );
    synergy.dispose();
  });

  it('explode retains outgoing scaling for base damage', () => {
    const f = setup();
    const synergy = new SynergySystem(
      f.bus,
      f.context,
      loadSynergyDefinitions([
        {
          id: 'explode',
          name: 'Test',
          requires: [],
          when: { event: 'damage_dealt' },
          effects: [
            { kind: 'explode', at: 'target', radiusM: 3, damage: 50, tags: [] },
          ],
        },
      ]),
    );
    f.damage.deal(f.first, { amount: 100, source: f.user, tags: [] });
    expect(f.hits.find((hit) => hit.target === f.second)?.amount).toBeCloseTo(
      67.5,
    );
    expect(f.hits.find((hit) => hit.target === f.second)?.tags).not.toContain(
      '#derived',
    );
    synergy.dispose();
  });

  it.each([0, 3])(
    'status radius %s ignores dead targets without cooldown',
    (radiusM) => {
      const f = setup(1);
      let targets = [f.first];
      const statuses = new StatusSystem(f.bus, f.damage, f.context);
      const synergy = new SynergySystem(
        f.bus,
        {
          ...f.context,
          targets: () => targets,
          applyStatus: (target, app) => statuses.apply(target, app, f.user),
        },
        loadSynergyDefinitions([
          {
            id: 'burn',
            name: 'Test',
            requires: [],
            when: { event: 'damage_dealt' },
            cooldownS: 10,
            effects: [
              {
                kind: 'apply_status_area',
                at: 'target',
                radiusM,
                status: 'burning',
                durationS: 2,
              },
            ],
          },
        ]),
      );
      f.damage.deal(f.first, { amount: 1, source: f.user, tags: [] });
      expect(statuses.has(f.first, 'burning')).toBe(false);
      expect(f.triggers).toHaveLength(0);
      targets = [f.first, f.second];
      f.damage.deal(f.second, { amount: 1, source: f.user, tags: [] });
      expect(statuses.has(f.second, 'burning')).toBe(true);
      expect(f.triggers).toHaveLength(1);
      f.damage.deal(f.second, { amount: 1, source: f.user, tags: [] });
      expect(statuses.stacks(f.second, 'burning')).toBe(1);
      expect(f.triggers).toHaveLength(1);
      synergy.dispose();
      statuses.dispose();
    },
  );

  it.each([
    [2, 1],
    [1, 2],
  ])('freezes active speed %s after change to %s', (initial, next) => {
    const f = setup();
    let speed = initial;
    let inRange = false;
    const t = structuredClone(tuning);
    const def = { ...plasmaBladeDefinition, timeScale: 1 };
    const blade = new PlasmaBlade(
      def,
      {
        owner: f.user,
        team: 'player',
        damage: f.damage,
        stats: f.stats,
        energy: new ResourcePool({ max: () => 100, regenPerS: () => 0 }),
        attackSpeed: () => speed,
        queryArc: () =>
          inRange
            ? [{ entity: f.second, colliderHandle: 1, multiplier: 1 }]
            : [],
        aim: () => ({
          origin: { x: 0, y: 0, z: 0 },
          dir: { x: 0, y: 0, z: -1 },
        }),
      },
      f.bus,
      t,
    );
    const idle: InputSnapshot = {
      held: new Set(),
      pressed: new Set(),
      released: new Set(),
      lookDelta: { x: 0, y: 0 },
    };
    blade.step(0.001, { ...idle, pressed: new Set(['attack']) });
    blade.step(t.melee.lightWindupS / initial, idle);
    expect(blade.view().phase).toBe('active');
    const duration = t.melee.lightActiveS / initial;
    blade.step(duration * 0.25, idle);
    speed = next;
    expect(blade.view().phaseT).toBeCloseTo(0.25);
    blade.step(duration * 0.35, idle);
    expect(blade.view().phase).toBe('active');
    inRange = true;
    blade.step(duration * 0.2, idle);
    expect(f.hits.find((hit) => hit.target === f.second)?.amount).toBeCloseTo(
      def.combo[0]!.damage * 1.35,
    );
    expect(blade.view().phaseT).toBeCloseTo(0.8);
    blade.step(duration * 0.21, idle);
    expect(blade.view().phase).toBe('recovery');
    const recovery = t.melee.lightRecoveryS / next;
    speed = initial;
    blade.step(recovery * 0.6, idle);
    expect(blade.view().phaseT).toBeCloseTo(0.6);
    blade.step(recovery * 0.41, idle);
    expect(blade.view().state).toBe('idle');
    blade.dispose();
  });
});
