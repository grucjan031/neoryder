import { describe, expect, it } from 'vitest';
import inventoryText from '../../src/data/ui/inventory.pl.json';
import runText from '../../src/data/ui/run.pl.json';
import progression from '../../src/data/meta/progression.json';
import npcTexts from '../../src/data/hub/npcs.pl.json';

describe('spójność tekstów danych', () => {
  it('rzadkości mają te same nazwy w ekwipunku i na ekranach runu', () => {
    expect(inventoryText.rarities).toEqual(runText.rarities);
  });

  it('Marek mówi o liczbie modułów zgodnej z progresją', () => {
    const words: Record<number, string> = { 2: 'dwa', 3: 'trzy', 4: 'cztery' };
    const marek = npcTexts.npcs.find((npc) => npc.id === 'marek');
    const text = (marek?.lines ?? []).join(' ');
    expect(text).toContain(
      `wkręcisz ${words[progression.moduleSlotsPerWeapon]} moduły`,
    );
  });
});
