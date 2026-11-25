import {
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from 'three';
import type { Camera } from 'three';
import { tuning } from '../../core/tuning';
import type { DecalDef } from '../../world/dressingSchema';
import { CityTextures, disposeCityGroup } from './resources';
import { batchStaticDecals } from '../staticBatch';
import type { TextureLoad } from './resources';

export class DecalRenderer {
  readonly root = new Group();
  private readonly textures: CityTextures;
  private disposed = false;

  constructor(defs: readonly DecalDef[], load?: TextureLoad) {
    this.textures = new CityTextures(load);
    const materials = new Map<string, MeshBasicMaterial>();
    const decals: Mesh[] = [];
    for (const def of defs) {
      // Wspólna płaszczyzna zachowuje kolejność głębi rozłącznych naklejek.
      const plane =
        def.surface === 'floor'
          ? [def.position.y]
          : [
              def.yaw,
              def.position.x * Math.sin(def.yaw) +
                def.position.z * Math.cos(def.yaw),
            ];
      const key = JSON.stringify([
        def.texture,
        def.tint ?? '#ffffff',
        def.opacity ?? 1,
        plane,
      ]);
      let material = materials.get(key);
      if (!material) {
        const shared = new MeshBasicMaterial({
          color: def.tint ?? '#ffffff',
          transparent: true,
          opacity: def.opacity ?? 1,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
          side: DoubleSide,
        });
        shared.userData.bloom = false;
        this.textures.request('decals', def.texture, (texture) => {
          shared.map = texture;
          shared.needsUpdate = true;
        });
        materials.set(key, shared);
        material = shared;
      }
      const mesh = new Mesh(
        new PlaneGeometry(def.size.w, def.size.h),
        material,
      );
      mesh.position.copy(def.position);
      if (def.surface === 'floor') {
        mesh.rotation.set(-Math.PI / 2, 0, def.yaw);
        mesh.position.y += tuning.city.surfaceOffsetM;
      } else {
        mesh.rotation.y = def.yaw;
        mesh.position.x += Math.sin(def.yaw) * tuning.city.surfaceOffsetM;
        mesh.position.z += Math.cos(def.yaw) * tuning.city.surfaceOffsetM;
      }
      mesh.userData.noOutline = true;
      this.root.add(mesh);
      decals.push(mesh);
    }
    batchStaticDecals(this.root, decals);
  }
  update(dtWorldS: number, dtRealS: number, camera: Camera): void {
    void dtWorldS;
    void dtRealS;
    void camera;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.textures.dispose();
    disposeCityGroup(this.root);
  }
}
