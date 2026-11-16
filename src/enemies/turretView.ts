import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  TorusGeometry,
} from 'three';
import type { BufferGeometry, Object3D } from 'three';
import { getMaterial } from '../render/materials';
import { AimLaser } from './aimLaser';
import type { Enemy } from './types';

/** Czysto wizualne: pulsowanie oka przy celowaniu i odrzut luf po strzale. */
const EYE_PULSE_HZ = 5;
const EYE_PULSE_SCALE = 0.35;
const RECOIL_M = 0.06;
const RECOIL_S = 0.12;

type Kind = 'enemy' | 'enemyDark' | 'enemyGlow';

/**
 * Wieżyczka: ośmiokątny cokół na trzech wspornikach, kolumna z pierścieniem światła i obrotowa
 * głowica z dwiema lufami, osłonami i okiem czujnika. Wymiary z `body` i `muzzle` w danych.
 */
export class TurretView {
  readonly root = new Group();
  /** Obrót głowicy wokół pionu na wysokości podstawy: laser liczy początek z `muzzle` w układzie wroga. */
  private readonly head = new Group();
  /** Bryła głowicy na wysokości wylotu (`muzzle.y`). */
  private readonly housing = new Group();
  private readonly barrels = new Group();
  private readonly eye: Mesh;
  private readonly geometries: BufferGeometry[] = [];
  private readonly laser: AimLaser;

