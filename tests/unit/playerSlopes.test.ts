import { afterEach, describe, expect, it } from 'vitest';
import type { World } from '@dimforge/rapier3d-compat';
import { PlayerController } from '../../src/player/playerController';
import {
  CollisionGroup,
  initPhysics,
  interactionGroups,
} from '../../src/physics';
import { EventBus } from '../../src/core/events';
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

interface Options {
  rampDeg?: number;
  wallZ?: number;
  start?: { x: number; y: number; z: number };
}

async function setup({ rampDeg, wallZ, start }: Options = {}) {
  const rapier = await initPhysics();
  const ctx = { bus: new EventBus(), tuning: structuredClone(tuning) };
  const world = new rapier.World({ x: 0, y: ctx.tuning.physics.gravity, z: 0 });
  const solid = (
    half: [number, number, number],
    at: [number, number, number],
    angle = 0,
  ) =>
    world.createCollider(
      rapier.ColliderDesc.cuboid(...half)
        .setTranslation(...at)
        .setRotation({
          x: Math.sin(angle / 2),
          y: 0,
          z: 0,
          w: Math.cos(angle / 2),
        })
        .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
    );
  solid([60, 0.5, 60], [0, -0.5, 0]);
  if (wallZ !== undefined) solid([6, 2, 0.1], [0, 2, wallZ]);
  // Rampa opada w stronę -z (przód gracza przy yaw 0).
  if (rampDeg !== undefined)
    solid([4, 0.15, 30], [0, 10, 0], (-rampDeg * Math.PI) / 180);
  const spawn = start ?? { x: 0, y: 0, z: 0 };
  const player = new PlayerController(7, world, ctx, {
    x: spawn.x,
    y:
      spawn.y +
      ctx.tuning.player.capsuleHeight / 2 +
      ctx.tuning.player.controllerOffset,
    z: spawn.z,
  });
  active.push({ player, world });
  world.step();
  const step = (snapshot: InputSnapshot = input(), n = 1) => {
    for (let i = 0; i < n; i++) {
      player.step(SIM_DT, snapshot);
      world.step();
    }
  };
  step(input(), 30);
  return { ctx, player, step };
}

const speed = (p: PlayerController) =>
  Math.hypot(p.getState().velocity.x, p.getState().velocity.z);

/** Zjazd w stronę -z (yaw 0: `moveForward`, sprint). */
async function slideOnRamp(deg: number | undefined) {
  const { ctx, player, step } = await setup({
    ...(deg !== undefined ? { rampDeg: deg } : {}),
    start: { x: 0, y: deg === undefined ? 0 : 10 + 1.2, z: 0 },
  });
  const run = ['moveForward', 'sprint'] as Action[];
  step(input(run), 50);
  step(input([...run, 'crouch'], ['crouch']));
  expect(player.getState().sliding).toBe(true);
  return { ctx, player, step, run };
}

describe('ślizg po rampie (C-P3)', () => {
  it('zjazd po rampie 25° jest szybszy i dłuższy niż ślizg po płaskim', async () => {
    const flat = await slideOnRamp(undefined);
    flat.step(input([...flat.run, 'crouch']), 48);
    const flatSpeed = speed(flat.player);
    const flatSliding = flat.player.getState().sliding;

    const ramp = await slideOnRamp(25);
    ramp.step(input([...ramp.run, 'crouch']), 48);
    expect(ramp.player.getState().sliding).toBe(true);
    expect(speed(ramp.player)).toBeGreaterThan(flatSpeed + 1);
    // Po 1,3 s płaski ślizg (slideMaxS 1,1) dawno się skończył, zjazd trwa.
    flat.step(input([...flat.run, 'crouch']), 30);
    ramp.step(input([...ramp.run, 'crouch']), 30);
    expect(flatSliding && flat.player.getState().sliding).toBe(false);
    expect(ramp.player.getState().sliding).toBe(true);
    expect(ramp.player.getState().slideS).toBeGreaterThan(
      ramp.ctx.tuning.player.slideMaxS,
    );
  });

  it('slideSlopeAccelScale = 0 przywraca stary ślizg', async () => {
    const ramp = await slideOnRamp(25);
    ramp.ctx.tuning.player.slideSlopeAccelScale = 0;
    ramp.step(input([...ramp.run, 'crouch']), 80);
    expect(ramp.player.getState().sliding).toBe(false);
  });
});

