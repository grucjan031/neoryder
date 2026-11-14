import { BoxGeometry, Mesh } from 'three';
import type { BladeView } from '../combat/melee/plasmaBlade';
import type { Tuning } from '../core/tuning';
import { getMaterial } from './materials';

export class FlyingBlade {
  readonly root = new Mesh(new BoxGeometry(1, 1, 1), getMaterial('player'));

  constructor() {
    this.root.visible = false;
  }

  render(view: BladeView, alpha: number, tuning: Tuning): void {
    const flight = view.flight;
    this.root.visible = flight !== null;
    if (!flight) return;
    const { previous: a, position: b } = flight;
    this.root.position.set(
      a.x + (b.x - a.x) * alpha,
      a.y + (b.y - a.y) * alpha,
      a.z + (b.z - a.z) * alpha,
    );
    this.root.rotation.set(
      0,
      (flight.previousAgeS + (flight.ageS - flight.previousAgeS) * alpha) *
        tuning.melee.throwSpinRadS,
      0,
    );
    this.root.scale.set(
      tuning.melee.throwThicknessM,
      tuning.melee.throwThicknessM,
      tuning.melee.throwLengthM,
    );
  }

  dispose(): void {
    this.root.geometry.dispose();
    this.root.removeFromParent();
  }
}
