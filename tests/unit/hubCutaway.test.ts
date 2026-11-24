import { expect, it } from 'vitest';
import {
  HubCutaway,
  noodlesState,
  catState,
  shotCamera,
} from '../../src/scenes/hubCutaway';
import { tuning } from '../../src/core/tuning';
const s = tuning.hub.cutaway;
const shot = {
  playerPos: { x: 0, y: 0, z: 0 },
  playerYaw: 0,
  targetPos: { x: 0, y: 0, z: 1 },
};
it('ramen znika podczas jedzenia, Hela wymienia pustą miskę', () => {
  for (const [t, phase, fill, visible] of [
    [0, 'serve', 1, true],
    [0.22, 'pickUp', 1, true],
    [0.5, 'eat', 0.5, true],
    [0.68, 'putDown', 0, true],
    [0.78, 'push', 0, true],
    [0.84, 'take', 0, true],
    [0.9, 'take', 0, false],
    [0.94, 'return', 1, true],
  ] as const) {
    expect(noodlesState(t)).toMatchObject({ phase, visible });
    expect(noodlesState(t).fill).toBeCloseTo(fill);
  }
  expect(catState(0.1)).toEqual({ phase: 'kneel', progress: 0.5 });
  expect(catState(0.5).progress).toBeCloseTo(0.5);
  expect(catState(0.9).phase).toBe('rise');
});
it('kamera interpoluje oba końce ujęcia i zachowuje pozycję przy pauzie', () => {
  const c = new HubCutaway();
  c.start('noodles', shot);
  expect(c.cameraBlend(1)).toBe(0);
  c.step(s.blendInS);
  expect(c.cameraBlend(0.5)).toBeCloseTo(0.5);
  expect(c.t(0.5)).toBeCloseTo(s.blendInS / 2 / s.noodlesS);
  c.step(0);
  expect(c.cameraBlend(0.5)).toBeCloseTo(0.5);
  expect(c.cameraBlend(1)).toBe(1);
  c.step(s.noodlesS - s.blendInS - s.blendOutS / 2);
  expect(c.cameraBlend(1)).toBeCloseTo(0.5);
  c.step(s.blendOutS);
  expect(c.active).toBe(false);
});
it('pominięcie podczas odjazdu wraca bez skoku i nie przedłuża powrotu', () => {
  const c = new HubCutaway();
  c.start('cat', shot);
  c.step(s.blendInS / 2);
  const blend = c.cameraBlend(1);
  c.skip();
  expect(c.cameraBlend(1)).toBeCloseTo(blend);
  c.step(0.2);
  expect(c.cameraBlend(1)).toBeLessThan(blend);
  const t = c.t(1);
  c.skip();
  expect(c.t(1)).toBe(t);
  c.step(s.blendOutS);
  expect(c.active).toBe(false);
});
it('sprawdza kolejność kandydatów, ściany i przesłonięcie rekwizytu', () => {
  const head = { x: 0, y: 1.55, z: 0 };
  const subjects = { head, chest: head, focus: shot.targetPos };
  const free = (_origin: typeof head, _dir: typeof head, max: number) => max;
  const choose = (ray = free) => shotCamera(shot, 'noodles', subjects, [], ray);
  const [a0, a1] = s.noodlesAnglesDeg;
  const first = choose();
  expect(first).toMatchObject({ degrees: a0, occlusions: 0 });
  expect(first.position.y).toBe(s.heightM);
  expect(
    Math.hypot(
      first.position.x - first.look.x,
      first.position.y - first.look.y,
      first.position.z - first.look.z,
    ),
  ).toBeCloseTo(s.distanceM);
  // Bryła między pierwszym kandydatem a głową postaci: wybór przechodzi na drugiego.
  const near = (o: typeof head) =>
    Math.hypot(o.x - first.position.x, o.z - first.position.z) < 1e-6;
  expect(choose((o, _dir, max) => (near(o) ? 0.1 : max)).degrees).toBe(a1);
  // Wszystko zasłonięte: zostaje pierwszy kandydat ze ścianą i oboma przesłonięciami.
  expect(choose(() => 0)).toMatchObject({ degrees: a0, occlusions: 3 });
  const sphere = { center: first.position, radius: 0.35, owner: 'npc' };
  expect(shotCamera(shot, 'noodles', subjects, [sphere], free)).toMatchObject({
    degrees: a1,
    occlusions: 0,
  });
});
