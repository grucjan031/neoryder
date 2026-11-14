import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

function filesBelow(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  });
}

it('dane JSON i UI nie zawierają nazw chronionych', () => {
  const protectedNames = /jedi|sith|lightsaber|the force|superhot/i;
  const paths = [
    ...filesBelow('src/data').filter((path) => path.endsWith('.json')),
    ...filesBelow('src/ui'),
  ];
  const violations = paths.flatMap((path) => {
    const content = readFileSync(path, 'utf8');
    return protectedNames.test(content) ? [path] : [];
  });
  expect(violations).toEqual([]);
});
