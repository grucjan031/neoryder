import { expect, it } from 'vitest';
import { Group, Matrix4, Mesh } from 'three';
import { FppBladeFx } from '../../src/render/fppBladeFx';
import type { BladeFxItem } from '../../src/render/fppBladeFx';

function bladeModel(): Group {
  const model = new Group();
  const base = new Group();
  base.name = 'blade';
  const tip = new Group();
  tip.name = 'blade_tip';
  tip.position.set(0, 0, -1);
  base.add(tip);
  model.add(base);
  model.position.set(0.2, -0.2, -0.6);
  return model;
}

const visibleMeshes = (fx: FppBladeFx): Mesh[] => {
  const out: Mesh[] = [];
  fx.root.traverse((node) => {
    if (node instanceof Mesh && node.visible) out.push(node);
  });
  return out;
};

it('smuga trzyma stałą pulę próbek, a ukrycie ostrza chowa wszystkie efekty', () => {
  const fx = new FppBladeFx();
  const model = bladeModel();
  const camera = new Matrix4();
  const item: BladeFxItem = {
    key: 'main',
    model,
    visible: true,
    slashing: true,
  };
  for (let i = 0; i < 100; i++) {
    model.rotation.y = i * 0.01;
    fx.update(camera, 1 / 240, [item]);
  }
  const trail = (
    fx as unknown as { trails: Map<string, { ring: unknown[]; count: number }> }
  ).trails.get('main')!;
  expect(trail.ring).toHaveLength(trail.count);
  // Poświata, rozbłysk i smuga są widoczne.
  expect(visibleMeshes(fx).length).toBeGreaterThanOrEqual(3);
  fx.hide();
  expect(visibleMeshes(fx)).toHaveLength(0);
  expect(trail.count).toBe(0);
  fx.dispose();
});

it('nie zapisuje próbek smugi za kamerą', () => {
  const fx = new FppBladeFx();
  const model = bladeModel();
  model.position.set(0, 1, 0.5);
  const item: BladeFxItem = {
    key: 'main',
    model,
    visible: true,
    slashing: true,
  };
  for (let i = 0; i < 10; i++) fx.update(new Matrix4(), 1 / 60, [item]);
  const trail = (
    fx as unknown as { trails: Map<string, { count: number }> }
  ).trails.get('main')!;
  expect(trail.count).toBe(0);
  fx.dispose();
});
