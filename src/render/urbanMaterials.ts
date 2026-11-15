import {
  Color,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector2,
  Vector4,
} from 'three';
import type { WebGLProgramParametersWithUniforms } from 'three';
import { tuning } from '../core/tuning';
import { assetTexture, surfaceTexture } from './surfaceTextures';
import type { SurfaceTexture } from './surfaceTextures';

export const urbanKinds = [
  'concrete',
  'asphalt',
  'metal',
  'facade',
  'trim',
  'glass',
  'cable',
  'paint',
  'lacquer',
  'rust',
  'corrugated',
  'plastic',
  'hivis',
  'rubber',
  'wood',
  'fabric',
  'machine',
  'paving',
  'plaster',
  'hazard',
] as const;
export type UrbanKind = (typeof urbanKinds)[number];

/**
 * Wygląd powierzchni miejskiej. `scale` = powtórzenia tekstury na metr (rzut
 * trójplanarny w przestrzeni świata), `bump` = mnożnik reliefu z jasności tekstury,
 * `wetness` = udział w odbiciach (reflections.ts).
 */
interface UrbanLook {
  texture: SurfaceTexture;
  scale: number;
  roughness: number;
  metalness: number;
  wetness: number;
  bump: number;
}
const look = (
  texture: SurfaceTexture,
  scale: number,
  roughness: number,
  metalness: number,
  bump: number,
  wetness = 0,
): UrbanLook => ({ texture, scale, roughness, metalness, wetness, bump });
export const urbanLooks: Record<UrbanKind, UrbanLook> = {
  concrete: look('concrete', 0.25, 0.8, 0, 0.5, 0.22),
  asphalt: look('asphalt', 0.25, 0.3, 0, 0.25, 1),
  metal: look('metal_panel', 0.25, 0.8, 0.35, 0.5),
  facade: look('brick', 0.25, 0.8, 0, 0.9),
  trim: look('metal_panel', 0.25, 0.8, 0.35, 0.3),
  glass: look('grime', 0.25, 0.8, 0, 0),
  cable: look('grime', 0.25, 0.8, 0, 0),
  paint: look('painted_metal', 0.7, 0.55, 0.25, 0.7),
  lacquer: look('painted_metal', 0.5, 0.3, 0.3, 0.25),
  rust: look('rust_metal', 0.8, 0.85, 0.3, 1),
  corrugated: look('corrugated', 0.5, 0.55, 0.35, 1.4),
  plastic: look('plastic', 1, 0.6, 0, 0.5),
  hivis: look('plastic', 1, 0.5, 0, 0.5),
  rubber: look('rubber', 1.2, 0.9, 0, 0.7),
  wood: look('wood_planks', 0.8, 0.85, 0, 1.1),
  fabric: look('tarp', 0.9, 0.95, 0, 0.8),
  machine: look('tech_panel', 0.6, 0.5, 0.35, 1),
  paving: look('paving', 0.5, 0.55, 0, 1, 0.45),
  plaster: look('plaster', 0.3, 0.9, 0, 0.8, 0.1),
  hazard: look('plastic', 1, 0.55, 0, 0.4),
};

export const urbanUniforms = {
  cityDetail: { value: 0 },
  cityBump: { value: 0 },
  hazardPeriod: { value: 0.3 },
  windowWarm: { value: new Color() },
  windowCool: { value: new Color() },
  glassGlow: { value: new Color() },
  windowPitch: { value: new Vector2(2.4, 3.2) },
  /** Zakres wymiarów okna: (minSzer, maxSzer, minWys, maxWys) w metrach. */
  windowSize: { value: new Vector4(1.2, 1.6, 1.6, 2.2) },
  /** Udział oświetlonych okien, emisja oświetlonych, emisja ciemnych, siła w bloomie. */
  windowParams: { value: new Vector4(0.4, 0.5, 0.02, 0.35) },
};

