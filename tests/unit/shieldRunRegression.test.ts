import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { Box3, Mesh, SkinnedMesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EnemyView } from '../../src/enemies/enemyView';
import { enemySchema } from '../../src/enemies/enemySchema';
import type { Enemy, EnemySnapshot } from '../../src/enemies/types';
import shielder from '../../src/data/enemies/shielder.json';

afterEach(() => vi.restoreAllMocks());
it('tarcza nie przecina hełmu ani wizjera przez cały bieg UAL', async () => {
  const file = readFileSync('public/assets/models/enemy_shielder.glb');
  const gltf = await new GLTFLoader().parseAsync(
    file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
    '',
  );
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(gltf);
  const snapshot: EnemySnapshot = {
    state: 'chase',
    stateTimeS: 0,
    speed: shielder.moveSpeed,
    distance: 0,
    yaw: 0,
    position: { x: 0, y: 0, z: 0 },
    shieldUp: true,
  };
  const enemy: Enemy = {
    id: 1,
    definition: enemySchema.parse(shielder),
    previous: { ...snapshot },
    current: { ...snapshot },
    removed: false,
    step() {},
    dispose() {},
  };
  const view = new EnemyView(enemy);
  try {
    await vi.waitFor(() =>
      expect(view.root.getObjectByName('armored_body')).toBeDefined(),
    );
    const shield = view.root.getObjectByName('shield') as Mesh;
    const skin = view.root.getObjectByName('armored_body') as SkinnedMesh;
    const helmet = view.root.getObjectByName('helmet')!;
    const visor = view.root.getObjectByName('visor')!;
    expect(helmet).toBeDefined();
    const clip = gltf.animations.find((c) => c.name === 'Jog_Fwd_Loop')!;
    const span =
      shielder.animation.clipStrideM.Jog_Fwd_Loop / shielder.moveSpeed;
    expect(clip.duration).toBeGreaterThan(0);
    for (let frame = 0; frame <= 48; frame++) {
      Object.assign(enemy.previous, enemy.current);
      enemy.current.stateTimeS = (span * frame) / 24;
      view.render(1);
      Reflect.apply(skin.onBeforeRender, skin, []);
      view.root.updateMatrixWorld(true);
      const box = new Box3().setFromObject(shield, true);
      expect(box.max.y, `klatka ${frame}: tarcza poniżej wizjera`).toBeLessThan(
        visor.getWorldPosition(new Vector3()).y,
      );
      for (const head of [helmet, visor])
        expect(
          box.intersectsBox(new Box3().setFromObject(head, true)),
          `klatka ${frame}: ${head.name}`,
        ).toBe(false);
    }
  } finally {
    view.dispose();
  }
});
