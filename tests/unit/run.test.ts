import { describe, expect, it, vi } from 'vitest';
import { loadoutDefinitions } from '../../src/progression/loadout';
import { EventBus, type GameEvents } from '../../src/core/events';
import type { SectorMap } from '../../src/core/runTypes';
import { RunManager, runStateSchema } from '../../src/world/run';

/**
 * Deterministyczna 8-warstwowa mapa testowa sektora Kurogane Arms
 * (generator z zadania F3-02 powstaje równolegle i jest wstrzykiwany).
 */
function createTestMap(seed: string): SectorMap {
  return {
    sectorId: `kurogane-${seed}`,
    layers: [
      [
        {
          id: 'L1N0',
          layer: 1,
          index: 0,
          type: 'combat',
          next: ['L2N0', 'L2N1'],
        },
        { id: 'L1N1', layer: 1, index: 1, type: 'combat', next: ['L2N1'] },
      ],
      [
        { id: 'L2N0', layer: 2, index: 0, type: 'elite', next: ['L3N0'] },
        { id: 'L2N1', layer: 2, index: 1, type: 'shop', next: ['L3N1'] },
      ],
      [
        { id: 'L3N0', layer: 3, index: 0, type: 'puzzle', next: ['L4N0'] },
        { id: 'L3N1', layer: 3, index: 1, type: 'combat', next: ['L4N0'] },
      ],
      [{ id: 'L4N0', layer: 4, index: 0, type: 'combat', next: ['L5N0'] }],
      [{ id: 'L5N0', layer: 5, index: 0, type: 'elite', next: ['L6N0'] }],
      [{ id: 'L6N0', layer: 6, index: 0, type: 'shop', next: ['L7N0'] }],
      [{ id: 'L7N0', layer: 7, index: 0, type: 'rest', next: ['L8N0'] }],
      [{ id: 'L8N0', layer: 8, index: 0, type: 'boss', next: [] }],
    ],
  };
}

