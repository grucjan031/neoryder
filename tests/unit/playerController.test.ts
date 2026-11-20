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

async function setup(ledge = false, mouseSensitivity = 1) {
  const rapier = await initPhysics();
  const ctx = { bus: new EventBus(), tuning: structuredClone(tuning) };
  const world = new rapier.World({ x: 0, y: ctx.tuning.physics.gravity, z: 0 });
  const box = (
    x: number,
    y: number,
    z: number,
    hx: number,
    hy: number,
    hz: number,
    angle = 0,
  ) =>
    world.createCollider(
      rapier.ColliderDesc.cuboid(hx, hy, hz)
        .setTranslation(x, y, z)
        .setRotation({
          x: Math.sin(angle / 2),
          y: 0,
          z: 0,
          w: Math.cos(angle / 2),
        })
        .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
    );
  box(0, -0.5, 0, 30, 0.5, ledge ? 1 : 30);
  const player = new PlayerController(
    42,
    world,
    ctx,
    {
      x: 0,
      y: tuning.player.capsuleHeight / 2 + tuning.player.controllerOffset,
      z: 0,
    },
    { mouseSensitivity },
  );
  player.stats.setBase('extraJumps', 1);
  active.push({ player, world });
  world.step();
  const tick = (snapshot = input(), dt = SIM_DT) => {
    player.step(dt, snapshot);
    if (dt > 0) {
      world.timestep = dt;
      world.step();
    }
  };
  const frames = (count: number, snapshot = input()) => {
    for (let i = 0; i < count; i++) tick(snapshot);
  };
  const until = (predicate: () => boolean, snapshot = input()) => {
    for (let i = 0; i < 300; i++) {
      if (predicate()) return;
      tick(snapshot);
    }
    throw new Error('Nie osiągnięto oczekiwanego stanu w 300 krokach.');
  };
  const jumped: GameEvents['player_jumped'][] = [];
  const landed: GameEvents['player_landed'][] = [];
  ctx.bus.on('player_jumped', (event) => jumped.push(event));
  ctx.bus.on('player_landed', (event) => landed.push(event));
  frames(3);
  return { player, world, ctx, box, tick, frames, until, jumped, landed };
}

