import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  TextureLoader,
} from 'three';
import type { Texture } from 'three';
import { printMaterial } from '../render/propPrints';
import { assetTexture } from '../render/surfaceTextures';
import type {
  HubFireDef,
  HubPanelDef,
  HubStationDef,
} from '../world/hubSchema';

const DEFAULT_TILE_TINT = '#8e9ab0';
const DEFAULT_LABEL_COLOR = '#ffae1a';
/** Rozmiar tekstury napisu w px na metr szerokości. */
const LABEL_PX_PER_M = 256;
const FLAME_COLOR = '#ffae1a';
/** Płomień: liczba skrzyżowanych płaszczyzn i wysokość względem `size`. */
const FLAME_PLANES = 3;
const FLAME_HEIGHT = 1.4;
// Lista z Vite pozwala pominąć żądanie brakującego pliku (bez błędów HTTP w konsoli).
const availablePosters = new Set(
  Object.keys(import.meta.glob('/public/assets/textures/posters/*.webp')).map(
    (path) => path.slice('/public'.length),
  ),
);
const posterTextures = new Map<string, Texture>();

/**
 * Kosmetyczna oprawa kryjówki spoza `dressingSchema`: okładziny ścian z kafli, ekrany
 * (nadruki `mat_screen_*`), plakaty/banery/murale (`posters/`), neonowe napisy stacji i płomienie beczek. Bez colliderów; `dispose` zwalnia
 * geometrie, materiały i tekstury napisów (współdzielone tekstury zasobów zostają w cache).
 */
export class HubDecor {
  readonly root = new Group();
  private readonly geometries: PlaneGeometry[] = [];
  private readonly materials: (MeshStandardMaterial | MeshBasicMaterial)[] = [];
  private readonly textures: Texture[] = [];
  private readonly flames: { mesh: Mesh; baseScale: number; phase: number }[] =
    [];
  private flameTexture: CanvasTexture | null = null;
  private timeS = 0;
  private disposed = false;

  constructor(
    panels: readonly HubPanelDef[],
    stations: readonly HubStationDef[],
    fires: readonly HubFireDef[] = [],
  ) {
    for (const panel of panels)
      this.root.add(
        panel.kind === 'tiles'
          ? this.tiles(panel)
          : panel.kind === 'poster'
            ? this.poster(panel)
            : this.screen(panel),
      );
    for (const station of stations)
      if (station.sign) this.root.add(this.label(station));
    fires.forEach((fire, index) => this.fire(fire, index));
  }

  /** Migotanie płomieni (czas kosmetyczny, bez RNG). */
  update(dt: number): void {
    this.timeS += dt;
    for (const flame of this.flames) {
      const t = this.timeS * 7 + flame.phase;
      const flicker = 1 + 0.16 * Math.sin(t) + 0.1 * Math.sin(t * 2.7 + 1.3);
      flame.mesh.scale.set(flame.baseScale, flame.baseScale * flicker, 1);
    }
  }

  private plane(panel: {
    position: { x: number; y: number; z: number };
    size: { w: number; h: number };
    yaw: number;
  }): { geometry: PlaneGeometry; place: (mesh: Mesh) => void } {
    const geometry = new PlaneGeometry(panel.size.w, panel.size.h);
    this.geometries.push(geometry);
    return {
      geometry,
      place: (mesh) => {
        mesh.position.set(panel.position.x, panel.position.y, panel.position.z);
        mesh.rotation.y = panel.yaw;
      },
    };
  }

