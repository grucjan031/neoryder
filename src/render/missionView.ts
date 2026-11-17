import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
} from 'three';
import type { MissionObjectives } from '../world/missionObjectives';

/** Oprawa celów nie uczestniczy w symulacji ani kolizjach. */
export class MissionView {
  readonly root = new Group();
  private readonly entries = new Map<
    string,
    { object: Group; bar: Mesh; ring: Mesh; lamp?: Mesh }
  >();
  private readonly box = new BoxGeometry(1, 1, 1);
  private readonly ringGeometry: RingGeometry;
  private readonly metal = new MeshBasicMaterial({ color: '#56627a' });
  private readonly red = new MeshBasicMaterial({ color: '#e0262b' });
  private readonly white = new MeshBasicMaterial({ color: '#fff1d6' });
  private readonly amber = new MeshBasicMaterial({ color: '#ffae1a', side: 2 });
  constructor(
    private readonly model: MissionObjectives,
    radius: number,
  ) {
    this.ringGeometry = new RingGeometry(radius - 0.06, radius, 48);
    for (const objective of model.mission.objectives.filter((o) =>
      model.ids.includes(o.id),
    )) {
      const position = model.position(objective);
      if (!position) continue;
      const object = new Group();
      object.position.set(position.x, position.y, position.z);
      const cube = (
        x: number,
        y: number,
        z: number,
        sx: number,
        sy: number,
        sz: number,
        material = this.metal,
      ): Mesh => {
        const mesh = new Mesh(this.box, material);
        mesh.position.set(x, y, z);
        mesh.scale.set(sx, sy, sz);
        object.add(mesh);
        return mesh;
      };
      let lamp: Mesh | undefined;
      if (objective.kind === 'sabotage') {
        for (const x of [-0.25, 0.25])
          for (const z of [-0.25, 0.25]) cube(x, 1.5, z, 0.07, 3, 0.07);
        for (const y of [0.6, 1.2, 1.8, 2.4]) {
          cube(0, y, 0, 0.6, 0.07, 0.6);
          const brace = cube(0, y + 0.3, 0.25, 0.06, 0.8, 0.06);
          brace.rotation.z = Math.PI / 4;
        }
        cube(0, 0.3, 0, 0.8, 0.6, 0.7);
        cube(0, 0.35, 0.36, 0.45, 0.12, 0.04, this.red);
        lamp = cube(0, 3.1, 0, 0.3, 0.2, 0.3, this.red);
      } else if (objective.kind === 'pickup') {
        cube(0, 0.3, 0, 0.6, 0.4, 0.4, this.white);
        cube(0, 0.51, 0, 0.4, 0.02, 0.12, this.metal);
      } else {
        cube(0, 0.05, 0, 1.6, 0.1, 1.6, this.metal);
        for (const edge of [-0.75, 0.75]) {
          cube(edge, 0.11, 0, 0.06, 0.03, 1.6, this.white);
          cube(0, 0.11, edge, 1.6, 0.03, 0.06, this.white);
        }
        const wheel = new Mesh(this.ringGeometry, this.white);
        wheel.rotation.x = -Math.PI / 2;
        wheel.scale.setScalar(0.2);
        wheel.position.y = 0.25;
        object.add(wheel);
        cube(0, 0.2, 0, 0.08, 0.4, 0.08, this.white);
        cube(0, 0.25, 0, 0.6, 0.06, 0.06, this.white);
      }
      const ring = new Mesh(this.ringGeometry, this.amber);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      object.add(ring);
      const bar = cube(
        0,
        objective.kind === 'sabotage' ? 1.1 : 0.9,
        0.5,
        1,
        0.08,
        0.08,
        this.amber,
      );
      this.entries.set(objective.id, { object, ring, bar, lamp });
      this.root.add(object);
    }
  }
  update(): void {
    for (const objective of this.model.mission.objectives) {
      const view = this.entries.get(objective.id);
      if (!view) continue;
      view.object.visible =
        this.model.objectives[objective.id] !== 'done' &&
        (objective.kind !== 'pickup' || this.model.unlocked(objective));
      view.ring.visible = this.model.unlocked(objective);
      view.bar.scale.x = Math.max(0.01, this.model.progress[objective.id] ?? 0);
      const fuse = this.model.fuses[objective.id];
      if (view.lamp)
        view.lamp.visible =
          fuse === undefined || Math.floor(fuse * 4) % 2 === 0;
    }
  }
  dispose(): void {
    this.root.removeFromParent();
    this.box.dispose();
    this.ringGeometry.dispose();
    for (const material of [this.metal, this.red, this.white, this.amber])
      material.dispose();
  }
}
