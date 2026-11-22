import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
} from 'three';
import { getMaterial } from './materials';
import type { GrabPuzzleState } from '../world/grabPuzzle';
import type { GrabPuzzleDefinition } from '../world/roomSchema';

export class GrabPuzzleView {
  readonly root = new Group();
  private readonly object: Mesh<BoxGeometry, MeshStandardMaterial>;
  private readonly plate?: Mesh<RingGeometry, MeshBasicMaterial>;

  constructor(definition: GrabPuzzleDefinition) {
    const { size, position } = definition.object;
    this.object = new Mesh(
      new BoxGeometry(size.x, size.y, size.z),
      new MeshStandardMaterial({
        color: getMaterial('interactive').color.clone(),
        emissive: getMaterial('neon_amber').color.clone(),
        emissiveIntensity: 0.4,
        roughness: 0.55,
      }),
    );
    this.object.name = 'puzzle-object';
    this.object.position.set(position.x, position.y, position.z);
    this.root.add(this.object);
    if (definition.kind === 'plate') {
      const { position: center, radiusM } = definition;
      this.plate = new Mesh(
        new RingGeometry(radiusM * 0.8, radiusM, 32),
        new MeshBasicMaterial({
          color: getMaterial('neon_amber').color.clone(),
        }),
      );
      this.plate.name = 'puzzle-plate';
      this.plate.rotation.x = -Math.PI / 2;
      this.plate.position.set(center.x, center.y + 0.01, center.z);
      this.root.add(this.plate);
    }
  }

  render(state: GrabPuzzleState, alpha: number): void {
    const { previous, position, engaged, outcome } = state;
    this.object.position.set(
      previous.x + (position.x - previous.x) * alpha,
      previous.y + (position.y - previous.y) * alpha,
      previous.z + (position.z - previous.z) * alpha,
    );
    const active = engaged || outcome === 'solved';
    const tint = getMaterial(active ? 'neon_green' : 'neon_amber').color;
    this.object.material.emissive.copy(tint);
    this.plate?.material.color.copy(tint);
  }

  dispose(): void {
    this.root.removeFromParent();
    this.object.geometry.dispose();
    this.object.material.dispose();
    this.plate?.geometry.dispose();
    this.plate?.material.dispose();
  }
}
