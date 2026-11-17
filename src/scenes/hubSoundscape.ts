import { BoxGeometry, InstancedMesh, MeshBasicMaterial, Object3D } from 'three';
import type { GameContext } from '../core/context';
import type { Vec3 } from '../core/math';
import { loadAmbience } from '../audio/ambienceSchema';
import ambienceData from '../data/hub/ambience.json';
import { hubAmbienceSources } from '../world/hubAmbience';
import type { HubLayout } from '../world/hubSchema';
import { HubTrain } from '../world/hubTrain';
import { TrainDust } from '../vfx/trainDust';

/** Podpięcie audio i kosmetyki bez zależności od NPC i modułu renderującego. */
export class HubSoundscape {
  private readonly train: HubTrain;
  private readonly dust: TrainDust;
  private readonly mesh: InstancedMesh;
  private readonly transform = new Object3D();
  private readonly off?: () => void;

  constructor(
    private readonly ctx: GameContext,
    parent: Object3D,
    layout: HubLayout,
  ) {
    this.train = new HubTrain(
      ctx.rng.fork('hub-train'),
      ctx.tuning.hub,
      ctx.bus,
    );
    this.dust = new TrainDust(
      ctx.rng.fork('hub-train-dust'),
      ctx.tuning.hub,
      layout,
    );
    this.mesh = new InstancedMesh(
      new BoxGeometry(1, 1, 1),
      new MeshBasicMaterial({ color: ctx.tuning.hub.trainDustColor }),
      this.dust.particles.length,
    );
    this.mesh.name = 'hub-train-dust';
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    parent.add(this.mesh);
    ctx.audio?.setAmbience(
      hubAmbienceSources(layout, loadAmbience(ambienceData), ctx.tuning.audio),
    );
    this.off = ctx.commands?.register(
      'hub train',
      'hub train — wymuś przejazd pociągu',
      (args) => {
        if (args.length) return 'Użycie: hub train';
        this.train.force();
        return 'Pociąg przejeżdża za ścianą.';
      },
    );
  }

  step(dt: number, player: Vec3): void {
    if (this.train.step(dt)) this.dust.burst(player);
    this.dust.step(dt);
  }

  render(alpha: number): void {
    const hub = this.ctx.tuning.hub;
    let count = 0;
    for (const p of this.dust.particles) {
      if (p.age >= hub.trainDustLifeS) continue;
      this.transform.position.set(
        p.previousX + (p.x - p.previousX) * alpha,
        p.previousY + (p.y - p.previousY) * alpha,
        p.previousZ + (p.z - p.previousZ) * alpha,
      );
      this.transform.scale.setScalar(
        hub.trainDustSizeM * Math.max(0, 1 - p.age / hub.trainDustLifeS),
      );
      this.transform.updateMatrix();
      this.mesh.setMatrixAt(count++, this.transform.matrix);
    }
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.ctx.audio?.setTrainPass(this.train.progress, hub);
    this.ctx.audio?.updateAmbience(this.ctx.loop.paused);
  }

  query(): unknown {
    return this.ctx.audio?.activeAmbience ?? [];
  }

  dispose(): void {
    this.off?.();
    this.ctx.audio?.setAmbience(null);
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
    this.mesh.dispose();
  }
}
