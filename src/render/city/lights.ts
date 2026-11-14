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

/** Kula zasięgu musi przecinać frustum: światło tuż poza kadrem nadal może oświetlać ulicę. */
export function selectCityLights(
  defs: readonly CityLightDef[],
  camera: Camera,
  limit: number,
): number[] {
  camera.updateMatrixWorld();
  const frustum = new Frustum().setFromProjectionMatrix(
    new Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    ),
  );
  const origin = new Vector3().setFromMatrixPosition(camera.matrixWorld);
  const sphere = new Sphere();
  return defs
    .map((def, index) => ({
      index,
      distance: origin.distanceToSquared(sphere.center.copy(def.position)),
      visible: frustum.intersectsSphere(sphere.set(sphere.center, def.range)),
    }))
    .filter((entry) => entry.visible)
    .sort((a, b) => a.distance - b.distance || a.index - b.index)
    .slice(0, Math.max(0, Math.floor(limit)))
    .map((entry) => entry.index);
}

export class CityLights {
  readonly root = new Group();
  readonly pool: readonly PointLight[];
  private readonly assignments: (number | null)[];
  private disposed = false;

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
    );
    const wanted = new Set(selected);
    const assigned = new Set(
      this.assignments.filter((index) => index !== null),
    );
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
