import type { Collider, ColliderDesc } from '@dimforge/rapier3d-compat';
import type { Scene as ThreeScene } from 'three';
import type { GameContext } from '../core/context';
import type { InputSnapshot } from '../core/input';
import type { EntityId } from '../core/events';
import type { Vec3 } from '../core/math';
import { Health } from '../combat/damage';
import { CollisionGroup, interactionGroups } from '../physics';
import type { RoomDefinition } from '../world/roomSchema';
import { WaveDirector, loadWaves } from '../world/waves';
import type { WavesDefinition } from '../world/waves';
import wavesData from '../data/waves/roomTest.json';
import { roomTestRun } from './roomTest';
import { RoomScene } from './roomScene';
import type { ViewPose } from './prototypeViews';

/** Cel prototypu (więzień, wagon): zdrowie i hurtbox trafiany tylko pociskami wrogów. */
export interface PrototypeTarget {
  id: EntityId;
  health: Health;
  collider: Collider;
}

type RapierModule = typeof import('@dimforge/rapier3d-compat');
const NAV_SNAP_RADII_M = [1.5, 3, 4.5, 6];
const NAV_SNAP_DIRECTIONS = 8;

export function lerpPose(a: ViewPose, b: ViewPose, t: number): ViewPose {
  let dyaw = b.yaw - a.yaw;
  dyaw -= Math.PI * 2 * Math.round(dyaw / (Math.PI * 2));
  return {
    position: {
      x: a.position.x + (b.position.x - a.position.x) * t,
      y: a.position.y + (b.position.y - a.position.y) * t,
      z: a.position.z + (b.position.z - a.position.z) * t,
    },
    yaw: a.yaw + dyaw * t,
  };
}

/**
 * Wspólna baza scen prototypowych S4-03: pokój areny z nawigacją, cele z `Health` i hurtboxem
 * w grupie `Player` (filtr tylko `EnemyProjectile`: pociski wrogów je trafiają, ostrze gracza,
 * jego pociski i kontroler już nie), sterowanie wrogów po nawigacji i komendy debug.
 * Wrogowie dalej celują wyłącznie w gracza (`getTarget`), więc cele obrywają tylko rykoszetem.
 */
export abstract class PrototypeScene extends RoomScene {
  protected protoReady = false;
  protected readonly protoOff: (() => void)[] = [];
  private goalCache: { key: string; goal: Vec3 } | null = null;

  constructor(
    protected readonly room: RoomDefinition,
    waves: WavesDefinition,
    protected readonly withModels: boolean,
  ) {
    super(room, roomTestRun(room, protoParams()), waves, {
      loadModels: withModels,
      manualEncounter: true,
    });
  }

  override async init(ctx: GameContext, three: ThreeScene): Promise<void> {
    await super.init(ctx, three);
    if (this.disposed) return;
    if (!this.room.arena)
      throw new Error(`Pokój ${this.room.id} nie ma danych areny (nawigacja).`);
  }

  override step(dt: number, input: InputSnapshot): void {
    if (this.protoReady) this.steerEnemies();
    super.step(dt, input);
  }

  override dispose(): void {
    for (const off of this.protoOff.splice(0)) off();
    super.dispose();
  }

  /** Stopy gracza (pozycja kontrolera to środek kapsuły). */
  protected playerFeet(): Vec3 {
    const s = this.player.getState();
    return { x: s.position.x, y: s.position.y - s.height / 2, z: s.position.z };
  }

  /** Pozycje żywych wrogów (stopy). */
  protected hostilePositions(): Vec3[] {
    const list: Vec3[] = [];
    this.manager.forEach((e) => {
      if (!e.removed && e.current.state !== 'dead')
        list.push({ ...e.current.position });
    });
    return list;
  }

