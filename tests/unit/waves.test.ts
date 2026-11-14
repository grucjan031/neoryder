import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import type { Vec3 } from '../../src/core/math';
import { Rng } from '../../src/core/rng';
import { SIM_DT } from '../../src/core/loop';
import arenaData from '../../src/data/waves/arena.json';
import { loadWaves, WaveDirector } from '../../src/world/waves';
import type { WavesDefinition } from '../../src/world/waves';

const small: WavesDefinition = {
  id: 'test',
  firstBreakS: 1,
  breakS: 2,
  maxAlive: 2,
  minSpawnDistance: 5,
  spawnPoints: [
    { x: 0, z: 2 },
    { x: 10, z: 0 },
    { x: -10, z: 0 },
  ],
  waves: [
    { spawnIntervalS: 0.5, groups: [{ enemy: 'a', count: 3 }] },
    {
      spawnIntervalS: 0.5,
      groups: [
        { enemy: 'a', count: 1 },
        { enemy: 'b', count: 1 },
      ],
    },
  ],
};

function setup(def: WavesDefinition = small, seed = 'w', limit = Infinity) {
  const bus = new EventBus();
  let next = 100;
  const spawned: { id: number; enemy: string; pos: Vec3 }[] = [];
  const director = new WaveDirector(
    def,
    {
      spawn: (enemy, pos) => {
        if (spawned.length >= limit) return null;
        const id = next++;
        spawned.push({ id, enemy, pos });
        return id;
      },
      playerPosition: () => ({ x: 0, y: 0, z: 0 }),
    },
    bus,
    new Rng(seed),
  );
  const log: { type: keyof GameEvents; payload: unknown }[] = [];
  for (const type of [
    'wave_started',
    'wave_cleared',
    'wave_last_kill',
  ] as const)
    bus.on(type, (payload) => log.push({ type, payload }));
  const run = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds / SIM_DT); i++)
      director.step(SIM_DT);
  };
  const kill = (id: number) =>
    bus.emit('enemy_killed', { id, killer: null, tags: [] });
  return { bus, director, spawned, log, run, kill };
}

describe('dane fal areny', () => {
  it('arena.json jest poprawne i ma 10+ fal o rosnącej liczebności', () => {
    const def = loadWaves(arenaData);
    expect(def.waves.length).toBeGreaterThanOrEqual(10);
    const sizes = def.waves.map((w) =>
      w.groups.reduce((n, g) => n + g.count, 0),
    );
    for (let i = 1; i < sizes.length; i++)
      expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i - 1] ?? 0);
    expect(() => loadWaves({ ...def, waves: [] })).toThrow(/fal/);
  });
});

describe('WaveDirector', () => {
  it('przerwa przed pierwszą falą, potem wave_started i spawn co interwał z limitem maxAlive', () => {
    const c = setup();
    c.director.start();
    c.run(0.9);
    expect(c.spawned).toHaveLength(0);
    c.run(0.2);
    expect(c.log[0]).toEqual({
      type: 'wave_started',
      payload: { wave: 1, count: 3 },
    });
    expect(c.spawned).toHaveLength(1);
    c.run(0.5);
    expect(c.spawned).toHaveLength(2);
    c.run(2); // limit maxAlive = 2
    expect(c.spawned).toHaveLength(2);
    c.kill(c.spawned[0]!.id);
    c.run(0.1);
    expect(c.spawned).toHaveLength(3);
    expect(c.director.currentPhase).toBe('fighting');
  });

  it('ostatni wróg fali: wave_last_kill, wave_cleared, przerwa i następna fala', () => {
    const c = setup();
    c.director.start();
    c.run(3);
    c.kill(c.spawned[0]!.id);
    c.run(1);
    for (const s of c.spawned.slice(1)) c.kill(s.id);
    const types = c.log.map((e) => e.type);
    expect(types).toEqual(['wave_started', 'wave_last_kill', 'wave_cleared']);
    expect(c.log[1]?.payload).toEqual({ wave: 1, id: c.spawned[2]!.id });
    expect(c.director.currentPhase).toBe('break');
    c.run(2.1);
    expect(c.director.wave).toBe(2);
    expect(c.log.at(-1)).toEqual({
      type: 'wave_started',
      payload: { wave: 2, count: 2 },
    });
  });

  it('wrogowie spoza fali (spawn z konsoli) nie liczą się do jej końca', () => {
    const c = setup();
    c.director.start();
    c.run(3);
    c.kill(999);
    expect(c.log.some((e) => e.type === 'wave_cleared')).toBe(false);
  });

  it('po ostatniej fali faza done', () => {
    const c = setup();
    c.director.start(2);
    c.run(2);
    for (const s of c.spawned) c.kill(s.id);
    expect(c.director.currentPhase).toBe('done');
  });

  it('ten sam seed = ten sam przebieg (kolejność i punkty spawnu)', () => {
    const def = loadWaves(arenaData);
    const run = (seed: string) => {
      const c = setup(def, seed);
      c.director.start(10);
      c.run(20);
      return c.spawned.map((s) => `${s.enemy}@${s.pos.x},${s.pos.z}`);
    };
    expect(run('abc')).toEqual(run('abc'));
    expect(run('abc')).not.toEqual(run('xyz'));
  });

  it('punkt spawnu z dala od gracza, gdy to możliwe', () => {
    const c = setup();
    c.director.start();
    c.run(3);
    for (const s of c.spawned)
      expect(Math.hypot(s.pos.x, s.pos.z)).toBeGreaterThanOrEqual(5);
  });

  it('odmowa spawnu (limit ciał) ponawia w kolejnych krokach', () => {
    const c = setup(small, 'w', 1);
    c.director.start();
    c.run(2);
    expect(c.spawned).toHaveLength(1);
    expect(c.director.queued).toBe(2);
  });

  it('goto skacze do fali', () => {
    const c = setup();
    c.director.start();
    c.director.goto(2);
    expect(c.director.wave).toBe(2);
    expect(c.log.at(-1)).toEqual({
      type: 'wave_started',
      payload: { wave: 2, count: 2 },
    });
  });
});
