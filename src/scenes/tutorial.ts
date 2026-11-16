import {
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  type Scene as ThreeScene,
} from 'three';
import { z } from 'zod';
import type { GameContext } from '../core/context';
import type { EntityId, EventType, GameEvents } from '../core/events';
import type { InputSnapshot } from '../core/input';
import type { Vec3 } from '../core/math';
import type { RunState } from '../core/runTypes';
import { loadoutDefinitions } from '../progression/loadout';
import { enemyRegistry } from '../enemies/registry';
import { loadRoom } from '../world/roomSchema';
import { wavesSchema } from '../world/waves';
import { TutorialMachine } from '../data/tutorial/machine';
import {
  markTutorialDone,
  tutorialEvents,
  tutorialStepsSchema,
} from '../data/tutorial/schema';
import stepsData from '../data/tutorial/steps.json';
import rangeData from '../data/tutorial/tutorialRange.json';
import configData from '../data/tutorial/config.json';
import playerData from '../data/scenes/roomPlayer.json';
import { TutorialPanel } from '../ui/tutorialPanel';
import { RoomScene } from './roomScene';
import type { Scene } from './index';

export const tutorialSteps = tutorialStepsSchema.parse(stepsData);
const range = loadRoom(rangeData);
const config = z
  .object({
    loadout: z.string().min(1),
    talents: z.array(z.string().min(1)),
    completionSound: z.string().min(1),
    markerRadius: z.number().positive(),
    markerColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    landingTolerance: z.number().positive(),
    waves: wavesSchema,
  })
  .parse(configData);
for (const step of tutorialSteps) {
  if (step.spawn && !enemyRegistry.has(step.spawn.enemy))
    throw new Error(`Nieznany wróg samouczka: ${step.spawn.enemy}`);
}

export class Tutorial implements Scene {
  readonly id = 'tutorial';
  private readonly machine = new TutorialMachine(tutorialSteps);
  private room?: RoomScene;
  private ctx!: GameContext;
  private panel?: TutorialPanel;
  private marker?: Mesh<RingGeometry, MeshBasicMaterial>;
  private readonly off: (() => void)[] = [];
  private target: EntityId | null = null;
  private targetKilled = false;
  private turretS = 0;
  private disposed = false;
  private suppressEvents = false;

  constructor(private readonly loadModels = true) {}

