import { basename } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Scene as ThreeScene } from 'three';
import { Health } from '../../src/combat/damage';
import { EventBus, type GameEvents } from '../../src/core/events';
import { GameLoop } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { RARITIES, type RunState } from '../../src/core/runTypes';
import { computeStat, Stats } from '../../src/core/stats';
import { tuning } from '../../src/core/tuning';
import {
  implantDefinitions,
  implantSchema,
  implantSource,
  ImplantSystem,
  loadImplant,
  loadImplantDefinitions,
  nextRarity,
} from '../../src/progression/implants';
import { RoomScene } from '../../src/scenes/roomScene';
import { CommandRegistry } from '../../src/ui/debugCommands';
import { roomDefinitions } from '../../src/world/rooms';
import { loadWaves } from '../../src/world/waves';
import wavesData from '../../src/data/waves/roomTest.json';

const rawImplantFiles = import.meta.glob('../../src/data/implants/*.json', {
  eager: true,
  import: 'default',
});

const FORBIDDEN_PATTERNS = [
  /\bjedi\b/i,
  /\bsith\b/i,
  /lightsaber/i,
  /\bthe force\b/i,
  /superhot/i,
];

describe('implantSchema i loadImplantDefinitions', () => {
  it('przyjmuje poprawną definicję implantu i wylicza kolejną rzadkość', () => {
    expect(nextRarity('common')).toBe('rare');
    expect(nextRarity('rare')).toBe('epic');
    expect(nextRarity('epic')).toBe('legendary');
    expect(nextRarity('legendary')).toBeNull();

    const parsed = loadImplant({
      id: 'overclock',
      name: 'Przetaktowanie rdzenia',
      description: 'Podkręcony koprocesor walki.',
      rarity: 'rare',
      tags: ['#melee', '#power'],
      modifiers: [
        { stat: 'damage', type: 'percent', value: 0.15 },
        { stat: 'maxHealth', type: 'flat', value: 20 },
      ],
      triggers: [
        {
          when: { event: 'parry_success' },
          effects: [{ kind: 'add_energy', amount: 8 }],
          cooldownS: 1.5,
        },
      ],
      upgradesTo: 'overclockPlus',
    });
    expect(parsed.id).toBe('overclock');
    expect(parsed.upgradesTo).toBe('overclockPlus');
  });

  it('odrzuca nieznany stat, tag bez #, błędną rzadkość i błędny wyzwalacz', () => {
    const valid = {
      id: 'testImp',
      name: 'Testowy implant',
      rarity: 'common',
      tags: ['#melee'],
      modifiers: [{ stat: 'damage', type: 'percent', value: 0.1 }],
    };

    expect(() =>
      implantSchema.parse({
        ...valid,
        modifiers: [{ stat: 'mana', type: 'flat', value: 10 }],
      }),
    ).toThrow();

    expect(() =>
      implantSchema.parse({
        ...valid,
        tags: ['melee'],
      }),
    ).toThrow();

    expect(() =>
      implantSchema.parse({
        ...valid,
        rarity: 'mythic',
      }),
    ).toThrow();

    expect(() =>
      implantSchema.parse({
        ...valid,
        triggers: [
          {
            when: { event: 'parry_success', tagsAny: ['#melee'] },
            effects: [{ kind: 'add_energy', amount: 5 }],
          },
        ],
      }),
    ).toThrow(/tagsAny/);

    expect(() =>
      implantSchema.parse({
        ...valid,
        triggers: [
          {
            when: { event: 'power_used' },
            effects: [
              {
                kind: 'chain_on_hit',
                jumpRangeM: 4,
                damageMult: 0.5,
                tags: ['#elektrycznosc'],
              },
            ],
          },
        ],
      }),
    ).toThrow(/chain_on_hit/);
  });

  it('odrzuca upgradesTo o złej rzadkości, dla legendary, do samego siebie oraz powtórzone id', () => {
    const base = {
      id: 'tier1',
      name: 'Stopień 1',
      rarity: 'common' as const,
      tags: ['#melee'],
      modifiers: [
        { stat: 'damage' as const, type: 'percent' as const, value: 0.1 },
      ],
    };

    // Legendary nie ma wyższej rzadkości
    expect(() =>
      loadImplant({
        ...base,
        rarity: 'legendary',
        upgradesTo: 'anything',
      }),
    ).toThrow(/upgradesTo/);

    // Sam do siebie
    expect(() =>
      loadImplant({
        ...base,
        upgradesTo: 'tier1',
      }),
    ).toThrow(/upgradesTo/);

    // Pojedyncza walidacja względem załadowanych implantów: common -> epic (overclockPlus)
    expect(() =>
      loadImplant({
        ...base,
        rarity: 'common',
        upgradesTo: 'overclockPlus',
      }),
    ).toThrow(/upgradesTo/);

    // Pojedyncza walidacja: epic -> rare (overclock)
    expect(() =>
      loadImplant({
        ...base,
        rarity: 'epic',
        upgradesTo: 'overclock',
      }),
    ).toThrow(/upgradesTo/);

    // Walidacja kolekcji: common -> epic
    expect(() =>
      loadImplantDefinitions([
        { ...base, id: 'a', rarity: 'common', upgradesTo: 'b' },
        { ...base, id: 'b', rarity: 'epic' },
      ]),
    ).toThrow(/upgradesTo/);

    // Walidacja kolekcji: rare -> rare
    expect(() =>
      loadImplantDefinitions([
        { ...base, id: 'a', rarity: 'rare', upgradesTo: 'b' },
        { ...base, id: 'b', rarity: 'rare' },
      ]),
    ).toThrow(/upgradesTo/);

    // Walidacja kolekcji: brak celu upgradesTo
    expect(() =>
      loadImplantDefinitions([
        { ...base, id: 'a', rarity: 'common', upgradesTo: 'missingTarget' },
      ]),
    ).toThrow(/upgradesTo/);

    // Walidacja kolekcji: powtórzone id
    expect(() => loadImplantDefinitions([base, base])).toThrow(
      /Powtórzone id implantu/,
    );
  });
});

