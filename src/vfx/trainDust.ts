import type { Vec3 } from '../core/math';
import type { Rng } from '../core/rng';
import type { Tuning } from '../core/tuning';
import type { HubLayout } from '../world/hubSchema';

/** Stała pula; step/burst/odczyt nie alokują obiektów cząstek. */
export class TrainDust {
  readonly particles: {
    x: number;
    y: number;
    z: number;
    previousY: number;
    vy: number;
    vx: number;
    vz: number;
    previousX: number;
    previousZ: number;
    age: number;
  }[];
  constructor(
    private readonly rng: Rng,
    private readonly t: Tuning['hub'],
    private readonly layout: HubLayout,
  ) {
    this.particles = Array.from(
      { length: Math.max(0, Math.floor(t.trainDustMax)) },
      () => ({
        x: 0,
        y: 0,
        z: 0,
        previousX: 0,
        previousY: 0,
        previousZ: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        age: Infinity,
      }),
    );
  }

  burst(player: Vec3): void {
    const { t, rng } = this;
    const count = Math.min(this.particles.length, Math.floor(t.trainDustCount));
    let x = player.x,
      z = player.z;
    for (let i = 0; i < count; i++) {
      if (i % Math.max(1, Math.ceil(count / t.trainDustClusters)) === 0) {
        x = player.x + rng.float(-t.trainDustRadiusM, t.trainDustRadiusM);
        z = player.z + rng.float(-t.trainDustRadiusM, t.trainDustRadiusM);
      }
      const p = this.particles[i]!;
      p.x = p.previousX =
        x + rng.float(-t.trainDustSpreadM, t.trainDustSpreadM);
      p.z = p.previousZ =
        z + rng.float(-t.trainDustSpreadM, t.trainDustSpreadM);
      let ceiling = this.layout.playerSpawn.y + t.trainDustCeilingM;
      for (const block of this.layout.blocks) {
        const bottom = block.position.y - block.size.y / 2;
        if (
          bottom > player.y &&
          bottom < ceiling &&
          Math.abs(p.x - block.position.x) <= block.size.x / 2 &&
          Math.abs(p.z - block.position.z) <= block.size.z / 2
        )
          ceiling = bottom;
      }
      p.y = p.previousY = ceiling - t.trainDustCeilingGapM;
      p.vx = rng.float(-t.trainDustDriftMS, t.trainDustDriftMS);
      p.vz = rng.float(-t.trainDustDriftMS, t.trainDustDriftMS);
      p.vy = -t.trainDustFallMS;
      p.age = 0;
    }
  }

  step(dt: number): void {
    if (!(dt > 0)) return;
    for (const p of this.particles) {
      if (p.age >= this.t.trainDustLifeS) continue;
      p.previousX = p.x;
      p.previousY = p.y;
      p.previousZ = p.z;
      p.age += dt;
      p.vy += this.t.trainDustGravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y <= this.layout.playerSpawn.y) p.age = Infinity;
    }
  }
}
