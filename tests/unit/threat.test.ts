import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import { Rng } from '../../src/core/rng';
import type { MapNode, RoomPlanner } from '../../src/core/runTypes';
import { tuning } from '../../src/core/tuning';
import sectorRaw from '../../src/data/sectors/kurogane.json';
import roomRaw from '../../src/data/rooms/combatYard.json';
import { enemySchema } from '../../src/enemies/enemySchema';
import { loadRoom } from '../../src/world/roomSchema';
import { loadSector, sectorThreatSchema } from '../../src/world/sectorSchema';
import { planWaves, roomPlanner } from '../../src/world/threat';
import { WaveDirector, wavesSchema } from '../../src/world/waves';
import type { WavesDefinition } from '../../src/world/waves';

const sector = loadSector(sectorRaw);
const room = loadRoom(roomRaw);
const enemies = Object.values(
  import.meta.glob<unknown>('../../src/data/enemies/*.json', {
    eager: true,
    import: 'default',
  }),
).map((raw) => enemySchema.parse(raw));
const costs = new Map(enemies.map((enemy) => [enemy.id, enemy.threatCost!]));
const node = (type: 'combat' | 'elite' = 'combat', layer = 1): MapNode => ({
  id: `node-${type}-${layer}`,
  type,
  layer,
  index: 0,
  next: [],
});
const total = (plan: WavesDefinition) =>
  plan.waves.reduce(
    (sum, wave) =>
      sum +
      wave.groups.reduce(
        (sum, group) => sum + costs.get(group.enemy)! * group.count,
        0,
      ),
    0,
  );
const budget = (n: MapNode, multiplier = 1) =>
  (sector.threat!.base[n.type]! +
    sector.threat!.perLayer[n.type]! * (n.layer - 1)) *
  multiplier;

