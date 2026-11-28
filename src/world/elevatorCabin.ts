import {
  ColliderDesc,
  RigidBodyDesc,
  type World,
  type Collider,
} from '@dimforge/rapier3d-compat';
import type { EventBus } from '../core/events';
import type { Vec3 } from '../core/math';
import type { Tuning } from '../core/tuning';
import { CollisionGroup, interactionGroups } from '../physics';
import { Elevator } from './elevator';
import {
  cabinHeight,
  facePoint,
  sides,
  slab,
  type ElevatorDefinition,
  type Side,
} from './elevatorSchema';
import { rayAabbDistance, type HubFocusBox } from './hubStations';

export interface CabinPart extends HubFocusBox {
  cabin: boolean;
  material: 'frame' | 'glass' | 'door';
  side?: Side;
  stop?: number;
}
export interface ElevatorButton extends HubFocusBox {
  action: 'up' | 'down' | 'call';
  reach?: HubFocusBox;
  stop?: number;
  side: Side;
}
const sideSize = (
  side: Side,
  length: number,
  height: number,
  thickness: number,
): Vec3 =>
  side === 'n' || side === 's'
    ? { x: length, y: height, z: thickness }
    : { x: thickness, y: height, z: length };

export class ElevatorCabin extends Elevator {
  readonly parts: CabinPart[] = [];
  readonly buttons: ElevatorButton[] = [];
  readonly floorHandle: number;
  readonly body;
  previousY: number;
  previousDoor = 0;
  previousStop: number;
  private readonly barriers: { part: CabinPart; collider: Collider }[] = [];
  constructor(
    def: ElevatorDefinition,
    t: Tuning['elevator'],
    world: World,
    bus?: EventBus,
  ) {
    super(def, t, bus);
    this.previousY = this.state.y;
    this.previousStop = this.state.stop;
    this.body = world.createRigidBody(
      RigidBodyDesc.kinematicPositionBased().setTranslation(
        def.x,
        this.state.y,
        def.z,
      ),
    );
    const box = (part: CabinPart) => {
      this.parts.push(part);
      const p = part.position,
        b = part.size;
      const desc = ColliderDesc.cuboid(b.x / 2, b.y / 2, b.z / 2)
        .setTranslation(p.x, p.y, p.z)
        .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff));
      const col = world.createCollider(
        desc,
        part.cabin ? this.body : undefined,
      );
      if (part.side && part.material === 'door')
        this.barriers.push({ part, collider: col });
      return col;
    };
    this.floorHandle = box({
      cabin: true,
      material: 'frame',
      position: { x: 0, y: -slab / 2, z: 0 },
      size: { x: def.width, y: slab, z: def.depth },
    }).handle;
    box({
      cabin: true,
      material: 'frame',
      position: { x: 0, y: cabinHeight + slab / 2, z: 0 },
      size: { x: def.width, y: slab, z: def.depth },
    });
    const low = def.stops[0]!.y,
      high = def.stops.at(-1)!.y + cabinHeight + slab;
    box({
      cabin: false,
      material: 'glass',
      position: { x: def.x, y: high + slab / 2, z: def.z },
      size: { x: def.width, y: slab, z: def.depth },
    });
    for (const side of sides) {
      const length = side === 'n' || side === 's' ? def.width : def.depth;
      const faceStops = def.stops
        .map((stop, i) => ({ ...stop, i }))
        .filter((s) => s.doorSide === side);
      const local = facePoint(def, side, cabinHeight / 2, -1.5 * slab);
      local.x -= def.x;
      local.z -= def.z;
      box({
        cabin: true,
        material: faceStops.length ? 'door' : 'glass',
        side,
        position: local,
        size: sideSize(side, length - 2 * slab, cabinHeight, slab),
      });
      let bottom = low;
      const shaftWall = (top: number) => {
        if (top <= bottom) return;
        box({
          cabin: false,
          material: 'glass',
          position: facePoint(def, side, (bottom + top) / 2, -slab / 2),
          size: sideSize(side, length, top - bottom, slab),
        });
      };
      for (const stop of faceStops) {
        shaftWall(stop.y);
        box({
          cabin: false,
          material: 'door',
          side,
          stop: stop.i,
          position: facePoint(def, side, stop.y + cabinHeight / 2, -slab / 2),
          size: sideSize(side, length, cabinHeight, slab),
        });
        this.buttons.push({
          action: 'call',
          side,
          stop: stop.i,
          position: facePoint(
            def,
            side,
            stop.y + 1.35,
            slab,
            length / 2 - 0.19,
          ),
          size: sideSize(side, 0.32, 0.32, slab),
          // Wezwanie działa po wycelowaniu w dowolne miejsce portalu i paneli obok.
          reach: {
            position: facePoint(def, side, stop.y + cabinHeight / 2, slab),
            size: sideSize(side, length + 1.6, cabinHeight, 2 * slab),
          },
        });
        bottom = stop.y + cabinHeight;
      }
      shaftWall(high);
    }
    // Panel w narożniku, wewnątrz płaszczyzny drzwi także przy przystanku wschodnim.
    for (const action of ['up', 'down'] as const)
      this.buttons.push({
        action,
        side: 'e',
        position: {
          x: def.width / 2 - 3 * slab,
          y: action === 'up' ? 1.55 : 1.16,
          z: -def.depth / 2 + 0.34,
        },
        size: sideSize('e', 0.32, 0.32, slab),
      });
  }

  opening(part: CabinPart, stop: number, door: number): number {
    if (
      part.material !== 'door' ||
      part.side !== this.def.stops[stop]!.doorSide ||
      (!part.cabin && part.stop !== stop)
    )
      return 0;
    return door;
  }
  /** Krok bez upływu czasu (pauza, hitstop): interpolacja stoi w miejscu. */
  hold(): void {
    this.previousY = this.state.y;
    this.previousDoor = this.state.door;
    this.previousStop = this.state.stop;
  }
  /** Stopy pasażera wewnątrz obrysu kabiny. */
  holds(feet: Vec3): boolean {
    return (
      Math.abs(feet.x - this.def.x) < this.def.width / 2 &&
      Math.abs(feet.z - this.def.z) < this.def.depth / 2 &&
      Math.abs(feet.y - this.state.y) < 0.5
    );
  }
  override step(dt: number, occupied = false, holdOpen = false): void {
    this.previousY = this.state.y;
    this.previousDoor = this.state.door;
    this.previousStop = this.state.stop;
    super.step(dt, occupied, holdOpen);
    this.body.setNextKinematicTranslation({
      x: this.def.x,
      y: this.state.y,
      z: this.def.z,
    });
    for (const { part, collider } of this.barriers) {
      const enabled =
        this.opening(part, this.state.stop, this.state.door) <
        this.tuning.elevatorDoorPassFraction;
      if (collider.isEnabled() !== enabled) collider.setEnabled(enabled);
    }
  }
  inDoorway(p: Vec3, r: number): boolean {
    const stop = this.def.stops[this.state.stop]!;
    if (Math.abs(p.y - stop.y) > r) return false;
    const face = facePoint(this.def, stop.doorSide, stop.y, -slab);
    const dx = Math.abs(p.x - face.x),
      dz = Math.abs(p.z - face.z);
    return stop.doorSide === 'n' || stop.doorSide === 's'
      ? dz < r + slab && dx < this.def.width / 2 + r
      : dx < r + slab && dz < this.def.depth / 2 + r;
  }
  buttonTarget(b: ElevatorButton): number | undefined {
    if (b.stop !== undefined) return b.stop;
    if (this.state.phase === 'moving') return undefined;
    const stop = this.state.stop + (b.action === 'up' ? 1 : -1);
    return this.def.stops[stop] ? stop : undefined;
  }
  hitButton(
    eye: Vec3,
    dir: Vec3,
    maxM: number,
  ): { button: ElevatorButton; distance: number } | undefined {
    let hit;
    for (const button of this.buttons) {
      const p = button.position;
      const inside =
        Math.abs(eye.x - this.def.x) < this.def.width / 2 &&
        Math.abs(eye.z - this.def.z) < this.def.depth / 2;
      if (
        inside !== (button.stop === undefined) ||
        this.buttonTarget(button) === undefined ||
        (button.stop === this.state.stop &&
          (this.state.phase === 'open' || this.state.phase === 'doorsOpening'))
      )
        continue;
      const position =
        button.stop === undefined
          ? { x: p.x + this.def.x, y: p.y + this.state.y, z: p.z + this.def.z }
          : p;
      const distance = rayAabbDistance(
        eye,
        dir,
        button.reach ?? { position, size: button.size },
      );
      if (
        distance !== null &&
        distance <= maxM &&
        (!hit || distance < hit.distance)
      )
        hit = { button, distance };
    }
    return hit;
  }
}
