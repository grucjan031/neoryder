import { describe, expect, it, vi } from 'vitest';
import {
  PerspectiveCamera,
  Quaternion,
  Scene as ThreeScene,
  Vector3,
} from 'three';
import type { BufferGeometry, Mesh, MeshBasicMaterial } from 'three';
import type { Vec3 } from '../../src/core/math';
import { tuning } from '../../src/core/tuning';
import { LightningRenderer } from '../../src/render/lightningRenderer';
import type {
  LightningArc,
  LightningSource,
} from '../../src/render/lightningRenderer';
import { getMaterial } from '../../src/render/materials';

type Slot = Mesh<BufferGeometry, MeshBasicMaterial>;

const LIFE = 0.32;
const SEGMENTS = 6;
const POINTS: readonly Vec3[] = [
  { x: 0, y: 1, z: 0 },
  { x: 0, y: 1, z: -6 },
  { x: 3, y: 1, z: -9 },
];

function source(
  arcs: readonly LightningArc[],
  jitterM = 0.12,
): LightningSource {
  return {
    arcs,
    def: { vfx: { arcLifeS: LIFE, jitterM, segments: SEGMENTS } },
  };
}

function arc(ageS: number, points: readonly Vec3[] = POINTS): LightningArc {
  return { points, ageS };
}

function setup(overrides: Partial<typeof tuning.vfx> = {}) {
  const t = structuredClone(tuning);
  Object.assign(t.vfx, { lightningBranchChance: 0 }, overrides);
  const renderer = new LightningRenderer(t);
  const parent = new ThreeScene();
  parent.add(renderer.root);
  const named = (name: string): Slot[] =>
    renderer.root.children.filter((c) => c.name === name) as Slot[];
  return { t, renderer, parent, named };
}

/** Środek pary wierzchołków wstęgi o numerze `index`. */
function midpoint(mesh: Slot, index: number): Vector3 {
  const p = mesh.geometry.getAttribute('position');
  return new Vector3(
    (p.getX(index * 2) + p.getX(index * 2 + 1)) / 2,
    (p.getY(index * 2) + p.getY(index * 2 + 1)) / 2,
    (p.getZ(index * 2) + p.getZ(index * 2 + 1)) / 2,
  );
}

function widthAt(mesh: Slot, index: number): number {
  const p = mesh.geometry.getAttribute('position');
  return Math.hypot(
    p.getX(index * 2) - p.getX(index * 2 + 1),
    p.getY(index * 2) - p.getY(index * 2 + 1),
    p.getZ(index * 2) - p.getZ(index * 2 + 1),
  );
}

const visible = (meshes: Slot[]): Slot[] => meshes.filter((m) => m.visible);

