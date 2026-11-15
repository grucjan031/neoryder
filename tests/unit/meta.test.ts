import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import type { RunSummary } from '../../src/core/runTypes';
import {
  MetaManager,
  computeRunRewards,
  defaultMetaRules,
  levelFromXp,
  runIdOf,
  talentPoints,
} from '../../src/progression/meta';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import { loadoutSchema } from '../../src/progression/loadout';
import { MAX_APPLIED_RUN_IDS, MAX_LAST_RUNS } from '../../src/core/metaTypes';

const { xpToNext } = defaultMetaRules.progression.levels;
const rules = defaultMetaRules.progression.rewards;
const threat = defaultMetaRules.threat;

function summary(over: Partial<RunSummary> = {}): RunSummary {
  return {
    outcome: 'death',
    seed: 's',
    loadoutId: 'custom',
    elapsedS: 300,
    kills: 10,
    roomsCleared: 3,
    elitesCleared: 1,
    threatLevel: 0,
    layerReached: 1,
    implants: [],
    damage: {} as RunSummary['damage'],
    ...over,
  };
}

function make(bus?: EventBus) {
  return new MetaManager(createStarterMetaState(), bus);
}

describe('levelFromXp', () => {
  it('poziom 1 przy 0 XP i progi', () => {
    expect(levelFromXp(0, xpToNext)).toEqual({
      level: 1,
      xpIntoLevel: 0,
      xpForNext: xpToNext[0],
    });
    expect(levelFromXp(xpToNext[0]! - 1, xpToNext).level).toBe(1);
    const at = levelFromXp(xpToNext[0]!, xpToNext);
    expect(at.level).toBe(2);
    expect(at.xpIntoLevel).toBe(0);
    expect(at.xpForNext).toBe(xpToNext[1]);
  });
  it('limit poziomu i dalsze sumowanie XP', () => {
    const total = xpToNext.reduce((a, b) => a + b, 0);
    const max = levelFromXp(total, xpToNext);
    expect(max).toEqual({
      level: xpToNext.length + 1,
      xpIntoLevel: 0,
      xpForNext: null,
    });
    expect(levelFromXp(total + 500, xpToNext).xpIntoLevel).toBe(500);
  });
  it('punkty talentów', () => {
    expect(talentPoints(1)).toBe(0);
    expect(talentPoints(5)).toBe(4);
  });
});

describe('computeRunRewards', () => {
  it('śmierć i zwycięstwo wg danych i rewardMult', () => {
    const death = computeRunRewards(summary(), threat[0]!, rules);
    expect(death).toEqual({
      xp: 3 * rules.xpPerRoom + rules.xpPerElite,
      data: 3 * rules.dataPerRoom + 10 * rules.dataPerKill,
      cores: rules.coresPerElite,
    });
    const t = threat[1]!;
    const win = computeRunRewards(summary({ outcome: 'victory' }), t, rules);
    expect(win.xp).toBe(
      Math.round(
        (3 * rules.xpPerRoom + rules.xpPerElite + rules.xpVictory) *
          t.rewardMult,
      ),
    );
    expect(win.data).toBe(
      Math.round(
        (3 * rules.dataPerRoom + 10 * rules.dataPerKill + rules.dataVictory) *
          t.rewardMult,
      ),
    );
    expect(win.cores).toBe(
      rules.coresPerElite + rules.coresVictory + t.victoryCores,
    );
  });
  it('runIdOf', () => {
    expect(runIdOf({ seed: 'abc', startedAtMs: 5 })).toBe('abc:5');
  });
});

