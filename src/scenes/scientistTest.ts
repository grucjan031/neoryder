import roomData from '../data/scenes/scientistTest.json';
import waveData from '../data/scenes/scientistTestWaves.json';
import { loadRoom } from '../world/roomSchema';
import { loadWaves } from '../world/waves';
import { RoomScene } from './roomScene';
import { roomTestRun } from './roomTest';

export function createScientistTest(loadModels = true): RoomScene {
  const room = loadRoom(roomData);
  const params = new URLSearchParams(
    typeof location === 'undefined' ? '' : location.search,
  );
  return new ScientistTest(
    room,
    roomTestRun(room, params),
    loadWaves(waveData),
    { loadModels },
  );
}

class ScientistTest extends RoomScene {
  override readonly id = 'scientist-test';
}
