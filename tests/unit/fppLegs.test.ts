import { readFile } from 'node:fs/promises';
import { Group, PerspectiveCamera, SkinnedMesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { tuning } from '../../src/core/tuning';
import {
  FppLegs,
  legDirection,
  legPhaseDelta,
  legWeights,
} from '../../src/render/fppLegs';

const standing = { grounded: true, crouched: false, sliding: false };

async function loadView() {
  const load = vi
    .spyOn(GLTFLoader.prototype, 'loadAsync')
    .mockImplementation(async (url) => {
      const bytes = await readFile('public' + url);
      return new GLTFLoader().parseAsync(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
        '',
      );
    });
  const world = new Group();
  const local = structuredClone(tuning);
  const view = new FppLegs(world, local);
  onTestFinished(() => {
    view.dispose();
    load.mockRestore();
  });
  await vi.waitFor(() =>
    expect(world.getObjectByName('civ_pants')).toBeInstanceOf(SkinnedMesh),
  );
  return { view, world, local };
}

it('pokazuje spodnie i buty GLB w kadrze kamery, z górnym brzegiem poza kadrem', async () => {
  const { view, world, local } = await loadView();
  const pants = world.getObjectByName('civ_pants') as SkinnedMesh;
  const boots = world.getObjectByName('civ_boots') as SkinnedMesh;
  expect(world.getObjectsByProperty('isMesh', true)).toHaveLength(2);
  expect(pants.skeleton).toBe(boots.skeleton);
  for (const mesh of [pants, boots]) {
    expect(mesh.layers.mask).toBe(1);
    expect(mesh.castShadow).toBe(false);
    expect(mesh.frustumCulled).toBe(true);
  }
  const camera = new PerspectiveCamera(
    tuning.camera.fov,
    16 / 9,
    tuning.horizon.legacyNearM,
    100,
  );
  camera.rotation.x = (-Math.PI * tuning.player.maxPitchDeg) / 180;
  const pos = new Vector3();
  for (const crouched of [false, true]) {
    const height = crouched
      ? tuning.player.slideCapsuleHeight
      : tuning.player.capsuleHeight;
    const state = {
      ...standing,
      crouched,
      height,
      yaw: 0,
      position: { x: 0, y: height / 2, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
    };
    view.update(state, state, 1, 1);
    world.updateMatrixWorld(true);
    camera.position.y =
      height - (tuning.player.capsuleHeight - tuning.player.eyeHeight);
    camera.updateMatrixWorld(true);
    for (const mesh of [pants, boots]) {
      mesh.geometry.computeBoundingBox();
      const waistband = pants.geometry.boundingBox!.max.y;
      const vertices = mesh.geometry.getAttribute('position');
      let visible = 0;
      for (let i = 0; i < vertices.count; i++) {
        mesh
          .getVertexPosition(i, pos)
          .applyMatrix4(mesh.matrixWorld)
          .project(camera);
        if (pos.z > 1 || Math.abs(pos.x) > 1 || Math.abs(pos.y) > 1) continue;
        expect(pos.z).toBeGreaterThan(-1);
        if (mesh === pants) expect(vertices.getY(i)).toBeLessThan(waistband);
        visible++;
      }
      expect(visible).toBeGreaterThan(0);
    }
    local.fppLegs.enabled = false;
    view.update(state, state, 1, 0);
    expect(world.getObjectByName('fppLegs')?.visible).toBe(false);
    local.fppLegs.enabled = true;
  }
  view.dispose();
  expect(world.children).toHaveLength(0);
});

it.each([
  [tuning.player.walkSpeed, tuning.fppLegs.walkStrideM],
  [tuning.player.sprintSpeed, tuning.fppLegs.jogStrideM],
  [-tuning.player.walkSpeed, tuning.fppLegs.walkStrideM],
])(
  'stopa podporowa kompensuje ruch gracza przy %s m/s',
  async (speed, stride) => {
    const { world, view } = await loadView();
    const toes = ['DEF-toeL', 'DEF-toeR'].map((name) =>
      world.getObjectByName(name)!,
    );
    const state = {
      ...standing,
      height: tuning.player.capsuleHeight,
      yaw: 0,
      position: { x: 0, y: tuning.player.capsuleHeight / 2, z: 0 },
      velocity: { x: 0, y: 0, z: -speed },
    };
    const samples = 120;
    const dt = stride / (samples * Math.abs(speed));
    const traces = toes.map((): Vector3[] => []);
    for (let i = 0; i <= samples; i++) {
      state.position.z = -speed * dt * i;
      view.update(state, state, 1, dt);
      toes.forEach((toe, index) =>
        traces[index]!.push(toe.getWorldPosition(new Vector3())),
      );
    }
    for (const points of traces) {
      // Przy odbiciu kostka już się unosi, ale przodostopie nadal podpiera ciało.
      const contactHeight = Math.min(...points.map((p) => p.y)) + 0.015;
      const slips = points
        .slice(1)
        .flatMap((p, i) => {
          const prev = points[i]!;
          return p.y <= contactHeight && prev.y <= contactHeight
            ? [Math.abs(p.z - prev.z) / dt]
            : [];
        })
        .sort((a, b) => a - b);
      expect(slips.length).toBeGreaterThan(0);
      expect(slips[Math.floor(slips.length / 2)]!).toBeLessThan(
        Math.abs(speed) * 0.05,
      );
    }
  },
);

describe('ruch nóg w FPP', () => {
  it('przenika od stania przez chód do biegu, zachowując sumę wag', () => {
    const weights = (speed: number) => legWeights(speed, standing, tuning);
    expect(weights(0).idle).toBe(1);
    expect(weights(tuning.fppLegs.idleBlendSpeed / 2).idle).toBeCloseTo(0.5);
    expect(weights(tuning.player.walkSpeed).walk).toBe(1);
    const mid = weights(
      (tuning.player.walkSpeed + tuning.player.sprintSpeed) / 2,
    );
    expect(mid.walk).toBeCloseTo(0.5);
    expect(mid.jog).toBeCloseTo(0.5);
    expect(weights(tuning.player.sprintSpeed).jog).toBe(1);
  });

  it('ugina nogi w przysiadzie, wygasza kroki w ślizgu i w locie', () => {
    const low = { ...standing, crouched: true };
    expect(legWeights(0, low, tuning).crouch).toBe(1);
    const walk = legWeights(tuning.player.crouchSpeed, low, tuning);
    expect(walk.walk).toBeGreaterThan(0);
    expect(walk.walk + walk.crouch).toBeCloseTo(1);
    expect(legWeights(8, { ...low, sliding: true }, tuning).slide).toBe(1);
    expect(legWeights(8, { ...low, grounded: false }, tuning).air).toBe(1);
  });

  it('obraca nogi do ruchu bocznego i odwraca krok wstecz względem yaw', () => {
    expect(legDirection(1, 0, 0).turn).toBeCloseTo(-Math.PI / 2);
    expect(legDirection(1, 1, 0).turn).toBeCloseTo(Math.PI / 4);
    const back = legDirection(1, 0, Math.PI / 2);
    expect(back.sign).toBe(-1);
    expect(back.turn).toBeCloseTo(0);
  });

  it('przesuwa cykl o przebytą drogę również podczas przenikania', () => {
    const t = tuning.fppLegs;
    const walk = legWeights(tuning.player.walkSpeed, standing, tuning);
    const jog = legWeights(tuning.player.sprintSpeed, standing, tuning);
    expect(legPhaseDelta(t.walkStrideM, walk, t)).toBeCloseTo(1);
    expect(legPhaseDelta(t.jogStrideM, jog, t)).toBeCloseTo(1);
    const mid = { ...walk, walk: 0.5, jog: 0.5 };
    expect(
      legPhaseDelta((t.walkStrideM + t.jogStrideM) / 2, mid, t),
    ).toBeCloseTo(1);
    expect(legPhaseDelta(0, mid, t)).toBe(0);
  });
});
