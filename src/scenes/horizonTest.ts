import { Euler, Vector3 } from 'three';
import type { Scene as ThreeScene } from 'three';
import type { GameContext } from '../core/context';
import type { InputSnapshot } from '../core/input';
import data from '../data/scenes/horizonTest.json';
import { loadRoom } from '../world/roomSchema';
import type { Scene } from './index';
import { createRoomTest } from './roomTest';
import { mountWeatherControls } from './weatherTest';

const idle: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};

export class HorizonTest implements Scene {
  readonly id = 'horizonTest';
  private readonly room = createRoomTest(false, loadRoom(data));
  private readonly position = new Vector3();
  private readonly movement = new Vector3();
  private readonly rotation = new Euler(0, 0, 0, 'YXZ');
  private ctx!: GameContext;
  private flying = false;
  private controls?: HTMLDivElement;
  private unregister?: () => void;

  async init(ctx: GameContext, three: ThreeScene): Promise<void> {
    this.ctx = ctx;
    await this.room.init(ctx, three);
    ctx.commands?.execute('god');
    this.controls = mountWeatherControls(ctx);
    this.unregister = ctx.commands?.register('fly', 'fly', () => {
      const camera = ctx.camera;
      if (!camera) return 'Brak kamery.';
      this.flying = !this.flying;
      this.position.copy(camera.position);
      this.rotation.setFromQuaternion(camera.quaternion);
      return this.flying ? 'Wolna kamera.' : 'Kamera gracza.';
    });
  }

  step(dt: number, input: InputSnapshot): void {
    this.room.step(dt, this.flying ? idle : input);
    if (!this.flying) return;
    const { held, lookDelta } = input;
    const speed = this.ctx.tuning.horizon.flySpeedMps;
    const sensitivity = this.ctx.tuning.player.lookSensitivity;
    this.rotation.y -= lookDelta.x * sensitivity;
    this.rotation.x = Math.max(
      -Math.PI / 2,
      Math.min(Math.PI / 2, this.rotation.x - lookDelta.y * sensitivity),
    );
    this.movement
      .set(
        Number(held.has('moveRight')) - Number(held.has('moveLeft')),
        0,
        Number(held.has('moveBack')) - Number(held.has('moveForward')),
      )
      .applyEuler(this.rotation);
    this.movement.y += Number(held.has('jump')) - Number(held.has('crouch'));
    this.movement.normalize();
    this.position.addScaledVector(this.movement, speed * dt);
  }

  render(alpha: number, dt = 0): void {
    this.room.render(
      alpha,
      dt,
      this.flying
        ? { position: this.position, rotation: this.rotation }
        : undefined,
    );
  }

  query(name: string): unknown {
    return this.room.query(name);
  }

  dispose(): void {
    this.unregister?.();
    this.controls?.remove();
    this.room.dispose();
  }
}
