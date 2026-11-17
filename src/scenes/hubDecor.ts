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
import type { BufferGeometry, Texture } from 'three';
import { tuning } from '../core/tuning';
import { Rng } from '../core/rng';
import { loadSettings } from '../core/save';
import { getPowerLevel } from '../render/powerLevel';
import { sourceFlicker } from '../render/city/flicker';
import type { FlickerDef } from '../world/dressingSchema';
import type { Tuning } from '../core/tuning';
import { printMaterial } from '../render/propPrints';
import { batchStaticGeometry } from '../render/staticBatch';
import { assetTexture } from '../render/surfaceTextures';
import type {
  HubFireDef,
  HubNeonTextDef,
  HubPanelDef,
  HubStationDef,
} from '../world/hubSchema';

const DEFAULT_TILE_TINT = '#8e9ab0';
const DEFAULT_LABEL_COLOR = '#ffae1a';
/** Rozmiar tekstury napisu w px na metr szerokości. */
const LABEL_PX_PER_M = 256;
const FLAME_COLOR = '#ffae1a';
/** Rozdzielczość malowanego wylotu tunelu w px na metr. */
const TUNNEL_PX_PER_M = 96;
/** Barwy wylotu tunelu: mrok, chłodna mgła głębi, krawędzie żeber, sygnały (paleta ADR 0006). */
const TUNNEL_DARK = '#020308';
const TUNNEL_HAZE = '#141c30';
const TUNNEL_RIB = '#3a4d74';
const TUNNEL_SIGNALS = ['#6dff4a', '#ffae1a'] as const;
// Lista z Vite pozwala pominąć żądanie brakującego pliku (bez błędów HTTP w konsoli).
const availablePosters = new Set(
  Object.keys(import.meta.glob('/public/assets/textures/posters/*.webp')).map(
    (path) => path.slice('/public'.length),
  ),
);
const posterTextures = new Map<string, Texture>();

/**
 * Komórka scalania statycznej geometrii kryjówki (m). Scalanie w jedną siatkę na
 * materiał wyłączało frustum culling (≈ +70% trójkątów w kadrach z większością
 * kryjówki poza widokiem); komórki XZ zostawiają odrzucanie przy niewielu draw calls.
 */
export const HUB_BATCH_CELL_M = 10;

/**
 * Kosmetyczna oprawa kryjówki spoza `dressingSchema`: okładziny ścian z kafli, ekrany
 * (nadruki `mat_screen_*`), plakaty/banery/murale (`posters/`), neonowe napisy stacji i płomienie beczek. Bez colliderów; `dispose` zwalnia
 * geometrie, materiały i tekstury napisów (współdzielone tekstury zasobów zostają w cache).
 */
export class HubDecor {
  readonly root = new Group();
  private readonly geometries: BufferGeometry[] = [];
  /** Kafle o tej samej teksturze i barwie dzielą materiał, żeby dało się je scalić. */
  private readonly tileMaterials = new Map<string, MeshStandardMaterial>();
  private readonly materials: (MeshStandardMaterial | MeshBasicMaterial)[] = [];
  private readonly textures: Texture[] = [];
  private readonly flames: { mesh: Mesh; phase: number }[] = [];
  private readonly labels: {
    material: MeshBasicMaterial;
    flicker: FlickerDef;
    seed: number;
  }[] = [];
  private readonly rng: Rng;
  private flameTexture: CanvasTexture | null = null;
  private timeS = 0;
  private disposed = false;

