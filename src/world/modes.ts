import data from '../data/modes/conquest.json';
import { modeSchema, validateMode } from './modeSchema';
import { roomDefinitions } from './rooms';
import { enemyDefinitions } from '../enemies/registry';

export const conquestDefinition = modeSchema.parse(data);
const room = roomDefinitions.get(conquestDefinition.roomId);
if (!room) throw new Error('Brak pokoju Przejęcia.');
validateMode(conquestDefinition, room, [...enemyDefinitions.keys()]);