describe('Pliki danych src/data/implants/*.json', () => {
  it('ładuje ≥ 18 implantów, pokrywa wszystkie rzadkości i ścieżki oraz łańcuchy upgradesTo', () => {
    const entries = Object.entries(rawImplantFiles);
    expect(entries.length).toBeGreaterThanOrEqual(18);
    expect(implantDefinitions.size).toBe(entries.length);

    for (const [path, raw] of entries) {
      const fileId = basename(path, '.json');
      const parsed = loadImplant(raw);
      expect(parsed.id).toBe(fileId);
    }

    for (const rarity of RARITIES) {
      const ofRarity = [...implantDefinitions.values()].filter(
        (def) => def.rarity === rarity,
      );
      expect(ofRarity.length).toBeGreaterThanOrEqual(4);
    }

    for (const pathTag of ['#melee', '#power', '#gun'] as const) {
      const ofPath = [...implantDefinitions.values()].filter((def) =>
        def.tags.includes(pathTag),
      );
      expect(ofPath.length).toBeGreaterThanOrEqual(6);
      for (const rarity of RARITIES) {
        expect(
          ofPath.some((def) => def.rarity === rarity),
          `Brak implantu ze ścieżki ${pathTag} o rzadkości ${rarity}`,
        ).toBe(true);
      }
    }

    // Sprawdzenie łańcuchów upgradesTo (brak cykli, zawsze następna rzadkość)
    const withUpgrade = [...implantDefinitions.values()].filter(
      (def) => def.upgradesTo !== undefined,
    );
    expect(withUpgrade.length).toBeGreaterThanOrEqual(12);
    for (const def of implantDefinitions.values()) {
      const seen = new Set<string>([def.id]);
      let current = def;
      while (current.upgradesTo !== undefined) {
        expect(seen.has(current.upgradesTo)).toBe(false);
        seen.add(current.upgradesTo);
        const next = implantDefinitions.get(current.upgradesTo);
        expect(next).toBeDefined();
        expect(next!.rarity).toBe(nextRarity(current.rarity));
        current = next!;
      }
    }
  });

  it('każdy implant ma polską nazwę i opis oraz nie zawiera nazw chronionych', () => {
    for (const def of implantDefinitions.values()) {
      expect(def.name.trim().length).toBeGreaterThan(2);
      expect(def.description?.trim().length ?? 0).toBeGreaterThan(10);
      // Polskie znaki diakrytyczne lub polskie słowa w nazwie/opisie
      const combined = `${def.name} ${def.description ?? ''}`;
      expect(combined).toMatch(
        /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]|rdzenia|energii|ostrza|broni/i,
      );
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(combined).not.toMatch(pattern);
        expect(def.id).not.toMatch(pattern);
      }
    }
  });
});

