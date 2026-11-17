import data from '../data/modes/conquest.json';
import assaultData from '../data/modes/assault.json';
import heistData from '../data/modes/heist.json';
import {
  assaultSchema,
  conquestModeSchema,
  heistSchema,
  modeForArena,
  selectArena,
  validateMode,
} from './modeSchema';
import { roomDefinitions } from './rooms';
import { enemyDefinitions } from '../enemies/registry';

export const conquestMode = conquestModeSchema.parse(data);
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

export const assaultDefinition = assaultSchema.parse(assaultData);
const assaultRoom = roomDefinitions.get(assaultDefinition.roomId);
if (!assaultRoom) throw new Error('Brak pokoju Szturmu.');
validateMode(assaultDefinition, assaultRoom, [...enemyDefinitions.keys()]);
export const heistDefinition = heistSchema.parse(heistData);
const heistRoom = roomDefinitions.get(heistDefinition.roomId);
if (!heistRoom) throw new Error('Brak pokoju Kradzieży rdzenia.');
validateMode(heistDefinition, heistRoom, [...enemyDefinitions.keys()]);
export const modeDefinitions = {
  conquest: conquestDefinition,
  assault: assaultDefinition,
  heist: heistDefinition,
};
