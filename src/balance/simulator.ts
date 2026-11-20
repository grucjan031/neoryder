import { DamageSystem, Health, Hurtboxes } from '../combat/damage';
import { plasmaBladeDefinition } from '../combat/melee/bladeSchema';
import type { BladeDefinition } from '../combat/melee/bladeSchema';
import { PlasmaBlade } from '../combat/melee/plasmaBlade';
import { PlayerEnergy } from '../combat/powers/energy';
import type { Power, PowerDeps } from '../combat/powers/power';
import { createPower, powerDefinitions } from '../combat/powers/registry';
import { StatusSystem } from '../combat/status';
import type { ProjectileSpec } from '../combat/weapons/projectiles';
import { Weapon } from '../combat/weapons/weapon';
import { weaponDefinitions } from '../combat/weapons/weaponSchema';
import type { WeaponDefinition } from '../combat/weapons/weaponSchema';
import { EntityRegistry } from '../core/entities';
import { EventBus } from '../core/events';
import type { EntityId } from '../core/events';
import type { Action, InputSnapshot } from '../core/input';
import { SIM_DT } from '../core/loop';
import { Rng } from '../core/rng';
import { Stats } from '../core/stats';
import type { StatId, StatModifier } from '../core/stats';
import { tuning } from '../core/tuning';
import type { Tuning } from '../core/tuning';
import { enemySchema } from '../enemies/enemySchema';
import type { EnemyDefinition } from '../enemies/enemySchema';
import { loadoutDefinitions } from '../progression/loadout';

export const MAX_TIME_S = 120;
/** Miara bramki: czas zabicia tylu wrogów danego typu po kolei. */
export const PACK_SIZE = 5;
// Te same bazy co Arena.playerStats; bez implantów i synergii.
export const PLAYER_STATS = {
  maxEnergy: 100,
  energyRegen: 25,
  heatCapacity: 100,
  coolingRate: 45,
} as const;

export type Attack =
  | { kind: 'weapon'; definition: WeaponDefinition }
  | { kind: 'powers'; ids: readonly string[] }
  | { kind: 'blade'; definition: BladeDefinition; mode: 'combo' | 'heavy' };

export interface SimulationOptions {
  maxTimeS?: number;
  playerStats?: Partial<Record<StatId, number>>;
  targetModifiers?: readonly StatModifier[];
  settings?: Tuning;
  /** null = otwarta przestrzeń; odległość ściany od celu. */
  wallDistanceM?: number | null;
  /** Idealizacja z briefu: wszystkie przebicia sumują się na tym samym celu. */
  repeatPierce?: boolean;
  /**
   * Liczba wrogów zabijanych po kolei (domyślnie 1). Po śmierci pojawia się
   * natychmiast następny, świeży, w tym samym miejscu; ciepło, odnowienia,
   * energia i zegary przechodzą dalej, statusy znikają z martwym celem.
   */
  count?: number;
}

export interface SimulationResult {
  /** Czas zabicia ostatniego z `count` celów; ∞, gdy nie wszystkie padły. */
  ttkS: number;
  kills: number;
  killTimesS: number[];
  dps: number;
  damage: number;
  elapsedS: number;
  shots: number;
  powerUses: number;
  overheats: number;
  statusDamage: number;
  appliedStatuses: string[];
  warnings: string[];
}

export const enemyDefinitions = new Map(
  Object.values(
    import.meta.glob('../data/enemies/*.json', {
      eager: true,
      import: 'default',
    }),
  )
    .map((raw) => enemySchema.parse(raw))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((def) => [def.id, def]),
);

export function damagingPowerIds(
  ids: readonly string[],
  warnings: string[],
): string[] {
  return ids.filter((id) => {
    const def = powerDefinitions.get(id);
    if (!def) {
      warnings.push(`Pominięto nieznaną moc: ${id}.`);
      return false;
    }
    const kind: string = def.kind;
    switch (def.kind) {
      case 'cone':
        return def.damage > 0 || def.wallSlamDamage > 0;
      case 'chain':
        return def.damage > 0;
      default: {
        if (kind !== 'focus' && kind !== 'barrier')
          warnings.push(
            `Pominięto nieobsługiwany rodzaj mocy: ${kind} (${id}).`,
          );
        return false;
      }
    }
  });
}

