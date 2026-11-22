import { afterEach, describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import { loadSettings, saveSettings, SAVE_VERSION } from '../../src/core/save';
import { CommandRegistry } from '../../src/ui/debugCommands';
import {
  difficulties,
  difficultySchema,
  registerDifficultySetting,
  runDifficulty,
  selectedDifficulty,
  setDifficultyOverride,
} from '../../src/world/difficulty';
import { RunManager } from '../../src/world/run';
import type { DifficultyId } from '../../src/world/difficulty';
import { difficultyArena } from './difficultyHarness';
import { enemyDefinitions } from '../../src/enemies/registry';
import { Stats } from '../../src/core/stats';
import { Rng } from '../../src/core/rng';
import { WaveDirector, loadWaves } from '../../src/world/waves';

afterEach(() => {
  setDifficultyOverride(null);
  registerDifficultySetting(() => loadSettings().difficulty);
});
const ids: DifficultyId[] = ['easy', 'normal', 'hard', 'nightmare'];
it.each(ids)('%s: liczebność, maxAlive i zamrożenie fal po starcie', (id) => {
  const bus = new EventBus();
  let sequence = 0;
  const live = new Set<number>();
  const waves = new WaveDirector(
    loadWaves({
      id: 'counts',
      firstBreakS: 0,
      breakS: 0,
      maxAlive: 2,
      minSpawnDistance: 0,
      spawnPoints: [{ x: 3, z: 3 }],
      waves: [
        { spawnIntervalS: 0.01, groups: [{ enemy: 'assaulter', count: 10 }] },
      ],
    }),
    {
      spawn: () => {
        live.add(++sequence);
        return sequence;
      },
      playerPosition: () => ({ x: 0, y: 0, z: 0 }),
    },
    bus,
    new Rng('counts'),
  );
  try {
    setDifficultyOverride(id);
    waves.start();
    setDifficultyOverride(id === 'easy' ? 'nightmare' : 'easy');
    waves.step(1);
    waves.step(1);
    const cap = Math.max(1, Math.round(2 * difficulties[id].maxAlive));
    expect(waves.aliveCount).toBe(cap);
    expect(waves.aliveCount + waves.queued).toBe(
      Math.round(10 * difficulties[id].count),
    );
    for (let i = 0; i < 50 && waves.currentPhase !== 'done'; i++) {
      for (const enemy of live) {
        bus.emit('enemy_killed', { id: enemy, killer: null, tags: [] });
        live.delete(enemy);
      }
      waves.step(1);
      expect(waves.aliveCount).toBeLessThanOrEqual(cap);
    }
    expect(waves.currentPhase).toBe('done');
    expect(waves.spawnLog).toHaveLength(
      Math.round(10 * difficulties[id].count),
    );
  } finally {
    waves.dispose();
  }
});

it.each(ids)(
  '%s: prawdziwy cios zadaje skalowane obrażenia graczowi',
  async (id) => {
    const a = await difficultyArena(id, 'live-damage');
    try {
      const enemy = a.spawn('assaulter', { x: 0, y: 0, z: 1.7 });
      enemy.current.yaw = Math.PI;
      a.world.step();
      let dealt = 0;
      a.bus.on('damage_dealt', (event) => {
        if (event.target === a.player) dealt += event.amount;
      });
      for (let i = 0; i < 100 && dealt === 0; i++) a.step();
      expect(dealt).toBeCloseTo(15 * difficulties[id].damage);
    } finally {
      a.dispose();
    }
  },
);
const storage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  } as Storage;
};

