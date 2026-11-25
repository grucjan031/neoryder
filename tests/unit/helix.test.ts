import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { difficultyArena, baselineProfile } from './difficultyHarness';
import { simulate } from '../../src/balance/simulator';
import { plasmaBladeDefinition } from '../../src/combat/melee/bladeSchema';
import { weaponDefinitions } from '../../src/combat/weapons/weaponSchema';
import gunner from '../../src/data/enemies/gunner.json';
import { enemySchema } from '../../src/enemies/enemySchema';
import guard from '../../src/data/enemies/helixGuard.json';
import medic from '../../src/data/enemies/helixMedic.json';

describe('Helixa Dynamics', () => {
  it('waliduje dane i ogranicza budżet modeli', () => {
    expect(enemySchema.safeParse({ ...medic, medic: undefined }).success).toBe(
      false,
    );
    for (const raw of [guard, medic]) {
      const d = enemySchema.parse(raw);
      expect(d.missionOnly).toBe(true);
      const bytes = readFileSync('public/assets/models/' + d.model + '.glb');
      const gltf = JSON.parse(
        bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
      ) as {
        skins: { joints: number[] }[];
        nodes: { name: string }[];
        animations: { name: string }[];
        meshes: { primitives: { indices: number }[] }[];
        accessors: { count: number }[];
      };
      expect(gltf.skins[0]?.joints).toHaveLength(53);
      const equipment =
        d.kind === 'medic'
          ? ['filter_L', 'filter_R', 'case_glass', 'syringe', 'coat_frontL']
          : ['id_stripe', 'pauldron_L', 'rifle', 'muzzle'];
      expect(gltf.nodes.map((n) => n.name)).toEqual(
        expect.arrayContaining([
          'visor',
          'sealed_mask',
          'hand_R',
          ...equipment,
        ]),
      );
      expect(gltf.animations.map((a) => a.name)).toEqual(
        expect.arrayContaining(['Walk_Loop', 'Jog_Fwd_Loop', 'Hit_Chest']),
      );
      const tris = gltf.meshes
        .flatMap((m) => m.primitives)
        .reduce((n, p) => n + gltf.accessors[p.indices]!.count / 3, 0);
      expect(tris).toBeLessThanOrEqual(6000);
    }
  });
  it('TTK pojedynczego celu z karabinu i pistoletu rośnie, z ostrza mieści się w limicie', () => {
    const base = enemySchema.parse(gunner),
      armored = enemySchema.parse(guard);
    for (const id of ['rifle', 'pistol']) {
      const attack = {
        kind: 'weapon' as const,
        definition: weaponDefinitions.get(id)!,
      };
      const ratio =
        simulate(attack, armored).ttkS / simulate(attack, base).ttkS;
      expect(ratio).toBeGreaterThanOrEqual(1.6);
      expect(ratio).toBeLessThanOrEqual(2);
    }
    for (const mode of ['combo', 'heavy'] as const) {
      const blade = {
        kind: 'blade' as const,
        definition: plasmaBladeDefinition,
        mode,
      };
      expect(simulate(blade, armored).ttkS).toBeLessThanOrEqual(
        1.2 * simulate(blade, base).ttkS,
      );
    }
  });
  it('pancerz skaluje pociski i ostrze we wspólnym systemie obrażeń', async () => {
    const a = await difficultyArena('normal', 'armor', false, baselineProfile);
    try {
      const g = a.spawn('helixGuard', { x: 0, y: 0, z: 10 });
      for (const [tag, factor] of [
        ['#gun', guard.damageTakenScale.ranged],
        ['#melee', guard.damageTakenScale.melee],
      ] as const)
        expect(
          a.damage.deal(g.id, { source: a.player, tags: [tag], amount: 10 }),
        ).toBeCloseTo(10 * factor);
    } finally {
      a.dispose();
    }
  });
  it('utrzymuje pasmo, rzuca po zamachu i odnowieniu, ucieka z bliska', async () => {
    const a = await difficultyArena('normal', 'rzut', false, baselineProfile);
    try {
      const e = a.spawn('helixMedic', { x: 0, y: 0, z: -13 });
      a.step(30);
      expect(e.current.state).toBe('telegraph');
      expect(e.current.position.z).toBeCloseTo(-13, 1);
      a.step(50);
      expect(a.manager.medicFog.flights).toHaveLength(1);
      a.step(140);
      expect(a.manager.medicFog.zones).toHaveLength(1);
      expect(a.manager.medicFog.flights).toHaveLength(0);
      a.step(255);
      expect(
        a.manager.medicFog.flights.length + a.manager.medicFog.zones.length,
      ).toBeGreaterThan(0);
      a.position.z = e.current.position.z + 1;
      const z = e.current.position.z;
      a.step(30);
      expect(e.current.position.z).toBeLessThan(z - 0.5);
    } finally {
      a.dispose();
    }
  });
  it('łuk wymaga wolnej drogi, zasięgu i podłoża; ogranicza nakładające się strefy', async () => {
    const a = await difficultyArena('normal');
    try {
      const d = enemySchema.parse(medic),
        fog = a.manager.medicFog;
      const launch = (z: number) =>
        fog.launch(null, { x: 0, y: 1.5, z }, a.position, undefined, d);
      expect(launch(-18)).toBe(false);
      for (let i = 0; i < a.t.enemies.medic.maxZones + 2; i++) {
        expect(launch(-1)).toBe(true);
        a.step(8);
      }
      expect(fog.zones).toHaveLength(a.t.enemies.medic.maxZones);
      a.obstacle({ x: 0, y: 3, z: -6 }, { x: 3, y: 6, z: 1 });
      a.world.step();
      expect(launch(-12)).toBe(false);
    } finally {
      a.dispose();
    }
  });
});