/** Atlasy okien (4x4 komórki po 256 px); do czasu załadowania okna są wyłączone. */
function windowAtlasUniforms() {
  const lit = assetTexture('atlas', 'windows_lit');
  const dark = assetTexture('atlas', 'windows_dark');
  return {
    windowLitMap: lit.map,
    windowLitReady: lit.ready,
    windowDarkMap: dark.map,
    windowDarkReady: dark.ready,
  };
}

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
    uniform float cityBump;
    uniform float hazardPeriod;
    uniform vec3 windowWarm;
    uniform vec3 windowCool;
    uniform vec3 glassGlow;
    uniform vec2 windowPitch;
    uniform vec4 windowSize;
    uniform vec4 windowParams;
    uniform sampler2D windowLitMap; uniform float windowLitReady;
    uniform sampler2D windowDarkMap; uniform float windowDarkReady;
    float cityHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float cityNoise(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(cityHash(i), cityHash(i+vec2(1,0)), f.x),
        mix(cityHash(i+vec2(0,1)), cityHash(i+vec2(1,1)), f.x), f.y);
    }
    // Relief bez UV (Mikkelsen, jak bumpmap three.js): wysokość różniczkowana w przestrzeni ekranu.
    vec3 cityPerturbNormal(vec3 surfPos, vec3 surfNorm, vec2 dHdxy, float faceDir) {
      vec3 sigmaX = normalize(dFdx(surfPos));
      vec3 sigmaY = normalize(dFdy(surfPos));
      vec3 r1 = cross(sigmaY, surfNorm);
      vec3 r2 = cross(surfNorm, sigmaX);
      float det = dot(sigmaX, r1) * faceDir;
      vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
      return normalize(abs(det) * surfNorm - grad);
    }`,
  );
  Object.assign(shader.uniforms, urbanUniforms);
}

// Okno wybierane z atlasu 4x4 deterministycznie z indeksu okna na ścianie (lustro: city/windowAtlas.ts).
const windowCode = /* glsl */ `
  vec3 cityCross = cross(dFdx(vCityWorld), dFdy(vCityWorld));
  vec3 cityNormal = abs(dot(cityCross, cityCross) > 1e-12 ? normalize(cityCross) : vec3(0.0, 1.0, 0.0));
  vec2 cityUv = cityNormal.x > cityNormal.z ? vCityWorld.zy : vCityWorld.xy;
  vec2 windowCell = cityUv / windowPitch;
  vec2 windowId = floor(windowCell);
  float windowSeed = cityHash(windowId);
  vec2 windowDim = vec2(
    mix(windowSize.x, windowSize.y, cityHash(windowId + vec2(17.3, 5.1))),
    mix(windowSize.z, windowSize.w, cityHash(windowId + vec2(3.7, 41.9))));
  vec2 windowLocal = (fract(windowCell) - 0.5) * windowPitch / windowDim + 0.5;
  float windowLit = step(windowSeed, windowParams.x);
  float windowReady = mix(windowDarkReady, windowLitReady, windowLit);
  vec2 windowInside = step(vec2(0.0), windowLocal) * step(windowLocal, vec2(1.0));
  float windowMask = windowInside.x * windowInside.y * (1.0-step(0.5,cityNormal.y)) * windowReady;
  float windowIndex = min(15.0, floor(cityHash(windowId + vec2(9.1, 23.7)) * 16.0));
  vec2 windowAtlasCell = vec2(mod(windowIndex, 4.0), floor(windowIndex / 4.0));
  vec2 windowImage = vec2(windowLocal.x, 1.0 - windowLocal.y);
  vec2 windowUv = (windowAtlasCell + clamp(windowImage, 0.012, 0.988)) * 0.25;
  vec2 windowDx = dFdx(windowImage) * 0.25;
  vec2 windowDy = dFdy(windowImage) * 0.25;
  vec3 windowTex = vec3(0.0);
  if (windowMask > 0.0) {
    windowTex = windowLit > 0.5 ? textureGrad(windowLitMap, windowUv, windowDx, windowDy).rgb
      : textureGrad(windowDarkMap, windowUv, windowDx, windowDy).rgb;
  }
  vec3 windowLight = windowTex * mix(windowParams.z, windowParams.y, windowLit) * windowMask * cityDetail;
