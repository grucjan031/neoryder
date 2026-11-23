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
import lantern from '../../data/render/lanternString.json';
import {
  LampCones,
  lampFixtures,
  lanternFixtures,
  lampLightDefs,
} from './lamps';
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
  /** Najniższa podłoga opadu i efektów otoczenia; brak = `floorY` sceny. */
  weatherFloorY?: number;
  /** Latarnie z dekoracji dostają stożek światła i światło punktowe. */
  decor?: readonly DecorDef[];
  /**
   * Bryły układu (pokój/arena). Światło poniżej podłogi startu (np. w wykopie)
   * kładzie plamę na najwyższej płaskiej bryle pod sobą zamiast na floorY.
   */
  blocks?: readonly {
    position: { x: number; y: number; z: number };
    size: { x: number; y: number; z: number };
    rotation?: { x: number; y: number; z: number } | undefined;
  }[];
}

/** Wysokości plam świateł: floorY, a dla świateł pod nią wierzch bryły pod światłem. */
export function lightSpotFloors(
  defs: readonly CityLightDef[],
  floorY: number,
  blocks: DressingLayout['blocks'],
): number[] {
  return defs.map(({ position: p }) => {
    if (p.y >= floorY || !blocks) return floorY;
    let best: number | undefined;
    for (const b of blocks) {
      if (b.rotation?.x || b.rotation?.y || b.rotation?.z) continue;
      const top = b.position.y + b.size.y / 2;
      if (
        top <= p.y &&
        (best === undefined || top > best) &&
        Math.abs(p.x - b.position.x) <= b.size.x / 2 &&
        Math.abs(p.z - b.position.z) <= b.size.z / 2
      )
        best = top;
    }
    return best ?? floorY;
  });
}

/**
 * Oprawa miejska pokoju lub areny z danych układu: napisy, światła, naklejki, efekty
 * otoczenia i deszcz z motywu. Czas świata (Skupienie) z `step`, czas klatki z `render`.
 */
export class CityDressing {
  private readonly signs?: SignRenderer;
  private readonly lights?: CityLights;
  private readonly lamps?: LampCones;
  private readonly lanterns?: LampCones;
  private readonly decals?: DecalRenderer;
  private readonly ambient?: AmbientFx;
  weather?: Weather;
  weatherId?: string;
  private baseSkyHorizon = tuning.render.skyHorizon;
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
      this.lights = new CityLights(
        lightDefs,
        lightSpotFloors(lightDefs, floorY, layout.blocks),
        `${seed}:lights`,
      );
      roots.push(this.lights.root);
    }
    if (fixtures.length) {
      this.lamps = new LampCones(fixtures);
      roots.push(this.lamps.root);
    }
    const pendants = lanternFixtures(layout.decor);
    if (pendants.length) {
      this.lanterns = new LampCones(
        pendants,
        lantern.color,
        lantern.opacityScale,
      );
      roots.push(this.lanterns.root);
    }
    if (layout.decals?.length) {
      this.decals = new DecalRenderer(layout.decals);
      roots.push(this.decals.root);
    }
    if (layout.ambientFx?.length && !getLiteFx()) {
      this.ambient = new AmbientFx(
        layout.ambientFx,
        layout.weatherFloorY ?? floorY,
        `${seed}:ambient`,
      );
      roots.push(this.ambient.root);
    }
    if (theme.rain.enabled && !getLiteFx()) {
      this.weather = new Weather(
        theme.rain,
        layout.weatherFloorY ?? floorY,
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
        skyHorizon: r.skyHorizon,
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
      const snowCoverage = urbanUniforms.snowCoverage.value;
      const snowColor = urbanUniforms.snowColor.value.clone();
      this.baseSkyHorizon = r.skyHorizon;
      const flashColor = tuning.weather.skyFlashColor;
      this.restoreWeather = () => {
        Object.assign(tuning.render, previous);
        urbanUniforms.weatherGloss.value = gloss;
        urbanUniforms.snowCoverage.value = snowCoverage;
        urbanUniforms.snowColor.value.copy(snowColor);
        tuning.weather.skyFlashColor = flashColor;
        this.audio?.setAmbience(null);
      };
    }
    this.weatherId = id;
    if (!getLiteFx()) {
      if (!this.weather) {
        this.weather = new Weather(
          {},
          this.layout.weatherFloorY ?? this.floorY,
          `${this.seed}:rain`,
          this.layout.rainShelters,
        );
        this.parent.add(this.weather.root);
      }
      this.weather.setProfile(profile);
    }
    Object.assign(tuning.render, {
      skyHorizon: profile.sky?.horizonColor ?? this.baseSkyHorizon,
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
    urbanUniforms.snowCoverage.value = profile.surface.snowCoverage;
    urbanUniforms.snowColor.value.set(profile.surface.snowColor);
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
      this.lanterns ||
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
    this.lanterns?.update(dt, frameDt, camera);
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
    this.lanterns?.dispose();
    this.decals?.dispose();
    this.ambient?.dispose();
    if (this.weather) {
      this.weather.dispose();
      tuning.render.skyFlash = 0;
    }
    this.restoreWeather?.();
  }
}
