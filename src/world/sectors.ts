import kuroganeData from '../data/sectors/kurogane.json';
import bulwarData from '../data/sectors/bulwar.json';
import { loadSector } from './sectorSchema';

export const kuroganeSector = loadSector(kuroganeData);
export const bulwarSector = loadSector(bulwarData);

export function bulwarUnlocked(completed: readonly string[]): boolean {
  return completed.includes('m07-nocny-dyzur');
}
