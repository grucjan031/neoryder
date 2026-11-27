import { Box3, Euler, Matrix4, Quaternion, Ray, Vector3 } from 'three';
import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { roomDefinitions } from '../../src/world/rooms';
const room = roomDefinitions.get('run6')!;
const blocks = room.blocks.filter((b) => b.visible !== false);
type Point = { x: number; y: number; z: number };
function local(b: (typeof blocks)[number]) {
  const r = b.rotation;
  return new Matrix4()
    .compose(
      new Vector3().copy(b.position),
      new Quaternion().setFromEuler(new Euler(r?.x, r?.y, r?.z)),
      new Vector3(1, 1, 1),
    )
    .invert();
}
function bounds(b: (typeof blocks)[number]) {
  const half = new Vector3().copy(b.size).multiplyScalar(0.5);
  return new Box3(half.clone().negate(), half);
}
function gap(p: Point, b: (typeof blocks)[number]) {
  return bounds(b).distanceToPoint(
    new Vector3().copy(p).applyMatrix4(local(b)),
  );
}
it('mocuje szyldy, ekrany i plakaty do widocznej konstrukcji', () => {
  for (const s of [
    ...room.signs!,
    ...room.decals!.filter((d) => d.surface === 'wall'),
  ])
    expect(
      blocks.some((b) => gap(s.position, b) < 0.101),
      s.texture,
    ).toBe(true);
});
it('utrzymuje oprawy z dala od ścian i wyłącza plamy światła', () => {
  expect(room.lights!.length).toBeLessThanOrEqual(64);
  const walls = blocks.filter(
    (b) =>
      b.size.y > 2.6 && Math.min(b.size.x, b.size.z) === 0.18 && !b.ceiling,
  );
  const lamps = room.decor!.filter((d) =>
    d.model.startsWith('bw_targ_paper_lantern'),
  );
  for (const l of room.lights!) {
    expect(l.groundGlow).toBe(false);
    expect(l.cone).not.toBe(true);
    expect(l.floorY).toBeDefined();
    expect(
      walls.every((b) => gap(l.position, b) >= 1.6),
      JSON.stringify(l),
    ).toBe(true);
    expect(
      lamps.some(
        (d) =>
          Math.hypot(l.position.x - d.position.x, l.position.z - d.position.z) <
            0.02 && Math.abs(l.position.y - d.position.y) < 0.3,
      ) ||
        blocks.some(
          (b) =>
            (b.material?.startsWith('neon_') ||
              ['rubber', 'light_panel'].includes(b.material ?? '')) &&
            gap(l.position, b) < 0.42,
        ),
    ).toBe(true);
    for (const slab of blocks.filter(
      (b) => (b.ceiling && Math.max(b.size.x, b.size.z) >= 4) || b.walkable,
    )) {
      const underside = slab.position.y - slab.size.y / 2;
      if (
        underside > l.position.y &&
        Math.abs(l.position.x - slab.position.x) <= slab.size.x / 2 &&
        Math.abs(l.position.z - slab.position.z) <= slab.size.z / 2 &&
        !slab.rotation
      )
        expect(
          underside - l.position.y,
          JSON.stringify(l),
        ).toBeGreaterThanOrEqual(1.2);
    }
  }
});
it('chroni pełne połacie i zostawia obie szczeliny i pas doku pod deszczem', () => {
  const sheltered = (x: number, z: number) =>
    room.rainShelters!.some(
      (s) =>
        Math.abs(s.position.x - x) < s.size.x / 2 &&
        Math.abs(s.position.z - z) < s.size.z / 2,
    );
  for (const z of [-12, 0, 19]) {
    for (const x of [-2, 2]) expect(sheltered(x, z)).toBe(false);
    for (const x of [-5, 0, 5]) expect(sheltered(x, z)).toBe(true);
  }
  for (const z of [-36, -25, -19]) {
    expect(sheltered(27, z)).toBe(false);
    expect(sheltered(20, z)).toBe(true);
  }
});
it('kadruje dwanaście pisanek z dwóch metrów bez przesłon z brył', () => {
  type Shot = {
    name: string;
    x: number;
    z: number;
    floorY: number;
    yaw: number;
    pitch: number;
  };
  const result = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "import {shots} from './tools/arenas/run/run6.mjs';console.log(JSON.stringify(shots))",
    ],
    { encoding: 'utf8' },
  );
  const shots: Shot[] = JSON.parse(result);
  const eggs = room.decals!.filter((d) => d.texture.startsWith('targ_ee_'));
  expect(eggs).toHaveLength(12);
  expect(shots).toHaveLength(35);
  for (const [i, d] of eggs.entries()) {
    const s = shots.find(
      (s) => s.name === 'ee' + String(i + 1).padStart(2, '0'),
    )!;
    const eye = new Vector3(s.x, s.floorY + 1.65, s.z),
      target = new Vector3().copy(d.position);
    const direction = new Vector3(0, 0, -1).applyEuler(
      new Euler((s.pitch * Math.PI) / 180, (s.yaw * Math.PI) / 180, 0, 'YXZ'),
    );
    const ray = new Ray(eye, direction);
    expect(ray.distanceToPoint(target), d.texture).toBeLessThan(0.01);
    expect(eye.distanceTo(target)).toBeGreaterThanOrEqual(1.8);
    expect(eye.distanceTo(target)).toBeLessThanOrEqual(2.2);
    for (const b of blocks) {
      const localRay = ray.clone().applyMatrix4(local(b)),
        hit = localRay.intersectBox(bounds(b), new Vector3());
      if (hit)
        expect(
          hit.distanceTo(localRay.origin),
          d.texture + ' ' + JSON.stringify(b.position),
        ).toBeGreaterThanOrEqual(eye.distanceTo(target) - 0.023);
    }
  }
});
