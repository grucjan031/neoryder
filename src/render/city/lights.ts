import {
  AdditiveBlending,
  Frustum,
  Group,
  Matrix4,
  Mesh,
  PlaneGeometry,
  PointLight,
  ShaderMaterial,
  Sphere,
  Vector3,
} from 'three';
import type { Camera } from 'three';
import { tuning } from '../../core/tuning';
import type { CityLightDef } from '../../world/dressingSchema';
import {
  cityColor,
  cityVertex,
  disposeCityGroup,
  radialFragment,
} from './resources';

interface Candidate {
  index: number;
  distance: number;
}

/** Ważność źródeł: jasne światła o dużym zasięgu wygrywają z bliższymi, słabymi. */
export interface LightPriority {
  /** 0 = tylko odległość od kamery; 1 = odległość² dzielona przez intensity*range. */
  importance: number;
  /** Premia ważności dla świateł już przydzielonych (histereza, mniej przełączeń). */
  keepBonus: number;
  /** Indeksy aktualnie przydzielone do puli. */
  keep?: ReadonlySet<number>;
}

const REFERENCE_POWER = 40;

/** Wynik do porównań (odległość² skorygowana o ważność): mniejszy = ważniejsze. */
export function lightScore(
  distanceSq: number,
  def: Pick<CityLightDef, 'intensity' | 'range'>,
  priority: LightPriority | undefined,
  kept: boolean,
): number {
  if (!priority || priority.importance <= 0) return distanceSq;
  const power = Math.max(1e-3, (def.intensity * def.range) / REFERENCE_POWER);
  const keep = kept ? 1 + Math.max(0, priority.keepBonus) : 1;
  return distanceSq / (Math.pow(power, priority.importance) * keep);
}

const scratchMatrix = new Matrix4();
const scratchFrustum = new Frustum();
const scratchOrigin = new Vector3();
const scratchSphere = new Sphere();
const candidatePool: Candidate[] = [];

/**
 * Kula zasięgu musi przecinać frustum: światło tuż poza kadrem nadal może oświetlać ulicę.
 * Obiekty robocze są współdzielone; wynik trafia do `out` (czyszczonej tablicy), gdy ją podano.
 */
export function selectCityLights(
  defs: readonly CityLightDef[],
  camera: Camera,
  limit: number,
  out: number[] = [],
  priority?: LightPriority,
): number[] {
  camera.updateMatrixWorld();
  scratchFrustum.setFromProjectionMatrix(
    scratchMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    ),
  );
  scratchOrigin.setFromMatrixPosition(camera.matrixWorld);
  let count = 0;
  for (let index = 0; index < defs.length; index++) {
    const def = defs[index]!;
    scratchSphere.center.copy(def.position);
    scratchSphere.radius = def.range;
    if (!scratchFrustum.intersectsSphere(scratchSphere)) continue;
    const distance = lightScore(
      scratchOrigin.distanceToSquared(def.position),
      def,
      priority,
      priority?.keep?.has(index) ?? false,
    );
    let entry = candidatePool[count];
    if (!entry) {
      entry = { index, distance };
      candidatePool[count] = entry;
    }
    entry.index = index;
    entry.distance = distance;
    // Wstawianie z zachowaniem kolejności (odległość, potem indeks).
    let at = count++;
    while (at > 0 && candidatePool[at - 1]!.distance > distance) {
      const previous = candidatePool[at - 1]!;
      candidatePool[at - 1] = entry;
      candidatePool[at] = previous;
      at--;
    }
  }
  out.length = 0;
  const take = Math.min(count, Math.max(0, Math.floor(limit)));
  for (let i = 0; i < take; i++) out.push(candidatePool[i]!.index);
  return out;
}

