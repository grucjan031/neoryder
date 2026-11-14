import { Color } from 'three';
import type { Scene } from 'three';
import { tuning } from '../core/tuning';
import { Panorama } from './panorama';
import { applyTheme, resolveTheme } from './themes';

export class SceneAtmosphere {
  readonly theme;
  private readonly restore: () => void;
  private readonly background;
  private readonly previousFloor: unknown;
  private panorama?: Panorama;
  private disposed = false;
  constructor(
    private readonly scene: Scene,
    themeId: string | undefined,
    private readonly seed: string,
    private readonly floorY: number,
  ) {
    this.theme = resolveTheme(themeId);
    this.background = scene.background;
    this.previousFloor = scene.userData.reflectionFloorY;
    this.restore = applyTheme(this.theme);
    scene.background = new Color(tuning.render.world);
    scene.userData.reflectionFloorY = floorY;
    this.sync(0);
  }
  sync(dt: number): void {
    if (this.disposed) return;
    if (!this.panorama && tuning.render.panoramaEnabled > 0) {
      this.panorama = new Panorama(this.seed, this.floorY);
      this.scene.add(this.panorama);
    }
    this.panorama?.sync(dt);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.panorama?.dispose();
    this.scene.background = this.background;
    if (this.previousFloor === undefined)
      delete this.scene.userData.reflectionFloorY;
    else this.scene.userData.reflectionFloorY = this.previousFloor;
    this.restore();
  }
}