describe('ściana (C-P3)', () => {
  /** Ślizg w ścianę; zwraca gracza 6 kroków (0,1 s) po zetknięciu. */
  const crash = async (projection: number) => {
    const { ctx, player, step } = await setup({ wallZ: -14 });
    ctx.tuning.player.wallVelocityProjection = projection;
    const run = ['moveForward', 'sprint'] as Action[];
    step(input(run), 60);
    step(input([...run, 'crouch'], ['crouch']));
    expect(player.getState().sliding).toBe(true);
    let guard = 0;
    while (player.getState().position.z > -13.5 && guard++ < 200)
      step(input([...run, 'crouch']));
    step(input([...run, 'crouch']), 6);
    return player;
  };

  it('czołowe uderzenie w ścianę podczas ślizgu zeruje prędkość i kończy ślizg', async () => {
    const player = await crash(1);
    expect(player.getState().position.z).toBeGreaterThan(-14);
    expect(player.getState().sliding).toBe(false);
  });

  it('bez rzutowania (0) ślizg nadal trwa i prędkość jest skierowana w ścianę', async () => {
    const player = await crash(0);
    expect(player.getState().sliding).toBe(true);
    expect(player.getState().velocity.z).toBeLessThan(-2);
  });
});

describe('ściana w locie i ciała dynamiczne (C-P3)', () => {
  it('uderzenie w ścianę w fazie wznoszenia skoku obcina prędkość w ścianę', async () => {
    const { player, step } = await setup({ wallZ: -6 });
    const run = ['moveForward', 'sprint'] as Action[];
    step(input(run), 30);
    step(input(run, ['jump']));
    let guard = 0;
    while (player.getState().position.z > -5.4 && guard++ < 120)
      step(input(run));
    step(input(run), 2);
    const s = player.getState();
    expect(s.grounded).toBe(false);
    // Wejście wciąż każe biec, ale pęd w ścianę jest obcinany w locie (nie rośnie ponad targetSpeed).
    expect(Math.abs(s.velocity.z)).toBeLessThan(5);
  });
});

describe('krzywa grawitacji skoku (C-P3)', () => {
  const jumpArc = async (
    set: (p: typeof tuning.player) => void,
    holdJump: boolean,
  ) => {
    const { ctx, player, step } = await setup();
    set(ctx.tuning.player);
    step(input(holdJump ? ['jump'] : [], ['jump']));
    let top = 0;
    let airSteps = 0;
    for (let i = 0; i < 240; i++) {
      step(input(holdJump ? ['jump'] : []));
      const s = player.getState();
      top = Math.max(top, s.position.y);
      if (!s.grounded) airSteps++;
      else if (i > 5) break;
    }
    return { top, airSteps };
  };

  it('domyślnie zawis w szczycie niemal nie zmienia wysokości skoku', async () => {
    const base = await jumpArc((p) => (p.apexGravityMult = 1), true);
    const hang = await jumpArc(() => {}, true);
    expect(hang.top).toBeGreaterThanOrEqual(base.top);
    expect(hang.top - base.top).toBeLessThan(0.1);
  });

  it('fallGravityMult skraca opadanie, jumpCutGravityMult skraca skok po puszczeniu spacji', async () => {
    const base = await jumpArc((p) => (p.apexGravityMult = 1), true);
    const fast = await jumpArc((p) => {
      p.apexGravityMult = 1;
      p.fallGravityMult = 1.3;
    }, true);
    expect(fast.airSteps).toBeLessThan(base.airSteps);
    expect(fast.top).toBeCloseTo(base.top, 1);
    const cut = await jumpArc((p) => {
      p.apexGravityMult = 1;
      p.jumpCutGravityMult = 2;
    }, false);
    const tap = await jumpArc((p) => (p.apexGravityMult = 1), false);
    expect(cut.top).toBeLessThan(tap.top - 0.2);
  });
});
