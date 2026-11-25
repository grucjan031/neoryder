import { describe, it, expect } from 'vitest';
import { Perception } from '../../src/enemies/perception';
import { tuning } from '../../src/core/tuning';
import { difficultyArena } from './difficultyHarness';
import { levelSchema } from '../../src/world/levelSchema';
import levelData from '../../src/data/levels/m01-maszty.json';

const c = tuning.enemies.perception;
const observer = { position: { x: 0, y: 1, z: 0 }, yaw: 0 };
const point = (x: number, z: number) => ({ x, y: 1, z });
const guard = (clear = true) =>
  new Perception(c, { groupId: 'hala' }, () => clear);
describe('Postrzeganie', () => {
  it('schemat odrzuca punkt patrolu poza strefą spotkania', () => {
    const level = levelSchema.parse(levelData),
      encounter = level.encounters[0]!;
    const points = [{ ...encounter.zone.position }];
    encounter.stealth = { patrols: [{ mode: 'loop', points, waitS: 0.75 }] };
    expect(levelSchema.safeParse(level).success).toBe(true);
    points[0]!.x += 1000;
    expect(levelSchema.safeParse(level).success).toBe(false);
  });
  it.each(['loop', 'pingpong'] as const)(
    'patrol %s przestrzega kolejności i postoju',
    (mode) => {
      const points = [point(0, 0), point(0, 3), point(0, 6)];
      const p = new Perception(
        c,
        { groupId: 'a', patrol: { points, mode, waitS: 1 } },
        () => true,
      );
      for (let i = 0; i < points.length; i++) {
        const at = points[i]!;
        expect(p.movement(0.1, at)).toBeUndefined();
        expect(p.movement(1, at)).toBeUndefined();
        expect(p.movement(0.1, at)).toEqual(
          points[i === 2 ? (mode === 'loop' ? 0 : 1) : i + 1],
        );
      }
    },
  );
  it('świadek widzący ofiarę bada miejsce cichej likwidacji', async () => {
    const a = await difficultyArena('normal');
    try {
      const victim = a.manager.spawn(
        'assaulter',
        { x: 0, y: 0, z: 1 },
        { groupId: 'a' },
      );
      const witness = a.manager.spawn(
        'gunner',
        { x: 0, y: 0, z: -6 },
        { groupId: 'b' },
      );
      a.damage.deal(victim.id, {
        amount: 1,
        source: a.player,
        tags: ['#melee'],
      });
      expect(witness.perception?.state).toBe('suspicious');
      expect(witness.perception?.lastKnown?.z).toBe(1);
    } finally {
      a.dispose();
    }
  });
  it('wymaga kąta, zasięgu i drożnego LOS', () => {
    const p = guard();
    expect(p.sees(observer, point(1, 4))).toBe(true);
    for (const pos of [point(4, 1), point(0, -1), point(0, c.visionRangeM + 1)])
      expect(p.sees(observer, pos)).toBe(false);
    expect(guard(false).sees(observer, point(0, 1))).toBe(false);
  });
  it('odległość, ruch i kucanie zmieniają tempo namierzania', () => {
    const rate = (z: number, crouched = false, moving = false) => {
      const p = guard();
      p.step(0.1, observer, {
        position: point(0, z),
        crouched,
        velocity: point(moving ? 2 : 0, 0),
      });
      return p.awareness;
    };
    expect(rate(1)).toBeGreaterThan(rate(15));
    expect(rate(1, true)).toBeCloseTo(rate(1) * c.crouchFactor);
    expect(rate(1, false, true)).toBeCloseTo(rate(1) * c.movingFactor);
  });
  it('podejrzenie zanika, alarm przechodzi przez poszukiwania do patrolu', () => {
    const p = guard(),
      target = { position: point(0, 3) };
    p.suspect(target.position);
    expect(p.state).toBe('suspicious');
    p.step(c.investigateS + 1, observer, null);
    expect([p.state, p.awareness]).toEqual(['unaware', 0]);
    p.step(c.farDetectS, observer, target);
    expect(p.state).toBe('alerted');
    p.step(c.loseSightS, observer, null);
    expect([p.state, p.lastKnown]).toEqual(['searching', target.position]);
    p.step(c.searchS, observer, null);
    expect(p.state).toBe('unaware');
  });
  it('strzał dociera tylko w promieniu słuchu', async () => {
    const a = await difficultyArena('normal');
    try {
      const spawn = (z: number) =>
        a.manager.spawn('gunner', point(0, z), { groupId: 'a' });
      const near = spawn(4),
        far = spawn(c.shotRadiusM + 1);
      a.bus.emit('weapon_fired', { owner: a.player, weapon: 'blaster' });
      expect(near.perception?.awareness).toBe(c.suspicion);
      expect(near.perception?.lastKnown).toEqual(a.position);
      expect(far.perception?.state).toBe('unaware');
    } finally {
      a.dispose();
    }
  });
  it.each(['assaulter', 'executor'])(
    '%s bez celu nie atakuje ani nie zajmuje tokenu; ostrze od tyłu zabija po cichu',
    async (kind) => {
      const a = await difficultyArena('normal');
      try {
        const enemy = a.manager.spawn(
          kind,
          { x: 0, y: 0, z: 1.5 },
          { groupId: 'a' },
        );
        let executions = 0,
          alarms = 0;
        a.bus.on('execute_performed', () => executions++);
        a.bus.on('alarm_raised', () => alarms++);
        a.step(90);
        expect(enemy.current.state).toBe('idle');
        expect(a.manager.director!.snapshot().tokens.melee).not.toContain(
          enemy.id,
        );
        a.damage.deal(enemy.id, {
          amount: 1,
          source: a.player,
          tags: ['#melee'],
        });
        a.step(90);
        expect([
          a.damage.health(enemy.id)?.dead ?? enemy.removed,
          executions,
          alarms,
        ]).toEqual([true, 1, 0]);
      } finally {
        a.dispose();
      }
    },
  );
  it('cios z przodu zadaje zwykłe obrażenia', async () => {
    const a = await difficultyArena('normal');
    try {
      const e = a.manager.spawn(
        'assaulter',
        { x: 0, y: 0, z: -1 },
        { groupId: 'a' },
      );
      a.damage.deal(e.id, { amount: 1, source: a.player, tags: ['#melee'] });
      expect(a.damage.health(e.id)?.dead).toBe(false);
    } finally {
      a.dispose();
    }
  });
  it('zwykły wróg ma identyczny przebieg przy aktywnej odległej grupie stealth', async () => {
    const trace = async (mixed: boolean) => {
      const a = await difficultyArena('normal');
      try {
        const e = a.spawn('assaulter', { x: 0, y: 0, z: 4 });
        if (mixed)
          a.manager.spawn('gunner', { x: 25, y: 0, z: 25 }, { groupId: 'b' });
        const states = [];
        for (let i = 0; i < 120; i++) {
          a.step();
          states.push(structuredClone(e.current));
        }
        return states;
      } finally {
        a.dispose();
      }
    };
    expect(await trace(true)).toEqual(await trace(false));
  });
});
