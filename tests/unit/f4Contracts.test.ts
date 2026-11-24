import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import type { MetaState } from '../../src/core/metaTypes';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import { loadoutDefinitions } from '../../src/progression/loadout';
import { metaStateSchema } from '../../src/progression/metaStateSchema';
import { definitionPatchSchema } from '../../src/progression/patchSchema';
import {
  loadProgression,
  progression,
} from '../../src/progression/progressionSchema';
import {
  loadTalentTrees,
  talentTreeSchema,
  talentTrees,
} from '../../src/progression/talentSchema';
import {
  loadThreatLevels,
  threatLevels,
} from '../../src/progression/threatSchema';
import {
  loadUnlockDefinitions,
  unlockDefinitions,
} from '../../src/progression/unlocksSchema';
import { bladeDefinitions } from '../../src/combat/melee/bladeSchema';
import { powerDefinitions } from '../../src/combat/powers/registry';
import { weaponDefinitions } from '../../src/combat/weapons/weaponSchema';
import progressionRaw from '../../src/data/meta/progression.json';
import threatRaw from '../../src/data/meta/threat.json';
import unlocksRaw from '../../src/data/meta/unlocks.json';
import { RunManager } from '../../src/world/run';
import { generateSectorMap } from '../../src/world/sectorMap';
import { kuroganeSector } from '../../src/world/sectors';

const node = (overrides: Record<string, unknown> = {}) => ({
  id: 'bladeRoot',
  name: 'Korzeń Ostrza',
  description: 'Tag ścieżki Ostrza.',
  tier: 1,
  cost: 1,
  requires: [],
  effects: { tags: ['#build_blade'] },
  ...overrides,
});
const tree = (overrides: Record<string, unknown> = {}) => ({
  tree: 'blade',
  name: 'Ostrze',
  tierThresholds: [0, 2, 5, 8],
  nodes: [node()],
  ...overrides,
});
const threat = (level: number, overrides: Record<string, unknown> = {}) => ({
  level,
  name: `Poziom ${level}`,
  enemyHealth: level === 0 ? 0 : 0.1 * level,
  enemyDamage: level === 0 ? 0 : 0.05 * level,
  budgetMult: level === 0 ? 1 : 1 + 0.1 * level,
  rewardMult: level === 0 ? 1 : 1 + 0.15 * level,
  victoryCores: level === 0 ? 0 : 1,
  ...overrides,
});

