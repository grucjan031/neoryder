import { afterEach, describe, expect, it } from 'vitest';
import { Scene as ThreeScene } from 'three';
import { EventBus } from '../../src/core/events';
import type { InputSnapshot } from '../../src/core/input';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { TREE_IDS } from '../../src/core/metaTypes';
import type { TreeId } from '../../src/core/metaTypes';
import { Rng } from '../../src/core/rng';
import type { RunState, SectorMap } from '../../src/core/runTypes';
import { Stats } from '../../src/core/stats';
import { tuning } from '../../src/core/tuning';
import { loadoutDefinitions } from '../../src/progression/loadout';
import type { Loadout } from '../../src/progression/loadout';
import { resolveLoadout } from '../../src/progression/patches';
import { talentTrees } from '../../src/progression/talentSchema';
import type { TalentNode } from '../../src/progression/talentSchema';
import { resolveTalents, TalentSystem } from '../../src/progression/talents';
import { MetaManager, defaultMetaRules } from '../../src/progression/meta';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import { RoomScene } from '../../src/scenes/roomScene';
import { CommandRegistry } from '../../src/ui/debugCommands';
import { RunManager } from '../../src/world/run';
import { roomDefinitions } from '../../src/world/rooms';
import { loadWaves } from '../../src/world/waves';
import wavesData from '../../src/data/waves/roomTest.json';

const allNodes: TalentNode[] = [...talentTrees.values()].flatMap(
  (tree) => tree.nodes,
);
const nodeById = new Map(allNodes.map((node) => [node.id, node]));

