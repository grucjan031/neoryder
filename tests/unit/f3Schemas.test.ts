import { describe, expect, it } from 'vitest';
import { tuning } from '../../src/core/tuning';
import assaulterRaw from '../../src/data/enemies/assaulter.json';
import bladeDancerRaw from '../../src/data/synergies/bladeDancer.json';
import { enemySchema } from '../../src/enemies/enemySchema';
import { loadImplant } from '../../src/progression/implantSchema';
import {
  loadSynergyDefinitions,
  synergyDefinitions,
  synergySchema,
} from '../../src/progression/synergies';
import { loadRoom } from '../../src/world/roomSchema';
import { loadSector } from '../../src/world/sectorSchema';

const baseSector = {
  id: 'kurogane',
  name: 'Kurogane Arms',
  layers: 8,
  nodesPerLayer: { min: 2, max: 4 },
  extraEdgeChance: 0.35,
  typeWeights: [
    {
      fromLayer: 2,
      toLayer: 6,
      weights: { combat: 50, elite: 20, shop: 15, rest: 15, puzzle: 0 },
    },
  ],
  guarantees: [
    { type: 'shop' as const, min: 1, fromLayer: 3, toLayer: 6 },
    { type: 'elite' as const, min: 2, fromLayer: 3, toLayer: 6 },
  ],
  limits: {
    maxPerLayer: { elite: 1, puzzle: 1 },
    maxElitesPerPath: 3,
  },
  expectedDurationS: {
    combat: 150,
    elite: 210,
    shop: 60,
    rest: 45,
    puzzle: 90,
    boss: 300,
  },
};

const baseRoom = {
  id: 'combatYard',
  name: 'Dziedziniec',
  type: 'combat' as const,
  playerSpawn: { x: 0, y: 0, z: 8 },
  blocks: [
    {
      size: { x: 30, y: 1, z: 30 },
      position: { x: 0, y: -0.5, z: 0 },
    },
    {
      size: { x: 1, y: 4, z: 1 },
      position: { x: -4, y: 2, z: -4 },
      model: 'pillar',
    },
  ],
  spawnPoints: [
    { x: -8, z: -8 },
    { x: 8, z: -8 },
    { x: -8, z: 4 },
    { x: 8, z: 4 },
  ],
  doors: [
    {
      id: 'door_in',
      role: 'entry' as const,
      position: { x: 0, y: 1.5, z: 14.5 },
      size: { x: 3, y: 3, z: 0.5 },
    },
    {
      id: 'door_out',
      role: 'exit' as const,
      position: { x: 0, y: 1.5, z: -14.5 },
      size: { x: 3, y: 3, z: 0.5 },
    },
  ],
};

const baseImplant = {
  id: 'overclock',
  name: 'Przetaktowanie rdzenia',
  rarity: 'rare' as const,
  tags: ['#melee', '#power'],
  modifiers: [
    { stat: 'damage' as const, type: 'percent' as const, value: 0.15 },
    { stat: 'maxHealth' as const, type: 'flat' as const, value: 20 },
  ],
  triggers: [
    {
      when: { event: 'parry_success' as const },
      effects: [{ kind: 'add_energy' as const, amount: 8 }],
      cooldownS: 1.5,
    },
  ],
  upgradesTo: 'overclockPlus',
};

describe('SectorDefinition (sectorSchema)', () => {
  it('przyjmuje poprawny sektor podstawowy oraz z sekcjami opcjonalnymi', () => {
    expect(loadSector(baseSector).id).toBe('kurogane');
    const full = loadSector({
      ...baseSector,
      threat: {
        base: { combat: 4, elite: 8 },
        perLayer: { combat: 1.5, elite: 2 },
        waveCount: {
          combat: { min: 2, max: 3 },
          elite: { min: 2, max: 3 },
        },
        pools: {
          combat: { assaulter: 4, gunner: 3, drone: 2 },
          elite: { shielder: 3, sniper: 2, executor: 1 },
        },
        unlockLayer: { sniper: 3, executor: 4 },
      },
      rewardWeights: {
        combat: { common: 65, rare: 25, epic: 8, legendary: 2 },
        elite: { common: 30, rare: 45, epic: 20, legendary: 5 },
      },
      economy: {
        creditsPerThreat: 5,
        eliteBonusCredits: 25,
        shopPrices: { common: 50, rare: 90, epic: 140, legendary: 220 },
        shopHealPrice: 40,
        shopHealFraction: 0.35,
        puzzleCredits: 60,
        restHealFraction: 0.4,
      },
      roomPools: {
        combat: ['combatYard', 'combatPillars'],
        elite: ['eliteHall'],
        shop: ['shopRoom'],
        rest: ['restRoom'],
        boss: ['bossRoom'],
      },
    });
    expect(full.economy?.creditsPerThreat).toBe(5);
    expect(full.roomPools?.combat).toHaveLength(2);
  });

  it('odrzuca layers < 2, błędne nodesPerLayer i nieznany NodeType w kluczach', () => {
    expect(() => loadSector({ ...baseSector, layers: 1 })).toThrow();
    expect(() =>
      loadSector({ ...baseSector, nodesPerLayer: { min: 0, max: 3 } }),
    ).toThrow();
    expect(() =>
      loadSector({ ...baseSector, nodesPerLayer: { min: 4, max: 2 } }),
    ).toThrow();
    expect(() =>
      loadSector({
        ...baseSector,
        expectedDurationS: {
          ...baseSector.expectedDurationS,
          treasure: 60,
        },
      }),
    ).toThrow();
    expect(() =>
      loadSector({
        ...baseSector,
        typeWeights: [
          { fromLayer: 2, toLayer: 6, weights: { combat: 10, unknown: 5 } },
        ],
      }),
    ).toThrow();
  });
});

