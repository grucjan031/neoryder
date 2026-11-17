import type { WebGLRenderer } from 'three';

export interface RenderInfoSnapshot {
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

/**
 * Debug: liczniki renderera z całej ostatniej klatki (wszystkie przebiegi pipeline'u, nie tylko ostatni).
 * Wyłącza `info.autoReset` i zeruje liczniki na początku każdej klatki; profiler robi to samo na końcu klatki.
 */
export class RenderInfoProbe {
  private readonly result: RenderInfoSnapshot = {
    calls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
  };

  constructor(private readonly renderer: WebGLRenderer) {
    renderer.info.autoReset = false;
  }

  beginFrame(): void {
    this.renderer.info.reset();
  }

  /** Wołać po renderze, przed ewentualnym zerowaniem liczników przez profiler. */
  endFrame(): void {
    const { render, memory } = this.renderer.info;
    this.result.calls = render.calls;
    this.result.triangles = render.triangles;
    this.result.geometries = memory.geometries;
    this.result.textures = memory.textures;
  }

  get snapshot(): Readonly<RenderInfoSnapshot> {
    return this.result;
  }
}
