import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three';
import type { Camera } from 'three';
import type { Power } from '../combat/powers/power';
import type { EntityId, EventBus } from '../core/events';
import type { Vec3 } from '../core/math';
import type { Tuning } from '../core/tuning';
import { getMaterial } from './materials';
import { ResonanceWaveFx } from './resonanceWaveFx';

export interface LightningArc {
  readonly points: readonly Vec3[];
  readonly ageS: number;
}

export interface LightningVfx {
  readonly arcLifeS: number;
  readonly jitterM: number;
  readonly segments: number;
}

export interface LightningSource {
  readonly arcs: readonly LightningArc[];
  readonly def: { readonly vfx: LightningVfx };
}

type PowerOrSource = Power | LightningSource | null | undefined;
type RibbonMesh = Mesh<BufferGeometry, MeshBasicMaterial>;

interface Ribbon {
  readonly mesh: RibbonMesh;
  readonly geometry: BufferGeometry;
  readonly material: MeshBasicMaterial;
  positions: Float32Array;
  indices: Uint32Array;
}

interface ArcSlot {
  readonly glow: Ribbon;
  readonly core: Ribbon;
  /** Łuk (referencja) i parametry, dla których wylosowano kształt. */
  arc: LightningArc | null;
  bucket: number;
  segments: number;
  pointCount: number;
  coreColor: string;
  /** Losowe odchylenia wierzchołków zygzaka (2 liczby na wierzchołek) i losowa składowa migotania. */
  jit: Float32Array;
  flickerRoll: number;
  /** Odnogi: BRANCH_STRIDE liczb na odnogę, rosnąco po wierzchołku początkowym. */
  branchData: Float32Array;
  branchCount: number;
  /** Liczba indeksów do końca czworokąta j głównego paska (razem z odnogami wcześniejszych wierzchołków). */
  quadEnd: Uint32Array;
}

const DEFAULT_VFX: LightningVfx = {
  arcLifeS: 0.32,
  jitterM: 0.12,
  segments: 6,
};

const EPS = 1e-6;
const STRIKE_MAX = 0.99;
const BRANCH_SEGMENTS = 3;
/** [wierzchołek, losowa długość, kąt, odchylenie w bok, (u, v) punktu 1, (u, v) punktu 2]. */
const BRANCH_STRIDE = 8;
const BRANCH_LATERAL_MIN = 0.5;
const BRANCH_LATERAL_MAX = 1.5;
const BRANCH_WIDTH_MULT = 0.5;
const BRANCH_JITTER_MULT = 0.5;
const IMPACT_GROW_START = 0.4;
const START_IMPACT_MULT = 0.5;
const GLOW_ORDER = 20;
const CORE_ORDER = 21;
const IMPACT_ORDER = 22;

function isArc(item: unknown): item is LightningArc {
  return (
    typeof item === 'object' &&
    item !== null &&
    'points' in item &&
    'ageS' in item
  );
}

