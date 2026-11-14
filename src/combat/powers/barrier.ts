import { dot, normalize, scale, sub } from '../../core/math';
import type { ProjectileHit } from '../weapons/projectiles';
import { PowerBase } from './power';
import type { PowerDeps, PowerInput } from './power';
import type { BarrierPowerDefinition } from './powerSchema';

export class BarrierPower extends PowerBase<BarrierPowerDefinition> {
  private remainingS = 0;
  private flashS = 0;
  private offInterceptor: (() => void) | null = null;

  constructor(def: BarrierPowerDefinition, deps: PowerDeps) {
    super(def, deps);
    if (!deps.projectiles) throw new Error('Bariera wymaga ProjectileSystem.');
  }

  override get active(): boolean {
    return this.remainingS > 0;
  }

  get reflectionFlashS(): number {
    return this.flashS;
  }

  override use(): number | null {
    return this.active ? null : super.use();
  }

  override step(dt: number, input: PowerInput): void {
    super.step(dt, { ...input, pressed: input.pressed && !this.active });
  }

  protected override activate(): number {
    this.remainingS = this.def.durationS;
    this.offInterceptor = this.deps.projectiles!.addInterceptor((hit) =>
      this.intercept(hit),
    );
    return 0;
  }

  protected override stepEffect(dt: number): void {
    this.flashS = Math.max(0, this.flashS - dt);
    if (!this.active) return;
    this.remainingS = Math.max(0, this.remainingS - dt);
    if (this.remainingS <= 1e-9) this.resetEffect();
  }

  protected override resetEffect(): void {
    this.remainingS = 0;
    this.flashS = 0;
    this.offInterceptor?.();
    this.offInterceptor = null;
  }

  private intercept(hit: ProjectileHit): boolean {
    if (!this.active || hit.target !== this.deps.owner || hit.team !== 'enemy')
      return false;
    const { dir } = this.deps.aim();
    const incoming = scale(normalize(hit.dir), -1);
    const cosHalf = Math.cos((this.def.arcDeg * Math.PI) / 360);
    if (dot(normalize(dir), incoming) < cosHalf - 1e-9) return false;
    if (!this.deps.energy.spend(this.def.costPerReflect)) {
      this.resetEffect();
      return false;
    }
    const shooter = this.deps
      .targets()
      .find((target) => target.id === hit.owner);
    const toShooter = shooter ? sub(shooter.position, hit.point) : incoming;
    const reflectedDir =
      Math.hypot(toShooter.x, toShooter.y, toShooter.z) > 0
        ? toShooter
        : incoming;
    this.flashS = this.deps.tuning.powers.barrierFlashS;
    this.deps.projectiles!.reflect(
      hit.projectile,
      this.deps.owner,
      'player',
      reflectedDir,
    );
    return true;
  }
}
