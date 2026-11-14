import { z } from 'zod';
import type { EntityId, EventBus } from '../core/events';
import type { Vec3 } from '../core/math';
import type { Rng } from '../core/rng';

const point = z.object({ x: z.number().finite(), z: z.number().finite() });

export const wavesSchema = z.object({
  id: z.string().min(1),
  /** Przerwa przed pierwszą falą (s). */
  firstBreakS: z.number().finite().nonnegative(),
  /** Przerwa między falami (s). */
  breakS: z.number().finite().nonnegative(),
  /** Limit wrogów żywych naraz (reszta czeka w kolejce). */
  maxAlive: z.number().int().positive(),
  /** Punkt spawnu bliżej gracza niż to jest pomijany, jeśli jest inny. */
  minSpawnDistance: z.number().finite().nonnegative(),
  spawnPoints: z.array(point).min(1),
  waves: z
    .array(
      z.object({
        spawnIntervalS: z.number().finite().positive(),
        groups: z
          .array(
            z.object({
              enemy: z.string().min(1),
              count: z.number().int().positive(),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});
export type WavesDefinition = z.infer<typeof wavesSchema>;

export function loadWaves(data: unknown): WavesDefinition {
  const result = wavesSchema.safeParse(data);
  if (!result.success)
    throw new Error(`Nieprawidłowe dane fal: ${result.error.message}`);
  return result.data;
}

export type WavePhase = 'break' | 'spawning' | 'fighting' | 'done' | 'stopped';

export interface WaveDirectorDeps {
  /** Tworzy wroga danego archetypu w punkcie; zwraca id encji albo null (np. limit ciał). */
  spawn(enemy: string, position: Vec3): EntityId | null;
  playerPosition(): Vec3;
}

/**
 * Reżyser fal areny: kolejka wrogów fali w kolejności losowanej przez Rng (seed runu),
 * spawn co spawnIntervalS z limitem maxAlive, punkt spawnu z dala od gracza.
 * Fala kończy się, gdy kolejka jest pusta i zginął ostatni jej wróg: emituje
 * wave_last_kill (spowolnienie, FeelSystem) i wave_cleared, potem przerwa breakS.
 * Po ostatniej zdefiniowanej fali — faza 'done'.
 */
export class WaveDirector {
  private phase: WavePhase = 'stopped';
  private waveIndex = -1;
  private timerS = 0;
  private queue: string[] = [];
  private readonly alive = new Set<EntityId>();
  private readonly off: () => void;

  constructor(
    private readonly def: WavesDefinition,
    private readonly deps: WaveDirectorDeps,
    private readonly bus: EventBus,
    private readonly rng: Rng,
  ) {
    this.off = bus.on('enemy_killed', ({ id }) => this.onKilled(id));
  }

  /** Numer bieżącej fali od 1 (0 przed pierwszą). */
  get wave(): number {
    return this.waveIndex + 1;
  }

  get currentPhase(): WavePhase {
    return this.phase;
  }

  get aliveCount(): number {
    return this.alive.size;
  }

  get queued(): number {
    return this.queue.length;
  }

  get totalWaves(): number {
    return this.def.waves.length;
  }

  /** Start od fali `wave` (1..n) po przerwie firstBreakS. */
  start(wave = 1): void {
    this.alive.clear();
    this.queue = [];
    this.waveIndex = Math.max(0, Math.min(this.def.waves.length, wave) - 1) - 1;
    this.phase = 'break';
    this.timerS = this.def.firstBreakS;
  }

  /** Natychmiastowy skok do fali (komenda debug). Żywi wrogowie zostają poza licznikiem. */
  goto(wave: number): void {
    this.alive.clear();
    this.waveIndex = Math.max(1, Math.min(this.def.waves.length, wave)) - 2;
    this.beginNextWave();
  }

  stop(): void {
    this.phase = 'stopped';
    this.queue = [];
    this.alive.clear();
  }

  step(dt: number): void {
    if (!(dt > 0)) return;
    if (this.phase === 'break') {
      this.timerS -= dt;
      if (this.timerS <= 0) this.beginNextWave();
      return;
    }
    if (this.phase !== 'spawning') return;
    this.timerS -= dt;
    while (
      this.timerS <= 0 &&
      this.queue.length > 0 &&
      this.alive.size < this.def.maxAlive
    ) {
      const enemy = this.queue[0] as string;
      const id = this.deps.spawn(enemy, this.pickSpawnPoint());
      if (id === null) break; // limit świata — spróbuj w następnym kroku
      this.queue.shift();
      this.alive.add(id);
      this.timerS += this.currentWave().spawnIntervalS;
    }
    if (this.timerS < 0) this.timerS = 0;
    if (this.queue.length === 0) this.phase = 'fighting';
  }

  dispose(): void {
    this.off();
  }

  private currentWave() {
    return this.def.waves[
      Math.max(0, this.waveIndex)
    ] as WavesDefinition['waves'][number];
  }

  private beginNextWave(): void {
    if (this.waveIndex + 1 >= this.def.waves.length) {
      this.phase = 'done';
      return;
    }
    this.waveIndex++;
    const wave = this.currentWave();
    const queue: string[] = [];
    for (const group of wave.groups)
      for (let i = 0; i < group.count; i++) queue.push(group.enemy);
    this.queue = this.rng.shuffle(queue);
    this.phase = 'spawning';
    this.timerS = 0;
    this.bus.emit('wave_started', { wave: this.wave, count: queue.length });
  }

  private onKilled(id: EntityId): void {
    if (!this.alive.delete(id)) return;
    if (
      this.alive.size === 0 &&
      this.queue.length === 0 &&
      (this.phase === 'fighting' || this.phase === 'spawning')
    ) {
      this.bus.emit('wave_last_kill', { wave: this.wave, id });
      this.bus.emit('wave_cleared', { wave: this.wave });
      if (this.waveIndex + 1 >= this.def.waves.length) this.phase = 'done';
      else {
        this.phase = 'break';
        this.timerS = this.def.breakS;
      }
    }
  }

  /** Losowy punkt spawnu, z preferencją punktów dalej niż minSpawnDistance od gracza. */
  private pickSpawnPoint(): Vec3 {
    const player = this.deps.playerPosition();
    const far = this.def.spawnPoints.filter(
      (p) =>
        Math.hypot(p.x - player.x, p.z - player.z) >= this.def.minSpawnDistance,
    );
    const pool = far.length > 0 ? far : this.def.spawnPoints;
    const p = this.rng.pick(pool);
    return { x: p.x, y: 0, z: p.z };
  }
}
