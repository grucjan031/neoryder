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
    expect(procedural).toEqual([]);
    expect(withModel).toBe(files.length - procedural.length);
  });
  it('wieżyczka: węzły głowicy i wylot zgodny z danymi', () => {
    const glb = readFileSync(join(modelDir, 'enemy_turret.glb'));
    // Kawałek JSON zaraz po 12-bajtowym nagłówku GLB: długość i typ, potem treść.
    const json = JSON.parse(
      glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8'),
    ) as {
      nodes: { name?: string; translation?: number[]; children?: number[] }[];
    };
    const byName = new Map(json.nodes.map((n, i) => [n.name, { ...n, i }]));
    const head = byName.get('turret_head');
    expect(head, 'turret_head').toBeDefined();
    expect(head!.translation ?? [0, 0, 0]).toEqual([0, 0, 0]);
    for (const name of ['barrels', 'eye', 'muzzle'])
      expect(head!.children, name).toContain(byName.get(name)?.i);
    const turret = enemySchema.parse(
      JSON.parse(readFileSync(join(dataDir, 'turret.json'), 'utf8')),
    );
    const muzzle = byName.get('muzzle')!.translation!;
    const expected = turret.muzzle!;
    expect(muzzle[0]).toBeCloseTo(expected.x, 3);
    expect(muzzle[1]).toBeCloseTo(expected.y, 3);
    expect(muzzle[2]).toBeCloseTo(expected.z, 3);
  });
  it('odrzuca pusty model', () => {
    const raw = JSON.parse(
      readFileSync(join(dataDir, 'assaulter.json'), 'utf8'),
    ) as Record<string, unknown>;
    expect(enemySchema.safeParse({ ...raw, model: '' }).success).toBe(false);
  });
});
