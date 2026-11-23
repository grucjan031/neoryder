import { describe, expect, it } from 'vitest';
import { Box3, BoxGeometry, Group, Mesh, Object3D } from 'three';
import { ShieldBodyClearance } from '../../src/enemies/heldShield';

function setup(handZ: number) {
  const root = new Group();
  const shield = new Mesh(new BoxGeometry(0.8, 1.2, 0.12));
  shield.position.set(0.2, 1, 0.12);
  root.add(shield);
  const chest = new Mesh(new BoxGeometry(0.4, 0.5, 0.2));
  chest.position.set(0, 1.3, 0);
  root.add(chest);
  const hand = new Object3D();
  hand.position.set(0.2, 1, handZ);
  root.add(hand);
  const farLeg = new Mesh(new BoxGeometry(0.1, 0.1, 0.1));
  farLeg.position.set(2, 1, 0.5);
  root.add(farLeg);
  const clearance = new ShieldBodyClearance(
    shield,
    root,
    [chest, farLeg],
    [hand],
    () => 0.02,
    () => 0.07,
  );
  return { root, shield, clearance };
}

const backZ = (shield: Mesh) => new Box3().setFromObject(shield).min.z;

describe('ShieldBodyClearance', () => {
  it('wypycha tarczę przed dłoń wysuniętą w biegu', () => {
    const { shield, clearance } = setup(0.3);
    clearance.update();
    expect(backZ(shield)).toBeCloseTo(0.3 + 0.07 + 0.02, 5);
  });

  it('nie rusza tarczy, gdy ciało jest za nią, i pomija części poza jej obrysem', () => {
    const { shield, clearance } = setup(-0.05);
    clearance.update();
    // Pancerz piersi kończy się na z = 0.1, a tył tarczy jest na 0.06 → tylko odsunięcie od piersi.
    expect(backZ(shield)).toBeCloseTo(0.1 + 0.02, 5);
    const z = shield.position.z;
    clearance.update();
    expect(shield.position.z).toBeCloseTo(z, 6);
  });
});