describe('kontroler FPP — prawdziwy Rapier', () => {
  it('stosuje mnożnik czułości użytkownika oraz oba limity pitch', async () => {
    const s = await setup(false, 2);
    const snapshot = input();
    snapshot.lookDelta = { x: 100, y: -100000 };
    s.tick(snapshot, 0);
    expect(s.player.getState().yaw).toBeCloseTo(
      -200 * tuning.player.lookSensitivity,
    );
    expect(s.player.getState().pitch).toBeCloseTo((89 * Math.PI) / 180);
    snapshot.lookDelta = { x: 0, y: 100000 };
    s.tick(snapshot, 0);
    expect(s.player.getState().pitch).toBeCloseTo((-89 * Math.PI) / 180);
  });

  it('używa airAccel i aktualnej grawitacji, zachowuje pęd w locie, held jump nie powtarza skoku', async () => {
    const s = await setup();
    s.tick(input(['moveForward', 'jump'], ['jump']));
    expect(-s.player.getState().velocity.z).toBeCloseTo(
      tuning.player.airAccel * SIM_DT,
    );
    const vy = s.player.getState().velocity.y;
    s.ctx.tuning.physics.gravity = -40;
    s.tick(input(['jump']));
    expect(-s.player.getState().velocity.z).toBeCloseTo(
      tuning.player.airAccel * SIM_DT,
    );
    expect(s.player.getState().velocity.y).toBeCloseTo(vy - 40 * SIM_DT);
    s.frames(120, input(['jump']));
    expect(s.jumped).toEqual([{ id: 42, double: false }]);
    expect(s.player.getState().grounded).toBe(true);
  });

  it('skacze w oknie coyote, zachowując podwójny skok', async () => {
    const s = await setup(true);
    s.until(() => !s.player.getState().grounded, input(['moveForward']));
    s.frames(2);
    s.tick(input([], ['jump']));
    expect(s.jumped).toEqual([{ id: 42, double: false }]);
    expect(s.player.getState().velocity.y).toBeGreaterThan(0);
    expect(s.player.getState().airJumpsUsed).toBe(0);
  });

  it('po oknie coyote nie daje zwykłego skoku; pozostaje tylko podwójny', async () => {
    const s = await setup(true);
    s.until(() => !s.player.getState().grounded, input(['moveForward']));
    s.frames(Math.ceil(tuning.player.coyoteTimeMs / (SIM_DT * 1000)) + 2);
    expect(s.player.getState().coyoteMs).toBe(0);
    s.tick(input([], ['jump']));
    expect(s.jumped).toEqual([{ id: 42, double: true }]);
  });

  it('podwójny skok działa raz na lot, skok kasuje coyote, lądowanie resetuje limit', async () => {
    const s = await setup();
    s.tick(input([], ['jump']));
    s.tick(input([], ['jump']));
    s.tick(input([], ['jump']));
    expect(s.jumped).toEqual([
      { id: 42, double: false },
      { id: 42, double: true },
    ]);
    expect(s.player.getState().airJumpsUsed).toBe(1);
    // Bufor trzeciego naciśnięcia wygasa długo przed lądowaniem.
    s.until(() => s.player.getState().grounded);
    expect(s.player.getState().airJumpsUsed).toBe(0);
    s.tick(input([], ['jump']));
    s.tick(input([], ['jump']));
    expect(s.jumped.map((event) => event.double)).toEqual([
      false,
      true,
      false,
      true,
    ]);
  });

  it('bufor po zużyciu obu skoków wykonuje zwykły skok przy lądowaniu', async () => {
    const s = await setup();
    s.tick(input([], ['jump']));
    s.tick(input([], ['jump']));
    s.until(
      () =>
        s.player.getState().velocity.y < 0 &&
        s.player.getState().position.y < 1.5,
    );
    s.tick(input([], ['jump']));
    expect(s.jumped).toHaveLength(2);
    s.until(() => s.jumped.length === 3);
    expect(s.jumped[2]).toEqual({ id: 42, double: false });
    expect(s.player.getState().velocity.y).toBe(tuning.player.jumpVelocity);
    expect(s.player.getState().grounded).toBe(false);
    s.tick();
    expect(s.player.getState().velocity.y).toBeGreaterThan(0);
  });

  it('lądowanie w trakcie dashu nie zużywa bufora skoku, który dash i tak wyzeruje', async () => {
    const s = await setup();
    s.box(0, 0.5, -6, 5, 0.5, 5);
    s.tick(input([], ['jump']));
    const feetY = () => s.player.getState().position.y - 0.9;
    s.until(() => feetY() > 1.03);
    const during: boolean[] = [];
    s.ctx.bus.on('player_jumped', () =>
      during.push(s.player.getState().dashS > 0),
    );
    s.tick(input(['moveForward'], ['dash', 'jump']));
    for (let i = 0; i < 40; i++) s.tick(input(['moveForward']));
    expect(during.some(Boolean)).toBe(false);
  });

  it('wygasły bufor nie powoduje skoku po lądowaniu', async () => {
    const s = await setup();
    s.tick(input([], ['jump']));
    s.tick(input([], ['jump']));
    s.tick(input([], ['jump']));
    s.until(() => s.player.getState().grounded);
    s.frames(10);
    expect(s.jumped).toHaveLength(2);
    expect(s.player.getState().grounded).toBe(true);
  });

  it.each([
    [['moveForward'], tuning.player.walkSpeed],
    [['moveForward', 'sprint'], tuning.player.sprintSpeed],
    [['moveBack', 'sprint'], tuning.player.walkSpeed],
    [['moveLeft', 'sprint'], tuning.player.walkSpeed],
    [['moveForward', 'moveRight'], tuning.player.walkSpeed],
  ] as [Action[], number][])(
    'ruch %j osiąga %s m/s bez bonusu po przekątnej',
    async (held, speed) => {
      const s = await setup();
      const start = s.player.getState().position;
      s.frames(60, input(held));
      const velocity = s.player.getState().velocity;
      expect(Math.hypot(velocity.x, velocity.z)).toBeCloseTo(speed, 5);
      const before = s.player.getState().position;
      s.frames(60, input(held));
      const after = s.player.getState().position;
      const travelled = Math.hypot(after.x - before.x, after.z - before.z);
      expect(travelled).toBeGreaterThan(speed * 0.99);
      expect(travelled).toBeLessThan(speed * 1.01);
      expect(Math.hypot(after.x - start.x, after.z - start.z)).toBeGreaterThan(
        speed,
      );
    },
  );

  it('przyspiesza, hamuje wykładniczo, czyta tuning na żywo i bonusy przez Stats', async () => {
    const s = await setup();
    s.tick(input(['moveForward']));
    expect(-s.player.getState().velocity.z).toBeCloseTo(
      tuning.player.groundAccel * SIM_DT,
    );
    s.frames(20, input(['moveForward']));
    s.tick();
    expect(-s.player.getState().velocity.z).toBeCloseTo(
      tuning.player.walkSpeed *
        Math.exp(-tuning.player.groundFriction * SIM_DT),
    );
    s.ctx.tuning.player.walkSpeed = 4;
    s.player.stats.add({
      stat: 'moveSpeed',
      type: 'mult',
      value: 1.5,
      source: 'test',
    });
    s.frames(60, input(['moveForward']));
    expect(-s.player.getState().velocity.z).toBeCloseTo(6);
  });

  it('wchodzi na kolejne stopnie 0.25 m i blokuje stopień wyższy niż stepHeight', async () => {
    const s = await setup();
    for (let i = 0; i < 4; i++) {
      const height = (i + 1) * 0.25;
      s.box(0, height / 2, -2 - i, 2, height / 2, 0.5);
    }
    s.world.step();
    s.frames(48, input(['moveForward']));
    expect(s.player.getState().position.y).toBeGreaterThan(1.85);
    expect(s.player.getState().position.z).toBeLessThan(-4.5);
    s.player.teleport({ x: 10, y: 0.92, z: 0 });
    s.box(10, 1, -3, 2, 1, 1);
    s.world.step();
    s.frames(60, input(['moveForward']));
    expect(s.player.getState().position.y).toBeLessThan(1);
    expect(s.player.getState().position.z).toBeGreaterThan(-2);
  });

  it.each([30, 55])('rampa %s° respektuje maxSlopeDeg', async (degrees) => {
    const s = await setup();
    const angle = (degrees * Math.PI) / 180;
    s.box(0, Math.sin(angle) * 3, -7, 2, 0.15, 3, angle);
    s.world.step();
    s.frames(65, input(['moveForward']));
    const p = s.player.getState().position;
    if (degrees <= tuning.player.maxSlopeDeg) {
      expect(p.y).toBeGreaterThan(2);
      expect(p.z).toBeLessThan(-6);
    } else {
      expect(p.y).toBeLessThan(1.3);
      expect(p.z).toBeGreaterThan(-5.5);
    }
  });

  it('emituje prędkość uderzenia przed wyzerowaniem i nie powtarza lądowania w spoczynku', async () => {
    const s = await setup();
    s.landed.length = 0;
    s.player.teleport({ x: 0, y: 5, z: 0 });
    let expectedSpeed = 0;
    while (!s.player.getState().grounded) {
      expectedSpeed = Math.abs(
        s.player.getState().velocity.y + tuning.physics.gravity * SIM_DT,
      );
      s.tick();
    }
    expect(s.landed).toHaveLength(1);
    expect(s.landed[0]?.id).toBe(42);
    expect(s.landed[0]?.speed).toBeCloseTo(expectedSpeed, 6);
    expect(expectedSpeed).toBeGreaterThan(10);
    s.frames(60);
    expect(s.landed).toHaveLength(1);
  });

  it('dt=0 zachowuje fizykę i bufor; obrót jest względny, pitch ograniczony, stan kopiowany', async () => {
    const s = await setup();
    const before = s.player.getState();
    const snapshot = input([], ['jump']);
    snapshot.lookDelta = { x: 100, y: 100000 };
    s.tick(snapshot, 0);
    const state = s.player.getState();
    expect(state.position).toEqual(before.position);
    expect(state.velocity).toEqual(before.velocity);
    expect(state.yaw).toBeCloseTo(-100 * tuning.player.lookSensitivity);
    expect(state.pitch).toBeCloseTo((-89 * Math.PI) / 180);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    state.position.x = 999;
    expect(s.player.getState().position.x).toBe(before.position.x);
    s.tick();
    expect(s.jumped).toEqual([{ id: 42, double: false }]);
    s.frames(30, input(['moveForward']));
    expect(s.player.getState().position.x).toBeGreaterThan(0);
    expect(s.player.getState().position.z).toBeLessThan(0);
  });
});
