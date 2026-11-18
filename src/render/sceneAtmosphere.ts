import { Color, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import type { Box3, PerspectiveCamera, Scene } from 'three';
import { tuning } from '../core/tuning';
import { Panorama } from './panorama';
import { horizonParameters, type WorldEnvelope } from './horizon';
import { applyTheme, resolveTheme } from './themes';

export class SceneAtmosphere {
  readonly theme;
  private readonly restore: () => void;
  private readonly background;
  private readonly previousFloor: unknown;
  private readonly previousClip: { near: number; far: number } | undefined;
  private ground?: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private waterPlane?: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private panorama?: Panorama;
  private disposed = false;
  constructor(
    private readonly scene: Scene,
    themeId: string | undefined,
    private readonly seed: string,
    private readonly floorY: number,
    private readonly panoramaExclusion?: Box3,
    private readonly envelope?: WorldEnvelope,
    private readonly camera?: PerspectiveCamera,
    private readonly water?: { shoreZ: number; y: number; color: string },
  ) {
    this.previousClip = camera && { near: camera.near, far: camera.far };
    this.theme = resolveTheme(themeId);
    this.background = scene.background;
    this.previousFloor = scene.userData.reflectionFloorY;
    this.restore = applyTheme(this.theme);
    scene.background = new Color(tuning.render.world);
    scene.userData.reflectionFloorY = floorY;
    this.sync(0);
  }
  horizon() {
    return (
      this.envelope &&
      horizonParameters(this.envelope, {
        nearM: tuning.render.fogNear,
        farM: tuning.render.fogFar,
      })
    );
  }
  sync(dt: number): void {
    if (this.disposed) return;
    const horizon = this.horizon();
    if (
      horizon &&
      this.camera &&
      (this.camera.near !== horizon.near || this.camera.far !== horizon.far)
    ) {
      this.camera.near = horizon.near;
      this.camera.far = horizon.far;
      this.camera.updateProjectionMatrix();
    }
    this.scene.userData.horizon = horizon?.expanded ? horizon : undefined;
    if (horizon?.expanded) {
      if (!this.ground) {
        this.ground = new Mesh(
          new PlaneGeometry(2, 2),
          new MeshBasicMaterial(),
        );
        this.ground.name = 'outer-ground';
        this.ground.rotation.x = -Math.PI / 2;
        this.scene.add(this.ground);
      }
      this.ground.position.set(
        horizon.center.x,
        this.envelope!.bounds.min.y - tuning.horizon.groundOffsetM,
        horizon.center.z,
      );
      this.ground.scale.setScalar(horizon.far + horizon.radiusM);
      this.ground.material.color.set(tuning.horizon.groundColor);
      if (this.water) {
        if (!this.waterPlane) {
          this.waterPlane = new Mesh(
            new PlaneGeometry(1, 1),
            new MeshBasicMaterial({ color: this.water.color }),
          );
          this.waterPlane.name = 'outer-water';
          this.waterPlane.rotation.x = -Math.PI / 2;
          this.scene.add(this.waterPlane);
        }
        const extent = horizon.far + horizon.radiusM;
        this.waterPlane.position.set(
          horizon.center.x,
          this.water.y,
          this.water.shoreZ + extent / 2,
        );
        this.waterPlane.scale.set(2 * extent, extent, 1);
      }
      (this.scene.background as Color).set(tuning.render.fogColor);
    } else if (this.ground) {
      (this.scene.background as Color).set(tuning.render.world);
    }
    if (this.ground) this.ground.visible = !!horizon?.expanded;
    if (this.waterPlane) this.waterPlane.visible = !!horizon?.expanded;
    if (!this.panorama && tuning.render.panoramaEnabled > 0) {
      this.panorama = new Panorama(
        this.seed,
        this.floorY,
        this.panoramaExclusion,
      );
      this.scene.add(this.panorama);
    }
    this.panorama?.sync(dt, horizon);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.panorama?.dispose();
    this.ground?.removeFromParent();
    this.ground?.geometry.dispose();
    this.ground?.material.dispose();
    this.waterPlane?.removeFromParent();
    this.waterPlane?.geometry.dispose();
    this.waterPlane?.material.dispose();
    delete this.scene.userData.horizon;
    if (this.camera && this.previousClip) {
      this.camera.near = this.previousClip.near;
      this.camera.far = this.previousClip.far;
      this.camera.updateProjectionMatrix();
    }
    this.scene.background = this.background;
    if (this.previousFloor === undefined)
      delete this.scene.userData.reflectionFloorY;
    else this.scene.userData.reflectionFloorY = this.previousFloor;
    this.restore();
  }
}
