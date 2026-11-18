import {
  Color,
  DataTexture,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  MeshStandardMaterial,
  NearestFilter,
  RedFormat,
} from 'three';
import type { Object3D, WebGLProgramParametersWithUniforms } from 'three';
import { tuning } from '../core/tuning';
import {
  createUrbanMaterial,
  urbanColor,
  urbanKinds,
  syncUrbanMaterials,
} from './urbanMaterials';
import type { UrbanKind } from './urbanMaterials';
import { printMaterial, syncPrintPower } from './propPrints';
import { getPowerLevel } from './powerLevel';
import { addEnemyRim, syncEnemyRim } from './enemyRim';

export type MaterialKind =
  | 'world'
  | 'enemy'
  | 'enemyGlow'
  | 'interactive'
  | 'player'
  | 'power'
  | UrbanKind
  | 'neon_amber'
  | 'neon_green'
  | 'neon_violet'
  | 'neon_blue'
  | 'neon_white'
  | 'light_white';

/** Rodzaje bez własnego koloru w tuning (kolor pochodny). */
type StyleKind = MaterialKind | 'enemyDark';

type StyleMaterial =
  MeshToonMaterial | MeshBasicMaterial | MeshStandardMaterial;

const names = new Map<string, StyleKind>([
  ['mat_world', 'world'],
  ['mat_enemy', 'enemy'],
  ['mat_enemy_glow', 'enemyGlow'],
  ['mat_enemy_dark', 'enemyDark'],
  ['mat_interactive', 'interactive'],
  ['mat_player_cyan', 'player'],
  ['mat_power_magenta', 'power'],
]);
for (const kind of [
  ...urbanKinds,
  'neon_amber',
  'neon_green',
  'neon_violet',
  'neon_blue',
  'neon_white',
  'light_white',
] as const) {
  names.set(`mat_${kind}`, kind);
}
/** Materiały neonów: bloom selektywny świeci tylko z nich (patrz bloom.ts). */
const emissiveKinds = new Set<StyleKind>([
  'enemyGlow',
  'player',
  'power',
  'neon_amber',
  'neon_green',
  'neon_violet',
  'neon_blue',
  'neon_white',
  'light_white',
]);
/** Neony i światło z sieci gasną razem ze spadkiem napięcia (gracz, Rezonans i wrogowie nie). */
const mainsKinds = new Set<StyleKind>([
  'neon_amber',
  'neon_green',
  'neon_violet',
  'neon_blue',
  'neon_white',
  'light_white',
]);
const gridUniforms = {
  gridSize: { value: 2 },
  gridContrast: { value: 0.1 },
  gridLineWidth: { value: 1 },
};
const cache = new Map<StyleKind, StyleMaterial>();
/** Siła poświaty krawędzi kombinezonu względem płyt (część klucza programu). */
const ENEMY_DARK_RIM = 0.6;
const warnedNames = new Set<string>();
export const gradientMap = new DataTexture(
  new Uint8Array([150, 200, 255]),
  3,
  1,
  RedFormat,
);
gradientMap.minFilter = NearestFilter;
gradientMap.magFilter = NearestFilter;
gradientMap.generateMipmaps = false;
gradientMap.needsUpdate = true;

/**
 * Siatka płytek w przestrzeni świata na powierzchniach poziomych; płaskie normalne
 * z pochodnych pozycji, więc działa też dla instancji i skalowanych brył.
 */
