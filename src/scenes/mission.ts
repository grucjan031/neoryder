import type { Scene as ThreeScene } from 'three';
import type { GameContext } from '../core/context';
import type { EntityId } from '../core/events';
import type { InputSnapshot } from '../core/input';
import type { RunSummary } from '../core/runTypes';
import { Rng } from '../core/rng';
import {
  createIndexedDbSaveStore,
  SAVE_VERSION,
  type MissionSave,
  type SaveStore,
} from '../core/save';
import { levelDefinitions, levelWaves } from '../world/levels';
import { insideLevelZone, LevelRuntime } from '../world/levelRuntime';
import type { LevelDefinition } from '../world/levelSchema';
import { missionDefinitions } from '../world/missions';
import type { MissionDefinition } from '../world/missionSchema';
import { WaveDirector } from '../world/waves';
import { preserveLiteFx } from '../render/fxMode';
import {
  loadMetaManagerStrict,
  saveMetaManager,
} from '../progression/metaSave';
import {
  MissionRadio,
  MissionDirection,
  showLinearSummary,
} from '../ui/missionUi';
import { RoomScene, type RoomCombatState } from './roomScene';
import playerData from '../data/scenes/roomPlayer.json';
import type { Scene } from './index';

export interface MissionSceneOptions {
  params?: URLSearchParams;
  store?: SaveStore;
  navigate?: (url: string) => void;
  loadModels?: boolean;
}
type ActiveEncounter = { director: WaveDirector; enemies: Set<EntityId> };

/** Host jednej ciągłej mapy; nie tworzy RunState ani RunManager. */
export class MissionScene implements Scene {
  readonly id = 'mission';
  private ctx!: GameContext;
  private definition!: MissionDefinition;
  private level!: LevelDefinition;
  private runtime!: LevelRuntime;
  private snapshot!: MissionSave;
  private room?: RoomScene;
  private radio?: MissionRadio;
  private direction?: MissionDirection;
  private readonly active = new Map<string, ActiveEncounter>();
  private readonly sections = new Set<string>();
  private readonly off: (() => void)[] = [];
  private readonly store: SaveStore;
  private readonly navigate: (url: string) => void;
  private saving = Promise.resolve();
  private pendingWrites = 0;
  private saveError: string | null = null;
  private state:
    'loading' | 'playing' | 'respawning' | 'settling' | 'summary' | 'error' =
    'loading';
  private deathTimer = 0;
  private disposed = false;
  private ready = false;
  private finishPending = false;
  private readonly pendingReinforcements = new Set<string>();
  private disposeSummary?: () => void;

  constructor(private readonly options: MissionSceneOptions = {}) {
    this.store = options.store ?? createIndexedDbSaveStore();
    this.navigate =
      options.navigate ??
      ((url) => {
        const current = new URLSearchParams(location.search);
        const target = new URLSearchParams(url.replace(/^\?/, ''));
        if (current.get('debug') === '1') target.set('debug', '1');
        preserveLiteFx(current, target);
        location.assign(`?${target}`);
      });
  }

