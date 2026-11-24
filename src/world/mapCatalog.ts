/**
 * TODO: tymczasowy katalog „Testy map” — do usunięcia po audycie map.
 * Te same mapy co w audycie (tools/levels/mapAuditCatalog.ts), ładowane leniwie.
 */
export interface MapCatalogEntry {
  id: string;
  name: string;
}
export interface MapCatalogGroup {
  title: string;
  maps: MapCatalogEntry[];
}

interface Named {
  id?: string;
  name?: string;
  type?: string;
}

const ROOM_GROUPS: [string, string][] = [
  ['combat', 'Pokoje: walka'],
  ['elite', 'Pokoje: elita'],
  ['boss', 'Pokoje: boss'],
  ['puzzle', 'Pokoje: zagadki'],
  ['rest', 'Pokoje: odpoczynek'],
  ['shop', 'Pokoje: sklep'],
];

export async function loadMapCatalog(): Promise<MapCatalogGroup[]> {
  const load = async (
    files: Record<string, () => Promise<unknown>>,
  ): Promise<{ id: string; data: Named }[]> =>
    Promise.all(
      Object.entries(files)
        .sort(([a], [b]) => a.localeCompare(b, 'en'))
        .map(async ([path, loader]) => {
          const data = ((await loader()) as { default: Named }).default;
          const id =
            data.id ??
            path
              .split('/')
              .pop()!
              .replace(/\.json$/, '');
          return { id, data };
        }),
    );
  const rooms = await load(import.meta.glob('../data/rooms/*.json'));
  const levels = await load(import.meta.glob('../data/levels/*.json'));
  const entry = ({ id, data }: { id: string; data: Named }) => ({
    id,
    name: data.name ?? id,
  });
  const bigArena = (id: string) => id.startsWith('arena');
  const groups: MapCatalogGroup[] = [];
  for (const [type, title] of ROOM_GROUPS) {
    const maps = rooms
      .filter((r) => r.data.type === type && !bigArena(r.id))
      .map(entry);
    if (maps.length) groups.push({ title, maps });
  }
  groups.push({
    title: 'Arena i kryjówka',
    maps: [
      { id: 'arena', name: 'Arena (tryb Arena)' },
      { id: 'hideout', name: 'Kryjówka Iskry' },
    ],
  });
  groups.push({
    title: 'Duże areny trybów',
    maps: rooms.filter((r) => bigArena(r.id)).map(entry),
  });
  groups.push({ title: 'Misje', maps: levels.map(entry) });
  return groups;
}