describe('dane trudności, zapis i debug', () => {
  it('waliduje wszystkie poziomy i chroni minimum 70% zapowiedzi', () => {
    expect(difficultySchema.parse(difficulties)).toEqual(difficulties);
    for (const patch of [
      { telegraph: 0.69 },
      { groupAttack: 1.1 },
      { health: 0 },
      { attackTokens: 1.5 },
      { accuracy: Infinity },
    ])
      expect(
        difficultySchema.safeParse({
          ...difficulties,
          nightmare: { ...difficulties.nightmare, ...patch },
        }).success,
      ).toBe(false);
  });
  it('stare ustawienia i stary run rozwiązuje jako normal bez zmiany wersji', () => {
    const memory = storage();
    memory.setItem('neoryder.settings', JSON.stringify({ fov: 80 }));
    registerDifficultySetting(() => loadSettings(memory).difficulty);
    expect(selectedDifficulty()).toBe('normal');
    const run = new RunManager(new EventBus(), () => ({
      sectorId: 'test',
      layers: [[{ id: 'a', layer: 1, index: 0, type: 'combat', next: [] }]],
    }));
    try {
      const old = run.newRun('legacy');
      setDifficultyOverride('nightmare');
      run.restore(old);
      expect(runDifficulty(run.state)).toBe('normal');
      expect(SAVE_VERSION).toBeGreaterThanOrEqual(6);
    } finally {
      run.dispose();
    }
  });
  it('zamraża hard w stanie i checkpointach mimo zmiany ustawienia, odtwarza po serializacji', () => {
    const memory = storage();
    saveSettings({ ...loadSettings(memory), difficulty: 'hard' }, memory);
    registerDifficultySetting(() => loadSettings(memory).difficulty);
    const run = new RunManager(new EventBus(), () => ({
      sectorId: 'test',
      layers: [[{ id: 'a', layer: 1, index: 0, type: 'combat', next: [] }]],
    }));
    try {
      run.newRun('frozen');
      saveSettings({ ...loadSettings(memory), difficulty: 'easy' }, memory);
      expect(selectedDifficulty()).toBe('easy');
      expect(run.serialize().difficulty).toBe('hard');
      run.selectNode('a');
      expect(run.checkpoint().difficulty).toBe('hard');
      run.restore(JSON.parse(JSON.stringify(run.serialize())));
      expect(runDifficulty(run.state)).toBe('hard');
    } finally {
      run.dispose();
    }
  });
  it('obsługuje nadpisanie URL/debug i odrzuca błędne id bez zmiany wyboru', () => {
    registerDifficultySetting(() => 'easy');
    expect(setDifficultyOverride('hard')).toBe(true);
    expect(selectedDifficulty()).toBe('hard');
    expect(setDifficultyOverride('unknown')).toBe(false);
    expect(selectedDifficulty()).toBe('hard');
    const commands = new CommandRegistry();
    expect(commands.execute('difficulty nightmare')).toContain('nightmare');
    expect(commands.execute('difficulty easy extra')).toContain('Użycie');
    expect(selectedDifficulty()).toBe('nightmare');
  });
});

it.each(ids)(
  '%s: HP, obrażenia i czasy wszystkich archetypów przez Stats',
  async (id) => {
    const arena = await difficultyArena(id);
    try {
      for (const [kind, base] of enemyDefinitions) {
        const enemy = arena.spawn(kind, { x: 15, y: 0, z: 15 });
        expect(arena.damage.health(enemy.id)?.max).toBeCloseTo(
          base.maxHealth * difficulties[id].health,
        );
        const stats = Reflect.get(enemy, 'stats') as Stats;
        const baseDamage = base.boss
          ? 0
          : (base.projectileDamage ?? base.damage);
        if (!base.boss)
          expect(stats.get('damage')).toBeCloseTo(
            baseDamage * difficulties[id].damage,
          );
        expect(enemy.definition.telegraphS).toBeCloseTo(
          base.telegraphS * difficulties[id].telegraph,
        );
        if (base.aimTelegraphS)
          expect(enemy.definition.aimTelegraphS).toBeCloseTo(
            base.aimTelegraphS * difficulties[id].telegraph,
          );
        expect(enemy.definition.cooldownS).toBeCloseTo(
          base.cooldownS * difficulties[id].burstBreak,
        );
      }
      arena.manager.setSpawnModifiers([
        { stat: 'maxHealth', type: 'mult', value: 2, source: 'threat' },
      ]);
      const enemy = arena.spawn('assaulter', { x: -15, y: 0, z: -15 });
      expect(arena.damage.health(enemy.id)?.max).toBeCloseTo(
        120 * difficulties[id].health,
      );
    } finally {
      arena.dispose();
    }
  },
);
