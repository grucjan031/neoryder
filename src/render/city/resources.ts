import {
  CanvasTexture,
  Color,
  DataTexture,
  Group,
  InstancedMesh,
  Mesh,
  SRGBColorSpace,
  TextureLoader,
} from 'three';
import type { BufferGeometry, Material, Texture } from 'three';

export type TextureLoad = (
  url: string,
  onLoad: (texture: Texture) => void,
  onError: () => void,
) => void;
const warned = new Set<string>();

/** Własność tekstur obejmuje również odpowiedzi przychodzące po dispose(). */
export class CityTextures {
  private readonly textures = new Set<Texture>();
  private disposed = false;
  constructor(
    private readonly load: TextureLoad = (url, ok, fail) => {
      if (typeof document === 'undefined') {
        fail();
        return;
      }
      new TextureLoader().load(url, ok, undefined, fail);
    },
  ) {}

  request(
    folder: string,
    id: string,
    accept: (texture: Texture) => void,
  ): void {
    const fallback = this.own(this.fallback(id));
    accept(fallback);
    this.load(
      `/assets/textures/${folder}/${id}.webp`,
      (texture) => {
        if (this.disposed) {
          texture.dispose();
          return;
        }
        this.own(texture);
        accept(texture);
      },
      () => {
        if (this.disposed || warned.has(id)) return;
        warned.add(id);
        console.warn(
          `Oprawa miasta: brak tekstury ${id}; używam tekstury zastępczej.`,
        );
      },
    );
  }

  private own(texture: Texture): Texture {
    texture.colorSpace = SRGBColorSpace;
    this.textures.add(texture);
    return texture;
  }

  private fallback(id: string): Texture {
    if (typeof document === 'undefined') {
      const texture = new DataTexture(
        new Uint8Array([255, 255, 255, 255]),
        1,
        1,
      );
      texture.needsUpdate = true;
      return texture;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 512, 256);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5;
      ctx.strokeRect(14, 18, 484, 220);
      ctx.font = `bold ${Math.min(66, 700 / Math.max(1, id.length))}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(id, 256, 128, 460);
      ctx.font = '18px monospace';
      ctx.fillText('NEORYDER / 24H', 256, 202);
    }
    return new CanvasTexture(canvas);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const texture of this.textures) texture.dispose();
    this.textures.clear();
  }
}

export function disposeCityGroup(root: Group): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material])
      materials.add(material);
    if (object instanceof InstancedMesh) object.dispose();
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  root.removeFromParent();
  root.clear();
}

export const cityVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const radialFragment = /* glsl */ `
  uniform vec3 tint;
  uniform float opacity;
  varying vec2 vUv;
  void main() {
    float r = length(vUv * 2.0 - 1.0);
    float a = pow(max(0.0, 1.0 - r), 2.0) * opacity;
    gl_FragColor = vec4(tint, a);
    #include <colorspace_fragment>
  }
`;

export const cityColor = (color: string): Color => new Color(color);
