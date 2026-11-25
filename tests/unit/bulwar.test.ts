import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { generateSectorMap } from '../../src/world/sectorMap';
import {
  bulwarSector,
  bulwarUnlocked,
  kuroganeSector,
} from '../../src/world/sectors';
import { roomDefinitions } from '../../src/world/rooms';
import {
  enemyDefinitions,
  simulateSectorPath,
} from '../../src/balance/simulator';
import { simulateTypicalRuns, TYPICAL_PATH } from '../../src/balance/metaSim';

it('zachowuje mapę i pełny wynik meta Kurogane sprzed R5d', () => {
  const hash = (value: unknown) =>
    createHash('sha256').update(JSON.stringify(value)).digest('hex');
  expect(hash(generateSectorMap(kuroganeSector, 'r5d'))).toBe(
    '661f8a15e63cdbc863ca3933218894167dd06b4d8b872f8d22d2f28719eab5d0',
  );
  expect(hash(simulateTypicalRuns())).toBe(
    'c0cbcf502bf94850e8c84209d1f5a46c3e50a22d804c2198c7cf853663feaef1',
  );
});

it('otwiera Bulwar po ukończeniu M07', () => {
  expect(bulwarUnlocked(['m06-odlewnia'])).toBe(false);
  expect(bulwarUnlocked(['m07-nocny-dyzur'])).toBe(true);
});

it('generuje powtarzalną mapę Bulwaru ze sklepem i elitami', () => {
  for (let i = 0; i < 40; i++) {
    const seed = String(i);
    const map = generateSectorMap(bulwarSector, seed);
    expect(map).toEqual(generateSectorMap(bulwarSector, seed));
    expect(map.sectorId).toBe('bulwar');
    expect(map.layers).toHaveLength(8);
    const nodes = map.layers.flat();
    for (const g of bulwarSector.guarantees)
      expect(
        nodes.filter(
          (n) =>
            n.type === g.type && n.layer >= g.fromLayer && n.layer <= g.toLayer,
        ).length,
      ).toBeGreaterThanOrEqual(g.min);
  }
});

it('rozwiązuje pule i mierzy większą presję przy tym samym czasie trasy', () => {
  for (const [type, ids] of Object.entries(bulwarSector.roomPools!))
    for (const id of ids!) expect(roomDefinitions.get(id)?.type).toBe(type);
  for (const pool of Object.values(bulwarSector.threat!.pools))
    for (const id of Object.keys(pool!))
      expect(enemyDefinitions.has(id)).toBe(true);
  const [base, act2] = [kuroganeSector, bulwarSector].map((sector) =>
    simulateSectorPath(sector, TYPICAL_PATH, 'r5d'),
  );
  expect(act2!.elapsedS).toBe(base!.elapsedS);
  expect(act2!.pressure / base!.pressure).toBeGreaterThanOrEqual(1.15);
  expect(act2!.pressure / base!.pressure).toBeLessThanOrEqual(1.25);
});
