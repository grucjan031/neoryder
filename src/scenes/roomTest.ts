import type { Scene as ThreeScene } from 'three';
import type { GameContext } from '../core/context';
import type { RunState } from '../core/runTypes';
import { z } from 'zod';
import { loadWaves } from '../world/waves';
import type { WavesDefinition } from '../world/waves';
import { vec3Schema } from '../world/roomSchema';
import type { RoomDefinition } from '../world/roomSchema';
import { roomDefinitions } from '../world/rooms';
import { threatLevelDef } from '../world/threat';
import { loadoutDefinitions } from '../progression/loadout';
import playerData from '../data/scenes/roomPlayer.json';
import wavesData from '../data/waves/roomTest.json';
import wallData from '../data/scenes/viewmodelWall.json';
import wallText from '../data/scenes/viewmodelWall.pl.json';
import { RoomScene } from './roomScene';

const wall = z
  .object({ room: z.string().min(1), playerSpawn: vec3Schema })
  .parse(wallData);
const wallLabels = z
  .object({ help: z.string().min(1), ready: z.string().min(1) })
  .parse(wallText);

/** Stan runu pokoju testowego z parametrów URL (`loadout`, `threat`, `seed`). */
export function roomTestRun(
  room: RoomDefinition,
  params: URLSearchParams,
): RunState {
  const loadoutId = params.get('loadout') ?? 'classic';
  const loadout = loadoutDefinitions.get(loadoutId);
  if (!loadout) throw new Error(`Nieznany ekwipunek: ${loadoutId}`);
  const threatLevel = Number(params.get('threat') ?? 0);
  threatLevelDef(threatLevel);
  return {
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
}

export function createRoomTest(
  loadModels = true,
  layout?: RoomDefinition,
): RoomScene {
  const params = new URLSearchParams(
    typeof location === 'undefined' ? '' : location.search,
  );
  const wallMode = !layout && params.get('viewmodel') === 'wall';
  const roomId = wallMode ? wall.room : (params.get('room') ?? 'combatYard');
  const baseRoom = layout ?? roomDefinitions.get(roomId);
  if (!baseRoom) throw new Error(`Nieznany pokój: ${roomId}`);
  const room = wallMode
    ? { ...baseRoom, playerSpawn: wall.playerSpawn }
    : baseRoom;
  const run = roomTestRun(room, params);
  const waves = loadWaves({
    ...wavesData,
    spawnPoints: room.spawnPoints,
    maxAlive: room.maxAlive ?? wavesData.maxAlive,
    minSpawnDistance: room.minSpawnDistance ?? wavesData.minSpawnDistance,
  });
  return new RoomTest(room, run, waves, loadModels, wallMode);
}

class RoomTest extends RoomScene {
  override readonly id = 'room-test';
  private offClear?: () => void;
  private offWall?: () => void;

  constructor(
    room: RoomDefinition,
    run: RunState,
    waves: WavesDefinition,
    loadModels: boolean,
    private readonly wallMode: boolean,
  ) {
    super(room, run, waves, { loadModels, manualEncounter: wallMode });
  }

  override async init(ctx: GameContext, three: ThreeScene): Promise<void> {
    await super.init(ctx, three);
    if (this.disposed) return;
    this.offClear = ctx.commands?.register(
      'run clear',
      'run clear — wyczyść pokój testowy',
      () => {
        this.clear();
        return 'Pokój wyczyszczony.';
      },
    );
    if (this.wallMode) {
      const position = this.playerSnapshot().position;
      this.offWall = ctx.commands?.register(
        'viewmodel wall',
        wallLabels.help,
        () => {
          this.prepareEncounter({
            position,
            invulnerable: false,
            passive: true,
          });
          return wallLabels.ready;
        },
      );
    }
  }

  override dispose(): void {
    this.offClear?.();
    this.offWall?.();
    super.dispose();
  }
}
