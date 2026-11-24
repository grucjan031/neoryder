import type { Scene as ThreeScene } from 'three';
import type { GameContext } from '../core/context';
import type { InputSnapshot } from '../core/input';
import { createMemorySaveStore } from '../core/save';
import { loadMapScene } from './mapSceneLoader';
import type { CameraPose, Scene } from './index';

/**
 * TODO: tymczasowa scena „Testy map” — do usunięcia po audycie map.
 * Ładuje mapę z `?map=<id>` z normalnym graczem FPP, bez wrogów.
 */
export class MapWalkScene implements Scene {
  readonly id = 'map-walk';
  private inner?: Scene;
  private mapId = '';

  async init(ctx: GameContext, three: ThreeScene) {
    const params = new URLSearchParams(location.search);
    const id = params.get('map');
    if (!id) throw new Error('Podaj identyfikator mapy w parametrze map.');
    this.mapId = id;
    const { scene } = await loadMapScene(
      id,
      params,
      createMemorySaveStore(),
      true,
    );
    this.inner = scene;
    await scene.init(ctx, three);
  }
  step(dt: number, input: InputSnapshot) {
    this.inner?.step(dt, input);
  }
  render(alpha: number, frameDt?: number, cameraOverride?: CameraPose) {
    this.inner?.render(alpha, frameDt, cameraOverride);
  }
  query(name: string) {
    if (name === 'walkMap') return this.mapId;
    return this.inner?.query?.(name);
  }
  reset() {
    this.inner?.reset?.();
  }
  dispose() {
    this.inner?.dispose();
  }
}
