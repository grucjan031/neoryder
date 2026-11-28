import { MeshBasicMaterial, MeshStandardMaterial } from 'three';
import type { WebGLProgramParametersWithUniforms } from 'three';
import { assetTexture } from './surfaceTextures';
import { urbanUniforms } from './urbanMaterials';

export type PrintMaterial = MeshStandardMaterial | MeshBasicMaterial;
const PRINT_NAME = /^mat_((label|screen)_[a-z0-9_]+)$/;
const prints = new Map<string, PrintMaterial>();

/** Ekrany (materiały świecące) przygasają razem z siecią; naklejki bez zmian. */
export function syncPrintPower(level: number): void {
  for (const [name, material] of prints)
    if (name.startsWith('mat_screen_')) material.color.setScalar(level);
}

export function isPrintMaterialName(name: string): boolean {
  return PRINT_NAME.test(name);
}

/**
 * Nadruki modeli miejskich mapowane UV: naklejka `mat_label_<x>`
 * (`/assets/textures/labels/label_<x>.webp`, RGBA, odcięcie alfy) albo ekran
 * `mat_screen_<x>` (`/assets/textures/screens/screen_<x>.webp`, świeci w bloomie).
 * Do załadowania tekstury nadruk jest niewidoczny; bez detalu miasta (motyw
 * white) naklejka jest biała, a ekran ciemny.
 */
export function printMaterial(name: string): PrintMaterial | null {
  const match = PRINT_NAME.exec(name);
  if (!match) return null;
  const cached = prints.get(name);
  if (cached) return cached;
  const screen = match[2] === 'screen';
  const offset = {
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  };
  const material: PrintMaterial = screen
    ? new MeshBasicMaterial({ toneMapped: false, ...offset })
    : new MeshStandardMaterial({ roughness: 0.7, alphaTest: 0.5, ...offset });
  material.name = name;
  material.visible = false;
  if (screen) material.userData.bloom = true;
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.cityDetail = urbanUniforms.cityDetail;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float cityDetail;',
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        diffuseColor.rgb = mix(vec3(${screen ? '0.03' : '1.0'}), diffuseColor.rgb, cityDetail);`,
      );
  };
  material.customProgramCacheKey = () =>
    screen ? 'printScreen' : 'printLabel';
  const textureId =
    name === 'mat_label_fusion_director_mug' ? 'label_tritium_cask' : match[1]!;
  assetTexture(screen ? 'screens' : 'labels', textureId, (texture) => {
    material.map = texture;
    if (textureId === 'label_tritium_cask') {
      // UV glTF liczą się od góry. Beczka i kubek dzielą obraz z kartką 0451.
      const mug = name === 'mat_label_fusion_director_mug';
      material.map = texture.clone();
      material.map.offset.set(0.1, mug ? 0.39 : 0.095);
      material.map.repeat.set(0.8, mug ? 0.33 : 0.295);
    }
    material.visible = true;
    material.needsUpdate = true;
  });
  prints.set(name, material);
  return material;
}
