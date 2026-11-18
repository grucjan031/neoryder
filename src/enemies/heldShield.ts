import { Box3, Euler, Matrix4, Mesh, Quaternion, Vector3 } from 'three';
import type { Object3D } from 'three';

/** Ogranicza wysokość tarczy do dolnej krawędzi hełmu po obliczeniu pozy ręki. */
export class ShieldHeadClearance {
  private readonly inverse = new Matrix4();
  private readonly matrix = new Matrix4();
  private readonly shieldBox = new Box3();
  private readonly headBox = new Box3();
  private readonly partBox = new Box3();

  constructor(
    private readonly shield: Object3D,
    private readonly head: Object3D,
    private readonly root: Object3D,
    private readonly clearanceM: () => number,
  ) {}

  private bounds(node: Object3D, box: Box3): void {
    box.makeEmpty();
    node.traverse((part) => {
      if (!(part instanceof Mesh)) return;
      if (!part.geometry.boundingBox) part.geometry.computeBoundingBox();
      this.matrix.multiplyMatrices(this.inverse, part.matrixWorld);
      box.union(
        this.partBox.copy(part.geometry.boundingBox!).applyMatrix4(this.matrix),
      );
    });
  }

  update(): void {
    if (this.shield.parent !== this.root) return;
    this.shield.updateWorldMatrix(true, true);
    this.head.updateWorldMatrix(true, true);
    this.inverse.copy(this.root.matrixWorld).invert();
    this.bounds(this.shield, this.shieldBox);
    this.bounds(this.head, this.headBox);
    const lowerBy =
      this.shieldBox.max.y - this.headBox.min.y + this.clearanceM();
    if (!(lowerBy > 0)) return;
    this.shield.position.y -= lowerBy;
    this.shield.updateWorldMatrix(false, true);
  }
}

export interface ShieldHold {
  bone: string;
  position: { x: number; y: number; z: number };
  rotationDeg: { x: number; y: number; z: number };
  /** 0..1: jaka część obrotu kości (względem pozy odniesienia) przenosi się na tarczę. */
  rotationFollow: number;
}

const rad = Math.PI / 180;
const rootInverse = new Matrix4();
const boneInRoot = new Matrix4();
const bonePosition = new Vector3();
const boneRotation = new Quaternion();
const boneScale = new Vector3();
const partial = new Quaternion();
const identity = new Quaternion();
const offset = new Vector3();

/**
 * Tarcza trzymana w ręce Tarczownika. `hold` opisuje, gdzie tarcza stoi względem `root`
 * (układ wroga: +Z przód, +X lewa strona, metry) w pozie odniesienia szkieletu; od tej
 * chwili jej środek podąża za kością dłoni/przedramienia, a obrót dziedziczy `rotationFollow`
 * obrotu kości (1 = sztywne przypięcie, mniej = tarcza nie koziołkuje przy podnoszeniu ręki).
 * Tarcza należy do `root`, nie do kości; `update()` wywołuj po aktualizacji szkieletu.
 */
export class HeldShield {
  private readonly bone: Object3D;
  private readonly offset = new Vector3();
  private readonly referenceInverse = new Quaternion();
  private readonly holdRotation: Quaternion;

  private constructor(
    private readonly shield: Object3D,
    private readonly root: Object3D,
    private readonly hold: ShieldHold,
    bone: Object3D,
  ) {
    this.bone = bone;
    this.holdRotation = new Quaternion().setFromEuler(
      new Euler(
        hold.rotationDeg.x * rad,
        hold.rotationDeg.y * rad,
        hold.rotationDeg.z * rad,
      ),
    );
    this.capture();
    root.add(shield);
    this.update();
  }

  /** Wymaga zaktualizowanych macierzy szkieletu w pozie odniesienia; null, gdy brak kości. */
  static mount(
    shield: Object3D,
    root: Object3D,
    hold: ShieldHold,
  ): HeldShield | null {
    const bone = root.getObjectByName(hold.bone);
    return bone ? new HeldShield(shield, root, hold, bone) : null;
  }

  private sample(): void {
    this.root.updateWorldMatrix(true, false);
    rootInverse.copy(this.root.matrixWorld).invert();
    boneInRoot.multiplyMatrices(rootInverse, this.bone.matrixWorld);
    boneInRoot.decompose(bonePosition, boneRotation, boneScale);
  }

  private capture(): void {
    this.root.updateWorldMatrix(true, true);
    this.sample();
    const { x, y, z } = this.hold.position;
    this.offset.set(x - bonePosition.x, y - bonePosition.y, z - bonePosition.z);
    this.referenceInverse.copy(boneRotation).invert();
  }

  update(): void {
    this.sample();
    partial
      .copy(identity)
      .slerp(
        boneRotation.multiply(this.referenceInverse),
        this.hold.rotationFollow,
      );
    offset.copy(this.offset).applyQuaternion(partial).add(bonePosition);
    this.shield.position.copy(offset);
    this.shield.quaternion.copy(partial).multiply(this.holdRotation);
    this.shield.updateMatrix();
    this.shield.matrixWorld.multiplyMatrices(
      this.root.matrixWorld,
      this.shield.matrix,
    );
  }
}
