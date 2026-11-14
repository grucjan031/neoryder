import {
  BoxGeometry,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Object3D,
  Vector3,
} from 'three';
import type { EntityId } from '../core/events';
import type { Vec3 } from '../core/math';
import type { ProjectileSystem } from '../combat/weapons/projectiles';
import { getMaterial } from './materials';

export class ProjectileRenderer {
  readonly root = new Group();
  private readonly geometry = new BoxGeometry(0.08, 0.08, 0.45);
  private readonly player: InstancedMesh;
  private readonly enemy: InstancedMesh;
  private readonly transform = new Object3D();
  private readonly axis = new Vector3(0, 0, 1);
  private readonly direction = new Vector3();
  private readonly previous = new Map<EntityId, Vec3>();

  constructor(
    private readonly system: ProjectileSystem,
    capacity: number,
  ) {
    this.player = new InstancedMesh(
      this.geometry,
      getMaterial('player'),
      capacity,
    );
    this.enemy = new InstancedMesh(
      this.geometry,
      getMaterial('enemyGlow'),
      capacity,
    );
    for (const mesh of [this.player, this.enemy]) {
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      this.root.add(mesh);
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
      this.transform.updateMatrix();
      mesh.setMatrixAt(mesh.count++, this.transform.matrix);
    });
    this.player.instanceMatrix.needsUpdate = true;
    this.enemy.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.root.removeFromParent();
    this.player.dispose();
    this.enemy.dispose();
    this.geometry.dispose();
    this.previous.clear();
  }
}