describe('ImplantSystem — Stats, zdrowie, unikalność, ulepszenia', () => {
  it('zakłada i zdejmuje modyfikatory po źródle implant:<id> na obu instancjach Stats', () => {
    const combatStats = new Stats({
      maxHealth: 100,
      damage: 1,
      attackSpeed: 1,
      maxEnergy: 100,
    });
    const moveStats = new Stats({
      moveSpeed: 8,
      dashCooldown: 1,
    });
    const system = new ImplantSystem([combatStats, moveStats]);

    expect(system.add('servoTendonsRare')).toBe(true);
    expect(system.has('servoTendonsRare')).toBe(true);
    expect(system.ids()).toEqual(['servoTendonsRare']);

    const source = implantSource('servoTendonsRare');
    expect(combatStats.modifiers().every((m) => m.source === source)).toBe(
      true,
    );
    expect(moveStats.modifiers().every((m) => m.source === source)).toBe(true);
    expect(combatStats.get('attackSpeed')).toBeCloseTo(1.18);
    expect(moveStats.get('moveSpeed')).toBeCloseTo(8 * 1.08);
    expect(moveStats.get('dashCooldown')).toBeCloseTo(0.9);

    // Inny modyfikator spoza implantu nie zostaje usunięty
    moveStats.add({
      stat: 'dashCooldown',
      type: 'mult',
      value: 0.5,
      source: 'synergy:bladeDancer',
    });
    expect(moveStats.get('dashCooldown')).toBeCloseTo(0.45);

    expect(system.remove('servoTendonsRare')).toBe(true);
    expect(system.has('servoTendonsRare')).toBe(false);
    expect(combatStats.modifiers()).toHaveLength(0);
    expect(combatStats.get('attackSpeed')).toBe(1);
    expect(moveStats.get('moveSpeed')).toBe(8);
    expect(moveStats.get('dashCooldown')).toBeCloseTo(0.5);
    expect(system.remove('servoTendonsRare')).toBe(false);
  });

  it('kumuluje dwa implanty zgodnie z computeStat i odrzuca duplikaty', () => {
    const combatStats = new Stats({
      maxHealth: 100,
      damage: 1,
      damageTaken: 1,
    });
    const moveStats = new Stats({ moveSpeed: 10 });
    const bus = new EventBus();
    const acquired: GameEvents['implant_acquired'][] = [];
    bus.on('implant_acquired', (e) => acquired.push(e));

    const system = new ImplantSystem([combatStats, moveStats], { bus });

    expect(system.add('subdermalWeaveRare', 'reward')).toBe(true);
    expect(system.add('overclock', 'shop')).toBe(true);
    // Duplikat odrzucony
    expect(system.add('overclock', 'reward')).toBe(false);

    expect(acquired).toEqual([
      { id: 'subdermalWeaveRare', rarity: 'rare', source: 'reward' },
      { id: 'overclock', rarity: 'rare', source: 'shop' },
    ]);

    const expectedMaxHp = computeStat(100, combatStats.modifiers('maxHealth'));
    const expectedDamage = computeStat(1, combatStats.modifiers('damage'));
    expect(expectedMaxHp).toBe(155); // 100 + 35 + 20
    expect(combatStats.get('maxHealth')).toBe(expectedMaxHp);
    expect(expectedDamage).toBeCloseTo(1.25); // 1 * (1 + 0.10 + 0.15)
    expect(combatStats.get('damage')).toBeCloseTo(expectedDamage);
    expect(combatStats.get('damageTaken')).toBeCloseTo(0.92);

    // Tagi zachowują krotność wystąpień (#melee występuje w obu implantach)
    expect(system.tags()).toEqual(['#melee', '#melee', '#power', '#gun']);
  });

  it('wzrost maxHealth (flat i percent) dodaje różnicę do bieżącego zdrowia, a zdjęcie przycina do max', () => {
    const customDefs = loadImplantDefinitions([
      {
        id: 'flatHp',
        name: 'Płytka pancerza',
        description: 'Dodatkowe poszycie zwiększa zdrowie.',
        rarity: 'common',
        tags: ['#melee'],
        modifiers: [{ stat: 'maxHealth', type: 'flat', value: 20 }],
      },
      {
        id: 'pctHp',
        name: 'Wzmacniacz tkankowy',
        description: 'Procentowe wzmocnienie maksymalnego zdrowia.',
        rarity: 'rare',
        tags: ['#melee'],
        modifiers: [{ stat: 'maxHealth', type: 'percent', value: 0.25 }],
      },
    ]);

    const stats = new Stats({ maxHealth: 100 });
    const health = new Health(() => stats.get('maxHealth'));
    health.set(70);

    const system = new ImplantSystem(stats, {
      health,
      definitions: customDefs,
    });

    // +20 flat: max 100 -> 120 (+20), current 70 -> 90
    expect(system.add('flatHp')).toBe(true);
    expect(stats.get('maxHealth')).toBe(120);
    expect(health.current).toBe(90);

    // +25% percent: max 120 -> 150 (+30), current 90 -> 120
    expect(system.add('pctHp')).toBe(true);
    expect(stats.get('maxHealth')).toBe(150);
    expect(health.current).toBe(120);

    // Zdjęcie obu po wyleczeniu do pełna przycina zdrowie do nowego max (100)
    health.set(150);
    system.remove('pctHp');
    expect(health.current).toBe(120);
    system.remove('flatHp');
    expect(health.current).toBe(100);
  });

  it('ulepsza implant przez upgradesTo, dodaje tylko różnicę maxHealth, pilnuje unikalności i emituje implant_acquired', () => {
    const combatStats = new Stats({ maxHealth: 100, damage: 1 });
    const moveStats = new Stats({ moveSpeed: 10 });
    const health = new Health(() => combatStats.get('maxHealth'));
    health.set(80);
    const bus = new EventBus();
    const acquired: GameEvents['implant_acquired'][] = [];
    bus.on('implant_acquired', (e) => acquired.push(e));

    const system = new ImplantSystem([combatStats, moveStats], {
      health,
      bus,
    });

    // subdermalWeave (+20 HP, +6% dmg) -> subdermalWeaveRare (+35 HP, +10% dmg, 0.92 dmgTaken)
    system.add('subdermalWeave');
    expect(combatStats.get('maxHealth')).toBe(120);
    expect(health.current).toBe(100); // 80 + 20

    expect(system.canUpgrade('subdermalWeave')).toBe(true);
    expect(system.upgrade('subdermalWeave')).toBe(true);

    expect(system.ids()).toEqual(['subdermalWeaveRare']);
    expect(
      combatStats
        .modifiers()
        .some((m) => m.source === 'implant:subdermalWeave'),
    ).toBe(false);
    expect(combatStats.get('maxHealth')).toBe(135);
    // Różnica między +20 a +35 to +15 -> 100 + 15 = 115
    expect(health.current).toBe(115);
    expect(acquired.at(-1)).toEqual({
      id: 'subdermalWeaveRare',
      rarity: 'rare',
      source: 'upgrade',
    });

    // Gdy docelowy implant z łańcucha jest już posiadany, ulepszenie jest zablokowane (unikalność)
    system.add('subdermalWeaveEpic');
    expect(system.canUpgrade('subdermalWeaveRare')).toBe(false);
    expect(system.upgrade('subdermalWeaveRare')).toBe(false);

    // Legendary nie ma upgradesTo
    system.add('subdermalWeaveApex');
    expect(system.canUpgrade('subdermalWeaveApex')).toBe(false);
    expect(system.upgrade('subdermalWeaveApex')).toBe(false);
  });

  it('set(ids) podmienia zestaw implantów, zwraca ich tagi i odrzuca nieznane id bez psucia stanu', () => {
    const stats = new Stats({ maxHealth: 100, maxEnergy: 100 });
    const system = new ImplantSystem(stats);

    const tags = system.set([
      'cortexCapacitor',
      'cryoVents',
      'cortexCapacitor',
    ]);
    expect(system.ids()).toEqual(['cortexCapacitor', 'cryoVents']);
    expect(tags).toEqual(['#power', '#gun']);
    expect(stats.get('maxEnergy')).toBe(120);

    expect(() => system.set(['missingImplant'])).toThrow(/Nieznany implant/);
    // Poprzedni stan pozostaje nienaruszony po błędzie walidacji
    expect(system.ids()).toEqual(['cortexCapacitor', 'cryoVents']);
    expect(stats.get('maxEnergy')).toBe(120);
  });
});