describe('RoomDefinition (roomSchema)', () => {
  it('przyjmuje poprawny pokój walki z props/puzzle oraz pokój bossa tylko z entry', () => {
    const parsed = loadRoom({
      ...baseRoom,
      maxAlive: 8,
      minSpawnDistance: 6,
      props: [{ kind: 'crate', position: { x: 2, y: 0.5, z: 0 } }],
      puzzle: { reachZone: { x: 0, y: 3, z: -6, radiusM: 1.5 } },
    });
    expect(parsed.id).toBe('combatYard');

    const bossRoom = loadRoom({
      ...baseRoom,
      id: 'bossRoom',
      type: 'boss',
      doors: [baseRoom.doors[0]!],
    });
    expect(bossRoom.type).toBe('boss');
    expect(bossRoom.doors).toHaveLength(1);
  });

  it('odrzuca pokój bez drzwi entry oraz pokój niebędący bossem bez drzwi exit', () => {
    expect(() =>
      loadRoom({
        ...baseRoom,
        doors: [baseRoom.doors[1]!],
      }),
    ).toThrow(/entry/);

    expect(() =>
      loadRoom({
        ...baseRoom,
        type: 'combat',
        doors: [baseRoom.doors[0]!],
      }),
    ).toThrow(/exit/);

    expect(() =>
      loadRoom({
        ...baseRoom,
        type: 'boss',
        doors: [],
      }),
    ).toThrow(/entry/);
  });
});

describe('ImplantDefinition (implantSchema)', () => {
  it('przyjmuje poprawny implant z modyfikatorami i wyzwalaczami synergii', () => {
    const implant = loadImplant(baseImplant);
    expect(implant.id).toBe('overclock');
    expect(implant.rarity).toBe('rare');
    expect(implant.modifiers).toHaveLength(2);
    expect(implant.triggers).toHaveLength(1);
  });

  it('odrzuca nieznaną rzadkość i nieznany stat', () => {
    expect(() => loadImplant({ ...baseImplant, rarity: 'mythic' })).toThrow();
    expect(() =>
      loadImplant({
        ...baseImplant,
        modifiers: [{ stat: 'mana', type: 'flat', value: 10 }],
      }),
    ).toThrow();
  });
});

describe('enemySchema.threatCost i synergySchema.requiresCount', () => {
  it('enemySchema przyjmuje dodatnie threatCost i odrzuca <= 0', () => {
    expect(enemySchema.parse(assaulterRaw).threatCost).toBeUndefined();
    expect(
      enemySchema.parse({ ...assaulterRaw, threatCost: 1.5 }).threatCost,
    ).toBe(1.5);
    expect(() =>
      enemySchema.parse({ ...assaulterRaw, threatCost: 0 }),
    ).toThrow();
    expect(() =>
      enemySchema.parse({ ...assaulterRaw, threatCost: -2 }),
    ).toThrow();
  });

  it('synergySchema przyjmuje requiresCount >= 1 i ładuje istniejące synergie', () => {
    expect(synergyDefinitions.length).toBeGreaterThanOrEqual(3);
    const withCount = synergySchema.parse({
      ...bladeDancerRaw,
      id: 'bladeMaster',
      requiresCount: { '#melee': 2, '#power': 1 },
    });
    expect(withCount.requiresCount).toEqual({ '#melee': 2, '#power': 1 });
    expect(loadSynergyDefinitions([withCount])).toHaveLength(1);

    expect(() =>
      synergySchema.parse({
        ...bladeDancerRaw,
        requiresCount: { '#melee': 0 },
      }),
    ).toThrow();
    expect(() =>
      synergySchema.parse({
        ...bladeDancerRaw,
        requiresCount: { '#melee': 1.5 },
      }),
    ).toThrow();
  });

  it('tuning.run udostępnia czasy przejść runu', () => {
    expect(tuning.run.transitionS).toBeGreaterThan(0);
    expect(tuning.run.fadeS).toBeGreaterThan(0);
  });
});
