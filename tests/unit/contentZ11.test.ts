import { describe, expect, it } from 'vitest';
import { statusDefinitions } from '../../src/combat/status/statusSchema';
import blade from '../../src/data/blades/plasmaBlade.json';
import floodedTunnel from '../../src/data/rooms/combatFloodedTunnel.json';
import laserYard from '../../src/data/rooms/combatLaserYard.json';
import substation from '../../src/data/rooms/combatSubstation.json';
import chemPlant from '../../src/data/rooms/eliteChemPlant.json';
import closeCircuit from '../../src/data/synergies/closeCircuit.json';
import emberRelay from '../../src/data/synergies/emberRelay.json';
import executionVent from '../../src/data/synergies/executionVent.json';
import killSwitch from '../../src/data/synergies/killSwitch.json';
import mirrorBurst from '../../src/data/synergies/mirrorBurst.json';
import parryLock from '../../src/data/synergies/parryLock.json';
import resonanceSiphon from '../../src/data/synergies/resonanceSiphon.json';
import shockFracture from '../../src/data/synergies/shockFracture.json';
import {
  loadSynergyDefinitions,
  synergyDefinitions,
} from '../../src/progression/synergies';
import { loadRoomDefinitions, roomDefinitions } from '../../src/world/rooms';

const newRooms = [substation, laserYard, chemPlant, floodedTunnel];
const newSynergies = [
  parryLock,
  shockFracture,
  executionVent,
  killSwitch,
  emberRelay,
  resonanceSiphon,
  mirrorBurst,
  closeCircuit,
];

describe('Z11: pokoje z zagrożeniami', () => {
  // Pule sektora tymczasowo zawierają tylko run1, więc te pokoje są poza runem.
  it.each(newRooms)('$id przechodzi loader', (raw) => {
    const room = loadRoomDefinitions([raw]).get(raw.id)!;
    expect(room).toEqual(raw);
    expect(roomDefinitions.get(raw.id)).toEqual(room);
    expect(room.hazards?.length).toBeGreaterThan(0);

    // validateLayout kontroluje margines pól i laserów, ale pomija beczki.
    for (const hazard of room.hazards ?? []) {
      if (hazard.kind !== 'explosive_barrel') continue;
      for (const point of [room.playerSpawn, ...room.spawnPoints]) {
        expect(
          Math.hypot(point.x - hazard.position.x, point.z - hazard.position.z),
          `${room.id}: spawn przy ${hazard.id}`,
        ).toBeGreaterThan(1.4);
      }
      for (const block of room.blocks) {
        if (
          block.position.y + block.size.y / 2 <= room.playerSpawn.y ||
          block.position.y - block.size.y / 2 >= hazard.position.y + 1.1
        )
          continue;
        const overlaps =
          Math.abs(block.position.x - hazard.position.x) <
            block.size.x / 2 + 0.4 &&
          Math.abs(block.position.z - hazard.position.z) <
            block.size.z / 2 + 0.4;
        expect(overlaps, `${room.id}: beczka ${hazard.id} w bloku`).toBe(false);
      }
    }
  });
});

describe('Z11: synergie', () => {
  it.each(newSynergies)('$id ładuje się bez utraty pól', (raw) => {
    const [definition] = loadSynergyDefinitions([raw]);
    expect(definition).toEqual(raw);
    expect(synergyDefinitions.find((def) => def.id === raw.id)).toEqual(raw);
  });

  it('dodaje dwie synergie na parę ścieżek oraz dwie z progami tagów', () => {
    const definitions = loadSynergyDefinitions(newSynergies);
    for (const pair of [
      ['#build_blade', '#build_resonance'],
      ['#build_blade', '#build_gunner'],
      ['#build_resonance', '#build_gunner'],
    ]) {
      expect(
        definitions.filter(
          (def) =>
            def.requires.length === pair.length &&
            pair.every((tag) => def.requires.includes(tag)),
        ),
      ).toHaveLength(2);
    }
    expect(definitions.filter((def) => def.requiresCount)).toHaveLength(2);
  });

  it.each(newSynergies)(
    '$id mieści się w budżecie obrażeń i leczenia',
    (raw) => {
      const definition = loadSynergyDefinitions([raw])[0]!;
      const damageLimit = blade.combo[0]!.damage * 0.4;
      let damage = 0;
      let healing = 0;
      for (const effect of definition.effects) {
        if (
          effect.kind === 'explode' ||
          effect.kind === 'heal' ||
          effect.kind === 'apply_status_area'
        )
          expect(definition.cooldownS).toBeGreaterThan(0);

        if (effect.kind === 'explode') damage += effect.damage;
        if (effect.kind === 'heal') healing += effect.amount;
        if (effect.kind === 'apply_status_area') {
          const status = statusDefinitions.get(effect.status)!;
          // Uwzględniamy również obrażenia pośrednie i już zgromadzone stosy.
          if (status.tick)
            damage +=
              Math.ceil(effect.durationS / status.tick.intervalS) *
              status.tick.damage *
              status.maxStacks;
          damage += status.onMaxStacks?.discharge?.damage ?? 0;
        }
        // Łańcuch i mnożnik obrażeń nie mają stałego limitu w tym schemacie.
        expect(effect.kind).not.toBe('chain_on_hit');
        if (effect.kind === 'stat_modifier_timed')
          expect(effect.stat).not.toBe('damage');
      }
      expect(damage).toBeLessThanOrEqual(damageLimit);
      expect(healing).toBeLessThanOrEqual(6);
    },
  );
});
