import { afterEach, describe, expect, it } from 'vitest';
import type { World } from '@dimforge/rapier3d-compat';
import { EventBus, type GameEvents } from '../../src/core/events';
import type { Action, InputSnapshot } from '../../src/core/input';
import { SIM_DT } from '../../src/core/loop';
import { Stats } from '../../src/core/stats';
import { tuning } from '../../src/core/tuning';
import { PlayerController } from '../../src/player/playerController';
import { PlayerStamina, staminaStatsSchema } from '../../src/player/stamina';
import {
  CollisionGroup,
  initPhysics,
  interactionGroups,
} from '../../src/physics';

describe('PlayerStamina', () => {
  function setup() {
    const stats = new Stats(staminaStatsSchema.parse({}));
    const bus = new EventBus();
    const events: GameEvents['stamina_changed'][] = [];
    bus.on('stamina_changed', (event) => events.push(event));
    const t = structuredClone(tuning);
    const stamina = new PlayerStamina(7, stats, bus, t);
    return { stats, events, stamina, t };
  }

  it('startuje pełna, wymaga pełnego kosztu i regeneruje tylko część kroku po opóźnieniu', () => {
    const { stamina, events } = setup();
    expect(stamina.current).toBe(100);
    expect(events).toEqual([{ id: 7, current: 100, max: 100 }]);
    expect(stamina.spend(30)).toBe(true);
    expect(stamina.spend(71)).toBe(false);
    expect(stamina.current).toBe(70);
    stamina.step(0);
    stamina.step(-1);
    stamina.step(0.7);
    expect(stamina.current).toBe(70);
    stamina.step(0.2);
    expect(stamina.current).toBeCloseTo(73);
    stamina.step(10);
    expect(stamina.current).toBe(100);
    expect(events.at(-1)).toEqual({ id: 7, current: 100, max: 100 });
  });

  it('kolejne zużycie resetuje opóźnienie, odmowa go nie resetuje', () => {
    const { stamina } = setup();
    stamina.spend(30);
    stamina.step(0.7);
    stamina.spend(10);
    stamina.step(0.7);
    expect(stamina.current).toBe(60);
    expect(stamina.spend(61)).toBe(false);
    stamina.step(0.2);
    expect(stamina.current).toBeCloseTo(63);
  });

  it('publikuje pełny stan na pierwszym kroku także dla HUD utworzonego po zasobie', () => {
    const stats = new Stats(staminaStatsSchema.parse({}));
    const bus = new EventBus();
    const stamina = new PlayerStamina(7, stats, bus, structuredClone(tuning));
    const events: GameEvents['stamina_changed'][] = [];
    bus.on('stamina_changed', (event) => events.push(event));
    stamina.step(0);
    expect(events).toEqual([]);
    stamina.step(SIM_DT);
    stamina.step(SIM_DT);
    expect(events).toEqual([{ id: 7, current: 100, max: 100 }]);
  });

  it('czyta maksimum i regenerację ze Stats oraz opóźnienie z tuningu na żywo', () => {
    const { stamina, stats, t, events } = setup();
    stats.add({
      stat: 'maxStamina',
      type: 'flat',
      value: 50,
      source: 'implant',
    });
    stamina.step(SIM_DT);
    expect(events.at(-1)?.max).toBe(150);
    stamina.set(stamina.max);
    expect(stamina.current).toBe(150);
    stats.add({
      stat: 'staminaRegen',
      type: 'mult',
      value: 2,
      source: 'implant',
    });
    stamina.spend(100);
    t.player.staminaRegenDelayS = 1;
    stamina.step(1);
    expect(stamina.current).toBe(50);
    stamina.step(0.5);
    expect(stamina.current).toBe(80);
    stats.removeBySource('implant');
    stamina.step(SIM_DT);
    expect(stamina.max).toBe(100);
    expect(events.at(-1)?.max).toBe(100);
    stamina.set(-5);
    expect(stamina.current).toBe(0);
    stamina.set(999);
    expect(stamina.current).toBe(100);
  });
});

