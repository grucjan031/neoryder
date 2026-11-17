import type { Scene as ThreeScene } from 'three';
import type { GameContext } from '../core/context';
import type { RunState } from '../core/runTypes';
import { loadWaves } from '../world/waves';
import type { RoomDefinition } from '../world/roomSchema';
import { roomDefinitions } from '../world/rooms';
import { threatLevelDef } from '../world/threat';
import { loadoutDefinitions } from '../progression/loadout';
import playerData from '../data/scenes/roomPlayer.json';
import wavesData from '../data/waves/roomTest.json';
import { RoomScene } from './roomScene';

export function createRoomTest(
  loadModels = true,
  layout?: RoomDefinition,
): RoomScene {
  const params = new URLSearchParams(
    typeof location === 'undefined' ? '' : location.search,
  );
  const roomId = params.get('room') ?? 'combatYard';
  const room = layout ?? roomDefinitions.get(roomId);
  if (!room) throw new Error(`Nieznany pokój: ${roomId}`);
  const loadoutId = params.get('loadout') ?? 'classic';
  const loadout = loadoutDefinitions.get(loadoutId);
  if (!loadout) throw new Error(`Nieznany ekwipunek: ${loadoutId}`);
  const threatLevel = Number(params.get('threat') ?? 0);
  threatLevelDef(threatLevel);
  const run: RunState = {
    seed: params.get('seed') ?? 'room-test',
    sectorId: 'room-test',
    loadoutId,
    loadout,
    talents: [],
    threatLevel,
    startedAtMs: 0,
    elapsedS: 0,
    map: {
      sectorId: 'room-test',
      layers: [[{ id: 'test', layer: 1, index: 0, type: room.type, next: [] }]],
    },
    currentNodeId: 'test',
    visited: [],
    hp: playerData.maxHealth,
    energy: playerData.maxEnergy,
    credits: 0,
    implants: [],
    stats: { kills: 0, damage: { melee: 0, power: 0, gun: 0, other: 0 } },
  };
  const waves = loadWaves({
    ...wavesData,
    spawnPoints: room.spawnPoints,
    maxAlive: room.maxAlive ?? wavesData.maxAlive,
    minSpawnDistance: room.minSpawnDistance ?? wavesData.minSpawnDistance,
  });
  return new RoomTest(room, run, waves, { loadModels });
}

class RoomTest extends RoomScene {
  override readonly id = 'room-test';
  private offClear?: () => void;

  override async init(ctx: GameContext, three: ThreeScene): Promise<void> {
    await super.init(ctx, three);
    this.offClear = ctx.commands?.register(
      'run clear',
      'run clear — wyczyść pokój testowy',
      () => {
        this.clear();
        return 'Pokój wyczyszczony.';
      },
    );
  }

  override dispose(): void {
    this.offClear?.();
    super.dispose();
  }
}
