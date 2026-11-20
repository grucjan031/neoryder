import data from '../data/modes/conquest.json';
import assaultData from '../data/modes/assault.json';
import heistData from '../data/modes/heist.json';
import {
  assaultForArena,
  assaultSchema,
  conquestModeSchema,
  heistForArena,
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

/** Szturm: `assaultMode` z listą aren, `assaultDefinition` to dawny mały pokój (`roomId`). */
export const assaultMode = assaultSchema.parse(assaultData);
export const assaultDefinition = assaultMode;
const assaultRoom = roomDefinitions.get(assaultMode.roomId);
if (!assaultRoom) throw new Error('Brak pokoju Szturmu.');
validateMode(assaultMode, assaultRoom, [...enemyDefinitions.keys()]);
for (const id of assaultMode.arenas ?? []) {
  const arena = roomDefinitions.get(id);
  if (!arena) throw new Error(`Brak areny Szturmu: ${id}`);
  validateMode(assaultForArena(assaultMode, arena), arena, [
    ...enemyDefinitions.keys(),
  ]);
}
/** Kradzież rdzenia: `heistMode` z listą aren, `heistDefinition` to dawny mały pokój. */
export const heistMode = heistSchema.parse(heistData);
export const heistDefinition = heistMode;
const heistRoom = roomDefinitions.get(heistMode.roomId);
if (!heistRoom) throw new Error('Brak pokoju Kradzieży rdzenia.');
validateMode(heistMode, heistRoom, [...enemyDefinitions.keys()]);
for (const id of heistMode.arenas ?? []) {
  const arena = roomDefinitions.get(id);
  if (!arena) throw new Error(`Brak areny Kradzieży rdzenia: ${id}`);
  validateMode(heistForArena(heistMode, arena), arena, [
    ...enemyDefinitions.keys(),
  ]);
}
export const modeDefinitions = {
  conquest: conquestDefinition,
  assault: assaultDefinition,
  heist: heistDefinition,
};
/** Definicje z listami aren (do `selectArena`) dla każdego trybu. */
export const modeSources = {
  conquest: conquestMode,
  assault: assaultMode,
  heist: heistMode,
};
