import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three';
import type { BladeView } from '../combat/melee/plasmaBlade';
import type { Tuning } from '../core/tuning';
import { getMaterial } from './materials';
import { fppGlowMaterial, markGlow } from './fppMaterials';

/** Rzucone ostrze: biały rdzeń z cyjanową i szeroką addytywną poświatą. */
export class FlyingBlade {
  readonly root = new Mesh(new BoxGeometry(1, 1, 1), getMaterial('player'));
  private readonly core = new MeshBasicMaterial({
    color: '#7ff5ff',
    toneMapped: false,
  });
  private readonly glows = [
    fppGlowMaterial('#00e5ff', 0.6),
    fppGlowMaterial('#4fdcff', 0.14),
  ];

  constructor() {
    this.root.visible = false;
    this.core.userData.bloom = true;
    // Biały-gorący rdzeń w środku, cyan i szeroka poświata addytywnie dookoła.
    this.root.material = this.core;
    const inner = new Mesh(this.root.geometry, this.glows[0]);
    inner.scale.set(2.4, 2.4, 1.03);
    const outer = new Mesh(this.root.geometry, this.glows[1]);
    outer.scale.set(5.5, 5.5, 1.08);
    for (const mesh of [inner, outer]) mesh.renderOrder = 2;
    this.root.add(inner, outer);
    markGlow(this.root);
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
    this.core.dispose();
    for (const glow of this.glows) glow.dispose();
    this.root.removeFromParent();
  }
}
