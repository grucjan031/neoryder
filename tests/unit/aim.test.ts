import { afterEach, describe, expect, it, vi } from 'vitest';
import type { World } from '@dimforge/rapier3d-compat';
import { HeldItem } from '../../src/combat/heldItem';
import type { HeldKind } from '../../src/combat/heldItem';
import { fireProjectile } from '../../src/combat/weapons/fireModes/projectile';
import type { ProjectileSpec } from '../../src/combat/weapons/projectiles';
import { loadWeapon } from '../../src/combat/weapons/weaponSchema';
import { EventBus } from '../../src/core/events';
import type { Action, InputSnapshot } from '../../src/core/input';
import { SIM_DT } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import scatterData from '../../src/data/weapons/scatter.json';
import sniperData from '../../src/data/weapons/sniper.json';
import {
  CollisionGroup,
  initPhysics,
  interactionGroups,
} from '../../src/physics';
import { FpsCamera } from '../../src/player/fpsCamera';
import { PlayerController } from '../../src/player/playerController';

function input(held: Action[] = [], pressed: Action[] = held): InputSnapshot {
  return {
    held: new Set(held),
    pressed: new Set(pressed),
    released: new Set(),
    lookDelta: { x: 0, y: 0 },
  };
}

function hands(start: HeldKind) {
  const bus = new EventBus();
  const t = structuredClone(tuning);
  const item = new HeldItem(bus, 1, t, start);
  bus.emit('weapon_switched', { owner: 1, weapon: 'rifle', slot: 0 });
  return { bus, t, item };
}

const ready = { bladeBusy: false };

describe('celowanie (PPM zależnie od przedmiotu w ręce)', () => {
  it('z ostrzem PPM to blok jak dotąd (akcja trafia do ostrza, bez celowania)', () => {
    const { item } = hands('blade');
    const block = input(['block']);
    const routed = item.step(SIM_DT, block, ready);
    expect(routed.bladeInput).toBe(block);
    expect(item.held).toBe('blade');
    expect(item.aiming).toBe(false);
    expect(item.aim).toBe(0);
  });

  it('z bronią PPM to celowanie: nie wymusza ostrza ani bloku, strzał dalej działa', () => {
    const { item, t, bus } = hands('gun');
    const changed = vi.fn();
    bus.on('held_item_changed', changed);
    const aim = input(['block', 'attack']);
    const routed = item.step(SIM_DT, aim, ready);
    expect(item.held).toBe('gun');
    expect(changed).not.toHaveBeenCalled();
    expect(routed.bladeInput.held.has('block')).toBe(false);
    expect(routed.triggerHeld).toBe(true);
    expect(item.aiming).toBe(true);
    for (let i = 0; i < Math.ceil(t.player.aim.inS / SIM_DT); i++)
      item.step(SIM_DT, input(['block'], []), ready);
    expect(item.aim).toBe(1);
    // Wyjście ~outS po puszczeniu.
    for (let i = 0; i < Math.ceil(t.player.aim.outS / SIM_DT); i++)
      item.step(SIM_DT, input(), ready);
    expect(item.aim).toBe(0);
  });

  it('osobna akcja `aim` (klawisz) celuje z bronią, a z ostrzem nic nie robi', () => {
    const gun = hands('gun').item;
    gun.step(SIM_DT, input(['aim']), ready);
    expect(gun.aiming).toBe(true);
    const blade = hands('blade').item;
    blade.step(SIM_DT, input(['aim']), ready);
    expect(blade.aiming).toBe(false);
  });

  it('ŚPM (rzut ostrzem) nadal wyciąga ostrze i kończy celowanie', () => {
    const { item } = hands('gun');
    item.step(SIM_DT, input(['block']), ready);
    expect(item.aiming).toBe(true);
    item.step(SIM_DT, input(['block', 'bladeThrow']), ready);
    expect(item.held).toBe('blade');
    expect(item.aiming).toBe(false);
  });

  it('przełączenie broni, zmiana na ostrze i brak `canAim` (przegrzanie, dash) kończą celowanie', () => {
    const { item, bus, t } = hands('gun');
    const hold = input(['block'], []);
    item.step(SIM_DT, input(['block']), ready);
    bus.emit('weapon_switched', { owner: 1, weapon: 'pistol', slot: 1 });
    item.step(SIM_DT, hold, ready);
    expect(item.aiming).toBe(false);
    // Ponowne wciśnięcie po puszczeniu wraca do celowania.
    item.step(SIM_DT, input(), ready);
    item.step(SIM_DT, input(['block']), ready);
    expect(item.aiming).toBe(true);
    item.step(SIM_DT, hold, { bladeBusy: false, canAim: false });
    expect(item.aiming).toBe(false);
    item.step(SIM_DT, hold, ready);
    expect(item.aiming).toBe(false);
    item.step(SIM_DT, input(), ready);
    item.step(SIM_DT, input(['block']), ready);
    item.requestToggle();
    item.step(t.hands.swapS / 2, hold, ready);
    expect(item.aiming).toBe(false);
    item.cancelAim();
    expect(item.aim).toBe(0);
  });
});