describe('MetaManager.applyRun', () => {
  it('stosuje nagrody, statystyki i zdarzenia', () => {
    const bus = new EventBus();
    const events: string[] = [];
    bus.on('meta_rewards', (e) => events.push(`r${e.levelAfter}`));
    bus.on('level_up', (e) => events.push(`l${e.level}`));
    const meta = make(bus);
    const res = meta.applyRun(
      summary({ outcome: 'victory', roomsCleared: 20, elapsedS: 500 }),
      'a',
    );
    expect(res.applied).toBe(true);
    expect(res.levelAfter).toBeGreaterThan(res.levelBefore);
    expect(events[0]).toBe(`r${res.levelAfter}`);
    expect(events.length).toBe(1 + res.levelAfter - res.levelBefore);
    const s = meta.state;
    expect(s.xp).toBe(res.rewards.xp);
    expect(s.stats).toMatchObject({ runs: 1, victories: 1, bestVictoryS: 500 });
    meta.applyRun(summary({ outcome: 'victory', elapsedS: 400 }), 'b');
    meta.applyRun(summary({ outcome: 'victory', elapsedS: 600 }), 'c');
    expect(meta.state.stats.bestVictoryS).toBe(400);
    expect(meta.state.lastRuns[0]?.runId).toBe('c');
  });
  it('idempotentne po runId', () => {
    const meta = make();
    meta.applyRun(summary(), 'x');
    const before = meta.serialize();
    const res = meta.applyRun(summary(), 'x');
    expect(res.applied).toBe(false);
    expect(meta.serialize()).toEqual(before);
  });
  it('przycina historię i identyfikatory', () => {
    const meta = make();
    for (let i = 0; i < 30; i += 1) meta.applyRun(summary(), `r${i}`);
    const s = meta.state;
    expect(s.lastRuns).toHaveLength(MAX_LAST_RUNS);
    expect(s.appliedRunIds).toHaveLength(MAX_APPLIED_RUN_IDS);
    expect(s.appliedRunIds).not.toContain('r0');
    expect(s.appliedRunIds).toContain('r29');
  });
  it('threat.max rośnie tylko po zwycięstwie na max i do limitu', () => {
    const meta = make();
    meta.applyRun(summary({ outcome: 'death', threatLevel: 0 }), 'a');
    expect(meta.state.threat.max).toBe(0);
    const res = meta.applyRun(
      summary({ outcome: 'victory', threatLevel: 0 }),
      'b',
    );
    expect(res.threatUnlocked).toBe(true);
    expect(meta.state.threat.max).toBe(1);
    meta.applyRun(summary({ outcome: 'victory', threatLevel: 0 }), 'c');
    expect(meta.state.threat.max).toBe(1);
    const last = threat.length - 1;
    for (let i = 1; i <= last + 2; i += 1)
      meta.applyRun(
        summary({ outcome: 'victory', threatLevel: meta.state.threat.max }),
        `t${i}`,
      );
    expect(meta.state.threat.max).toBe(last);
  });
});

