import { afterEach, describe, expect, it } from 'vitest';
import {
  AdditiveBlending,
  Color,
  FrontSide,
  Mesh,
  MeshBasicMaterial,
  NoBlending,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector3,
} from 'three';
import type { WebGLRenderer } from 'three';
import { tuning } from '../../src/core/tuning';
import { BloomPass } from '../../src/render/bloom';
import { SignRenderer } from '../../src/render/city/signs';
import { CityLights } from '../../src/render/city/lights';
import { LampCones } from '../../src/render/city/lamps';
import { CityParticleBatch } from '../../src/render/city/particles';
import type { SignDef } from '../../src/world/dressingSchema';

const defaults = { ...tuning.city };
afterEach(() => Object.assign(tuning.city, defaults));
const sign: SignDef = {
  kind: 'neon',
  texture: 'unit',
  position: { x: 0, y: 2, z: -4 },
  size: { w: 0.2, h: 4 },
  yaw: 0,
};

it('wszystkie addytywne efekty miasta respektują głębię i nie zapisują jej', () => {
  const signs = new SignRenderer(
    [sign, { ...sign, kind: 'holo' }],
    0,
    () => {},
  );
  const lights = new CityLights([
    { position: sign.position, color: '#ffae1a', intensity: 1, range: 4 },
  ]);
  const cones = new LampCones([{ head: new Vector3(0, 4, 0), baseY: 0 }]);
  const batches = (['steam', 'spark', 'drop', 'ring'] as const).map(
    (kind) => new CityParticleBatch(1, kind, 1),
  );
  const roots = [
    signs.root,
    lights.root,
    cones.root,
    ...batches.map((batch) => batch.mesh),
  ];
  let count = 0;
  try {
    for (const root of roots)
      root.traverse((object) => {
        if (
          !(object instanceof Mesh) ||
          object.material.blending !== AdditiveBlending
        )
          return;
        count++;
        expect(object.material.depthTest).toBe(true);
        expect(object.material.depthWrite).toBe(false);
        expect(object.renderOrder).toBeGreaterThan(0);
      });
    expect(count).toBe(11);
  } finally {
    signs.dispose();
    lights.dispose();
    cones.dispose();
    for (const batch of batches) {
      batch.mesh.geometry.dispose();
      const material = batch.mesh.material;
      if (!Array.isArray(material)) material.dispose();
      batch.mesh.dispose();
    }
  }
});

it('halo wąskiego napisu ma miękki cały brzeg i nie przekracza limitu 1,6×, także po zmianie GUI', () => {
  const signs = new SignRenderer([sign], 0, () => {});
  const group = signs.root.children[0]!;
  const plane = group.children[0] as Mesh<PlaneGeometry, ShaderMaterial>;
  const halo = group.children[1] as Mesh<PlaneGeometry, ShaderMaterial>;
  try {
    expect(halo.scale.x).toBeCloseTo(sign.size.w * 1.6);
    expect(halo.scale.y).toBeCloseTo(sign.size.h * 1.6);
    tuning.city.signGlowScale = 5;
    signs.update(0, 0, new PerspectiveCamera());
    expect(halo.scale.x).toBeCloseTo(sign.size.w * 1.6);
    expect(halo.scale.y).toBeCloseTo(sign.size.h * 1.6);
    for (const quad of [plane, halo]) {
      expect(quad.position.z).toBe(tuning.city.surfaceOffsetM);
      expect(quad.material.side).toBe(FrontSide);
    }
    expect(halo.material.userData.bloom).toBe(false);
    expect(halo.material.fragmentShader).toContain('min(edge.x, edge.y)');
    expect(halo.material.uniforms.edgeFade!.value).toBeGreaterThan(0);
  } finally {
    signs.dispose();
  }
});

describe.each([false, true])('maska emisji (odbicia=%s)', (reflection) => {
  it('ma głębię, ukrywa halo i zapisuje zerową emisję brył zasłaniających', () => {
    const scene = new Scene();
    const source = new MeshBasicMaterial({ color: '#ffae1a' });
    const neon = new Mesh(new PlaneGeometry(), source);
    const wall = new Mesh(new PlaneGeometry(), new MeshBasicMaterial());
    const signs = new SignRenderer([sign], 0, () => {});
    const halo = signs.root.children[0]!.children[1]!;
    scene.add(neon, wall, signs.root);
    const pass = new BloomPass(64, 64, reflection);
    let maskChecked = false;
    const renderer = {
      autoClear: true,
      getClearColor: (out: Color) => out.set(0),
      getClearAlpha: () => 0,
      setClearColor: () => {},
      setRenderTarget: (target: { depthBuffer: boolean }) => {
        if (!maskChecked) expect(target.depthBuffer).toBe(true);
      },
      render: (rendered: Scene) => {
        if (rendered !== scene) return;
        maskChecked = true;
        expect(halo.visible).toBe(false);
        expect(neon.material).toBe(source);
        const blocker = wall.material;
        expect(blocker).toMatchObject({
          depthTest: true,
          depthWrite: true,
          colorWrite: true,
          transparent: false,
          opacity: 0,
          blending: NoBlending,
        });
        expect(blocker.color.getHex()).toBe(0);
      },
    } as unknown as WebGLRenderer;
    try {
      pass.render(renderer, scene, new PerspectiveCamera());
      expect(maskChecked).toBe(true);
      expect(halo.visible).toBe(true);
    } finally {
      signs.dispose();
      pass.dispose();
      for (const mesh of [neon, wall]) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
    }
  });
});
