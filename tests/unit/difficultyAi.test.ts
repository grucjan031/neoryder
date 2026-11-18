import { describe, expect, it } from 'vitest';
import { SIM_DT } from '../../src/core/loop';
import { clearWorld } from '../../src/enemies/tactics';
import type { EnemyDependencies } from '../../src/enemies/types';
import { difficultyArena } from './difficultyHarness';

describe('taktyczne AI w rzeczywistym Rapierze', () => {
  it('drugi Szturmowiec wybiera cel 60–120 stopni od atakującego', async () => {
    let flanked = false;
    for (let seed = 0; seed < 8 && !flanked; seed++) {
      const a = await difficultyArena('nightmare', `flank:${seed}`);
      try {
        const first = a.spawn('assaulter', { x: 0, y: 0, z: 1.7 });
        const second = a.spawn('assaulter', { x: 0.8, y: 0, z: 3.2 });
        first.current.state = 'telegraph';
        a.world.step();
        a.step();
        const goal = second.tacticalGoal;
        if (!goal) continue;
        const p = first.current.position;
        const angle =
          (Math.acos(
            (p.x * goal.x + p.z * goal.z) /
              (Math.hypot(p.x, p.z) * Math.hypot(goal.x, goal.z)),
          ) *
            180) /
          Math.PI;
        expect(angle).toBeGreaterThanOrEqual(60 - 1e-3);
        expect(angle).toBeLessThanOrEqual(120 + 1e-3);
        const before = { ...second.current.position };
        a.step(15);
        expect(
          Math.hypot(
            second.current.position.x - before.x,
            second.current.position.z - before.z,
          ),
        ).toBeGreaterThan(0.3);
        flanked = true;
      } finally {
        a.dispose();
      }
    }
    expect(flanked).toBe(true);
  });

  it('Strzelec po serii chowa się na co najmniej sekundę i wychodzi do następnej', async () => {
    const a = await difficultyArena('nightmare', 'cover');
    try {
      a.obstacle({ x: 2, y: 1.5, z: 5 }, { x: 2, y: 3, z: 1 });
      const enemy = a.spawn('gunner', { x: 0, y: 0, z: 9 });
      a.world.step();
      let shots = 0,
        hiddenSteps = 0,
        longestHidden = 0,
        resumed = false;
      a.bus.on('projectile_spawned', ({ owner }) => {
        if (owner === enemy.id) shots++;
      });
      const deps = Reflect.get(enemy, 'deps') as EnemyDependencies;
      for (let i = 0; i < 1200; i++) {
        a.step();
        const hidden = !clearWorld(
          deps,
          { ...enemy.current.position, y: enemy.current.position.y + 1.44 },
          a.position,
        );
        if (shots >= 3 && hidden) hiddenSteps++;
        else hiddenSteps = 0;
        longestHidden = Math.max(longestHidden, hiddenSteps);
        if (longestHidden >= 60 && shots >= 6) {
          resumed = true;
          break;
        }
      }
      expect(longestHidden * SIM_DT).toBeGreaterThanOrEqual(1);
      expect(resumed).toBe(true);
    } finally {
      a.dispose();
    }
  });

  it('bez osłony Strzelec nadal oddaje kolejne serie', async () => {
    const a = await difficultyArena('nightmare', 'no-cover');
    try {
      const enemy = a.spawn('gunner', { x: 0, y: 0, z: 9 });
      let shots = 0;
      a.bus.on('projectile_spawned', ({ owner }) => {
        if (owner === enemy.id) shots++;
      });
      a.step(360);
      expect(shots).toBeGreaterThanOrEqual(6);
      expect(enemy.tacticalGoal).toBeUndefined();
    } finally {
      a.dispose();
    }
  });

  it.each(['easy', 'hard'] as const)(
    '%s: skoordynowane zapowiedzi tylko na wyższym poziomie',
    async (id) => {
      const a = await difficultyArena(id, 'group');
      try {
        const front = a.spawn('assaulter', { x: 0, y: 0, z: 1.7 });
        front.current.yaw = Math.PI;
        a.spawn('assaulter', { x: 0, y: 0, z: -1.7 });
        const starts: { id: number; time: number }[] = [];
        let time = 0;
        a.bus.on('enemy_telegraph', ({ id }) => starts.push({ id, time }));
        for (
          let i = 0;
          i < 240 && new Set(starts.map((s) => s.id)).size < 2;
          i++
        ) {
          time += SIM_DT;
          a.step();
        }
        const first = starts[0]!;
        const second = starts.find((s) => s.id !== first.id)!;
        expect(second).toBeDefined();
        if (id === 'hard')
          expect(second.time - first.time).toBeLessThanOrEqual(0.4);
        else expect(second.time - first.time).toBeGreaterThan(0.4);
      } finally {
        a.dispose();
      }
    },
  );

  it('ciężki cios wywołuje odskok tylko przed graczem, doskok przerywa celowanie', async () => {
    const a = await difficultyArena('nightmare', 'reactions');
    try {
      a.face(Math.PI);
      const front = a.spawn('assaulter', { x: 0, y: 0, z: 2 });
      const back = a.spawn('assaulter', { x: 0, y: 0, z: -2 });
      const gunner = a.spawn('gunner', { x: 0, y: 0, z: 8 });
      gunner.current.state = 'aim';
      for (let i = 0; i < 8 && !front.tacticalGoal; i++)
        a.bus.emit('melee_swing', { attacker: a.player, stage: 'heavy' });
      expect(front.tacticalGoal?.z).toBeGreaterThan(2);
      expect(back.tacticalGoal).toBeUndefined();
      for (let i = 0; i < 8 && !gunner.tacticalGoal; i++)
        a.bus.emit('dash_used', { user: a.player, dir: { x: 0, y: 0, z: 1 } });
      expect(gunner.current.state).toBe('reposition');
      expect(gunner.tacticalGoal).toBeDefined();
      const point = { ...gunner.current.position };
      a.step(10);
      expect(Math.abs(gunner.current.position.x - point.x)).toBeGreaterThan(
        0.1,
      );
    } finally {
      a.dispose();
    }
  });

  it('ostrzał wykorzystuje blok ciosu wręcz i nie skraca zapowiedzi', async () => {
    const a = await difficultyArena('nightmare', 'pressure');
    try {
      const melee = a.spawn('assaulter', { x: 0, y: 0, z: 1.7 });
      const gunner = a.spawn('gunner', { x: 0, y: 0, z: -9 });
      gunner.current.state = 'cooldown';
      expect(a.manager.director?.requestToken(melee.id, 'melee')).toBe(true);
      a.bus.emit('melee_blocked', {
        defender: a.player,
        attacker: melee.id,
        amount: 1,
      });
      expect(a.manager.director?.pressure()).toBe(true);
      a.step();
      expect(gunner.current.state).toBe('aim');
      a.step(Math.floor(gunner.definition.aimTelegraphS! / SIM_DT) - 1);
      expect(gunner.current.state).toBe('aim');
    } finally {
      a.dispose();
    }
  });
});
