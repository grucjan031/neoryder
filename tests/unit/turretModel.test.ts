import { afterEach, expect, it } from 'vitest';
import { Group, Object3D } from 'three';
import { enemySchema } from '../../src/enemies/enemySchema';
import { createEnemyView } from '../../src/enemies/views';
import type { EnemyViewLike } from '../../src/enemies/views';
import type { Enemy, EnemySnapshot } from '../../src/enemies/types';
import turret from '../../src/data/enemies/turret.json';

const views: EnemyViewLike[] = [];
afterEach(() => {
  for (const view of views.splice(0)) view.dispose();
});

function turretView(state: EnemySnapshot['state'], shotTimeS?: number) {
  const snapshot = (): EnemySnapshot => ({
    position: { x: 0, y: 0, z: 0 },
    yaw: 1.2,
    speed: 0,
    state,
    stateTimeS: 0.05,
    distance: 0,
    shotTimeS,
  });
  const enemy: Enemy = {
    id: 1,
    definition: enemySchema.parse(turret),
    previous: snapshot(),
    current: snapshot(),
    removed: false,
    step: () => {},
    dispose: () => {},
  };
  const view = createEnemyView(enemy, false);
  views.push(view);
  return view;
}

/** Model jak z enemy_turret.glb: stała podstawa i głowica z lufami, okiem i wylotem. */
function fakeModel() {
  const model = new Group();
  const base = new Object3D();
  base.name = 'base_model';
  const head = new Group();
  head.name = 'turret_head';
  const barrels = new Group();
  barrels.name = 'barrels';
  const eye = new Object3D();
  eye.name = 'eye';
  head.add(barrels, eye);
  model.add(base, head);
  return { model, base, head, barrels, eye };
}

it('model GLB zastępuje bryłę zastępczą, a znacznik egzekucji i laser zostają', () => {
  const view = turretView('aim', 0.01);
  const marker = view.root.getObjectByName('executeMarker');
  expect(marker).toBeDefined();
  expect(view.root.getObjectByName('turretHead')).toBeDefined();
  const { model, base, barrels, eye } = fakeModel();
  (view as unknown as { useModel(m: Object3D): void }).useModel(model);
  view.render(1);
  expect(marker!.parent).toBe(view.root);
  expect(view.root.getObjectByName('laser')).toBeDefined();
  expect(base.parent).toBe(model);
  expect(model.parent).toBe(view.root);
  // Głowica modelu obraca się z widokiem, odrzut i pulsowanie działają na węzłach modelu.
  const turretHead = view.root.getObjectByName('turretHead')!;
  expect(barrels.parent?.parent).toBe(turretHead);
  expect(turretHead.rotation.y).toBeCloseTo(1.2);
  expect(barrels.position.z).toBeLessThan(0);
  expect(eye.scale.x).toBeGreaterThan(1);
  // Bryła zastępcza (cokół, obudowa głowicy) znika.
  expect(view.root.getObjectByName('base')).toBeUndefined();
  expect(view.root.getObjectByName('head')).toBeUndefined();
});

it('model bez kompletu węzłów zostawia bryłę zastępczą', () => {
  const view = turretView('idle');
  const { model, eye } = fakeModel();
  eye.removeFromParent();
  (view as unknown as { useModel(m: Object3D): void }).useModel(model);
  expect(model.parent).toBeNull();
  expect(view.root.getObjectByName('base')).toBeDefined();
});