describe('MetaManager zakupy i ekwipunek', () => {
  it('moduły wymagają odblokowania, właściwej broni i wolnych slotów; walidacja jest atomowa', () => {
    const meta = make();
    const base = meta.state.loadout;
    expect(() =>
      meta.setLoadout({ ...base, modules: { blaster: ['ricochet'] } }),
    ).toThrow('nieodblokowany');
    meta.debugUnlockAll();
    const before = meta.serialize();
    const invalidModules: Record<string, string[]>[] = [
      { blaster: ['ricochet', 'pierce', 'incendiary'] },
      { blaster: ['ricochet', 'ricochet'] },
      { pistol: ['ricochet'] },
      { blaster: ['unknown'] },
    ];
    for (const modules of invalidModules) {
      expect(() => meta.setLoadout({ ...base, modules })).toThrow();
      expect(meta.serialize()).toEqual(before);
    }
    expect(() =>
      meta.setLoadout({
        ...base,
        weapons: ['beam'],
        modules: { beam: ['ricochet'] },
      }),
    ).toThrow('nie pasuje');
    meta.setLoadout({
      ...base,
      weapons: ['blaster', 'pistol'],
      modules: { blaster: ['ricochet', 'pierce'], pistol: ['ricochet'] },
    });
    const resolved = meta.loadout();
    expect(resolved.modules).toEqual(meta.state.loadout.modules);
    resolved.modules!.blaster!.pop();
    expect(meta.state.loadout.modules.blaster).toEqual(['ricochet', 'pierce']);
  });

  it('ceny i progi modułów są egzekwowane przy zakupie', () => {
    const cases = [
      { id: 'ricochet', currency: 'data', cost: 160, minLevel: 3 },
      { id: 'pierce', currency: 'data', cost: 180, minLevel: 4 },
      { id: 'incendiary', currency: 'data', cost: 200, minLevel: 4 },
      { id: 'superconductor', currency: 'cores', cost: 6, minLevel: 5 },
    ] as const;
    for (const { id, currency, cost, minLevel } of cases) {
      const meta = make();
      const unlockId = `module:${id}`;
      expect(defaultMetaRules.unlocks.get(unlockId)).toMatchObject({
        cost: { [currency]: cost },
        minLevel,
      });
      const requiredXp = xpToNext
        .slice(0, minLevel - 1)
        .reduce((sum, xp) => sum + xp, 0);
      meta.debugAddXp(requiredXp - 1);
      expect(() => meta.buyUnlock(unlockId)).toThrow(`poziom ${minLevel}`);
      meta.debugAddXp(1);
      expect(() => meta.buyUnlock(unlockId)).toThrow(
        currency === 'data' ? 'Danych' : 'Rdzeni',
      );
      if (currency === 'data') meta.debugAddData(cost);
      else meta.debugAddCores(cost);
      meta.buyUnlock(unlockId);
      expect(meta.state[currency]).toBe(0);
      expect(meta.isUnlocked(unlockId)).toBe(true);
    }
  });
  it('odrzuca zakup bez waluty i poniżej minLevel', () => {
    const meta = make();
    const def = [...defaultMetaRules.unlocks.values()].find(
      (u) => u.minLevel !== undefined && u.minLevel > 1,
    );
    expect(def).toBeDefined();
    meta.debugAddData(1_000_000);
    meta.debugAddCores(1_000_000);
    expect(() => meta.buyUnlock(def!.id)).toThrow();
    const poor = make();
    const cheap = [...defaultMetaRules.unlocks.values()].find(
      (u) =>
        (u.minLevel ?? 1) <= 1 &&
        !poor.isUnlocked(u.id) &&
        (u.cost.data ?? 0) > 0,
    );
    expect(() => poor.buyUnlock(cheap!.id)).toThrow();
  });
  it('zakup odejmuje walutę i emituje zdarzenie', () => {
    const bus = new EventBus();
    const bought: string[] = [];
    bus.on('unlock_purchased', (e) => bought.push(e.id));
    const meta = make(bus);
    const def = [...defaultMetaRules.unlocks.values()].find(
      (u) => (u.minLevel ?? 1) <= 1 && !meta.isUnlocked(u.id),
    )!;
    meta.debugAddData(1_000_000);
    meta.debugAddCores(1_000_000);
    meta.buyUnlock(def.id);
    expect(meta.isUnlocked(def.id)).toBe(true);
    expect(meta.state.data).toBe(1_000_000 - (def.cost.data ?? 0));
    expect(meta.state.cores).toBe(1_000_000 - (def.cost.cores ?? 0));
    expect(bought).toEqual([def.id]);
    expect(() => meta.buyUnlock(def.id)).toThrow();
    expect(() => meta.buyUnlock('weapon:nie-ma')).toThrow();
  });
  it('ekwipunek: nieodblokowane i ponad sloty odrzucone, poprawny emituje', () => {
    const bus = new EventBus();
    const got: GameEvents['loadout_changed'][] = [];
    bus.on('loadout_changed', (e) => got.push(e));
    const meta = make(bus);
    const base = meta.state.loadout;
    expect(() =>
      meta.setLoadout({ ...base, weapons: ['railgun-nie-ma'] }),
    ).toThrow();
    expect(() =>
      meta.setLoadout({ ...base, weapons: ['blaster', 'pistol'] }),
    ).toThrow();
    expect(meta.weaponSlots).toBe(1);
    meta.debugUnlockAll();
    expect(meta.weaponSlots).toBe(3);
    expect(meta.powerSlots).toBe(2);
    expect(() =>
      meta.setLoadout({ ...base, weapons: ['blaster', 'blaster'] }),
    ).toThrow();
    meta.setLoadout({ ...base, weapons: ['blaster', 'pistol'] });
    expect(got).toHaveLength(1);
    expect(loadoutSchema.safeParse(meta.loadout()).success).toBe(true);
    expect(meta.loadout().id).toBe('custom');
  });
  it('selectThreat w zakresie 0..max', () => {
    const bus = new EventBus();
    const levels: number[] = [];
    bus.on('threat_selected', (e) => levels.push(e.level));
    const meta = make(bus);
    expect(() => meta.selectThreat(1)).toThrow();
    meta.applyRun(summary({ outcome: 'victory' }), 'w');
    meta.selectThreat(1);
    expect(meta.state.threat.selected).toBe(1);
    expect(levels).toEqual([1]);
  });
});

describe('MetaManager zapis', () => {
  it('wczytuje stan meta v3 bez modules bez migracji i zachowuje postęp', () => {
    const meta = make();
    meta.debugAddData(217);
    meta.debugGrantTalent('bladeRoot');
    const old = meta.serialize();
    const { modules: omitted, ...loadout } = old.loadout;
    expect(omitted).toEqual({});
    const restored = MetaManager.restore({ ...old, loadout });
    expect(restored.serialize()).toEqual(old);
    expect(restored.loadout().modules).toEqual({});
  });
  it('restore(serialize()) jest identyczny', () => {
    const meta = make();
    meta.applyRun(summary({ outcome: 'victory' }), 'a');
    meta.debugUnlockAll();
    const copy = MetaManager.restore(meta.serialize());
    expect(copy.serialize()).toEqual(meta.serialize());
    expect(() => MetaManager.restore({ xp: -1 })).toThrow();
  });
  it('state zwraca kopię; debugReset przywraca stan startowy', () => {
    const meta = make();
    meta.state.xp = 999;
    expect(meta.state.xp).toBe(0);
    meta.debugAddXp(500);
    expect(meta.level).toBeGreaterThan(1);
    meta.debugReset();
    expect(meta.serialize()).toEqual(createStarterMetaState());
    expect(meta.freePoints).toBe(0);
  });
});

