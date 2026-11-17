import { expect, it } from 'vitest';
import data from '../../src/data/levels/m01-maszty.json';
import { levelDefinitions, levelWaves } from '../../src/world/levels';
import { levelSchema, loadLevel } from '../../src/world/levelSchema';
import { insideLevelZone, LevelRuntime } from '../../src/world/levelRuntime';
import { missionDefinitions } from '../../src/world/missions';

const level = levelDefinitions.get('m01-maszty')!;
const mission = missionDefinitions.get('m01-maszty')!;

it('oświetla podłogę na całej szerokości i długości każdego zadaszenia M01', () => {
  const roofs = level.blocks.filter(
    ({ position, size }) =>
      position.y - size.y / 2 > 2 && size.y <= 1 && size.x >= 8 && size.z >= 2,
  );
  expect(roofs).toHaveLength(4);
  for (const roof of roofs) {
    const underside = roof.position.y - roof.size.y / 2;
    const lights = (level.lights ?? []).filter(
      ({ position, color, intensity, flicker }) =>
        color === '#fff1d6' &&
        intensity >= 16 &&
        !flicker &&
        position.y > 0 &&
        position.y < underside &&
        Math.abs(position.x - roof.position.x) <= roof.size.x / 2 &&
        Math.abs(position.z - roof.position.z) <= roof.size.z / 2,
    );
    for (
      let x = roof.position.x - roof.size.x / 2;
      x <= roof.position.x + roof.size.x / 2;
      x += 2
    ) {
      for (
        let z = roof.position.z - roof.size.z / 2;
        z <= roof.position.z + roof.size.z / 2;
        z += 2
      ) {
        // Zapas przed końcem zasięgu: tam światło punktowe już zanika.
        expect(
          lights.some(
            ({ position, range }) =>
              Math.hypot(position.x - x, position.y, position.z - z) <=
              range * 0.75,
          ),
          `Brak lokalnego światła pod zadaszeniem przy (${x}, 0, ${z})`,
        ).toBe(true);
      }
    }
  }
});

it('ładuje ciągłą mapę M01 z siedmioma odcinkami, dziesięcioma spotkaniami i kolejnością celów', () => {
  expect(loadLevel(data, mission, levelWaves)).toEqual(level);
  expect(level.sections).toHaveLength(7);
  expect(level.encounters).toHaveLength(10);
  expect(level.objectiveOrder).toEqual([
    'mast-1',
    'mast-2',
    'helix',
    'mast-3',
    'exit',
  ]);
  expect(
    level.sections.reduce(
      (length, section) =>
        length + (section.zone.kind === 'box' ? section.zone.size.x : 0),
      0,
    ),
  ).toBe(320);
});

it('odrzuca błędną geometrię, nieznane fale, duplikaty, brak pozycji i zależności cykliczne', () => {
  expect(
    levelSchema.safeParse({
      ...data,
      gates: [
        { ...data.gates[0], after: { kind: 'objective', id: 'missing' } },
      ],
    }).success,
  ).toBe(false);
  expect(() =>
    loadLevel(
      {
        ...data,
        encounters: data.encounters.map((entry, index) =>
          index === 0 ? { ...entry, wave: 'missing' } : entry,
        ),
      },
      mission,
      levelWaves,
    ),
  ).toThrow('Nieznana fala');
  expect(() =>
    loadLevel(
      { ...data, playerSpawn: { x: 1000, y: 0, z: 0 } },
      mission,
      levelWaves,
    ),
  ).toThrow();
  expect(
    levelSchema.safeParse({
      ...data,
      checkpoints: [data.checkpoints[0], data.checkpoints[0]],
    }).success,
  ).toBe(false);
  expect(
    levelSchema.safeParse({ ...data, objectivePositions: {} }).success,
  ).toBe(false);
  expect(
    levelSchema.safeParse({
      ...data,
      encounters: [
        {
          ...data.encounters[0],
          after: { kind: 'encounter', id: data.encounters[0]!.id },
        },
      ],
    }).success,
  ).toBe(false);
});

it('wyzwala spotkanie raz, respektuje after i otwiera bramę dopiero po jego ukończeniu', () => {
  const runtime = new LevelRuntime(level);
  const first = level.encounters[0]!;
  const second = level.encounters[1]!;
  const gate = level.gates.find((entry) => entry.after.id === first.id)!;
  expect(runtime.step(second.zone.position, {})).toEqual([]);
  expect(runtime.openGates({})).not.toContain(gate.id);
  expect(runtime.step(first.zone.position, {})).toEqual([first.id]);
  expect(runtime.step(first.zone.position, {})).toEqual([]);
  runtime.clear(first.id);
  expect(runtime.openGates({})).toContain(gate.id);
  expect(runtime.step(second.zone.position, {})).toEqual([second.id]);
  expect(runtime.openGates({})).not.toContain('gate-mast-1');
  expect(runtime.openGates({ 'mast-1': 'done' })).toContain('gate-mast-1');
});

it('obsługuje pełny prostopadłościan i promień w trzech wymiarach', () => {
  const sphere = {
    kind: 'sphere' as const,
    position: { x: 0, y: 0, z: 0 },
    radiusM: 2,
  };
  expect(insideLevelZone({ x: 2, y: 0, z: 0 }, sphere)).toBe(true);
  expect(insideLevelZone({ x: 1, y: 2, z: 0 }, sphere)).toBe(false);
  expect(
    insideLevelZone(
      { x: 0, y: 10, z: 0 },
      { kind: 'box', position: sphere.position, size: { x: 2, y: 2, z: 2 } },
    ),
  ).toBe(false);
});
