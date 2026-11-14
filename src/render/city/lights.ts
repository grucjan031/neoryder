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
    const distance = scratchOrigin.distanceToSquared(def.position);
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

  constructor(
    private readonly defs: readonly CityLightDef[],
    floorY = 0,
  ) {
    this.pool = Array.from(
      { length: Math.max(0, Math.floor(tuning.city.maxLights)) },
      () => new PointLight('#fff1d6', 0),
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
        },
        transparent: true,
        blending: AdditiveBlending,
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
    const selected = selectCityLights(
      this.defs,
      camera,
      Math.min(this.pool.length, tuning.city.maxLights),
      this.selected,
    );
    const wanted = this.wanted;
    wanted.clear();
    for (const index of selected) wanted.add(index);
    const assigned = this.assigned;
    assigned.clear();
    for (const index of this.assignments)
      if (index !== null) assigned.add(index);
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
      light.intensity += (this.defs[index]!.intensity - light.intensity) * fade;
    });
    this.root.children.forEach((object, i) => {
      if (!(object instanceof Mesh)) return;
      object.material.uniforms.opacity.value = tuning.city.lightSpotOpacity;
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