describe('dane meta F4 przechodzą schematy', () => {
  it('progression.json: stan startowy, krzywa 19 progów i nagrody', () => {
    const data = loadProgression(progressionRaw);
    expect(data).toEqual(progression);
    expect(data.levels.xpToNext).toHaveLength(19);
    expect(data.levels.xpToNext[0]).toBeGreaterThanOrEqual(50);
    expect(data.levels.xpToNext[0]).toBeLessThanOrEqual(150);
    expect(data.starter).toMatchObject({
      xp: 0,
      data: 0,
      cores: 0,
      talents: [],
      threat: { max: 0, selected: 0 },
      loadout: {
        blade: 'plasmaBlade',
        weapons: ['blaster'],
        powers: ['push'],
      },
    });
    expect(data.starter.unlocks).toEqual([
      'blade:plasmaBlade',
      'weapon:blaster',
      'weapon:pistol',
      'power:push',
    ]);
  });

  it('createStarterMetaState zwraca poprawny pełny MetaState bez wspólnych referencji z danymi', () => {
    const state = createStarterMetaState();
    expect(metaStateSchema.safeParse(state).success).toBe(true);
    expect(state.stats).toEqual({
      runs: 0,
      victories: 0,
      deaths: 0,
      kills: 0,
      bestVictoryS: null,
    });
    state.unlocks.push('weapon:rifle');
    expect(createStarterMetaState().unlocks).toHaveLength(4);
  });

  it('unlocks.json: wszystkie bronie, moce, ostrza i sloty poza startowymi', () => {
    const loaded = loadUnlockDefinitions(unlocksRaw);
    expect(loaded.size).toBe(unlockDefinitions.size);
    const starter = new Set(progression.starter.unlocks);
    const expected = [
      ...[...weaponDefinitions.keys()].map((id) => `weapon:${id}`),
      ...[...powerDefinitions.keys()].map((id) => `power:${id}`),
      ...[...bladeDefinitions.keys()].map((id) => `blade:${id}`),
      'slot:weapon2',
      'slot:weapon3',
      'slot:power2',
      'module:ricochet',
      'module:pierce',
      'module:incendiary',
      'module:superconductor',
      'module:collimator',
      'module:scope',
      'module:holo',
      'module:laser',
      'module:compensator',
      'module:foregrip',
      'module:extendedCell',
      'module:pulseCell',
    ].filter((id) => !starter.has(id));
    const nonSkins = [...loaded.keys()].filter((id) => !id.startsWith('skin:'));
    expect(nonSkins.sort()).toEqual(expected.sort());
    expect(
      [...loaded.keys()].filter((id) => id.startsWith('skin:')).sort(),
    ).toEqual([
      'skin:biala-ceramika',
      'skin:bursztynowa-linia',
      'skin:miejski-kamuflaz',
      'skin:nocny-karbon',
      'skin:zielony-sygnal',
    ]);
    for (const id of starter) expect(loaded.has(id)).toBe(false);
    expect(loaded.get('slot:weapon2')?.cost.data).toBeGreaterThan(0);
    expect(loaded.get('slot:weapon3')?.cost.cores).toBeGreaterThan(0);
    expect(loaded.get('slot:power2')?.cost.cores).toBeGreaterThan(0);
    expect(loaded.get('power:focus')?.cost.cores).toBeGreaterThan(0);
    expect(loaded.get('blade:staffBlade')?.cost.cores).toBeGreaterThan(0);
    for (const unlock of loaded.values()) {
      expect(unlock.minLevel).toBeGreaterThanOrEqual(1);
      expect(unlock.minLevel).toBeLessThanOrEqual(6);
      if (unlock.cost.data !== undefined && !unlock.id.startsWith('slot:')) {
        expect(unlock.cost.data).toBeGreaterThanOrEqual(80);
        expect(unlock.cost.data).toBeLessThanOrEqual(
          unlock.id.startsWith('module:') ? 240 : 200,
        );
      }
    }
  });

  it('threat.json: poziomy 0-10 kolejne, poziom 0 neutralny, wartości rosnące', () => {
    expect(loadThreatLevels(threatRaw)).toEqual(threatLevels);
    expect(threatLevels).toHaveLength(11);
    expect(threatLevels[0]).toMatchObject({
      level: 0,
      enemyHealth: 0,
      enemyDamage: 0,
      budgetMult: 1,
      rewardMult: 1,
    });
    expect(threatLevels[1]).toMatchObject({
      enemyHealth: 0.1,
      enemyDamage: 0.05,
      budgetMult: 1.1,
      rewardMult: 1.15,
      victoryCores: 1,
    });
    for (let i = 1; i < threatLevels.length; i++) {
      const prev = threatLevels[i - 1]!;
      const cur = threatLevels[i]!;
      expect(cur.enemyHealth).toBeGreaterThan(prev.enemyHealth);
      expect(cur.rewardMult).toBeGreaterThan(prev.rewardMult);
    }
  });

  it('talenty: schemat działa na pustym zbiorze (dane w zadaniu 04)', () => {
    expect(loadTalentTrees([]).size).toBe(0);
    expect(talentTrees).toBeInstanceOf(Map);
  });
});

