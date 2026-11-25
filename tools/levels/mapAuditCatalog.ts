import type { AuditMapData } from '../../src/world/mapAudit';

const files = import.meta.glob<AuditMapData>(
  [
    '../../src/data/rooms/*.json',
    '../../src/data/levels/*.json',
    '../../src/data/scenes/arena.json',
    '../../src/data/hub/hideout.json',
  ],
  { eager: true, import: 'default' },
);

export const auditMaps = new Map<string, AuditMapData>();
for (const [path, map] of Object.entries(files).sort(([a], [b]) =>
  a.localeCompare(b, 'en'),
)) {
  const id =
    map.id ??
    path
      .split('/')
      .pop()!
      .replace(/\.json$/, '');
  if (auditMaps.has(id)) throw new Error('Powtórzone id mapy: ' + id);
  auditMaps.set(id, map);
}
