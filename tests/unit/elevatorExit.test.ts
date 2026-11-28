import { expect, it } from 'vitest';
import { Scene } from 'three';
import { EventBus } from '../../src/core/events';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import type { Action, InputSnapshot } from '../../src/core/input';
import type { PlayerController } from '../../src/player/playerController';
import type { ElevatorCabin } from '../../src/world/elevatorCabin';
import { facePoint } from '../../src/world/elevatorSchema';
import { createRoomTest, testRoomById } from '../../src/scenes/roomTest';

const snapshot = (...held: Action[]): InputSnapshot => ({
  held: new Set(held),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
});
interface Internals {
  cabins: Map<string, ElevatorCabin>;
  player: PlayerController;
}

it.each(['run4', 'run7'])(
  'gracz wjeżdża windą %s na każde piętro i wychodzi przez otwarte drzwi',
  async (id) => {
    const scene = createRoomTest(false, testRoomById(id));
    try {
      await scene.init(
        {
          bus: new EventBus(),
          tuning: structuredClone(tuning),
          rng: new Rng('lift'),
          loop: new GameLoop({ step() {}, render() {} }),
          debug: false,
        },
        new Scene(),
      );
      const inner = scene as unknown as Internals;
      const cabin = [...inner.cabins.values()][0]!;
      const { def, state } = cabin;
      const at = () => inner.player.getState().position;
      const wait = (done: () => boolean, n = 1800) => {
        for (let i = 0; i < n && !done(); i++) scene.step(SIM_DT, snapshot());
        expect(done()).toBe(true);
      };
      const first = state.stop;
      const order = [
        first,
        ...def.stops.map((_, i) => i).filter((i) => i !== first),
        first,
      ];
      for (const stop of order) {
        const y = def.stops[stop]!.y;
        cabin.request(stop);
        wait(() => state.stop === stop && state.phase === 'open');
        if (Math.hypot(at().x - def.x, at().z - def.z) > def.width / 2 - 0.5)
          scene.teleportPlayer({ x: def.x, y, z: def.z }, 0);
        const out = facePoint(def, def.stops[stop]!.doorSide, y, 1.5);
        const p = at();
        const yaw =
          (Math.atan2(-(out.x - p.x), -(out.z - p.z)) * 180) / Math.PI;
        scene.teleportPlayer({ x: p.x, y, z: p.z }, yaw);
        for (let i = 0; i < 80; i++)
          scene.step(SIM_DT, snapshot('moveForward'));
        const q = at();
        console.log('wyjście', stop, JSON.stringify(q), JSON.stringify(out));
        expect(Math.hypot(q.x - out.x, q.z - out.z)).toBeLessThan(2.5);
        expect(q.y - tuning.player.capsuleHeight / 2).toBeCloseTo(y, 1);
        // Powrót do kabiny przed kolejną jazdą.
        cabin.request(stop);
        wait(() => state.phase === 'open');
        scene.teleportPlayer({ x: def.x, y, z: def.z }, 0);
        for (let i = 0; i < 5; i++) scene.step(SIM_DT, snapshot());
      }
    } finally {
      scene.dispose();
    }
  },
  120_000,
);