describe('schematy odrzucają błędne przykłady', () => {
  it('unlocks: nieznane id, nieznany slot, duplikat, brak kosztu i ujemny koszt', () => {
    const ok = { id: 'weapon:rifle', cost: { data: 80 }, minLevel: 1 };
    expect(() => loadUnlockDefinitions([ok])).not.toThrow();
    expect(() =>
      loadUnlockDefinitions([{ ...ok, id: 'weapon:nieistnieje' }]),
    ).toThrow();
    expect(() =>
      loadUnlockDefinitions([{ ...ok, id: 'slot:weapon9' }]),
    ).toThrow();
    expect(() => loadUnlockDefinitions([{ ...ok, id: 'rifle' }])).toThrow();
    expect(() => loadUnlockDefinitions([ok, ok])).toThrow();
    expect(() => loadUnlockDefinitions([{ ...ok, cost: {} }])).toThrow();
    expect(() =>
      loadUnlockDefinitions([{ ...ok, cost: { data: -5 } }]),
    ).toThrow();
    expect(() =>
      loadUnlockDefinitions([{ ...ok, cost: { cores: -1 } }]),
    ).toThrow();
  });

  it('threat: brak poziomu 0, poziom 0 nieneutralny i luka w poziomach', () => {
    expect(() => loadThreatLevels([threat(0), threat(1)])).not.toThrow();
    expect(() => loadThreatLevels([threat(1), threat(2)])).toThrow();
    expect(() => loadThreatLevels([threat(0), threat(2)])).toThrow();
    expect(() =>
      loadThreatLevels([threat(0, { budgetMult: 1.2 }), threat(1)]),
    ).toThrow();
    expect(() =>
      loadThreatLevels([threat(0, { rewardMult: 2 }), threat(1)]),
    ).toThrow();
    expect(() => loadThreatLevels([])).toThrow();
  });

  it('progression: ekwipunek startowy spoza odblokowań lub nieznany', () => {
    const base = structuredClone(progressionRaw);
    expect(() => loadProgression(base)).not.toThrow();
    const locked = structuredClone(base);
    locked.starter.loadout.weapons = ['rifle'];
    expect(() => loadProgression(locked)).toThrow();
    const unknown = structuredClone(base);
    unknown.starter.unlocks.push('weapon:nieistnieje');
    expect(() => loadProgression(unknown)).toThrow();
  });

  it('talentTree: węzeł z nieznanym tier, kosztem poza 1-3, złymi progami i duplikatem', () => {
    expect(talentTreeSchema.safeParse(tree()).success).toBe(true);
    for (const tier of [0, 5, 2.5, '1'])
      expect(
        talentTreeSchema.safeParse(tree({ nodes: [node({ tier })] })).success,
      ).toBe(false);
    for (const cost of [0, 4])
      expect(
        talentTreeSchema.safeParse(tree({ nodes: [node({ cost })] })).success,
      ).toBe(false);
    expect(
      talentTreeSchema.safeParse(tree({ tierThresholds: [0, 2, 5] })).success,
    ).toBe(false);
    expect(
      talentTreeSchema.safeParse(tree({ tierThresholds: [0, 5, 2, 8] }))
        .success,
    ).toBe(false);
    expect(
      talentTreeSchema.safeParse(tree({ nodes: [node(), node()] })).success,
    ).toBe(false);
    expect(talentTreeSchema.safeParse(tree({ tree: 'magic' })).success).toBe(
      false,
    );
    expect(
      talentTreeSchema.safeParse(
        tree({ nodes: [node({ requires: ['bladeRoot'] })] }),
      ).success,
    ).toBe(false);
  });

  it('loadTalentTrees: nieznany wymagany węzeł i powtórzone id w drzewkach', () => {
    expect(() =>
      loadTalentTrees([tree({ nodes: [node({ requires: ['nic'] })] })]),
    ).toThrow('nieznanego');
    expect(() => loadTalentTrees([tree(), tree({ tree: 'gunner' })])).toThrow(
      'Powtórzone id talentu',
    );
    expect(() => loadTalentTrees([tree(), tree()])).toThrow('Powtórzone');
  });

  it('talentTree: efekty reużywają schematów modyfikatorów, wyzwalaczy i łatek', () => {
    const effects = {
      modifiers: [{ stat: 'damage', type: 'percent', value: 0.05 }],
      patches: [{ target: 'power:chain', op: 'add', path: 'jumps', value: 1 }],
      runStart: { credits: 20 },
    };
    expect(
      talentTreeSchema.safeParse(tree({ nodes: [node({ effects })] })).success,
    ).toBe(true);
    const badStat = { modifiers: [{ stat: 'nope', type: 'flat', value: 1 }] };
    expect(
      talentTreeSchema.safeParse(tree({ nodes: [node({ effects: badStat })] }))
        .success,
    ).toBe(false);
    expect(
      talentTreeSchema.safeParse(
        tree({
          nodes: [
            node({
              effects: {
                patches: [{ target: 'power:chain', op: 'xor', path: 'jumps' }],
              },
            }),
          ],
        }),
      ).success,
    ).toBe(false);
  });

  it('definitionPatch: nieznany op, zły prefiks celu, pusta ścieżka i nieliczba dla add/mul', () => {
    const ok = {
      target: 'power:chain',
      op: 'add',
      path: 'jumps',
      value: 1,
    };
    expect(definitionPatchSchema.safeParse(ok).success).toBe(true);
    expect(
      definitionPatchSchema.safeParse({
        target: 'weapon:rifle',
        op: 'set',
        path: 'statuses',
        value: [{ id: 'burning' }],
      }).success,
    ).toBe(true);
    expect(definitionPatchSchema.safeParse({ ...ok, op: 'div' }).success).toBe(
      false,
    );
    expect(
      definitionPatchSchema.safeParse({ ...ok, target: 'enemy:drone' }).success,
    ).toBe(false);
    expect(definitionPatchSchema.safeParse({ ...ok, path: '' }).success).toBe(
      false,
    );
    expect(
      definitionPatchSchema.safeParse({ ...ok, value: 'dużo' }).success,
    ).toBe(false);
    expect(
      definitionPatchSchema.safeParse({ ...ok, op: 'mul', value: Infinity })
        .success,
    ).toBe(false);
  });

  it('metaState: ujemne wartości, za długa historia i wybór ponad max', () => {
    const base = createStarterMetaState();
    expect(metaStateSchema.safeParse(base).success).toBe(true);
    expect(metaStateSchema.safeParse({ ...base, xp: -1 }).success).toBe(false);
    const record = {
      runId: 'a:1',
      outcome: 'death' as const,
      elapsedS: 1,
      layerReached: 1,
      threatLevel: 0,
      rewards: { xp: 1, data: 1, cores: 0 },
    };
    const tooMany: MetaState = {
      ...base,
      lastRuns: Array.from({ length: 11 }, () => record),
    };
    expect(metaStateSchema.safeParse(tooMany).success).toBe(false);
    expect(
      metaStateSchema.safeParse({
        ...base,
        threat: { max: 0, selected: 1 },
      }).success,
    ).toBe(false);
  });
});