function addFloorGrid(material: MeshToonMaterial): void {
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, gridUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGridPos;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 gridWorld = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          gridWorld = instanceMatrix * gridWorld;
        #endif
        vGridPos = (modelMatrix * gridWorld).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vGridPos;
        uniform float gridSize;
        uniform float gridContrast;
        uniform float gridLineWidth;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec3 gridCross = cross(dFdx(vGridPos), dFdy(vGridPos));
          vec3 gridNormal = dot(gridCross, gridCross) > 1e-12 ? normalize(gridCross) : vec3(0.0, 1.0, 0.0);
          float horizontal = smoothstep(0.85, 0.95, abs(gridNormal.y));
          vec2 cell = vGridPos.xz / gridSize;
          vec2 width = max(fwidth(cell), vec2(1e-5));
          vec2 dist = abs(fract(cell - 0.5) - 0.5) / width;
          float line = 1.0 - min(min(dist.x, dist.y) / gridLineWidth, 1.0);
          // Zanik, gdy płytka jest mniejsza niż kilka pikseli (moiré).
          float fade = 1.0 - smoothstep(0.15, 0.4, max(width.x, width.y));
          diffuseColor.rgb *= 1.0 - gridContrast * line * horizontal * fade;
        }`,
      );
  };
  material.customProgramCacheKey = () => 'floorGrid';
}

/** Kolor materiału; ciemny kombinezon wroga wynika z czerwieni wroga (`tuning.vfx.enemyDarkShade`). */
function colorFor(kind: StyleKind, target = new Color()): Color {
  if (kind === 'enemyDark')
    return target
      .set(tuning.render.enemy)
      .multiplyScalar(tuning.vfx.enemyDarkShade);
  if (urbanKinds.includes(kind as UrbanKind))
    return target.set(urbanColor(kind as UrbanKind));
  target.set(
    tuning.render[kind as Exclude<StyleKind, UrbanKind | 'enemyDark'>],
  );
  if (mainsKinds.has(kind)) target.multiplyScalar(getPowerLevel());
  return target;
}

export function getMaterial(kind: StyleKind): StyleMaterial {
  if (![...names.values()].includes(kind))
    throw new Error(`Nieznany rodzaj materiału: ${kind}`);
  const existing = cache.get(kind);
  if (existing) return existing;
  const color = colorFor(kind);
  const material = urbanKinds.includes(kind as UrbanKind)
    ? createUrbanMaterial(kind as UrbanKind)
    : kind === 'world' ||
        kind === 'enemy' ||
        kind === 'enemyDark' ||
        kind === 'interactive'
      ? new MeshToonMaterial({ color, gradientMap })
      : new MeshBasicMaterial({ color, toneMapped: false });
  if (emissiveKinds.has(kind)) material.userData.bloom = true;
  if (kind === 'enemy' || kind === 'enemyDark')
    // Poświata krawędzi zawsze w czerwieni wroga; na kombinezonie słabsza, żeby płyty odcinały się od niego.
    addEnemyRim(material, kind === 'enemyDark' ? ENEMY_DARK_RIM : 1);
  if (kind === 'world') addFloorGrid(material as MeshToonMaterial);
  material.name = [...names].find(([, value]) => value === kind)![0];
  cache.set(kind, material);
  return material;
}

/** Współdzielone materiały należą do rejestru, nie do pojedynczej sceny. */
export function syncMaterials(): void {
  syncUrbanMaterials();
  syncEnemyRim();
  gridUniforms.gridSize.value = Math.max(tuning.render.gridSize, 0.01);
  gridUniforms.gridContrast.value = tuning.render.gridContrast;
  gridUniforms.gridLineWidth.value = Math.max(
    tuning.render.gridLineWidth,
    0.01,
  );
  for (const [kind, material] of cache) {
    colorFor(kind, material.color);
  }
  syncPrintPower(getPowerLevel());
}

function materialForName(name: string): StyleMaterial {
  const kind = names.get(name);
  if (kind) return getMaterial(kind);
  const print = printMaterial(name);
  if (print) return print;
  if (!warnedNames.has(name)) {
    warnedNames.add(name);
    console.warn(`Nieznany materiał glTF "${name}"; użyto mat_world.`);
  }
  return getMaterial('world');
}

export function applyStyle(root: Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.material = Array.isArray(object.material)
      ? object.material.map((material) => materialForName(material.name))
      : materialForName(object.material.name);
  });
}
