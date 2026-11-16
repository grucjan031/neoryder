import { afterEach, expect, it } from 'vitest';
import type { Mesh, MeshBasicMaterial } from 'three';
import { BeamRenderer } from '../../src/render/beamRenderer';

const beam = {
  active: true,
  from: { x: 0, y: 0, z: 0 },
  to: { x: 0, y: 0, z: -8 },
};
const active: BeamRenderer[] = [];
const make = (): BeamRenderer => {
  const renderer = new BeamRenderer();
  active.push(renderer);
  return renderer;
};
afterEach(() => {
  for (const renderer of active.splice(0)) renderer.dispose();
});

const glowScale = (renderer: BeamRenderer): number =>
  (renderer.root.children[0]!.children[1] as Mesh).scale.x;

it('pulsowanie wiązki zależy od czasu klatki, nie od liczby wywołań render', () => {
  const once = make();
  const many = make();
  once.advance(0.05);
  once.render(beam);
  for (let i = 0; i < 6; i++) {
    if (i === 0) many.advance(0.05);
    many.render(beam);
  }
  expect(many.flicker).toBeCloseTo(once.flicker, 10);
  expect(glowScale(many)).toBeCloseTo(glowScale(once), 10);

  // Ten sam czas w krótszych krokach (wyższy FPS) daje ten sam stan.
  const fine = make();
  for (let i = 0; i < 5; i++) {
    fine.advance(0.01);
    fine.render(beam);
  }
  expect(fine.flicker).toBeCloseTo(once.flicker, 10);
});

it('ignoruje niepoprawny czas klatki i ogranicza długi przestój', () => {
  const renderer = make();
  const start = renderer.flicker;
  renderer.advance(Number.NaN);
  renderer.advance(-1);
  renderer.advance(0);
  expect(renderer.flicker).toBe(start);
  const capped = make();
  capped.advance(5);
  const step = make();
  step.advance(0.1);
  expect(capped.flicker).toBeCloseTo(step.flicker, 10);
});

it('tylko biały rdzeń zapisuje głębię; cyan i poświaty są przezroczyste', () => {
  const renderer = make();
  const main = renderer.root.children[0] as Mesh;
  const [core, ...glows] = main.children as Mesh[];
  const mainMaterial = main.material as MeshBasicMaterial;
  expect(mainMaterial.transparent).toBe(true);
  expect(mainMaterial.depthWrite).toBe(false);
  expect((core!.material as MeshBasicMaterial).depthWrite).toBe(true);
  expect(core!.scale.x).toBeLessThan(1);
  for (const glow of glows)
    expect((glow.material as MeshBasicMaterial).depthWrite).toBe(false);
});
