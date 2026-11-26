import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BoxGeometry,
  DataTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  NearestFilter,
} from 'three';
import type { WebGLProgramParametersWithUniforms, WebGLRenderer } from 'three';
import { tuning } from '../../src/core/tuning';
import {
  applyStyle,
  getMaterial,
  syncMaterials,
} from '../../src/render/materials';
import type { MaterialKind } from '../../src/render/materials';
import { createStyleLights } from '../../src/render/lights';
import {
  createUrbanMaterial,
  portKinds,
  urbanLooks,
  urbanUniforms,
} from '../../src/render/urbanMaterials';
import { surfaceTexture } from '../../src/render/surfaceTextures';
import { applyTheme, themeDefinitions } from '../../src/render/themes';
import { setPowerLevel } from '../../src/render/powerLevel';

const portExpected = {
  container_navy: ['container_corrugated_navy', '283a62'],
  container_olive: ['container_corrugated_olive', '4e5638'],
  container_ochre: ['container_corrugated_ochre', 'a97c26'],
  container_graphite: ['container_corrugated_graphite', '343a44'],
  quay_lines: ['quay_lines', '2a3344'],
  quay_concrete: ['quay_concrete', '56627a'],
  crane_paint: ['crane_paint', 'ffffff'],
  rubber_fender: ['rubber_fender', 'ffffff'],
  steel_grating: ['steel_grating', '4b5462'],
} as const;

const mappings = [
  ['mat_world', 'world'],
  ['mat_enemy', 'enemy'],
  ['mat_enemy_glow', 'enemyGlow'],
  ['mat_interactive', 'interactive'],
  ['mat_player_cyan', 'player'],
  ['mat_power_magenta', 'power'],
] as const satisfies readonly (readonly [string, MaterialKind])[];
const defaults = { ...tuning.render };

afterEach(() => {
  setPowerLevel(1);
  Object.assign(tuning.render, defaults);
  syncMaterials();
  vi.restoreAllMocks();
});

describe('rejestr materiałów stylu', () => {
  it('light_panel zachowuje emisję ciepłej bieli bez bloomu po imporcie i zmianie zasilania', () => {
    const source = new MeshBasicMaterial();
    source.name = 'mat_light_panel';
    const mesh = new Mesh(new BoxGeometry(), source);
    const warn = vi.spyOn(console, 'warn');
    applyStyle(mesh);
    const panel = getMaterial('light_panel') as MeshStandardMaterial;
    const white = getMaterial('light_white');
    expect(mesh.material).toBe(panel);
    expect(panel.toneMapped).toBe(false);
    expect(panel.color.getHex()).toBe(0);
    expect(panel.map).toBeNull();
    for (const power of [1, 0.35, 0, 1]) {
      setPowerLevel(power);
      syncMaterials();
      expect(panel.emissive.equals(white.color)).toBe(true);
      expect(panel.userData.bloom).not.toBe(true);
      expect(white.userData.bloom).toBe(true);
    }
    for (const kind of ['neon_amber', 'neon_green', 'neon_violet'] as const)
      expect(getMaterial(kind).userData.bloom).toBe(true);
    expect(warn).not.toHaveBeenCalled();
    mesh.geometry.dispose();
    source.dispose();
  });
  it('synchronizuje materiał utworzony bezpośrednio przed zmianą motywu', () => {
    applyTheme(themeDefinitions.get('white')!);
    const material = createUrbanMaterial('steel_grating');
    const fixed = createUrbanMaterial('metal', '#263344');
    try {
      const cached = getMaterial('steel_grating');
      syncMaterials();
      expect(material.color.getHexString()).toBe('ffffff');
      expect(cached.color.getHexString()).toBe('ffffff');

      const restore = applyTheme(themeDefinitions.get('neonStreet')!);
      syncMaterials();
      expect(material.color.getHexString()).toBe('4b5462');
      expect(cached.color.getHexString()).toBe('4b5462');
      expect(fixed.color.getHexString()).toBe('263344');

      restore();
      syncMaterials();
      expect(material.color.getHexString()).toBe('ffffff');
      expect(cached.color.getHexString()).toBe('ffffff');
    } finally {
      material.dispose();
      fixed.dispose();
    }
  });
  it.each(portKinds)(
    'port: %s zachowuje teksturę i wspólną mokrość po applyStyle i sync',
    (kind) => {
      applyTheme(themeDefinitions.get('neonStreet')!);
      const [texture, color] = portExpected[kind];
      const source = new MeshBasicMaterial();
      source.name = `mat_${kind}`;
      const mesh = new Mesh(new BoxGeometry(), source);
      const warn = vi.spyOn(console, 'warn');
      applyStyle(mesh);
      const material = mesh.material as unknown as MeshStandardMaterial;
      expect(material).toBeInstanceOf(MeshStandardMaterial);
      expect(material).toBe(getMaterial(kind));
      expect(material.userData.wetness).toBeGreaterThan(0);
      const shader = {
        uniforms: {},
        vertexShader: '#include <common>\n#include <begin_vertex>',
        fragmentShader:
          '#include <common>\n#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>',
      } as unknown as WebGLProgramParametersWithUniforms;
      material.onBeforeCompile(shader, {} as WebGLRenderer);
      expect(shader.uniforms.surfaceMap).toBe(surfaceTexture(texture).map);
      expect(urbanLooks[kind].texture).toBe(texture);
      expect(shader.uniforms.weatherGloss).toBe(urbanUniforms.weatherGloss);
      syncMaterials();
      expect(getMaterial(kind)).toBe(material);
      expect(material.color.getHexString()).toBe(color);
      expect(warn).not.toHaveBeenCalled();
      mesh.geometry.dispose();
      source.dispose();
    },
  );
  it('nawierzchnie portu przejmują kolory motywu, również po ponownej synchronizacji', () => {
    applyTheme(themeDefinitions.get('neonStreet')!);
    const yard = getMaterial('quay_lines');
    const quay = getMaterial('quay_concrete');
    syncMaterials();
    expect(yard.color.getHexString()).toBe('2a3344');
    expect(quay.color.getHexString()).toBe('56627a');
    tuning.render.asphalt = '#182a3c';
    tuning.render.concrete = '#324456';
    syncMaterials();
    expect(yard.color.getHexString()).toBe('182a3c');
    expect(quay.color.getHexString()).toBe('324456');
    applyTheme(themeDefinitions.get('white')!);
    syncMaterials();
    expect(yard.color.getHexString()).toBe('ffffff');
    expect(quay.color.getHexString()).toBe('ffffff');
    expect(getMaterial('container_navy').color.getHexString()).toBe('ffffff');
  });
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
