import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { expect, it } from 'vitest';
import { scenes } from '../../src/scenes';

const source = (path: string): string =>
  readFileSync(resolve(__dirname, '../../src', path), 'utf8');
const staticImports = (code: string): string[] =>
  [...code.matchAll(/^import (?!type\b)[^;]*?from '([^']+)';/gms)].map(
    (match) => match[1]!,
  );

it('rejestr scen nie importuje statycznie żadnej sceny (każda to osobny chunk)', () => {
  expect(staticImports(source('scenes/index.ts'))).toEqual([]);
});

it('start menu nie ciągnie statycznie three ani potoku renderu', () => {
  const imports = staticImports(source('main.ts'));
  expect(imports).not.toContain('three');
  expect(imports).not.toContain('./render/outline');
  expect(imports.filter((path) => path.startsWith('./scenes/'))).toEqual([]);
});

/** Domknięcie importów statycznych (bez `import type`) od pliku startowego: to pobiera menu. */
function staticClosure(entry: string): Set<string> {
  const root = resolve(__dirname, '../../src');
  const seen = new Set<string>();
  const queue = [resolve(root, entry)];
  for (let file = queue.pop(); file; file = queue.pop()) {
    const code = readFileSync(file, 'utf8');
    const specs = [
      ...code.matchAll(/^(?:import|export) (?!type\b)[^;]*?from '([^']+)';/gms),
      ...code.matchAll(/^import '([^']+)';/gm),
    ].map((match) => match[1]!);
    for (const spec of specs) {
      if (!spec.startsWith('.')) {
        seen.add(spec);
        continue;
      }
      const base = resolve(dirname(file), spec);
      const path = [base, `${base}.ts`, resolve(base, 'index.ts')].find(
        (candidate) => /\.\w+$/.test(candidate) && existsSync(candidate),
      );
      if (!path) throw new Error(`Nierozwiązany import ${spec} w ${file}`);
      const id = path
        .slice(root.length + 1)
        .split(sep)
        .join('/');
      if (seen.has(id)) continue;
      seen.add(id);
      if (path.endsWith('.ts')) queue.push(path);
    }
  }
  return seen;
}

it('menu nie pobiera Rapiera, three, danych pokoi ani rejestrów rozgrywki', () => {
  const closure = staticClosure('main.ts');
  expect(closure).toContain('core/save.ts');
  for (const heavy of [
    '@dimforge/rapier3d-compat',
    'three',
    'physics/index.ts',
    'world/rooms.ts',
    'world/missions.ts',
    'world/modes.ts',
    'world/run.ts',
    'enemies/registry.ts',
    'combat/powers/registry.ts',
  ])
    expect(closure, heavy).not.toContain(heavy);
  expect([...closure].filter((id) => id.startsWith('scenes/'))).toEqual([
    'scenes/index.ts',
  ]);
});

it('fabryka rejestru ładuje scenę leniwie i zwraca ją pod własnym id', async () => {
  const pending = scenes['sandbox']?.();
  expect(pending).toBeInstanceOf(Promise);
  expect((await pending)?.().id).toBe('sandbox');
}, 60_000);
