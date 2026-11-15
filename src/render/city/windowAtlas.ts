/**
 * Okna budynków: wybór komórki atlasu 4×4 (windows_lit / windows_dark) i proporcje okna.
 * Czysta funkcja identyczna z wersją w shaderze fasady (urbanMaterials.ts): losowość
 * wyłącznie z indeksu okna na ścianie, więc wzór jest stały między wczytaniami.
 */
export const WINDOW_ATLAS_GRID = 4;

export interface WindowParams {
  litFraction: number;
  minWidthM: number;
  maxWidthM: number;
  minHeightM: number;
  maxHeightM: number;
}
export interface WindowChoice {
  lit: boolean;
  column: number;
  row: number;
  widthM: number;
  heightM: number;
}

export function windowHash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function windowChoice(
  cellX: number,
  cellY: number,
  params: WindowParams,
): WindowChoice {
  const cells = WINDOW_ATLAS_GRID * WINDOW_ATLAS_GRID;
  const index = Math.min(
    cells - 1,
    Math.floor(windowHash(cellX + 9.1, cellY + 23.7) * cells),
  );
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  return {
    lit: windowHash(cellX, cellY) < params.litFraction,
    column: index % WINDOW_ATLAS_GRID,
    row: Math.floor(index / WINDOW_ATLAS_GRID),
    widthM: lerp(
      params.minWidthM,
      params.maxWidthM,
      windowHash(cellX + 17.3, cellY + 5.1),
    ),
    heightM: lerp(
      params.minHeightM,
      params.maxHeightM,
      windowHash(cellX + 3.7, cellY + 41.9),
    ),
  };
}

/** UV komórki atlasu (początek UV na górze obrazu, flipY=false): [u0, v0, u1, v1]. */
export function windowCellUv(
  column: number,
  row: number,
): [number, number, number, number] {
  const n = WINDOW_ATLAS_GRID;
  return [column / n, row / n, (column + 1) / n, (row + 1) / n];
}