  async init(ctx: GameContext, three: ThreeScene): Promise<void> {
    this.ctx = ctx;
    const params =
      this.options.params ??
      new URLSearchParams(
        typeof location === 'undefined' ? '' : location.search,
      );
    const missionId = params.get('mission') ?? 'm01-maszty';
    const definition = missionDefinitions.get(missionId);
    if (!definition?.level)
      throw new Error(`Misja nie ma poziomu: ${missionId}`);
    this.definition = definition;
    this.level = levelDefinitions.get(definition.level)!;
    if (
      !this.store.loadMission ||
      !this.store.saveMission ||
      !this.store.clearMission
    )
      throw new Error('SaveStore nie obsługuje misji liniowych.');
    const meta = await loadMetaManagerStrict(this.store, ctx.bus);
    if (this.disposed) return;
    if (
      !definition.requires.every((id) =>
        meta.state.campaign.completed.includes(id),
      )
    )
      throw new Error('Misja jest zablokowana.');
    if (params.get('continue') === '1') {
      const saved = await this.store.loadMission();
      if (
        !saved ||
        saved.missionId !== missionId ||
        saved.levelId !== this.level.id
      )
        throw new Error('Brak punktu kontrolnego tej misji.');
      this.snapshot = saved;
    } else {
      const existing = await this.store.loadMission();
      if (this.disposed) return;
      // Najpierw rozliczamy ukończoną próbę, której zapis meta mógł zostać przerwany.
      if (existing?.completed) {
        this.navigate(
          `?scene=mission&mission=${encodeURIComponent(existing.missionId)}&continue=1&debug=${ctx.debug ? '1' : '0'}`,
        );
        return;
      }
      const seed = params.get('seed') ?? String(ctx.rng.getState());
      this.snapshot = {
        saveVersion: SAVE_VERSION,
        attemptId: `mission:${seed}:${Date.now()}`,
        missionId,
        levelId: this.level.id,
        seed,
        checkpointId: this.level.checkpoints[0]!.id,
        objectives: Object.fromEntries(
          this.level.objectiveOrder.map((id) => [id, 'pending' as const]),
        ),
        completedEncounters: [],
        elapsedS: 0,
        completed: false,
        loadout: meta.loadout(),
        talents: [...meta.state.talents],
        implants: [],
        threatLevel: meta.state.threat.selected,
      };
    }
    if (this.disposed) return;
    this.validateSnapshot();
    this.runtime = new LevelRuntime(
      this.level,
      this.snapshot.completedEncounters,
    );
    if (this.snapshot.completed) {
      this.registerCommands();
      if (typeof document !== 'undefined')
        this.direction = new MissionDirection(() => void this.finish());
      this.ready = true;
      await this.finish();
      return;
    }
    const combat: RoomCombatState = {
      hp: playerData.maxHealth,
      energy: playerData.maxEnergy,
      credits: 0,
      loadout: this.snapshot.loadout,
      talents: this.snapshot.talents,
      implants: this.snapshot.implants,
      threatLevel: this.snapshot.threatLevel,
    };
    this.room = new RoomScene(
      { ...this.level, doors: [] },
      combat,
      {
        id: this.level.id,
        firstBreakS: 0,
        breakS: 0,
        maxAlive: ctx.tuning.level.maxAlive,
        minSpawnDistance: 0,
        spawnPoints: this.level.spawnPoints,
        waves: [],
      },
      {
        node: {
          id: this.level.id,
          layer: 1,
          index: 0,
          type: 'combat',
          next: [],
        },
        manualEncounter: true,
        loadModels: this.options.loadModels ?? true,
        staticCellSize: ctx.tuning.level.staticCellSizeM,
        linearMission: {
          definition: this.positionedMission(),
          order: this.level.objectiveOrder,
          objectives: this.snapshot.objectives,
        },
        reinforce: (_wave, key) => this.pendingReinforcements.add(key),
        missionSignal: (trigger) => {
          this.radio?.signal(trigger);
          if (trigger.endsWith(':done')) {
            this.persist();
            if (trigger === 'objective:exit:done') this.finishPending = true;
          }
        },
      },
    );
    if (typeof document !== 'undefined')
      this.radio = new MissionRadio(definition);
    await this.room.init({ ...ctx, rng: new Rng(this.snapshot.seed) }, three);
    if (this.disposed) {
      this.room.dispose();
      return;
    }
    const checkpoint = this.currentCheckpoint();
    this.room.resetLevelCombat(checkpoint.position, checkpoint.yawDeg);
    if (typeof document !== 'undefined')
      this.direction = new MissionDirection(() => {
        if (this.state === 'error') void this.finish();
        else this.persist();
      });
    this.off.push(
      ctx.bus.on('player_died', ({ id }) => {
        if (id !== this.room?.playerId || this.state !== 'playing') return;
        this.state = 'respawning';
        this.deathTimer = ctx.tuning.level.respawnDelayS;
      }),
    );
    this.registerCommands();
    this.state = 'playing';
    this.ready = true;
    this.updateGates();
    this.persist();
    this.radio?.signal('runStart');
    await this.saving;
  }

