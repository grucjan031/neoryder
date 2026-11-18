import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  COMIC_ALIASES,
  COMIC_SURFACES,
  resolveTextureKey,
} from '../../src/render/comicSurfaces';

describe('comicSurfaces', () => {
  it('w stylu komiksowym podmienia powierzchnie i aliasy dużych aren', () => {
    expect(resolveTextureKey('surfaces', 'brick', true)).toBe(
      'komiks/surfaces/komiks_brick',
    );
    expect(resolveTextureKey('surfaces', 'overpass_concrete', true)).toBe(
      'komiks/surfaces/komiks_concrete',
    );
  });

  it('zostawia maski, barwne zestawy, inne foldery i ?look=off', () => {
    expect(resolveTextureKey('surfaces', 'grime', true)).toBe('surfaces/grime');
    expect(resolveTextureKey('surfaces', 'asphalt_puddles', true)).toBe(
      'surfaces/asphalt_puddles',
    );
    expect(
      resolveTextureKey('surfaces', 'container_corrugated_navy', true),
    ).toBe('surfaces/container_corrugated_navy');
    expect(resolveTextureKey('labels', 'brick', true)).toBe('labels/brick');
    expect(resolveTextureKey('surfaces', 'brick', false)).toBe(
      'surfaces/brick',
    );
  });

  it('każdy cel ma plik komiksowy i oryginał', () => {
    const targets = new Set([...COMIC_SURFACES]);
    for (const [from, to] of Object.entries(COMIC_ALIASES)) {
      expect(COMIC_SURFACES.has(to)).toBe(true);
      expect(existsSync(`public/assets/textures/surfaces/${from}.webp`)).toBe(
        true,
      );
    }
    for (const id of targets) {
      expect(
        existsSync(`public/assets/textures/komiks/surfaces/komiks_${id}.webp`),
      ).toBe(true);
      expect(existsSync(`public/assets/textures/surfaces/${id}.webp`)).toBe(
        true,
      );
    }
  });
});
