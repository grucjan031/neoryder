import type { Camera, Object3D } from 'three';
import { tuning } from '../../core/tuning';
import { AmbientFx } from '../../vfx/ambientFx';
import { Weather } from '../../vfx/weather';
import type {
  AmbientFxDef,
  CityLightDef,
  DecalDef,
  SignDef,
} from '../../world/dressingSchema';
import type { Theme } from '../themeSchema';
import { DecalRenderer } from './decals';
import { CityLights } from './lights';
import { SignRenderer } from './signs';

export interface DressingLayout {
  signs?: readonly SignDef[];
  lights?: readonly CityLightDef[];
  decals?: readonly DecalDef[];
  ambientFx?: readonly AmbientFxDef[];
}

/**
 * Oprawa miejska pokoju lub areny z danych układu: napisy, światła, naklejki, efekty
 * otoczenia i deszcz z motywu. Czas świata (Skupienie) z `step`, czas klatki z `render`.
 */
export class CityDressing {
  private readonly signs?: SignRenderer;
  private readonly lights?: CityLights;
  private readonly decals?: DecalRenderer;
  private readonly ambient?: AmbientFx;
  readonly weather?: Weather;
  private worldDt = 0;
  private disposed = false;

  constructor(
    parent: Object3D,
    layout: DressingLayout,
    theme: Theme,
    floorY: number,
    seed: string,
  ) {
    const roots: Object3D[] = [];
    if (layout.signs?.length) {
      this.signs = new SignRenderer(layout.signs, `${seed}:signs`);
      roots.push(this.signs.root);
    }
    if (layout.lights?.length) {
      this.lights = new CityLights(layout.lights, floorY);
      roots.push(this.lights.root);
    }
    if (layout.decals?.length) {
      this.decals = new DecalRenderer(layout.decals);
      roots.push(this.decals.root);
    }
    if (layout.ambientFx?.length) {
      this.ambient = new AmbientFx(layout.ambientFx, floorY, `${seed}:ambient`);
      roots.push(this.ambient.root);
    }
    if (theme.rain.enabled) {
      this.weather = new Weather(theme.rain, floorY, `${seed}:rain`);
      this.weather.stormEnabled = theme.rain.storm === true;
      roots.push(this.weather.root);
    }
    for (const root of roots) parent.add(root);
  }

  get active(): boolean {
    return !!(
      this.signs ||
      this.lights ||
      this.decals ||
      this.ambient ||
      this.weather
    );
  }

  /** Czas świata z kroku symulacji. */
  step(dt: number): void {
    if (dt > 0) this.worldDt += dt;
  }

  render(frameDt: number, camera: Camera | undefined): void {
    if (this.disposed || !camera) return;
    const dt = this.worldDt;
    this.worldDt = 0;
    this.signs?.update(dt, frameDt, camera);
    this.lights?.update(dt, frameDt, camera);
    this.decals?.update(dt, frameDt, camera);
    this.ambient?.update(dt, frameDt, camera);
    if (this.weather) {
      this.weather.update(dt, frameDt, camera);
      tuning.render.skyFlash = this.weather.flash * tuning.city.stormFlash;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.signs?.dispose();
    this.lights?.dispose();
    this.decals?.dispose();
    this.ambient?.dispose();
    if (this.weather) {
      this.weather.dispose();
      tuning.render.skyFlash = 0;
    }
  }
}
