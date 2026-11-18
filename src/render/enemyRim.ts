import { Color } from 'three';
import type { Material, WebGLProgramParametersWithUniforms } from 'three';
import { tuning } from '../core/tuning';

/**
 * Poświata krawędzi wrogów (rim/fresnel w czerwieni wroga) na `mat_enemy` i `mat_enemy_dark`.
 *
 * Z bliska subtelna (siła i wykładnik z motywu: `tuning.render.enemyRim*`), z odległością
 * szersza i mocniejsza, a daleko dochodzi płaskie wypełnienie bryły czerwienią — wróg czyta się
 * jako czerwona sylwetka, nie tylko świecące akcenty. Mgła liczona jest w kompozycji
 * (`outline.ts`, mieszanie z kolorem mgły po materiale), więc emisja jest z góry dzielona przez
 * `1 - mgła`: dodatek do koloru przetrwa wymieszanie z mgłą. Wszystko na wspólnych uniformach,
 * program zależy tylko od stałego mnożnika materiału (`customProgramCacheKey`).
 */
export interface EnemyRimParams {
  /** Siła i wykładnik poświaty z bliska (motyw; 0 = bez poświaty). */
  strength: number;
  power: number;
  /** Odległość [m], od której poświata rośnie, i ta, przy której osiąga wartości dalekie. */
  nearM: number;
  farM: number;
  /** Mnożnik siły, wykładnik i płaskie wypełnienie bryły na dystansie `farM`. */
  farGain: number;
  farPower: number;
  farFill: number;
  /** Mgła kompozycji (jak w `outline.ts`) i ile z niej kompensować (0..1). */
  fogNear: number;
  fogFar: number;
  fogStrength: number;
  heightFogDensity: number;
  heightFogFalloff: number;
  fogCompensation: number;
}

/** Wysokość oka nad podłogą przyjęta do przybliżenia mgły wysokościowej [m]. */
const EYE_HEIGHT_M = 1.6;
/** Dolna granica `1 - mgła` w kompensacji: bez wybuchu jasności w gęstej mgle. */
const MIN_FOG_KEEP = 0.25;

const uniforms = {
  enemyRimStrength: { value: 0 },
  enemyRimPower: { value: 2.5 },
  enemyRimColor: { value: new Color() },
  enemyRimNear: { value: 6 },
  enemyRimFar: { value: 24 },
  enemyRimFarGain: { value: 1 },
  enemyRimFarPower: { value: 2.5 },
  enemyRimFarFill: { value: 0 },
  enemyRimFogNear: { value: 14 },
  enemyRimFogFar: { value: 80 },
  enemyRimFogStrength: { value: 0 },
  enemyRimHeightFog: { value: 0 },
  enemyRimFogCompensation: { value: 1 },
};

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

/** Gęstość mgły wysokościowej przeliczona na metr promienia na wysokości oka. */
function heightFogPerM(p: EnemyRimParams): number {
  return p.heightFogDensity * Math.exp(-EYE_HEIGHT_M * p.heightFogFalloff);
}

/**
 * Odpowiednik shadera (TS, do testów i strojenia): emisja poświaty w głębi `depth` m dla
 * krawędzi `facing` (0 = powierzchnia na wprost kamery, 1 = krawędź sylwetki), przed mnożnikiem
 * materiału (`rimScale`, kombinezon słabszy od płyt).
 */
export function enemyRimAt(
  depth: number,
  facing: number,
  p: EnemyRimParams,
  rimScale = 1,
): number {
  const far = smoothstep(p.nearM, Math.max(p.farM, p.nearM + 1e-3), depth);
  const power = p.power + (p.farPower - p.power) * far;
  const rim =
    Math.pow(Math.max(0, Math.min(facing, 1)), Math.max(power, 1e-4)) *
    rimScale;
  const strength = p.strength * (1 + (p.farGain - 1) * far);
  const fill = p.strength * p.farFill * far;
  const fog =
    1 -
    (1 -
      smoothstep(p.fogNear, Math.max(p.fogFar, p.fogNear + 1e-3), depth) *
        p.fogStrength) *
      Math.exp(-heightFogPerM(p) * depth);
  const keep = Math.max(1 - fog * p.fogCompensation, MIN_FOG_KEEP);
  return (strength * rim + fill) / keep;
}

