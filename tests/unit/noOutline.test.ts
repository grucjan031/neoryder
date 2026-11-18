import { describe, expect, it } from 'vitest';
import {
  AdditiveBlending,
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  Scene,
} from 'three';
import { hideNoOutline, skipsOutline } from '../../src/render/noOutline';

const mesh = (options: ConstructorParameters<typeof MeshBasicMaterial>[0]) =>
  new Mesh(new BoxGeometry(), new MeshBasicMaterial(options));

describe('noOutline', () => {
  it('pomija flagę, poświaty addytywne i przezroczyste bez zapisu głębi', () => {
    const flagged = mesh({});
    flagged.userData.noOutline = true;
    expect(skipsOutline(flagged)).toBe(true);
    expect(
      skipsOutline(mesh({ transparent: true, blending: AdditiveBlending })),
    ).toBe(true);
    expect(skipsOutline(mesh({ transparent: true, depthWrite: false }))).toBe(
      true,
    );
  });

  it('zostawia bryły nieprzezroczyste i przezroczyste szyby z głębią', () => {
    expect(skipsOutline(mesh({}))).toBe(false);
    expect(skipsOutline(mesh({ transparent: true, opacity: 0.5 }))).toBe(false);
    expect(skipsOutline(mesh({ blending: AdditiveBlending }))).toBe(false);
  });

  it('ukrywa na czas przebiegu i przywraca widoczność', () => {
    const scene = new Scene();
    const solid = mesh({});
    const glow = mesh({ transparent: true, blending: AdditiveBlending });
    scene.add(solid, glow);
    const restore = hideNoOutline(scene);
    expect(solid.visible).toBe(true);
    expect(glow.visible).toBe(false);
    restore();
    expect(glow.visible).toBe(true);
  });
});
