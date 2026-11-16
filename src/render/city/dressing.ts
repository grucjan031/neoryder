import type { Camera, Object3D } from 'three';
import { tuning } from '../../core/tuning';
import { getQuality } from '../quality';
import { AmbientFx } from '../../vfx/ambientFx';
import { Weather } from '../../vfx/weather';
import type {
  AmbientFxDef,
  CityLightDef,
  DecalDef,
  DecorDef,
  SignDef,
} from '../../world/dressingSchema';
import type { Theme } from '../themeSchema';
import { DecalRenderer } from './decals';
import { LampCones, lampFixtures, lampLightDefs } from './lamps';
import { CityLights } from './lights';
import { SignRenderer } from './signs';
import { frameProfiler } from '../frameProfiler';

export interface DressingLayout {
  signs?: readonly SignDef[];
  lights?: readonly CityLightDef[];
  decals?: readonly DecalDef[];
  ambientFx?: readonly AmbientFxDef[];
  /** Latarnie z dekoracji dostają stożek światła i światło punktowe. */
  decor?: readonly DecorDef[];
}

/**
 * Oprawa miejska pokoju lub areny z danych układu: napisy, światła, naklejki, efekty
 * otoczenia i deszcz z motywu. Czas świata (Skupienie) z `step`, czas klatki z `render`.
 */
export class CityDressing {
  private readonly signs?: SignRenderer;
  private readonly lights?: CityLights;
  private readonly lamps?: LampCones;
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
      this.signs = new SignRenderer(
        layout.signs,
        `${seed}:signs`,
        undefined,
        layout.lights,
      );
      roots.push(this.signs.root);
    }
    const fixtures = lampFixtures(layout.decor);
    const lightDefs = [...(layout.lights ?? []), ...lampLightDefs(fixtures)];
    if (lightDefs.length) {
      this.lights = new CityLights(lightDefs, floorY);
      roots.push(this.lights.root);
    }
    if (fixtures.length) {
      this.lamps = new LampCones(fixtures);
      roots.push(this.lamps.root);
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
      this.lamps ||
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
    frameProfiler?.begin('city');
    try {
      this.update(frameDt, camera);
    } finally {
      frameProfiler?.end();
    }
  }

  private update(frameDt: number, camera: Camera): void {
    const dt = this.worldDt;
    this.worldDt = 0;
    this.signs?.update(dt, frameDt, camera);
    this.lights?.update(dt, frameDt, camera);
    this.lamps?.update(dt, frameDt, camera);
    this.decals?.update(dt, frameDt, camera);
    this.ambient?.update(dt, frameDt, camera);
    if (this.weather) {
      const density = this.weather.params.density;
      try {
        this.weather.params.density = density * getQuality().rainDensity;
        this.weather.update(dt, frameDt, camera);
      } finally {
        this.weather.params.density = density;
      }
      tuning.render.skyFlash = this.weather.flash * tuning.city.stormFlash;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.signs?.dispose();
    this.lights?.dispose();
    this.lamps?.dispose();
    this.decals?.dispose();
    this.ambient?.dispose();
    if (this.weather) {
      this.weather.dispose();
      tuning.render.skyFlash = 0;
    }
  }
}
