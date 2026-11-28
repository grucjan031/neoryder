import GUI from 'lil-gui';
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshToonMaterial,
  Vector3,
} from 'three';
import type { Scene as ThreeScene } from 'three';
import type { GameContext } from '../core/context';
import { tuning } from '../core/tuning';
import { CityDressing } from '../render/city/dressing';
import { disposeCityGroup } from '../render/city/resources';
import { gradientMap } from '../render/materials';
import { resolveTheme } from '../render/themes';
import type { Scene } from './index';

/** Orbiting camera in a 44 × 44 × 19 m hall; no simulation or physics. */
export class ReactorTest implements Scene {
  readonly id = 'reactor-test';
  private readonly root = new Group();
  private readonly target = new Vector3();
  private ctx!: GameContext;
  private three!: ThreeScene;
  private dressing?: CityDressing;
  private gui?: GUI;
  private timeS = 0;
  private previousBackground: ThreeScene['background'] = null;
  private previousAtmosphere?: { skyGradient: number; fogStrength: number };

  init(ctx: GameContext, three: ThreeScene): void {
    this.ctx = ctx;
    this.three = three;
    this.previousBackground = three.background;
    this.previousAtmosphere = {
      skyGradient: tuning.render.skyGradient,
      fogStrength: tuning.render.fogStrength,
    };
    tuning.render.skyGradient = 0;
    tuning.render.fogStrength = 0;
    three.background = new Color('#070b16');
    three.add(this.root);
    const t = tuning.render.fusionReactor;
    const w = t.testHallWidthM,
      h = t.testHallHeightM;
    const metal = new MeshToonMaterial({ color: t.metalColor, gradientMap });
    const trim = new MeshToonMaterial({ color: t.coilColor, gradientMap });
    const box = (
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
      material = metal,
    ): void => {
      const mesh = new Mesh(new BoxGeometry(sx, sy, sz), material);
      mesh.position.set(x, y, z);
      this.root.add(mesh);
    };
    box(0, -0.3, 0, w, 0.6, w);
    box(-w / 2, h / 2, 0, 0.5, h, w);
    box(w / 2, h / 2, 0, 0.5, h, w);
    box(0, h / 2, -w / 2, w, h, 0.5);
    box(0, h / 2, w / 2, w, h, 0.5);
    box(0, h, 0, w, 0.6, w);
    for (let i = -3; i <= 3; i++) {
      box((i * w) / 8, h - 1, 0, 0.5, 1.2, w, trim);
      box(-w / 2 + 0.5, h / 2, (i * w) / 8, 1, h, 0.9, trim);
      box(w / 2 - 0.5, h / 2, (i * w) / 8, 1, h, 0.9, trim);
    }
    const key = new DirectionalLight('#fff1d6', 1.5);
    key.position.set(-8, h - 1, 5);
    this.root.add(new AmbientLight('#56627a', 1.4), key);
    // The same room dressing path used by RoomScene, without loading a run/map.
    const theme = resolveTheme('neonStreet');
    this.dressing = new CityDressing(
      this.root,
      {
        setPieces: [{ kind: 'fusionReactor', position: { x: 0, y: 0, z: 0 } }],
      },
      { ...theme, rain: { ...theme.rain, enabled: false } },
      0,
      'reactor-test',
      ctx.audio,
    );
    if (ctx.debug) {
      this.gui = new GUI({ title: 'Reaktor fuzyjny' });
      this.gui.add(t, 'pulsePeriodS', 0.5, 8).name('Okres pulsu (s)');
      this.gui.add(t, 'brightness', 0, 4).name('Jasność');
      this.gui.add(t, 'arcFrequencyHz', 0, 15).name('Łuki / sekundę');
      this.gui.add(t, 'ringSpeed', 0, 0.5).name('Prędkość pierścieni');
    }
    this.render(1, 0);
  }

  step(): void {}

  render(_alpha: number, frameDt = 0): void {
    this.timeS += Math.max(0, frameDt);
    const t = tuning.render.fusionReactor;
    const camera = this.ctx.camera;
    if (camera) {
      const a = this.timeS * t.testOrbitSpeed;
      camera.position.set(
        Math.sin(a) * t.testOrbitRadiusM,
        t.testOrbitHeightM,
        Math.cos(a) * t.testOrbitRadiusM,
      );
      this.target.set(0, t.chamberHeightM, 0);
      camera.lookAt(this.target);
      camera.updateMatrixWorld();
    }
    this.dressing?.render(frameDt, camera);
  }

  dispose(): void {
    this.gui?.destroy();
    this.dressing?.dispose();
    disposeCityGroup(this.root);
    this.three.background = this.previousBackground;
    if (this.previousAtmosphere)
      Object.assign(tuning.render, this.previousAtmosphere);
  }
}
