import { describe, expect, it } from 'vitest';
import { Euler, Quaternion, Vector3 } from 'three';
import room from '../../src/data/rooms/run3.json';
import { roomSchema } from '../../src/world/roomSchema';
import modelBounds from '../../src/data/render/mapModelBounds.json';

const run3 = roomSchema.parse(room);
const blocks = run3.blocks.filter((block) => block.visible !== false);
type Point = { x: number; y: number; z: number };

function gap(point: Point, block: (typeof blocks)[number]) {
  const rotation = block.rotation;
  const local = new Vector3()
    .copy(point)
    .sub(block.position)
    .applyQuaternion(
      new Quaternion()
        .setFromEuler(new Euler(rotation?.x, rotation?.y, rotation?.z))
        .invert(),
    );
  return Math.hypot(
    ...(['x', 'y', 'z'] as const).map((axis) =>
      Math.max(0, Math.abs(local[axis]) - block.size[axis] / 2),
    ),
  );
}

describe('mocowania oznaczeń run3', () => {
  it('każdy szyld i plakat ma podłoże do 10 cm albo dwie linki połączone ze stropem', () => {
    for (const sign of [
      ...(run3.signs ?? []),
      ...(run3.decals ?? []).filter((decal) => decal.surface === 'wall'),
    ]) {
      if (blocks.some((block) => gap(sign.position, block) <= 0.1)) continue;
      for (const side of [-1, 1]) {
        const attachment = {
          x: sign.position.x + side * sign.size.w * 0.36,
          y: sign.position.y + sign.size.h * 0.4,
          z: sign.position.z + 0.04,
        };
        const cables = blocks.filter(
          (block) =>
            block.size.x <= 0.05 &&
            block.size.z <= 0.05 &&
            block.size.y > 0.1 &&
            gap(attachment, block) < 0.01,
        );
        expect(cables.length, `${sign.texture}: linka ${side}`).toBe(1);
        const cable = cables[0]!;
        const top = {
          ...cable.position,
          y: cable.position.y + cable.size.y / 2,
        };
        expect(
          blocks.some((block) => block.ceiling && gap(top, block) < 0.01),
          `${sign.texture}: kotwa stropowa`,
        ).toBe(true);
      }
    }
  });

  it('ekrany reklamowe i tablice śledcze mają tył przy bloku ściany', () => {
    for (const decor of run3.decor ?? []) {
      if (
        decor.model !== 'city_ad_screen' &&
        decor.model !== 'lab_corkboard_evidence'
      )
        continue;
      const bounds = modelBounds[decor.model];
      const back = new Vector3(
        0,
        (bounds.min[1]! + bounds.max[1]!) / 2,
        bounds.min[2],
      )
        .applyAxisAngle(new Vector3(0, 1, 0), decor.yaw ?? 0)
        .add(decor.position);
      expect(
        blocks.some((block) => !block.model && gap(back, block) <= 0.1),
        `${decor.model}: ${JSON.stringify(decor.position)}`,
      ).toBe(true);
    }
  });
});