describe('RunManager (F3-05)', () => {
  it.each([
    { talents: [], maxHealth: 140 },
    { talents: ['bladeRoot', 'bladeServoFrame'], maxHealth: 155 },
  ])(
    'nowy run ma pełne maxHealth $maxHealth mimo initialHp 100',
    ({ talents, maxHealth }) => {
      const manager = new RunManager(new EventBus(), createTestMap, {
        initialHp: 100,
      });
      try {
        const state = manager.newRun('full-health', 'blade', {
          baseMaxHealth: 140,
          talents,
        });
        expect(state.hp).toBe(maxHealth);
      } finally {
        manager.dispose();
      }
    },
  );

  it('inicjalizuje nowy run, ustawia ekran map i emituje run_started', () => {
    const bus = new EventBus();
    const started: string[] = [];
    bus.on('run_started', ({ seed }) => started.push(seed));

    const manager = new RunManager(bus, createTestMap, {
      now: () => 1700000000000,
    });
    const state = manager.newRun('alpha', 'blade');

    expect(started).toEqual(['alpha']);
    expect(manager.screen).toBe('map');
    expect(manager.active).toBe(true);
    expect(manager.currentNode).toBeNull();
    expect(state).toEqual({
      seed: 'alpha',
      sectorId: 'kurogane-alpha',
      loadoutId: 'blade',
      loadout: loadoutDefinitions.get('blade'),
      talents: [],
      threatLevel: 0,
      startedAtMs: 1700000000000,
      elapsedS: 0,
      map: createTestMap('alpha'),
      currentNodeId: null,
      visited: [],
      hp: 100,
      energy: 100,
      credits: 0,
      implants: [],
      stats: {
        kills: 0,
        damage: { melee: 0, power: 0, gun: 0, other: 0 },
      },
    });
    expect(manager.availableNodes().map((n) => n.id)).toEqual(['L1N0', 'L1N1']);
  });

  it('odrzuca niedozwolone przejścia węzłów i ekranów', () => {
    const bus = new EventBus();
    const selected: GameEvents['node_selected'][] = [];
    bus.on('node_selected', (payload) => selected.push(payload));

    const manager = new RunManager(bus, createTestMap);
    manager.newRun('beta', 'classic');

    // Na starcie można wybrać tylko węzeł z warstwy 1
    expect(manager.canSelectNode('L2N0')).toBe(false);
    expect(manager.selectNode('L2N0')).toBe(false);
    expect(manager.selectNode('unknown')).toBe(false);
    expect(manager.screen).toBe('map');
    expect(selected).toHaveLength(0);

    // Nie można zakończyć pokoju ani wrócić na mapę będąc na mapie
    expect(manager.completeRoom()).toBe(false);
    expect(manager.returnToMap()).toBe(false);

    // Poprawny wybór z warstwy 1: L1N1 (prowadzi tylko do L2N1)
    expect(manager.selectNode('L1N1')).toBe(true);
    expect(manager.screen).toBe('room');
    expect(manager.currentNode?.id).toBe('L1N1');
    expect(selected).toEqual([{ nodeId: 'L1N1', type: 'combat' }]);

    // W trakcie pokoju nie można wybrać kolejnego węzła ani wrócić na mapę bez completeRoom
    expect(manager.availableNodes()).toEqual([]);
    expect(manager.selectNode('L2N1')).toBe(false);
    expect(manager.returnToMap()).toBe(false);

    // Po wyczyszczeniu pokoju combat trafiamy na ekran reward
    expect(manager.completeRoom()).toBe(true);
    expect(manager.screen).toBe('reward');
    expect(manager.completeRoom()).toBe(false);
    expect(manager.selectNode('L2N1')).toBe(false);
    expect(manager.leaveShop()).toBe(false);
    expect(manager.leaveRest()).toBe(false);

    // Powrót na mapę z ekranu nagrody
    expect(manager.completeReward()).toBe(true);
    expect(manager.screen).toBe('map');

    // Z L1N1 jedynym sąsiadem w next jest L2N1 — wybór L2N0 musi zostać odrzucony
    expect(manager.availableNodes().map((n) => n.id)).toEqual(['L2N1']);
    expect(manager.canSelectNode('L2N0')).toBe(false);
    expect(manager.selectNode('L2N0')).toBe(false);
    expect(manager.canSelectNode('L2N1')).toBe(true);
    expect(manager.selectNode('L2N1')).toBe(true);
    expect(manager.screen).toBe('room');
  });

  it('prowadzi maszynę ekranów przez wszystkie typy węzłów aż do zwycięstwa z bossem', () => {
    const bus = new EventBus();
    const ended: GameEvents['run_ended'][] = [];
    bus.on('run_ended', (payload) => ended.push(payload));

    const manager = new RunManager(bus, createTestMap, {
      eliteBonusCredits: 25,
      puzzleCredits: 60,
    });
    manager.newRun('full-path', 'resonance');

    // Warstwa 1: combat -> reward -> map
    expect(manager.selectNode('L1N0')).toBe(true);
    expect(manager.completeRoom({ hp: 85, energy: 70 })).toBe(true);
    expect(manager.screen).toBe('reward');
    expect(manager.returnToMap()).toBe(true);
    expect(manager.screen).toBe('map');

    // Warstwa 2: elite -> reward (+bonus kredytów) -> map
    expect(manager.selectNode('L2N0')).toBe(true);
    expect(manager.completeRoom()).toBe(true);
    expect(manager.screen).toBe('reward');
    expect(manager.state.credits).toBe(25);
    expect(manager.returnToMap()).toBe(true);

    // Warstwa 3: puzzle -> bezpośrednio map (+puzzleCredits)
    expect(manager.selectNode('L3N0')).toBe(true);
    expect(manager.completeRoom()).toBe(true);
    expect(manager.screen).toBe('map');
    expect(manager.state.credits).toBe(85);

    // Warstwa 4: combat -> reward -> map
    expect(manager.selectNode('L4N0')).toBe(true);
    expect(manager.completeRoom()).toBe(true);
    expect(manager.returnToMap()).toBe(true);

    // Warstwa 5: elite -> reward -> map
    expect(manager.selectNode('L5N0')).toBe(true);
    expect(manager.completeRoom()).toBe(true);
    expect(manager.returnToMap()).toBe(true);

    // Warstwa 6: shop -> shop -> map
    expect(manager.selectNode('L6N0')).toBe(true);
    expect(manager.completeRoom()).toBe(true);
    expect(manager.screen).toBe('shop');
    expect(manager.leaveShop()).toBe(true);
    expect(manager.screen).toBe('map');

    // Warstwa 7: rest -> rest -> map
    expect(manager.selectNode('L7N0')).toBe(true);
    expect(manager.completeRoom()).toBe(true);
    expect(manager.screen).toBe('rest');
    expect(manager.leaveRest()).toBe(true);
    expect(manager.screen).toBe('map');

    // Warstwa 8: boss -> summary (zwycięstwo)
    expect(manager.selectNode('L8N0')).toBe(true);
    expect(manager.completeRoom()).toBe(true);
    expect(manager.screen).toBe('summary');
    expect(manager.active).toBe(false);
    expect(ended).toHaveLength(1);
    expect(ended[0]?.outcome).toBe('victory');
    expect(ended[0]?.summary.roomsCleared).toBe(8);
    expect(ended[0]?.summary.layerReached).toBe(8);
  });

  it('nalicza i wydaje Kredyty, emituje currency_changed i odrzuca wydatki ponad stan', () => {
    const bus = new EventBus();
    const events: GameEvents['currency_changed'][] = [];
    bus.on('currency_changed', (payload) => events.push(payload));

    const manager = new RunManager(bus, createTestMap, {
      creditsPerThreat: 5,
    });
    manager.newRun('economy', 'gunner');

    // Zabójstwo szturmowca (threatCost = 1) i strzelca (1.5 -> round(7.5) = 8)
    expect(manager.creditKill(1)).toBe(5);
    expect(manager.creditKill(1.5)).toBe(8);
    expect(manager.creditKill(0)).toBe(0);
    expect(manager.creditKill(-2)).toBe(0);
    expect(manager.state.credits).toBe(13);

    // Dodanie Kredytów jawnie
    expect(manager.addCredits(37)).toBe(true);
    expect(manager.addCredits(0)).toBe(false);
    expect(manager.addCredits(-10)).toBe(false);
    expect(manager.state.credits).toBe(50);

    // Wydanie ponad stan i niepoprawne kwoty są odrzucane bez emisji zdarzenia
    expect(manager.spendCredits(51)).toBe(false);
    expect(manager.spendCredits(0)).toBe(false);
    expect(manager.spendCredits(-5)).toBe(false);
    expect(manager.state.credits).toBe(50);

    // Poprawny zakup
    expect(manager.spendCredits(30)).toBe(true);
    expect(manager.state.credits).toBe(20);
    expect(manager.spendCredits(20)).toBe(true);
    expect(manager.state.credits).toBe(0);
    expect(manager.spendCredits(1)).toBe(false);

    expect(events).toEqual([
      { currency: 'credits', amount: 5, delta: 5 },
      { currency: 'credits', amount: 13, delta: 8 },
      { currency: 'credits', amount: 50, delta: 37 },
      { currency: 'credits', amount: 20, delta: -30 },
      { currency: 'credits', amount: 0, delta: -20 },
    ]);
  });

  it('serializacja -> restore daje identyczny stan (toEqual) i pozwala kontynuować run', () => {
    const bus = new EventBus();
    const manager = new RunManager(bus, createTestMap, {
      now: () => 1700000123456,
    });
    manager.newRun('save-seed', 'bladeDancer');
    manager.selectNode('L1N0');
    manager.step(42.5);
    manager.creditKill(2.5);
    manager.addImplant('overclock');
    manager.addImplant('capacitor');
    manager.upgradeImplant('overclock', 'overclockPlus');
    bus.emit('damage_dealt', {
      source: 1,
      target: 2,
      amount: 120,
      tags: ['#melee'],
      point: null,
      dir: null,
      knockback: 0,
      killed: true,
    });
    bus.emit('enemy_killed', { id: 2, killer: 1, tags: ['#melee'] });
    manager.completeRoom({ hp: 64, energy: 55 });
    manager.returnToMap();

    const snapshot = manager.serialize();
    const jsonRoundTrip = JSON.parse(JSON.stringify(snapshot));

    const started: string[] = [];
    bus.on('run_started', ({ seed }) => started.push(seed));

    const restored = new RunManager(bus, createTestMap);
    const restoredState = restored.restore(jsonRoundTrip);

    expect(restoredState).toEqual(snapshot);
    expect(restored.serialize()).toEqual(snapshot);
    expect(restored.state).toEqual(snapshot);
    expect(restored.screen).toBe('map');
    expect(started).toEqual(['save-seed']);

    // Po wczytaniu dostępne są dokładnie węzły z next ostatniego węzła (L1N0 -> L2N0, L2N1)
    expect(restored.availableNodes().map((n) => n.id)).toEqual([
      'L2N0',
      'L2N1',
    ]);
    expect(restored.selectNode('L1N0')).toBe(false);
    expect(restored.selectNode('L2N0')).toBe(true);

    // Schemat odrzuca duplikaty implantów i nieznany węzeł
    expect(() =>
      runStateSchema.parse({
        ...snapshot,
        implants: ['a', 'a'],
      }),
    ).toThrow();
    expect(() =>
      runStateSchema.parse({
        ...snapshot,
        currentNodeId: 'L99N9',
      }),
    ).toThrow();
  });

  it('zbiera czas, zabójstwa i obrażenia wg ścieżki ze strumienia zdarzeń oraz kończy run na player_died', () => {
    const bus = new EventBus();
    const ended: GameEvents['run_ended'][] = [];
    bus.on('run_ended', (payload) => ended.push(payload));

    const manager = new RunManager(bus, createTestMap);
    manager.newRun('stats-seed', 'stormGunner');

    // Pokój 1: wyczyszczony
    manager.selectNode('L1N0');
    bus.emit('entity_spawned', { id: 1, kind: 'player' });
    bus.emit('entity_spawned', { id: 10, kind: 'assaulter' });
    bus.emit('entity_spawned', { id: 11, kind: 'gunner' });

    manager.step(15);
    manager.step(0); // hitstop — nie zwiększa czasu

    // Obrażenia gracza na trzech ścieżkach + status (other)
    bus.emit('damage_dealt', {
      source: 1,
      target: 10,
      amount: 45,
      tags: ['#melee', '#heavy'],
      point: null,
      dir: null,
      knockback: 0,
      killed: false,
    });
    bus.emit('damage_dealt', {
      source: 1,
      target: 10,
      amount: 30,
      tags: ['#power', '#elektrycznosc'],
      point: null,
      dir: null,
      knockback: 0,
      killed: true,
    });
    bus.emit('enemy_killed', { id: 10, killer: 1, tags: ['#power'] });

    bus.emit('damage_dealt', {
      source: 1,
      target: 11,
      amount: 60,
      tags: ['#gun'],
      point: null,
      dir: null,
      knockback: 0,
      killed: false,
    });
    bus.emit('damage_dealt', {
      source: 1,
      target: 11,
      amount: 12,
      tags: ['#ogien', '#status'],
      point: null,
      dir: null,
      knockback: 0,
      killed: true,
    });
    bus.emit('enemy_killed', { id: 11, killer: 1, tags: ['#status'] });

    // Obrażenia zadane graczowi przez wroga i zabójstwo bez udziału gracza (np. kill all) nie wchodzą do statystyk gracza
    bus.emit('damage_dealt', {
      source: 11,
      target: 1,
      amount: 25,
      tags: ['#gun'],
      point: null,
      dir: null,
      knockback: 0,
      killed: false,
    });
    bus.emit('enemy_killed', { id: 99, killer: null, tags: ['debug'] });

    manager.completeRoom({ hp: 75, energy: 80 });
    bus.emit('implant_acquired', {
      id: 'overclock',
      rarity: 'rare',
      source: 'reward',
    });
    manager.returnToMap();

    // Pokój 2: gracz wchodzi na warstwę 2 i ginie przed wyczyszczeniem pokoju
    manager.selectNode('L2N0');
    bus.emit('entity_spawned', { id: 1, kind: 'player' });
    manager.step(8.5);
    bus.emit('player_died', { id: 1 });

    expect(manager.screen).toBe('summary');
    expect(manager.active).toBe(false);
    expect(manager.state.hp).toBe(0);
    expect(ended).toHaveLength(1);
    expect(ended[0]).toEqual({
      outcome: 'death',
      summary: {
        outcome: 'death',
        seed: 'stats-seed',
        loadoutId: 'stormGunner',
        elapsedS: 23.5,
        kills: 2,
        roomsCleared: 1,
        elitesCleared: 0,
        threatLevel: 0,
        layerReached: 2,
        implants: ['overclock'],
        damage: {
          melee: 45,
          power: 30,
          gun: 60,
          other: 12,
        },
      },
    });

    // Po zakończeniu runu czas i statystyki już nie rosną, a powtórne finish nie duplikuje zdarzenia
    manager.step(10);
    bus.emit('enemy_killed', { id: 50, killer: 1, tags: ['#melee'] });
    manager.finish('death');
    expect(ended).toHaveLength(1);
    expect(manager.summary?.elapsedS).toBe(23.5);
    expect(manager.summary?.kills).toBe(2);
  });

  it('nie leczy pasywnie — zdrowie rośnie wyłącznie przez jawne API (heal / setHp)', () => {
    const bus = new EventBus();
    const manager = new RunManager(bus, createTestMap);
    manager.newRun('no-passive-heal', 'classic');

    manager.selectNode('L1N0');
    manager.completeRoom({ hp: 37, energy: 40 });
    expect(manager.state.hp).toBe(37);

    // Krok symulacji, powrót na mapę, wybór kolejnego węzła i wyczyszczenie pokoju nie leczą gracza
    manager.step(60);
    expect(manager.state.hp).toBe(37);
    manager.returnToMap();
    expect(manager.state.hp).toBe(37);
    manager.selectNode('L2N1');
    expect(manager.state.hp).toBe(37);
    manager.completeRoom();
    expect(manager.state.hp).toBe(37);

    // Zdrowie rośnie dopiero po jawnym wywołaniu heal lub setHp
    expect(manager.heal(0)).toBe(0);
    expect(manager.heal(-10)).toBe(0);
    expect(manager.heal(35, 100)).toBe(35);
    expect(manager.state.hp).toBe(72);
    expect(manager.heal(50, 100)).toBe(28);
    expect(manager.state.hp).toBe(100);

    expect(manager.setHp(55, 100)).toBe(true);
    expect(manager.state.hp).toBe(55);
  });

  it('dispose odpina subskrypcje EventBus', () => {
    const bus = new EventBus();
    const spy = vi.spyOn(bus, 'emit');
    const manager = new RunManager(bus, createTestMap);
    manager.newRun('dispose-seed', 'classic');
    manager.dispose();

    bus.emit('enemy_killed', { id: 2, killer: 1, tags: ['#melee'] });
    bus.emit('player_died', { id: 1 });
    expect(manager.state.stats.kills).toBe(0);
    expect(manager.screen).toBe('map');
    spy.mockRestore();
  });
});
