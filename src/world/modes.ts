import data from '../data/modes/conquest.json';
import assaultData from '../data/modes/assault.json';
import { conquestSchema, assaultSchema, validateMode } from './modeSchema';
import { roomDefinitions } from './rooms';
import { enemyDefinitions } from '../enemies/registry';

export const conquestDefinition = conquestSchema.parse(data);
const room = roomDefinitions.get(conquestDefinition.roomId);
if (!room) throw new Error('Brak pokoju Przejęcia.');
validateMode(conquestDefinition, room, [...enemyDefinitions.keys()]);

export const assaultDefinition = assaultSchema.parse(assaultData);
const assaultRoom = roomDefinitions.get(assaultDefinition.roomId);
if (!assaultRoom) throw new Error('Brak pokoju Szturmu.');
validateMode(assaultDefinition, assaultRoom, [...enemyDefinitions.keys()]);
export const modeDefinitions = {
  conquest: conquestDefinition,
  assault: assaultDefinition,
};
