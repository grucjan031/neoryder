import { BoxGeometry, Color, Group, Mesh } from 'three';
import type { Scene as ThreeScene } from 'three';
import type { GameContext } from '../core/context';
import type { Vec3 } from '../core/math';
import { createStyleLights } from '../render/lights';
import { getMaterial } from '../render/materials';
import { DebrisSystem } from '../vfx/debris';
import { DebrisRenderer } from '../vfx/debrisRenderer';
import { EnemyShatter } from '../vfx/enemyShatter';
import type { Scene } from './index';

const directions: readonly Vec3[] = [
  { x: 1, y: 0.35, z: 0 },
  { x: -1, y: 0.2, z: 0 },
  { x: 0, y: 0.35, z: -1 },
  { x: 0, y: 1, z: 0.25 },
];

export class DebrisTest implements Scene {
  readonly id = 'debris-test';
  private readonly root = new Group();
  private readonly lights = createStyleLights();
  private readonly positions = new Map<number, Vec3>();
  private readonly off: (() => void)[] = [];
  private ctx!: GameContext;
  private three!: ThreeScene;
  private previousBackground: ThreeScene['background'] = null;
  private debris!: DebrisSystem;
  private renderer!: DebrisRenderer;
  private shatter!: EnemyShatter;
  private automatic = true;
  private elapsed = 0;
  private nextId = 1;

  init(ctx: GameContext, three: ThreeScene): void {
    this.ctx = ctx;
    this.three = three;
    this.previousBackground = three.background;
    three.background = new Color(ctx.tuning.render.world);
    this.debris = new DebrisSystem({
      maxDebris: ctx.tuning.vfx.maxDebris,
      tuning: ctx.tuning.vfx,
      seed: ctx.rng.fork('debris-test').getState(),
      walls: (pos, dir, dist) => {
        if (dir.z >= 0 || pos.z < -4) return null;
        const hit = (-4 - pos.z) / dir.z;
        const x = pos.x + dir.x * hit;
        const y = pos.y + dir.y * hit;
        return hit >= 0 && hit <= dist && Math.abs(x) <= 8 && y >= 0 && y <= 4
          ? hit
          : null;
      },
    });
    this.renderer = new DebrisRenderer(this.debris);
    this.shatter = new EnemyShatter(ctx.bus, this.debris, {
      positionOf: (id) => this.positions.get(id) ?? null,
      tuning: ctx.tuning,
    });
    const floor = new Mesh(new BoxGeometry(24, 0.2, 20), getMaterial('world'));
    floor.position.y = -0.1;
    const wall = new Mesh(new BoxGeometry(16, 4, 0.3), getMaterial('world'));
    wall.position.set(0, 2, -4.15);
    this.root.add(this.lights, floor, wall, this.renderer.root);
    three.add(this.root);
    const shatterOff = ctx.commands?.register(
      'shatter',
      'shatter [n] — rozbij n wrogów; zatrzymuje pokaz automatyczny do resetu',
      (args) => {
        const count = args[0] === undefined ? 1 : Number(args[0]);
        if (
          args.length > 1 ||
          !Number.isSafeInteger(count) ||
          count < 1 ||
          count > ctx.tuning.vfx.maxDebris
        )
          return `Podaj liczbę od 1 do ${ctx.tuning.vfx.maxDebris}.`;
        this.automatic = false;
        this.kill(count);
        return `Rozpady: ${count}`;
      },
    );
    const perfOff = ctx.commands?.register(
      'perf',
      'perf — 20 rozpadów po 30 odłamków',
      () => {
        this.automatic = false;
        this.debris.clear();
        this.kill(20, true);
        return `Odłamki: ${this.debris.activeCount}`;
      },
    );
    if (shatterOff) this.off.push(shatterOff);
    if (perfOff) this.off.push(perfOff);
    this.render(1);
  }

  private kill(count: number, maximum = false): void {
    for (let i = 0; i < count; i++) {
      const id = this.nextId++;
      const pos = { x: (((id - 1) % 5) - 2) * 1.4, y: 0, z: 0 };
      const dir = directions[(id - 1) % directions.length]!;
      this.positions.set(id, pos);
      this.ctx.bus.emit('entity_spawned', { id, kind: 'debris-dummy' });
      const t = this.ctx.tuning.vfx;
      const amount = maximum
        ? (t.debrisMax - t.debrisMin) / t.debrisPerDamage
        : 12 + (id % 4) * 20;
      this.ctx.bus.emit('damage_dealt', {
        source: null,
        target: id,
        amount,
        tags: ['debug'],
        point: { x: pos.x, y: 1, z: pos.z },
        dir,
        knockback: 2,
        killed: true,
      });
      this.ctx.bus.emit('enemy_killed', { id, killer: null, tags: ['debug'] });
      this.ctx.bus.emit('entity_despawned', { id });
      this.positions.delete(id);
    }
  }

  step(dt: number): void {
    this.debris.step(dt);
    if (!this.automatic || !(dt > 0)) return;
    this.elapsed += dt;
    if (this.elapsed >= 1.2) {
      this.elapsed %= 1.2;
      this.kill(1);
    }
  }

  render(alpha: number): void {
    const camera = this.ctx.camera;
    if (camera) {
      camera.position.set(7, 5, 9);
      camera.lookAt(0, 1, -0.5);
    }
    this.lights.sync();
    this.renderer.render(alpha);
  }

  query(name: string): unknown {
    return name === 'debris' ? this.debris.activeCount : undefined;
  }

  reset(): void {
    this.debris.clear();
    this.automatic = true;
    this.elapsed = 0;
  }

  dispose(): void {
    for (const off of this.off) off();
    this.shatter.dispose();
    this.renderer.dispose();
    this.debris.clear();
    this.positions.clear();
    this.root.traverse((object) => {
      if (object instanceof Mesh) object.geometry.dispose();
    });
    this.root.removeFromParent();
    this.root.clear();
    this.three.background = this.previousBackground;
  }
}
