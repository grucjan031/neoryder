import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
} from 'three';
import type {
  CabinPart,
  ElevatorButton,
  ElevatorCabin,
} from '../world/elevatorCabin';
import {
  cabinHeight,
  elevatorKit,
  facePoint,
  slab,
  type Side,
} from '../world/elevatorSchema';
import { cloneCityModel } from './cityModels';

const sideYaw: Record<Side, number> = {
  n: Math.PI,
  s: 0,
  e: Math.PI / 2,
  w: -Math.PI / 2,
};

export class ElevatorView {
  private readonly root = new Group();
  private readonly car = new Group();
  private readonly box = new BoxGeometry();
  private readonly frame = new MeshStandardMaterial({
    color: 0x444853,
    metalness: 0.55,
    roughness: 0.45,
  });
  private readonly glass = new MeshStandardMaterial({
    color: 0x7d8caa,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });
  private readonly door = new MeshStandardMaterial({
    color: 0x737788,
    metalness: 0.45,
    roughness: 0.4,
  });
  private readonly amber = new MeshBasicMaterial({ color: 0xffb548 });
  private readonly lit = new MeshBasicMaterial({ color: 0xfff1d1 });
  private readonly dim = new MeshBasicMaterial({ color: 0x57514a });
  private readonly panels = new Map<ElevatorButton, Mesh[]>();
  private readonly plates = new Map<ElevatorButton, Object3D[]>();
  private readonly carShell: Mesh[] = [];
  private readonly leaves: {
    part: CabinPart;
    mesh: Object3D;
    sign: number;
    glb?: boolean;
  }[] = [];
  private readonly kit: string | undefined;
  constructor(
    private readonly cabin: ElevatorCabin,
    parent: Object3D,
    private readonly decor: readonly {
      model: string;
      position: { x: number; y: number; z: number };
    }[] = [],
  ) {
    this.kit = elevatorKit(cabin.def.model);
    this.root.add(this.car);
    parent.add(this.root);
    for (const part of cabin.parts) {
      const group = part.cabin ? this.car : this.root;
      const isDoor = part.material === 'door';
      for (const sign of isDoor ? [-1, 1] : [0]) {
        const mesh = new Mesh(this.box, this[part.material]);
        mesh.position.copy(part.position);
        mesh.scale.copy(part.size);
        group.add(mesh);
        if (isDoor) this.leaves.push({ part, mesh, sign });
        else if (part.cabin) this.carShell.push(mesh);
      }
    }
    const { width, depth } = cabin.def;
    for (const x of [-1, 1])
      for (const z of [-1, 1]) {
        const post = new Mesh(this.box, this.frame);
        post.scale.set(slab, cabinHeight, slab);
        post.position.set(
          x * (width / 2 - slab),
          cabinHeight / 2,
          z * (depth / 2 - slab),
        );
        this.car.add(post);
        this.carShell.push(post);
      }
    for (const button of cabin.buttons) {
      const panel = new Mesh(this.box, this.frame);
      panel.position.copy(button.position);
      panel.rotation.y =
        button.stop === undefined ? -Math.PI / 2 : sideYaw[button.side];
      const group = button.stop === undefined ? this.car : this.root;
      group.add(panel);
      if (button.stop === undefined) this.carShell.push(panel);
      const face = new Group();
      face.position.copy(panel.position);
      face.rotation.copy(panel.rotation);
      group.add(face);
      panel.scale.set(0.32, 0.32, slab);
      const icon = new Mesh(this.box, this.amber);
      icon.position.z = slab / 2 + 0.005;
      icon.scale.set(0.12, 0.12, 0.012);
      const icons = [icon];
      if (button.action === 'call') icon.rotation.z = Math.PI / 4;
      else {
        // Dwie kreski grotu mają wspólne podświetlenie z pierwszą.
        icon.scale.set(0.12, 0.035, 0.012);
        icon.position.x = -0.042;
        icon.rotation.z = ((button.action === 'up' ? 1 : -1) * Math.PI) / 4;
        const other = icon.clone();
        other.position.x *= -1;
        other.rotation.z *= -1;
        face.add(other);
        icons.push(other);
      }
      face.add(icon);
      this.panels.set(button, icons);
      this.plates.set(button, [panel, face]);
    }
    this.render(1);
  }
  async loadModel(): Promise<void> {
    const modelId = this.cabin.def.model;
    if (!modelId) return;
    const model = await cloneCityModel(modelId);
    if (!model) return;
    this.car.add(model);
    for (const mesh of this.carShell) mesh.visible = false;
    const kit = this.kit;
    if (!kit) return;
    for (const leaf of this.leaves)
      if (leaf.part.cabin) leaf.mesh.visible = false;
    for (const part of this.cabin.parts) {
      if (part.cabin || part.material !== 'door' || part.stop === undefined)
        continue;
      const stop = this.cabin.def.stops[part.stop]!;
      const portal = await cloneCityModel(`${kit}_elevator_shaft_door`);
      if (!portal) continue;
      const at = facePoint(this.cabin.def, stop.doorSide, stop.y, 0);
      portal.position.set(at.x, at.y, at.z);
      portal.rotation.y = sideYaw[stop.doorSide];
      this.root.add(portal);
      const left = portal.getObjectByName('door_left');
      const right = portal.getObjectByName('door_right');
      if (left && right) {
        for (const leaf of this.leaves)
          if (leaf.part === part) leaf.mesh.visible = false;
        this.leaves.push(
          { part, mesh: left, sign: -1, glb: true },
          { part, mesh: right, sign: 1, glb: true },
        );
      }
    }
    for (const button of this.cabin.buttons) {
      if (button.stop === undefined) continue;
      const stop = this.cabin.def.stops[button.stop]!;
      // Mapa może mieć własny panel wezwania obok portalu.
      const own = this.decor.some(
        (d) =>
          d.model === `${kit}_elevator_call_panel` &&
          Math.abs(d.position.y - stop.y) < 0.6 &&
          Math.hypot(
            d.position.x - button.position.x,
            d.position.z - button.position.z,
          ) < 1.6,
      );
      if (own) {
        for (const plate of this.plates.get(button) ?? [])
          plate.visible = false;
        continue;
      }
      const callPanel = await cloneCityModel(`${kit}_elevator_call_panel`);
      if (!callPanel) continue;
      callPanel.position.set(button.position.x, stop.y, button.position.z);
      callPanel.rotation.y = sideYaw[button.side];
      this.root.add(callPanel);
    }
    this.render(1);
  }
  render(alpha: number, focus?: ElevatorButton): void {
    const c = this.cabin,
      s = c.state;
    this.car.position.set(
      c.def.x,
      c.previousY + (s.y - c.previousY) * alpha,
      c.def.z,
    );
    for (const { part, mesh, sign, glb } of this.leaves) {
      if (part.cabin && this.kit) continue;
      const before = c.opening(part, c.previousStop, c.previousDoor);
      const after = c.opening(part, s.stop, s.door);
      const fraction = before + (after - before) * alpha;
      if (glb) {
        mesh.scale.x = 1 - fraction;
        mesh.position.x = sign * 0.55 * (1 + fraction);
        mesh.visible = fraction < 1;
        continue;
      }
      if (
        !part.cabin &&
        this.kit &&
        this.leaves.some((l) => l.part === part && l.glb)
      )
        continue;
      const axis = part.side === 'n' || part.side === 's' ? 'x' : 'z';
      // Skrzydła teleskopowe chowają się w ościeżach wewnątrz obrysu szybu.
      mesh.scale[axis] = (part.size[axis] * (1 - fraction)) / 2;
      mesh.position[axis] =
        part.position[axis] + (sign * (part.size[axis] - mesh.scale[axis])) / 2;
      mesh.visible = fraction < 1;
    }
    for (const [b, icons] of this.panels) {
      const material =
        c.buttonTarget(b) === undefined
          ? this.dim
          : focus === b
            ? this.lit
            : this.amber;
      for (const icon of icons) icon.material = material;
    }
  }
  dispose(): void {
    this.root.removeFromParent();
    this.box.dispose();
    for (const m of [
      this.frame,
      this.glass,
      this.door,
      this.amber,
      this.lit,
      this.dim,
    ])
      m.dispose();
  }
}
