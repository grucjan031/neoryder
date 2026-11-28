import { describe, expect, it, vi } from 'vitest';
import { Scene as ThreeScene } from 'three';
import { Civilian } from '../../src/civilians/civilian';
import { CivilianHiding, automaticHideSpots } from '../../src/civilians/hiding';
import {
  civilianDefinitions,
  civilianSchema,
} from '../../src/civilians/civilianSchema';
import { CivilianPopulation } from '../../src/civilians/population';
import { DamageSystem, Health, Hurtboxes } from '../../src/combat/damage';
import { EntityRegistry } from '../../src/core/entities';
import { EventBus } from '../../src/core/events';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { Stats } from '../../src/core/stats';
import { tuning } from '../../src/core/tuning';
import scientist from '../../src/data/civilians/scientist.json';
import roomData from '../../src/data/scenes/scientistTest.json';
import {
  CollisionGroup,
  initPhysics,
  interactionGroups,
} from '../../src/physics';
import { buildFloorNavigation } from '../../src/allies/squadPresenter';
import { loadRoom, roomSchema } from '../../src/world/roomSchema';
import { createScientistTest } from '../../src/scenes/scientistTest';
import { CivilianView } from '../../src/render/civilianView';
import type { CivilianSnapshot } from '../../src/civilians/civilian';
import type { Vec3 } from '../../src/core/math';
import { CommandRegistry } from '../../src/ui/debugCommands';
import { ProjectileSystem } from '../../src/combat/weapons/projectiles';
import { queryBladeSegment } from '../../src/combat/melee/bladeQueries';
import { PlayerEnergy } from '../../src/combat/powers/energy';
import { ResonancePush, pushDefinition } from '../../src/combat/powers/push';

const v = (x: number, z: number, y = 0): Vec3 => ({ x, y, z });
const def = civilianDefinitions.get('scientist')!;
const params = tuning.civilians;

function simulated(visible = true, goal = v(5, 5)) {
  const health = new Health(() => def.maxHealth);
  const panicked = vi.fn();
  const civilian = new Civilian(
    1,
    def,
    v(0, 0),
    0,
    0,
    health,
    new Stats({ maxHealth: def.maxHealth, moveSpeed: def.fleeSpeedMps }),
    params,
    {
      visible: () => visible,
      reserve: () => goal,
      next: (_from, to) => to,
      move: (from, delta) => ({
        x: from.x + delta.x,
        y: from.y + delta.y,
        z: from.z + delta.z,
      }),
      panicked,
    },
  );
  return { civilian, health, panicked };
}

