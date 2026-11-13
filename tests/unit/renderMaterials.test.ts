import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BoxGeometry,
  DataTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  NearestFilter,
} from 'three';
import { tuning } from '../../src/core/tuning';
import {
  applyStyle,
  getMaterial,
  syncMaterials,
} from '../../src/render/materials';
import type { MaterialKind } from '../../src/render/materials';
import { createStyleLights } from '../../src/render/lights';

const mappings: [string, MaterialKind][] = [
  ['mat_world', 'world'],
  ['mat_enemy', 'enemy'],
  ['mat_enemy_glow', 'enemyGlow'],
  ['mat_interactive', 'interactive'],
  ['mat_player_cyan', 'player'],
  ['mat_power_magenta', 'power'],
];
const defaults = { ...tuning.render };

afterEach(() => {
  Object.assign(tuning.render, defaults);
  syncMaterials();
  vi.restoreAllMocks();
});

describe('rejestr materiałów stylu', () => {
  it.each(mappings)('%s mapuje się na współdzielony %s', (name, kind) => {
    const material = getMaterial(kind);
    expect(getMaterial(kind)).toBe(material);
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    mesh.material.name = name;
    applyStyle(mesh);
    expect(mesh.material).toBe(material);
  });

  it('odrzuca nieznany kind, także nazwę z prototypu obiektu', () => {
    for (const kind of ['unknown', 'toString', '__proto__']) {
      expect(() => getMaterial(kind as MaterialKind)).toThrow(Error);
    }
  });

  it.each(['world', 'enemy', 'interactive'] as const)(
    '%s używa toon i dokładnie trzech progów bez interpolacji',
    (kind) => {
      const material = getMaterial(kind);
      expect(material).toBeInstanceOf(MeshToonMaterial);
      const map = (material as MeshToonMaterial).gradientMap as DataTexture;
      expect(map).toBeInstanceOf(DataTexture);
      expect(map.image.width).toBe(3);
      expect(map.image.height).toBe(1);
      expect(new Set(map.image.data).size).toBe(3);
      expect(map.minFilter).toBe(NearestFilter);
      expect(map.magFilter).toBe(NearestFilter);
      expect(map.generateMipmaps).toBe(false);
    },
  );

  it.each(['enemyGlow', 'player', 'power'] as const)(
    '%s jest unlit bez tone mappingu',
    (kind) => {
      expect(getMaterial(kind)).toBeInstanceOf(MeshBasicMaterial);
      expect(getMaterial(kind).toneMapped).toBe(false);
    },
  );

  it('podmienia tablice w zagnieżdżonym drzewie bez zmiany geometrii i jest idempotentny', () => {
    const root = new Group();
    const nested = new Group();
    const geometry = new BoxGeometry();
    const original = mappings.map(([name]) => {
      const material = new MeshBasicMaterial();
      material.name = name;
      return material;
    });
    const disposals = original.map((material) => vi.spyOn(material, 'dispose'));
    const mesh = new Mesh(geometry, original);
    nested.add(mesh);
    root.add(nested);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    applyStyle(root);
    expect(mesh.material).toEqual(
      mappings.map(([, kind]) => getMaterial(kind)),
    );
    expect(mesh.geometry).toBe(geometry);
    applyStyle(root);
    expect(mesh.material).toEqual(
      mappings.map(([, kind]) => getMaterial(kind)),
    );
    expect(warn).not.toHaveBeenCalled();
    for (const dispose of disposals) expect(dispose).not.toHaveBeenCalled();
  });

  it('nieznana nazwa daje world i ostrzega raz na nazwę', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const root = new Group();
    for (const name of ['unknown-a', 'unknown-a', 'unknown-b']) {
      const source = new MeshBasicMaterial();
      source.name = name;
      root.add(new Mesh(new BoxGeometry(), source));
    }
    applyStyle(root);
    for (const child of root.children) {
      expect((child as Mesh).material).toBe(getMaterial('world'));
    }
    expect(warn).toHaveBeenCalledTimes(2);
    applyStyle(root);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it.each(mappings)(
    'syncMaterials aktualizuje kolor %s (%s) w tej samej instancji',
    (_, kind) => {
      const material = getMaterial(kind);
      tuning.render[kind] = '#123456';
      syncMaterials();
      expect(getMaterial(kind)).toBe(material);
      expect(material.color.getHexString()).toBe('123456');
    },
  );

  it('światła czytają strojenie i nie rzucają dynamicznych cieni', () => {
    const lights = createStyleLights();
    tuning.render.hemiIntensity = 0.8;
    tuning.render.keyIntensity = 2;
    lights.sync();
    expect(lights.hemisphere.intensity).toBe(0.8);
    expect(lights.key.intensity).toBe(2);
    expect(lights.key.position.y).toBeGreaterThan(0);
    expect(lights.key.castShadow).toBe(false);
  });
});