  constructor(private readonly enemy: Enemy) {
    const body = enemy.definition.body!;
    const muzzle = enemy.definition.muzzle!;
    const r = body.radius;
    const hr = body.headRadius;
    const mesh = (
      geometry: BufferGeometry,
      kind: Kind,
      parent: Object3D,
      position: [number, number, number],
      rotation: [number, number, number] = [0, 0, 0],
      name = '',
    ): Mesh => {
      this.geometries.push(geometry);
      const part = new Mesh(geometry, getMaterial(kind));
      part.name = name;
      part.position.set(...position);
      part.rotation.set(...rotation);
      if (kind === 'enemyGlow') part.userData.noOutline = true;
      parent.add(part);
      return part;
    };
    // Cokół i kolumna do wysokości osi głowicy.
    const plinthH = body.centerY * 0.22;
    const columnTop = muzzle.y - hr * 0.62;
    mesh(
      new CylinderGeometry(r * 1.08, r * 1.25, plinthH, 8),
      'enemyDark',
      this.root,
      [0, plinthH / 2, 0],
      [0, Math.PI / 8, 0],
      'base',
    );
    mesh(
      new CylinderGeometry(r * 0.95, r * 1.15, plinthH * 0.5, 8),
      'enemy',
      this.root,
      [0, plinthH * 1.25, 0],
      [0, Math.PI / 8, 0],
    );
    const columnH = columnTop - plinthH * 1.5;
    mesh(
      new CylinderGeometry(r * 0.5, r * 0.68, columnH, 8),
      'enemy',
      this.root,
      [0, plinthH * 1.5 + columnH / 2, 0],
      [0, Math.PI / 8, 0],
    );
    mesh(
      new TorusGeometry(r * 0.56, 0.022, 4, 16),
      'enemyGlow',
      this.root,
      [0, plinthH * 1.5 + columnH * 0.72, 0],
      [Math.PI / 2, 0, 0],
    );
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + Math.PI / 3;
      const strut = new Group();
      strut.rotation.y = angle;
      this.root.add(strut);
      mesh(
        new BoxGeometry(0.1, columnH * 0.62, 0.12),
        'enemyDark',
        strut,
        [0, plinthH * 1.5 + columnH * 0.28, r * 0.72],
        [-0.38, 0, 0],
      );
    }
    mesh(
      new CylinderGeometry(r * 0.78, r * 0.62, hr * 0.28, 8),
      'enemyDark',
      this.root,
      [0, columnTop - hr * 0.1, 0],
      [0, Math.PI / 8, 0],
    );
    // Głowica obraca się wokół pionu; przód +Z.
    this.head.name = 'turretHead';
    this.housing.position.y = muzzle.y;
    this.head.add(this.housing);
    const housing = mesh(
      new BoxGeometry(hr * 1.75, hr * 1.05, hr * 1.85),
      'enemy',
      this.housing,
      [0, 0, -hr * 0.1],
      [0, 0, 0],
      'head',
    );
    housing.position.y = 0;
    mesh(
      new BoxGeometry(hr * 1.45, hr * 0.16, hr * 1.5),
      'enemyDark',
      this.housing,
      [0, hr * 0.6, -hr * 0.15],
    );
    mesh(
      new BoxGeometry(hr * 1.3, hr * 0.55, hr * 0.22),
      'enemyDark',
      this.housing,
      [0, -hr * 0.12, hr * 0.85],
      [-0.25, 0, 0],
    );
    for (const side of [-1, 1]) {
      mesh(
        new BoxGeometry(hr * 0.24, hr * 0.85, hr * 1.55),
        'enemyDark',
        this.housing,
        [side * hr * 0.98, -hr * 0.05, -hr * 0.12],
      );
      mesh(
        new BoxGeometry(hr * 0.05, hr * 0.08, hr * 1.2),
        'enemyGlow',
        this.housing,
        [side * hr * 1.11, hr * 0.12, -hr * 0.12],
      );
      mesh(
        new BoxGeometry(hr * 0.32, hr * 0.5, hr * 0.7),
        'enemy',
        this.housing,
        [side * hr * 1.22, -hr * 0.2, -hr * 0.55],
      );
    }
    // Lufy od przodu obudowy do wylotu z danych; podwójne, z czerwonymi wylotami.
    this.barrels.name = 'barrels';
    this.housing.add(this.barrels);
    const front = hr * 0.8;
    const length = Math.max(muzzle.z - front, 0.05);
    for (const side of [-1, 1]) {
      mesh(
        new CylinderGeometry(hr * 0.11, hr * 0.13, length, 8),
        'enemyDark',
        this.barrels,
        [muzzle.x + side * hr * 0.24, -hr * 0.18, front + length / 2],
        [Math.PI / 2, 0, 0],
        side < 0 ? 'barrel' : 'barrel_R',
      );
      mesh(
        new CylinderGeometry(hr * 0.17, hr * 0.17, length * 0.3, 8),
        'enemy',
        this.barrels,
        [muzzle.x + side * hr * 0.24, -hr * 0.18, front + length * 0.18],
        [Math.PI / 2, 0, 0],
      );
      mesh(
        new CylinderGeometry(hr * 0.12, hr * 0.12, 0.04, 8),
        'enemyGlow',
        this.barrels,
        [muzzle.x + side * hr * 0.24, -hr * 0.18, muzzle.z],
        [Math.PI / 2, 0, 0],
        'muzzle_glow',
      );
    }
    this.eye = mesh(
      new CylinderGeometry(hr * 0.2, hr * 0.24, hr * 0.12, 10),
      'enemyGlow',
      this.housing,
      [0, hr * 0.22, hr * 0.88],
      [Math.PI / 2, 0, 0],
      'eye',
    );
    this.laser = new AimLaser(enemy, hr * 0.04);
    this.head.add(this.laser.mesh);
    this.root.add(this.head);
  }

  render(alpha: number): void {
    const { previous: a, current: b } = this.enemy;
    const t = Math.max(0, Math.min(1, alpha));
    this.root.position.set(
      a.position.x + (b.position.x - a.position.x) * t,
      a.position.y + (b.position.y - a.position.y) * t,
      a.position.z + (b.position.z - a.position.z) * t,
    );
    const delta = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw));
    this.head.rotation.y = a.yaw + delta * t;
    this.root.visible = b.state !== 'dead' && !this.enemy.removed;
    const pulse =
      b.state === 'aim'
        ? 1 +
          EYE_PULSE_SCALE *
            (1 + Math.sin(b.stateTimeS * EYE_PULSE_HZ * Math.PI * 2))
        : 1;
    this.eye.scale.setScalar(pulse);
    const shot = b.shotTimeS;
    this.barrels.position.z =
      shot !== undefined ? -RECOIL_M * Math.max(0, 1 - shot / RECOIL_S) : 0;
    this.laser.render(this.head);
  }

  dispose(): void {
    this.laser.dispose();
    this.root.removeFromParent();
    this.root.clear();
    for (const geometry of this.geometries) geometry.dispose();
  }
}