export function simulate(
  attack: Attack,
  enemy: EnemyDefinition,
  options: SimulationOptions = {},
): SimulationResult {
  const settings = options.settings ?? tuning;
  const bus = new EventBus();
  const entities = new EntityRegistry(bus);
  const owner = entities.create('player', 'player');
  const damage = new DamageSystem(bus, entities);
  const stats = new Stats({ ...PLAYER_STATS, ...options.playerStats });
  const count = Math.max(1, Math.floor(options.count ?? 1));
  const createTarget = () => {
    const id = entities.create(enemy.kind, 'enemy');
    const targetStats = new Stats({
      maxHealth: enemy.maxHealth,
      moveSpeed: enemy.moveSpeed,
      damage: enemy.damage,
    });
    for (const modifier of options.targetModifiers ?? [])
      targetStats.add(modifier);
    const created = new Health(() => targetStats.get('maxHealth'));
    damage.register(id, created, { stats: targetStats });
    return { id, health: created };
  };
  let { id: target, health } = createTarget();
  const energy = new PlayerEnergy(owner, stats, bus, settings);
  const origin = { x: 0, y: 0, z: 0 };
  const dir = { x: 0, y: 0, z: -1 };
  const ranges =
    attack.kind === 'weapon'
      ? [
          attack.definition.fireMode === 'beam'
            ? attack.definition.rangeM
            : attack.definition.projectileSpeed *
              attack.definition.projectileLifetimeS,
        ]
      : attack.kind === 'blade'
        ? [...attack.definition.combo, attack.definition.heavy].map(
            (strike) => strike.reach,
          )
        : attack.ids.flatMap((id) => {
            const def = powerDefinitions.get(id);
            if (def?.kind === 'cone') return [def.range];
            if (def?.kind === 'chain') return [def.rangeM];
            return [];
          });
  const position = { x: 0, y: 0, z: -Math.min(...ranges, 1) / 2 };
  const hurtboxMultiplier = enemy.drone?.hurtboxMultiplier ?? 1;
  const aim = () => ({ origin, dir });
  const statuses = new StatusSystem(bus, damage, {
    position: (id) => (id === target ? position : null),
    targets: () => [target],
  });
  const result: SimulationResult = {
    ttkS: Infinity,
    kills: 0,
    killTimesS: [],
    dps: 0,
    damage: 0,
    elapsedS: 0,
    shots: 0,
    powerUses: 0,
    overheats: 0,
    statusDamage: 0,
    appliedStatuses: [],
    warnings: [],
  };
  bus.on('damage_dealt', (event) => {
    if (event.target !== target) return;
    result.damage += event.amount;
    if (event.tags.includes('#status')) result.statusDamage += event.amount;
  });
  bus.on('status_applied', ({ status }) => {
    if (!result.appliedStatuses.includes(status))
      result.appliedStatuses.push(status);
  });
  bus.on('power_used', () => result.powerUses++);
  let wasOverheated = false;
  bus.on('heat_changed', ({ overheated }) => {
    if (overheated && !wasOverheated) result.overheats++;
    wasOverheated = overheated;
  });

  const hit = (spec: ProjectileSpec): EntityId => {
    const count =
      (options.repeatPierce ?? true) ? (spec.pierce?.count ?? 1) : 1;
    for (let i = 0; i < count; i++)
      damage.deal(target, {
        source: spec.owner,
        amount:
          spec.damage *
          hurtboxMultiplier *
          Math.pow(1 - (spec.pierce?.falloff ?? 0), i),
        tags: spec.tags,
        dir,
        point: position,
        ...(spec.statuses ? { statuses: spec.statuses } : {}),
      });
    if (spec.explode)
      damage.deal(target, {
        source: spec.owner,
        amount: spec.explode.damage,
        tags: spec.explode.tags,
        dir,
        point: position,
        ...(spec.explode.statuses ? { statuses: spec.explode.statuses } : {}),
      });
    return target;
  };
  const weapon =
    attack.kind === 'weapon'
      ? new Weapon(
          owner,
          { bus, rng: new Rng('balance'), tuning: settings },
          stats,
          {
            projectiles: { spawn: hit },
            damage,
            castBeam: () => ({
              target,
              distance: -position.z,
              point: position,
            }),
          },
          attack.definition,
        )
      : null;
  const deps: PowerDeps = {
    owner,
    bus,
    tuning: settings,
    damage,
    energy,
    aim,
    targets: () => [{ id: target, position }],
    castWall: (_from, _dir, max) => {
      const wall = options.wallDistanceM;
      return wall !== undefined && wall !== null && wall <= max ? wall : null;
    },
  };
  const powers: Power[] =
    attack.kind === 'powers'
      ? damagingPowerIds(attack.ids, result.warnings).map((id) =>
          createPower(id, deps),
        )
      : [];
  const hurtboxes = new Hurtboxes();
  let box = hurtboxes.add(target, 0, hurtboxMultiplier);
  // Następca nie dostaje cięcia, które zabiło poprzednika: jedno cięcie = jeden cel.
  let bladeLocked = false;
  const blade =
    attack.kind === 'blade'
      ? new PlasmaBlade(
          attack.definition,
          {
            owner,
            team: 'player',
            damage,
            stats,
            energy: energy.pool,
            queryArc: () => (bladeLocked ? [] : [box]),
            aim,
          },
          bus,
          settings,
        )
      : null;
  let held = false;
  let semiRelease = false;
  const maxSteps = Math.floor((options.maxTimeS ?? MAX_TIME_S) / SIM_DT);
  for (let tick = 1; tick <= maxSteps; tick++) {
    damage.step(SIM_DT);
    energy.step(SIM_DT);
    statuses.step(SIM_DT);
    if (!health.dead) {
      if (weapon) {
        // Zwolnienie spustu po strzale, ponawianie wciśnięć do końca cooldownu.
        const before = weapon.shots;
        weapon.step(SIM_DT, { ...aim(), triggerHeld: !semiRelease });
        if (!weapon.definition.automatic) {
          if (semiRelease) semiRelease = false;
          else if (weapon.shots > before) semiRelease = true;
          else {
            // cool(0) zwalnia wejście, nie przesuwa czasu ani ciepła.
            weapon.cool(0);
          }
        }
      }
      for (const power of powers) {
        if (health.dead) break;
        power.step(SIM_DT, { pressed: true, held: true, released: false });
      }
      if (blade && attack.kind === 'blade') {
        if (bladeLocked && blade.view().phase !== 'active') bladeLocked = false;
        const view = blade.view();
        if (attack.mode === 'combo') {
          blade.step(SIM_DT, bladeInput(true, false, false));
        } else {
          const press = view.state === 'idle' && !held;
          if (press) held = true;
          const release = view.state === 'charging' && view.charge >= 1;
          if (release) held = false;
          blade.step(SIM_DT, bladeInput(press, held, release));
        }
      }
    }
    result.elapsedS = tick * SIM_DT;
    if (health.dead) {
      result.kills++;
      result.killTimesS.push(result.elapsedS);
      if (result.kills >= count) {
        result.ttkS = result.elapsedS;
        break;
      }
      damage.unregister(target);
      entities.destroy(target);
      hurtboxes.removeEntity(target);
      ({ id: target, health } = createTarget());
      box = hurtboxes.add(target, 0, hurtboxMultiplier);
      bladeLocked = blade !== null;
    }
  }
  result.shots = weapon?.shots ?? 0;
  result.dps = result.elapsedS > 0 ? result.damage / result.elapsedS : 0;
  blade?.dispose();
  statuses.dispose();
  energy.dispose();
  return result;
}

