import { describe, expect, it } from 'vitest';
import {
  decalSchema,
  wallDecalFitsBlock,
} from '../../src/world/dressingSchema';
import type { DecalDef } from '../../src/world/dressingSchema';
import { roomSchema } from '../../src/world/roomSchema';

const files = import.meta.glob<unknown>('../../src/data/rooms/*.json', {
  eager: true,
  import: 'default',
});
const block = {
  position: { x: 0, y: 2, z: 0 },
  size: { x: 4, y: 4, z: 2 },
};
const decal: DecalDef = {
  texture: 'graffiti_resist',
  position: { x: 0, y: 2, z: 1.05 },
  size: { w: 2, h: 2 },
  yaw: 0,
  surface: 'wall',
};

describe('prostokąt naklejki na ścianie nośnej', () => {
  it('mieści się na ścianie, także równo z brzegiem, bez mutacji danych', () => {
    const input = structuredClone(decal);
    expect(wallDecalFitsBlock(decal, block)).toBe(true);
    expect(wallDecalFitsBlock({ ...decal, size: { w: 4, h: 4 } }, block)).toBe(
      true,
    );
    expect(decal).toEqual(input);
  });

  it.each([
    { position: { x: 1.01, y: 2, z: 1.05 } },
    { position: { x: -1.01, y: 2, z: 1.05 } },
    { position: { x: 0, y: 3.01, z: 1.05 } },
    { position: { x: 0, y: 0.99, z: 1.05 } },
    { size: { w: 4.01, h: 2 } },
    { size: { w: 2, h: 4.01 } },
    { position: { x: 0, y: 2, z: 1.2 } },
    { yaw: Math.PI },
    { yaw: 0.2 },
    { surface: 'floor' },
  ])('odrzuca wystawanie lub brak zgodnej ściany: %j', (patch) => {
    expect(
      wallDecalFitsBlock(decalSchema.parse({ ...decal, ...patch }), block),
    ).toBe(false);
  });

  it.each([Math.PI / 2, -Math.PI / 2, Math.PI, 1.5708])(
    'uwzględnia normalną ściany dla yaw=%s i przesunięty blok',
    (yaw) => {
      const xFace = Math.abs(Math.sin(yaw)) > 0.5;
      const axis = xFace ? 'x' : 'z';
      const sign = Math.sign(xFace ? Math.sin(yaw) : Math.cos(yaw));
      const carrier = { ...block, position: { x: 10, y: 7, z: -5 } };
      const position = { ...carrier.position };
      position[axis] += sign * (block.size[axis] / 2 + 0.05);
      const mounted = { ...decal, position, yaw };
      expect(wallDecalFitsBlock(mounted, carrier)).toBe(true);
      expect(
        wallDecalFitsBlock({ ...mounted, size: { w: 5, h: 2 } }, carrier),
      ).toBe(false);
    },
  );
});

describe('naklejki we wszystkich plikach pokoi', () => {
  it('znajduje dane pokoi', () =>
    expect(Object.keys(files).length).toBeGreaterThan(0));
  it.each(Object.entries(files))(
    '%s: każda naklejka ścienna mieści się na jednym bloku',
    (_path, raw) => {
      const room = roomSchema.parse(raw);
      for (const [index, def] of (room.decals ?? []).entries()) {
        if (def.surface !== 'wall') continue;
        expect(
          room.blocks.some((carrier) => wallDecalFitsBlock(def, carrier)),
          `${room.id}: decals[${index}] ${def.texture}`,
        ).toBe(true);
      }
    },
  );
});
