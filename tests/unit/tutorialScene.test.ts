import { afterEach, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Scene as ThreeScene, Vector3 } from 'three';
import type { World } from '@dimforge/rapier3d-compat';
import { Tutorial, tutorialSteps } from '../../src/scenes/tutorial';
import {
  CollisionGroup,
  initPhysics,
  interactionGroups,
} from '../../src/physics';
import { enemyDefinitions } from '../../src/enemies/registry';
import {
  ProjectileSystem,
  type ProjectileSpec,
} from '../../src/combat/weapons/projectiles';
import type { Vec3 } from '../../src/core/math';
import { EventBus } from '../../src/core/events';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import { CommandRegistry } from '../../src/ui/debugCommands';
import type { InputSnapshot } from '../../src/core/input';
import type { Action } from '../../src/core/input';

const idle: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};
const active: Tutorial[] = [];
const input = (action: Action, pressed = true): InputSnapshot => ({
  ...idle,
  held: new Set([action]),
  pressed: new Set(pressed ? [action] : []),
});
afterEach(() => {
  active.splice(0).forEach((scene) => scene.dispose());
  vi.restoreAllMocks();
});
async function setup() {
  const rapier = await initPhysics();
  // Spy przepuszcza symulację i udostępnia rzeczywisty świat bez zmiany RoomScene.
  const worldSteps = vi.spyOn(rapier.World.prototype, 'step');
  const scene = new Tutorial(false);
  active.push(scene);
  const bus = new EventBus();
  const commands = new CommandRegistry();
  const three = new ThreeScene();
  const camera = new PerspectiveCamera();
  let playerId = 0;
  bus.on('entity_spawned', ({ id, kind }) => {
    if (kind === 'player') playerId = id;
  });
  await scene.init(
    {
      bus,
      commands,
      camera,
      rng: new Rng('tutorial-test'),
      tuning: structuredClone(tuning),
      loop: new GameLoop({ step() {}, render() {} }),
      debug: false,
    },
    three,
  );
  const world = worldSteps.mock.contexts[0] as World;
  worldSteps.mockRestore();
  return { scene, bus, commands, three, camera, world, rapier, playerId };
}

it('komenda ustawia start i obrót każdego kroku z dowolnej pozycji i obrotu', async () => {
  const { scene, commands, camera } = await setup();
  for (const [index, step] of tutorialSteps.entries()) {
    commands.execute('tp 4 5 70 25');
    expect(commands.execute(`tutorial step ${index + 1}`)).toContain(
      `krok ${index + 1}`,
    );
    const start = step.start!;
    const position = scene.query('playerPos') as Vec3;
    expect(position.x).toBe(start.x);
    expect(position.z).toBe(start.z);
    expect(position.y).toBeCloseTo(
      tuning.player.capsuleHeight / 2 + tuning.player.controllerOffset,
    );
    const look = scene.query('playerLook') as {
      yawDeg: number;
      pitchDeg: number;
    };
    expect(look.yawDeg).toBeCloseTo(start.yawDeg);
    expect(look.pitchDeg).toBeCloseTo(0);
    scene.render(1);
    expect(camera.rotation.y).toBeCloseTo((start.yawDeg * Math.PI) / 180);
    expect(camera.position.x).toBeCloseTo(start.x);
    expect(camera.position.z).toBeCloseTo(start.z);
  }
});

it('zwykłe przejście do finału i jego restart zachowują pozycję i kamerę', async () => {
  const { scene, commands, bus, playerId } = await setup();
  commands.execute('tutorial step 9');
  commands.execute('tp 2 -9 60 15');
  const position = scene.query('playerPos');
  const look = scene.query('playerLook');
  bus.emit('execute_performed', {
    attacker: playerId,
    target: scene.query('tutorialTarget') as number,
    point: { x: 6, y: 0, z: -10 },
  });
  scene.step(0, idle);
  expect(scene.query('tutorialStep')).toBe(10);
  expect(scene.query('playerPos')).toEqual(position);
  expect(scene.query('playerLook')).toEqual(look);
  commands.execute('hurt 1000');
  scene.step(0, idle);
  expect(scene.query('tutorialStep')).toBe(10);
  expect(scene.query('playerPos')).toEqual(position);
  expect(scene.query('playerLook')).toEqual(look);
  expect(scene.query('playerHp')).toBe(100);
});

