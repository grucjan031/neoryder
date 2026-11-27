import { Euler, Quaternion, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { roomDefinitions } from '../../src/world/rooms';
import bounds from '../../src/data/render/mapModelBounds.json';
const room = roomDefinitions.get('run5')!;
type Point = { x: number; y: number; z: number };
const blocks = room.blocks.filter((b) => b.visible !== false);
function gap(p: Point, b: (typeof blocks)[number]) {
  const r = b.rotation;
  const local = new Vector3()
    .copy(p)
    .sub(b.position)
    .applyQuaternion(
      new Quaternion().setFromEuler(new Euler(r?.x, r?.y, r?.z)).invert(),
    );
  return Math.hypot(
    ...(['x', 'y', 'z'] as const).map((a) =>
      Math.max(0, Math.abs(local[a]) - b.size[a] / 2),
    ),
  );
}
it('każdy szyld, plakat i ekran ma podłoże, a oba końce taśmy biegną do kapsuł', () => {
  for (const s of [
    ...(room.signs ?? []),
    ...(room.decals ?? []).filter((d) => d.surface === 'wall'),
  ]) {
    const p = s.position;
    if (s.texture === 'med_quarantine_tape') {
      for (const side of [-1, 1])
        expect(
          blocks.some(
            (b) =>
              b.model?.startsWith('bw_regen_pod') &&
              gap({ ...p, z: p.z + (side * s.size.w) / 2 }, b) < 0.1,
          ),
        ).toBe(true);
    } else
      expect(
        blocks.some((b) => gap(p, b) <= 0.1),
        s.texture,
      ).toBe(true);
  }
});
it('każde źródło światła ma widoczną oprawę i poziom posadzki', () => {
  expect(room.lights).toHaveLength(64);
  const panels = room
    .decor!.filter((d) => d.model === 'bw_ceiling_panel')
    .map((d) => d.position);
  const diffusers = blocks.filter(
    (b) => b.material === 'light_panel' && b.size.y === 0.015,
  );
  for (const b of blocks.filter(
    (b) => b.material === 'plaster' && b.size.x === 2.4 && b.size.z === 1.2,
  )) {
    const { x, y, z } = b.position;
    const bottom = y - b.size.y / 2 - 0.014;
    for (const dx of [-0.56, 0.56])
      expect(
        diffusers.some(
          (d) =>
            Math.abs(d.position.x - x - dx) < 0.001 &&
            Math.abs(d.position.y - d.size.y / 2 - bottom) < 0.001 &&
            d.position.z === z,
        ),
      ).toBe(true);
    panels.push({ x, y: bottom, z });
  }
  const walls = blocks.filter(
    (b) =>
      !b.ceiling &&
      !b.walkable &&
      ((b.material === 'med_wall_panel' &&
        b.size.y >= 3.6 &&
        Math.min(b.size.x, b.size.z) <= 0.41) ||
        (b.material === 'glass_clear' && b.size.y >= 1.9)),
  );
  for (const l of room.lights!) {
    const panel = panels.find(
      (p) =>
        Math.hypot(p.x - l.position.x, p.z - l.position.z) < 0.01 &&
        Math.abs(p.y - l.position.y - 0.5) < 0.01,
    );
    if (panel) expect(l.color).toBe('#fff1d6');
    else
      expect(
        blocks.some(
          (b) =>
            (b.model === 'bw_planter_bio' ||
              b.material === 'neon_blue' ||
              b.material === 'neon_green' ||
              b.material === 'neon_violet') &&
            gap(l.position, b) < 0.1,
        ),
        JSON.stringify(l),
      ).toBe(true);
    expect(l.groundGlow).toBe(false);
    expect(l.floorY).toBeGreaterThanOrEqual(0);
    expect(l.floorY).toBeLessThanOrEqual(4.4);
    expect(l.cone).not.toBe(true);
    for (const wall of walls) {
      const clearance =
        wall.material === 'glass_clear' && wall.size.y > 9 ? 3 : 1.6;
      expect(
        gap(l.position, wall),
        JSON.stringify([l.position, wall.position]),
      ).toBeGreaterThanOrEqual(clearance);
    }
  }
  expect(panels).toHaveLength(88);
});
it('linie prowadzące i oznaczenia progów mają wymiary czytelne z posadzki', () => {
  const lines = room.decals!.filter((d) => d.texture === 'med_floor_wayline');
  expect(lines.reduce((sum, d) => sum + d.size.w, 0)).toBeGreaterThanOrEqual(
    120,
  );
  for (const d of lines) {
    expect(d.size.h).toBe(0.5);
    expect(d.size.w).toBeLessThanOrEqual(8);
  }
  const crosses = room.decals!.filter((d) => d.texture === 'med_floor_cross');
  expect(crosses).toHaveLength(28);
  expect(crosses.every((d) => d.size.w === 1.2 && d.size.h === 1.2)).toBe(true);
});
it('pełne moduły balustrad mają kolizję o wymiarach modelu', () => {
  const model = bounds.bw_glass_balustrade;
  const rails = blocks.filter((b) => b.model === 'bw_glass_balustrade');
  expect(rails.length).toBeGreaterThan(20);
  for (const b of rails)
    Object.values(b.size).forEach((v, i) =>
      expect(v).toBeCloseTo(model.max[i]! - model.min[i]!, 3),
    );
});