const input = (held: Action[] = [], pressed: Action[] = []): InputSnapshot => ({
  held: new Set(held),
  pressed: new Set(pressed),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
});
const active: { player: PlayerController; world: World }[] = [];
afterEach(() => {
  for (const { player, world } of active.splice(0)) {
    player.dispose();
    world.free();
  }
});

async function movement() {
  const rapier = await initPhysics();
  const ctx = { bus: new EventBus(), tuning: structuredClone(tuning) };
  const world = new rapier.World({ x: 0, y: tuning.physics.gravity, z: 0 });
  world.createCollider(
    rapier.ColliderDesc.cuboid(40, 0.5, 80)
      .setTranslation(0, -0.5, 0)
      .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
  );
  const player = new PlayerController(7, world, ctx, {
    x: 0,
    y: tuning.player.capsuleHeight / 2 + tuning.player.controllerOffset,
    z: 0,
  });
  active.push({ player, world });
  const denied: GameEvents['stamina_denied'][] = [];
  const jumped: GameEvents['player_jumped'][] = [];
  const dashed: GameEvents['dash_used'][] = [];
  ctx.bus.on('stamina_denied', (e) => denied.push(e));
  ctx.bus.on('player_jumped', (e) => jumped.push(e));
  ctx.bus.on('dash_used', (e) => dashed.push(e));
  const tick = (snapshot = input(), count = 1) => {
    for (let i = 0; i < count; i++) {
      player.step(SIM_DT, snapshot);
      world.step();
    }
  };
  world.step();
  tick(input(), 3);
  return { player, ctx, tick, denied, jumped, dashed, world, rapier };
}