describe('LightningRenderer', () => {
  it('poświata ma kolor power i bloom, rdzeń kolor lightningCoreColor, oba przezroczyste bez zapisu głębi', () => {
    const { t, renderer, named } = setup();
    renderer.render(source([arc(0.2 * LIFE)]));
    const glow = named('lightning-glow')[0]!;
    const core = named('lightning-core')[0]!;
    expect(glow.material.color.getHex()).toBe(
      getMaterial('power').color.getHex(),
    );
    expect(glow.material.userData.bloom).toBe(true);
    expect(core.material.color.getHexString()).toBe(
      t.vfx.lightningCoreColor.slice(1),
    );
    for (const mesh of [glow, core]) {
      expect(mesh.visible).toBe(true);
      expect(mesh.material.transparent).toBe(true);
      expect(mesh.material.depthWrite).toBe(false);
    }
  });

  it('uderzenie rośnie wzdłuż łańcucha, a błyski pojawiają się przy celach i starcie', () => {
    const { t, renderer, named } = setup();
    renderer.render(source([arc(0)]));
    const glow = named('lightning-glow')[0]!;
    const atStart = glow.geometry.drawRange.count;
    expect(visible(named('lightning-impact'))).toHaveLength(1);

    renderer.render(source([arc((t.vfx.lightningStrikeFrac + 0.01) * LIFE)]));
    expect(glow.geometry.drawRange.count).toBeGreaterThan(atStart);
    const impacts = visible(named('lightning-impact'));
    expect(impacts).toHaveLength(POINTS.length);
    const near = (point: Vec3): Slot | undefined =>
      impacts.find(
        (m) =>
          m.position.distanceTo(new Vector3(point.x, point.y, point.z)) < 1e-4,
      );
    for (const [i, point] of POINTS.entries()) {
      expect(near(point), `błysk przy punkcie ${i}`).toBeDefined();
    }
    expect(near(POINTS[0]!)!.scale.x).toBeLessThan(near(POINTS[1]!)!.scale.x);
  });

  it('opacity maleje w fazie zanikania, a po arcLifeS siatki slotu są niewidoczne', () => {
    const { t, renderer, named } = setup({ lightningFlickerAmount: 0 });
    renderer.render(source([arc(0.5 * LIFE)]));
    const glow = named('lightning-glow')[0]!;
    const core = named('lightning-core')[0]!;
    const glowMid = glow.material.opacity;
    const coreMid = core.material.opacity;
    expect(coreMid).toBeGreaterThan(0);
    expect(glowMid).toBeCloseTo(coreMid * t.vfx.lightningGlowOpacity, 5);

    renderer.render(source([arc(0.9 * LIFE)]));
    expect(core.material.opacity).toBeLessThan(coreMid);
    expect(glow.material.opacity).toBeLessThan(glowMid);

    renderer.render(source([arc(LIFE)]));
    expect(glow.visible).toBe(false);
    expect(core.visible).toBe(false);
    expect(visible(named('lightning-impact'))).toHaveLength(0);
  });

  it('używa ponownie geometrii slotu dla kolejnego łuku', () => {
    const { renderer, named } = setup();
    renderer.render(source([arc(0.1)]));
    const glow = named('lightning-glow')[0]!;
    const geometry = glow.geometry;
    renderer.render(source([arc(LIFE)]));
    expect(glow.visible).toBe(false);
    renderer.render(source([arc(0.05)]));
    expect(named('lightning-glow')).toHaveLength(1);
    expect(glow.visible).toBe(true);
    expect(glow.geometry).toBe(geometry);
  });

  it('z kamerą wstęga startuje w punkcie dłoni i zwęża się przy kamerze', () => {
    const { t, renderer, named } = setup();
    const camera = new PerspectiveCamera();
    camera.position.set(1, 1.6, 2);
    camera.rotation.set(0.1, 0.5, 0, 'YXZ');
    camera.updateMatrixWorld();
    renderer.render(source([arc(LIFE * 0.6)]), camera);
    const glow = named('lightning-glow')[0]!;

    const hand = new Vector3(
      t.vfx.lightningHandSideM,
      -t.vfx.lightningHandDownM,
      -t.vfx.lightningHandForwardM,
    )
      .applyQuaternion(camera.getWorldQuaternion(new Quaternion()))
      .add(camera.position);
    const first = midpoint(glow, 0);
    expect(first.distanceTo(hand)).toBeLessThan(0.01);
    expect(first.distanceTo(new Vector3(0, 1, 0))).toBeGreaterThan(0.5);

    const lastVertex = (POINTS.length - 1) * SEGMENTS;
    expect(widthAt(glow, 0)).toBeLessThan(widthAt(glow, lastVertex));
  });

  it('ten sam ageS daje te same pozycje, a inny kubełek migotania zmienia kształt', () => {
    const { renderer, named } = setup({ lightningFlickerHz: 30 });
    // Kubełki: floor(0,10 × 30) = 3, floor(0,11 × 30) = 3, floor(0,14 × 30) = 4.
    const live = { points: POINTS, ageS: 0.1 };
    const mid = SEGMENTS + SEGMENTS / 2;
    renderer.render(source([live], 0.5));
    const glow = named('lightning-glow')[0]!;
    const before = midpoint(glow, mid);

    renderer.render(source([live], 0.5));
    expect(midpoint(glow, mid).distanceTo(before)).toBe(0);

    live.ageS = 0.11;
    renderer.render(source([live], 0.5));
    expect(midpoint(glow, mid).distanceTo(before)).toBe(0);

    live.ageS = 0.14;
    renderer.render(source([live], 0.5));
    expect(midpoint(glow, mid).distanceTo(before)).toBeGreaterThan(1e-6);
  });

  it('lightningMaxArcs ogranicza liczbę widocznych slotów', () => {
    const { renderer, named } = setup({ lightningMaxArcs: 2 });
    renderer.render(source([arc(0.05), arc(0.06), arc(0.07), arc(0.08)]));
    expect(visible(named('lightning-glow'))).toHaveLength(2);
    expect(visible(named('lightning-core'))).toHaveLength(2);
  });

  it('dispose zwalnia geometrie i materiały oraz odpina root od rodzica', () => {
    const { renderer, parent, named } = setup();
    renderer.render(source([arc(0.05)]));
    const meshes = [...named('lightning-glow'), ...named('lightning-core')];
    const spies = meshes.flatMap((m) => [
      vi.spyOn(m.geometry, 'dispose'),
      vi.spyOn(m.material, 'dispose'),
    ]);
    renderer.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalled();
    expect(parent.children).toHaveLength(0);
  });
});
