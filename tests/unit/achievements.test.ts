// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import achievementsData from '../../src/data/meta/achievements.json';
import unlocksData from '../../src/data/meta/unlocks.json';
import progressionData from '../../src/data/meta/progression.json';
import type { RunSummary } from '../../src/core/runTypes';
import {
  ACHIEVEMENT_RULES,
  achievementProgress,
  dominantPath,
  mergeProgress,
  summaryProgress,
} from '../../src/progression/achievements';
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_COUNTERS,
  ACHIEVEMENT_ICONS,
  achievementDefinitions,
  achievementsSchema,
  loadAchievements,
} from '../../src/progression/achievementsSchema';
import { loadUnlocks } from '../../src/progression/unlocksSchema';
import { achievementIconKeys } from '../../src/ui/achievementIcons';
import { missionDefinitions } from '../../src/world/missions';

const valid = achievementsData[0]!;

const summary = (over: Partial<RunSummary> = {}): RunSummary => ({
  outcome: 'victory',
  seed: 's',
  loadoutId: 'custom',
  elapsedS: 100,
  kills: 10,
  roomsCleared: 8,
  elitesCleared: 2,
  threatLevel: 0,
  layerReached: 8,
  implants: [],
  damage: { melee: 10, power: 10, gun: 10, other: 10 },
  ...over,
});

describe('dane osiągnięć (S4b-01)', () => {
  it('ma 36 osiągnięć w czterech kategoriach z unikalnymi id', () => {
    const list = loadAchievements(achievementsData);
    expect(list).toHaveLength(36);
    expect(new Set(list.map((def) => def.id)).size).toBe(36);
    for (const category of ACHIEVEMENT_CATEGORIES)
      expect(list.some((def) => def.category === category)).toBe(true);
  });

  it('każde osiągnięcie ma niepustą nagrodę, znany licznik i ikonę z zestawu UI', () => {
    const icons = new Set(achievementIconKeys());
    expect([...icons].sort()).toEqual([...ACHIEVEMENT_ICONS].sort());
    for (const def of achievementDefinitions.values()) {
      expect(def.reward.data ?? 0).toBeGreaterThanOrEqual(0);
      expect(def.reward.cores ?? 0).toBeGreaterThanOrEqual(0);
      expect(icons.has(def.icon)).toBe(true);
      if (def.kind === 'counter')
        expect(ACHIEVEMENT_COUNTERS).toContain(def.counter);
    }
  });

  it('schemat odrzuca błędne definicje', () => {
    expect(() => loadAchievements([valid, valid])).toThrow('Powtórzone');
    expect(() => loadAchievements([{ ...valid, kind: 'counter' }])).toThrow(
      'counter i target',
    );
    expect(() =>
      loadAchievements([{ ...valid, counter: 'dash_used', target: 3 }]),
    ).toThrow('nie ma pól');
    expect(() =>
      loadAchievements([{ ...valid, reward: { data: -1 } }]),
    ).toThrow();
    expect(() => loadAchievements([{ ...valid, icon: 'nie-ma' }])).toThrow();
    expect(() => loadAchievements([{ ...valid, category: 'inne' }])).toThrow();
    expect(() => loadAchievements([{ ...valid, extra: 1 }])).toThrow();
    expect(achievementsSchema.safeParse([valid]).success).toBe(true);
  });

  it('requiresAchievement wskazuje istniejące osiągnięcie dla pięciu odblokowań', () => {
    const gates = loadUnlocks(unlocksData)
      .filter((unlock) => unlock.requiresAchievement !== undefined)
      .map((unlock) => [unlock.id, unlock.requiresAchievement]);
    for (const [, required] of gates)
      expect(achievementDefinitions.has(required!)).toBe(true);
    expect(Object.fromEntries(gates)).toEqual({
      'blade:staffBlade': 'taniec-ostrza',
      'weapon:crossbow': 'droga-strzelca',
      'power:focus': 'glos-rezonansu',
      'module:superconductor': 'reka-strzelca',
      'slot:weapon3': 'weteran-hut',
    });
  });

  it('osiągnięcie bramkujące da się zdobyć bez przedmiotu, który odblokowuje', () => {
    const starter = new Set(progressionData.starter.unlocks);
    // Co musi mieć gracz, żeby zdobyć osiągnięcie z danego licznika.
    const needs: Record<string, readonly string[]> = {
      kills_melee: ['blade:'],
      kills_power: ['power:'],
      kills_gun: ['weapon:'],
      victories: [],
    };
    for (const unlock of loadUnlocks(unlocksData)) {
      if (!unlock.requiresAchievement) continue;
      const def = achievementDefinitions.get(unlock.requiresAchievement)!;
      if (def.kind === 'flag') {
        const victory = summary({
          damage: { melee: 0, power: 0, gun: 100, other: 0 },
        });
        expect(summaryProgress(victory).flags).toContain(def.id);
      }
      const prefixes = def.kind === 'flag' ? ['weapon:'] : needs[def.counter!];
      expect(prefixes).toBeDefined();
      for (const prefix of prefixes!) {
        const owned = [...starter].filter((id) => id.startsWith(prefix));
        expect(owned.length).toBeGreaterThan(0);
        // Startowa pozycja tego rodzaju nie jest samym bramkowanym przedmiotem.
        expect(owned).not.toContain(unlock.id);
      }
      expect(starter.has(unlock.id)).toBe(false);
    }
  });

  it('osiągnięcia misyjne wskazują misje z danych albo przewidzianą jeszcze misję 06', () => {
    for (const mission of Object.keys(ACHIEVEMENT_RULES.missions)) {
      const id = ACHIEVEMENT_RULES.missions[mission]!;
      expect(achievementDefinitions.get(id)?.category).toBe('misje');
    }
    expect(missionDefinitions.has('m01-maszty')).toBe(true);
    expect(missionDefinitions.has('m03-list-przewozowy')).toBe(true);
  });
});