  /** Kafle: tekstura powtarzana co `tileM` m przez skalowanie UV (współdzielona tekstura nie jest modyfikowana). */
  private tiles(panel: HubPanelDef): Mesh {
    const { geometry, place } = this.plane(panel);
    const tileM = panel.tileM ?? 3;
    const uv = geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++)
      uv.setXY(
        i,
        (uv.getX(i) * panel.size.w) / tileM,
        (uv.getY(i) * panel.size.h) / tileM,
      );
    const material = new MeshStandardMaterial({
      color: new Color(panel.tint ?? DEFAULT_TILE_TINT),
      roughness: 0.55,
      metalness: 0,
    });
    this.materials.push(material);
    assetTexture('surfaces', panel.texture, (texture) => {
      if (this.disposed) return;
      material.map = texture;
      material.needsUpdate = true;
    });
    const mesh = new Mesh(geometry, material);
    place(mesh);
    return mesh;
  }

  /** Ekran: materiał nadruku `mat_screen_*` (świeci w bloomie); UV odwrócone w V jak w glTF (tekstury bez flipY). */
  private screen(panel: HubPanelDef): Mesh {
    const { geometry, place } = this.plane(panel);
    const uv = geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    const material = printMaterial(`mat_${panel.texture}`);
    if (!material)
      throw new Error(`Nieprawidłowa nazwa ekranu: ${panel.texture}`);
    const mesh = new Mesh(geometry, material);
    mesh.userData.noOutline = true;
    place(mesh);
    return mesh;
  }

  /** Plakat, baner albo mural: nieprzezroczysta płaszczyzna z `posters/<texture>.webp`. */
  private poster(panel: HubPanelDef): Mesh {
    const { geometry, place } = this.plane(panel);
    const material = new MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.85,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
    });
    this.materials.push(material);
    const path = `/assets/textures/posters/${panel.texture}.webp`;
    if (typeof window !== 'undefined') {
      const cached = posterTextures.get(path);
      if (cached) {
        material.map = cached;
      } else if (availablePosters.has(path)) {
        new TextureLoader().load(path, (texture) => {
          texture.colorSpace = SRGBColorSpace;
          texture.anisotropy = 4;
          posterTextures.set(path, texture);
          if (this.disposed) return;
          material.map = texture;
          material.needsUpdate = true;
        });
      } else {
        console.warn(`Brak tekstury ${path}; użyto wzoru zastępczego.`);
        material.color.set('#3a4458');
      }
    }
    const mesh = new Mesh(geometry, material);
    mesh.userData.noOutline = true;
    place(mesh);
    return mesh;
  }

  /** Płomień: kilka skrzyżowanych płaszczyzn z gradientem, mieszanie addytywne i bloom. */
  private fire(def: HubFireDef, seed: number): void {
    if (typeof document === 'undefined') return;
    this.flameTexture ??= this.makeFlameTexture();
    const size = def.size ?? 0.6;
    const geometry = new PlaneGeometry(size, size * FLAME_HEIGHT);
    geometry.translate(0, (size * FLAME_HEIGHT) / 2, 0);
    this.geometries.push(geometry);
    const material = new MeshBasicMaterial({
      map: this.flameTexture,
      color: 0xffffff,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      side: DoubleSide,
    });
    material.userData.bloom = true;
    this.materials.push(material);
    for (let i = 0; i < FLAME_PLANES; i++) {
      const mesh = new Mesh(geometry, material);
      mesh.position.set(def.position.x, def.position.y, def.position.z);
      mesh.rotation.y = (i * Math.PI) / FLAME_PLANES;
      mesh.userData.noOutline = true;
      this.root.add(mesh);
      this.flames.push({ mesh, baseScale: 1, phase: seed * 2.1 + i * 1.7 });
    }
  }

  private makeFlameTexture(): CanvasTexture | null {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 96;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const gradient = context.createRadialGradient(32, 70, 2, 32, 62, 34);
    gradient.addColorStop(0, '#fff1d6');
    gradient.addColorStop(0.35, FLAME_COLOR);
    gradient.addColorStop(1, '#00000000');
    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(32, 2);
    context.bezierCurveTo(52, 34, 62, 52, 50, 80);
    context.quadraticCurveTo(32, 98, 14, 80);
    context.bezierCurveTo(2, 52, 14, 36, 32, 2);
    context.fill();
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    this.textures.push(texture);
    return texture;
  }

  /** Neonowy napis z `label` stacji (tekst rysowany na płótnie, mieszanie addytywne). */
  private label(station: HubStationDef): Mesh {
    const sign = station.sign!;
    const { geometry, place } = this.plane({
      position: sign.position,
      size: sign.size,
      yaw: sign.yaw,
    });
    const material = new MeshBasicMaterial({
      color: 0xffffff,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    material.userData.bloom = true;
    this.materials.push(material);
    if (typeof document !== 'undefined') {
      const texture = this.labelTexture(
        station.label,
        sign.size,
        sign.color ?? DEFAULT_LABEL_COLOR,
      );
      if (texture) {
        material.map = texture;
        this.textures.push(texture);
      }
    }
    const mesh = new Mesh(geometry, material);
    mesh.userData.noOutline = true;
    mesh.name = `label:${station.id}`;
    place(mesh);
    return mesh;
  }

  private labelTexture(
    text: string,
    size: { w: number; h: number },
    color: string,
  ): CanvasTexture | null {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(size.w * LABEL_PX_PER_M);
    canvas.height = Math.round(size.h * LABEL_PX_PER_M);
    const context = canvas.getContext('2d');
    if (!context) return null;
    const { width, height } = canvas;
    context.clearRect(0, 0, width, height);
    context.strokeStyle = color;
    context.lineWidth = Math.max(3, height * 0.06);
    context.strokeRect(
      context.lineWidth,
      context.lineWidth,
      width - context.lineWidth * 2,
      height - context.lineWidth * 2,
    );
    let fontPx = height * 0.56;
    context.font = `bold ${fontPx}px monospace`;
    const measured = context.measureText(text).width;
    const maxWidth = width * 0.86;
    if (measured > maxWidth) {
      fontPx *= maxWidth / measured;
      context.font = `bold ${fontPx}px monospace`;
    }
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.shadowColor = color;
    context.shadowBlur = height * 0.12;
    context.fillStyle = color;
    context.fillText(text, width / 2, height / 2 + fontPx * 0.04);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.root.clear();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    for (const texture of this.textures) texture.dispose();
    this.geometries.length = 0;
    this.materials.length = 0;
    this.textures.length = 0;
    this.flames.length = 0;
  }
}