describe('dane drzewek talentów', () => {
  it('ma komplet drzewek: 8 + 8 + 8 + 6 węzłów', () => {
    expect([...talentTrees.keys()].sort()).toEqual([...TREE_IDS].sort());
    for (const tree of ['blade', 'resonance', 'gunner'] as const)
      expect(talentTrees.get(tree)?.nodes).toHaveLength(8);
    expect(talentTrees.get('hybrid')?.nodes).toHaveLength(6);
  });

  it('wszystkie węzły mają polskie nazwy i opisy bez nazw chronionych', () => {
    const polish = /[ąćęłńóśźż]|\b(i|oraz|na|o|po|za|do)\b/i;
    for (const node of allNodes) {
      expect(node.name.trim().length, node.id).toBeGreaterThan(0);
      expect(node.description.length, node.id).toBeGreaterThan(20);
      expect(polish.test(node.description), node.id).toBe(true);
      expect(`${node.name} ${node.description}`, node.id).not.toMatch(
        /jedi|sith|lightsaber|the force|superhot/i,
      );
    }
  });

  it('limity statystyk drzewka (ADR 0007 pkt 4)', () => {
    for (const tree of talentTrees.values()) {
      let damage = 0;
      let health = 0;
      let modifiersOnly = 0;
      for (const node of tree.nodes) {
        for (const mod of node.effects.modifiers ?? []) {
          if (mod.stat === 'damage' && mod.type === 'percent')
            damage += mod.value;
          if (mod.stat === 'maxHealth' && mod.type === 'flat')
            health += mod.value;
        }
        const { modifiers, ...rest } = node.effects;
        if ((modifiers?.length ?? 0) > 0 && Object.keys(rest).length === 0)
          modifiersOnly += 1;
      }
      expect(damage, `${tree.tree} damage`).toBeLessThanOrEqual(0.15);
      expect(health, `${tree.tree} maxHealth`).toBeLessThanOrEqual(20);
      expect(modifiersOnly, `${tree.tree} tylko modifiers`).toBeLessThanOrEqual(
        2,
      );
    }
  });

  it('korzenie dają tagi #build_*', () => {
    for (const [tree, root] of [
      ['blade', 'bladeRoot'],
      ['resonance', 'resonanceRoot'],
      ['gunner', 'gunnerRoot'],
    ] as const) {
      const node = nodeById.get(root)!;
      expect(node.tier).toBe(1);
      expect(node.effects.tags).toEqual([`#build_${tree}`]);
    }
  });

  it('każdy węzeł jest osiągalny przy wystarczającej liczbie punktów (bez zakleszczeń progów)', () => {
    const bought = new Set<string>();
    const spent = (tree: TreeId): number =>
      (talentTrees.get(tree)?.nodes ?? [])
        .filter((node) => bought.has(node.id))
        .reduce((sum, node) => sum + node.cost, 0);
    let changed = true;
    while (changed) {
      changed = false;
      for (const tree of talentTrees.values())
        for (const node of tree.nodes) {
          if (bought.has(node.id)) continue;
          const ok =
            node.requires.every((id) => bought.has(id)) &&
            spent(tree.tree) >= (tree.tierThresholds[node.tier - 1] ?? 0) &&
            Object.entries(node.requiresTreePoints ?? {}).every(
              ([t, points]) => spent(t as TreeId) >= points,
            );
          if (ok) {
            bought.add(node.id);
            changed = true;
          }
        }
    }
    expect(allNodes.filter((node) => !bought.has(node.id))).toEqual([]);
  });

  it('łatki każdego węzła są poprawne względem celu (resolveLoadout na ekwipunku z celami)', () => {
    const base = loadoutDefinitions.get('classic')!;
    let checked = 0;
    for (const node of allNodes) {
      const patches = node.effects.patches ?? [];
      if (patches.length === 0) continue;
      const targets = (kind: string): string[] => [
        ...new Set(
          patches
            .map((p) => p.target)
            .filter((t) => t.startsWith(`${kind}:`))
            .map((t) => t.slice(kind.length + 1)),
        ),
      ];
      // Ekwipunek ma limit 3 broni i 2 mocy, więc cele dzielimy na kolejne ekwipunki.
      const chunks = (items: string[], size: number): string[][] =>
        Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
          items.slice(i * size, i * size + size),
        );
      const weaponChunks = chunks(targets('weapon'), 3);
      const powerChunks = chunks(targets('power'), 2);
      const blades = targets('blade');
      const bladeList = blades.length > 0 ? blades : [base.blade];
      const rounds = Math.max(weaponChunks.length, powerChunks.length, 1);
      for (const blade of bladeList)
        for (let i = 0; i < rounds; i += 1) {
          const loadout: Loadout = {
            ...base,
            blade,
            weapons: weaponChunks[i] ?? base.weapons,
            powers: powerChunks[i] ?? base.powers,
          };
          expect(
            () => resolveLoadout(loadout, patches),
            `${node.id} @ ${blade}`,
          ).not.toThrow();
        }
      checked += 1;
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('łatki z talentów faktycznie zmieniają definicje celów', () => {
    const loadout: Loadout = {
      ...loadoutDefinitions.get('resonance')!,
      powers: ['chain', 'push'],
    };
    const patched = resolveLoadout(
      loadout,
      resolveTalents(['resonanceChainSplit']).patches,
    );
    const plain = resolveLoadout(loadout, []);
    const jumps = (r: typeof plain): number =>
      (r.powers.find((p) => p.id === 'chain') as { jumps: number }).jumps;
    expect(jumps(patched)).toBe(jumps(plain) + 1);
  });
});

describe('resolveTalents', () => {
  it('składa modyfikatory ze źródłem talent:<id>, tagi, wyzwalacze i łatki', () => {
    const result = resolveTalents(['bladeServoFrame', 'bladeRoot']);
    expect(result.modifiers).toEqual([
      {
        stat: 'attackSpeed',
        type: 'percent',
        value: 0.12,
        source: 'talent:bladeServoFrame',
      },
      {
        stat: 'maxHealth',
        type: 'flat',
        value: 15,
        source: 'talent:bladeServoFrame',
      },
    ]);
    expect(result.tags).toEqual(['#build_blade']);
    expect(result.patches.length).toBeGreaterThan(0);
    expect(result.triggers).toEqual([]);
    expect(resolveTalents(['bladeRiposte']).triggers[0]?.talentId).toBe(
      'bladeRiposte',
    );
  });

  it('jest deterministyczne (kolejność posortowanych id) i ignoruje duplikaty', () => {
    const a = resolveTalents(['bladeServoFrame', 'bladeRoot', 'bladeDashCut']);
    const b = resolveTalents([
      'bladeDashCut',
      'bladeRoot',
      'bladeRoot',
      'bladeServoFrame',
    ]);
    expect(b).toEqual(a);
    expect(a.patches[0]?.path).toBe('dashCut.damage'); // bladeDashCut < bladeRoot
  });

  it('sumuje startowe Kredyty i odrzuca nieznany id', () => {
    expect(
      resolveTalents(['bladeThrowEdge', 'gunnerEmpIncendiary']).runStartCredits,
    ).toBe(65);
    expect(resolveTalents([]).runStartCredits).toBe(0);
    expect(() => resolveTalents(['nope'])).toThrow('Nieznany talent');
  });
});

describe('TalentSystem', () => {
  it('nakłada modyfikatory na obie instancje Stats i zdejmuje je po źródle', () => {
    const a = new Stats({ maxHealth: 100, attackSpeed: 1 });
    const b = new Stats({ maxHealth: 100, attackSpeed: 1 });
    const system = new TalentSystem({ stats: [a, b] });
    system.add('bladeServoFrame');
    for (const stats of [a, b]) {
      expect(stats.get('attackSpeed')).toBeCloseTo(1.12);
      expect(stats.get('maxHealth')).toBe(115);
    }
    expect(system.add('bladeServoFrame')).toBe(false);
    system.clear();
    for (const stats of [a, b]) {
      expect(stats.modifiers()).toEqual([]);
      expect(stats.get('maxHealth')).toBe(100);
    }
    expect(system.ids()).toEqual([]);
  });

  it('wzrost maxHealth podnosi bieżące zdrowie, a zdjęcie je przycina', () => {
    const stats = new Stats({ maxHealth: 100 });
    let hp = 100;
    const system = new TalentSystem({
      stats,
      health: {
        get current() {
          return hp;
        },
        set: (n: number) => {
          hp = n;
        },
      },
    });
    system.add('bladeServoFrame');
    expect(hp).toBe(115);
    system.clear();
    expect(hp).toBe(100);
  });

  it('udostępnia tagi i wyzwalacze oraz zgłasza zmianę', () => {
    let changes = 0;
    const system = new TalentSystem({ onChange: () => (changes += 1) });
    system.set(['bladeRoot', 'bladeRiposte']);
    expect(system.tags()).toEqual(['#build_blade']);
    expect(system.triggers()).toHaveLength(1);
    expect(system.patches().length).toBeGreaterThan(0);
    system.clear();
    expect(changes).toBe(2);
    expect(system.tags()).toEqual([]);
    expect(() => system.add('nope')).toThrow('Nieznany talent');
  });
});

describe('RunManager.newRun z talentami', () => {
  const map: SectorMap = {
    sectorId: 's',
    layers: [[{ id: 'a', layer: 1, index: 0, type: 'combat', next: [] }]],
  };
  const manager = (): RunManager => new RunManager(new EventBus(), () => map);

  it('dolicza Kredyty startowe z talentów', () => {
    expect(manager().newRun('t', 'classic').credits).toBe(0);
    const state = manager().newRun('t', 'classic', {
      talents: ['bladeThrowEdge', 'gunnerEmpIncendiary'],
    });
    expect(state.credits).toBe(65);
    expect(state.talents).toEqual(['bladeThrowEdge', 'gunnerEmpIncendiary']);
  });

  it('startuje z podniesionym zdrowiem, gdy talent podnosi maxHealth', () => {
    expect(manager().newRun('t', 'classic').hp).toBe(100);
    expect(
      manager().newRun('t', 'classic', { talents: ['bladeServoFrame'] }).hp,
    ).toBe(115);
    expect(
      manager().newRun('t', 'classic', {
        talents: ['bladeServoFrame', 'hybridApexProtocol'],
        baseMaxHealth: 80,
      }).hp,
    ).toBe(100 + 15 + 20);
  });

  it('odrzuca nieznany talent', () => {
    expect(() =>
      manager().newRun('t', 'classic', { talents: ['nope'] }),
    ).toThrow('Nieznany talent');
  });
});

describe('talenty w pokoju', () => {
  const idle: InputSnapshot = {
    held: new Set(),
    pressed: new Set(),
    released: new Set(),
    lookDelta: { x: 0, y: 0 },
  };
  const active = new Set<RoomScene>();

  afterEach(() => {
    for (const scene of active) scene.dispose();
    active.clear();
  });

  function runState(talents: string[], hp = 100): RunState {
    return {
      seed: 'room-talents',
      sectorId: 'test',
      loadoutId: 'resonance',
      loadout: loadoutDefinitions.get('resonance')!,
      talents,
      threatLevel: 0,
      startedAtMs: 0,
      elapsedS: 0,
      map: {
        sectorId: 'test',
        layers: [
          [{ id: 'node', layer: 2, index: 0, type: 'combat', next: [] }],
        ],
      },
      currentNodeId: 'node',
      visited: [],
      hp,
      energy: 100,
      credits: 0,
      implants: [],
      stats: { kills: 0, damage: { melee: 0, power: 0, gun: 0, other: 0 } },
    };
  }

  async function setup(talents: string[], hp = 100) {
    const run = runState(talents, hp);
    const room = roomDefinitions.get('combatYard')!;
    const waves = loadWaves({
      ...wavesData,
      maxAlive: 8,
      spawnPoints: room.spawnPoints,
    });
    const scene = new RoomScene(room, run, waves, { loadModels: false });
    const commands = new CommandRegistry();
    const bus = new EventBus();
    await scene.init(
      {
        bus,
        commands,
        rng: new Rng(run.seed).fork('room:node'),
        loop: new GameLoop({ step() {}, render() {} }),
        tuning: structuredClone(tuning),
        debug: false,
      },
      new ThreeScene(),
    );
    active.add(scene);
    return { scene, commands, bus };
  }

  it('Podwójny skok można kupić za pierwszy punkt; daje extraJumps w pokoju i kosztuje wytrzymałość', async () => {
    const meta = new MetaManager(createStarterMetaState());
    meta.debugAddXp(defaultMetaRules.progression.levels.xpToNext[0]!);
    expect(meta.freePoints).toBe(1);
    meta.buyTalent('hybridDoubleJump');
    expect(meta.freePoints).toBe(0);
    expect(meta.spentInTree('blade')).toBe(0);
    expect(meta.spentInTree('resonance')).toBe(0);
    expect(meta.spentInTree('gunner')).toBe(0);
    const { scene, bus } = await setup(meta.state.talents);
    expect(scene.query('extraJumps')).toBe(1);
    expect(scene.query('stamina')).toBe(100);
    for (let i = 0; i < 10; i++) scene.step(SIM_DT, idle);
    const jumps: boolean[] = [];
    bus.on('player_jumped', ({ double }) => jumps.push(double));
    const jump = { ...idle, pressed: new Set(['jump'] as const) };
    scene.step(SIM_DT, jump);
    scene.step(SIM_DT, jump);
    expect(jumps).toEqual([false, true]);
    expect(scene.query('stamina')).toBe(75);
    expect(scene.exportState()).not.toHaveProperty('stamina');
    const next = await setup(meta.state.talents);
    expect(next.scene.query('stamina')).toBe(100);
  });

  it('bez talentów synergia bladeDancer jest nieaktywna', async () => {
    const { scene } = await setup([]);
    expect(scene.query('talents')).toEqual([]);
    expect(scene.query('extraJumps')).toBe(0);
    expect(scene.query('synergies')).not.toContain('bladeDancer');
  });

  it('korzenie Ostrza i Rezonansu włączają synergię bladeDancer', async () => {
    const { scene } = await setup(['bladeRoot', 'resonanceRoot']);
    expect(scene.query('talents')).toEqual(['bladeRoot', 'resonanceRoot']);
    expect(scene.query('synergies')).toContain('bladeDancer');
  });

  it('modyfikatory talentu działają, a łatki talentów trafiają do ekwipunku', async () => {
    const { scene } = await setup(['bladeServoFrame', 'resonanceChainSplit']);
    expect(scene.query('playerMaxHp')).toBe(115);
    // pokój startuje z run.hp, bez doliczania premii z talentów
    expect(scene.query('playerHp')).toBe(100);
    const resolved = scene.query('resolvedLoadout') as {
      powers: { id: string; jumps?: number }[];
    };
    expect(resolved.powers.find((p) => p.id === 'chain')?.jumps).toBe(4);
  });

  it('talent <id> i talent reset działają na żywo', async () => {
    const { scene, commands } = await setup([]);
    expect(scene.query('playerMaxHp')).toBe(100);
    expect(commands.execute('talent bladeServoFrame')).toContain('Dodano');
    expect(scene.query('playerMaxHp')).toBe(115);
    expect(scene.query('playerHp')).toBe(115);
    expect(commands.execute('talent bladeServoFrame')).toContain('już aktywny');
    commands.execute('talent bladeRoot');
    commands.execute('talent resonanceRoot');
    expect(scene.query('synergies')).toContain('bladeDancer');
    expect(commands.execute('talent nope')).toContain('Podaj znany talent');
    expect(commands.execute('talent reset')).toContain('wyczyszczone');
    expect(scene.query('talents')).toEqual([]);
    expect(scene.query('playerMaxHp')).toBe(100);
    expect(scene.query('synergies')).not.toContain('bladeDancer');
    scene.step(SIM_DT, idle);
  });
});
