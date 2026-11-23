import { Ray } from '@dimforge/rapier3d-compat';
import type { GameContext } from '../core/context';
import type { EntityId } from '../core/events';
import type { Vec3 } from '../core/math';
import type { GrabTarget } from '../combat/powers/grabTypes';
import { CollisionGroup, interactionGroups } from '../physics';
import { EnemyDirector } from './director';
import type { DirectorConfig } from './director';
import type { StatModifier } from '../core/stats';
import { createEnemy } from './registry';
import type { Enemy, EnemyDependencies } from './types';
import { EnemyBatch } from '../world/enemyBatch';
import type { ArenaNavigation } from '../world/arenaNavigation';
import {
  difficulties,
  difficultyModifiers,
  selectedDifficulty,
  bindCombatDifficulty,
  runDifficulty,
  type DifficultyId,
  type DifficultyProfile,
} from '../world/difficulty';

/** Liczba tokenów typowego pokoju walki dziś (`src/data/rooms/*.json`). */
export const REFERENCE_TOKENS = { melee: 3, shot: 2 } as const;

export interface EnemyManagerOptions {
  difficulty?: DifficultyId;
  /** Stan runu (zamrożona trudność) albo stan walki misji. */
  run?: object;
  /** Testy i symulacja: profil spoza danych, np. linia bazowa bez taktyk. */
  profile?: DifficultyProfile;
  /** Dane `director` sceny; bez nich wrogowie atakują bez koordynacji (F1). */
  director?: DirectorConfig;
  /** F3-17: punkty spawnu pokoju dla wezwań bossa (opcjonalne). */
  spawnPoints?: readonly Vec3[];
}

