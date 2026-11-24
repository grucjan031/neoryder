import { SAVE_VERSION, type SaveStore } from '../core/save';
import { createStarterMetaState } from '../progression/progressionSchema';
import type { AuditMapData } from '../world/mapAudit';
import type { Scene } from './index';

export interface LoadedMapScene {
  scene: Scene;
  layout: AuditMapData;
}

/**
 * Buduje scenę (arena, kryjówka, pokój, poziom misji) dla mapy o danym id.
 * `peaceful`: gracz z normalną fizyką, ale bez wrogów, bossa i fal (testy map).
 */
export async function loadMapScene(
  id: string,
  params: URLSearchParams,
  store: SaveStore,
  peaceful = false,
): Promise<LoadedMapScene> {
  if (id === 'arena') {
    const { Arena, arenaLayoutSchema } = await import('./arena');
    const layout = arenaLayoutSchema.parse(
      (await import('../data/scenes/arena.json')).default,
    );
    return {
      layout,
      scene: new Arena(true, false, 'arena', undefined, peaceful),
    };
  }
  if (id === 'hideout') {
    const { loadHubLayout } = await import('../world/hubSchema');
    const { HubScene } = await import('./hub');
    const hub = loadHubLayout(
      (await import('../data/hub/hideout.json')).default,
    );
    return {
      layout: hub,
      scene: new HubScene({ layout: hub, metaStore: store }),
    };
  }
  const { roomDefinitions } = await import('../world/rooms');
  const found = roomDefinitions.get(id);
  if (found) {
    const { RoomScene } = await import('./roomScene');
    const { roomTestRun } = await import('./roomTest');
    const { default: waves } = await import('../data/waves/roomTest.json');
    const room = { ...found };
    if (peaceful) delete room.bossEnemy;
    return {
      layout: room,
      scene: new RoomScene(
        room,
        roomTestRun(room, params),
        { ...waves, spawnPoints: room.spawnPoints, waves: [] },
        { manualEncounter: true },
      ),
    };
  }
  const { levelDefinitions } = await import('../world/levels');
  const { missionDefinitions } = await import('../world/missions');
  const level = levelDefinitions.get(id);
  const mission = [...missionDefinitions.values()].find((m) => m.level === id);
  if (!level || !mission) throw new Error(`Nieznana mapa audytu: ${id}`);
  const meta = createStarterMetaState();
  meta.campaign.completed = [...mission.requires];
  await store.saveMeta({
    saveVersion: SAVE_VERSION,
    createdAt: 0,
    updatedAt: 0,
    meta,
  });
  params.set('mission', mission.id);
  const { MissionScene } = await import('./mission');
  return {
    layout: level,
    scene: new MissionScene({ params, store, peaceful }),
  };
}