/**
 * Bieżące parametry z `tuning` (motyw + `tuning.vfx.enemyRim*`). Dawna poświata motywu jest
 * dolną granicą na każdym dystansie: mnożnik ≥ 1, wykładnik daleki ≤ bliskiego (pow z
 * krawędzi ≤ 1 rośnie), wypełnienie ≥ 0, kompensacja mgły w 0..1 (tylko wzmacnia).
 */
export function enemyRimParams(): EnemyRimParams {
  const r = tuning.render;
  const v = tuning.vfx;
  return {
    strength: r.enemyRimStrength,
    power: r.enemyRimPower,
    nearM: v.enemyRimNearM,
    farM: v.enemyRimFarM,
    farGain: Math.max(v.enemyRimFarGain, 1),
    farPower: Math.min(v.enemyRimFarPower, r.enemyRimPower),
    farFill: Math.max(v.enemyRimFarFill, 0),
    fogNear: r.fogNear,
    fogFar: r.fogFar,
    fogStrength: r.fogStrength,
    heightFogDensity: r.heightFogDensity,
    heightFogFalloff: r.heightFogFalloff,
    fogCompensation: Math.min(Math.max(v.enemyRimFogCompensation, 0), 1),
  };
}

/** Przepisuje strojenie do wspólnych uniformów (co klatkę z `syncMaterials`). */
export function syncEnemyRim(): void {
  const p = enemyRimParams();
  uniforms.enemyRimStrength.value = p.strength;
  uniforms.enemyRimPower.value = p.power;
  uniforms.enemyRimColor.value.set(tuning.render.enemy);
  uniforms.enemyRimNear.value = p.nearM;
  uniforms.enemyRimFar.value = Math.max(p.farM, p.nearM + 1e-3);
  uniforms.enemyRimFarGain.value = p.farGain;
  uniforms.enemyRimFarPower.value = p.farPower;
  uniforms.enemyRimFarFill.value = p.farFill;
  uniforms.enemyRimFogNear.value = p.fogNear;
  uniforms.enemyRimFogFar.value = Math.max(p.fogFar, p.fogNear + 1e-3);
  uniforms.enemyRimFogStrength.value = p.fogStrength;
  uniforms.enemyRimHeightFog.value = heightFogPerM(p);
  uniforms.enemyRimFogCompensation.value = p.fogCompensation;
}

const declarations = /* glsl */ `
uniform float enemyRimStrength;
uniform float enemyRimPower;
uniform vec3 enemyRimColor;
uniform float enemyRimNear;
uniform float enemyRimFar;
uniform float enemyRimFarGain;
uniform float enemyRimFarPower;
uniform float enemyRimFarFill;
uniform float enemyRimFogNear;
uniform float enemyRimFogFar;
uniform float enemyRimFogStrength;
uniform float enemyRimHeightFog;
uniform float enemyRimFogCompensation;`;

function emission(rimScale: string): string {
  return /* glsl */ `
  {
    float rimDepth = vViewPosition.z;
    float rimFarT = smoothstep(enemyRimNear, enemyRimFar, rimDepth);
    float rimFacing = max(0.0, 1.0 - abs(dot(normal, normalize(vViewPosition))));
    float rimEdge = pow(rimFacing, max(mix(enemyRimPower, enemyRimFarPower, rimFarT), 1e-4)) * ${rimScale};
    float rimFog = 1.0 - (1.0 - smoothstep(enemyRimFogNear, enemyRimFogFar, rimDepth) * enemyRimFogStrength)
      * exp(-enemyRimHeightFog * rimDepth);
    float rimKeep = max(1.0 - rimFog * enemyRimFogCompensation, ${MIN_FOG_KEEP.toFixed(2)});
    totalEmissiveRadiance += enemyRimColor * enemyRimStrength
      * (mix(1.0, enemyRimFarGain, rimFarT) * rimEdge + enemyRimFarFill * rimFarT) / rimKeep;
  }`;
}

/**
 * Wpina poświatę w materiał toon wroga. `rimScale` — stały mnożnik krawędzi materiału
 * (kombinezon słabszy od płyt); jest częścią klucza programu, więc programów jest tyle,
 * ile różnych mnożników (dziś dwa).
 */
export function addEnemyRim(material: Material, rimScale: number): void {
  const scale = rimScale.toFixed(2);
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>${declarations}`)
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>${emission(scale)}`,
      );
  };
  material.customProgramCacheKey = () => `enemyRim${scale}`;
}
