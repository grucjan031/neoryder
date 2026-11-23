import { describe, it, expect, vi } from 'vitest';
import { Scene } from 'three';
import { EventBus } from '../../src/core/events';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import { GameLoop } from '../../src/core/loop';
import { CommandRegistry } from '../../src/ui/debugCommands';
import { EscortTest } from '../../src/scenes/escortTest';
import { PayloadTest } from '../../src/scenes/payloadTest';
import { scenes } from '../../src/scenes';
import { roomDefinitions } from '../../src/world/rooms';
import { ArenaNavigation } from '../../src/world/arenaNavigation';
import { escortTest, payloadTest } from '../../src/world/prototypes';
import type { InputSnapshot } from '../../src/core/input';
import type { Vec3 } from '../../src/core/math';

const input = (held: string[] = []): InputSnapshot => ({
  held: new Set(held) as InputSnapshot['held'],
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
});

type AnyScene = EscortTest | PayloadTest;

async function setup<T extends AnyScene>(
  make: () => T,
): Promise<{
  scene: T;
  bus: EventBus;
  commands: CommandRegistry;
  step: (n?: number, held?: string[]) => void;
  run: (line: string) => string;
}> {
  const scene = make();
  const bus = new EventBus();
  const commands = new CommandRegistry();
  await scene.init(
    {
      bus,
      commands,
      rng: new Rng('prototypes'),
      loop: new GameLoop({ step() {}, render() {} }),
      tuning: structuredClone(tuning),
      debug: false,
    },
    new Scene(),
  );
  return {
    scene,
    bus,
    commands,
    step: (n = 1, held = []) => {
      for (let i = 0; i < n; i++) scene.step(1 / 60, input(held));
    },
    run: (line) => String(commands.execute(line)),
  };
}

const escortScene = () =>
  new EscortTest(roomDefinitions.get(escortTest.roomId)!, escortTest, false);
const payloadScene = () =>
  new PayloadTest(roomDefinitions.get(payloadTest.roomId)!, payloadTest, false);

function enemyShot(
  scene: AnyScene,
  from: Vec3,
  to: Vec3,
  team: 'enemy' | 'player',
): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  scene.fireEncounterProjectile({
    owner: team === 'player' ? scene.playerId : 987654,
    team,
    origin: from,
    dir: { x: dx, y: dy, z: dz },
    speed: 30,
    damage: 10,
    tags: [],
  });
}