describe('cywile — dane i zachowanie', () => {
  it('waliduje naukowca, warianty fartucha i opcjonalne pola pokoju', () => {
    expect(civilianSchema.parse(scientist).maxHealth).toBe(40);
    expect(
      def.clothingVariants.every((look) => look.parts.includes('top_coat')),
    ).toBe(true);
    expect(
      civilianSchema.safeParse({ ...scientist, visionAngleDeg: 361 }).success,
    ).toBe(false);
    expect(
      civilianSchema.safeParse({ ...scientist, maxHealth: 0 }).success,
    ).toBe(false);
    expect(
      civilianSchema.safeParse({ ...scientist, reactionS: -1 }).success,
    ).toBe(false);
    expect(
      civilianSchema.safeParse({ ...scientist, clothingVariants: [] }).success,
    ).toBe(false);
    expect(
      civilianSchema.safeParse({
        ...scientist,
        clothingVariants: [
          { ...scientist.clothingVariants[0], accent: '#ff2bd6' },
        ],
      }).success,
    ).toBe(false);
    expect(loadRoom(roomData).civilians).toHaveLength(3);
    expect(
      roomSchema.safeParse({
        ...roomData,
        civilians: [{ id: 'scientist', position: v(0, 0), yaw: Infinity }],
      }).success,
    ).toBe(false);
    const without = { ...roomData, civilians: undefined };
    expect(loadRoom(without).civilians).toBeUndefined();
    expect(loadRoom({ ...roomData, hideSpots: [v(8, -8)] }).hideSpots).toEqual([
      v(8, -8),
    ]);
  });

  it('wymaga linii wzroku, zasięgu, kąta i ciągłego czasu reakcji', () => {
    for (const [visible, player] of [
      [false, v(0, 5)],
      [true, v(0, 30)],
      [true, v(0, -5)],
    ] as const) {
      const { civilian } = simulated(visible);
      for (let i = 0; i < 60; i++) civilian.step(SIM_DT, player);
      expect(civilian.current.state).toBe('idle');
    }
    const { civilian, panicked } = simulated();
    civilian.step(def.reactionS / 2, v(0, 5));
    expect(civilian.current.state).toBe('idle');
    civilian.step(SIM_DT, v(0, -5));
    expect(civilian.current.reactionS).toBe(0);
    for (let i = 0; i < 20; i++) civilian.step(SIM_DT, v(0, 5));
    expect(civilian.current.state).toBe('fleeing');
    expect(panicked).toHaveBeenCalledTimes(1);
  });

  it('wybiera różne kryjówki deterministycznie i preferuje osłonę przed odległością', () => {
    const spots = [v(5, 5), v(-5, 5), v(5, -5), v(-5, -5)];
    const choose = () => {
      const hiding = new CivilianHiding(
        spots,
        new Rng('scientist'),
        params,
        () => true,
        () => false,
      );
      return [1, 2, 3].map(() => hiding.reserve(v(0, 0), v(0, 0)));
    };
    expect(choose()).toEqual(choose());
    expect(new Set(choose().map((p) => JSON.stringify(p))).size).toBe(3);
    const hiding = new CivilianHiding(
      [v(0, 20), v(0, 5), v(0, 10)],
      new Rng('cover'),
      params,
      (_from, to) => to.z !== 10,
      (from) => from.z === 20,
    );
    expect(hiding.reserve(v(0, 0), v(0, 0))).toEqual(v(0, 5));
    expect(hiding.reserve(v(0, 0), v(0, 0))).toEqual(v(0, 20));
    expect(hiding.reserve(v(0, 0), v(0, 0))).toBeNull();
    expect(
      automaticHideSpots(loadRoom(roomData), params.hideInsetM).length,
    ).toBeGreaterThan(3);
  });

  it('dociera do kryjówki i pozostaje w kuckach także przy graczu', () => {
    const { civilian, panicked } = simulated();
    for (let i = 0; i < 240; i++) civilian.step(SIM_DT, v(0, 5));
    expect(civilian.current.state).toBe('crouching');
    const snapshot = civilian.snapshot();
    for (let i = 0; i < 600; i++) civilian.step(SIM_DT, snapshot.position);
    expect(civilian.snapshot()).toEqual(snapshot);
    expect(panicked).toHaveBeenCalledTimes(1);
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it('po śmierci zachowuje ciało i kierunek trafienia, a widok kończy upadek', () => {
    const { civilian, health } = simulated();
    health.set(0);
    expect(civilian.kill(v(3, 4))).toBe(true);
    expect(civilian.kill(v(-1, 0))).toBe(false);
    const view = new CivilianView(def, 0, tuning);
    for (let i = 0; i < 600; i++) civilian.step(SIM_DT, v(0, 1));
    expect(civilian.snapshot()).toMatchObject({
      state: 'dead',
      hp: 0,
      position: v(0, 0),
      fallDirection: v(0.6, 0.8),
      deathS: params.fallDurationS,
    });
    view.render(civilian, 1, SIM_DT);
    const pivot = view.root.children[0]!;
    expect(pivot.position.y).toBeCloseTo(params.corpseHeightM);
    const position = pivot.position.clone(),
      rotation = pivot.quaternion.clone();
    view.render(civilian, 1, 5);
    expect(pivot.position.equals(position)).toBe(true);
    expect(pivot.quaternion.equals(rotation)).toBe(true);
    expect(view.root.children).toHaveLength(1);
    view.dispose();
  });
});

async function population() {
  const rapier = await initPhysics();
  const world = new rapier.World({ x: 0, y: tuning.physics.gravity, z: 0 });
  const room = loadRoom(roomData);
  for (const block of room.blocks)
    world.createCollider(
      rapier.ColliderDesc.cuboid(
        block.size.x / 2,
        block.size.y / 2,
        block.size.z / 2,
      )
        .setTranslation(block.position.x, block.position.y, block.position.z)
        .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
    );
  const bus = new EventBus(),
    entities = new EntityRegistry(bus);
  const damage = new DamageSystem(bus, entities),
    hurtboxes = new Hurtboxes();
  const playerId = entities.create('player', 'player');
  const navigation = buildFloorNavigation(room, tuning)!;
  const civilians = new CivilianPopulation(
    {
      ctx: { bus, rng: new Rng('population'), tuning },
      rapier,
      world,
      entities,
      damage,
      hurtboxes,
      playerId,
      navigation: () => navigation,
    },
    room,
  );
  world.step();
  return {
    rapier,
    world,
    bus,
    entities,
    damage,
    hurtboxes,
    playerId,
    civilians,
  };
}

describe('cywile — integracja fizyki i pokoju', () => {
  it('hurtbox przyjmuje rzeczywisty pocisk, zapytanie ostrza i Pchnięcie gracza', async () => {
    const p = await population();
    const projectiles = new ProjectileSystem(
      p.world,
      p.entities,
      p.hurtboxes,
      p.damage,
      p.bus,
      tuning,
    );
    const energy = new PlayerEnergy(
      p.playerId,
      new Stats({ maxEnergy: 100, energyRegen: 25 }),
      p.bus,
      tuning,
    );
    try {
      const target = p.civilians.snapshots()[1]!;
      projectiles.spawn({
        owner: p.playerId,
        team: 'player',
        origin: v(0, 5, 0.8),
        dir: v(0, -1),
        speed: 60,
        damage: 10,
        tags: ['#gun'],
      });
      for (let i = 0; i < 5; i++) projectiles.step(SIM_DT);
      expect(p.damage.health(target.id)?.current).toBe(30);
      const boxes = queryBladeSegment(
        p.world,
        p.hurtboxes,
        v(0, 3, 0.8),
        v(0, 1, 0.8),
        0.4,
        false,
        1,
      );
      expect(boxes.some((box) => box.entity === target.id)).toBe(true);
      for (const box of boxes)
        p.damage.deal(box.entity, {
          source: p.playerId,
          amount: 10,
          tags: ['#melee'],
        });
      expect(p.damage.health(target.id)?.current).toBe(20);
      const push = new ResonancePush(
        pushDefinition,
        {
          owner: p.playerId,
          damage: p.damage,
          energy,
          aim: () => ({ origin: v(0, 5, 0.8), dir: v(0, -1) }),
          targets: () => p.civilians.targets(),
          castWall: () => null,
        },
        p.bus,
        tuning,
      );
      expect(push.use()).toBeGreaterThan(0);
      expect(p.damage.health(target.id)?.current).toBeLessThan(20);
    } finally {
      energy.dispose();
      projectiles.dispose();
      p.civilians.dispose();
      p.world.free();
    }
  });

  it('uciekają po siatce bez przenikania przez osłony, do osobnych kryjówek', async () => {
    const p = await population();
    try {
      const panicked = vi.fn();
      p.bus.on('civilianPanicked', panicked);
      for (let i = 0; i < 900; i++) {
        p.civilians.step(SIM_DT, v(0, 8));
        p.world.step();
        for (const { position } of p.civilians.snapshots())
          for (const block of roomData.blocks) {
            if (block.position.y + block.size.y / 2 <= 0) continue;
            expect(
              Math.abs(position.x - block.position.x) < block.size.x / 2 &&
                Math.abs(position.z - block.position.z) < block.size.z / 2,
            ).toBe(false);
          }
      }
      const snapshots = p.civilians.snapshots();
      expect(snapshots.every((s) => s.state === 'crouching')).toBe(true);
      expect(
        new Set(snapshots.map((s) => JSON.stringify(s.hideSpot))).size,
      ).toBe(3);
      expect(panicked).toHaveBeenCalledTimes(3);
      const before = p.civilians.snapshots();
      for (let i = 0; i < 60; i++) {
        p.civilians.step(SIM_DT, v(0, -8));
        p.world.step();
      }
      expect(p.civilians.snapshots()).toEqual(before);
    } finally {
      p.civilians.dispose();
      p.world.free();
    }
  });

  it('broń, ostrze i moce gracza zabijają bez enemy_killed; wrogowie nie ranią', async () => {
    const p = await population();
    try {
      const killed = vi.fn(),
        enemyKilled = vi.fn();
      p.bus.on('civilianKilled', killed);
      p.bus.on('enemy_killed', enemyKilled);
      const enemy = p.entities.create('gunner', 'enemy');
      for (const [index, tag] of ['#gun', '#melee', '#power'].entries()) {
        const id = p.civilians.snapshots()[index]!.id;
        expect(
          p.damage.deal(id, { source: enemy, amount: 100, tags: [tag] }),
        ).toBe(0);
        expect(
          p.damage.deal(id, {
            source: p.playerId,
            amount: 100,
            tags: [tag],
            dir: v(1, 0),
          }),
        ).toBe(40);
        expect(
          p.damage.deal(id, { source: p.playerId, amount: 100, tags: [tag] }),
        ).toBe(0);
        expect(p.entities.team(id)).toBe('neutral');
        expect(p.entities.alive(id)).toBe(true);
      }
      for (let i = 0; i < 900; i++) {
        p.civilians.step(SIM_DT, v(0, 8));
        p.world.step();
      }
      expect(p.civilians.snapshots()).toHaveLength(3);
      expect(p.civilians.snapshots().every((s) => s.state === 'dead')).toBe(
        true,
      );
      expect(p.civilians.targets()).toEqual([]);
      expect(killed).toHaveBeenCalledTimes(3);
      expect(enemyKilled).not.toHaveBeenCalled();
    } finally {
      p.civilians.dispose();
      p.world.free();
    }
  });

  it('żywi cywile nie blokują ukończenia pokoju po śmierci wrogów', async () => {
    const scene = createScientistTest(false);
    const bus = new EventBus();
    const commands = new CommandRegistry();
    try {
      await scene.init(
        {
          bus,
          commands,
          rng: new Rng('room-civilians'),
          tuning: structuredClone(tuning),
          debug: false,
          loop: new GameLoop({ step() {}, render() {} }),
        },
        new ThreeScene(),
      );
      const idle = {
        held: new Set<never>(),
        pressed: new Set<never>(),
        released: new Set<never>(),
        lookDelta: { x: 0, y: 0 },
      };
      for (let i = 0; i < 540; i++) scene.step(SIM_DT, idle);
      expect(scene.query('enemies')).toBe(2);
      expect(scene.query('civilians')).toHaveLength(3);
      commands.execute('kill all');
      for (let i = 0; i < 2; i++) scene.step(SIM_DT, idle);
      expect(scene.query('roomCleared')).toBe(true);
      expect(
        (scene.query('civilians') as CivilianSnapshot[]).every(
          (s) => s.hp === 40,
        ),
      ).toBe(true);
    } finally {
      scene.dispose();
    }
  });
});
