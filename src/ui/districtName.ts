import text from '../data/ui/missions.pl.json';

export function districtName(sectorId?: string): string {
  return text.missions.district[sectorId === 'bulwar' ? 'bulwar' : 'kurogane'];
}