export class EnemyManager {
  readonly difficulty: DifficultyId;
  private enemies: Enemy[] = [];
  private readonly batch = new EnemyBatch();
  private nearby?: Enemy[];
  /** Numer spawnu w runie — źródło losowości AI niezależne od rosnących ID encji. */
  private sequence = 0;
  private spawnModifiers: readonly StatModifier[] = [];
  private readonly deps: EnemyDependencies;
  readonly director: EnemyDirector | null;
  constructor(
    private readonly ctx: Pick<GameContext, 'bus' | 'rng' | 'tuning'>,
    deps: EnemyDependencies,
    options: EnemyManagerOptions = {},
  ) {
    this.difficulty =
      options.difficulty ??
      // RunState ma `seed`; stan walki misji (bez runu) bierze bieżące ustawienie.
      (options.run && 'seed' in options.run
        ? runDifficulty(options.run)
        : selectedDifficulty());
    bindCombatDifficulty(ctx.bus, this.difficulty);
    const profile = options.profile ?? difficulties[this.difficulty];
    // Tokeny w danych dotyczą typowego pokoju (3 wręcz, 2 strzały); inne pokoje przesuwa ta sama różnica.
    const tokens = (room: number, level: number, reference: number) =>
      Math.max(1, room + level - reference);
    const directorConfig = options.director
      ? {
          ...options.director,
          attackTokens: tokens(
            options.director.attackTokens,
            profile.attackTokens,
            REFERENCE_TOKENS.melee,
          ),
          shotTokens: tokens(
            options.director.shotTokens,
            profile.shotTokens,
            REFERENCE_TOKENS.shot,
          ),
        }
      : undefined;
    this.director = directorConfig
      ? new EnemyDirector(
          ctx.bus,
          directorConfig,
          {
            target: () => deps.getTarget(),
            position: (id) => this.position(id),
            clear: (from, to) => {
              const dx = to.x - from.x,
                dy = to.y - from.y,
                dz = to.z - from.z;
              const length = Math.hypot(dx, dy, dz);
              if (length <= 1e-6) return true;
              return (
                deps.world.castRay(
                  new Ray(from, {
                    x: dx / length,
                    y: dy / length,
                    z: dz / length,
                  }),
                  length,
                  true,
                  undefined,
                  interactionGroups(CollisionGroup.Enemy, CollisionGroup.World),
                ) === null
              );
            },
          },
          {
            profile,
            rng: ctx.rng.fork('coordination'),
            tuning: ctx.tuning.enemies,
          },
        )
      : null;
    const baseModifiers = difficultyModifiers(profile);
    const readModifiers = () => [...baseModifiers, ...this.spawnModifiers];
    this.deps = {
      ...deps,
      difficulty: profile,
      targetForward: () => {
        if (deps.targetForward) return deps.targetForward();
        const yaw = deps.getTarget()?.yaw;
        return yaw === undefined
          ? { x: 0, y: 0, z: 0 }
          : { x: -Math.sin(yaw), y: 0, z: -Math.cos(yaw) };
      },
      getNeighbors: () => this.enemies,
      getLocalNeighbors: () => this.nearby ?? this.enemies,
      get spawnModifiers() {
        return readModifiers();
      },
      spawnEnemy: (id: string, position: Vec3) => this.spawn(id, position),
      ...(options.spawnPoints ? { spawnPoints: options.spawnPoints } : {}),
      ...(this.director ? { director: this.director } : {}),
    };
  }
  private position(id: EntityId): Vec3 | null {
    for (const enemy of this.enemies)
      if (enemy.id === id && !enemy.removed) return enemy.current.position;
    return null;
  }
  /** Modyfikatory nakładane na Stats każdego nowo spawnowanego wroga (także pomocnicy i boss). */
  setSpawnModifiers(mods: readonly StatModifier[]): void {
    this.spawnModifiers = [...mods];
  }
  spawn(id: string, position: Vec3): Enemy {
    const rng = this.ctx.rng.fork(`spawn:${this.sequence++}`);
    // Z `getTargetFor` każdy wróg pyta o własny cel; dyrektor nadal ustawia szyk wokół `getTarget`.
    const pick = this.deps.getTargetFor;
    let self: Enemy | null = null;
    const deps: EnemyDependencies = pick
      ? {
          ...this.deps,
          getTarget: () =>
            pick(
              self
                ? { id: self.id, position: self.current.position }
                : { id: null, position },
            ),
        }
      : this.deps;
    const enemy = createEnemy({ ...this.ctx, rng }, deps, id, position);
    self = enemy;
    this.nearby = undefined;
    this.enemies.push(enemy);
    return enemy;
  }
  step(dt: number, navigation?: ArenaNavigation): void {
    const count = this.enemies.length;
    const settings = this.ctx.tuning.enemies;
    let radius = settings.separationRadius;
    for (const enemy of this.enemies)
      radius = Math.max(radius, 2 * (enemy.definition.body?.radius ?? 0));
    // Extra radius bounds movement of earlier actors in this sequential tick.
    // A teleport, strong impulse or mid-tick spawn invalidates the remaining rows.
    const margin = radius;
    const packed =
      (dt > 0 && count > 1) || (dt > 0 && navigation && count)
        ? navigation
          ? navigation.nextBatch(
              this.enemies,
              radius + margin,
              settings.pathLookaheadCells,
            )
          : this.batch.run(this.enemies, radius + margin, 0)
        : undefined;
    let valid = !!packed;
    const local: Enemy[] = [];
    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i]!;
      if (valid && packed) {
        local.length = 0;
        for (let j = packed[i]!; j < packed[i + 1]!; j++)
          local.push(this.enemies[packed[j]!]!);
        this.nearby = local;
      }
      const { x, z } = enemy.current.position;
      enemy.step(dt);
      if (
        count !== this.enemies.length ||
        Math.abs(enemy.current.position.x - x) >= margin ||
        Math.abs(enemy.current.position.z - z) >= margin
      ) {
        valid = false;
        this.nearby = undefined;
      }
    }
    this.nearby = undefined;
    this.enemies = this.enemies.filter((enemy) => !enemy.removed);
    this.director?.step(dt);
  }
  forEach(cb: (enemy: Enemy) => void): void {
    this.enemies.forEach(cb);
  }
  grabTargets(): GrabTarget[] {
    return this.enemies.flatMap((enemy) => {
      if (enemy.removed || enemy.current.state === 'dead') return [];
      const target = enemy.grabTarget?.();
      return target ? [target] : [];
    });
  }
  captureControlled(): void {
    for (const enemy of this.enemies) enemy.syncControlled?.();
  }
  despawnAll(): void {
    for (const enemy of this.enemies) enemy.dispose();
    this.enemies = [];
    this.sequence = 0;
    this.director?.reset();
  }
  dispose(): void {
    this.batch.dispose();
    this.despawnAll();
    this.director?.dispose();
  }
}
