import {
  CanvasTexture,
  Float32BufferAttribute,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  type BufferGeometry,
  type Object3D,
} from 'three';
import type { SkinDefinition } from '../progression/skinSchema';
import { surfaceFor } from './fppMaterials';

type Surface = keyof SkinDefinition['colors'];
const materials = new WeakMap<Material, Map<string, Material>>();
const patterns = new WeakMap<SkinDefinition, Map<string, CanvasTexture>>();
/** Powierzchnie, na które idzie wzór skina (rękojeść to w modelach także magazynek, kolba i łoże). */
const PATTERNED: readonly Surface[] = ['armor', 'grip'];

function patternTexture(skin: SkinDefinition, base: string) {
  if (skin.pattern === 'none' || typeof document === 'undefined') return null;
  let bySurface = patterns.get(skin);
  if (!bySurface) patterns.set(skin, (bySurface = new Map()));
  const cached = bySurface.get(base);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  const size = 64;
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = ctx.strokeStyle = skin.patternColor ?? skin.colors.trim;
  switch (skin.pattern) {
    case 'carbon':
      for (let y = 0; y < size; y += 8)
        for (let x = 0; x < size; x += 16) ctx.fillRect(x + (y % 16), y, 8, 5);
      break;
    case 'digital':
      for (let y = 0; y < size; y += 8)
        for (let x = 0; x < size; x += 8)
          if (((x / 8) * 13 + (y / 8) * 7 + (x * y) / 64) % 9 < 4)
            ctx.fillRect(x, y, 8, 8);
      break;
    case 'stripes':
      for (let x = -size; x < size; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + size, size);
        ctx.lineWidth = 8;
        ctx.stroke();
      }
      break;
    case 'hex':
      for (let row = -1; row <= 4; row++)
        for (let col = -1; col <= 2; col++) {
          const cx = col * 32 + (row % 2) * 16,
            cy = row * 16;
          ctx.beginPath();
          for (const [dx, dy] of [
            [0, -10],
            [16, -6],
            [16, 6],
            [0, 10],
            [-16, 6],
            [-16, -6],
          ] as const)
            ctx.lineTo(cx + dx, cy + dy);
          ctx.closePath();
          ctx.stroke();
        }
      break;
    case 'brushed':
      for (let y = 0; y < size; y += 2)
        ctx.fillRect((y * 13) % size, y, 8 + (y % 17), 1);
      break;
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.setScalar(skin.patternScale ?? 3);
  bySurface.set(base, texture);
  return texture;
}

// Modele GLB broni mają pozycje i normalne, ale nie mają współrzędnych UV.
function ensureUvs(geometry: BufferGeometry) {
  if (geometry.getAttribute('uv')) return;
  const pos = geometry.getAttribute('position'),
    normal = geometry.getAttribute('normal');
  if (!pos || !normal) return;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const scale = Math.max(
    box.max.x - box.min.x,
    box.max.y - box.min.y,
    box.max.z - box.min.z,
    0.001,
  );
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(normal.getX(i)),
      ny = Math.abs(normal.getY(i)),
      nz = Math.abs(normal.getZ(i));
    uv[i * 2] = (nx >= ny && nx >= nz ? pos.getZ(i) : pos.getX(i)) / scale;
    uv[i * 2 + 1] = (ny > nx && ny >= nz ? pos.getZ(i) : pos.getY(i)) / scale;
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
}

function tinted(
  source: Material,
  skin: SkinDefinition,
  surface: Surface,
): Material {
  if (!(
    source instanceof MeshStandardMaterial ||
    source instanceof MeshToonMaterial ||
    source instanceof MeshBasicMaterial
  ))
    return source;
  let cache = materials.get(source);
  if (!cache) materials.set(source, (cache = new Map()));
  const key = skin.id + ':' + surface;
  const found = cache.get(key);
  if (found) return found;
  const material = source.clone();
  material.onBeforeCompile = source.onBeforeCompile;
  material.customProgramCacheKey = source.customProgramCacheKey.bind(source);
  material.color.set(skin.colors[surface]);
  if (surface === 'accent' && 'emissive' in material)
    material.emissive.copy(material.color);
  if (surface !== 'accent' && material instanceof MeshStandardMaterial) {
    material.metalness = skin.metalness;
    material.roughness = skin.roughness;
  }
  if (PATTERNED.includes(surface) && skin.pattern !== 'none') {
    material.map = patternTexture(skin, skin.colors[surface]);
    if (material.map) material.color.set(0xffffff);
  }
  cache.set(key, material);
  return material;
}

export function applyWeaponSkin(
  root: Object3D,
  skin: SkinDefinition | null,
): void {
  function visit(node: Object3D): void {
    if (
      node.userData.moduleSlot ||
      node.userData.moduleId ||
      node.userData.skinExcluded
    )
      return;
    if (node instanceof Mesh) {
      const original: Material | Material[] =
        node.userData.skinOriginal ?? node.material;
      if (!skin) {
        if (node.userData.skinOriginal) {
          node.material = original;
          delete node.userData.skinOriginal;
        }
      } else {
        node.userData.skinOriginal = original;
        const recolor = (mat: Material) => {
          const accent =
            mat.name === 'mat_player_cyan' ||
            mat.userData.bloom === true ||
            node.name.includes('glow');
          const surface = accent
            ? 'accent'
            : surfaceFor(
                mat.name.startsWith('fpp_')
                  ? mat.name.slice(4)
                  : node.name || node.parent?.name || '',
              );
          if (surface === 'glove') return mat;
          if (PATTERNED.includes(surface) && skin.pattern !== 'none')
            ensureUvs(node.geometry);
          return tinted(mat, skin, surface);
        };
        node.material = Array.isArray(original)
          ? original.map(recolor)
          : recolor(original);
      }
    }
    for (const child of node.children) visit(child);
  }
  visit(root);
}
