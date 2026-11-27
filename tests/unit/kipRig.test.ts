import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it, vi } from 'vitest';
import { EnemyView, kipJoints } from '../../src/enemies/enemyView';
import { enemyDefinitions } from '../../src/enemies/registry';
import type { EnemySnapshot } from '../../src/enemies/types';
import {
  knockdownPose,
  knockdownTiming,
} from '../../src/enemies/enemyKnockdown';
import { tuning } from '../../src/core/tuning';

it.each(['trooper', 'gunner', 'sniper', 'shielder', 'executor'])(
  '%s: zawiasy obu nóg w rzeczywistym GLB',
  async (name) => {
    const bytes = readFileSync(
      new URL(
        '../../public/assets/models/enemy_' + name + '.glb',
        import.meta.url,
      ),
    );
    const { scene } = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    );
    const joints = kipJoints(scene);
    expect(joints).toHaveLength(11);
    const base = {
      ...knockdownPose(
        0,
        tuning.enemies.knockdownStunS,
        tuning.vfx.enemyKnockdown,
      ),
      neutralWeight: 1,
    };
    const point = (name: string) =>
      scene.getObjectByName('DEF-' + name)!.getWorldPosition(new Vector3());
    const chest = point('spine003');
    for (const side of ['L', 'R']) {
      const restKnee = point('shin' + side);
      const restAnkle = point('foot' + side);
      for (const joint of joints) joint.apply({ ...base, hipFlexDeg: 90 });
      expect(point('shin' + side).distanceTo(chest)).toBeLessThan(
        restKnee.distanceTo(chest),
      );
      expect(point('shin' + side).z).toBeGreaterThan(restKnee.z);
      for (const joint of joints) joint.restore();
      for (const joint of joints) joint.apply({ ...base, kneeFlexDeg: 90 });
      expect(point('foot' + side).z).toBeLessThan(restAnkle.z);
      expect(point('foot' + side).y).toBeGreaterThan(restAnkle.y);
      for (const joint of joints) joint.restore();
      expect(point('foot' + side).distanceTo(restAnkle)).toBeLessThan(1e-6);
    }
  },
);

it.each(['assaulter', 'gunner', 'shielder', 'sniper', 'executor'])(
  '%s: przysiad z kontaktem stopy w widoku po aktualizacji miksera',
  async (kind) => {
    const definition = enemyDefinitions.get(kind)!;
    const bytes = readFileSync(
      new URL(
        '../../public/assets/models/' + definition.model + '.glb',
        import.meta.url,
      ),
    );
    const gltf = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    );
    const loader = vi
      .spyOn(GLTFLoader.prototype, 'loadAsync')
      .mockResolvedValue(gltf);
    const current: EnemySnapshot = {
      state: 'stunned',
      stateTimeS: 0,
      speed: 0,
      distance: 0,
      position: { x: 0, y: 0, z: 0 },
      yaw: 0,
      knockdown: { x: 0, z: -1 },
    };
    const view = new EnemyView({
      id: 1,
      definition,
      current,
      previous: { ...current },
      removed: false,
      step() {},
      dispose() {},
    });
    try {
      await vi.waitFor(() =>
        expect(view.root.getObjectByName('DEF-footL')).toBeDefined(),
      );
      const k = tuning.vfx.enemyKnockdown;
      const timing = knockdownTiming(tuning.enemies.knockdownStunS, k);
      const draw = (v: number) => {
        current.stateTimeS = timing.fallS + timing.lieS + v * timing.kipS;
        view.render(1);
        const skin = view.root.getObjectByName('armored_body')!;
        Reflect.apply(skin.onBeforeRender, skin, []);
      };
      const point = (name: string) =>
        view.root
          .getObjectByName('DEF-' + name)!
          .getWorldPosition(new Vector3());
      draw(k.holdAt);
      const head = point('head');
      for (const side of ['L', 'R'])
        expect(point('hand' + side).distanceTo(head)).toBeLessThan(0.43);
      draw(k.kickAt);
      expect(point('footL').y).toBeGreaterThan(0.4);
      draw(k.landAt);
      const feet = ['L', 'R'].map((side) => point('toe' + side).y);
      if (kind === 'shielder')
        expect(view.root.getObjectByName('shield')?.visible).toBe(false);
      expect(Math.min(...feet)).toBeLessThan(0.08);
      expect(Math.min(...feet)).toBeGreaterThan(-0.05);
      const knee = point('shinL');
      draw(k.landAt);
      expect(point('shinL').distanceTo(knee)).toBeLessThan(1e-6);
    } finally {
      view.dispose();
      loader.mockRestore();
    }
  },
);

it('model proceduralny zgina oba zestawy kończyn, a po wstaniu przywraca ich obrót', () => {
  const definition = enemyDefinitions.get('assaulter')!;
  const k = tuning.vfx.enemyKnockdown;
  const timing = knockdownTiming(tuning.enemies.knockdownStunS, k);
  const current: EnemySnapshot = {
    state: 'stunned',
    stateTimeS: timing.fallS + timing.lieS + timing.kipS * k.holdAt,
    speed: 0,
    distance: 0,
    position: { x: 0, y: 0, z: 0 },
    yaw: 0,
    knockdown: { x: 0, z: -1 },
  };
  const view = new EnemyView(
    {
      id: 1,
      definition,
      current,
      previous: { ...current },
      removed: false,
      step() {},
      dispose() {},
    },
    false,
  );
  try {
    view.render(1);
    for (const side of ['L', 'R']) {
      for (const [name, angle] of [
        ['leg_upper', -k.tuckHipDeg],
        ['leg_lower', k.tuckKneeDeg],
        ['arm_upper', -k.tuckShoulderDeg],
        ['arm_lower', -k.tuckElbowDeg],
      ] as const)
        expect(
          view.root.getObjectByName(name + '_' + side)!.rotation.x,
        ).toBeCloseTo((angle * Math.PI) / 180);
    }
    current.state = 'idle';
    delete current.knockdown;
    view.render(1);
    expect(view.root.getObjectByName('leg_upper_L')!.rotation.x).toBeCloseTo(0);
  } finally {
    view.dispose();
  }
});
