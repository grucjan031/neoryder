import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { expect, it } from 'vitest';

it('dane JSON i kod TypeScript nie zawierają podwójnie kodowanego UTF-8', () => {
  const root = resolve('src');
  const brokenUtf8 =
    /[\u00c4\u00c5\u00c3][\u0080-\u00bf\u201a\u201e\u2020\u2021\u2026\u2039\u203a\u2122]/u;
  const errors: string[] = [];
  for (const entry of readdirSync(root, {
    recursive: true,
    encoding: 'utf8',
  })) {
    const path = join(root, entry);
    const file = relative(process.cwd(), path).replaceAll('\\', '/');
    if (
      !file.endsWith('.ts') &&
      !(file.startsWith('src/data/') && file.endsWith('.json'))
    )
      continue;
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .forEach((line, index) => {
        if (brokenUtf8.test(line))
          errors.push(`${file}:${index + 1}: ${line.trim()}`);
      });
  }
  expect(errors, errors.join('\n')).toEqual([]);
});

it('komentarz przebiegu viewmodelu zachowuje polskie znaki', () => {
  const source = readFileSync('src/render/viewmodelLayer.ts', 'utf8');
  expect(source).toContain(
    'Rysuje viewmodel na kolorze świata, z czystą głębią.',
  );
});
