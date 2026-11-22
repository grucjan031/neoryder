import { DirectionalLight, Group, HemisphereLight } from 'three';
import { tuning } from '../core/tuning';

export class StyleLights extends Group {
  readonly hemisphere = new HemisphereLight(0xffffff, 0xffffff);
  readonly key = new DirectionalLight(0xffffff);

  constructor() {
    super();
    this.key.position.set(6, 10, 4);
    this.add(this.hemisphere, this.key, this.key.target);
    this.sync();
  }

  sync(scale = 1): void {
    this.hemisphere.color.set(tuning.render.hemiSky);
    this.hemisphere.groundColor.set(tuning.render.hemiGround);
    this.key.color.set(tuning.render.keyColor);
    this.hemisphere.intensity = tuning.render.hemiIntensity * scale;
    this.key.intensity = tuning.render.keyIntensity * scale;
  }
}

export function createStyleLights(): StyleLights {
  return new StyleLights();
}