function bladeInput(
  pressed: boolean,
  held: boolean,
  released: boolean,
): InputSnapshot {
  const actions = (active: boolean) =>
    new Set<Action>(active ? ['attack'] : []);
  return {
    pressed: actions(pressed),
    held: actions(held),
    released: actions(released),
    lookDelta: { x: 0, y: 0 },
  };
}

export interface AttackRow {
  id: string;
  name: string;
  /** Pojedynczy cel (informacyjnie). */
  results: SimulationResult[];
  /** Paczka PACK_SIZE celów po kolei (miara bramki). */
  packResults: SimulationResult[];
}
export interface PathRow {
  enemy: string;
  ttkS: [number, number, number];
  choices: [string, string, string];
  medianS: number;
  ratios: [number, number, number];
  passed: boolean;
}
export interface BalanceResult {
  enemies: EnemyDefinition[];
  attacks: AttackRow[];
  /** Ścieżki wg TTK paczki: to one rozstrzygają bramkę. */
  paths: PathRow[];
  /** Ścieżki wg pojedynczego TTK: informacyjnie, nie wpływają na `passed`. */
  singlePaths: PathRow[];
  warnings: string[];
  passed: boolean;
}

export function evaluateGate(ttkS: [number, number, number]) {
  const medianS = [...ttkS].sort((a, b) => a - b)[1]!;
  const ratios = ttkS.map((time) => time / medianS) as [number, number, number];
  return {
    medianS,
    ratios,
    passed:
      Number.isFinite(medianS) &&
      medianS > 0 &&
      ttkS.every(
        (time) =>
          Number.isFinite(time) && time >= medianS / 2 && time <= medianS * 2,
      ),
  };
}