  async init(ctx: GameContext, three: ThreeScene): Promise<void> {
    this.ctx = ctx;
    const loadout = loadoutDefinitions.get(config.loadout);
    if (!loadout) throw new Error(`Nieznany ekwipunek: ${config.loadout}`);
    const run: RunState = {
      seed: 'tutorial',
      sectorId: 'tutorial',
      loadoutId: loadout.id,
      loadout,
      talents: [...config.talents],
      threatLevel: 0,
      startedAtMs: 0,
      elapsedS: 0,
      map: {
        sectorId: 'tutorial',
        layers: [
          [{ id: 'training', layer: 1, index: 0, type: 'combat', next: [] }],
        ],
      },
      currentNodeId: 'training',
      visited: [],
      hp: playerData.maxHealth,
      energy: playerData.maxEnergy,
      credits: 0,
      implants: [],
      stats: { kills: 0, damage: { melee: 0, power: 0, gun: 0, other: 0 } },
    };
    this.room = new RoomScene(range, run, config.waves, {
      loadModels: this.loadModels,
      manualEncounter: true,
    });
    try {
      await this.room.init(ctx, three);
      if (this.disposed) return;
      this.marker = new Mesh(
        new RingGeometry(config.markerRadius * 0.8, config.markerRadius, 32),
        new MeshBasicMaterial({ color: config.markerColor, depthWrite: false }),
      );
      this.marker.name = 'tutorial-marker';
      this.marker.rotation.x = -Math.PI / 2;
      three.add(this.marker);
      if (typeof document !== 'undefined') this.panel = new TutorialPanel();
      const events = new Set<EventType>([
        ...tutorialEvents,
        'heat_changed',
        'player_died',
        'enemy_killed',
      ]);
      for (const event of events)
        this.off.push(
          ctx.bus.on(event, (payload) => this.onEvent(event, payload)),
        );
      const off = ctx.commands?.register(
        'tutorial step',
        'tutorial step <1–11> — wybierz ćwiczenie',
        (args) => {
          if (args.length !== 1 || !this.machine.goTo(Number(args[0])))
            return 'Użycie: tutorial step <1–11>';
          this.enter(false, true);
          return `Samouczek: krok ${this.machine.number}.`;
        },
      );
      if (off) this.off.push(off);
      this.enter(false);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  private onEvent<K extends EventType>(event: K, payload: GameEvents[K]): void {
    if (this.suppressEvents || !this.room) return;
    const data = payload as unknown as Record<string, unknown>;
    const player = this.room.playerId;
    // Wrogowie też emitują obrażenia i ruch; liczymy tylko działania ćwiczącego.
    const actor = data.source ?? data.attacker ?? data.owner ?? data.user;
    if (event !== 'parry_success' && actor !== undefined && actor !== player)
      return;
    if (
      (event === 'heat_changed' ||
        event === 'player_died' ||
        event === 'player_jumped') &&
      data.id !== player
    )
      return;
    if (
      event === 'damage_dealt' &&
      (data.target !== this.target || data.source !== player)
    )
      return;
    if (event === 'execute_performed' && data.target !== this.target) return;
    if (event === 'enemy_killed' && data.id === this.target)
      this.targetKilled = true;
    this.machine.event(event, payload);
  }

  private playerPosition(feet: Vec3): Vec3 {
    const t = this.ctx.tuning.player;
    return { ...feet, y: feet.y + t.capsuleHeight / 2 + t.controllerOffset };
  }

  private enter(completedPrevious: boolean, debugJump = false): void {
    if (!this.room) return;
    const step = this.machine.current;
    this.suppressEvents = true;
    try {
      const feet = debugJump
        ? {
            ...range.playerSpawn,
            ...(step.start ? { x: step.start.x, z: step.start.z } : {}),
          }
        : undefined;
      this.room.prepareEncounter({
        invulnerable: step.invulnerable,
        passive: step.spawn?.passive ?? !step.wave,
        ...(step.held ? { held: step.held } : {}),
        ...(feet ? { position: this.playerPosition(feet) } : {}),
      });
      if (debugJump && step.start) {
        const { x, z, yawDeg } = step.start;
        this.ctx.commands?.execute(`tp ${x} ${z} ${yawDeg}`);
      }
      this.target = null;
      this.targetKilled = false;
      if (step.spawn) {
        const s = step.spawn;
        this.target = this.room.spawnEncounterEnemy(
          s.enemy,
          s.position,
          [
            {
              stat: 'maxHealth',
              type: 'mult',
              value: s.healthMultiplier,
              source: 'tutorial:dummy',
            },
          ],
          s.healthFraction,
        );
        if (this.target === null)
          throw new Error('Brak miejsca na cel samouczka.');
      }
      if (step.wave) this.room.startEncounterWave();
      this.turretS = step.spawn?.turret?.intervalS ?? 0;
      if (this.marker) {
        this.marker.visible = !!step.marker;
        if (step.marker) this.marker.position.copy(step.marker);
      }
      if (step.complete) markTutorialDone();
      this.panel?.show(
        step,
        this.machine.number,
        tutorialSteps.length,
        completedPrevious,
      );
      if (completedPrevious) this.ctx.audio?.play(config.completionSound);
    } finally {
      this.suppressEvents = false;
    }
  }

  private stepTurret(dt: number): void {
    const spawn = this.machine.current.spawn;
    if (!spawn?.turret || this.target === null || !this.room) return;
    this.turretS -= dt;
    if (this.turretS > 0) return;
    const t = spawn.turret;
    this.turretS = t.intervalS;
    const origin = {
      x: spawn.position.x,
      y: spawn.position.y + t.height,
      z: spawn.position.z + t.offsetZ,
    };
    const player = this.room.playerSnapshot();
    const dir = {
      x: player.position.x - origin.x,
      y: player.position.y - origin.y,
      z: player.position.z - origin.z,
    };
    const length = Math.hypot(dir.x, dir.y, dir.z) || 1;
    this.room.fireEncounterProjectile({
      owner: this.target,
      team: 'enemy',
      origin,
      dir: { x: dir.x / length, y: dir.y / length, z: dir.z / length },
      speed: t.speed,
      damage: t.damage,
      tags: ['#gun'],
      lifetimeS: t.lifetimeS,
    });
  }

  step(dt: number, input: InputSnapshot): void {
    if (!this.room || this.disposed || this.machine.finished) return;
    if (dt > 0) this.stepTurret(dt);
    this.room.step(dt, input);
    const player = this.room.playerSnapshot();
    this.machine.position(
      { ...player.position, y: player.position.y - player.height / 2 },
      player.grounded,
      config.landingTolerance,
      player.sliding,
    );
    const transition = this.machine.flush();
    if (transition) this.enter(transition === 'advance');
    else if (this.targetKilled) {
      this.machine.goTo(this.machine.number);
      this.enter(false);
    }
  }

  render(alpha: number, frameDt?: number): void {
    if (this.disposed) return;
    this.room?.render(alpha, frameDt);
    this.panel?.syncBindings();
  }
  query(name: string): unknown {
    if (name === 'tutorialStep') return this.machine.number;
    if (name === 'tutorialComplete') return this.machine.finished;
    if (name === 'tutorialTarget') return this.target;
    return this.room?.query(name);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const off of this.off.splice(0)) off();
    this.panel?.dispose();
    this.marker?.removeFromParent();
    this.marker?.geometry.dispose();
    this.marker?.material.dispose();
    this.room?.dispose();
  }
}