describe('mnożniki celowania', () => {
  it('rozrzut: stożek zwężony o tuning.player.aim.spread', () => {
    const def = loadWeapon(scatterData);
    if (def.fireMode === 'beam') throw new Error('oczekiwano strzelby');
    const angles = (scale: number): number[] => {
      const shots: ProjectileSpec[] = [];
      fireProjectile(
        def,
        { spawn: (spec: ProjectileSpec) => shots.push(spec) } as never,
        new Rng('aim'),
        {
          owner: 1,
          team: 'player',
          origin: { x: 0, y: 0, z: 0 },
          dir: { x: 0, y: 0, z: -1 },
        },
        scale,
      );
      return shots.map((s) => (Math.acos(-s.dir.z) * 180) / Math.PI);
    };
    const full = Math.max(...angles(1));
    const aimed = Math.max(...angles(tuning.player.aim.spread));
    expect(full).toBeLessThanOrEqual(def.spreadDeg + 1e-6);
    expect(aimed).toBeLessThanOrEqual(
      def.spreadDeg * tuning.player.aim.spread + 1e-6,
    );
    expect(aimed).toBeLessThan(full);
  });

  it('FOV w celowaniu: ułamek bazowego, snajperka mocniej; bez celowania bez zmian', () => {
    const camera = new FpsCamera(structuredClone(tuning), 1);
    const state = {
      position: { x: 0, y: 1, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      yaw: 0,
      pitch: 0,
      height: tuning.player.capsuleHeight,
      grounded: true,
      sliding: false,
      sprinting: false,
      dashS: 0,
    } as never;
    expect(camera.update(SIM_DT, state, state, 1).fov).toBeCloseTo(
      tuning.camera.fov,
    );
    expect(camera.update(SIM_DT, state, state, 1, 1).fov).toBeCloseTo(
      tuning.camera.fov * tuning.player.aim.fovScale,
    );
    const sniper = loadWeapon(sniperData);
    expect(sniper.aimFovScale).toBeLessThan(tuning.player.aim.fovScale);
    expect(
      camera.update(SIM_DT, state, state, 1, 1, sniper.aimFovScale).fov,
    ).toBeCloseTo(tuning.camera.fov * sniper.aimFovScale!);
    camera.dispose();
  });
});

describe('ruch w celowaniu (prawdziwy Rapier)', () => {
  const worlds: { player: PlayerController; world: World }[] = [];
  afterEach(() => {
    for (const { player, world } of worlds.splice(0)) {
      player.dispose();
      world.free();
    }
  });

  async function setup() {
    const rapier = await initPhysics();
    const ctx = { bus: new EventBus(), tuning: structuredClone(tuning) };
    const world = new rapier.World({
      x: 0,
      y: ctx.tuning.physics.gravity,
      z: 0,
    });
    world.createCollider(
      rapier.ColliderDesc.cuboid(60, 0.5, 60)
        .setTranslation(0, -0.5, 0)
        .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
    );
    const player = new PlayerController(7, world, ctx, {
      x: 0,
      y: tuning.player.capsuleHeight / 2 + tuning.player.controllerOffset,
      z: 0,
    });
    worlds.push({ player, world });
    world.step();
    const run = (snapshot: InputSnapshot, frames: number) => {
      for (let i = 0; i < frames; i++) {
        player.step(SIM_DT, snapshot);
        world.timestep = SIM_DT;
        world.step();
      }
    };
    return { player, run };
  }

  it('prędkość × aim.moveSpeed przez StatModifier, sprint niedostępny, czułość × aim.sensitivity', async () => {
    const { player, run } = await setup();
    player.setAim(1);
    run(input(['moveForward', 'sprint'], []), 60);
    // Baza moveSpeed = walkSpeed (bez sprintu), mnożnik celowania przez StatModifier.
    expect(player.stats.get('moveSpeed')).toBeCloseTo(
      tuning.player.walkSpeed * tuning.player.aim.moveSpeed,
    );
    const state = player.getState();
    expect(state.sprinting).toBe(false);
    expect(Math.hypot(state.velocity.x, state.velocity.z)).toBeCloseTo(
      tuning.player.walkSpeed * tuning.player.aim.moveSpeed,
      1,
    );
    const look = input();
    look.lookDelta = { x: 100, y: 0 };
    const before = player.getState().yaw;
    player.step(0, look);
    expect(player.getState().yaw - before).toBeCloseTo(
      -100 * tuning.player.lookSensitivity * tuning.player.aim.sensitivity,
    );
    player.setAim(0);
    expect(player.stats.get('moveSpeed')).toBeCloseTo(tuning.player.walkSpeed);
  });
});
