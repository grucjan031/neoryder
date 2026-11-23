import { expect, it, vi } from 'vitest';
import { MissionObjectives } from '../../src/world/missionObjectives';
import { missionObjectiveSchema } from '../../src/world/missionSchema';

const reach = (id: string, timeLimitS = 95) =>
  missionObjectiveSchema.parse({
    id,
    kind: 'reach',
    label: id,
    position: { x: 20, y: 0, z: 0 },
    radiusM: 2,
    timeLimitS,
  });
const far = { x: 0, y: 0, z: 0 };
const near = { x: 20, y: 1, z: 0 };
function setup() {
  const signal = vi.fn();
  const objectives = [reach('first'), reach('second', 110)];
  const model = new MissionObjectives(
    { objectives },
    ['first', 'second'],
    {},
    { signal, explode: vi.fn() },
    1.6,
    1,
    ['first', 'second'],
  );
  return { model, signal };
}

it('liczy tylko odblokowany odcinek, odpala radio raz i nie pobiera dt z kolejnego odcinka', () => {
  const { model, signal } = setup();
  model.step(10, far);
  expect(model.remainingS).toEqual({ first: 85 });
  expect(model.done('second')).toBe(false);
  model.step(1, near);
  expect(model.objectives.first).toBe('done');
  expect(model.remainingS).toEqual({});
  model.step(1, far);
  expect(model.remainingS).toEqual({ second: 109 });
  expect(
    signal.mock.calls
      .flat()
      .filter((value) => value === 'objective:first:started'),
  ).toHaveLength(1);
});

it('porażka dokładnie na granicy limitu blokuje ukończenie, także debugowe', () => {
  const { model } = setup();
  model.step(94, far);
  model.step(1, near);
  expect(model.failed).toBe('first');
  expect(model.objectives.first).not.toBe('done');
  expect(model.done('first')).toBe(false);
  model.step(1, near);
  expect(model.remainingS.first).toBe(0);
  model.resetTimers();
  model.step(1, far);
  expect(model.failed).toBeNull();
  expect(model.remainingS.first).toBe(94);
});

it('powrót do checkpointu zachowuje ukończony odcinek i odtwarza pełny limit bieżącego', () => {
  const { model } = setup();
  model.step(1, near);
  model.step(110, far);
  expect(model.failed).toBe('second');
  model.resetTimers();
  model.step(1, far);
  expect(model.objectives.first).toBe('done');
  expect(model.remainingS).toEqual({ second: 109 });
});

it('ignoruje dt niepoprawne i pauzę oraz nie zalicza celu na niewłaściwej wysokości', () => {
  const { model } = setup();
  for (const dt of [0, -1, Infinity, NaN]) model.step(dt, near);
  expect(model.remainingS).toEqual({});
  model.step(1, { ...near, y: 3 });
  expect(model.objectives.first).not.toBe('done');
  model.step(1, { ...near, y: 2 });
  expect(model.objectives.first).toBe('done');
});

it.each([0, -1, Infinity, NaN])(
  'odrzuca nieprawidłowy limit %s',
  (timeLimitS) => {
    expect(() => reach('first', timeLimitS)).toThrow();
  },
);