describe('RunManager a pola F4', () => {
  const create = (bus = new EventBus()) =>
    new RunManager(bus, (seed) => generateSectorMap(kuroganeSector, seed), {
      sector: kuroganeSector,
      now: () => 1,
    });

  it('newRun wypełnia loadout z presetu, talents [] i threatLevel 0', () => {
    const manager = create();
    const state = manager.newRun('f4', 'bladeDancer');
    expect(state.loadout).toEqual(loadoutDefinitions.get('bladeDancer'));
    expect(state.loadout).not.toBe(loadoutDefinitions.get('bladeDancer'));
    expect(state.talents).toEqual([]);
    expect(state.threatLevel).toBe(0);
    expect(() => manager.newRun('f4', 'missing')).toThrow('Nieznany ekwipunek');
    manager.dispose();
  });

  it('newRun przyjmuje własne opcje (ekwipunek, talenty, poziom zagrożenia)', () => {
    const manager = create();
    const custom = {
      ...loadoutDefinitions.get('classic')!,
      id: 'custom',
      tags: [],
    };
    const state = manager.newRun('f4', 'custom', {
      loadout: custom,
      talents: ['bladeRoot'],
      threatLevel: 3,
    });
    expect(state.loadout).toEqual(custom);
    expect(state.talents).toEqual(['bladeRoot']);
    expect(state.threatLevel).toBe(3);
    expect(manager.restore(state)).toEqual(state);
    expect(() =>
      manager.newRun('f4', 'classic', { threatLevel: -1 }),
    ).toThrow();
    manager.dispose();
  });

  it('RunSummary niesie threatLevel i liczy ukończone węzły elite', () => {
    const bus = new EventBus();
    const manager = create(bus);
    manager.newRun('f4-elites', 'classic', { threatLevel: 2 });
    const elite = manager.state.map.layers
      .flat()
      .find((candidate) => candidate.type === 'elite');
    expect(elite).toBeDefined();
    bus.emit('room_cleared', {
      nodeId: elite!.id,
      type: 'elite',
      timeS: 10,
    });
    const summary = manager.finish('death');
    expect(summary.elitesCleared).toBe(1);
    expect(summary.threatLevel).toBe(2);
    manager.dispose();
  });
});