describe('MetaManager talenty', () => {
  /** Poziom 20 daje 19 punktów talentów. */
  function rich(bus?: EventBus): MetaManager {
    const meta = make(bus);
    meta.debugAddXp(xpToNext.reduce((a, b) => a + b, 0));
    return meta;
  }

  it('odrzuca zakup bez punktów, nieznany i powtórzony węzeł', () => {
    expect(() => make().buyTalent('bladeRoot')).toThrow('Za mało punktów');
    const meta = rich();
    expect(() => meta.buyTalent('nope')).toThrow('Nieznany talent');
    meta.buyTalent('bladeRoot');
    expect(() => meta.buyTalent('bladeRoot')).toThrow('Już kupione');
  });

  it('odrzuca zakup bez wymaganego węzła', () => {
    const meta = rich();
    expect(() => meta.buyTalent('bladeRiposte')).toThrow('Wymagany talent');
    expect(meta.state.talents).toEqual([]);
  });

  it('odrzuca zakup poniżej progu drzewka i przyjmuje po jego spełnieniu', () => {
    const meta = rich();
    meta.buyTalent('bladeRoot');
    meta.buyTalent('bladeDashCut'); // 3 pkt w drzewku
    expect(meta.spentInTree('blade')).toBe(3);
    // bladeThrowEdge: tier 3, wymaga bladeDashCut (jest) i 4 pkt w drzewku (są 3).
    expect(() => meta.buyTalent('bladeThrowEdge')).toThrow('Wymagane 4 pkt');
    meta.buyTalent('bladeRiposte');
    meta.buyTalent('bladeThrowEdge');
    expect(meta.state.talents).toContain('bladeThrowEdge');
  });

  it('hybryda bez wymaganych punktów w drzewkach jest odrzucona', () => {
    const meta = rich();
    expect(() => meta.buyTalent('hybridStormDancer')).toThrow('Wymagane 3 pkt');
    meta.buyTalent('bladeRoot');
    meta.buyTalent('bladeDashCut');
    expect(() => meta.buyTalent('hybridStormDancer')).toThrow('Wymagane 3 pkt');
  });

  it('hybryda po zainwestowaniu w oba drzewka odejmuje punkty i nie liczy się do drzewek', () => {
    const meta = rich();
    for (const id of [
      'bladeRoot',
      'bladeDashCut',
      'resonanceRoot',
      'resonanceCapacitor',
    ])
      meta.buyTalent(id);
    const before = meta.freePoints;
    meta.buyTalent('hybridStormDancer');
    expect(meta.freePoints).toBe(before - 2);
    expect(meta.spentInTree('blade')).toBe(3);
    expect(meta.spentInTree('hybrid')).toBe(2);
  });

  it('zakup emituje talents_changed, a reset zwraca wszystkie punkty', () => {
    const bus = new EventBus();
    const events: GameEvents['talents_changed'][] = [];
    bus.on('talents_changed', (e) => events.push(e));
    const meta = rich(bus);
    const total = meta.freePoints;
    for (const id of ['bladeRoot', 'resonanceRoot', 'gunnerRoot'])
      meta.buyTalent(id);
    expect(events.at(-1)?.talents).toEqual([
      'bladeRoot',
      'resonanceRoot',
      'gunnerRoot',
    ]);
    expect(meta.spentPoints).toBe(3);
    meta.resetTalents();
    expect(meta.state.talents).toEqual([]);
    expect(meta.freePoints).toBe(total);
    expect(events.at(-1)?.talents).toEqual([]);
  });

  it('debugGrantTalent dodaje bez kosztu i odrzuca nieznany id', () => {
    const meta = make();
    meta.debugGrantTalent('bladeRoot');
    meta.debugGrantTalent('bladeRoot');
    expect(meta.state.talents).toEqual(['bladeRoot']);
    expect(() => meta.debugGrantTalent('nope')).toThrow('Nieznany talent');
  });
});
