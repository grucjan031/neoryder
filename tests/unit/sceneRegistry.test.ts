import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

it('fabryka rejestru ładuje scenę leniwie i zwraca ją pod własnym id', async () => {
  const pending = scenes['sandbox']?.();
  expect(pending).toBeInstanceOf(Promise);
  expect((await pending)?.id).toBe('sandbox');
}, 60_000);