export function runBalance(options: SimulationOptions = {}): BalanceResult {
  // Raport F2 mierzy zwykłych wrogów; TTK bossa wymaga symulacji jego faz.
  const enemies = [...enemyDefinitions.values()].filter(
    (definition) => definition.kind !== 'boss',
  );
  const warnings: string[] = [];
  const candidates: { id: string; name: string; attack: Attack }[] = [
    ...[...weaponDefinitions.values()].map((definition) => ({
      id: definition.id,
      name: definition.name,
      attack: { kind: 'weapon' as const, definition },
    })),
    ...damagingPowerIds([...powerDefinitions.keys()], warnings).map((id) => ({
      id,
      name: powerDefinitions.get(id)!.name,
      attack: { kind: 'powers' as const, ids: [id] },
    })),
    ...(['combo', 'heavy'] as const).map((mode) => ({
      id: `plasmaBlade:${mode}`,
      name: `Ostrze: ${mode === 'combo' ? 'combo lekkie' : 'ciężki atak'}`,
      attack: {
        kind: 'blade' as const,
        definition: plasmaBladeDefinition,
        mode,
      },
    })),
  ];
  const packOptions = { ...options, count: PACK_SIZE };
  const attacks = candidates.map(({ id, name, attack }) => ({
    id,
    name,
    results: enemies.map((enemy) =>
      simulate(attack, enemy, { ...options, count: 1 }),
    ),
    packResults: enemies.map((enemy) => simulate(attack, enemy, packOptions)),
  }));
  const loadout = (id: string) => {
    const def = loadoutDefinitions.get(id);
    if (!def) throw new Error(`Brak ekwipunku: ${id}`);
    return def;
  };
  const blade = loadout('blade');
  if (blade.blade !== plasmaBladeDefinition.id)
    throw new Error(`Nieznane ostrze: ${blade.blade}`);
  const gunner = loadout('gunner');
  const resonance = loadout('resonance');
  const rotations = permutations(damagingPowerIds(resonance.powers, warnings));
  const buildPaths = (pack: boolean) =>
    enemies.map((enemy, index): PathRow => {
      const sim = pack ? packOptions : { ...options, count: 1 };
      const best = (rows: { id: string; result: SimulationResult }[]) => {
        const winner = rows.sort((a, b) => a.result.ttkS - b.result.ttkS)[0];
        if (!winner) throw new Error('Brak ofensywnego wyposażenia ścieżki');
        return winner;
      };
      const bestFrom = (ids: readonly string[]) =>
        best(
          ids.map((id) => {
            const row = attacks.find((attack) => attack.id === id);
            const result = (pack ? row?.packResults : row?.results)?.[index];
            if (!result) throw new Error(`Brak wyniku: ${id}`);
            return { id, result };
          }),
        );
      const b = bestFrom([`${blade.blade}:combo`, `${blade.blade}:heavy`]);
      const g = bestFrom(gunner.weapons);
      const p = best(
        rotations.map((ids) => ({
          id: ids.join(' → '),
          result: simulate({ kind: 'powers', ids }, enemy, sim),
        })),
      );
      const ttkS: [number, number, number] = [
        b.result.ttkS,
        p.result.ttkS,
        g.result.ttkS,
      ];
      return {
        enemy: enemy.id,
        ttkS,
        choices: [b.id, p.id, g.id],
        ...evaluateGate(ttkS),
      };
    });
  const paths = buildPaths(true);
  return {
    enemies,
    attacks,
    paths,
    singlePaths: buildPaths(false),
    warnings,
    passed: paths.every((path) => path.passed),
  };
}

function permutations(ids: readonly string[]): string[][] {
  if (ids.length === 0) return [[]];
  return ids.flatMap((id, index) =>
    permutations(ids.filter((_, i) => i !== index)).map((tail) => [
      id,
      ...tail,
    ]),
  );
}
