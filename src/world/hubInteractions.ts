import data from '../data/hub/interactions.json';
import { loadHubInteractions } from './hubSchema';

/** Zwalidowane `src/data/hub/interactions.json`. */
export const hubInteractions = loadHubInteractions(data);
