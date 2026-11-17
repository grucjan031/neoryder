import type { Camera, Object3D } from 'three';
import { tuning } from '../../core/tuning';
import { getQuality } from '../quality';
import { getLiteFx } from '../fxMode';
import { AmbientFx } from '../../vfx/ambientFx';
import { Weather } from '../../vfx/weather';
import type {
  AmbientFxDef,
  CityLightDef,
  DecalDef,
  DecorDef,
  RainShelterDef,
  SignDef,
} from '../../world/dressingSchema';
import type { Theme } from '../themeSchema';
import { DecalRenderer } from './decals';
import { LampCones, lampFixtures, lampLightDefs } from './lamps';
import { CityLights } from './lights';
import { SignRenderer } from './signs';
import { frameProfiler } from '../frameProfiler';
import type { AudioSystem } from '../../audio/audioSystem';
import { weatherDefinitions } from '../weatherSchema';
import { urbanUniforms } from '../urbanMaterials';

export interface DressingLayout {
  weather?: string;
  signs?: readonly SignDef[];
  lights?: readonly CityLightDef[];
  decals?: readonly DecalDef[];
  ambientFx?: readonly AmbientFxDef[];
  rainShelters?: readonly RainShelterDef[];
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
  weather?: Weather;
  weatherId?: string;
  private restoreWeather?: () => void;
  private worldDt = 0;
  private disposed = false;

  constructor(
    private readonly parent: Object3D,
    private readonly layout: DressingLayout,
    theme: Theme,
    private readonly floorY: number,
    private readonly seed: string,
    private readonly audio?: Pick<
      AudioSystem,
      'setAmbience' | 'updateAmbienceSource'
    >,
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
      this.lights = new CityLights(lightDefs, floorY, `${seed}:lights`);
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
    if (layout.ambientFx?.length && !getLiteFx()) {
      this.ambient = new AmbientFx(layout.ambientFx, floorY, `${seed}:ambient`);
      roots.push(this.ambient.root);
    }
    if (theme.rain.enabled && !getLiteFx()) {
      this.weather = new Weather(
        theme.rain,
        floorY,
        `${seed}:rain`,
        layout.rainShelters,
      );
      this.weather.stormEnabled = theme.rain.storm === true;
      roots.push(this.weather.root);
    }
    for (const root of roots) parent.add(root);
    if (layout.weather && !this.setWeather(layout.weather))
      throw new Error(`Nieznana pogoda: ${layout.weather}`);
  }

  setWeather(id: string): boolean {
    const profile = weatherDefinitions.get(id);
    if (!profile || this.disposed) return false;
    if (!this.restoreWeather) {
      const r = tuning.render;
      const previous = {
        fogColor: r.fogColor,
        heightFogDensity: r.heightFogDensity,
        heightFogFalloff: r.heightFogFalloff,
        fogStrength: r.fogStrength,
        fogNear: r.fogNear,
        fogFar: r.fogFar,
        reflectionStrength: r.reflectionStrength,
        reflectionPuddles: r.reflectionPuddles,
      };
      const gloss = urbanUniforms.weatherGloss.value;
      const flashColor = tuning.weather.skyFlashColor;
      this.restoreWeather = () => {
        Object.assign(tuning.render, previous);
        urbanUniforms.weatherGloss.value = gloss;
        tuning.weather.skyFlashColor = flashColor;
        this.audio?.setAmbience(null);
      };
    }
    this.weatherId = id;
    if (!getLiteFx()) {
      if (!this.weather) {
        this.weather = new Weather(
          {},
          this.floorY,
          `${this.seed}:rain`,
          this.layout.rainShelters,
        );
        this.parent.add(this.weather.root);
      }
      this.weather.setProfile(profile);
    }
    Object.assign(tuning.render, {
      fogColor: profile.fog.color,
      heightFogDensity: profile.fog.density,
      heightFogFalloff: 1 / profile.fog.heightM,
      fogStrength: profile.fog.strength,
      fogNear: profile.fog.nearM,
      fogFar: profile.fog.farM,
      reflectionStrength: profile.surface.reflections,
      reflectionPuddles: profile.surface.puddles,
    });
    urbanUniforms.weatherGloss.value =
      profile.surface.gloss * tuning.weather.wetRoughnessScale;
    tuning.weather.skyFlashColor = profile.lightning.color;
    this.audio?.setAmbience(
      profile.ambience.map((a) => ({ ...a, position: { x: 0, y: 0, z: 0 } })),
    );
    return true;
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
    if (this.weatherId && this.audio) {
      const profile = weatherDefinitions.get(this.weatherId)!;
      profile.ambience.forEach((a, index) =>
        this.audio!.updateAmbienceSource(index, camera.position, a.gain),
      );
    }
    if (this.weather) {
      const density = this.weather.params.density;
      try {
        this.weather.params.density = density * getQuality().rainDensity;
        this.weather.update(dt, frameDt, camera);
      } finally {
        this.weather.params.density = density;
      }
      tuning.render.skyFlash =
        this.weather.flash * (this.weatherId ? 1 : tuning.city.stormFlash);
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
    this.restoreWeather?.();
  }
}