describe('RoomScene — integracja ImplantSystem i komendy implant <id>', () => {
  it('komenda implant <id> nakłada implant w pokoju, zmienia maxHealth w query(playerHp) i odrzuca duplikat', async () => {
    const room = roomDefinitions.get('combatYard')!;
    const waves = loadWaves({ ...wavesData, spawnPoints: room.spawnPoints });
    const run: RunState = {
      seed: 'implant-room-test',
      sectorId: 'test',
      loadoutId: 'classic',
      startedAtMs: 0,
      elapsedS: 0,
      map: {
        sectorId: 'test',
        layers: [
          [{ id: 'node', layer: 1, index: 0, type: 'combat', next: [] }],
        ],
      },
      currentNodeId: 'node',
      visited: [],
      hp: 100,
      energy: 100,
      credits: 0,
      implants: ['servoTendons'],
      stats: { kills: 0, damage: { melee: 0, power: 0, gun: 0, other: 0 } },
    };

    const bus = new EventBus();
    const acquired: GameEvents['implant_acquired'][] = [];
    bus.on('implant_acquired', (e) => acquired.push(e));
    const commands = new CommandRegistry();
    const scene = new RoomScene(room, run, waves, { loadModels: false });

    try {
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

      expect(scene.query('implants')).toEqual(['servoTendons']);
      expect(scene.query('playerHp')).toBe(100);

      const out = commands.execute('implant subdermalWeave');
      expect(out).toContain('Dodano implant');
      expect(scene.query('implants')).toEqual([
        'servoTendons',
        'subdermalWeave',
      ]);
      expect(scene.query('playerHp')).toBe(120);
      expect(scene.query('playerMaxHp')).toBe(120);
      expect(acquired).toEqual([
        { id: 'subdermalWeave', rarity: 'common', source: 'reward' },
      ]);

      // Duplikat odrzucony
      expect(commands.execute('implant subdermalWeave')).toContain(
        'Implant już posiadany',
      );
      expect(scene.query('playerHp')).toBe(120);

      // Nieznany implant
      expect(commands.execute('implant nieznany')).toContain(
        'Podaj znany implant',
      );
    } finally {
      scene.dispose();
    }
  });
});
