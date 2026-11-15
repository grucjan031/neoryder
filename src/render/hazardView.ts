import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three';
import type { BufferGeometry } from 'three';
import type { Hazard } from '../world/roomSchema';
import type { HazardState } from '../world/hazards';
import { getMaterial } from './materials';

interface View {
  root: Group;
  glow: MeshBasicMaterial;
  surface?: Mesh;
}

/** Tylko prezentacja stanu symulacji; maska bloomu zachowuje test głębi ścian. */
export class HazardView {
  readonly root = new Group();
  private readonly views = new Map<string, View>();
  private readonly geometries: BufferGeometry[] = [];

  constructor(hazards: readonly Hazard[]) {
    for (const hazard of hazards) {
      const root = new Group();
      root.name = `hazard:${hazard.id}`;
      const glow = new MeshBasicMaterial({
        color: '#ffb84d',
        toneMapped: false,
      });
      glow.userData.bloom = true;
      const view: View = { root, glow };
      this.views.set(hazard.id, view);
      this.root.add(root);
      const mesh = (geometry: BufferGeometry, material = glow): Mesh => {
        this.geometries.push(geometry);
        const result = new Mesh(geometry, material);
        root.add(result);
        return result;
      };
      if (hazard.kind === 'explosive_barrel') {
        const body = mesh(new CylinderGeometry(0.4, 0.4, 1.1, 16));
        body.material = getMaterial('hazard');
        body.position.y = 0.55;
        for (const y of [0.08, 1.02]) {
          const band = mesh(new CylinderGeometry(0.405, 0.405, 0.06, 16));
          band.position.y = y;
        }
        root.position.copy(hazard.position);
      } else if (hazard.kind === 'electric_field') {
        const { x, z } = hazard.size;
        root.position.set(
          hazard.position.x,
          hazard.position.y - hazard.size.y / 2 + 0.025,
          hazard.position.z,
        );
        view.surface = mesh(new BoxGeometry(x, 0.015, z));
        for (const sign of [-1, 1]) {
          const alongX = mesh(new BoxGeometry(x, 0.035, 0.04));
          alongX.position.z = (sign * z) / 2;
          const alongZ = mesh(new BoxGeometry(0.04, 0.035, z));
          alongZ.position.x = (sign * x) / 2;
        }
      } else {
        const from = new Vector3().copy(hazard.from);
        const to = new Vector3().copy(hazard.to);
        const direction = to.clone().sub(from);
        for (const p of [from, to]) {
          const emitter = mesh(new BoxGeometry(0.22, 0.3, 0.22));
          emitter.position.copy(p);
        }
        view.surface = mesh(
          new CylinderGeometry(0.035, 0.035, direction.length(), 8),
        );
        view.surface.position.copy(from).add(to).multiplyScalar(0.5);
        if (direction.lengthSq() > 0)
          view.surface.quaternion.setFromUnitVectors(
            new Vector3(0, 1, 0),
            direction.normalize(),
          );
      }
    }
  }

  update(states: readonly HazardState[], _alpha: number): void {
    void _alpha;
    for (const state of states) {
      const view = this.views.get(state.id);
      if (!view) continue;
      view.root.visible = state.alive;
      const wave = 0.5 + 0.5 * Math.sin(state.phaseT * Math.PI * 12);
      const intensity =
        state.phase === 'off'
          ? 0.12
          : state.phase === 'warn'
            ? 0.3 + wave * 0.7
            : 1.2 + wave * 0.3;
      view.glow.color
        .set(state.phase === 'on' ? '#fff1d6' : '#ffb84d')
        .multiplyScalar(intensity);
      view.glow.userData.bloom = state.phase !== 'off';
      if (view.surface) {
        view.surface.visible = state.phase !== 'off';
        if (state.kind === 'laser_gate') {
          const scale = state.phase === 'warn' ? 0.4 : 1;
          view.surface.scale.set(scale, 1, scale);
        }
      }
    }
  }

  dispose(): void {
    this.root.removeFromParent();
    this.root.clear();
    for (const geometry of this.geometries) geometry.dispose();
    this.geometries.length = 0;
    for (const view of this.views.values()) view.glow.dispose();
    this.views.clear();
  }
}
