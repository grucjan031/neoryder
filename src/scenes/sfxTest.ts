import { BoxGeometry, Color, Group, Mesh } from 'three';
import type { Scene as ThreeScene } from 'three';
import GUI from 'lil-gui';
import type { GameContext } from '../core/context';
import type { InputSnapshot } from '../core/input';
import { createStyleLights } from '../render/lights';
import { getMaterial } from '../render/materials';
import type { Scene } from './index';

/**
 * Odsłuch dźwięków (#14): przycisk lil-gui dla każdego dźwięku z sfx.json oraz demo
 * panoramy. Kontekst audio odblokowuje pierwsze kliknięcie (AudioSystem.attachUnlock).
 */
export class SfxTest implements Scene {
  readonly id = 'sfx-test';
  private ctx!: GameContext;
  private three!: ThreeScene;
  private gui?: GUI;
  private readonly root = new Group();
  private readonly off: (() => void)[] = [];

  init(ctx: GameContext, three: ThreeScene): void {
    this.ctx = ctx;
    this.three = three;
    three.background = new Color(ctx.tuning.render.world);
    const floor = new Mesh(new BoxGeometry(20, 1, 20), getMaterial('world'));
    floor.position.y = -0.5;
    const left = new Mesh(new BoxGeometry(1, 2, 1), getMaterial('enemy'));
    left.position.set(-5, 1, -4);
    const right = left.clone();
    right.position.x = 5;
    this.root.add(createStyleLights(), floor, left, right);
    three.add(this.root);
    if (ctx.camera) {
      ctx.camera.position.set(0, 1.6, 4);
      ctx.camera.rotation.set(-0.1, 0, 0, 'YXZ');
    }

    const audio = ctx.audio;
    if (typeof document !== 'undefined' && audio) {
      this.gui = new GUI({ title: 'Dźwięki (kliknij, by odsłuchać)' });
      this.gui.domElement.style.left = '12px';
      this.gui.domElement.style.right = 'auto';
      const actions: Record<string, () => void> = {};
      for (const name of audio.soundNames) {
        actions[name] = () =>
          audio.play(name, { point: { x: 0, y: 1, z: -3 } });
        this.gui.add(actions, name);
      }
      const spatial = {
        'trafienie z lewej': () =>
          audio.play('hitLight', { point: { x: -5, y: 1, z: -4 } }),
        'trafienie z prawej': () =>
          audio.play('hitLight', { point: { x: 5, y: 1, z: -4 } }),
        'zabójstwo daleko': () =>
          audio.play('kill', { point: { x: 0, y: 1, z: -30 } }),
      };
      const folder = this.gui.addFolder('Przestrzeń');
      for (const key of Object.keys(spatial))
        folder.add(spatial, key as keyof typeof spatial);
    }
    const off = ctx.commands?.register(
      'sfx',
      'sfx <nazwa> — odtwórz dźwięk',
      (args) => {
        const name = args[0] ?? '';
        if (!audio) return 'Brak systemu audio.';
        if (!audio.soundNames.includes(name))
          return `Znane: ${audio.soundNames.join(', ')}`;
        return audio.play(name)
          ? `Odtworzono: ${name}`
          : `Nie odtworzono (stan audio: ${audio.state}).`;
      },
    );
    if (off) this.off.push(off);
  }

  step(_dt: number, _input: InputSnapshot): void {
    void _dt;
    void _input;
  }

  render(): void {
    // Statyczna scena — kamera ustawiona w init.
  }

  query(name: string): unknown {
    if (name === 'voices') return this.ctx.audio?.activeVoices ?? 0;
    return undefined;
  }

  dispose(): void {
    for (const off of this.off.splice(0)) off();
    this.gui?.destroy();
    this.three.remove(this.root);
    this.root.clear();
    this.three.background = null;
  }
}
