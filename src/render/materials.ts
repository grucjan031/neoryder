import {
  DataTexture,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  NearestFilter,
  RedFormat,
} from 'three';
import type { Object3D } from 'three';
import { tuning } from '../core/tuning';

export type MaterialKind =
  'world' | 'enemy' | 'enemyGlow' | 'interactive' | 'player' | 'power';

type StyleMaterial = MeshToonMaterial | MeshBasicMaterial;

const names = new Map<string, MaterialKind>([
  ['mat_world', 'world'],
  ['mat_enemy', 'enemy'],
  ['mat_enemy_glow', 'enemyGlow'],
  ['mat_interactive', 'interactive'],
  ['mat_player_cyan', 'player'],
  ['mat_power_magenta', 'power'],
]);
const cache = new Map<MaterialKind, StyleMaterial>();
const warnedNames = new Set<string>();
const gradientMap = new DataTexture(
  new Uint8Array([150, 200, 255]),
  3,
  1,
  RedFormat,
);
gradientMap.minFilter = NearestFilter;
gradientMap.magFilter = NearestFilter;
gradientMap.generateMipmaps = false;
gradientMap.needsUpdate = true;

export function getMaterial(kind: MaterialKind): StyleMaterial {
  if (![...names.values()].includes(kind))
    throw new Error(`Nieznany rodzaj materiału: ${kind}`);
  const existing = cache.get(kind);
  if (existing) return existing;
  const color = tuning.render[kind];
  const material =
    kind === 'world' || kind === 'enemy' || kind === 'interactive'
      ? new MeshToonMaterial({ color, gradientMap })
      : new MeshBasicMaterial({ color, toneMapped: false });
  material.name = [...names].find(([, value]) => value === kind)![0];
  cache.set(kind, material);
  return material;
}

/** Współdzielone materiały należą do rejestru, nie do pojedynczej sceny. */
export function syncMaterials(): void {
  for (const [kind, material] of cache) {
    material.color.set(tuning.render[kind]);
  }
}

function materialForName(name: string): StyleMaterial {
  const kind = names.get(name);
  if (kind) return getMaterial(kind);
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
