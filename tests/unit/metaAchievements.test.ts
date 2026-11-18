import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import { createMemorySaveStore } from '../../src/core/save';
import type { RunSummary } from '../../src/core/runTypes';
import { MetaManager } from '../../src/progression/meta';
import { runAchievementProgressSchema } from '../../src/progression/achievementsSchema';
import { metaStateSchema } from '../../src/progression/metaStateSchema';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import { CommandRegistry } from '../../src/ui/debugCommands';
import { registerMetaCommands } from '../../src/ui/metaCommands';

const make = (bus?: EventBus) => new MetaManager(createStarterMetaState(), bus);

const summary = (over: Partial<RunSummary> = {}): RunSummary => ({
  outcome: 'death',
  seed: 's',
  loadoutId: 'custom',
  elapsedS: 100,
  kills: 10,
  roomsCleared: 3,
  elitesCleared: 0,
  threatLevel: 0,
  layerReached: 3,
  implants: [],
  damage: { melee: 1, power: 0, gun: 0, other: 0 },
  ...over,
});

const withProgress = (
  counters: Record<string, number>,
  flags: string[] = [],
  over: Partial<RunSummary> = {},
): RunSummary => summary({ ...over, achievements: { counters, flags } });

describe('MetaManager: naszywki Iskry', () => {
  it('nowy stan meta ma puste osiągnięcia, a schemat je waliduje', () => {
    const state = createStarterMetaState();
    expect(state.achievements).toEqual({ unlocked: [], counters: {} });
    expect(metaStateSchema.safeParse(state).success).toBe(true);
    expect(
      metaStateSchema.parse({ ...state, achievements: undefined }).achievements,
    ).toEqual({ unlocked: [], counters: {} });
    // Uszkodzone osiągnięcia nie unieważniają reszty meta (wracają puste).
    const broken = metaStateSchema.parse({
      ...state,
      data: 77,
      xp: 12,
      achievements: { unlocked: [], counters: { x: -1 } },
    });
    expect(broken.achievements).toEqual({ unlocked: [], counters: {} });
    expect(broken).toMatchObject({ data: 77, xp: 12, unlocks: state.unlocks });
  });

  it('applyRun dolicza liczniki także przy porażce i nie odblokowuje poniżej progu', () => {
    const meta = make();
    const result = meta.applyRun(withProgress({ dash_used: 40 }), 'r1');
    expect(result.applied).toBe(true);
    expect(result.achievements).toEqual([]);
    expect(meta.state.achievements).toEqual({
      unlocked: [],
      counters: { dash_used: 40, runs_ended: 1 },
    });
  });

  it('próg przekroczony w kolejnych runach: nagroda raz, później bez powtórzeń', () => {
    const bus = new EventBus();
    const unlocked: string[] = [];
    bus.on('achievement_unlocked', ({ id }) => unlocked.push(id));
    const meta = make(bus);
    meta.applyRun(withProgress({ dash_used: 150 }), 'r1');
    const before = meta.state;
    const second = meta.applyRun(withProgress({ dash_used: 100 }), 'r2');
    expect(second.achievements).toEqual([
      { id: 'akrobata', reward: { data: 15, cores: 0 } },
    ]);
    expect(meta.state.data).toBe(before.data + 15 + second.rewards.data);
    expect(meta.state.achievements.unlocked).toEqual(['akrobata']);
    expect(meta.state.achievements.counters.dash_used).toBe(250);
    const third = meta.applyRun(withProgress({ dash_used: 100 }), 'r3');
    expect(third.achievements).toEqual([]);
    expect(unlocked).toEqual(['akrobata']);
  });

  it('flagi odblokowują i dodają Rdzenie; nieznane flagi i liczniki są ignorowane', () => {
    const meta = make();
    const counters = JSON.parse(
      '{"__proto__": 5, "nie_ma_takiego": 3, "parry_success": 3}',
    ) as Record<string, number>;
    const result = meta.applyRun(
      withProgress(counters, ['bez-zadrasniecia', 'nie-ma-takiej']),
      'r1',
    );
    expect(result.achievements).toEqual([
      { id: 'bez-zadrasniecia', reward: { data: 0, cores: 2 } },
    ]);
    expect(meta.state.achievements.counters).toEqual({
      parry_success: 3,
      runs_ended: 1,
    });
    expect(meta.state.cores).toBe(result.rewards.cores + 2);
  });

  it('ponowienie zapisu tego samego runu nie dubluje liczników ani nagród (także po odświeżeniu)', () => {
    const run = withProgress({ kills_melee: 150 }, ['pierwsza-krew']);
    const meta = make();
    const first = meta.applyRun(run, 'r1');
    expect(first.achievements.map((unlock) => unlock.id).sort()).toEqual([
      'pierwsza-krew',
      'taniec-ostrza',
    ]);
    const saved = meta.serialize();
    const again = meta.applyRun(run, 'r1');
    expect(again.applied).toBe(false);
    expect(again.achievements).toEqual([]);
    expect(meta.state).toEqual(saved);
    // Odświeżenie: stan z dysku i to samo rozliczenie.
    const reloaded = MetaManager.restore(JSON.parse(JSON.stringify(saved)));
    expect(reloaded.applyRun(run, 'r1').applied).toBe(false);
    expect(reloaded.state).toEqual(saved);
  });

  it('podsumowanie bez pola achievements (stare zapisy) nic nie dolicza', () => {
    const meta = make();
    const result = meta.applyRun(summary(), 'r1');
    expect(result.achievements).toEqual([]);
    // Postęp z podsumowania liczy sam MetaManager.
    expect(meta.state.achievements).toEqual({
      unlocked: [],
      counters: { runs_ended: 1 },
    });
  });

  it('poziom 10 odblokowuje się po rozliczeniu runu i po dodaniu XP (debug)', () => {
    const state = createStarterMetaState();
    state.xp = 3000;
    const loaded = new MetaManager(state);
    expect(loaded.level).toBeGreaterThanOrEqual(10);
    const result = loaded.applyRun(summary(), 'r1');
    expect(result.achievements.map((unlock) => unlock.id)).toContain(
      'poziom-10',
    );
    const viaXp = make();
    viaXp.debugAddXp(3000);
    expect(viaXp.hasAchievement('poziom-10')).toBe(true);
    expect(viaXp.state.cores).toBe(2);
  });

  it('pierwszy zakup w warsztacie daje nagrodę jednorazowo', () => {
    const meta = make();
    meta.debugAddData(500);
    meta.buyUnlock('weapon:rifle');
    expect(meta.hasAchievement('pierwszy-zakup')).toBe(true);
    expect(meta.state.data).toBe(500 - 80);
    meta.buyUnlock('power:grab');
    expect(meta.state.data).toBe(500 - 80 - 80);
  });

  it('bramka: odblokowanie wymagające naszywki nie kupi się bez niej', () => {
    const meta = make();
    meta.debugAddCores(100);
    meta.debugAddXp(5000);
    expect(() => meta.buyUnlock('blade:staffBlade')).toThrow(
      'Wymagana naszywka: Taniec ostrza.',
    );
    expect(meta.state.cores).toBe(102);
    meta.debugGrantAchievement('taniec-ostrza');
    meta.buyUnlock('blade:staffBlade');
    expect(meta.isUnlocked('blade:staffBlade')).toBe(true);
    for (const [item, achievement] of [
      ['power:focus', 'glos-rezonansu'],
      ['module:superconductor', 'reka-strzelca'],
      ['slot:weapon3', 'weteran-hut'],
    ] as const) {
      expect(() => meta.buyUnlock(item)).toThrow('Wymagana naszywka');
      meta.debugGrantAchievement(achievement);
    }
  });

  it('naszywka nie daje przedmiotu za darmo: zdobycie nie zmienia odblokowań', () => {
    const meta = make();
    const before = meta.state.unlocks;
    meta.applyRun(withProgress({ kills_melee: 150 }), 'r1');
    expect(meta.hasAchievement('taniec-ostrza')).toBe(true);
    expect(meta.state.unlocks).toEqual(before);
    expect(meta.isUnlocked('blade:staffBlade')).toBe(false);
  });

  it('debugGrantAchievement odrzuca nieznane id i nie dubluje', () => {
    const meta = make();
    expect(() => meta.debugGrantAchievement('nie-ma')).toThrow('Nieznane');
    meta.debugGrantAchievement('seria');
    meta.debugGrantAchievement('seria');
    expect(meta.state.achievements.unlocked).toEqual(['seria']);
    expect(meta.state.data).toBe(0);
  });

  it('zwycięski run bez zdarzeń: naszywka z samego podsumowania, bez nagrody walutowej', () => {
    const meta = make();
    const result = meta.applyRun(
      summary({
        outcome: 'victory',
        damage: { melee: 1, power: 1, gun: 1, other: 1 },
      }),
      'r1',
    );
    expect(result.achievements).toEqual([
      { id: 'pierwsze-zwyciestwo', reward: { data: 0, cores: 0 } },
    ]);
    expect(meta.state.achievements.counters).toEqual({
      runs_ended: 1,
      victories: 1,
    });
    expect(meta.state.lastRuns[0]!.achievements).toEqual([
      'pierwsze-zwyciestwo',
    ]);
  });

  it('tracker nie ma wpływu na postęp z podsumowania: podwójnie podane liczniki zwycięstw nie dublują się z derywacją', () => {
    const meta = make();
    meta.applyRun(
      withProgress({}, ['pierwsze-zwyciestwo', 'poziom-10'], {
        outcome: 'victory',
        damage: { melee: 1, power: 1, gun: 1, other: 1 },
      }),
      'r1',
    );
    // Flagi spoza listy zdarzeniowych z zapisu są odrzucane (poziom-10 bez poziomu).
    expect(meta.hasAchievement('poziom-10')).toBe(false);
    expect(meta.state.achievements.counters.victories).toBe(1);
  });

  it('licznik 1e308 z uszkodzonego zapisu jest obcięty do limitu runu', () => {
    const meta = make();
    meta.applyRun(withProgress({ dash_used: 1e308 }), 'r1');
    expect(meta.state.achievements.counters.dash_used).toBe(10_000);
    expect(metaStateSchema.safeParse(meta.state).success).toBe(true);
  });

  it('zapis podsumowania odrzuca liczniki ponad limit, nieznane klucze i flagi spoza listy', () => {
    const ok = runAchievementProgressSchema.safeParse({
      counters: { dash_used: 5 },
      flags: ['seria'],
    });
    expect(ok.success).toBe(true);
    for (const bad of [
      { counters: { dash_used: 1e308 }, flags: [] },
      { counters: { dash_used: 10_001 }, flags: [] },
      { counters: { nieznany: 1 }, flags: [] },
      { counters: {}, flags: ['pierwszy-zakup'] },
      { counters: {}, flags: ['poziom-10'] },
    ])
      expect(runAchievementProgressSchema.safeParse(bad).success).toBe(false);
  });
});

describe('komenda debug achievement grant', () => {
  it('oznacza naszywkę jako zdobytą i zapisuje meta; błędy zwraca jako tekst', async () => {
    const store = createMemorySaveStore();
    const meta = make();
    const commands = new CommandRegistry();
    const handle = registerMetaCommands(commands, meta, store);
    expect(commands.execute('achievement grant seria')).toBe('Naszywki: 1');
    expect(commands.execute('achievement grant nie-ma')).toContain('Nieznane');
    expect(commands.execute('achievement grant')).toContain('Użycie');
    await handle.settled();
    expect((await store.loadMeta())!.meta.achievements.unlocked).toEqual([
      'seria',
    ]);
  });
});
