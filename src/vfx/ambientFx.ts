import { Color, Group } from 'three';
import type { Camera } from 'three';
import { Rng } from '../core/rng';
import { tuning } from '../core/tuning';
import { CityParticleBatch } from '../render/city/particles';
import { disposeCityGroup } from '../render/city/resources';
import type { AmbientFxDef } from '../world/dressingSchema';

export class AmbientFx {
  readonly root = new Group();
  readonly steam: CityParticleBatch;
  readonly sparks: CityParticleBatch;
  readonly drips: CityParticleBatch;
  readonly splashes: CityParticleBatch;
  private readonly rng: Rng;
  private readonly emitters: { def: AmbientFxDef; next: number }[];
  private readonly steamColor = new Color();
  private disposed = false;

  constructor(
    defs: readonly AmbientFxDef[],
    private readonly floorY = 0,
    seed: string | number = 'city-ambient',
  ) {
    this.rng = new Rng(seed);
    const t = tuning.city;
    this.steam = new CityParticleBatch(t.steamMax, 'steam', t.steamOpacity);
    this.sparks = new CityParticleBatch(t.sparkMax, 'spark', 1);
    this.drips = new CityParticleBatch(t.dripMax, 'drop', t.rainOpacity);
    this.splashes = new CityParticleBatch(
      t.dripSplashMax,
      'ring',
      t.rainOpacity,
    );
    for (const batch of [this.steam, this.sparks, this.drips, this.splashes])
      batch.mesh.userData.noOutline = true;
    this.root.add(
      this.steam.mesh,
      this.sparks.mesh,
      this.drips.mesh,
      this.splashes.mesh,
    );
    this.emitters = defs.map((def) => ({ def, next: this.rng.float(0, 1) }));
  }

  update(dtWorldS: number, _dtRealS: number, camera: Camera): void {
    if (this.disposed) return;
    const dt = Math.max(0, dtWorldS),
      t = tuning.city;
    this.steam.setOpacity(t.steamOpacity);
    this.drips.setOpacity(t.rainOpacity);
    this.splashes.setOpacity(t.rainOpacity);
    this.steam.pool.step(dt);
    this.sparks.pool.step(dt, t.sparkGravity);
    this.drips.pool.step(dt, t.sparkGravity);
    this.splashes.pool.step(dt);
    for (const p of this.sparks.pool.particles)
      if (p.life > 0 && p.y < this.floorY) {
        p.y = this.floorY + t.surfaceOffsetM;
        p.vy = Math.abs(p.vy) * t.sparkBounce;
      }
    for (const p of this.drips.pool.particles)
      if (p.life > 0 && p.y <= this.floorY) {
        const ring = this.splashes.pool.spawn(t.rainSplashLifeS);
        ring.x = p.x;
        ring.y = this.floorY + t.surfaceOffsetM;
        ring.z = p.z;
        ring.size = t.rainSplashRadiusM;
        ring.color = p.color;
        // ParticlePool owns its active count; expire via step on the next update.
        p.age = p.life;
        p.size = 0;
        p.y = this.floorY + t.surfaceOffsetM;
      }
    if (dt > 0)
      for (const emitter of this.emitters) {
        const { def } = emitter;
        const rate =
          def.rate ??
          (def.kind === 'steam'
            ? t.steamRate
            : def.kind === 'sparks'
              ? t.sparkBurstRate
              : t.dripRate);
        if (!(rate > 0)) continue;
        emitter.next -= dt;
        // Cap catch-up work by the relevant pool capacity after a long frame.
        const batch =
          def.kind === 'steam'
            ? this.steam
            : def.kind === 'sparks'
              ? this.sparks
              : this.drips;
        let emissions = 0;
        while (emitter.next <= 0 && emissions++ < batch.pool.capacity) {
          emitter.next +=
            (def.kind === 'sparks' ? this.rng.float(0.5, 1.5) : 1) / rate;
          const count =
            def.kind === 'sparks'
              ? Math.min(batch.pool.capacity, Math.floor(t.sparkBurstCount))
              : 1;
          for (let i = 0; i < count; i++) {
            const life =
              def.kind === 'steam'
                ? t.steamLifeS
                : def.kind === 'sparks'
                  ? t.sparkLifeS
                  : t.dripLifeS;
            const p = batch.pool.spawn(life);
            p.x = def.position.x;
            p.y = def.position.y;
            p.z = def.position.z;
            if (def.kind === 'steam') {
              p.x += this.rng.float(-t.steamSpreadM, t.steamSpreadM);
              p.z += this.rng.float(-t.steamSpreadM, t.steamSpreadM);
              p.vy = t.steamRiseMS;
              p.vx = this.rng.float(-t.steamDriftMS, t.steamDriftMS);
              p.size = t.steamSizeM;
              p.color = this.steamColor.set(t.steamColor).getHex();
            } else if (def.kind === 'sparks') {
              p.vx = this.rng.float(-1, 1) * t.sparkSpeedMS;
              p.vy = this.rng.float(0.2, 1) * t.sparkSpeedMS;
              p.vz = this.rng.float(-1, 1) * t.sparkSpeedMS;
              p.size = t.sparkSizeM;
              p.color = 0xffae1a;
            } else {
              p.vy = -t.dripSpeedMS;
              p.size = t.dripSizeM;
              p.color = 0xc8c5d9;
            }
          }
        }
        if (emitter.next <= 0) emitter.next = 1 / rate;
      }
    this.steam.render(camera, t.steamGrowth);
    this.sparks.render(camera);
    this.drips.render(camera);
    this.splashes.render(camera, t.splashGrowth);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const batch of [this.steam, this.sparks, this.drips, this.splashes])
      batch.pool.clear();
    disposeCityGroup(this.root);
  }
}
