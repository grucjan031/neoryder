import { expect, it, vi } from 'vitest';
import { MissionObjectives } from '../../src/world/missionObjectives';
import type { MissionDefinition } from '../../src/world/missionSchema';

it('pozycja łańcucha pickup → pickup wynika z pozycji pierwszego celu z pozycją', () => {
  const mission = {
    objectives: [
      {
        id: 'mast',
        kind: 'sabotage',
        label: 'Maszt',
        position: { x: 10, y: 0, z: 20 },
      },
      {
        id: 'a',
        kind: 'pickup',
        label: 'A',
        spawnAfter: 'mast',
        offset: { x: 1, y: 0, z: 0 },
      },
      {
        id: 'b',
        kind: 'pickup',
        label: 'B',
        spawnAfter: 'a',
        offset: { x: 0, y: 0, z: 2 },
      },
    ],
  } as unknown as Pick<MissionDefinition, 'objectives'>;
  const model = new MissionObjectives(
    mission,
    ['mast', 'a', 'b'],
    { objectiveProgress: {} },
    { signal: vi.fn(), explode: vi.fn() },
    1.6,
    1,
  );
  expect(model.position(mission.objectives[2]!)).toEqual({
    x: 11,
    y: 0,
    z: 22,
  });
});
