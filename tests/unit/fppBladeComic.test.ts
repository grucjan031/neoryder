import { describe, expect, it } from 'vitest';
import { Group, Matrix4, Mesh, Vector3 } from 'three';
import type { Material } from 'three';
import { tuning } from '../../src/core/tuning';
import { FppBladeFx } from '../../src/render/fppBladeFx';
import type { BladeFxItem } from '../../src/render/fppBladeFx';
import { skipsOutline } from '../../src/render/noOutline';

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

type Internals = {
  glows: Mesh[];
  bladeUniforms: { bladePhase: { value: number } };
};

function run(flashes: boolean, steps: number, slashing = false) {
  const fx = new FppBladeFx({ settings: { flashes } });
  const item: BladeFxItem = {
    key: 'main',
    model: bladeModel(),
    visible: true,
    slashing,
  };
  const widths: number[] = [];
  const internals = fx as unknown as Internals;
  for (let i = 0; i < steps; i++) {
    fx.update(new Matrix4(), 1 / 60, [item]);
    // Szerokość quada klingi = długość kolumny X macierzy.
    widths.push(
      new Vector3().setFromMatrixColumn(internals.glows[0]!.matrix, 0).length(),
    );
  }
  return { fx, internals, widths };
}

describe('klinga FPP: komiksowa plazma', () => {
  it('rdzeń i otoczka mają stałe programy shadera i omijają tusz', () => {
    const { fx, internals } = run(true, 2);
    const quad = internals.glows[0]!;
    const halo = quad.children[0] as Mesh;
    expect(halo).toBeInstanceOf(Mesh);
    const solid = quad.material as Material;
    const outer = halo.material as Material;
    expect(solid.customProgramCacheKey()).toBe('fppPlasmaBlade:solid');
    expect(outer.customProgramCacheKey()).toBe('fppPlasmaBlade:halo');
    // Klucz nie zależy od klatki (bez nowych programów w trakcie gry).
    fx.update(new Matrix4(), 1 / 60, []);
    expect(solid.customProgramCacheKey()).toBe('fppPlasmaBlade:solid');
    expect(outer.transparent).toBe(true);
    expect(outer.depthWrite).toBe(false);
    expect(skipsOutline(quad)).toBe(true);
    expect(skipsOutline(halo)).toBe(true);
    expect(solid.userData.bloom).toBe(true);
    fx.dispose();
  });

  it('pasma płyną od emitera; bez błysków zwalniają i szerokość nie miga', () => {
    const fast = run(true, 30);
    const calm = run(false, 30);
    const phase = (r: { internals: Internals }) =>
      r.internals.bladeUniforms.bladePhase.value;
    expect(phase(fast)).toBeCloseTo(
      ((30 / 60) * tuning.vfx.bladeBandSpeed) % 1,
      5,
    );
    expect(phase(calm)).toBeCloseTo(
      (30 / 60) * tuning.vfx.bladeBandSpeedCalm,
      5,
    );
    expect(tuning.vfx.bladeBandSpeedCalm).toBeLessThan(
      tuning.vfx.bladeBandSpeed / 4,
    );
    const spread = (w: number[]) => Math.max(...w) - Math.min(...w);
    expect(spread(calm.widths)).toBeLessThan(1e-6);
    expect(spread(fast.widths)).toBeGreaterThan(1e-4);
    fast.fx.dispose();
    calm.fx.dispose();
  });

  it('cięcie przyspiesza pasma tylko przy włączonych błyskach', () => {
    const slash = run(true, 6, true);
    const calmSlash = run(false, 6, true);
    expect(slash.internals.bladeUniforms.bladePhase.value).toBeCloseTo(
      ((6 / 60) * tuning.vfx.bladeBandSpeed * tuning.vfx.bladeBandSlashBoost) %
        1,
      5,
    );
    expect(calmSlash.internals.bladeUniforms.bladePhase.value).toBeCloseTo(
      (6 / 60) * tuning.vfx.bladeBandSpeedCalm,
      5,
    );
    slash.fx.dispose();
    calmSlash.fx.dispose();
  });

  it('strefy jasności są uporządkowane: rdzeń < cyjan < otoczka', () => {
    const v = tuning.vfx;
    expect(v.bladeCoreFrac).toBeLessThan(v.bladeInnerFrac);
    expect(v.bladeInnerFrac).toBeLessThan(v.bladeOuterFrac);
    expect(v.bladeOuterFrac).toBeLessThanOrEqual(1);
  });
});
