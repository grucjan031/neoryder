import {
  BoxGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  Group,
  Mesh,
  InstancedMesh,
  Object3D,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { BufferGeometry, Material } from 'three';
import type { EntityId } from '../core/events';
import type { Vec3 } from '../core/math';
import type { ProjectileSystem } from '../combat/weapons/projectiles';
import { getMaterial } from './materials';

/** Pocisk gracza: smukły sześciokątny bełt z grubszą głowicą z przodu (+Z) zamiast klocka. */
function boltGeometry(): CylinderGeometry {
  const geometry = new CylinderGeometry(0.032, 0.008, 0.55, 6);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

export class ProjectileRenderer {
  readonly root = new Group();
  private readonly geometry = new BoxGeometry(0.08, 0.08, 0.45);
  private enemyGeometry: BufferGeometry = this.geometry.clone();
  private readonly boltGeometry = boltGeometry();
  private disposed = false;
  private readonly player: InstancedMesh;
  private readonly enemy: InstancedMesh;
  private readonly transform = new Object3D();
  private readonly axis = new Vector3(0, 0, 1);
  private readonly direction = new Vector3();
  private readonly previous = new Map<EntityId, Vec3>();

  constructor(
    private readonly system: ProjectileSystem,
    capacity: number,
    loadModels = true,
  ) {
    this.player = new InstancedMesh(
      this.boltGeometry,
      getMaterial('player'),
      capacity,
    );
    this.enemy = new InstancedMesh(
      this.enemyGeometry,
      getMaterial('enemyGlow'),
      capacity,
    );
    if (loadModels && typeof window !== 'undefined') void this.loadEnemyModel();
    for (const mesh of [this.player, this.enemy]) {
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      this.root.add(mesh);
    }
  }

  private async loadEnemyModel(): Promise<void> {
    try {
      const { scene } = await new GLTFLoader().loadAsync(
        '/assets/models/enemy_projectile.glb',
      );
      scene.updateMatrixWorld(true);
      let geometry: BufferGeometry | undefined;
      const geometries = new Set<BufferGeometry>();
      const materials = new Set<Material>();
      scene.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        geometry ??= node.geometry.clone().applyMatrix4(node.matrixWorld);
        geometries.add(node.geometry);
        for (const m of Array.isArray(node.material)
          ? node.material
          : [node.material])
          materials.add(m);
      });
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      if (!geometry) return;
      if (this.disposed) {
        geometry.dispose();
        return;
      }
      this.enemyGeometry.dispose();
      this.enemyGeometry = geometry;
      this.enemy.geometry = geometry;
    } catch {
      // Bryła zastępcza zachowuje czytelność bez assetu.
    }
  }

  capturePrevious(): void {
    this.previous.clear();
    this.system.forEachActive((id, pos) => this.previous.set(id, { ...pos }));
  }

  render(alpha: number): void {
    this.player.count = 0;
    this.enemy.count = 0;
    this.system.forEachActive((id, pos, dir, team) => {
      const mesh = team === 'player' ? this.player : this.enemy;
      const previous = this.previous.get(id) ?? pos;
      this.transform.position.set(
        previous.x + (pos.x - previous.x) * alpha,
        previous.y + (pos.y - previous.y) * alpha,
        previous.z + (pos.z - previous.z) * alpha,
      );
      this.direction.set(dir.x, dir.y, dir.z);
      this.transform.quaternion.setFromUnitVectors(this.axis, this.direction);
      this.transform.scale.setScalar(team === 'enemy' ? 1.6 : 1);
      this.transform.updateMatrix();
      mesh.setMatrixAt(mesh.count++, this.transform.matrix);
    });
    this.player.instanceMatrix.needsUpdate = true;
    this.enemy.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.disposed = true;
    this.root.removeFromParent();
    this.player.dispose();
    this.enemy.dispose();
    this.geometry.dispose();
    this.boltGeometry.dispose();
    this.enemyGeometry.dispose();
    this.previous.clear();
  }
}