it.each([4, 5, 6, 8, 9])(
  'krok %i: promień od kamery do celu nie trafia w geometrię świata Rapier',
  async (number) => {
    const { scene, commands, camera, world, rapier } = await setup();
    commands.execute(`tutorial step ${number}`);
    scene.step(SIM_DT, idle);
    scene.render(1);
    const spawn = tutorialSteps[number - 1]!.spawn!;
    const definition = enemyDefinitions.get(spawn.enemy)!;
    const target = new Vector3(
      spawn.position.x,
      spawn.position.y + definition.body!.centerY,
      spawn.position.z,
    );
    const direction = target.clone().sub(camera.position);
    const distance = direction.length();
    direction.normalize();
    expect(
      camera
        .getWorldDirection(new Vector3())
        .dot(new Vector3(direction.x, 0, direction.z).normalize()),
    ).toBeCloseTo(1);
    const ray = new rapier.Ray(camera.position, direction);
    expect(
      world.castRay(
        ray,
        distance,
        true,
        undefined,
        interactionGroups(
          CollisionGroup.PlayerProjectile,
          CollisionGroup.World,
        ),
      ),
    ).toBeNull();
    const hit = world.castRay(
      ray,
      distance,
      true,
      undefined,
      interactionGroups(
        CollisionGroup.PlayerProjectile,
        CollisionGroup.World | CollisionGroup.Enemy,
      ),
    );
    expect(hit).not.toBeNull();
    expect(hit!.collider.collisionGroups() >>> 16).toBe(CollisionGroup.Enemy);
  },
);

it('po tutorial step 6 w ciągu 5 s powstają prawdziwe pociski strzelca skierowane w gracza', async () => {
  const { scene, commands, bus } = await setup();
  const spawn = vi.spyOn(ProjectileSystem.prototype, 'spawn');
  const shots: { spec: ProjectileSpec; player: Vec3 }[] = [];
  commands.execute('tutorial step 6');
  const target = scene.query('tutorialTarget');
  bus.on('projectile_spawned', (shot) => {
    if (shot.team !== 'enemy' || shot.owner !== target) return;
    shots.push({
      spec: structuredClone(spawn.mock.lastCall![0]),
      player: scene.query('playerPos') as Vec3,
    });
  });
  for (let frame = 0; frame < 5 / SIM_DT; frame++) scene.step(SIM_DT, idle);
  expect(shots.length).toBeGreaterThanOrEqual(1);
  for (const { spec, player } of shots) {
    expect(spec.owner).toBe(target);
    expect(spec.team).toBe('enemy');
    const direction = new Vector3(
      player.x - spec.origin.x,
      player.y - spec.origin.y,
      player.z - spec.origin.z,
    ).normalize();
    expect(
      new Vector3(spec.dir.x, spec.dir.y, spec.dir.z).dot(direction),
    ).toBeCloseTo(1);
  }
});
it('ładuje poligon, talent podwójnego skoku i nieśmiertelność; parry ×2 przechodzi do 7', async () => {
  const { scene, commands, bus, three } = await setup();
  expect(scene.query('tutorialStep')).toBe(1);
  expect(scene.query('extraJumps')).toBe(1);
  expect(scene.query('enemies')).toBe(0);
  commands.execute('hurt 1000');
  expect(scene.query('playerHp')).toBe(scene.query('playerMaxHp'));
  expect(commands.execute('tutorial step 0')).toContain('Użycie');
  expect(commands.execute('tutorial step 6')).toContain('krok 6');
  const attacker = scene.query('tutorialTarget') as number;
  bus.emit('parry_success', { defender: 1, projectile: 20, attacker });
  scene.step(SIM_DT, idle);
  expect(scene.query('tutorialStep')).toBe(6);
  bus.emit('parry_success', { defender: 1, projectile: 21, attacker });
  scene.step(SIM_DT, idle);
  expect(scene.query('tutorialStep')).toBe(7);
  expect(scene.query('enemies')).toBe(0);
  commands.execute('tutorial step 11');
  expect(scene.query('tutorialComplete')).toBe(true);
  scene.render(1);
  scene.dispose();
  scene.dispose();
  expect(three.children).toHaveLength(0);
  expect(commands.execute('tutorial step 1')).toContain('Nieznana komenda');
});
it('finał odbiera HP, śmierć odnawia zasoby i restartuje falę trzech wrogów', async () => {
  const { scene, commands } = await setup();
  commands.execute('tutorial step 10');
  commands.execute('hurt 12');
  expect(scene.query('playerHp')).toBe(88);
  for (let i = 0; i < 60; i++) scene.step(SIM_DT, idle);
  commands.execute('hurt 1000');
  expect(scene.query('dead')).toBe(true);
  scene.step(SIM_DT, idle);
  expect(scene.query('tutorialStep')).toBe(10);
  expect(scene.query('playerHp')).toBe(100);
  expect(scene.query('dead')).toBe(false);
  for (let i = 0; i < 180; i++) scene.step(SIM_DT, idle);
  expect(scene.query('enemies')).toBe(3);
  commands.execute('kill all');
  scene.step(SIM_DT, idle);
  expect(scene.query('tutorialComplete')).toBe(true);
});