  constructor(
    panels: readonly HubPanelDef[],
    stations: readonly HubStationDef[],
    fires: readonly HubFireDef[] = [],
    private readonly hubTuning: Tuning['hub'] = tuning.hub,
    neonTexts: readonly HubNeonTextDef[] = [],
    seed: string | number = 'hub-labels',
  ) {
    this.rng = new Rng(seed);
    // Nieruchome okładziny (kafle, plakaty, ekrany) scalane po materiale; wylot tunelu
    // (własny `bloomMaterial`), napisy i płomienie zostają osobnymi siatkami.
    const statics = new Group();
    for (const panel of panels)
      if (panel.kind === 'tunnel') this.root.add(this.tunnel(panel));
      else
        statics.add(
          panel.kind === 'tiles'
            ? this.tiles(panel)
            : panel.kind === 'poster'
              ? this.poster(panel)
              : this.screen(panel),
        );
    const merged = new Set<BufferGeometry>();
    batchStaticGeometry(statics, merged, { cellSize: HUB_BATCH_CELL_M });
    this.geometries.push(...merged);
    this.root.add(...statics.children);
    for (const station of stations)
      if (station.sign)
        this.root.add(
          this.label(station.label, station.sign, `label:${station.id}`),
        );
    for (const neonText of neonTexts)
      this.root.add(
        this.label(neonText.text, neonText, `neonText:${neonText.text}`),
      );
    fires.forEach((fire, index) => this.fire(fire, index));
  }