export class CityLights {
  readonly root = new Group();
  readonly pool: readonly PointLight[];
  private readonly assignments: (number | null)[];
  private disposed = false;
  private readonly selected: number[] = [];
  private readonly wanted = new Set<number>();
  private readonly assigned = new Set<number>();
  private readonly priority: LightPriority = {
    importance: 0,
    keepBonus: 0,
    keep: this.assigned,
  };

  constructor(
    private readonly defs: readonly CityLightDef[],
    floorY = 0,
  ) {
    this.pool = Array.from(
      { length: Math.max(0, Math.floor(tuning.city.maxLights)) },
      () => new PointLight('#fff1d6', 0, 0, tuning.city.lightDecay),
    );
    this.assignments = this.pool.map(() => null);
    this.root.add(...this.pool);
    const geometry = new PlaneGeometry(1, 1);
    for (const def of defs) {
      const material = new ShaderMaterial({
        vertexShader: cityVertex,
        fragmentShader: radialFragment,
        uniforms: {
          tint: { value: cityColor(def.color) },
          opacity: { value: tuning.city.lightSpotOpacity },
          power: { value: tuning.city.lightSpotPower },
        },
        transparent: true,
        blending: AdditiveBlending,
        depthTest: true,
        depthWrite: false,
        toneMapped: false,
      });
      material.userData.bloom = false;
      const spot = new Mesh(geometry, material);
      spot.rotation.x = -Math.PI / 2;
      spot.position.set(
        def.position.x,
        floorY + tuning.city.surfaceOffsetM,
        def.position.z,
      );
      spot.userData.noOutline = true;
      spot.renderOrder = tuning.city.glowRenderOrder;
      spot.scale.set(
        def.range * 2 * tuning.city.lightSpotScale,
        def.range * 2 * tuning.city.lightSpotScale,
        1,
      );
      this.root.add(spot);
    }
    if (!defs.length) geometry.dispose();
  }

  update(_dtWorldS: number, dtRealS: number, camera: Camera): void {
    if (this.disposed) return;
    const assigned = this.assigned;
    assigned.clear();
    for (const index of this.assignments)
      if (index !== null) assigned.add(index);
    this.priority.importance = tuning.city.lightImportance;
    this.priority.keepBonus = tuning.city.lightKeepBonus;
    const selected = selectCityLights(
      this.defs,
      camera,
      Math.min(this.pool.length, tuning.city.maxLights),
      this.selected,
      this.priority,
    );
    const wanted = this.wanted;
    wanted.clear();
    for (const index of selected) wanted.add(index);
    const fade =
      1 - Math.exp(-tuning.city.lightFadeRate * Math.max(0, dtRealS));
    this.pool.forEach((light, slot) => {
      let index = this.assignments[slot] ?? null;
      if (index !== null && !wanted.has(index)) {
        light.intensity += (0 - light.intensity) * fade;
        if (light.intensity > tuning.city.lightSwitchThreshold) return;
        assigned.delete(index);
        index = null;
        this.assignments[slot] = null;
        light.intensity = 0;
      }
      if (index === null) {
        index = selected.find((candidate) => !assigned.has(candidate)) ?? null;
        if (index === null) return;
        this.assignments[slot] = index;
        assigned.add(index);
        const def = this.defs[index]!;
        light.position.copy(def.position);
        light.color.set(def.color);
        light.distance = def.range;
      }
      light.decay = tuning.city.lightDecay;
      light.intensity +=
        (this.defs[index]!.intensity * tuning.city.lightIntensityScale -
          light.intensity) *
        fade;
    });
    this.root.children.forEach((object, i) => {
      if (!(object instanceof Mesh)) return;
      object.material.uniforms.opacity.value = tuning.city.lightSpotOpacity;
      object.material.uniforms.power.value = tuning.city.lightSpotPower;
      const def = this.defs[i - this.pool.length];
      if (def) {
        const size = def.range * 2 * tuning.city.lightSpotScale;
        object.scale.set(size, size, 1);
      }
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const light of this.pool) light.dispose();
    disposeCityGroup(this.root);
  }
}
