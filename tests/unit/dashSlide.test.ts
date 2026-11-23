import { afterEach, describe, expect, it } from 'vitest';
import type { World } from '@dimforge/rapier3d-compat';
import { PlayerController } from '../../src/player/playerController';
import {
  initPhysics,
  CollisionGroup,
  interactionGroups,
} from '../../src/physics';
import { EventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import type { Action, InputSnapshot } from '../../src/core/input';
import { SIM_DT } from '../../src/core/loop';
import { tuning } from '../../src/core/tuning';

const input = (
  held: Action[] = [],
  pressed: Action[] = [],
  released: Action[] = [],
): InputSnapshot => ({
  held: new Set(held),
  pressed: new Set(pressed),
  released: new Set(released),
  lookDelta: { x: 0, y: 0 },
});

const active: { player: PlayerController; world: World }[] = [];
afterEach(() => {
  for (const { player, world } of active.splice(0)) {
    player.dispose();
    world.free();
  }
});

type Box = [
  x: number,
  y: number,
  z: number,
  hx: number,
  hy: number,
  hz: number,
];

async function setup(extra: Box[] = []) {
  const rapier = await initPhysics();
  const ctx = { bus: new EventBus(), tuning: structuredClone(tuning) };
  const world = new rapier.World({ x: 0, y: ctx.tuning.physics.gravity, z: 0 });
  for (const [x, y, z, hx, hy, hz] of [
    [0, -0.5, 0, 40, 0.5, 40] as Box,
    ...extra,
  ])
    world.createCollider(
      rapier.ColliderDesc.cuboid(hx, hy, hz)
        .setTranslation(x, y, z)
        .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
    );
  const player = new PlayerController(7, world, ctx, {
    x: 0,
    y: ctx.tuning.player.capsuleHeight / 2 + ctx.tuning.player.controllerOffset,
    z: 0,
  });
  active.push({ player, world });
  world.step();
  const events: (keyof GameEvents)[] = [];
  for (const type of ['dash_used', 'slide_started', 'slide_ended'] as const)
    ctx.bus.on(type, () => events.push(type));
  const step = (snapshot: InputSnapshot = input(), n = 1) => {
    for (let i = 0; i < n; i++) {
      player.step(SIM_DT, snapshot);
      world.step();
    }
  };
  step(input(), 20); // ustabilizowanie na podłodze
  return { ctx, player, world, step, events };
}

const steps = (seconds: number) => Math.round(seconds / SIM_DT);

describe('dash', () => {
  it('przesuwa gracza o dashDistance w czasie dashDurationS (do przodu bez wejścia)', async () => {
    const { ctx, player, step, events } = await setup();
    const t = ctx.tuning.player;
    t.dashExitSpeed = 0; // bez dryfu po dashu — mierzymy sam dash
    const z0 = player.getState().position.z;
    step(input([], ['dash']));
    step(input(), steps(t.dashDurationS) - 1);
    expect(player.getState().dashS).toBe(0);
    expect(z0 - player.getState().position.z).toBeCloseTo(t.dashDistance, 0);
    expect(events).toEqual(['dash_used']);
  });

  it('odnowienie blokuje kolejny dash do końca cooldownu i jest modyfikowalne przez Stats', async () => {
    const { ctx, player, step, events } = await setup();
    const t = ctx.tuning.player;
    step(input([], ['dash']));
    step(input(), steps(t.dashDurationS) + 2);
    step(input([], ['dash']));
    expect(events).toEqual(['dash_used']);
    step(input(), steps(t.dashCooldownS));
    step(input([], ['dash']));
    expect(events).toEqual(['dash_used', 'dash_used']);
    // Synergia skracająca odnowienie o połowę (bez zmiany kodu).
    player.stats.add({
      stat: 'dashCooldown',
      type: 'mult',
      value: 0.5,
      source: 'synergy',
    });
    step(input(), steps(t.dashCooldownS) + 1);
    step(input([], ['dash']));
    expect(events).toHaveLength(3);
    expect(player.getState().dashCooldownS).toBeCloseTo(
      t.dashCooldownS * 0.5,
      5,
    );
  });

  it('działa w powietrzu i nie przechodzi przez ściany', async () => {
    const { ctx, player, step } = await setup([[0, 1.5, -2.5, 3, 1.5, 0.2]]);
    step(input([], ['jump']));
    step(input(), 5);
    expect(player.getState().grounded).toBe(false);
    step(input([], ['dash']));
    step(input(), steps(ctx.tuning.player.dashDurationS) + 5);
    // Ściana: przód na z = -2.3, kapsuła ma promień 0.35.
    expect(player.getState().position.z).toBeGreaterThan(
      -2.3 + ctx.tuning.player.capsuleRadius - 0.05,
    );
  });
});

describe('dash i grawitacja', () => {
  it('ostatni krok dashu w powietrzu nie stosuje grawitacji', async () => {
    const { ctx, player, step } = await setup();
    step(input([], ['jump']));
    step(input(), 5);
    step(input([], ['dash']));
    const t = ctx.tuning.player;
    const y: number[] = [];
    for (let i = 0; i < steps(t.dashDurationS) - 1; i++) {
      step();
      y.push(player.getState().position.y);
    }
    expect(player.getState().dashS).toBe(0);
    expect(Math.abs(y[y.length - 1]! - y[0]!)).toBeLessThan(1e-6);
  });
});

describe('slide', () => {
  it('crouch wciśnięty i puszczony w hitstopie nie uruchamia ślizgu', async () => {
    const { player, step, events } = await setup();
    step(input(['moveForward', 'sprint']), 60);
    player.step(0, input(['moveForward', 'sprint', 'crouch'], ['crouch']));
    player.step(0, input(['moveForward', 'sprint'], [], ['crouch']));
    step(input(['moveForward', 'sprint']), 2);
    expect(player.getState().sliding).toBe(false);
    expect(events.filter((e) => e === 'slide_started')).toHaveLength(
      events.filter((e) => e === 'slide_ended').length,
    );
  });

  it('crouch puszczony w hitstopie kończy trwający ślizg', async () => {
    const { player, step } = await setup();
    step(input(['moveForward', 'sprint']), 60);
    step(input(['moveForward', 'sprint', 'crouch'], ['crouch']));
    expect(player.getState().sliding).toBe(true);
    player.step(0, input(['moveForward', 'sprint'], [], ['crouch']));
    step(input(['moveForward', 'sprint']));
    expect(player.getState().sliding).toBe(false);
  });

  it('setCarry w trakcie ślizgu emituje slide_ended', async () => {
    const { player, step, events } = await setup();
    step(input(['moveForward', 'sprint']), 60);
    step(input(['moveForward', 'sprint', 'crouch'], ['crouch']));
    player.setCarry(0.5);
    expect(player.getState().sliding).toBe(false);
    expect(events).toEqual(['slide_started', 'slide_ended']);
  });

  it('wymaga sprintu na ziemi: crouch przy chodzie nie zaczyna slide', async () => {
    const { player, step, events } = await setup();
    step(input(['moveForward']), 60);
    step(input(['moveForward', 'crouch'], ['crouch']));
    expect(player.getState().sliding).toBe(false);
    expect(events).not.toContain('slide_started');
  });

  it('sprint + crouch: obniża kapsułę, kończy się przy małej prędkości i wstaje', async () => {
    const { ctx, player, step, events } = await setup();
    const t = ctx.tuning.player;
    step(input(['moveForward', 'sprint']), 60);
    step(input(['moveForward', 'sprint', 'crouch'], ['crouch']));
    const s = player.getState();
    expect(s.sliding).toBe(true);
    expect(s.height).toBe(t.slideCapsuleHeight);
    expect(Math.hypot(s.velocity.x, s.velocity.z)).toBeGreaterThan(
      t.sprintSpeed,
    );
    step(input(['crouch']), steps(t.slideMaxS) + 2);
    expect(player.getState().sliding).toBe(false);
    expect(events).toEqual(['slide_started', 'slide_ended']);
    step(input(), 2);
    expect(player.getState().height).toBe(t.capsuleHeight);
    expect(player.getState().crouched).toBe(false);
  });

  it('pod niskim sufitem zostaje w przysiadzie i wstaje po wyjściu spod niego', async () => {
    // Sufit 1,25 m nad podłogą od z = -3 do z = -15.
    const { ctx, player, step } = await setup([[0, 1.45, -9, 3, 0.2, 6]]);
    const t = ctx.tuning.player;
    step(input(['moveForward', 'sprint']), 15);
    step(input(['moveForward', 'sprint', 'crouch'], ['crouch']));
    step(input(['moveForward']), steps(t.slideMaxS) + 6);
    const under = player.getState();
    expect(under.position.z).toBeLessThan(-3.2);
    expect(under.position.z).toBeGreaterThan(-14.8);
    expect(under.sliding).toBe(false);
    expect(under.crouched).toBe(true);
    expect(under.height).toBe(t.slideCapsuleHeight);
    step(input(['moveForward']), steps(3));
    expect(player.getState().position.z).toBeLessThan(-15.5);
    expect(player.getState().height).toBe(t.capsuleHeight);
  });

  it('slide-jump zachowuje pęd poziomy', async () => {
    const { player, step } = await setup();
    step(input(['moveForward', 'sprint']), 60);
    step(input(['moveForward', 'sprint', 'crouch'], ['crouch']));
    const before = Math.hypot(
      player.getState().velocity.x,
      player.getState().velocity.z,
    );
    step(input(['crouch'], ['jump']));
    const s = player.getState();
    expect(s.sliding).toBe(false);
    expect(s.velocity.y).toBeGreaterThan(0);
    expect(Math.hypot(s.velocity.x, s.velocity.z)).toBeGreaterThan(
      before * 0.9,
    );
  });
});

describe('pęd i bufory wejścia (C-P1)', () => {
  const speedOf = (p: PlayerController) => {
    const v = p.getState().velocity;
    return Math.hypot(v.x, v.z);
  };

  it('slide-jump z trzymanym W zachowuje pęd ponad prędkość sprintu', async () => {
    const { ctx, player, step } = await setup();
    const move = ['moveForward', 'sprint'] as Action[];
    step(input(move), 60);
    step(input([...move, 'crouch'], ['crouch']));
    expect(player.getState().sliding).toBe(true);
    step(input([...move, 'crouch']), 5);
    step(input([...move, 'crouch'], ['jump']));
    step(input(move), 3);
    expect(player.getState().grounded).toBe(false);
    const start = speedOf(player);
    expect(start).toBeGreaterThan(ctx.tuning.player.sprintSpeed + 0.2);
    step(input(move), 15);
    expect(player.getState().grounded).toBe(false);
    expect(speedOf(player)).toBeGreaterThan(start * 0.9);
  });

  it('przeciwny kierunek w locie nadal hamuje', async () => {
    const { ctx, player, step } = await setup();
    const move = ['moveForward', 'sprint'] as Action[];
    step(input(move), 60);
    step(input([...move, 'crouch'], ['crouch']));
    step(input([...move, 'crouch'], ['jump']));
    step(input(['moveBack']), 15);
    expect(speedOf(player)).toBeLessThan(ctx.tuning.player.sprintSpeed);
  });

  it('crouch wciśnięty w powietrzu przed lądowaniem zaczyna ślizg w chwili kontaktu', async () => {
    const { ctx, player, step } = await setup();
    const move = ['moveForward', 'sprint'] as Action[];
    ctx.tuning.player.airDrag = 0;
    step(input(move), 60);
    step(input(move, ['jump']));
    step(input(move), 5);
    let guard = 0;
    while (player.getState().position.y > 1.25 && guard++ < 100)
      step(input(move));
    step(input([...move, 'crouch'], ['crouch']));
    expect(player.getState().sliding).toBe(false);
    guard = 0;
    while (!player.getState().grounded && guard++ < 100)
      step(input([...move, 'crouch']));
    expect(player.getState().sliding).toBe(true);
  });

  it('bufor ślizgu wygasa i puszczenie crouch go anuluje', async () => {
    const { ctx, player, step } = await setup();
    const move = ['moveForward', 'sprint'] as Action[];
    step(input(move), 60);
    step(input(move, ['jump']));
    step(input(move), 3);
    step(input([...move, 'crouch'], ['crouch']));
    step(input(move, [], ['crouch']));
    let guard = 0;
    while (!player.getState().grounded && guard++ < 100) step(input(move));
    expect(player.getState().sliding).toBe(false);
    expect(ctx.tuning.player.slideBufferMs).toBeGreaterThan(0);
  });

  it('dash wciśnięty tuż przed końcem odnowienia odpala się sam', async () => {
    const { ctx, step, events } = await setup();
    const t = ctx.tuning.player;
    step(input([], ['dash']));
    step(input(), steps(t.dashCooldownS - t.dashBufferMs / 2000));
    step(input([], ['dash']));
    expect(events).toEqual(['dash_used']);
    step(input(), steps(t.dashBufferMs / 1000));
    expect(events).toEqual(['dash_used', 'dash_used']);
  });

  it('bez wejścia w locie nadmiar pędu też podlega airDrag (nie rośnie względem trzymanego W)', async () => {
    const hold = await setup();
    const free = await setup();
    const move = ['moveForward', 'sprint'] as Action[];
    for (const c of [hold, free]) {
      c.step(input(move), 60);
      c.step(input([...move, 'crouch'], ['crouch']));
      c.step(input([...move, 'crouch'], ['jump']));
      c.step(input(move), 3);
    }
    hold.step(input(move), 15);
    free.step(input(), 15);
    const speedOf = (p: PlayerController) => {
      const v = p.getState().velocity;
      return Math.hypot(v.x, v.z);
    };
    expect(hold.player.getState().grounded).toBe(false);
    expect(free.player.getState().grounded).toBe(false);
    expect(speedOf(free.player)).toBeLessThanOrEqual(
      speedOf(hold.player) + 1e-6,
    );
  });
});
