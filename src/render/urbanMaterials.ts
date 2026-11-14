import { Color, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import type { WebGLProgramParametersWithUniforms } from 'three';
import { tuning } from '../core/tuning';
import { surfaceTexture } from './surfaceTextures';
import type { SurfaceTexture } from './surfaceTextures';

export const urbanKinds = [
  'concrete',
  'asphalt',
  'metal',
  'facade',
  'trim',
  'glass',
  'cable',
] as const;
export type UrbanKind = (typeof urbanKinds)[number];
export const urbanUniforms = {
  cityDetail: { value: 0 },
  windowWarm: { value: new Color() },
  windowCool: { value: new Color() },
  glassGlow: { value: new Color() },
};

export function worldPositionShader(
  shader: WebGLProgramParametersWithUniforms,
): void {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vCityWorld;')
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec4 cityWorld = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        cityWorld = instanceMatrix * cityWorld;
      #endif
      vCityWorld = (modelMatrix * cityWorld).xyz;`,
    );
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <common>',
    `#include <common>
    varying vec3 vCityWorld;
    uniform float cityDetail;
    uniform vec3 windowWarm;
    uniform vec3 windowCool;
    uniform vec3 glassGlow;
    float cityHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float cityNoise(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(cityHash(i), cityHash(i+vec2(1,0)), f.x),
        mix(cityHash(i+vec2(0,1)), cityHash(i+vec2(1,1)), f.x), f.y);
    }`,
  );
  Object.assign(shader.uniforms, urbanUniforms);
}

const windowCode = /* glsl */ `
  vec3 cityNormal = abs(normalize(cross(dFdx(vCityWorld), dFdy(vCityWorld))));
  vec2 cityUv = cityNormal.x > cityNormal.z ? vCityWorld.zy : vCityWorld.xy;
  vec2 windowCell = cityUv / vec2(1.7, 3.2);
  vec2 windowLocal = fract(windowCell);
  float windowSeed = cityHash(floor(windowCell));
  vec2 windowEdge = smoothstep(vec2(0.17,0.22), vec2(0.20,0.25), windowLocal)
    * (1.0-smoothstep(vec2(0.78,0.76), vec2(0.81,0.79), windowLocal));
  float windowMask = windowEdge.x * windowEdge.y * (1.0-step(0.5,cityNormal.y));
  float shutters = mix(1.0, 0.3 + 0.7*step(0.25,fract(cityUv.y*7.0)), step(0.72,windowSeed));
  vec3 windowLight = mix(windowWarm, windowCool, step(0.65,windowSeed))
    * windowMask * step(0.48,windowSeed) * shutters * cityDetail;
`;

export function createUrbanMaterial(kind: UrbanKind): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    color: tuning.render[kind],
    roughness: kind === 'asphalt' ? 0.3 : 0.8,
    metalness: kind === 'metal' || kind === 'trim' ? 0.35 : 0,
  });
  material.userData.wetness =
    kind === 'asphalt' ? 1 : kind === 'concrete' ? 0.22 : 0;
  const textureNames: Partial<Record<UrbanKind, SurfaceTexture>> = {
    concrete: 'concrete',
    asphalt: 'asphalt',
    metal: 'metal_panel',
    facade: 'brick',
    trim: 'metal_panel',
    cable: 'grime',
  };
  material.onBeforeCompile = (shader) => {
    worldPositionShader(shader);
    const surface = surfaceTexture(textureNames[kind] ?? 'grime');
    const grime = surfaceTexture('grime');
    Object.assign(shader.uniforms, {
      surfaceMap: surface.map,
      surfaceReady: surface.ready,
      grimeMap: grime.map,
      grimeReady: grime.ready,
    });
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
      uniform sampler2D surfaceMap; uniform float surfaceReady;
      uniform sampler2D grimeMap; uniform float grimeReady;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 nCity = abs(normalize(cross(dFdx(vCityWorld), dFdy(vCityWorld))));
        vec3 weights = pow(nCity,vec3(4.0)); weights /= max(dot(weights,vec3(1.0)),0.001);
        vec3 tex = texture2D(surfaceMap,vCityWorld.zy*0.25).rgb*weights.x
          + texture2D(surfaceMap,vCityWorld.xz*0.25).rgb*weights.y
          + texture2D(surfaceMap,vCityWorld.xy*0.25).rgb*weights.z;
        float grain = cityNoise(vCityWorld.xz*18.0 + vCityWorld.y*7.0);
        float dirt = mix(cityNoise(vCityWorld.xy*0.4),texture2D(grimeMap,vCityWorld.xy*0.25).r,grimeReady);
        diffuseColor.rgb *= mix(vec3(1.0), mix(vec3(0.82+grain*0.18),vec3(0.5)+tex*0.9,surfaceReady)*(0.85+dirt*0.15),cityDetail);
        ${kind === 'metal' ? 'diffuseColor.rgb *= 1.0 - cityDetail * 0.3 * step(0.97,fract(vCityWorld.y*1.5));' : ''}
        ${
          kind === 'facade'
            ? `${windowCode}
          diffuseColor.rgb *= 1.0 - windowMask * cityDetail * 0.7;
          diffuseColor.rgb *= 1.0 - cityDetail*0.35*step(0.94,windowLocal.y);`
            : ''
        }
      `,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        ${kind === 'facade' ? 'totalEmissiveRadiance += windowLight * 0.65;' : ''}
        ${kind === 'glass' ? 'totalEmissiveRadiance += glassGlow * cityDetail * (0.3 + 0.7*pow(1.0-abs(dot(normal,normalize(vViewPosition))),3.0));' : ''}
      `,
      );
  };
  material.customProgramCacheKey = () => `urban:${kind}`;
  if (kind === 'facade') {
    const glow = new MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    glow.onBeforeCompile = (shader) => {
      worldPositionShader(shader);
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>\n${windowCode}\ndiffuseColor.rgb = windowLight * 0.18; diffuseColor.a = windowMask * step(0.48,windowSeed) * cityDetail * 0.18;`,
        )
        .replace(
          '#include <opaque_fragment>',
          '#include <opaque_fragment>\ngl_FragColor.a = windowMask * step(0.48,windowSeed) * cityDetail * 0.18;',
        );
    };
    glow.customProgramCacheKey = () => 'facadeEmission';
    material.userData.bloom = true;
    material.userData.bloomMaterial = glow;
  }
  return material;
}

export function syncUrbanMaterials(): void {
  urbanUniforms.cityDetail.value = tuning.render.citySurfaceDetail;
  urbanUniforms.windowWarm.value.set(tuning.render.panoramaWindowWarm);
  urbanUniforms.windowCool.value.set(tuning.render.panoramaWindowCool);
  urbanUniforms.glassGlow.value.set(tuning.render.skyHorizon);
}