  private validateSnapshot(): void {
    if (
      !this.level.checkpoints.some(
        (point) => point.id === this.snapshot.checkpointId,
      )
    )
      throw new Error('Nieznany punkt kontrolny.');
    const ids = Object.keys(this.snapshot.objectives);
    if (
      ids.length !== this.level.objectiveOrder.length ||
      ids.some((id) => !this.level.objectiveOrder.includes(id))
    )
      throw new Error('Niezgodne cele zapisu.');
    if (
      this.snapshot.completed &&
      this.level.objectiveOrder.some(
        (id) => this.snapshot.objectives[id] !== 'done',
      )
    )
      throw new Error('Ukończony zapis ma niewykonane cele.');
    let pending = false;
    for (const id of this.level.objectiveOrder) {
      if (this.snapshot.objectives[id] !== 'done') pending = true;
      else if (pending)
        throw new Error('Nieprawidłowa kolejność zapisanych celów.');
    }
  }

  private positionedMission(): MissionDefinition {
    const mission = structuredClone(this.definition);
    mission.objectives.sort(
      (a, b) =>
        this.level.objectiveOrder.indexOf(a.id) -
        this.level.objectiveOrder.indexOf(b.id),
    );
    for (const objective of mission.objectives) {
      const position = this.level.objectivePositions[objective.id]!;
      if ('position' in objective) objective.position = position;
      if (objective.kind === 'pickup') {
        const parent = this.level.objectivePositions[objective.spawnAfter]!;
        objective.offset = {
          x: position.x - parent.x,
          y: position.y - parent.y,
          z: position.z - parent.z,
        };
      }
    }
    return mission;
  }

  private currentCheckpoint() {
    return this.level.checkpoints.find(
      (point) => point.id === this.snapshot.checkpointId,
    )!;
  }
  private objectives() {
    return this.room?.objectiveModel()?.objectives ?? this.snapshot.objectives;
  }

  private persist(): void {
    if (!this.snapshot || this.disposed) return;
    this.snapshot.objectives = { ...this.objectives() };
    const save = structuredClone(this.snapshot);
    this.enqueue(() => this.store.saveMission!(save));
  }

  private enqueue(write: () => Promise<void>): void {
    this.pendingWrites++;
    this.saving = this.saving
      .then(write)
      .then(() => {
        this.saveError = null;
      })
      .catch((error: unknown) => {
        this.saveError = error instanceof Error ? error.message : String(error);
        console.error('Zapis misji:', error);
      })
      .finally(() => {
        this.pendingWrites--;
      });
  }

  private checkpoint(id: string): void {
    this.snapshot.checkpointId = id;
    this.snapshot.completedEncounters = [...this.runtime.completed];
    this.persist();
  }

  private startEncounter(id: string): void {
    if (this.active.has(id) || this.runtime.completed.has(id)) return;
    const encounter = this.level.encounters.find((item) => item.id === id)!;
    const definition = structuredClone(levelWaves.get(encounter.wave)!);
    definition.spawnPoints = encounter.spawnPoints;
    definition.maxAlive = Math.min(
      definition.maxAlive,
      this.ctx.tuning.level.maxAlive,
    );
    const enemies = new Set<EntityId>();
    const director = new WaveDirector(
      definition,
      {
        spawn: (enemy, position) => {
          const id = this.room!.spawnEncounterEnemy(enemy, position);
          if (id !== null) enemies.add(id);
          return id;
        },
        playerPosition: () => this.room!.playerSnapshot().position,
      },
      this.ctx.bus,
      new Rng(this.snapshot.seed).fork(`encounter:${id}`),
    );
    this.runtime.active.add(id);
    this.active.set(id, { director, enemies });
    director.start();
  }

