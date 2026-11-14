import { loadRoom } from './roomSchema';
import type { RoomDefinition } from './roomSchema';

export function loadRoomDefinitions(
  data: readonly unknown[],
): ReadonlyMap<string, RoomDefinition> {
  const definitions = new Map<string, RoomDefinition>();
  for (const raw of data) {
    const definition = loadRoom(raw);
    if (definitions.has(definition.id))
      throw new Error(`Powtórzone id pokoju: ${definition.id}`);
    definitions.set(definition.id, definition);
  }
  return definitions;
}

const modules = import.meta.glob('../data/rooms/*.json', {
  eager: true,
  import: 'default',
});

export const roomDefinitions = loadRoomDefinitions(Object.values(modules));
