import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Mesh } from 'three';
import type { Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { weaponDefinitions } from '../../src/combat/weapons/weaponSchema';

describe('modele broni', () => {
  const withModel = [...weaponDefinitions.values()].filter((d) => d.model);

  it('każda broń gracza ma pole model', () => {
    expect(withModel.length).toBe(weaponDefinitions.size);
  });

  it.each(withModel.map((d) => [d.id, d.model] as const))(
    '%s: plik modelu istnieje w public/assets/models',
    (_id, model) => {
      expect(
        existsSync(join('public', 'assets', 'models', `${model}.glb`)),
      ).toBe(true);
    },
  );
});

/** Budżet szlifu komiksowego: bryły z fazami, ale bez drobnicy (docs/assets.md). */
const TRIANGLE_BUDGET = 3000;

async function load(model: string): Promise<Object3D> {
  const bytes = readFileSync(
    join('public', 'assets', 'models', `${model}.glb`),
  );
  const gltf = await new GLTFLoader().parseAsync(
    new Uint8Array(bytes).buffer,
    '',
  );
  return gltf.scene;
}

function triangles(root: Object3D): number {
  let count = 0;
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const geometry = node.geometry;
    count +=
      (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
  });
  return count;
}

describe('modele broni: kontrakt GLB po szlifie', () => {
  const guns = [
    'pistol',
    'blaster',
    'rifle',
    'scatter',
    'sniper_rifle',
    'beam',
    'emp_launcher',
  ];
  const blades = ['plasma_blade', 'blade_twin', 'blade_staff'];

  it.each(guns)('%s: węzły dla kodu i budżet trójkątów', async (model) => {
    const root = await load(model);
    for (const name of [
      'frame',
      'trim',
      'grip',
      'heat_vents',
      'heat_cell',
      'muzzle',
      'support',
    ])
      expect(root.getObjectByName(name), `${model}: ${name}`).toBeDefined();
    expect(triangles(root)).toBeLessThanOrEqual(TRIANGLE_BUDGET);
  });

  it.each(blades)('%s: węzły rękojeści i budżet trójkątów', async (model) => {
    const root = await load(model);
    for (const name of [
      'hilt',
      'grip',
      'trim',
      'emitter_ring',
      'blade',
      'blade_core',
      'blade_tip',
    ])
      expect(root.getObjectByName(name), `${model}: ${name}`).toBeDefined();
    expect(triangles(root)).toBeLessThanOrEqual(TRIANGLE_BUDGET);
  });
});