describe('budżet zagrożenia', () => {
  it('każdy plik wroga poza bossem ma dodatni koszt; koszty startowe zgadzają się z ADR', () => {
    expect(enemies.length).toBeGreaterThanOrEqual(6);
    for (const enemy of enemies.filter((enemy) => enemy.kind !== 'boss'))
      expect(enemy.threatCost, enemy.id).toBeGreaterThan(0);
    for (const [id, cost] of Object.entries({
      assaulter: 1,
      drone: 1,
      gunner: 1.5,
      shielder: 2.5,
      sniper: 2.5,
      executor: 6,
    }))
      expect(costs.get(id)).toBe(cost);
  });

  it('200 seedów: budżet, odblokowania, gwarancja elity, schemat i limity fal', () => {
    for (let seed = 0; seed < 200; seed++)
      for (const type of ['combat', 'elite'] as const) {
        for (let layer = 1; layer <= 8; layer++) {
          const n = node(type, layer);
          const plan = planWaves(room, sector, n, new Rng(seed));
          expect(wavesSchema.safeParse(plan).success).toBe(true);
          expect(total(plan)).toBeLessThanOrEqual(budget(n));
          expect(total(plan)).toBeGreaterThan(budget(n) - 1);
          for (const wave of plan.waves) {
            expect(
              wave.groups.reduce((sum, group) => sum + group.count, 0),
            ).toBeLessThanOrEqual(tuning.arena.maxEnemies);
          }
          const groups = plan.waves.flatMap((wave) => wave.groups);
          for (const group of groups) {
            if (type === 'elite' && group.enemy === 'executor') continue;
            expect(layer).toBeGreaterThanOrEqual(
              sector.threat!.unlockLayer?.[group.enemy] ?? 1,
            );
          }
          if (type === 'elite') {
            const executors = groups.filter(
              (group) => group.enemy === 'executor',
            );
            expect(
              executors.reduce((sum, group) => sum + group.count, 0),
            ).toBeGreaterThanOrEqual(1);
            if (layer < 4)
              expect(executors).toEqual([{ enemy: 'executor', count: 1 }]);
          }
        }
      }
  });

  it('ten sam seed i węzeł dają ten sam plan niezależnie od stanu nadrzędnego RNG', () => {
    const rng = new Rng('repeat');
    const planner: RoomPlanner = roomPlanner;
    const first = planner.planWaves(room, sector, node('elite', 5), rng);
    rng.next();
    expect(planner.planWaves(room, sector, node('elite', 5), rng)).toEqual(
      first,
    );
    const alternatives = new Set(
      Array.from({ length: 20 }, (_, i) =>
        JSON.stringify(
          planWaves(
            room,
            sector,
            { ...node('elite', 5), id: `other-${i}` },
            new Rng('repeat'),
          ),
        ),
      ),
    );
    expect(alternatives.size).toBeGreaterThan(1);
  });

  it('budżet rośnie z warstwą i skaluje się mnożnikiem pokoju', () => {
    for (const type of ['combat', 'elite'] as const) {
      for (let layer = 2; layer <= 8; layer++) {
        expect(budget(node(type, layer))).toBeGreaterThan(
          budget(node(type, layer - 1)),
        );
        const n = node(type, layer);
        const plan = planWaves(
          { ...room, threatMultiplier: 1.5 },
          sector,
          n,
          new Rng('scale'),
        );
        expect(total(plan)).toBeLessThanOrEqual(budget(n, 1.5));
        expect(total(plan)).toBeGreaterThan(budget(n, 1.5) - 1);
      }
    }
  });

  it('elita z budżetem poniżej kosztu gwarancji zawiera tylko jednego Egzekutora', () => {
    const low = loadSector({
      ...sectorRaw,
      threat: { ...sectorRaw.threat, base: { elite: 2 } },
    });
    const plan = planWaves(room, low, node('elite'), new Rng('low'));
    expect(plan.waves).toEqual([
      { spawnIntervalS: 0.8, groups: [{ enemy: 'executor', count: 1 }] },
    ]);
    expect(total(plan)).toBe(6);
    expect(wavesSchema.safeParse(plan).success).toBe(true);
  });

  it('używa parametrów pokoju, pacing i rosnących wag fal', () => {
    const custom = loadSector({
      ...sectorRaw,
      threat: {
        ...sectorRaw.threat,
        base: { combat: 12 },
        perLayer: { combat: 0 },
        waveCount: { combat: { min: 2, max: 2 } },
        pools: { combat: { assaulter: 1 } },
        waveWeights: [1, 2, 3],
        pacing: { combat: { firstBreakS: 1, breakS: 3, spawnIntervalS: 0.2 } },
      },
    });
    const plan = planWaves(
      { ...room, maxAlive: 100 },
      custom,
      node(),
      new Rng('weights'),
    );
    expect(plan.waves.map((wave) => wave.groups[0]!.count)).toEqual([3, 9]);
    expect(plan.firstBreakS).toBe(1);
    expect(plan.breakS).toBe(3);
    expect(plan.waves.every((wave) => wave.spawnIntervalS === 0.2)).toBe(true);
    expect(plan.maxAlive).toBe(tuning.arena.maxEnemies);
    expect(plan.spawnPoints).toEqual(room.spawnPoints);
    expect(plan.minSpawnDistance).toBe(room.minSpawnDistance);
    expect(planWaves(room, sector, node(), new Rng('limit')).maxAlive).toBe(
      room.maxAlive,
    );
  });

  it('waliduje rozszerzenie schematu i stosuje domyślne wartości', () => {
    const legacy = {
      ...sectorRaw.threat,
      waveWeights: undefined,
      pacing: undefined,
    };
    const defaults = sectorThreatSchema.parse(legacy);
    expect(defaults.waveWeights).toEqual([1, 1.3, 1.6]);
    const plan = planWaves(
      room,
      loadSector({ ...sectorRaw, threat: legacy }),
      node(),
      new Rng('defaults'),
    );
    expect([
      plan.firstBreakS,
      plan.breakS,
      plan.waves[0]!.spawnIntervalS,
    ]).toEqual([2, 4, 0.8]);
    for (const waveWeights of [[], [1, 0], [2, 1]])
      expect(
        sectorThreatSchema.safeParse({ ...legacy, waveWeights }).success,
      ).toBe(false);
    expect(
      sectorThreatSchema.safeParse({
        ...legacy,
        pacing: { combat: { spawnIntervalS: 0 } },
      }).success,
    ).toBe(false);
  });

  it('odrzuca brak konfiguracji, nieznanych wrogów, puste plany i nadmierny budżet', () => {
    expect(() =>
      planWaves(room, { ...sector, threat: undefined }, node(), new Rng(0)),
    ).toThrow();
    expect(() =>
      planWaves(room, sector, { ...node(), type: 'boss' }, new Rng(0)),
    ).toThrow(/combat/);
    for (const threat of [
      { ...sectorRaw.threat, pools: { combat: { unknown: 1 } } },
      { ...sectorRaw.threat, base: { combat: 0 } },
      { ...sectorRaw.threat, base: { combat: 10000 } },
    ])
      expect(() =>
        planWaves(
          room,
          loadSector({ ...sectorRaw, threat }),
          node(),
          new Rng(0),
        ),
      ).toThrow();
  });

  it('WaveDirector kończy wygenerowany plan w fazie done', () => {
    const plan = planWaves(room, sector, node('elite', 5), new Rng('director'));
    const bus = new EventBus();
    const alive = new Set<number>();
    let id = 0;
    const director = new WaveDirector(
      plan,
      {
        spawn: () => {
          alive.add(++id);
          return id;
        },
        playerPosition: () => room.playerSpawn,
      },
      bus,
      new Rng('director'),
    );
    director.start();
    for (let i = 0; i < 10000 && director.currentPhase !== 'done'; i++) {
      director.step(1 / 60);
      for (const id of alive)
        bus.emit('enemy_killed', { id, killer: null, tags: [] });
      alive.clear();
    }
    expect(director.currentPhase).toBe('done');
    expect(director.spawnLog.length).toBe(
      plan.waves.reduce(
        (sum, wave) =>
          sum + wave.groups.reduce((sum, group) => sum + group.count, 0),
        0,
      ),
    );
    director.dispose();
  });
});
