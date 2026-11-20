import { describe, it, expect } from 'vitest';
import { EscortNpc } from '../../src/world/escortNpc';
import type { EscortNavigation } from '../../src/world/escortNpc';
import type { Vec3 } from '../../src/core/math';
import { tuning } from '../../src/core/tuning';

const p = tuning.prototypes.escort;
const DT = 1 / 60;
const at = (x: number, z: number, y = 0): Vec3 => ({ x, y, z });
const evac = at(100, 0);
/** Prosta nawigacja: idź prosto do celu. */
const straight: EscortNavigation = {
  next: (_from, to) => ({ ...to }),
  path: (from, to) => [{ ...from }, { ...to }],
};

function run(npc: EscortNpc, seconds: number, player: Vec3, goal?: Vec3): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) npc.step(DT, player, goal);
}

describe('EscortNpc', () => {
  it('czeka, aż gracz postoi w promieniu uwolnienia', () => {
    const npc = new EscortNpc(at(0, 0), evac, straight, p);
    run(npc, 5, at(p.freeRadiusM + 1, 0));
    expect(npc.state).toBe('waiting');
    run(npc, p.freeHoldS / 2, at(1, 0));
    expect(npc.snapshot().freeProgress).toBeGreaterThan(0.4);
    run(npc, 0.5, at(30, 0));
    expect(npc.snapshot().freeProgress).toBe(0);
    run(npc, p.freeHoldS + 0.1, at(1, 0));
    expect(npc.state).toBe('following');
  });

  it('free() działa tylko z waiting', () => {
    const npc = new EscortNpc(at(0, 0), evac, straight, p);
    expect(npc.free()).toBe(true);
    expect(npc.free()).toBe(false);
  });

  it('idzie za graczem, trzyma dystans i biegnie, gdy jest daleko', () => {
    const npc = new EscortNpc(at(0, 0), evac, straight, p);
    npc.free();
    const far = at(p.catchUpDistanceM + 5, 0);
    npc.step(1, far);
    expect(npc.snapshot().motion).toBe('run');
    expect(npc.position.x).toBeCloseTo(p.catchUpSpeedMps, 5);
    const before = npc.position.x;
    const near = at(before + p.catchUpDistanceM - 1, 0);
    npc.step(1, near);
    expect(npc.snapshot().motion).toBe('walk');
    expect(npc.position.x - before).toBeCloseTo(p.speedMps, 5);
    run(npc, 10, at(30, 0));
    expect(30 - npc.position.x).toBeLessThanOrEqual(p.followDistanceM + 0.3);
    expect(npc.snapshot().motion).toBe('idle');
    expect(npc.snapshot().yaw).toBeCloseTo(Math.PI / 2, 5);
  });

  it('bierze wysokość z punktów nawigacji', () => {
    const ramp: EscortNavigation = {
      next: (_from, to) => ({ ...to }),
      path: () => [],
    };
    const npc = new EscortNpc(at(0, 0, 0), evac, ramp, p);
    npc.free();
    run(npc, 10, at(20, 0, 3));
    expect(npc.position.y).toBeGreaterThan(2.5);
  });

  it('staje poza smyczą i rusza, gdy gracz wróci', () => {
    const npc = new EscortNpc(at(0, 0), evac, straight, p);
    npc.free();
    npc.step(DT, at(p.leashM + 5, 0));
    expect(npc.state).toBe('holding');
    const x = npc.position.x;
    run(npc, 2, at(p.leashM + 5, 0));
    expect(npc.position.x).toBe(x);
    npc.step(DT, at(p.leashM - 2, 0));
    expect(npc.state).toBe('holding');
    npc.step(DT, at(p.leashResumeM - 1, 0));
    expect(npc.state).toBe('following');
  });

  it('kończy sukcesem w strefie ewakuacji (też z holding)', () => {
    const npc = new EscortNpc(at(97, 0), evac, straight, p);
    npc.free();
    npc.step(DT, at(120, 0));
    expect(npc.state).toBe('evacuated');
    expect(npc.finished).toBe(true);
    const x = npc.position.x;
    run(npc, 1, at(0, 0));
    expect(npc.position.x).toBe(x);
    const holding = new EscortNpc(at(90, 0), evac, straight, p);
    holding.free();
    holding.teleport(98, 0);
    holding.step(DT, at(98 - p.leashM - 10, 0));
    expect(holding.state).toBe('evacuated');
  });

  it('ginie przy HP 0, także czekając, i nie wraca', () => {
    const waiting = new EscortNpc(at(0, 0), evac, straight, p);
    waiting.setHp(0);
    expect(waiting.state).toBe('dead');
    const npc = new EscortNpc(at(0, 0), evac, straight, p);
    npc.free();
    npc.setHp(10);
    expect(npc.state).toBe('following');
    expect(npc.hp).toBe(10);
    npc.setHp(0);
    expect(npc.state).toBe('dead');
    npc.setHp(p.maxHealth);
    expect(npc.state).toBe('dead');
    expect(npc.free()).toBe(false);
    const x = npc.position.x;
    run(npc, 1, at(50, 0));
    expect(npc.position.x).toBe(x);
  });

  it('wykrywa utknięcie i przesuwa o krok ścieżki', () => {
    const blocked: EscortNavigation = {
      next: (from) => ({ ...from }),
      path: (from) => [
        { ...from },
        at(from.x + 1, from.z),
        at(from.x + 2, from.z),
      ],
    };
    const npc = new EscortNpc(at(0, 0), evac, blocked, p);
    npc.free();
    run(npc, p.stuckS - 0.5, at(20, 0));
    expect(npc.stuckEvents).toBe(0);
    run(npc, 1, at(20, 0));
    expect(npc.stuckEvents).toBe(1);
    expect(npc.position.x).toBeGreaterThanOrEqual(p.unstickMinStepM);
    run(npc, p.stuckS + 0.1, at(20, 0));
    expect(npc.stuckEvents).toBe(2);
  });

  it('zwykły marsz ani postój przy graczu nie liczą się jako utknięcie', () => {
    const npc = new EscortNpc(at(0, 0), evac, straight, p);
    npc.free();
    run(npc, 30, at(60, 0));
    run(npc, 10, at(npc.position.x + 1, 0));
    expect(npc.stuckEvents).toBe(0);
  });

  it('ignoruje nieprawidłowy dt i HP', () => {
    const npc = new EscortNpc(at(0, 0), evac, straight, p);
    npc.free();
    npc.step(0, at(50, 0));
    npc.step(NaN, at(50, 0));
    npc.setHp(NaN);
    expect(npc.position.x).toBe(0);
    expect(npc.hp).toBe(p.maxHealth);
  });
});