describe('wytrzymałość ruchu — Rapier bez przeglądarki', () => {
  it('sprint zużywa 20/s, wyczerpuje pulę i wraca dopiero powyżej progu 15', async () => {
    const { player, tick } = await movement();
    const sprint = input(['moveForward', 'sprint']);
    tick(sprint, 60);
    expect(player.stamina.current).toBeCloseTo(80);
    for (let i = 0; i < 300 && player.stamina.current > 0; i++) tick(sprint);
    expect(player.stamina.current).toBe(0);
    expect(player.getState().sprinting).toBe(false);
    // Przy trzymanym sprincie chód nie zatrzymuje regeneracji.
    tick(sprint, 60);
    expect(player.stamina.current).toBeGreaterThan(0);
    expect(player.stamina.current).toBeLessThan(15);
    expect(player.getState().sprinting).toBe(false);
    player.stats.setBase('staminaRegen', 0);
    player.stamina.set(15);
    tick(sprint);
    expect(player.getState().sprinting).toBe(false);
    player.stamina.set(16);
    tick(sprint);
    expect(player.getState().sprinting).toBe(true);
    expect(player.stamina.current).toBeCloseTo(16 - 20 * SIM_DT);
  });

  it('nie pobiera kosztu za sam Shift, chód, dash ani slide; dt=0 zamraża zasób', async () => {
    const { player, tick } = await movement();
    tick(input(['sprint']), 60);
    tick(input(['moveBack', 'sprint']), 60);
    expect(player.stamina.current).toBe(100);
    player.step(0, input(['moveForward', 'sprint'], ['dash']));
    expect(player.stamina.current).toBe(100);
    tick(input(['moveForward', 'sprint']));
    expect(player.stamina.current).toBe(70);
    expect(player.getState().sprinting).toBe(false);
    tick(input(['moveForward', 'sprint']), 5);
    expect(player.stamina.current).toBe(70);
    tick(input(), 10);
    tick(input(['moveForward', 'sprint']), 20);
    const before = player.stamina.current;
    tick(input(['moveForward', 'sprint'], ['crouch']));
    expect(player.getState().sliding).toBe(true);
    expect(player.getState().sprinting).toBe(false);
    expect(player.stamina.current).toBe(before);
  });

  it('sprint oparty o ścianę nie zużywa wytrzymałości bez przesunięcia', async () => {
    const { player, tick, world, rapier } = await movement();
    world.createCollider(
      rapier.ColliderDesc.cuboid(3, 2, 0.2)
        .setTranslation(0, 2, -2)
        .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
    );
    world.step();
    tick(input(['moveForward']), 60);
    const before = player.getState().position.z;
    tick(input(['moveForward', 'sprint']), 60);
    expect(player.getState().position.z).toBeCloseTo(before);
    expect(player.stamina.current).toBe(100);
    expect(player.getState().sprinting).toBe(false);
  });

  it('dash za <30 nie wykonuje się ani nie uruchamia odnowienia; pełny koszt wystarcza', async () => {
    const { player, tick, denied, dashed } = await movement();
    player.stats.setBase('staminaRegen', 0);
    player.stamina.set(29);
    tick(input(['moveForward'], ['dash']));
    expect(player.getState().dashS).toBe(0);
    expect(player.getState().dashCooldownS).toBe(0);
    expect(player.getState().position.z).toBeLessThan(0);
    expect(player.stamina.current).toBe(29);
    expect(dashed).toEqual([]);
    expect(denied).toEqual([{ user: 7, action: 'dash' }]);
    player.stamina.set(30);
    tick(input([], ['dash']));
    expect(player.getState().dashS).toBeGreaterThan(0);
    expect(player.stamina.current).toBe(0);
    expect(dashed).toHaveLength(1);
  });

  it('zwykły skok jest darmowy; bez talentu nie ma skoku w powietrzu', async () => {
    const { player, tick, jumped, denied } = await movement();
    player.stamina.set(0);
    player.stats.setBase('staminaRegen', 0);
    expect(player.stats.get('extraJumps')).toBe(0);
    tick(input([], ['jump']));
    tick(input([], ['jump']));
    expect(jumped.map((e) => e.double)).toEqual([false]);
    expect(player.stamina.current).toBe(0);
    expect(denied).toEqual([]);
  });

  it('extraJumps=1 pozwala odbić się raz za 25, a brak kosztu daje jedną odmowę na bufor', async () => {
    const { player, tick, jumped, denied } = await movement();
    player.stats.add({
      stat: 'extraJumps',
      type: 'flat',
      value: 1,
      source: 'talent',
    });
    player.stats.setBase('staminaRegen', 0);
    tick(input([], ['jump']));
    tick(input([], ['jump']));
    expect(player.stamina.current).toBe(75);
    expect(player.getState().airJumpsUsed).toBe(1);
    tick(input([], ['jump']));
    expect(jumped.map((e) => e.double)).toEqual([false, true]);
    expect(player.stamina.current).toBe(75);
    player.teleport({ x: 0, y: 5, z: 0 });
    player.stamina.set(24);
    tick(input([], ['jump']));
    tick(input(), 3);
    expect(denied).toEqual([{ user: 7, action: 'doubleJump' }]);
    expect(player.getState().airJumpsUsed).toBe(0);
    expect(player.getState().velocity.y).toBeLessThan(0);
    expect(player.stamina.current).toBe(24);
    player.stamina.set(25);
    tick(input([], ['jump']));
    expect(player.stamina.current).toBe(0);
    expect(player.getState().airJumpsUsed).toBe(1);
  });

  it('limit skoków pochodzi ze Stats, liczy skoki zamiast pojedynczej flagi', async () => {
    const { player, tick, jumped } = await movement();
    player.stats.setBase('extraJumps', 2);
    tick(input([], ['jump']));
    tick(input([], ['jump']), 3);
    expect(jumped.map((e) => e.double)).toEqual([false, true, true]);
    expect(player.getState().airJumpsUsed).toBe(2);
    expect(player.stamina.current).toBe(50);
  });
});
