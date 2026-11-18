import { describe, expect, it } from 'vitest';
import type { Material } from 'three';
import { createUrbanMaterial } from '../../src/render/urbanMaterials';

function fragmentShaderOf(kind: Parameters<typeof createUrbanMaterial>[0]) {
  const material = createUrbanMaterial(kind);
  const shader = {
    uniforms: {} as Record<string, unknown>,
    vertexShader: '#include <common>\n#include <begin_vertex>',
    fragmentShader: [
      '#include <common>',
      '#include <color_fragment>',
      '#include <roughnessmap_fragment>',
      '#include <normal_fragment_maps>',
      '#include <emissivemap_fragment>',
    ].join('\n'),
  };
  material.onBeforeCompile(
    shader as Parameters<Material['onBeforeCompile']>[0],
    null as never,
  );
  return shader.fragmentShader;
}

describe('relief powierzchni miejskich: zerowe pochodne ekranu', () => {
  it.each(['asphalt', 'concrete', 'facade'] as const)(
    '%s nie normalizuje zerowych pochodnych (czarny pas przy kamerze, M01)',
    (kind) => {
      const source = fragmentShaderOf(kind);
      const start = source.indexOf('vec3 cityPerturbNormal');
      expect(start).toBeGreaterThan(-1);
      const body = source.slice(
        start,
        source.indexOf('#include <color_fragment>'),
      );
      // Strażnik przed normalize(): bez niego dFdx/dFdy == 0 daje NaN i czarny piksel.
      expect(body).toMatch(/dot\(dPosX, dPosX\) > 1e-16/);
      expect(body).toMatch(/dot\(dPosY, dPosY\) > 1e-16/);
      expect(body.indexOf('> 1e-16')).toBeLessThan(
        body.indexOf('normalize(dPosX)'),
      );
      expect(body).toMatch(
        /dot\(bumped, bumped\) > 1e-12 \? normalize\(bumped\)/,
      );
      expect(body).not.toMatch(/normalize\(dFdx\(/);
    },
  );
});
