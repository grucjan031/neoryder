import data from '../data/scenes/elevatorTest.json';
import waves from '../data/waves/roomTest.json';
import { loadRoom } from '../world/roomSchema';
import { loadWaves } from '../world/waves';
import { roomTestRun } from './roomTest';
import { RoomScene } from './roomScene';

export class ElevatorTest extends RoomScene {
  override readonly id = 'elevator-test';
  constructor(loadModels = true) {
    const room = loadRoom(data);
    super(
      room,
      roomTestRun(
        room,
        new URLSearchParams(
          typeof location === 'undefined' ? '' : location.search,
        ),
      ),
      loadWaves({ ...waves, spawnPoints: room.spawnPoints }),
      { loadModels },
    );
  }
}
