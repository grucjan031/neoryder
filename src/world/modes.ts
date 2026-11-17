import data from '../data/modes/conquest.json';
import {
  modeSchema,
  modeForArena,
  selectArena,
  validateMode,
} from './modeSchema';
import { roomDefinitions } from './rooms';
import { enemyDefinitions } from '../enemies/registry';

export const conquestMode = modeSchema.parse(data);
const room = roomDefinitions.get(selectArena(conquestMode));
if (!room) throw new Error('Brak pokoju Przejęcia.');
export const conquestDefinition = modeForArena(conquestMode, room);
for (const id of conquestMode.arenas ?? [conquestMode.roomId!]) {
  const arena = roomDefinitions.get(id);
  if (!arena) throw new Error(`Brak areny: ${id}`);
  validateMode(modeForArena(conquestMode, arena), arena, [
    ...enemyDefinitions.keys(),
  ]);
}
