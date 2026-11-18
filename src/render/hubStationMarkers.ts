import {
  AdditiveBlending,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
} from 'three';
import type { Vec3 } from '../core/math';

/** Kolory znaczników, gdy stacja nie ma własnego `sign.color` (neony: cyjan, bursztyn, fiolet, błękit). */
export const STATION_MARKER_COLORS: Readonly<Record<string, string>> = {
  workshop: '#00e5ff',
  missions: '#ffae1a',
  talents: '#8a5cff',
  arena: '#3d7bff',
};
const FALLBACK_COLOR = '#00e5ff';

/** Minimalny opis stacji potrzebny do znacznika (pasuje do `HubStationDef`). */
export interface StationMarkerDef {
  id: string;
  label: string;
  position: { x: number; z: number };
  radius: number;
  focus: { position: Vec3; size: Vec3 };
  sign?: { color?: string };
}

const CANVAS_W = 512;
const CANVAS_H = 176;
const SPRITE_W_M = 4.6;
/** Wysokość napisu nad górą obiektu stacji (m) i minimalna wysokość nad podłogą. */
const LIFT_M = 1.5;
const MIN_HEIGHT_M = 3.3;
/** Znacznik wygasa do tego poziomu, gdy gracz jest przy stacji (wtedy działa podpowiedź klawisza). */
const NEAR_OPACITY = 0.3;
const FADE_START_M = 2.5;
const FADE_LENGTH_M = 6;

const smooth = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/** Tekstura napisu w stylu neonu: obrys, poświata i strzałka w dół. Null bez Canvas 2D. */
function labelTexture(text: string, color: string): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = '700 92px Rajdhani, "Segoe UI", sans-serif';
  context.lineJoin = 'round';
  context.shadowColor = color;
  context.shadowBlur = 34;
  context.fillStyle = color;
  context.fillText(text, CANVAS_W / 2, 64);
  context.shadowBlur = 14;
  context.lineWidth = 6;
  context.strokeStyle = '#020611';
  context.strokeText(text, CANVAS_W / 2, 64);
  context.shadowBlur = 0;
  context.fillStyle = color;
  context.fillText(text, CANVAS_W / 2, 64);
  context.lineWidth = 2;
  context.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  context.strokeText(text, CANVAS_W / 2, 64);
  // Strzałka w dół, w stronę stacji.
  context.shadowBlur = 24;
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(CANVAS_W / 2 - 30, 128);
  context.lineTo(CANVAS_W / 2 + 30, 128);
  context.lineTo(CANVAS_W / 2, 164);
  context.closePath();
  context.fill();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

interface Marker {
  station: StationMarkerDef;
  group: Group;
  sprite: Sprite;
  baseY: number;
  phase: number;
  materials: { opacity: number }[];
  baseOpacity: number[];
}

/**
 * Pływające, świecące znaczniki nad stacjami kryjówki (misje, talenty, warsztat, poligon):
 * napis z etykiety stacji (`label` z układu kryjówki, ten sam, który pokazuje podpowiedź
 * interakcji), słup światła od podłogi i pierścień strefy. Widoczne z daleka także zza
 * przeszkód; przy stacji wygasają, bo wtedy gracz widzi podpowiedź klawisza.
 */
export class HubStationMarkers {
  readonly root = new Group();
  private readonly markers: Marker[] = [];
  private readonly geometries: { dispose(): void }[] = [];
  private readonly resources: { dispose(): void }[] = [];
  private timeS = 0;

  constructor(stations: readonly StationMarkerDef[], floorY: number) {
    this.root.name = 'hub-station-markers';
    stations.forEach((station, index) => {
      const color =
        station.sign?.color ??
        STATION_MARKER_COLORS[station.id] ??
        FALLBACK_COLOR;
      const group = new Group();
      group.position.set(station.position.x, floorY, station.position.z);
      const top = station.focus.position.y + station.focus.size.y / 2 - floorY;
      const baseY = Math.max(MIN_HEIGHT_M, top + LIFT_M);

      const texture = labelTexture(station.label, color);
      if (texture) this.resources.push(texture);
      const spriteMaterial = new SpriteMaterial({
        map: texture,
        color: texture ? 0xffffff : color,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      });
      this.resources.push(spriteMaterial);
      const sprite = new Sprite(spriteMaterial);
      sprite.name = `hub-station-marker:${station.id}`;
      sprite.scale.set(SPRITE_W_M, (SPRITE_W_M * CANVAS_H) / CANVAS_W, 1);
      sprite.position.y = baseY;
      sprite.renderOrder = 30;
      sprite.frustumCulled = false;

      const glow = (opacity: number): MeshBasicMaterial => {
        const material = new MeshBasicMaterial({
          color,
          transparent: true,
          opacity,
          blending: AdditiveBlending,
          depthWrite: false,
          side: DoubleSide,
          toneMapped: false,
          fog: false,
        });
        this.resources.push(material);
        return material;
      };
      const beamMaterial = glow(0.32);
      const beamHeight = Math.max(0.5, baseY - 0.9);
      const beamGeometry = new CylinderGeometry(
        0.035,
        0.035,
        beamHeight,
        8,
        1,
        true,
      );
      this.geometries.push(beamGeometry);
      const beam = new Mesh(beamGeometry, beamMaterial);
      beam.position.y = beamHeight / 2;
      beam.renderOrder = 29;
      beam.frustumCulled = false;

      const ringMaterial = glow(0.55);
      const ringGeometry = new RingGeometry(
        Math.max(0.1, station.radius - 0.09),
        station.radius,
        64,
      );
      this.geometries.push(ringGeometry);
      const ring = new Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.035;
      ring.renderOrder = 29;
      ring.frustumCulled = false;

      group.add(beam, ring, sprite);
      this.root.add(group);
      const materials = [spriteMaterial, beamMaterial, ringMaterial];
      this.markers.push({
        station,
        group,
        sprite,
        baseY,
        phase: index * 1.7,
        materials,
        baseOpacity: [1, beamMaterial.opacity, ringMaterial.opacity],
      });
    });
  }

  /** `dt` w sekundach (czas klatki), `viewer` to kamera lub gracz. */
  update(dt: number, viewer: Vec3): void {
    if (Number.isFinite(dt) && dt > 0) this.timeS += dt;
    for (const marker of this.markers) {
      const { station } = marker;
      const distance = Math.hypot(
        viewer.x - station.position.x,
        viewer.z - station.position.z,
      );
      const far = smooth(
        (distance - station.radius - FADE_START_M) / FADE_LENGTH_M,
      );
      const factor = NEAR_OPACITY + (1 - NEAR_OPACITY) * far;
      marker.materials.forEach((material, i) => {
        material.opacity = marker.baseOpacity[i]! * factor;
      });
      marker.sprite.position.y =
        marker.baseY + Math.sin(this.timeS * 1.6 + marker.phase) * 0.09;
      // Delikatna pulsacja pierścienia, żeby strefa przyciągała wzrok.
      const ring = marker.materials[2];
      if (ring)
        ring.opacity *= 0.8 + 0.2 * Math.sin(this.timeS * 2.4 + marker.phase);
    }
  }

  dispose(): void {
    this.root.removeFromParent();
    for (const geometry of this.geometries) geometry.dispose();
    for (const resource of this.resources) resource.dispose();
    this.geometries.length = 0;
    this.resources.length = 0;
    this.markers.length = 0;
  }
}