  /**
   * Najbliższy punkt siatki nawigacji przy `feet`: gracz na torach albo skrzyni stoi poza
   * komórkami, a `ArenaNavigation.next` bez celu w siatce nie prowadzi nigdzie.
   */
  protected navGoal(feet: Vec3): Vec3 {
    const nav = this.navigation;
    if (!nav) return feet;
    const key = `${Math.floor(feet.x)},${Math.floor(feet.z)},${Math.round(feet.y)}`;
    if (this.goalCache?.key === key) return this.goalCache.goal;
    const walkable = (p: Vec3): boolean => nav.path(p, p).length > 0;
    let goal = feet;
    if (!walkable(feet)) {
      search: for (const radius of NAV_SNAP_RADII_M)
        for (let i = 0; i < NAV_SNAP_DIRECTIONS; i++) {
          const angle = (i * Math.PI * 2) / NAV_SNAP_DIRECTIONS;
          const p = {
            x: feet.x + Math.cos(angle) * radius,
            y: feet.y,
            z: feet.z + Math.sin(angle) * radius,
          };
          if (walkable(p)) {
            goal = p;
            break search;
          }
        }
    }
    this.goalCache = { key, goal };
    return goal;
  }

  /**
   * Wrogowie maszerują do gracza po nawigacji (jak w trybie Przejęcia); w 10 m chasują sami.
   * Cel końcowy ustawiamy tu, a węzeł trasy wybiera wsad `EnemyManager.step` w kroku sceny.
   */
  private steerEnemies(): void {
    if (!this.navigation) return;
    const goal = this.navGoal(this.playerFeet());
    this.manager.forEach((enemy) => {
      if (!enemy.removed && enemy.current.state !== 'dead') {
        enemy.moveGoal = goal;
        enemy.moveGoalFinal = true;
      }
    });
  }

  /** Cel z `Health` i nieblokującym hurtboxem (kształt dostarcza podklasa). */
  protected createTarget(
    kind: string,
    maxHealth: () => number,
    shape: (rapier: RapierModule) => ColliderDesc,
  ): PrototypeTarget {
    const id = this.entities.create(kind, 'neutral');
    const health = new Health(maxHealth);
    this.damage.register(id, health);
    const collider = this.world.createCollider(
      shape(this.rapier).setCollisionGroups(
        interactionGroups(
          CollisionGroup.Player,
          CollisionGroup.EnemyProjectile,
        ),
      ),
    );
    this.hurtboxes.add(id, collider);
    this.entities.bindCollider(id, collider.handle);
    return { id, health, collider };
  }

  protected removeTarget(target: PrototypeTarget): void {
    this.hurtboxes.removeEntity(target.id);
    this.damage.unregister(target.id);
    this.entities.destroy(target.id);
  }

  /** Ruch hurtboxa: `center` to środek bryły, `yaw` obrót wokół Y. */
  protected placeTarget(target: PrototypeTarget, center: Vec3, yaw = 0): void {
    target.collider.setTranslation(center);
    target.collider.setRotation({
      x: 0,
      y: Math.sin(yaw / 2),
      z: 0,
      w: Math.cos(yaw / 2),
    });
  }

  /** Dyrektor fal prototypu: spawn przez `spawnEnemy` (limity ciał i `maxAlive` pokoju). */
  protected createWaveDirector(
    definition: WavesDefinition,
    key: string,
  ): WaveDirector {
    return new WaveDirector(
      definition,
      {
        spawn: (enemy, position) => this.spawnEnemy(enemy, position),
        playerPosition: () => this.playerFeet(),
      },
      this.ctx.bus,
      this.ctx.rng.fork(`prototype:${key}`),
    );
  }

  protected command(
    name: string,
    help: string,
    run: (args: string[]) => string,
  ): void {
    const off = this.ctx.commands?.register(name, help, run);
    if (off) this.protoOff.push(off);
  }
}

/** Parametry URL sceny (poza przeglądarką puste). */
export function protoParams(): URLSearchParams {
  return new URLSearchParams(
    typeof location === 'undefined' ? '' : location.search,
  );
}

/**
 * Fale bazowe `RoomScene` (nieuruchamiane: `manualEncounter`). Liczba fal jest nieosiągalna
 * dla fal prototypów, żeby ich `wave_cleared` nie zamykał pokoju (otwarcie wyjścia, `room_cleared`).
 */
export function protoBaseWaves(room: RoomDefinition): WavesDefinition {
  const unreachableWaveCount = 99;
  return loadWaves({
    ...wavesData,
    spawnPoints: room.spawnPoints,
    maxAlive: room.maxAlive ?? room.arena?.maxAlive ?? wavesData.maxAlive,
    minSpawnDistance: wavesData.minSpawnDistance,
    waves: Array.from(
      { length: unreachableWaveCount },
      () => wavesData.waves[0],
    ),
  });
}