describe('sceny prototypów S4-03', () => {
  it('są zarejestrowane', () => {
    expect(scenes['escort-test']).toBeDefined();
    expect(scenes['payload-test']).toBeDefined();
  });

  it('escort-test: uwolnienie, marsz, obrażenia pociskami wrogów i ewakuacja', async () => {
    const { scene, step, run } = await setup(escortScene);
    try {
      const p = escortTest.prisoner;
      expect(scene.query('escort')).toMatchObject({ state: 'waiting' });
      run(`tp ${p.x + 12} ${p.z}`);
      step(120);
      expect(scene.query('escort')).toMatchObject({ state: 'waiting' });
      run(`tp ${p.x + 1} ${p.z}`);
      step(Math.ceil(tuning.prototypes.escort.freeHoldS * 60) + 10);
      expect(scene.query('escort')).toMatchObject({ state: 'following' });
      expect(run('escort free')).toBe('Więzień nie czeka.');

      // gracz odchodzi po trasie nawigacji: więzień podąża
      run(`tp ${p.x + 9} ${p.z - 6}`);
      step(180);
      const moved = scene.query('escort') as { position: Vec3 };
      expect(
        Math.hypot(moved.position.x - p.x, moved.position.z - p.z),
      ).toBeGreaterThan(2);
      expect(JSON.parse(run('escort status'))).toMatchObject({
        state: 'following',
      });

      // pocisk wroga rani więźnia, pocisk gracza nie
      const at = (scene.query('escort') as { position: Vec3 }).position;
      const centre = { x: at.x, y: at.y + 0.85, z: at.z };
      const hp0 = (scene.query('escort') as { hp: number }).hp;
      enemyShot(scene, { ...centre, x: centre.x + 6 }, centre, 'player');
      step(30);
      expect((scene.query('escort') as { hp: number }).hp).toBe(hp0);
      enemyShot(scene, { ...centre, x: centre.x + 6 }, centre, 'enemy');
      step(30);
      expect((scene.query('escort') as { hp: number }).hp).toBeLessThan(hp0);

      // ewakuacja
      const e = escortTest.evacuation;
      run(`escort tp ${e.x} ${e.z}`);
      step(2);
      expect(scene.query('escort')).toMatchObject({ state: 'evacuated' });
    } finally {
      scene.dispose();
    }
  }, 60_000);

  it('escort-test: scena podaje wsadowi cel końcowy, a węzeł trasy wybiera tylko wsad', async () => {
    const { scene, step, run } = await setup(escortScene);
    const original = ArenaNavigation.prototype.nextBatch;
    const goals: string[] = [];
    const batch = vi
      .spyOn(ArenaNavigation.prototype, 'nextBatch')
      .mockImplementation(function (this: ArenaNavigation, agents, r, l) {
        for (const agent of agents)
          if (agent.moveGoal) goals.push(JSON.stringify(agent.moveGoal));
        return original.call(this, agents, r, l);
      });
    try {
      run('spawn gunner 4');
      step(5);
      expect(goals.length).toBeGreaterThanOrEqual(4);
      // Wszyscy wrogowie wchodzą do wsadu z tym samym celem końcowym, nie z węzłem obok siebie.
      expect(new Set(goals.slice(-4)).size).toBe(1);
    } finally {
      batch.mockRestore();
      scene.dispose();
    }
  }, 60_000);

  it('escort-test: śmierć więźnia i brak blokowania gracza', async () => {
    const { scene, step, run } = await setup(escortScene);
    try {
      run('god');
      const p = escortTest.prisoner;
      // gracz idzie przez klęczącego więźnia i go nie popycha ani nie zatrzymuje się na nim
      run(`tp ${p.x + 3} ${p.z}`);
      run('look 90');
      step(1);
      const before = scene.query('playerPos') as Vec3;
      step(60, ['moveForward']);
      const after = scene.query('playerPos') as Vec3;
      expect(before.x - after.x).toBeGreaterThan(3);
      expect(run('escort hp 0')).toContain('0');
      step(2);
      expect(scene.query('escort')).toMatchObject({ state: 'dead' });
    } finally {
      scene.dispose();
    }
  }, 60_000);

  it('payload-test: pchanie, postój z falą, wyczyszczenie i koniec trasy', async () => {
    const { scene, step, run } = await setup(payloadScene);
    try {
      run('god');
      const start = payloadTest.route[0]!;
      step(30);
      expect(scene.query('payload')).toMatchObject({ status: 'waitingPlayer' });
      run(`tp ${start.x + 3} ${start.z + 3}`);
      step(60);
      const moving = scene.query('payload') as {
        status: string;
        distanceM: number;
      };
      expect(moving.status).toBe('moving');
      expect(moving.distanceM).toBeGreaterThan(1);

      expect(run('payload skip')).toContain('70');
      step(30);
      expect(scene.query('payload')).toMatchObject({
        status: 'holding',
        stopName: 'Brama towarowa',
      });
      step(200);
      expect(scene.query('enemies') as number).toBeGreaterThan(0);
      // fala żyje: skład stoi nawet po upływie holdS
      step(60 * 10);
      expect(scene.query('payload')).toMatchObject({ status: 'holding' });
      for (
        let i = 0;
        i < 60 &&
        (scene.query('payload') as { status: string }).status === 'holding';
        i++
      ) {
        run('kill all');
        step(30);
      }
      expect((scene.query('payload') as { status: string }).status).not.toBe(
        'holding',
      );

      run('payload skip');
      run('payload skip');
      run('payload skip');
      expect(scene.query('payload')).toMatchObject({
        status: 'arrived',
        progress: 1,
      });
      expect(run('payload status')).toContain('arrived');
    } finally {
      scene.dispose();
    }
  }, 120_000);

  it('payload-test: pocisk wroga niszczy wagon, pocisk gracza nie', async () => {
    const { scene, step, run } = await setup(payloadScene);
    try {
      const wagon = (scene.query('payload') as { position: Vec3 }).position;
      const centre = { x: wagon.x, y: wagon.y + 2, z: wagon.z };
      const from = { ...centre, z: centre.z + 15 };
      const max = (scene.query('payload') as { maxHp: number }).maxHp;
      enemyShot(scene, from, centre, 'player');
      step(40);
      expect((scene.query('payload') as { hp: number }).hp).toBe(max);
      enemyShot(scene, from, centre, 'enemy');
      step(40);
      expect((scene.query('payload') as { hp: number }).hp).toBeLessThan(max);
      run('payload hp 0');
      step(2);
      expect(scene.query('payload')).toMatchObject({ status: 'destroyed' });
    } finally {
      scene.dispose();
    }
  }, 60_000);
});
