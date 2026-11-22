import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { Mesh, MeshToonMaterial } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { allyDefinitions } from '../../src/allies/allySchema';
import { tuning } from '../../src/core/tuning';
import { AllyView } from '../../src/render/allyView';

vi.mock('../../src/scenes/hubNpcs', async (original) => {
  const actual = await original<typeof import('../../src/scenes/hubNpcs')>();
  return {
    ...actual,
    loadBody: async () => {
      const bytes = readFileSync('public/assets/models/npc_civilian.glb');
      return (
        await new GLTFLoader().parseAsync(
          bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ),
          '',
        )
      ).scene;
    },
    loadClips: async () => [],
  };
});
vi.mock('../../src/enemies/enemyView', () => ({
  loadEnemyModel: async () => null,
}));
vi.mock('../../src/render/weaponModelLoader', () => ({
  loadWeaponScene: async () => null,
}));

it.each(['nadia', 'szron'])(
  '%s: strój GLB ma kolor z danych i emisję w ciemności',
  async (id) => {
    const definition = allyDefinitions.get(id)!;
    const view = new AllyView(tuning, definition);
    await view.load();
    const jacket = view.root.getObjectByName('top_jacket') as Mesh;
    expect(jacket).toBeInstanceOf(Mesh);
    const material = jacket.material as MeshToonMaterial;
    expect(`#${material.color.getHexString()}`).toBe(
      definition.look.outerColor,
    );
    expect(material.emissiveIntensity).toBeGreaterThan(0);
    let accents = 0;
    view.root.traverse((node) => {
      if (!(node instanceof Mesh) || !node.name.includes('__accent')) return;
      const accent = node.material as MeshToonMaterial;
      expect(accent.emissive.getHexString()).toBe('ffae1a');
      expect(accent.emissiveIntensity).toBeGreaterThan(
        material.emissiveIntensity,
      );
      accents++;
    });
    expect(accents).toBeGreaterThan(0);
    view.dispose();
  },
);