  private updateGates(): void {
    const open = new Set(this.runtime.openGates(this.objectives()));
    for (const gate of this.level.gates)
      this.room?.setLevelGate(gate.id, gate.block, open.has(gate.id));
  }

  private respawn(): void {
    for (const entry of this.active.values()) entry.director.dispose();
    this.active.clear();
    this.pendingReinforcements.clear();
    this.runtime = new LevelRuntime(
      this.level,
      this.snapshot.completedEncounters,
    );
    const point = this.currentCheckpoint();
    this.room!.resetLevelCombat(point.position, point.yawDeg);
    this.state = 'playing';
    this.updateGates();
    this.persist();
  }

  step(dt: number, input: InputSnapshot): void {
    if (!this.ready || this.disposed) return;
    this.radio?.step(dt);
    if (this.state === 'respawning') {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) this.respawn();
      return;
    }
    if (this.state !== 'playing') return;
    this.snapshot.elapsedS += dt;
    this.room!.step(dt, input);
    if (this.state !== 'playing') return;
    const position = this.room!.playerSnapshot().position;
    for (const id of this.runtime.step(position, this.objectives()))
      this.startEncounter(id);
    for (const key of this.pendingReinforcements) {
      const encounter = this.level.encounters.find(
        (item) => item.reinforcementFor === key,
      );
      if (encounter) this.startEncounter(encounter.id);
    }
    this.pendingReinforcements.clear();
    for (const [id, entry] of this.active) {
      entry.director.step(dt);
      if (entry.director.currentPhase === 'done') {
        entry.director.dispose();
        this.active.delete(id);
        this.runtime.clear(id);
      }
    }
    for (const section of this.level.sections) {
      if (
        !this.sections.has(section.id) &&
        insideLevelZone(position, section.zone)
      ) {
        this.sections.add(section.id);
        if (section.radio) this.radio?.signal(section.radio);
      }
    }
    const currentIndex = this.level.checkpoints.findIndex(
      (point) => point.id === this.snapshot.checkpointId,
    );
    for (const point of this.level.checkpoints.slice(currentIndex + 1)) {
      if (
        this.runtime.satisfied(point.after, this.objectives()) &&
        insideLevelZone(position, point.zone)
      )
        this.checkpoint(point.id);
    }
    this.updateGates();
    if (this.finishPending) {
      this.finishPending = false;
      void this.finish();
    }
  }

  render(alpha: number, frameDt?: number): void {
    if (!this.ready || this.disposed) return;
    this.room?.render(alpha, frameDt);
    this.direction?.setStatus(this.state, this.saveError);
    const model = this.room?.objectiveModel();
    if (model) this.direction?.update(model, this.room!.playerSnapshot());
  }

  private async finish(): Promise<void> {
    if (this.state === 'settling' || this.state === 'summary' || this.disposed)
      return;
    this.state = 'settling';
    this.snapshot.completed = true;
    this.snapshot.objectives = { ...this.objectives() };
    // Osobny zapis ukończenia musi poprzedzać zapis nagród.
    this.persist();
    await this.saving;
    if (this.saveError || this.disposed) {
      this.state = 'error';
      return;
    }
    try {
      const meta = await loadMetaManagerStrict(this.store, this.ctx.bus);
      const summary: RunSummary = {
        missionId: this.definition.id,
        missionCompleted: true,
        outcome: 'victory',
        seed: this.snapshot.seed,
        loadoutId: this.snapshot.loadout.id,
        elapsedS: this.snapshot.elapsedS,
        kills: 0,
        roomsCleared: 0,
        elitesCleared: 0,
        layerReached: 0,
        threatLevel: this.snapshot.threatLevel,
        implants: this.snapshot.implants,
        damage: { melee: 0, power: 0, gun: 0, other: 0 },
      };
      meta.applyRun(summary, this.snapshot.attemptId);
      await saveMetaManager(this.store, meta);
      await this.store.clearMission!();
      if (this.disposed) return;
      this.state = 'summary';
      if (typeof document !== 'undefined')
        this.disposeSummary = showLinearSummary(this.definition, () =>
          this.navigate('?scene=hub'),
        );
    } catch (error) {
      this.saveError = error instanceof Error ? error.message : String(error);
      this.state = 'error';
    }
  }

  private registerCommands(): void {
    const register = (
      name: string,
      help: string,
      run: (args: string[]) => string,
    ) => {
      const off = this.ctx.commands?.register(name, help, run);
      if (off) this.off.push(off);
    };
    register('mission start', 'mission start <id>', (args) => {
      const mission = missionDefinitions.get(args[0] ?? '');
      if (args.length !== 1 || !mission?.level)
        return 'Nieznana misja liniowa.';
      this.navigate(
        `?scene=mission&mission=${encodeURIComponent(mission.id)}&debug=1`,
      );
      return 'Start misji.';
    });
    register('checkpoint', 'checkpoint <id> — teleport i zapis', (args) => {
      const point = this.level.checkpoints.find((item) => item.id === args[0]);
      if (args.length !== 1 || !point || this.state !== 'playing')
        return 'Niedostępny punkt kontrolny.';
      this.room!.teleportPlayer(point.position, point.yawDeg);
      this.checkpoint(point.id);
      return 'Punkt kontrolny zapisany.';
    });
    register('objective done', 'objective done <id>', (args) => {
      if (
        this.state !== 'playing' ||
        args.length !== 1 ||
        !this.room?.objectiveModel()?.done(args[0]!)
      )
        return 'Cel niedostępny.';
      this.updateGates();
      // Komendy działają także przy pauzie; finał nie musi czekać na klatkę symulacji.
      if (this.finishPending) {
        this.finishPending = false;
        queueMicrotask(() => void this.finish());
      }
      return 'Cel ukończony.';
    });
    register(
      'encounter clear',
      'encounter clear — ukończ aktywne spotkania',
      () => {
        if (this.state !== 'playing') return 'Misja nieaktywna.';
        for (const [id, entry] of this.active) {
          entry.director.stop();
          entry.director.dispose();
          this.room!.removeEncounterEnemies([...entry.enemies]);
          this.runtime.clear(id);
        }
        this.active.clear();
        this.updateGates();
        return 'Spotkania ukończone.';
      },
    );
    register('mission radio', 'mission radio <trigger>', (args) => {
      this.radio?.signal(args.join(' '));
      return 'Radio.';
    });
    register(
      'mission retry',
      'mission retry — ponów zapis lub rozliczenie',
      () => {
        if (this.state === 'error') void this.finish();
        else this.persist();
        return 'Ponowiono zapis.';
      },
    );
  }

  query(name: string): unknown {
    if (name === 'loading') return !this.ready && this.state !== 'summary';
    if (name === 'screen') return this.state;
    if (name === 'saveError') return this.saveError;
    if (name === 'savePending')
      return this.pendingWrites > 0 || this.state === 'settling';
    if (name === 'mission')
      return this.snapshot
        ? structuredClone({
            id: this.definition.id,
            level: this.level.id,
            state: this.state,
            checkpointId: this.snapshot.checkpointId,
            objectives: this.objectives(),
            completedEncounters: [...this.runtime.completed],
            activeEncounters: [...this.runtime.active],
            openGates: this.runtime.openGates(this.objectives()),
            elapsedS: this.snapshot.elapsedS,
            saveError: this.saveError,
          })
        : null;
    return this.room?.query(name);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const off of this.off.splice(0)) off();
    for (const entry of this.active.values()) entry.director.dispose();
    this.active.clear();
    this.room?.dispose();
    this.radio?.dispose();
    this.direction?.dispose();
    this.disposeSummary?.();
  }
}
