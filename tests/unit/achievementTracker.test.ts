import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import { AchievementTracker } from '../../src/progression/achievementTracker';
import type { AchievementTrackerOptions } from '../../src/progression/achievementTracker';

const PLAYER = 1;
const V = { x: 0, y: 0, z: 0 };

function setup(options: Partial<AchievementTrackerOptions> = {}) {
  const bus = new EventBus();
  let now = 0;
  const earned: string[] = [];
  bus.on('achievement_earned', ({ id }) => earned.push(id));
  const tracker = new AchievementTracker(bus, {
    base: { unlocked: [], counters: {} },
    clock: () => now,
    ...options,
  });
  bus.emit('entity_spawned', { id: PLAYER, kind: 'player' });
  const hit = (
    target: number,
    tags: string[],
    source: number | null = PLAYER,
  ) =>
    bus.emit('damage_dealt', {
      source,
      target,
      amount: 5,
      tags,
      point: null,
      dir: null,
      knockback: 0,
      killed: false,
    });
  const kill = (id: number, killer: number | null = PLAYER) =>
    bus.emit('enemy_killed', { id, killer, tags: [] });
  return {
    bus,
    tracker,
    earned,
    hit,
    kill,
    at: (s: number) => {
      now = s;
    },
  };
}

describe('AchievementTracker', () => {
  it('przypisuje zabójstwo do kategorii ostatniego obrażenia gracza na wrogu', () => {
    const { tracker, hit, kill, bus } = setup();
    for (const id of [10, 11, 12, 13])
      bus.emit('entity_spawned', { id, kind: 'drone' });
    hit(10, ['#melee']);
    kill(10);
    hit(11, ['#gun']);
    hit(11, ['#power']);
    kill(11);
    hit(12, ['#gun']);
    hit(12, ['#elektrycznosc']);
    kill(12);
    kill(13);
    expect(tracker.tracked.counters).toEqual({
      kills_melee: 1,
      kills_power: 1,
      kills_gun: 1,
    });
    expect(tracker.tracked.flags).toEqual(['pierwsza-krew']);
  });

  it('ignoruje zabójstwa cudzego sprawcy i obrażenia od wrogów', () => {
    const { tracker, hit, kill } = setup();
    hit(10, ['#melee'], 99);
    kill(10, 99);
    kill(11, null);
    expect(tracker.tracked).toEqual({ counters: {}, flags: [] });
  });

  it('seria: 5 zabójstw w 2 sekundy ustawia flagę, wolniejsze nie', () => {
    const slow = setup();
    [0, 0.5, 1, 2.4, 3.9, 4.4].forEach((t, i) => {
      slow.at(t);
      slow.kill(20 + i);
    });
    expect(slow.tracker.tracked.flags).not.toContain('seria');
    const fast = setup();
    [0, 0.4, 0.9, 1.4, 2].forEach((t, i) => {
      fast.at(t);
      fast.kill(30 + i);
    });
    expect(fast.tracker.tracked.flags).toContain('seria');
    expect(fast.earned).toContain('seria');
  });

  it('bez zadrapania: elita bez obrażeń daje flagę, trafienie ją odbiera', () => {
    const clean = setup();
    clean.bus.emit('room_entered', {
      nodeId: 'n',
      roomId: 'r',
      type: 'elite',
      layer: 4,
    });
    clean.bus.emit('room_cleared', { nodeId: 'n', type: 'elite', timeS: 30 });
    expect(clean.tracker.tracked.flags).toContain('bez-zadrasniecia');

    const hurt = setup();
    hurt.bus.emit('room_entered', {
      nodeId: 'n',
      roomId: 'r',
      type: 'elite',
      layer: 4,
    });
    hurt.hit(PLAYER, ['#gun'], 50);
    hurt.bus.emit('room_cleared', { nodeId: 'n', type: 'elite', timeS: 30 });
    expect(hurt.tracker.tracked.flags).not.toContain('bez-zadrasniecia');

    const combat = setup();
    combat.bus.emit('room_entered', {
      nodeId: 'n',
      roomId: 'r',
      type: 'combat',
      layer: 1,
    });
    combat.bus.emit('room_cleared', { nodeId: 'n', type: 'combat', timeS: 30 });
    expect(combat.tracker.tracked.flags).toEqual([]);
  });

  it('obrażenia z poprzedniego pokoju nie psują kolejnej elity', () => {
    const t = setup();
    t.hit(PLAYER, ['#gun'], 50);
    t.bus.emit('room_entered', {
      nodeId: 'n',
      roomId: 'r',
      type: 'elite',
      layer: 4,
    });
    t.bus.emit('room_cleared', { nodeId: 'n', type: 'elite', timeS: 30 });
    expect(t.tracker.tracked.flags).toContain('bez-zadrasniecia');
  });

  it('trzy punkty: flaga tylko przy 3x gracz w migawce właścicieli', () => {
    const t = setup();
    type Owner = 'player' | 'enemy' | 'neutral';
    const owners = { A: 'neutral', B: 'neutral', C: 'neutral' } as Record<
      'A' | 'B' | 'C',
      Owner
    >;
    const change = (id: 'A' | 'B' | 'C', owner: Owner) => {
      owners[id] = owner;
      t.bus.emit('conquest_captured', { id, owner, owners: { ...owners } });
    };
    change('A', 'player');
    change('B', 'player');
    // Scenariusz z recenzji: A zbite do neutralnego, potem przejęte C.
    change('A', 'neutral');
    change('C', 'player');
    expect(t.tracker.tracked.flags).not.toContain('trzy-punkty');
    change('A', 'player');
    expect(t.tracker.tracked.flags).toContain('trzy-punkty');
  });

  it('boss sektora ustawia upadek-brandta', () => {
    const t = setup();
    t.bus.emit('entity_spawned', { id: 70, kind: 'securityChief' });
    t.kill(70);
    expect(t.tracker.tracked.flags).toContain('upadek-brandta');
  });

  it('liczniki zdarzeń liczą tylko akcje gracza', () => {
    const t = setup();
    t.bus.emit('parry_success', {
      defender: PLAYER,
      projectile: 5,
      attacker: 9,
    });
    t.bus.emit('parry_success', {
      defender: PLAYER,
      projectile: 6,
      attacker: 9,
    });
    t.bus.emit('parry_success', {
      defender: 77,
      projectile: null,
      attacker: 9,
    });
    t.bus.emit('execute_performed', { attacker: PLAYER, target: 9, point: V });
    t.bus.emit('execute_performed', { attacker: 77, target: 9, point: V });
    t.bus.emit('synergy_triggered', { synergy: 's', user: PLAYER });
    t.bus.emit('synergy_triggered', { synergy: 's', user: 77 });
    t.bus.emit('dash_used', { user: PLAYER, dir: V });
    t.bus.emit('dash_used', { user: 77, dir: V });
    expect(t.tracker.tracked.counters).toEqual({
      parry_success: 2,
      execute_performed: 1,
      synergy_triggered: 1,
      dash_used: 1,
    });
  });

  it('achievement_earned tylko raz, przy przekroczeniu progu z uwzględnieniem stanu meta', () => {
    const t = setup({
      base: { unlocked: ['pierwsza-krew'], counters: { parry_success: 24 } },
    });
    t.kill(10);
    expect(t.earned).toEqual([]);
    t.bus.emit('parry_success', {
      defender: PLAYER,
      projectile: 5,
      attacker: 9,
    });
    t.bus.emit('parry_success', {
      defender: PLAYER,
      projectile: 6,
      attacker: 9,
    });
    expect(t.earned).toEqual(['zwierciadlo']);
  });

  it('po zakończeniu runu nic się nie liczy', () => {
    let active = true;
    const t = setup({ active: () => active });
    t.kill(10);
    active = false;
    t.kill(11);
    t.bus.emit('dash_used', { user: PLAYER, dir: V });
    expect(t.tracker.tracked.flags).toEqual(['pierwsza-krew']);
    expect(t.tracker.tracked.counters).toEqual({});
  });

  it('restore odtwarza przyrosty bez ponownego komunikatu, a setBase wycisza zdobyte w zostawionym runie', () => {
    const t = setup({
      base: { unlocked: [], counters: { parry_success: 24 } },
    });
    t.tracker.restore({
      counters: { parry_success: 1 },
      flags: ['pierwsza-krew'],
    });
    expect(t.earned).toEqual([]);
    expect(t.tracker.tracked).toEqual({
      counters: { parry_success: 1 },
      flags: ['pierwsza-krew'],
    });
    t.kill(10);
    expect(t.earned).toEqual([]);

    const left = setup();
    left.tracker.setBase({ unlocked: ['pierwsza-krew'], counters: {} });
    left.kill(11);
    expect(left.earned).toEqual([]);
  });

  it('dispose odpina nasłuchiwanie', () => {
    const t = setup();
    t.tracker.dispose();
    t.kill(10);
    expect(t.tracker.tracked.flags).toEqual([]);
  });
});
