import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/core/events';
import { missionDefinitions } from '../../src/world/missions';
import { generateMissionMap } from '../../src/world/sectorMap';
import { kuroganeSector } from '../../src/world/sectors';
import { MissionObjectives } from '../../src/world/missionObjectives';
import { RunManager } from '../../src/world/run';
import { MetaManager } from '../../src/progression/meta';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import { createMemorySaveStore } from '../../src/core/save';
import {
  saveMetaManager,
  loadMetaManager,
} from '../../src/progression/metaSave';

const mission = missionDefinitions.get('m01-maszty')!;
const generate = (seed: string) =>
  generateMissionMap(mission, kuroganeSector, seed);
const create = () => new RunManager(new EventBus(), { generateMap: generate });
function objectives(ids: string[]) {
  const hooks = { signal: vi.fn(), explode: vi.fn() };
  return {
    model: new MissionObjectives(
      mission,
      ids,
      {
        objectives: Object.fromEntries(
          mission.objectives.map((o) => [o.id, 'active']),
        ),
      },
      hooks,
      1.6,
      1,
    ),
    hooks,
  };
}

describe('Mapa misji', () => {
  it('jest deterministyczna, bez elity i bossa, każda ścieżka przechodzi przez cele', () => {
    for (let seed = 0; seed < 30; seed++) {
      const map = generate(String(seed));
      expect(map).toEqual(generate(String(seed)));
      expect(map.layers).toHaveLength(7);
      expect(
        map.layers
          .flat()
          .some((node) => node.type === 'boss' || node.type === 'elite'),
      ).toBe(false);
      for (const fixed of mission.fixedNodes) {
        const layer = map.layers[fixed.layer - 1]!;
        expect(layer).toHaveLength(1);
        expect(layer[0]!.fixed?.roomId).toBe(fixed.roomId);
        for (const before of map.layers[fixed.layer - 2] ?? [])
          expect(before.next).toEqual([layer[0]!.id]);
        expect(layer[0]!.next).toEqual(
          (map.layers[fixed.layer] ?? []).map((node) => node.id),
        );
      }
    }
  });
});

describe('Cele', () => {
  it('zachowuje postęp poza strefą, odlicza lont i wybucha dokładnie raz', () => {
    const { model, hooks } = objectives(['mast-1']);
    const origin = { x: 0, y: 0, z: 0 };
    model.step(1, origin);
    expect(model.progress['mast-1']).toBeCloseTo(0.4);
    model.step(10, { x: 10, y: 0, z: 0 });
    expect(model.progress['mast-1']).toBeCloseTo(0.4);
    model.step(1.5, origin);
    expect(model.fuses['mast-1']).toBe(6);
    model.step(5, origin);
    expect(model.complete).toBe(false);
    model.step(1, origin);
    model.step(10, origin);
    expect(model.complete).toBe(true);
    expect(hooks.explode).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ reinforcements: 'missionPatrol' }),
    );
    expect(hooks.signal).toHaveBeenCalledWith('objective:mast-1:done');
  });
  it('moduł jest dostępny po wybuchu drugiego masztu', () => {
    const { model } = objectives(['mast-2', 'helix']);
    expect(model.done('helix')).toBe(false);
    model.done('mast-2');
    model.step(0.1, { x: 1.5, y: 0, z: 0 });
    expect(model.objectives.helix).toBe('done');
  });
  it('właz jest zablokowany do trzeciego masztu i wymaga dwóch sekund', () => {
    const { model } = objectives(['mast-3', 'exit']);
    model.step(10, { x: 10, y: 0, z: 0 });
    expect(model.progress.exit).toBeUndefined();
    model.done('mast-3');
    model.step(1, { x: 10, y: 0, z: 0 });
    expect(model.complete).toBe(false);
    model.step(1, { x: 10, y: 0, z: 0 });
    expect(model.complete).toBe(true);
  });
});

describe('Run i kampania', () => {
  it('blokuje przedwczesne zwycięstwo i ukończenie pokoju, kończy tylko finał', async () => {
    const run = create();
    run.newRun('mission-test', 'classic', { mission });
    expect(() => run.finish('victory')).toThrow();
    for (let layer = 1; layer <= 7; layer++) {
      const node = run.availableNodes()[0]!;
      run.selectNode(node.id);
      if (node.fixed?.objectives.length) {
        expect(run.completeRoom()).toBe(false);
        const state = run.serialize();
        for (const id of node.fixed.objectives) state.objectives![id] = 'done';
        run.updateObjectives(state.objectives!, {});
      }
      expect(run.completeRoom()).toBe(true);
      if (layer < 7) {
        expect(run.screen).not.toBe('summary');
        run.returnToMap();
      }
    }
    expect(run.summary).toMatchObject({
      outcome: 'victory',
      missionId: mission.id,
      missionCompleted: true,
    });
    const meta = new MetaManager(createStarterMetaState());
    const first = meta.applyRun(run.summary!, 'first');
    expect(meta.applyRun(run.summary!, 'first').applied).toBe(false);
    const second = meta.applyRun(run.summary!, 'second');
    expect(first.rewards.data - second.rewards.data).toBe(60);
    expect(meta.state.campaign).toEqual({
      completed: [mission.id],
      pendingDebrief: mission.id,
    });
    const store = createMemorySaveStore();
    await saveMetaManager(store, meta);
    await saveMetaManager(store, meta);
    const restored = await loadMetaManager(store);
    expect(restored.applyRun(run.summary!, 'second').applied).toBe(false);
    expect(restored.state.campaign.completed).toEqual([mission.id]);
  });
  it('nowa próba po śmierci resetuje cele', () => {
    const run = create();
    run.newRun('first', 'classic', { mission });
    run.updateObjectives({ 'mast-1': 'done' }, { 'mast-1': 1 });
    expect(run.finish('death').missionCompleted).toBe(false);
    run.newRun('second', 'classic', { mission });
    expect(Object.values(run.state.objectives!)).toEqual(
      mission.objectives.map(() => 'pending'),
    );
    expect(run.state.objectiveProgress).toEqual({});
  });
});