function isSource(item: unknown): item is LightningSource {
  return (
    typeof item === 'object' &&
    item !== null &&
    'arcs' in item &&
    'def' in item &&
    typeof (item as { def: unknown }).def === 'object' &&
    (item as { def: unknown }).def !== null &&
    'vfx' in (item as { def: object }).def
  );
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const at = (array: Float32Array, index: number): number => array[index] ?? 0;

/**
 * Wizualizacja łuków Błyskawicy (F2-07): świecąca wstęga zwrócona do kamery (poświata + rdzeń),
 * uderzenie rosnące wzdłuż łańcucha, odgałęzienia, błyski trafień, migotanie i zanikanie.
 * Kształt jest losowany od nowa tylko przy zmianie kubełka migotania, więc w hitstopie łuk zamarza.
 */
export class LightningRenderer {
  readonly root = new Group();
  private readonly pool: ArcSlot[] = [];
  private readonly impacts: RibbonMesh[] = [];
  private readonly impactGeometry: BufferGeometry = new IcosahedronGeometry(
    0.5,
    1,
  );
  private usedImpacts = 0;
  private maxArcs = 0;
  private camera: Camera | null = null;
  private readonly cameraPos = new Vector3();
  private readonly hand = new Vector3();
  private readonly tangent = new Vector3();
  private readonly view = new Vector3();
  private readonly side = new Vector3();
  private readonly branchDir = new Vector3();
  private chain = new Float32Array(0);
  private main = new Float32Array(0);
  private cum = new Float32Array(0);
  private basis = new Float32Array(0);
  private branch = new Float32Array(0);

  /** Fale Pchnięcia / Fali uderzeniowej: te same sceny przekazują tu listę mocy i kamerę. */
  private readonly waves: ResonanceWaveFx;

  /** `bus` (i opcjonalnie `owner`) włącza fale Rezonansu po zdarzeniu `power_used`. */
  constructor(
    private readonly tuning: Tuning,
    bus?: EventBus,
    owner?: EntityId,
  ) {
    this.root.name = 'lightning';
    this.waves = new ResonanceWaveFx(tuning, bus, owner);
    this.root.add(this.waves.root);
  }

  render(
    input:
      | LightningSource
      | readonly PowerOrSource[]
      | readonly LightningArc[]
      | null
      | undefined,
    camera?: Camera | null,
  ): void {
    const t = this.tuning.vfx;
    this.maxArcs = Math.max(0, Math.floor(t.lightningMaxArcs));
    this.camera = camera ?? null;
    if (camera) {
      this.cameraPos.copy(camera.position);
      this.hand
        .set(
          t.lightningHandSideM,
          -t.lightningHandDownM,
          -t.lightningHandForwardM,
        )
        .applyQuaternion(camera.quaternion)
        .add(camera.position);
    }
    this.usedImpacts = 0;
    let used = 0;
    this.waves.update(Array.isArray(input) ? input : [], camera ?? null);

    if (input) {
      if (isSource(input)) {
        used = this.renderArcs(input.arcs, input.def.vfx, used);
      } else if (Array.isArray(input)) {
        for (const item of input) {
          if (isSource(item)) {
            used = this.renderArcs(item.arcs, item.def.vfx, used);
          } else if (isArc(item)) {
            used = this.renderArc(item, DEFAULT_VFX, used);
          }
        }
      }
    }

    for (let i = used; i < this.pool.length; i++) {
      const slot = this.pool[i]!;
      slot.glow.mesh.visible = false;
      slot.core.mesh.visible = false;
      slot.arc = null;
    }
    for (let i = this.usedImpacts; i < this.impacts.length; i++) {
      this.impacts[i]!.visible = false;
    }
  }

  private renderArcs(
    arcs: readonly LightningArc[],
    vfx: LightningVfx,
    used: number,
  ): number {
    let index = used;
    for (const arc of arcs) {
      index = this.renderArc(arc, vfx, index);
    }
    return index;
  }

  private renderArc(
    arc: LightningArc,
    vfx: LightningVfx,
    slotIndex: number,
  ): number {
    if (
      slotIndex >= this.maxArcs ||
      arc.points.length < 2 ||
      !(vfx.arcLifeS > 0) ||
      arc.ageS >= vfx.arcLifeS
    ) {
      return slotIndex;
    }

    const t = this.tuning.vfx;
    const pointCount = arc.points.length;
    const links = pointCount - 1;
    const segments = Math.max(1, Math.floor(vfx.segments));
    const mainCount = links * segments + 1;
    const progress = clamp(arc.ageS / vfx.arcLifeS, 0, 1);
    const strike = clamp(t.lightningStrikeFrac, 0, STRIKE_MAX);
    const fade = progress < strike ? 1 : 1 - (progress - strike) / (1 - strike);
    if (!(fade > 0)) return slotIndex;

    const slot = this.acquireSlot(slotIndex);
    this.ensureScratch(pointCount, mainCount);
    const bucket =
      t.lightningFlickerHz > 0
        ? Math.floor(arc.ageS * t.lightningFlickerHz)
        : 0;
    if (
      slot.arc !== arc ||
      slot.bucket !== bucket ||
      slot.segments !== segments ||
      slot.pointCount !== pointCount
    ) {
      slot.arc = arc;
      slot.bucket = bucket;
      slot.segments = segments;
      slot.pointCount = pointCount;
      this.reshape(slot, mainCount);
    }

    const flicker =
      1 - clamp(t.lightningFlickerAmount, 0, 1) * slot.flickerRoll;
    const alpha = fade * flicker;

    // Łańcuch: punkt startu zastępuje dłoń, gdy jest kamera.
    const chain = this.chain;
    for (let i = 0; i < pointCount; i++) {
      const point = arc.points[i]!;
      chain[i * 3] = point.x;
      chain[i * 3 + 1] = point.y;
      chain[i * 3 + 2] = point.z;
    }
    if (this.camera) {
      chain[0] = this.hand.x;
      chain[1] = this.hand.y;
      chain[2] = this.hand.z;
    }

    this.buildCenterline(slot, pointCount, segments, vfx.jitterM, mainCount);
    const total = at(this.cum, mainCount - 1);

    // Głowica uderzenia: ułamek długości całej łamanej.
    const frac = progress < strike ? progress / strike : 1;
    const headDist = frac * total;
    const lastSegment = mainCount - 2;
    let head = lastSegment;
    let headT = 1;
    if (frac < 1) {
      for (let j = 0; j <= lastSegment; j++) {
        const from = at(this.cum, j);
        const length = at(this.cum, j + 1) - from;
        if (from + length >= headDist || j === lastSegment) {
          head = j;
          headT = length > EPS ? clamp((headDist - from) / length, 0, 1) : 1;
          break;
        }
      }
    }

    // Odnogi czytają pełne pozycje łamanej, więc powstają przed ucięciem ostatniego wierzchołka.
    const revealed = this.buildBranches(
      slot,
      links,
      segments,
      vfx.jitterM,
      head,
    );
    this.placeImpacts(
      pointCount,
      segments,
      total,
      headDist,
      frac,
      progress,
      strike,
      alpha,
    );

    if (headT < 1) {
      const a = head * 3;
      const b = a + 3;
      const main = this.main;
      main[b] = at(main, a) + (at(main, b) - at(main, a)) * headT;
      main[b + 1] =
        at(main, a + 1) + (at(main, b + 1) - at(main, a + 1)) * headT;
      main[b + 2] =
        at(main, a + 2) + (at(main, b + 2) - at(main, a + 2)) * headT;
    }

    const widthFactor = 0.5 + 0.5 * fade;
    const drawCount = slot.quadEnd[head] ?? 0;
    const { glow, core } = slot;
    this.fillRibbon(
      glow,
      mainCount,
      head,
      revealed,
      t.lightningGlowWidthM * 0.5 * widthFactor,
      drawCount,
    );
    this.fillRibbon(
      core,
      mainCount,
      head,
      revealed,
      t.lightningCoreWidthM * 0.5 * widthFactor,
      drawCount,
    );

    glow.material.color.copy(getMaterial('power').color);
    glow.material.opacity = alpha * t.lightningGlowOpacity;
    if (slot.coreColor !== t.lightningCoreColor) {
      slot.coreColor = t.lightningCoreColor;
      core.material.color.set(t.lightningCoreColor);
    }
    core.material.opacity = alpha;
    glow.mesh.visible = true;
    core.mesh.visible = true;

    return slotIndex + 1;
  }

  /** Główna łamana: `segments` odcinków na ogniwo, odchylenie ⟂ do ogniwa × sin(πt). */
  private buildCenterline(
    slot: ArcSlot,
    pointCount: number,
    segments: number,
    jitterM: number,
    mainCount: number,
  ): void {
    const { chain, main, cum, basis } = this;
    for (let l = 0; l < pointCount - 1; l++) {
      const c = l * 3;
      const fx = at(chain, c);
      const fy = at(chain, c + 1);
      const fz = at(chain, c + 2);
      const ex = at(chain, c + 3) - fx;
      const ey = at(chain, c + 4) - fy;
      const ez = at(chain, c + 5) - fz;
      const length = Math.hypot(ex, ey, ez);
      let dx = 0;
      let dy = 0;
      let dz = -1;
      if (length > EPS) {
        dx = ex / length;
        dy = ey / length;
        dz = ez / length;
      }
      // Oś odniesienia Y (albo X, gdy ogniwo jest prawie pionowe): a = d × ref, b = d × a.
      const rx = Math.abs(dy) > 0.99 ? 1 : 0;
      const ry = 1 - rx;
      let ax = -dz * ry;
      let ay = dz * rx;
      let az = dx * ry - dy * rx;
      const aLen = Math.hypot(ax, ay, az) || 1;
      ax /= aLen;
      ay /= aLen;
      az /= aLen;
      const bx = dy * az - dz * ay;
      const by = dz * ax - dx * az;
      const bz = dx * ay - dy * ax;
      const o = l * 9;
      basis[o] = dx;
      basis[o + 1] = dy;
      basis[o + 2] = dz;
      basis[o + 3] = ax;
      basis[o + 4] = ay;
      basis[o + 5] = az;
      basis[o + 6] = bx;
      basis[o + 7] = by;
      basis[o + 8] = bz;

      const start = l * segments * 3;
      main[start] = fx;
      main[start + 1] = fy;
      main[start + 2] = fz;
      for (let s = 1; s <= segments; s++) {
        const index = l * segments + s;
        const p = index * 3;
        if (s === segments) {
          main[p] = at(chain, c + 3);
          main[p + 1] = at(chain, c + 4);
          main[p + 2] = at(chain, c + 5);
        } else {
          const t = s / segments;
          const amplitude = jitterM * Math.sin(Math.PI * t);
          const u = at(slot.jit, index * 2) * amplitude;
          const v = at(slot.jit, index * 2 + 1) * amplitude;
          main[p] = fx + ex * t + ax * u + bx * v;
          main[p + 1] = fy + ey * t + ay * u + by * v;
          main[p + 2] = fz + ez * t + az * u + bz * v;
        }
      }
    }
    cum[0] = 0;
    for (let i = 1; i < mainCount; i++) {
      const p = i * 3;
      cum[i] =
        at(cum, i - 1) +
        Math.hypot(
          at(main, p) - at(main, p - 3),
          at(main, p + 1) - at(main, p - 2),
          at(main, p + 2) - at(main, p - 1),
        );
    }
  }

  /** Liczy wierzchołki odnóg, które głowica już minęła; zwraca ich liczbę. */
  private buildBranches(
    slot: ArcSlot,
    links: number,
    segments: number,
    jitterM: number,
    head: number,
  ): number {
    const t = this.tuning.vfx;
    const { main, basis, branch, branchDir } = this;
    let revealed = 0;
    for (let b = 0; b < slot.branchCount; b++) {
      const base = b * BRANCH_STRIDE;
      const vertex = Math.round(at(slot.branchData, base));
      if (vertex > head) break;
      revealed++;
      const link = Math.min(links - 1, Math.floor((vertex - 1) / segments));
      const o = link * 9;
      const phi = at(slot.branchData, base + 2);
      const lateral = at(slot.branchData, base + 3);
      const cos = Math.cos(phi) * lateral;
      const sin = Math.sin(phi) * lateral;
      branchDir
        .set(
          at(basis, o) + at(basis, o + 3) * cos + at(basis, o + 6) * sin,
          at(basis, o + 1) + at(basis, o + 4) * cos + at(basis, o + 7) * sin,
          at(basis, o + 2) + at(basis, o + 5) * cos + at(basis, o + 8) * sin,
        )
        .normalize();
      const length =
        t.lightningBranchLengthM * (0.5 + 0.5 * at(slot.branchData, base + 1));
      const px = at(main, vertex * 3);
      const py = at(main, vertex * 3 + 1);
      const pz = at(main, vertex * 3 + 2);
      const out = b * (BRANCH_SEGMENTS + 1) * 3;
      branch[out] = px;
      branch[out + 1] = py;
      branch[out + 2] = pz;
      for (let k = 1; k <= BRANCH_SEGMENTS; k++) {
        const along = (length * k) / BRANCH_SEGMENTS;
        const wobble = k < BRANCH_SEGMENTS ? jitterM * BRANCH_JITTER_MULT : 0;
        const u = at(slot.branchData, base + 4 + (k - 1) * 2) * wobble;
        const v = at(slot.branchData, base + 5 + (k - 1) * 2) * wobble;
        const w = out + k * 3;
        branch[w] =
          px +
          branchDir.x * along +
          at(basis, o + 3) * u +
          at(basis, o + 6) * v;
        branch[w + 1] =
          py +
          branchDir.y * along +
          at(basis, o + 4) * u +
          at(basis, o + 7) * v;
        branch[w + 2] =
          pz +
          branchDir.z * along +
          at(basis, o + 5) * u +
          at(basis, o + 8) * v;
      }
    }
    return revealed;
  }

  /** Błysk przy każdym punkcie łańcucha, do którego dotarła głowica (w punkcie startu mniejszy). */
  private placeImpacts(
    pointCount: number,
    segments: number,
    total: number,
    headDist: number,
    frac: number,
    progress: number,
    strike: number,
    alpha: number,
  ): void {
    const size = this.tuning.vfx.lightningImpactSizeM;
    for (let k = 0; k < pointCount; k++) {
      const distance = at(this.cum, k * segments);
      if (frac < 1 && headDist + EPS < distance) continue;
      const arrive = total > EPS ? strike * (distance / total) : 0;
      const grow = strike > 0 ? clamp((progress - arrive) / strike, 0, 1) : 1;
      const mult = k === 0 ? START_IMPACT_MULT : 1;
      const mesh = this.acquireImpact();
      mesh.position.set(
        at(this.chain, k * 3),
        at(this.chain, k * 3 + 1),
        at(this.chain, k * 3 + 2),
      );
      const near = this.camera
        ? this.nearScale(mesh.position.distanceTo(this.cameraPos))
        : 1;
      mesh.scale.setScalar(
        size *
          mult *
          near *
          (IMPACT_GROW_START + (1 - IMPACT_GROW_START) * grow),
      );
      mesh.material.color.copy(getMaterial('power').color);
      mesh.material.opacity = alpha;
      mesh.visible = true;
    }
  }

  /** Wypełnia wstęgę (główny pasek + odsłonięte odnogi) i zakres rysowania. */
  private fillRibbon(
    ribbon: Ribbon,
    mainCount: number,
    head: number,
    revealed: number,
    halfWidth: number,
    drawCount: number,
  ): void {
    this.writeStrip(ribbon.positions, 0, this.main, 0, head + 2, halfWidth);
    for (let b = 0; b < revealed; b++) {
      this.writeStrip(
        ribbon.positions,
        mainCount * 2 + b * (BRANCH_SEGMENTS + 1) * 2,
        this.branch,
        b * (BRANCH_SEGMENTS + 1),
        BRANCH_SEGMENTS + 1,
        halfWidth * BRANCH_WIDTH_MULT,
      );
    }
    ribbon.geometry.getAttribute('position').needsUpdate = true;
    ribbon.geometry.setDrawRange(0, drawCount);
  }

  /** Blisko kamery (dłoń) wstęga i błysk cienieją, żeby nie zasłaniały widoku. */
  private nearScale(distance: number): number {
    const t = this.tuning.vfx;
    if (!(t.lightningNearTaperM > 0)) return 1;
    return clamp(distance / t.lightningNearTaperM, t.lightningNearMinScale, 1);
  }

  /** Pasek wstęgi: bok = normalize(styczna × kierunek do kamery); bez kamery oś odniesienia Y (albo X). */
  private writeStrip(
    out: Float32Array,
    vertexBase: number,
    points: Float32Array,
    pointBase: number,
    count: number,
    halfWidth: number,
  ): void {
    const { tangent, view, side } = this;
    for (let i = 0; i < count; i++) {
      const cur = (pointBase + i) * 3;
      const prev = (pointBase + Math.max(i - 1, 0)) * 3;
      const next = (pointBase + Math.min(i + 1, count - 1)) * 3;
      tangent.set(
        at(points, next) - at(points, prev),
        at(points, next + 1) - at(points, prev + 1),
        at(points, next + 2) - at(points, prev + 2),
      );
      if (tangent.lengthSq() < EPS * EPS) tangent.set(0, 0, 1);
      else tangent.normalize();
      const px = at(points, cur);
      const py = at(points, cur + 1);
      const pz = at(points, cur + 2);
      let near = 1;
      if (this.camera) {
        view.set(
          this.cameraPos.x - px,
          this.cameraPos.y - py,
          this.cameraPos.z - pz,
        );
        near = this.nearScale(view.length());
        if (view.lengthSq() > EPS * EPS) view.normalize();
        else view.set(0, 1, 0);
      } else {
        view.set(0, 1, 0);
      }
      side.crossVectors(tangent, view);
      if (side.lengthSq() < 1e-6) {
        view.set(0, 1, 0);
        side.crossVectors(tangent, view);
        if (side.lengthSq() < 1e-6) {
          view.set(1, 0, 0);
          side.crossVectors(tangent, view);
        }
      }
      side.normalize().multiplyScalar(halfWidth * near);
      const o = (vertexBase + i * 2) * 3;
      out[o] = px + side.x;
      out[o + 1] = py + side.y;
      out[o + 2] = pz + side.z;
      out[o + 3] = px - side.x;
      out[o + 4] = py - side.y;
      out[o + 5] = pz - side.z;
    }
  }

  /** Nowy kształt: losowe odchylenia, odnogi i składowa migotania; przebudowa indeksów. */
  private reshape(slot: ArcSlot, mainCount: number): void {
    const maxBranches = Math.max(0, mainCount - 2);
    const vertices = 2 * (mainCount + (BRANCH_SEGMENTS + 1) * maxBranches);
    const indexCount = 6 * (mainCount - 1) + 6 * BRANCH_SEGMENTS * maxBranches;
    this.growRibbon(slot.glow, vertices, indexCount);
    this.growRibbon(slot.core, vertices, indexCount);
    if (slot.jit.length < mainCount * 2)
      slot.jit = new Float32Array(mainCount * 2);
    if (slot.branchData.length < maxBranches * BRANCH_STRIDE)
      slot.branchData = new Float32Array(maxBranches * BRANCH_STRIDE);
    if (slot.quadEnd.length < mainCount - 1)
      slot.quadEnd = new Uint32Array(mainCount - 1);

    for (let i = 0; i < mainCount * 2; i++) {
      slot.jit[i] = Math.random() * 2 - 1;
    }
    slot.flickerRoll = Math.random();

    const chance = this.tuning.vfx.lightningBranchChance;
    let count = 0;
    for (let i = 1; i <= mainCount - 2; i++) {
      if (!(Math.random() < chance)) continue;
      const base = count * BRANCH_STRIDE;
      slot.branchData[base] = i;
      slot.branchData[base + 1] = Math.random();
      slot.branchData[base + 2] = Math.random() * Math.PI * 2;
      slot.branchData[base + 3] =
        BRANCH_LATERAL_MIN +
        Math.random() * (BRANCH_LATERAL_MAX - BRANCH_LATERAL_MIN);
      for (let k = 4; k < BRANCH_STRIDE; k++) {
        slot.branchData[base + k] = Math.random() * 2 - 1;
      }
      count++;
    }
    slot.branchCount = count;
    this.writeIndices(slot, mainCount);
  }

  /**
   * Główny pasek, a przed czworokątem j także odnogi wychodzące z wierzchołka j: prefiks indeksów
   * do `quadEnd[j]` zawiera dokładnie to, co minęła głowica uderzenia.
   */
  private writeIndices(slot: ArcSlot, mainCount: number): void {
    const indices = slot.glow.indices;
    let n = 0;
    let branch = 0;
    const quad = (v: number): void => {
      indices[n++] = v;
      indices[n++] = v + 1;
      indices[n++] = v + 2;
      indices[n++] = v + 1;
      indices[n++] = v + 3;
      indices[n++] = v + 2;
    };
    for (let j = 0; j < mainCount - 1; j++) {
      while (
        branch < slot.branchCount &&
        Math.round(at(slot.branchData, branch * BRANCH_STRIDE)) === j
      ) {
        const base = mainCount * 2 + branch * (BRANCH_SEGMENTS + 1) * 2;
        for (let k = 0; k < BRANCH_SEGMENTS; k++) quad(base + k * 2);
        branch++;
      }
      quad(j * 2);
      slot.quadEnd[j] = n;
    }
    slot.core.indices.set(indices.subarray(0, n));
    for (const ribbon of [slot.glow, slot.core]) {
      if (ribbon.geometry.index) ribbon.geometry.index.needsUpdate = true;
    }
  }

  private growRibbon(
    ribbon: Ribbon,
    vertices: number,
    indexCount: number,
  ): void {
    const needPositions = ribbon.positions.length < vertices * 3;
    const needIndices = ribbon.indices.length < indexCount;
    if (!needPositions && !needIndices) return;
    // Zwalnia stare bufory GPU; geometria zarejestruje nowe atrybuty przy następnym rysowaniu.
    ribbon.geometry.dispose();
    if (needPositions) {
      ribbon.positions = new Float32Array(vertices * 3);
      ribbon.geometry.setAttribute(
        'position',
        new BufferAttribute(ribbon.positions, 3),
      );
    }
    if (needIndices) {
      ribbon.indices = new Uint32Array(indexCount);
      ribbon.geometry.setIndex(new BufferAttribute(ribbon.indices, 1));
    }
  }

  private ensureScratch(pointCount: number, mainCount: number): void {
    if (this.chain.length < pointCount * 3)
      this.chain = new Float32Array(pointCount * 3);
    if (this.main.length < mainCount * 3)
      this.main = new Float32Array(mainCount * 3);
    if (this.cum.length < mainCount) this.cum = new Float32Array(mainCount);
    if (this.basis.length < (pointCount - 1) * 9)
      this.basis = new Float32Array((pointCount - 1) * 9);
    const branchFloats = Math.max(0, mainCount - 2) * (BRANCH_SEGMENTS + 1) * 3;
    if (this.branch.length < branchFloats)
      this.branch = new Float32Array(branchFloats);
  }

  private createRibbon(material: MeshBasicMaterial, order: number): Ribbon {
    material.transparent = true;
    material.depthWrite = false;
    material.side = DoubleSide;
    material.userData.bloom = true;
    const geometry = new BufferGeometry();
    const positions = new Float32Array(0);
    const indices = new Uint32Array(0);
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setIndex(new BufferAttribute(indices, 1));
    const mesh: RibbonMesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = order;
    mesh.visible = false;
    this.root.add(mesh);
    return { mesh, geometry, material, positions, indices };
  }

  private acquireSlot(index: number): ArcSlot {
    let slot = this.pool[index];
    if (!slot) {
      slot = {
        glow: this.createRibbon(
          getMaterial('power').clone() as MeshBasicMaterial,
          GLOW_ORDER,
        ),
        core: this.createRibbon(
          new MeshBasicMaterial({
            color: this.tuning.vfx.lightningCoreColor,
            toneMapped: false,
          }),
          CORE_ORDER,
        ),
        arc: null,
        bucket: 0,
        segments: 0,
        pointCount: 0,
        coreColor: this.tuning.vfx.lightningCoreColor,
        jit: new Float32Array(0),
        flickerRoll: 0,
        branchData: new Float32Array(0),
        branchCount: 0,
        quadEnd: new Uint32Array(0),
      };
      slot.glow.mesh.name = 'lightning-glow';
      slot.core.mesh.name = 'lightning-core';
      this.pool.push(slot);
    }
    return slot;
  }

  private acquireImpact(): RibbonMesh {
    let mesh = this.impacts[this.usedImpacts];
    if (!mesh) {
      const material = getMaterial('power').clone() as MeshBasicMaterial;
      material.transparent = true;
      material.depthWrite = false;
      material.userData.bloom = true;
      mesh = new Mesh(this.impactGeometry, material);
      mesh.name = 'lightning-impact';
      mesh.frustumCulled = false;
      mesh.renderOrder = IMPACT_ORDER;
      mesh.visible = false;
      this.root.add(mesh);
      this.impacts.push(mesh);
    }
    this.usedImpacts++;
    return mesh;
  }

  dispose(): void {
    this.waves.dispose();
    this.root.removeFromParent();
    this.root.clear();
    for (const slot of this.pool) {
      slot.glow.geometry.dispose();
      slot.glow.material.dispose();
      slot.core.geometry.dispose();
      slot.core.material.dispose();
    }
    for (const impact of this.impacts) impact.material.dispose();
    this.impactGeometry.dispose();
    this.pool.length = 0;
    this.impacts.length = 0;
  }
}
