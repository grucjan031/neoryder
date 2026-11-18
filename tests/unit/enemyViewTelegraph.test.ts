import { afterEach, expect, it, vi } from 'vitest';
import { BufferGeometry, Color, Mesh, MeshBasicMaterial } from 'three';
import { EnemyView } from '../../src/enemies/enemyView';
import { enemySchema } from '../../src/enemies/enemySchema';
import type { Enemy, EnemySnapshot } from '../../src/enemies/types';
import raw from '../../src/data/enemies/assaulter.json';
import { tuning } from '../../src/core/tuning';
import * as save from '../../src/core/save';

const views: EnemyView[] = [];
afterEach(() => {
  views.splice(0).forEach((view) => view.dispose());
  vi.restoreAllMocks();
});
function fixture(heavy = true) {
  const snapshot = (): EnemySnapshot => ({
    position: { x: 0, y: 0, z: 0 },
    yaw: 0,
    speed: 0,
    distance: 0,
    state: 'telegraph',
    stateTimeS: 0,
  });
  const enemy: Enemy = {
    id: 1,
    definition: enemySchema.parse({
      ...raw,
      attackTags: heavy ? ['#melee', '#heavy'] : ['#melee'],
    }),
    current: snapshot(),
    previous: snapshot(),
    removed: false,
    step() {},
    dispose() {},
  };
  const view = new EnemyView(enemy, false);
  views.push(view);
  const tip = view.root.getObjectByName('baton_tip')!;
  const mesh = tip.children[0] as Mesh<BufferGeometry, MeshBasicMaterial>;
  return { enemy, view, tip, mesh };
}

it('isolates heavy materials and restores exact shared references on interruption', () => {
  const a = fixture();
  const b = fixture(false);
  const original = a.mesh.material;
  const color = original.color.clone();
  expect(b.mesh.material).toBe(original);
  a.view.render(1);
  expect(a.mesh.material).not.toBe(original);
  expect(a.mesh.material.color).toEqual(
    new Color(tuning.vfx.heavyTelegraphColor),
  );
  expect(original.color).toEqual(color);
  expect(b.mesh.material).toBe(original);
  const dispose = vi.spyOn(a.mesh.material, 'dispose');
  a.enemy.current.state = 'stunned';
  a.view.render(1);
  expect(a.mesh.material).toBe(original);
  expect(dispose).toHaveBeenCalledOnce();
});

it('blends to warm white only in final 30 percent and disposes active clones', () => {
  const a = fixture();
  const original = a.mesh.material;
  a.enemy.current.stateTimeS = a.enemy.definition.telegraphS * 0.7;
  a.view.render(1);
  expect(a.mesh.material.color).toEqual(
    new Color(tuning.vfx.heavyTelegraphColor),
  );
  a.enemy.current.stateTimeS = a.enemy.definition.telegraphS;
  a.view.render(1);
  expect(a.mesh.material.color.getHexString()).toBe('fff4dc');
  const dispose = vi.spyOn(a.mesh.material, 'dispose');
  a.view.dispose();
  expect(a.mesh.material).toBe(original);
  expect(dispose).toHaveBeenCalledOnce();
});

it('keeps ordinary swing pulse and uses faster heavy pulse; flashes=false is steady', () => {
  const a = fixture();
  const b = fixture(false);
  const time = 1 / (raw.animation.pulseHz * 8);
  a.enemy.current.stateTimeS = b.enemy.current.stateTimeS = time;
  a.view.render(1);
  b.view.render(1);
  expect(a.tip.scale.x).toBeCloseTo(1 + raw.animation.pulseScale * 2);
  expect(b.tip.scale.x).toBeCloseTo(
    1 + raw.animation.pulseScale * (1 + Math.SQRT1_2),
  );
  vi.spyOn(save, 'loadSettings').mockReturnValue({
    ...save.loadSettings(),
    flashes: false,
  });
  a.view.render(1);
  const scale = a.tip.scale.clone();
  a.enemy.current.stateTimeS += 0.1;
  a.view.render(1);
  expect(a.tip.scale).toEqual(scale);
  a.enemy.current.state = 'swing';
  a.view.render(1);
  expect(a.tip.scale.x).toBe(1);
});