`;

const glsl = (value: number) => value.toFixed(4);

export function createUrbanMaterial(kind: UrbanKind): MeshStandardMaterial {
  const config = urbanLooks[kind];
  const material = new MeshStandardMaterial({
    color: tuning.render[kind],
    roughness: config.roughness,
    metalness: config.metalness,
  });
  material.userData.wetness = config.wetness;
  const scale = glsl(config.scale);
  // Kafel tekstury ma 1024 px: relief gaśnie, gdy piksel ekranu obejmuje kilka tekseli.
  const texelsPerPixel = glsl(config.scale * 1024);
  material.onBeforeCompile = (shader) => {
    worldPositionShader(shader);
    if (kind === 'facade')
      Object.assign(shader.uniforms, windowAtlasUniforms());
    const surface = surfaceTexture(config.texture);
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
        float cityHeight = 0.0;
        if (cityDetail > 0.0) {
          vec3 nCross = cross(dFdx(vCityWorld), dFdy(vCityWorld));
          vec3 nCity = abs(dot(nCross, nCross) > 1e-12 ? normalize(nCross) : vec3(0.0, 1.0, 0.0));
          vec3 weights = pow(nCity,vec3(4.0)); weights /= max(dot(weights,vec3(1.0)),0.001);
          vec3 tex = vec3(0.0);
          if (surfaceReady > 0.5) tex = texture2D(surfaceMap,vCityWorld.zy*${scale}).rgb*weights.x
            + texture2D(surfaceMap,vCityWorld.xz*${scale}).rgb*weights.y
            + texture2D(surfaceMap,vCityWorld.xy*${scale}).rgb*weights.z;
          cityHeight = dot(tex, vec3(0.299, 0.587, 0.114));
          float grain = cityNoise(vCityWorld.xz*18.0 + vCityWorld.y*7.0);
          float dirt = cityNoise(vCityWorld.xy*0.4);
          if (grimeReady > 0.5) dirt = texture2D(grimeMap,vCityWorld.xy*0.25).r;
          diffuseColor.rgb *= mix(vec3(0.82+grain*0.18),vec3(0.5)+tex*0.9,surfaceReady)*(0.85+dirt*0.15);
          ${
            kind === 'hazard'
              ? `vec2 hazardUv = nCity.y > max(nCity.x, nCity.z) ? vCityWorld.xz
              : (nCity.x > nCity.z ? vCityWorld.zy : vCityWorld.xy);
          float hazardStripe = step(0.5, fract((hazardUv.x + hazardUv.y) / max(hazardPeriod, 0.01)));
          diffuseColor.rgb *= mix(1.0, 0.07, hazardStripe);`
              : ''
          }
        }
        ${kind === 'metal' ? 'diffuseColor.rgb *= 1.0 - cityDetail * 0.3 * step(0.97,fract(vCityWorld.y*1.5));' : ''}
        ${
          kind === 'facade'
            ? `${windowCode}
          diffuseColor.rgb = mix(diffuseColor.rgb, windowTex * 0.3, windowMask * cityDetail);
          diffuseColor.rgb *= 1.0 - cityDetail*0.35*step(0.94,fract(windowCell.y));`
            : ''
        }
      `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor * mix(1.0, 0.8 + cityHeight * 0.5, cityDetail * surfaceReady), 0.04, 1.0);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        if (cityBump > 0.0 && cityDetail > 0.0 && surfaceReady > 0.5) {
          float cityBumpFade = 1.0 - smoothstep(1.0, 4.0, length(fwidth(vCityWorld)) * ${texelsPerPixel});
          vec2 cityDh = vec2(dFdx(cityHeight), dFdy(cityHeight)) * cityBump * ${glsl(config.bump)} * cityBumpFade;
          normal = cityPerturbNormal(-vViewPosition, normal, cityDh, faceDirection);
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        ${kind === 'facade' ? 'totalEmissiveRadiance += windowLight;' : ''}
        ${kind === 'glass' ? 'totalEmissiveRadiance += glassGlow * cityDetail * (0.3 + 0.7*pow(max(0.0,1.0-abs(dot(normal,normalize(vViewPosition)))),3.0));' : ''}
      `,
      );
  };
  material.customProgramCacheKey = () => `urban:${kind}`;
  if (kind === 'facade') {
    const glow = new MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    glow.onBeforeCompile = (shader) => {
      worldPositionShader(shader);
      Object.assign(shader.uniforms, windowAtlasUniforms());
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>\n${windowCode}\nfloat windowGlow = windowMask * windowLit * cityDetail; diffuseColor.rgb = windowTex * windowParams.w; diffuseColor.a = windowGlow * 0.18;`,
        )
        .replace(
          '#include <opaque_fragment>',
          '#include <opaque_fragment>\ngl_FragColor.a = windowGlow * 0.18;',
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
  urbanUniforms.cityBump.value = tuning.render.cityBumpStrength;
  urbanUniforms.hazardPeriod.value = tuning.render.cityHazardPeriod;
  urbanUniforms.windowWarm.value.set(tuning.render.panoramaWindowWarm);
  urbanUniforms.windowCool.value.set(tuning.render.panoramaWindowCool);
  urbanUniforms.glassGlow.value.set(tuning.render.skyHorizon);
  const c = tuning.city;
  urbanUniforms.windowPitch.value.set(c.windowPitchXM, c.windowPitchYM);
  urbanUniforms.windowSize.value.set(
    c.windowMinWidthM,
    c.windowMaxWidthM,
    c.windowMinHeightM,
    c.windowMaxHeightM,
  );
  urbanUniforms.windowParams.value.set(
    c.windowLitFraction,
    c.windowLitEmission,
    c.windowDarkEmission,
    c.windowBloom,
  );
}
