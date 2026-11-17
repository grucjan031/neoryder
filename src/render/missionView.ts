import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Material,
  RingGeometry,
} from 'three';
import type { MissionObjectives } from '../world/missionObjectives';
import { tuning } from '../core/tuning';
import { createUrbanMaterial } from './urbanMaterials';

/** Oprawa celów nie uczestniczy w symulacji ani kolizjach. */
export class MissionView {
  readonly root = new Group();
  private readonly entries = new Map<
    string,
    {
      object: Group;
      bar: Mesh;
      ring: Mesh;
      lamp?: Mesh;
      gate?: Mesh;
      serverLeds: Mesh<BoxGeometry, MeshStandardMaterial>[];
    }
  >();
  private readonly box = new BoxGeometry(1, 1, 1);
  private readonly ringGeometry: RingGeometry;
  private readonly zoneGeometries: RingGeometry[] = [];
  private readonly metal = new MeshBasicMaterial({ color: '#56627a' });
  private readonly red = new MeshStandardMaterial({
    color: '#e0262b',
    emissive: '#e0262b',
    emissiveIntensity: tuning.mission.mastEmissionMin,
    toneMapped: false,
  });
  private readonly white = new MeshBasicMaterial({ color: '#fff1d6' });
  private readonly amber = new MeshBasicMaterial({ color: '#ffae1a', side: 2 });
  private readonly serverMetal = createUrbanMaterial('metal');
  private readonly serverPanels = createUrbanMaterial('machine');
  private readonly serverLedMaterials: MeshStandardMaterial[] = [];
  constructor(
    private readonly model: MissionObjectives,
    radius: number,
  ) {
    this.serverMetal.color.set('#263344');
    this.serverPanels.color.set('#121d2b');
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
        material: Material = this.metal,
      ): Mesh => {
        const mesh = new Mesh(this.box, material);
        mesh.position.set(x, y, z);
        mesh.scale.set(sx, sy, sz);
        object.add(mesh);
        return mesh;
      };
      let lamp: Mesh | undefined;
      let gate: Mesh | undefined;
      const serverLeds: Mesh<BoxGeometry, MeshStandardMaterial>[] = [];
      if (objective.kind === 'sabotage') {
        for (const x of [-0.25, 0.25])
          for (const z of [-0.25, 0.25]) cube(x, 1.5, z, 0.07, 3, 0.07);
        for (const y of [0.6, 1.2, 1.8, 2.4]) {
          cube(0, y, 0, 0.6, 0.07, 0.6);
          const brace = cube(0, y + 0.3, 0.25, 0.06, 0.8, 0.06);
          brace.rotation.z = Math.PI / 4;
        }
        cube(0, 0.3, 0, 0.8, 0.6, 0.7);
        for (const side of [-1, 1]) {
          for (const offset of [-0.22, 0, 0.22]) {
            cube(offset, 0.4, side * 0.36, 0.1, 0.08, 0.04, this.red);
            cube(side * 0.41, 0.4, offset, 0.04, 0.08, 0.1, this.red);
          }
        }
        cube(0, 3.02, 0, 0.6, 0.08, 0.6);
        lamp = cube(0, 3.24, 0, 0.46, 0.36, 0.46, this.red);
        cube(0, 3.46, 0, 0.6, 0.08, 0.6);
      } else if (objective.kind === 'pickup') {
        cube(0, 0.3, 0, 0.6, 0.4, 0.4, this.white);
        cube(0, 0.51, 0, 0.4, 0.02, 0.12, this.metal);
      } else if (objective.kind === 'interact') {
        cube(0, 1.25, -0.5, 1.6, 2.5, 0.8, this.serverMetal);
        for (const x of [-0.73, 0.73])
          cube(x, 1.25, -0.065, 0.08, 2.4, 0.08, this.serverMetal);
        for (const y of [0.35, 0.7, 1.05, 1.4, 1.75, 2.1]) {
          cube(0, y, -0.07, 1.3, 0.28, 0.06, this.serverPanels);
          for (const x of [-0.48, -0.32, -0.16, 0, 0.16])
            cube(x, y, -0.03, 0.045, 0.16, 0.02, this.serverMetal);
          for (const [x, color] of [
            [0.36, '#ffae1a'],
            [0.53, '#6dff4a'],
          ] as const) {
            const material = new MeshStandardMaterial({
              color,
              emissive: color,
              emissiveIntensity: 0.5,
              toneMapped: false,
            });
            material.userData.bloom = true;
            this.serverLedMaterials.push(material);
            const led = new Mesh(this.box, material);
            led.position.set(x, y, -0.025);
            led.scale.set(0.09, 0.025, 0.025);
            object.add(led);
            serverLeds.push(led);
          }
        }
      } else if (objective.kind === 'defend') {
        cube(0, 0.08, 0, 2.4, 0.16, 1.8);
        cube(0, 0.65, 0, 1.6, 1.1, 0.8);
        const console = cube(0, 1.24, 0, 1.9, 0.12, 1.1);
        console.rotation.x = 0.18;
        cube(0, 1.35, -0.12, 1.35, 0.04, 0.55, this.white);
        cube(0, 1.75, -0.3, 1.55, 0.8, 0.14);
        cube(0, 1.75, -0.22, 1.35, 0.6, 0.03, this.amber);
        for (const y of [1.6, 1.75, 1.9])
          cube(-0.1, y, -0.19, 0.95, 0.04, 0.02, this.metal);
        cube(0.55, 1.38, 0.3, 0.35, 0.12, 0.25, this.amber);
        for (const x of [-0.85, 0.85])
          cube(x, 0.7, 0.45, 0.05, 1, 0.05, this.amber);
      } else if (
        objective.kind === 'exit' &&
        objective.unlockAfter.some((id) =>
          model.mission.objectives.some(
            (o) =>
              o.id === id && (o.kind === 'defend' || o.kind === 'interact'),
          ),
        )
      ) {
        for (const x of [-1, 1]) {
          cube(x, 1.6, 0, 0.2, 3.2, 0.3);
          cube(x, 1.6, 0.18, 0.06, 3, 0.04, this.amber);
        }
        cube(0, 3.2, 0, 2.2, 0.3, 0.4);
        cube(0, 3.2, 0.22, 1.6, 0.1, 0.05, this.white);
        gate = cube(0, 1.5, 0, 1.8, 3, 0.16);
        if (
          objective.unlockAfter.some((id) =>
            model.mission.objectives.some(
              (o) => o.id === id && o.kind === 'interact',
            ),
          )
        ) {
          cube(0, 0.06, 0.7, 2.2, 0.12, 2);
          for (const x of [-1, 1])
            cube(x, 0.14, 0.7, 0.08, 0.04, 2, this.amber);
        }
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
      let geometry = this.ringGeometry;
      if (objective.kind === 'defend') {
        geometry = new RingGeometry(
          objective.radiusM - 0.1,
          objective.radiusM,
          96,
        );
        this.zoneGeometries.push(geometry);
      }
      const ring = new Mesh(geometry, this.amber);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      object.add(ring);
      const bar = cube(
        0,
        objective.kind === 'sabotage'
          ? 1.1
          : objective.kind === 'defend'
            ? 1.5
            : 0.9,
        0.5,
        1,
        0.08,
        0.08,
        this.amber,
      );
      this.entries.set(objective.id, {
        object,
        ring,
        bar,
        lamp,
        gate,
        serverLeds,
      });
      this.root.add(object);
    }
  }
  update(timeS = performance.now() / 1000): void {
    for (const objective of this.model.mission.objectives) {
      const view = this.entries.get(objective.id);
      if (!view) continue;
      if (view.gate) view.gate.visible = !this.model.unlocked(objective);
      view.object.visible =
        (this.model.objectives[objective.id] !== 'done' ||
          objective.kind === 'defend' ||
          objective.kind === 'interact') &&
        (objective.kind !== 'pickup' || this.model.unlocked(objective));
      view.ring.visible =
        this.model.unlocked(objective) &&
        this.model.objectives[objective.id] !== 'done';
      view.bar.scale.x = Math.max(0.01, this.model.progress[objective.id] ?? 0);
      const progress = this.model.progress[objective.id] ?? 0;
      for (let i = 0; i < view.serverLeds.length; i++) {
        const led = view.serverLeds[i]!;
        const row = Math.floor(i / 2);
        const filled = progress >= (row + 1) / (view.serverLeds.length / 2);
        const pulse = (1 + Math.sin(timeS * Math.PI * 2 - row)) / 2;
        led.material.emissiveIntensity = filled ? 0.8 : 0.15 + pulse * 0.25;
      }
      const fuse = this.model.fuses[objective.id];
      if (view.lamp) {
        const config = tuning.mission;
        const frequency =
          fuse === undefined ? config.mastPulseHz : config.mastFusePulseHz;
        const pulse = (1 + Math.sin(timeS * Math.PI * 2 * frequency)) / 2;
        this.red.emissiveIntensity =
          config.mastEmissionMin +
          pulse * (config.mastEmissionMax - config.mastEmissionMin);
      }
    }
  }
  dispose(): void {
    this.root.removeFromParent();
    this.box.dispose();
    this.ringGeometry.dispose();
    for (const geometry of this.zoneGeometries) geometry.dispose();
    for (const material of [
      this.metal,
      this.red,
      this.white,
      this.amber,
      this.serverMetal,
      this.serverPanels,
      ...this.serverLedMaterials,
    ])
      material.dispose();
  }
}
