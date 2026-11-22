import { describe, expect, it } from 'vitest';
import { allyDefinitions } from '../../src/allies/allySchema';
import {
  healSquad,
  isAllyUnlocked,
  parseSquadParam,
  sanitizeSquad,
  scaleWavesForSquad,
  squadOf,
  squadCountScale,
  squadHealthModifiers,
  unlockedAllyIds,
} from '../../src/allies/roster';
import { EventBus } from '../../src/core/events';
import type { SectorMap } from '../../src/core/runTypes';
import { tuning } from '../../src/core/tuning';
import { RunManager, runStateSchema } from '../../src/world/run';
import type { WavesDefinition } from '../../src/world/waves';

const NADIA_MISSION = 'm02-punkt-kontrolny';

const map = (seed: string): SectorMap => ({
  sectorId: `test-${seed}`,
  layers: [
    [{ id: 'L1N0', layer: 1, index: 0, type: 'combat', next: ['L2N0'] }],
    [{ id: 'L2N0', layer: 2, index: 0, type: 'rest', next: [] }],
  ],
});

const waves: WavesDefinition = {
  id: 'test',
  firstBreakS: 0,
  breakS: 0,
  maxAlive: 4,
  minSpawnDistance: 0,
  spawnPoints: [{ x: 0, z: 0 }],
  waves: [
    {
      spawnIntervalS: 1,
      groups: [
        { enemy: 'trooper', count: 4 },
        { enemy: 'gunner', count: 1 },
      ],
    },
  ],
};

describe('odblokowanie towarzyszy', () => {
  it('Szron jest od początku, Nadia po misji m02-punkt-kontrolny', () => {
    expect(isAllyUnlocked(allyDefinitions.get('szron')!, [])).toBe(true);
    expect(isAllyUnlocked(allyDefinitions.get('nadia')!, [])).toBe(false);
    expect(isAllyUnlocked(allyDefinitions.get('nadia')!, [NADIA_MISSION])).toBe(
      true,
    );
    expect(unlockedAllyIds([])).toEqual(['szron']);
    expect(unlockedAllyIds([NADIA_MISSION]).sort()).toEqual(['nadia', 'szron']);
  });

  it('sanitizeSquad odrzuca zablokowanych, nieznanych i powtórzenia oraz tnie do limitu', () => {
    const max = tuning.allies.maxPicked;
    expect(max).toBe(2);
    expect(sanitizeSquad(['nadia', 'szron'], [], max)).toEqual(['szron']);
    expect(sanitizeSquad(['nadia', 'szron'], [NADIA_MISSION], max)).toEqual([
      'nadia',
      'szron',
    ]);
    expect(sanitizeSquad(['szron', 'szron', 'ktos'], [], max)).toEqual([
      'szron',
    ]);
    expect(sanitizeSquad(['nadia', 'szron'], [], 1, true)).toEqual(['nadia']);
  });

  it('parseSquadParam rozdziela po przecinku i ignoruje puste', () => {
    expect(parseSquadParam(null)).toEqual([]);
    expect(parseSquadParam('nadia, szron,')).toEqual(['nadia', 'szron']);
  });
});

describe('balans drużyny', () => {
  it('mnożnik liczby wrogów rośnie o enemyCountPerAlly na sojusznika', () => {
    const per = tuning.allies.enemyCountPerAlly;
    expect(squadCountScale(0, per)).toBe(1);
    expect(squadCountScale(2, per)).toBeCloseTo(1.5);
  });

  it('scaleWavesForSquad powiela grupy wg mnożnika, a bez drużyny zwraca ten sam plan', () => {
    expect(scaleWavesForSquad(waves, 1)).toBe(waves);
    const scaled = scaleWavesForSquad(waves, 1.5);
    expect(scaled.waves[0]!.groups.map((g) => g.count)).toEqual([6, 2]);
    expect(waves.waves[0]!.groups.map((g) => g.count)).toEqual([4, 1]);
  });

  it('tryby bez fal: zdrowie wrogów rośnie procentowo za każdego sojusznika', () => {
    expect(squadHealthModifiers(0, 0.15)).toEqual([]);
    expect(squadHealthModifiers(2, 0.15)).toEqual([
      { stat: 'maxHealth', type: 'percent', value: 0.3, source: 'squad' },
    ]);
  });
});

describe('drużyna w stanie runu', () => {
  const run = () =>
    new RunManager(new EventBus(), map, { initialHp: 100, initialEnergy: 100 });

  it('newRun zapisuje drużynę z pełnym zdrowiem i pomija nieznane id', () => {
    const manager = run();
    try {
      const state = manager.newRun('squad', 'classic', {
        squad: ['szron', 'nadia', 'ktos', 'szron'],
      });
      expect(squadOf(state)).toEqual([
        { id: 'szron', hp: allyDefinitions.get('szron')!.hp },
        { id: 'nadia', hp: allyDefinitions.get('nadia')!.hp },
      ]);
      expect(squadOf(manager.newRun('empty', 'classic', {}))).toEqual([]);
    } finally {
      manager.dispose();
    }
  });

  it('zapis i odczyt (JSON) zachowują drużynę; schemat przyjmuje stary zapis bez pola', () => {
    const manager = run();
    try {
      const state = manager.newRun('squad', 'classic', { squad: ['szron'] });
      const roundTrip = JSON.parse(JSON.stringify(manager.serialize()));
      const restored = run();
      try {
        expect(squadOf(restored.restore(roundTrip))).toEqual(squadOf(state));
      } finally {
        restored.dispose();
      }
      const legacy = JSON.parse(JSON.stringify(manager.serialize()));
      delete legacy.squad;
      expect(runStateSchema.parse(legacy).squad).toBeUndefined();
      expect(
        runStateSchema.safeParse({ ...legacy, squad: [{ id: 'x', hp: -1 }] })
          .success,
      ).toBe(false);
    } finally {
      manager.dispose();
    }
  });

  it('completeRoom przenosi zdrowie i powalenie drużyny, a leczenie leczy ją jak gracza', () => {
    const manager = run();
    try {
      manager.newRun('squad', 'classic', { squad: ['szron'] });
      manager.selectNode('L1N0');
      const max = allyDefinitions.get('szron')!.hp;
      expect(
        manager.completeRoom({ hp: 50, squad: [{ id: 'szron', hp: 0 }] }),
      ).toBe(true);
      expect(squadOf(manager.state)).toEqual([{ id: 'szron', hp: 0 }]);
      // Połowa maksymalnego zdrowia gracza = połowa zdrowia towarzysza (powalony wstaje).
      manager.heal(70, 140);
      expect(squadOf(manager.state)[0]!.hp).toBeCloseTo(max / 2);
      manager.heal(1000, 140);
      expect(squadOf(manager.state)[0]!.hp).toBe(max);
    } finally {
      manager.dispose();
    }
  });

  it('healSquad nie przekracza maksimum i zachowuje nieznane id', () => {
    expect(
      healSquad(
        [
          { id: 'szron', hp: 1 },
          { id: 'ktos', hp: 3 },
        ],
        10,
      ),
    ).toEqual([
      { id: 'szron', hp: allyDefinitions.get('szron')!.hp },
      { id: 'ktos', hp: 3 },
    ]);
  });
});
