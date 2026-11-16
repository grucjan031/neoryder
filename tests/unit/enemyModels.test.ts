import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { enemySchema } from '../../src/enemies/enemySchema';

const dataDir = join(__dirname, '../../src/data/enemies');
const modelDir = join(__dirname, '../../public/assets/models');

describe('Modele wrogów w danych', () => {
  const files = readdirSync(dataDir).filter((f) => f.endsWith('.json'));
  it('każdy wróg z polem model ma plik GLB w public/assets/models', () => {
    let withModel = 0;
    const procedural: string[] = [];
    for (const file of files) {
      const definition = enemySchema.parse(
        JSON.parse(readFileSync(join(dataDir, file), 'utf8')),
      );
      if (definition.model === undefined) {
        procedural.push(definition.id);
        continue;
      }
      withModel++;
      expect(
        existsSync(join(modelDir, `${definition.model}.glb`)),
        `${file}: brak ${definition.model}.glb`,
      ).toBe(true);
    }
    expect(procedural).toEqual(['turret']);
    expect(withModel).toBe(files.length - procedural.length);
  });
  it('odrzuca pusty model', () => {
    const raw = JSON.parse(
      readFileSync(join(dataDir, 'assaulter.json'), 'utf8'),
    ) as Record<string, unknown>;
    expect(enemySchema.safeParse({ ...raw, model: '' }).success).toBe(false);
  });
});
