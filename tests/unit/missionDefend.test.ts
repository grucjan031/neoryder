import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/core/events';
import { MissionObjectives } from '../../src/world/missionObjectives';
import { missionDefinitions } from '../../src/world/missions';
import { RunManager } from '../../src/world/run';
import { generateMissionMap } from '../../src/world/sectorMap';
import { kuroganeSector } from '../../src/world/sectors';

const mission = missionDefinitions.get('m03-list-przewozowy')!;
const inside = { x: 0, y: 0, z: 1 };
const outside = { x: 0, y: 0, z: 6.01 };
function create(progress: Record<string, number> = {}) {
  const hooks = { signal: vi.fn(), explode: vi.fn(), reinforce: vi.fn() };
  const model = new MissionObjectives(
    mission,
    ['terminal', 'exit'],
    { objectiveProgress: progress },
    hooks,
    1.6,
    1,
  );
  return { model, hooks };
}

describe('Transfer M03', () => {
  it('podłącza przez 2 s w strefie, zachowuje obie fazy po wyjściu', () => {
    const { model, hooks } = create();
    model.step(100, outside);
    expect(model.progress).toEqual({});
    model.step(1, inside);
    expect(model.progress['terminal:connection']).toBe(0.5);
    expect(model.progress.terminal).toBeUndefined();
    expect(hooks.signal).not.toHaveBeenCalled();
    model.step(10, outside);
    expect(model.progress['terminal:connection']).toBe(0.5);
    model.step(1, inside);
    expect(hooks.signal).toHaveBeenCalledWith('objective:terminal:started');
    expect(model.progress.terminal).toBe(0);
    model.step(9, inside);
    expect(model.progress.terminal).toBeCloseTo(0.1);
    model.step(10, outside);
    expect(model.progress.terminal).toBeCloseTo(0.1);
    expect(model.paused.terminal).toBe(true);
    model.step(9, inside);
    expect(model.progress.terminal).toBeCloseTo(0.2);
    expect(model.paused.terminal).toBe(false);
    model.step(1, outside);
    expect(
      hooks.signal.mock.calls.filter(([s]) => s.endsWith(':paused')),
    ).toHaveLength(1);
  });
  it('granica 6 m jest w strefie, ponad nią i ponad wysokością postęp staje', () => {
    const { model } = create({ 'terminal:connection': 1 });
    model.step(9, { x: 6, y: 0, z: 0 });
    model.step(9, { x: 6.001, y: 0, z: 0 });
    model.step(9, { x: 0, y: 6.001, z: 0 });
    expect(model.progress.terminal).toBeCloseTo(0.1);
  });
  it('fale na 25/55/85% pojawiają się raz mimo odejścia i powrotu', () => {
    const { model, hooks } = create();
    model.step(2, inside);
    for (const seconds of [22.5, 27, 27]) {
      model.step(seconds, inside);
      const count = hooks.reinforce.mock.calls.length;
      model.step(100, outside);
      model.step(0.001, inside);
      expect(hooks.reinforce).toHaveBeenCalledTimes(count);
    }
    expect(hooks.reinforce.mock.calls).toEqual([
      ['missionPatrol', 'terminal:0'],
      ['missionDockShields', 'terminal:1'],
      ['missionPatrol', 'terminal:2'],
    ]);
    model.step(100, inside);
    model.step(100, inside);
    expect(hooks.reinforce).toHaveBeenCalledTimes(3);
    for (const percent of [25, 50, 55, 85, 90, 100])
      expect(
        hooks.signal.mock.calls.filter(
          ([s]) => s === `objective:terminal:progress:${percent}`,
        ),
      ).toHaveLength(1);
  });
  it('duży krok obejmuje wpięcie i wszystkie progi, a odtworzenie nie powtarza fal', () => {
    const { model, hooks } = create();
    model.step(51.5, inside);
    expect(model.progress.terminal).toBeCloseTo(0.55);
    expect(hooks.reinforce).toHaveBeenCalledTimes(2);
    const restored = create(model.progress);
    restored.model.step(100, outside);
    restored.model.step(40.5, inside);
    expect(restored.hooks.reinforce).toHaveBeenCalledExactlyOnceWith(
      'missionPatrol',
      'terminal:2',
    );
    expect(restored.hooks.signal).not.toHaveBeenCalledWith(
      'objective:terminal:started',
    );
  });
  it('ignoruje nieprawidłowy czas i nie uruchamia bramy przed 100%', () => {
    const { model } = create();
    for (const dt of [NaN, Infinity, -1, 0]) model.step(dt, inside);
    expect(model.progress).toEqual({});
    expect(model.done('exit')).toBe(false);
    model.step(100, { x: 0, y: 0, z: -10 });
    expect(model.progress.exit).toBeUndefined();
    model.step(92, inside);
    expect(model.objectives.terminal).toBe('done');
    expect(model.complete).toBe(false);
    model.step(1, { x: 0, y: 0, z: -10 });
    expect(model.complete).toBe(false);
    model.step(1, { x: 0, y: 0, z: -10 });
    expect(model.complete).toBe(true);
  });
  it('zwycięstwo wymaga bramy, samo 100% transferu nie kończy runu', () => {
    const run = new RunManager(new EventBus(), {
      generateMap: (seed) => generateMissionMap(mission, kuroganeSector, seed),
    });
    run.newRun('list', 'classic', { mission });
    for (let layer = 1; layer <= 7; layer++) {
      run.selectNode(run.availableNodes()[0]!.id);
      if (layer === 7) {
        run.updateObjectives(
          { terminal: 'done', exit: 'active' },
          { terminal: 1 },
        );
        expect(run.completeRoom()).toBe(false);
        expect(() => run.finish('victory')).toThrow();
        run.updateObjectives(
          { terminal: 'done', exit: 'done' },
          { terminal: 1, exit: 1 },
        );
      }
      expect(run.completeRoom()).toBe(true);
      if (layer < 7) run.returnToMap();
    }
    expect(run.summary).toMatchObject({
      outcome: 'victory',
      missionId: mission.id,
      missionCompleted: true,
    });
    run.dispose();
  });
});
