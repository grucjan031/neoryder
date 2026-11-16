import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DataTexture,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  RGBAFormat,
} from 'three';
import type { Material, Object3D, Texture } from 'three';
import { gradientMap } from './materials';
import { palette } from './palette';

/**
 * Materiały widoku FPP (broń, rękojeści) niezależne od motywu: w motywie neon `mat_interactive`
 * jest jasny (#d9dde3), przez co broń wyglądała jak biała zabawka. Ciemny grafit z chłodną
 * krawędzią światła (rim) jest czytelny na jasnym i ciemnym tle, a cyan zostaje akcentem gracza.
 */
export type FppSurface = 'armor' | 'trim' | 'grip' | 'glove';

const SURFACES: Record<
  FppSurface,
  { color: string; emissive: string; rim: string; rimStrength: number }
> = {
  armor: {
    color: '#272e3a',
    emissive: '#0c1119',
    rim: '#9ab8dd',
    rimStrength: 0.4,
  },
  trim: {
    color: '#6f7a8e',
    emissive: '#141a24',
    rim: '#c8dcf5',
    rimStrength: 0.32,
  },
  grip: {
    color: '#181c24',
    emissive: '#06080c',
    rim: '#6f86a8',
    rimStrength: 0.22,
  },
  glove: {
    color: '#3a404b',
    emissive: '#090c12',
    rim: '#8aa3c8',
    rimStrength: 0.25,
  },
};

const cache = new Map<FppSurface, MeshToonMaterial>();

/** Rim: jasna krawędź zależna od kąta patrzenia, płaskie ściany dają fasetowy połysk. */
function addRim(material: MeshToonMaterial, rim: Color, strength: number) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.fppRimColor = { value: rim };
    shader.uniforms.fppRimStrength = { value: strength };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 fppRimColor; uniform float fppRimStrength;',
      )
      .replace(
        '#include <opaque_fragment>',
        `{
          // Lampy miasta tuż przy kamerze nie przepalają broni do bieli.
          // Natężenie względem albedo: miękkie kolano, najjaśniej ok. 1,8× koloru materiału.
          vec3 fppW = vec3(0.299, 0.587, 0.114);
          float fppX = dot(outgoingLight, fppW) / max(dot(diffuseColor.rgb, fppW), 1e-3);
          outgoingLight *= 1.8 / (1.0 + fppX);
          float fppFacing = abs(dot(normal, normalize(vViewPosition)));
          outgoingLight += fppRimColor * fppRimStrength * pow(1.0 - fppFacing, 4.0);
        }
        #include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () => 'fppRim';
}

export function fppMaterial(surface: FppSurface): MeshToonMaterial {
  const existing = cache.get(surface);
  if (existing) return existing;
  const spec = SURFACES[surface];
  const material = new MeshToonMaterial({
    color: spec.color,
    emissive: spec.emissive,
    gradientMap,
  });
  material.name = `fpp_${surface}`;
  material.userData.bloom = false;
  addRim(material, new Color(spec.rim), spec.rimStrength);
  cache.set(surface, material);
  return material;
}

/** Nazwa węzła z GLB -> powierzchnia; reszta `mat_interactive` dostaje pancerz. */
export function surfaceFor(name: string): FppSurface {
  if (name.startsWith('trim')) return 'trim';
  if (name.startsWith('grip')) return 'grip';
  if (name === 'tactical_glove') return 'glove';
  return 'armor';
}

/** Podmienia materiał obiektów interaktywnych modelu broni/rękojeści na materiały FPP. */
export function applyFppSurfaces(root: Object3D): void {
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const material = node.material as Material;
    if (Array.isArray(node.material)) return;
    if (material.name !== 'mat_interactive') return;
    const owner = node.name || node.parent?.name || '';
    node.material = fppMaterial(surfaceFor(owner));
  });
}

let glowTexture: Texture | null = null;

/** Miękka radialna plama (biały środek, przezroczysta krawędź) dla błysków i poświat. */
export function fppGlowTexture(): Texture {
  if (glowTexture) return glowTexture;
  const size = 64;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const g = ctx.createRadialGradient(
        size / 2,
        size / 2,
        0,
        size / 2,
        size / 2,
        size / 2,
      );
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.18, 'rgba(255,255,255,0.85)');
      g.addColorStop(0.45, 'rgba(255,255,255,0.28)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      glowTexture = new CanvasTexture(canvas);
      return glowTexture;
    }
  }
  // Środowisko bez DOM (testy): ta sama plama liczona ręcznie.
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - size / 2 + 0.5, y - size / 2 + 0.5) / (size / 2);
      const a = Math.max(0, 1 - d) ** 2;
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(a * 255);
    }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.needsUpdate = true;
  glowTexture = texture;
  return texture;
}

/** Addytywna poświata gracza (cyan) — bez zapisu głębi, świeci w bloomie. */
export function fppGlowMaterial(
  color: string = palette.cyan,
  opacity = 1,
  map: Texture | null = null,
): MeshBasicMaterial {
  const material = new MeshBasicMaterial({
    color,
    map,
    transparent: true,
    opacity,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  material.userData.bloom = true;
  return material;
}

/** Oznacza efekt: bez konturu (kontur na świetle wygląda jak czarna ramka). */
export function markGlow(object: Object3D): void {
  object.traverse((node) => {
    node.userData.noOutline = true;
  });
}