  /** Migotanie płomieni i neonowych napisów, czas kosmetyczny renderu. */
  update(dt: number): void {
    this.timeS += Math.max(0, dt);
    const flashes = loadSettings().flashes;
    const power = getPowerLevel();
    for (const label of this.labels)
      label.material.color.setScalar(
        power * sourceFlicker(label.flicker, this.timeS, label.seed, flashes),
      );
    const t = this.hubTuning;
    for (const flame of this.flames) {
      const phase = this.timeS * t.fireFlickerHz + flame.phase;
      const flicker =
        1 +
        t.fireFlickerAmplitude * Math.sin(phase) +
        t.fireFlickerSecondaryAmplitude *
          Math.sin(
            phase * t.fireFlickerSecondaryRate + t.fireFlickerSecondaryPhase,
          );
      flame.mesh.scale.set(t.fireSizeScale, t.fireSizeScale * flicker, 1);
      const material = flame.mesh.material as MeshBasicMaterial;
      material.color.setScalar(t.fireBrightness);
      material.opacity = t.fireOpacity;
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
    const tint = panel.tint ?? DEFAULT_TILE_TINT;
    const key = `${panel.texture}|${tint}`;
    let material = this.tileMaterials.get(key);
    if (!material) {
      const created = new MeshStandardMaterial({
        color: new Color(tint),
        roughness: 0.55,
        metalness: 0,
      });
      material = created;
      this.tileMaterials.set(key, created);
      this.materials.push(created);
      assetTexture('surfaces', panel.texture, (texture) => {
        if (this.disposed) return;
        created.map = texture;
        created.needsUpdate = true;
      });
    }
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

  /**
   * Wylot tunelu: płaszczyzna z malowaną perspektywą (żebra obudowy, szyny, podkłady, kable, dwa sygnały)
   * znikającą w mroku. Materiał nieoświetlony, żeby światła stacji nie rozjaśniały głębi; sygnały świecą w bloomie.
   */
  private tunnel(panel: HubPanelDef): Mesh {
    const { geometry, place } = this.plane(panel);
    const material = new MeshBasicMaterial({
      color: 0xffffff,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
    });
    this.materials.push(material);
    if (typeof document !== 'undefined') {
      const textures = this.tunnelTextures(panel.size);
      if (textures) {
        material.map = textures.map;
        // Maska bloomu obejmuje tylko sygnały (alfa = ich poświata); ciemne tło tunelu nie trafia do bloomu,
        // więc rozmycie nie przyciemnia ściany wokół wylotu.
        const glow = new MeshBasicMaterial({
          map: textures.glow,
          color: 0xffffff,
          transparent: true,
          depthWrite: false,
          toneMapped: false,
        });
        this.materials.push(glow);
        material.userData.bloom = true;
        material.userData.bloomMaterial = glow;
        this.textures.push(textures.map, textures.glow);
      }
    } else material.color.set(TUNNEL_DARK);
    const mesh = new Mesh(geometry, material);
    mesh.userData.noOutline = true;
    mesh.name = `tunnel:${panel.texture}`;
    place(mesh);
    return mesh;
  }

  private tunnelTextures(size: {
    w: number;
    h: number;
  }): { map: CanvasTexture; glow: CanvasTexture } | null {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(size.w * TUNNEL_PX_PER_M);
    canvas.height = Math.round(size.h * TUNNEL_PX_PER_M);
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = canvas.width;
    glowCanvas.height = canvas.height;
    const g = canvas.getContext('2d');
    const glowContext = glowCanvas.getContext('2d');
    if (!g || !glowContext) return null;
    const { width: w, height: h } = canvas;
    // Punkt zbiegu nieco poniżej środka (oko gracza stoi na peronie, nad dnem niecki).
    const vx = w / 2;
    const vy = h * 0.58;
    const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
    g.fillStyle = TUNNEL_DARK;
    g.fillRect(0, 0, w, h);
    // Mgła głębi: chłodna poświata wokół punktu zbiegu, słabnąca ku krawędziom.
    const haze = g.createRadialGradient(vx, vy, 0, vx, vy, w * 0.7);
    haze.addColorStop(0, '#000000');
    haze.addColorStop(0.08, TUNNEL_HAZE);
    haze.addColorStop(0.45, '#0a0f1c');
    haze.addColorStop(1, TUNNEL_DARK);
    g.fillStyle = haze;
    g.fillRect(0, 0, w, h);
    // Żebra obudowy: łuki coraz mniejsze i ciemniejsze w głąb.
    const ribs = 9;
    for (let i = 0; i < ribs; i++) {
      const t = Math.pow((i + 1) / (ribs + 1), 0.55);
      const x0 = lerp(0, vx, t);
      const x1 = lerp(w, vx, t);
      const top = lerp(0, vy, t);
      const bottom = lerp(h, vy, t);
      const radius = (x1 - x0) / 2;
      g.globalAlpha = 0.9 * (1 - t) + 0.05;
      g.strokeStyle = TUNNEL_RIB;
      g.lineWidth = Math.max(1, 10 * (1 - t));
      g.beginPath();
      g.moveTo(x0, bottom);
      g.lineTo(x0, top + radius * 0.6);
      g.quadraticCurveTo(x0, top, vx, top);
      g.quadraticCurveTo(x1, top, x1, top + radius * 0.6);
      g.lineTo(x1, bottom);
      g.stroke();
    }
    g.globalAlpha = 1;
    // Podkłady i szyny zbiegające się w mroku.
    for (let i = 0; i < 14; i++) {
      const t = Math.pow(i / 14, 0.6);
      const y = lerp(h, vy, t);
      const half = lerp(w * 0.36, 0, t);
      g.globalAlpha = 0.55 * (1 - t);
      g.fillStyle = '#1b2233';
      g.fillRect(
        vx - half,
        y - Math.max(1, 6 * (1 - t)),
        half * 2,
        Math.max(1, 6 * (1 - t)),
      );
    }
    g.globalAlpha = 1;
    const rail = g.createLinearGradient(0, h, 0, vy);
    rail.addColorStop(0, '#5d6f94');
    rail.addColorStop(1, '#0a0f1c');
    g.strokeStyle = rail;
    g.lineWidth = Math.max(2, w * 0.008);
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(vx + side * w * 0.15, h);
      g.lineTo(vx + side * w * 0.004, vy);
      g.stroke();
    }
    // Wiązki kabli wzdłuż ścian tunelu.
    g.strokeStyle = '#111827';
    g.lineWidth = Math.max(2, w * 0.012);
    for (const side of [-1, 1])
      for (const offset of [0.18, 0.26]) {
        g.beginPath();
        g.moveTo(vx + side * w * 0.5, h * offset);
        g.quadraticCurveTo(
          vx + side * w * 0.2,
          lerp(h * offset, vy, 0.6) + h * 0.03,
          vx + side * w * 0.02,
          vy - h * 0.04,
        );
        g.stroke();
      }
    // Sygnały: zielony bliżej, bursztynowy daleko (tylko neony otoczenia).
    const signals = [
      { t: 0.45, side: -1, color: TUNNEL_SIGNALS[0], r: 0.022 },
      { t: 0.78, side: 1, color: TUNNEL_SIGNALS[1], r: 0.012 },
    ];
    // Sygnały rysowane na teksturze barwy i na przezroczystej masce bloomu.
    const drawSignals = (context: CanvasRenderingContext2D): void => {
      for (const signal of signals) {
        const x =
          lerp(signal.side < 0 ? 0 : w, vx, signal.t) - signal.side * w * 0.03;
        const y = lerp(h * 0.42, vy, signal.t);
        const glow = context.createRadialGradient(
          x,
          y,
          0,
          x,
          y,
          w * signal.r * 6,
        );
        glow.addColorStop(0, signal.color);
        glow.addColorStop(0.18, `${signal.color}88`);
        glow.addColorStop(1, `${signal.color}00`);
        context.fillStyle = glow;
        context.fillRect(
          x - w * signal.r * 6,
          y - w * signal.r * 6,
          w * signal.r * 12,
          w * signal.r * 12,
        );
        context.fillStyle = '#fff1d6';
        context.beginPath();
        context.arc(x, y, Math.max(1.5, w * signal.r * 0.45), 0, Math.PI * 2);
        context.fill();
      }
    };
    drawSignals(g);
    drawSignals(glowContext);
    // Brzeg wylotu przyciemniony, żeby płaszczyzna zlała się ze ścianą.
    const edge = g.createLinearGradient(0, 0, 0, h);
    edge.addColorStop(0, '#000000aa');
    edge.addColorStop(0.15, '#00000000');
    g.fillStyle = edge;
    g.fillRect(0, 0, w, h);
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    const glow = new CanvasTexture(glowCanvas);
    glow.colorSpace = SRGBColorSpace;
    return { map, glow };
  }

  /** Płomień: kilka skrzyżowanych płaszczyzn z gradientem, mieszanie addytywne i bloom. */
  private fire(def: HubFireDef, seed: number): void {
    if (typeof document === 'undefined') return;
    this.flameTexture ??= this.makeFlameTexture();
    const t = this.hubTuning;
    const size = def.size ?? t.fireDefaultSizeM;
    const geometry = new PlaneGeometry(size, size * t.fireHeightRatio);
    geometry.translate(0, (size * t.fireHeightRatio) / 2, 0);
    this.geometries.push(geometry);
    const material = new MeshBasicMaterial({
      map: this.flameTexture,
      color: new Color().setScalar(t.fireBrightness),
      opacity: t.fireOpacity,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      side: DoubleSide,
    });
    material.userData.bloom = true;
    this.materials.push(material);
    for (let i = 0; i < t.firePlanes; i++) {
      const mesh = new Mesh(geometry, material);
      mesh.position.set(def.position.x, def.position.y, def.position.z);
      mesh.rotation.y = (i * Math.PI) / t.firePlanes;
      mesh.scale.set(t.fireSizeScale, t.fireSizeScale, 1);
      mesh.name = `fire:${seed}:${i}`;
      mesh.userData.noOutline = true;
      this.root.add(mesh);
      this.flames.push({
        mesh,
        phase: seed * t.fireSeedPhase + i * t.firePlanePhase,
      });
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

  /** Wspólne rysowanie neonowych etykiet stacji i napisów układu. */
  private label(
    text: string,
    sign: NonNullable<HubStationDef['sign']>,
    name: string,
  ): Mesh {
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
    if (sign.flicker)
      this.labels.push({
        material,
        flicker: sign.flicker,
        seed: this.rng.fork(name.replace(/^label:/, '')).getState(),
      });
    this.materials.push(material);
    if (typeof document !== 'undefined') {
      const texture = this.labelTexture(
        text,
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
    mesh.name = name;
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
    this.tileMaterials.clear();
  }
}