describe('postęp z podsumowania runu', () => {
  it('porażka liczy tylko ukończony run', () => {
    expect(summaryProgress(summary({ outcome: 'death' }))).toEqual({
      counters: { runs_ended: 1 },
      flags: [],
    });
  });

  it('zwycięstwo: licznik zwycięstw i pierwsze zwycięstwo', () => {
    expect(
      summaryProgress(
        summary({ damage: { melee: 1, power: 1, gun: 1, other: 1 } }),
      ),
    ).toEqual({
      counters: { runs_ended: 1, victories: 1 },
      flags: ['pierwsze-zwyciestwo'],
    });
  });

  it('Poziom zagrożenia 3 i tryb Podbój', () => {
    expect(summaryProgress(summary({ threatLevel: 2 })).flags).not.toContain(
      'zagrozenie-3',
    );
    expect(summaryProgress(summary({ threatLevel: 3 })).flags).toContain(
      'zagrozenie-3',
    );
    expect(summaryProgress(summary({ modeId: 'conquest' })).flags).toContain(
      'pelna-kontrola',
    );
    expect(
      summaryProgress(summary({ outcome: 'death', modeId: 'conquest' })).flags,
    ).toEqual([]);
  });

  it.each([
    ['m01-maszty', 'cisza-w-niecce'],
    ['m03-list-przewozowy', 'list-w-reku'],
    ['m06-odlewnia', 'ja-tylko-dowoze'],
  ])(
    'ukończona misja %s daje %s (także na sztucznym podsumowaniu)',
    (id, flag) => {
      expect(
        summaryProgress(summary({ missionId: id, missionCompleted: true }))
          .flags,
      ).toContain(flag);
      expect(
        summaryProgress(summary({ missionId: id, missionCompleted: false }))
          .flags,
      ).not.toContain(flag);
    },
  );

  it('czysta ścieżka: co najmniej 80% obrażeń jednej kategorii', () => {
    const flagsFor = (damage: RunSummary['damage']) =>
      summaryProgress(summary({ damage })).flags;
    expect(flagsFor({ melee: 80, power: 10, gun: 5, other: 5 })).toContain(
      'droga-ostrza',
    );
    expect(flagsFor({ melee: 79, power: 10, gun: 6, other: 5 })).not.toContain(
      'droga-ostrza',
    );
    expect(flagsFor({ melee: 0, power: 90, gun: 5, other: 5 })).toContain(
      'droga-rezonansu',
    );
    expect(flagsFor({ melee: 0, power: 0, gun: 100, other: 0 })).toContain(
      'droga-strzelca',
    );
    expect(dominantPath({ melee: 0, power: 0, gun: 0, other: 0 })).toBeNull();
    expect(
      summaryProgress(
        summary({
          outcome: 'death',
          damage: { melee: 100, power: 0, gun: 0, other: 0 },
        }),
      ).flags,
    ).toEqual([]);
  });

  it('mergeProgress sumuje liczniki i łączy flagi bez powtórzeń', () => {
    expect(
      mergeProgress(
        { counters: { dash_used: 2 }, flags: ['seria'] },
        undefined,
        { counters: { dash_used: 3, parry_success: 1 }, flags: ['seria', 'x'] },
      ),
    ).toEqual({
      counters: { dash_used: 5, parry_success: 1 },
      flags: ['seria', 'x'],
    });
  });

  it('achievementProgress: licznik obcięty do celu, flaga 0 lub 1', () => {
    const parry = achievementDefinitions.get('zwierciadlo')!;
    expect(
      achievementProgress(parry, {
        unlocked: [],
        counters: { parry_success: 40 },
      }),
    ).toEqual({ current: 25, target: 25 });
    expect(
      achievementProgress(parry, {
        unlocked: [],
        counters: { parry_success: 7 },
      }),
    ).toEqual({ current: 7, target: 25 });
    const flag = achievementDefinitions.get('seria')!;
    expect(
      achievementProgress(flag, { unlocked: ['seria'], counters: {} }),
    ).toEqual({ current: 1, target: 1 });
  });
});