it('prawdziwe trafienia combo i ciężkie przebicie tarczy zaliczają manekiny', async () => {
  const { scene, commands } = await setup();
  commands.execute('tutorial step 4');
  commands.execute('tp -6 -6');
  for (let swing = 0; swing < 6 && scene.query('tutorialStep') === 4; swing++) {
    scene.step(SIM_DT, input('attack'));
    for (let i = 0; i < 19; i++) scene.step(SIM_DT, idle);
  }
  expect(scene.query('tutorialStep')).toBe(5);
  commands.execute('tp -6 -6');
  scene.step(SIM_DT, input('attack'));
  for (let i = 0; i < 150 && scene.query('tutorialStep') === 5; i++)
    scene.step(SIM_DT, input('attack', false));
  for (let i = 0; i < 60 && scene.query('tutorialStep') === 5; i++)
    scene.step(SIM_DT, idle);
  expect(scene.query('tutorialStep')).toBe(6);
});

it('prawdziwy blaster przegrzewa się i stygnie, Pchnięcie uderza w ścianę, LPM wykańcza cel', async () => {
  const { scene, commands, bus } = await setup();
  commands.execute('tutorial step 7');
  let overheated = false;
  bus.on('heat_changed', (heat) => {
    overheated ||= heat.overheated;
  });
  scene.step(SIM_DT, input('swap'));
  for (let i = 0; i < 60; i++) scene.step(SIM_DT, idle);
  for (let i = 0; i < 600 && !overheated; i++)
    scene.step(SIM_DT, input('attack', i === 0));
  expect(overheated).toBe(true);
  expect(scene.query('tutorialStep')).toBe(7);
  for (let i = 0; i < 600 && scene.query('tutorialStep') === 7; i++)
    scene.step(SIM_DT, idle);
  expect(scene.query('tutorialStep')).toBe(8);
  commands.execute('tp 6 -8');
  scene.step(SIM_DT, input('power'));
  for (let i = 0; i < 120 && scene.query('tutorialStep') === 8; i++)
    scene.step(SIM_DT, idle);
  expect(scene.query('tutorialStep')).toBe(9);
  commands.execute('tp 6 -8.5');
  for (let i = 0; i < 2; i++) scene.step(SIM_DT, idle);
  scene.step(SIM_DT, input('attack'));
  expect(scene.query('tutorialStep')).toBe(10);
});

it('wieżyczka emituje prawdziwe pociski, które można odbić dwa razy', async () => {
  const { scene, commands, bus } = await setup();
  commands.execute('tutorial step 6');
  let sinceShot = Number.POSITIVE_INFINITY;
  bus.on('projectile_spawned', (shot) => {
    if (shot.team === 'enemy') sinceShot = 0;
  });
  for (
    let frame = 0;
    frame < 600 && scene.query('tutorialStep') === 6;
    frame++
  ) {
    // Droga 4,55 m przy 9 m/s; okno parowania otwieramy przed kontaktem kapsuły.
    const block = sinceShot >= 22 && sinceShot <= 29;
    scene.step(SIM_DT, block ? input('block', sinceShot === 22) : idle);
    sinceShot++;
  }
  expect(scene.query('tutorialStep')).toBe(7);
});
