import { afterEach, describe, expect, it } from 'vitest';
import { Color, MeshToonMaterial } from 'three';
import type { WebGLProgramParametersWithUniforms, WebGLRenderer } from 'three';
import { tuning } from '../../src/core/tuning';
import { getMaterial, syncMaterials } from '../../src/render/materials';
import { enemyRimAt, enemyRimParams } from '../../src/render/enemyRim';
import type { EnemyRimParams } from '../../src/render/enemyRim';
import { themeDefinitions } from '../../src/render/themes';

const renderDefaults = { ...tuning.render };
const vfxDefaults = { ...tuning.vfx };

afterEach(() => {
  Object.assign(tuning.render, renderDefaults);
  Object.assign(tuning.vfx, vfxDefaults);
  syncMaterials();
});

/** Parametry jak na ciemnych arenach (motyw neonStreet) i domyślne strojenie dystansu. */
function neonStreet(): EnemyRimParams {
  Object.assign(tuning.render, themeDefinitions.get('neonStreet')!.render);
  return enemyRimParams();
}

function compile(
  material: MeshToonMaterial,
): WebGLProgramParametersWithUniforms {
  const shader = {
    uniforms: {},
    vertexShader: '',
    fragmentShader: '#include <common>\n#include <emissivemap_fragment>',
  } as unknown as WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, {} as WebGLRenderer);
  return shader;
}

describe('poświata krawędzi wrogów', () => {
  it('z bliska subtelna, z 25 m wyraźnie mocniejsza (krawędź i wypełnienie bryły)', () => {
    const p = neonStreet();
    expect(p.strength).toBeGreaterThan(0);
    const nearEdge = enemyRimAt(5, 0.8, p);
    const farEdge = enemyRimAt(25, 0.8, p);
    expect(farEdge).toBeGreaterThan(nearEdge * 3);
    // Środek bryły (na wprost kamery): z bliska bez poświaty, daleko płaskie wypełnienie.
    expect(enemyRimAt(3, 0, p)).toBe(0);
    expect(enemyRimAt(25, 0, p)).toBeGreaterThan(0);
    // Z bliska prawie jak dawna poświata motywu (siła * krawędź^wykładnik), nie neon w całości.
    expect(nearEdge).toBeLessThan(1.15 * p.strength * Math.pow(0.8, p.power));
  });

  it('na każdym dystansie co najmniej dawna poświata motywu (także przy złym strojeniu)', () => {
    const p = neonStreet();
    const old = (facing: number): number =>
      p.strength * Math.pow(facing, p.power);
    for (const depth of [1, 3, 5, 8, 12, 20, 25, 40])
      for (const facing of [0, 0.3, 0.6, 0.8, 1])
        expect(enemyRimAt(depth, facing, p)).toBeGreaterThanOrEqual(
          old(facing) - 1e-9,
        );
    Object.assign(tuning.vfx, {
      enemyRimFarGain: 0.2,
      enemyRimFarPower: 6,
      enemyRimFarFill: -1,
      enemyRimFogCompensation: -1,
    });
    const bad = enemyRimParams();
    for (const depth of [5, 25])
      expect(enemyRimAt(depth, 0.8, bad)).toBeGreaterThanOrEqual(
        old(0.8) - 1e-9,
      );
  });

  it('kompensuje mgłę kompozycji, ale bez wybuchu jasności w gęstej mgle', () => {
    const p = neonStreet();
    const without = enemyRimAt(25, 0.8, { ...p, fogCompensation: 0 });
    const withFog = enemyRimAt(25, 0.8, p);
    expect(withFog).toBeGreaterThan(without);
    const dense = enemyRimAt(200, 1, {
      ...p,
      fogStrength: 1,
      heightFogDensity: 10,
    });
    expect(dense).toBeLessThanOrEqual(
      enemyRimAt(200, 1, { ...p, fogStrength: 0, heightFogDensity: 0 }) / 0.25 +
        1e-9,
    );
  });

  it('motyw bez poświaty (biały) zostaje bez poświaty na każdym dystansie', () => {
    Object.assign(tuning.render, themeDefinitions.get('white')!.render);
    const p = enemyRimParams();
    for (const depth of [2, 10, 25, 60])
      expect(enemyRimAt(depth, 1, p)).toBe(0);
  });

  it('kombinezon i płyty: stałe klucze programu i wspólne uniformy', () => {
    const enemy = getMaterial('enemy') as MeshToonMaterial;
    const dark = getMaterial('enemyDark') as MeshToonMaterial;
    expect(enemy.customProgramCacheKey()).toBe('enemyRim1.00');
    expect(dark.customProgramCacheKey()).toBe('enemyRim0.60');
    const a = compile(enemy);
    const b = compile(dark);
    expect(a.fragmentShader).toContain('enemyRimFarFill');
    expect(a.fragmentShader).toContain('* 1.00');
    expect(b.fragmentShader).toContain('* 0.60');
    expect(a.uniforms.enemyRimStrength).toBe(b.uniforms.enemyRimStrength);
    Object.assign(tuning.render, themeDefinitions.get('neonStreet')!.render);
    tuning.vfx.enemyRimFarGain = 3;
    syncMaterials();
    expect(a.uniforms.enemyRimStrength!.value).toBe(
      tuning.render.enemyRimStrength,
    );
    expect(a.uniforms.enemyRimFarGain!.value).toBe(3);
    expect((a.uniforms.enemyRimColor!.value as Color).getHexString()).toBe(
      new Color(tuning.render.enemy).getHexString(),
    );
  });

  it('jasność kombinezonu wynika z czerwieni wroga i enemyDarkShade', () => {
    tuning.vfx.enemyDarkShade = 0.5;
    syncMaterials();
    const expected = new Color(tuning.render.enemy).multiplyScalar(0.5);
    expect(getMaterial('enemyDark').color.getHexString()).toBe(
      expected.getHexString(),
    );
  });
});
