import type { RoomPlanner } from '../core/runTypes';
import type { StatModifier } from '../core/stats';
import { threatLevels } from '../progression/threatSchema';
import type { ThreatLevel } from '../progression/threatSchema';
import { tuning } from '../core/tuning';
import {
  enemyThreatCost,
  sectorThreatSchema,
  threatPacingSchema,
} from './sectorSchema';
import { wavesSchema } from './waves';
import type { WavesDefinition } from './waves';

/** Definicja Poziomu zagrożenia z danych (`threat.json`); nieznany poziom to błąd. */
export function threatLevelDef(level: number): ThreatLevel {
  const def = Number.isInteger(level) ? threatLevels[level] : undefined;
  if (!def) throw new Error(`Nieznany Poziom zagrożenia: ${level}.`);
  return def;
}

/** Modyfikatory wrogów dla poziomu (źródło `threat:<poziom>`); poziom 0 nic nie zmienia. */
export function threatModifiers(level: number): StatModifier[] {
  const def = threatLevelDef(level);
  const source = `threat:${level}`;
  const mods: StatModifier[] = [];
  if (def.enemyHealth !== 0)
    mods.push({
      stat: 'maxHealth',
      type: 'percent',
      value: def.enemyHealth,
      source,
    });
  if (def.enemyDamage !== 0)
    mods.push({
      stat: 'damage',
      type: 'percent',
      value: def.enemyDamage,
      source,
    });
  return mods;
}

export const planWaves: RoomPlanner['planWaves'] = (
  room,
  sector,
  node,
  rng,
  threatLevel = 0,
) => {
  if (node.type !== 'combat' && node.type !== 'elite')
    throw new Error('Budżet zagrożenia obsługuje tylko combat i elite.');
  const threat = sectorThreatSchema.parse(sector.threat);
  const { type } = node;
  const base = threat.base[type];
  const perLayer = threat.perLayer[type];
  const range = threat.waveCount[type];
  const pool = threat.pools[type];
  if (base === undefined || perLayer === undefined || !range || !pool)
    throw new Error(`Niepełna konfiguracja threat dla ${type}.`);
  if (!Number.isInteger(node.layer) || node.layer < 1)
    throw new Error('Warstwa pokoju musi być dodatnią liczbą całkowitą.');
  const budget =
    (base + perLayer * (node.layer - 1)) *
    (room.threatMultiplier ?? 1) *
    threatLevelDef(threatLevel).budgetMult;
  if (!Number.isFinite(budget) || budget < 0)
    throw new Error('Nieprawidłowy budżet zagrożenia.');
  const random = rng.fork(`room:${node.id}`);
  const count = random.int(range.min, range.max);
  // Próbkowanie liniowe zachowuje pierwszy i ostatni ciężar dla każdej liczby fal.
  const weights = Array.from({ length: count }, (_, i) => {
    const position =
      count === 1 ? 0 : (i * (threat.waveWeights.length - 1)) / (count - 1);
    const lower = Math.floor(position);
    const first = threat.waveWeights[lower]!;
    const last = threat.waveWeights[Math.ceil(position)]!;
    return first + (last - first) * (position - lower);
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const groups = Array.from({ length: count }, () => new Map<string, number>());
  const sizes = Array<number>(count).fill(0);
  const add = (wave: number, id: string) => {
    const group = groups[wave]!;
    group.set(id, (group.get(id) ?? 0) + 1);
    sizes[wave] = sizes[wave]! + 1;
  };
  const guaranteedEnemy = sector.eliteGuarantee ?? 'executor';
  const guaranteedCost =
    type === 'elite' ? enemyThreatCost(guaranteedEnemy) : 0;
  if (type === 'elite') add(count - 1, guaranteedEnemy);
  let remaining = Math.max(0, budget - guaranteedCost);
  const distributable = remaining;
  const eligible = Object.entries(pool)
    .map(([id, weight]) => ({
      id,
      weight,
      cost: enemyThreatCost(id),
    }))
    .filter(({ id }) => node.layer >= (threat.unlockLayer?.[id] ?? 1));
  let carry = 0;
  for (let i = 0; i < count; i++) {
    let allowance =
      i === count - 1
        ? remaining
        : Math.min(
            remaining,
            carry + (distributable * weights[i]!) / totalWeight,
          );
    while (sizes[i]! < tuning.arena.maxEnemies) {
      const affordable = eligible.filter(({ cost }) => cost <= allowance);
      if (affordable.length === 0) break;
      let roll =
        random.next() *
        affordable.reduce((sum, entry) => sum + entry.weight, 0);
      let chosen = affordable[affordable.length - 1]!;
      for (const entry of affordable) {
        roll -= entry.weight;
        if (roll < 0) {
          chosen = entry;
          break;
        }
      }
      add(i, chosen.id);
      allowance -= chosen.cost;
      remaining -= chosen.cost;
    }
    carry = allowance;
  }
  const minimum = Math.min(...eligible.map(({ cost }) => cost));
  if (remaining > 0 && remaining >= minimum)
    throw new Error(
      'Budżet przekracza pojemność fal; zwiększ waveCount lub koszty wrogów.',
    );
  const pacing = threat.pacing[type] ?? threatPacingSchema.parse({});
  const waves: WavesDefinition['waves'] = groups
    .filter((group) => group.size > 0)
    .map((group) => ({
      spawnIntervalS: pacing.spawnIntervalS,
      groups: [...group].map(([enemy, count]) => ({ enemy, count })),
    }));
  if (waves.length === 0)
    throw new Error('Budżet nie pozwala utworzyć żadnej fali.');
  return wavesSchema.parse({
    id: `room:${node.id}`,
    firstBreakS: pacing.firstBreakS,
    breakS: pacing.breakS,
    maxAlive: Math.min(
      room.maxAlive ?? tuning.arena.maxEnemies,
      tuning.arena.maxEnemies,
    ),
    minSpawnDistance: room.minSpawnDistance ?? 0,
    spawnPoints: room.spawnPoints.map((point) => ({ ...point })),
    waves,
  });
};

export const roomPlanner: RoomPlanner = { planWaves };
