import type { Scene as ThreeScene } from 'three';
import type { Collider } from '@dimforge/rapier3d-compat';
import type { Vec3 } from '../core/math';
import { Health } from '../combat/damage';
import { CollisionGroup, interactionGroups } from '../physics';
import { RailPayload } from '../world/railPayload';
import { PayloadView, EscortNpcView } from './prototypeViews';
import { lerpPose } from './prototypeScene';
import { PrototypeHud } from '../ui/prototypeHud';
import prototypeText from '../data/ui/prototypes.pl.json';
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
import type {
  MissionDefinition,
  MissionObjective,
} from '../world/missionSchema';
import type { MissionObjectives } from '../world/missionObjectives';
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
  private payloadRoom?: PayloadMissionRoom;
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
    | 'loading'
    | 'playing'
    | 'respawning'
    | 'settling'
    | 'summary'
    | 'error'
    | 'failed' = 'loading';
  private deathTimer = 0;
  private disposed = false;
  private ready = false;
  private finishPending = false;
  private readonly pendingReinforcements = new Set<string>();
  private disposeSummary?: () => void;
  private directed?: MissionObjectives;
  private chaseClock?: HTMLOutputElement;
  private readonly objectiveNpcs: EscortNpcView[] = [];

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
    this.validateRadio();
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
    const Room = this.level.payload ? PayloadMissionRoom : RoomScene;
    this.room = new Room(
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
    const objectives = this.room.objectiveModel()!;
    objectives.canComplete = (objective) =>
      this.runtime.satisfied(
        this.level.objectiveAfter?.[objective.id],
        objectives.objectives,
      );
    if (
      typeof document !== 'undefined' &&
      definition.objectives.some((o) => o.kind === 'reach')
    ) {
      this.chaseClock = document.createElement('output');
      this.chaseClock.dataset.chaseClock = '';
      // Zegar pościgu w panelu celów, pod bieżącym celem — nie jako luźny element w rogu.
      (
        document.querySelector('.mission-goals') ??
        document.querySelector('.mission-hud')
      )?.append(this.chaseClock);
    }
    this.room.resetLevelCombat(checkpoint.position, checkpoint.yawDeg);
    for (const npc of this.level.objectiveNpcs ?? []) {
      const t = ctx.tuning.player;
      const view = new EscortNpcView(
        ctx.tuning,
        t.capsuleHeight,
        t.capsuleRadius,
      );
      three.add(view.root);
      this.objectiveNpcs.push(view);
      view.update(
        { position: npc.spawn, yaw: (npc.yawDeg * Math.PI) / 180 },
        'waiting',
        'idle',
        0,
      );
      if (this.options.loadModels ?? true) void view.load();
    }
    if (this.room instanceof PayloadMissionRoom) {
      this.payloadRoom = this.room;
      this.payloadRoom.initPayload(
        this.level,
        checkpoint.payloadDistanceM!,
        this.options.loadModels ?? true,
      );
    }
    for (const id of this.snapshot.completedEncounters)
      this.room.allyDependencyDone('encounter', id);
    if (typeof document !== 'undefined')
      this.direction = new MissionDirection(() => {
        if (this.state === 'failed') this.failPayload();
        else if (this.state === 'error') void this.finish();
        else this.persist();
      });
    this.off.push(
      ctx.bus.on('player_died', ({ id }) => {
        if (id !== this.room?.playerId || this.state !== 'playing') return;
        this.state = 'respawning';
        this.deathTimer = ctx.tuning.level.respawnDelayS;
      }),
      // Boss spotkania nie jest bossem pokoju, więc RoomScene nie zgłasza jego faz.
      ctx.bus.on('boss_phase', ({ phase }) => {
        if (phase === 2 || phase === 3)
          this.radio?.signal(`boss:phase:${phase}`);
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

  /** Wyzwalacze poziomu muszą wskazywać istniejące sekcje, spotkania i punkty. */
  private validateRadio(): void {
    const known: Record<string, readonly { id: string }[]> = {
      enterSection: this.level.sections,
      encounter: this.level.encounters,
      checkpoint: this.level.checkpoints,
    };
    for (const { trigger } of this.definition.radio) {
      const [kind, id] = trigger.split(':');
      if (known[kind!] && !known[kind!]!.some((entry) => entry.id === id))
        throw new Error(`Nieznany wyzwalacz radia: ${trigger}`);
    }
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
    this.room?.restoreAllies();
    this.radio?.signal(`checkpoint:${id}`);
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
          const id = this.room!.spawnEncounterEnemy(enemy, {
            ...position,
            y: encounter.spawnHeightM ?? position.y,
          });
          if (id !== null) enemies.add(id);
          return id;
        },
        playerPosition: () => this.room!.playerSnapshot().position,
        // Boss jest jeden niezależnie od mnożnika liczebności poziomu trudności.
        ...(encounter.bossFor ? { difficulty: 'normal' as const } : {}),
      },
      this.ctx.bus,
      new Rng(this.snapshot.seed).fork(`encounter:${id}`),
    );
    this.runtime.active.add(id);
    this.active.set(id, { director, enemies });
    director.start();
    this.radio?.signal(`encounter:${id}:started`);
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
    this.room!.objectiveModel()?.resetTimers();
    this.payloadRoom?.restorePayload(point.payloadDistanceM!);
    this.state = 'playing';
    this.updateGates();
    this.persist();
  }

  step(dt: number, input: InputSnapshot): void {
    if (!this.ready || this.disposed) return;
    this.radio?.setCombat(this.active.size > 0);
    this.radio?.step(dt);
    if (this.state === 'respawning') {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) this.respawn();
      return;
    }
    if (this.state !== 'playing') return;
    this.snapshot.elapsedS += dt;
    this.room!.step(dt, input);
    if (this.room!.objectiveModel()?.failed) {
      this.state = 'respawning';
      this.deathTimer = this.ctx.tuning.level.respawnDelayS;
      return;
    }
    if (this.payloadRoom?.payload.status === 'destroyed') {
      this.failPayload();
      return;
    }
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
        const bossFor = this.level.encounters.find(
          (item) => item.id === id,
        )?.bossFor;
        if (bossFor) {
          // Kolejność jak w pokoju bossa: ostatnie słowa, potem ukończenie celu.
          this.radio?.signal('boss:defeated');
          this.room!.objectiveModel()?.done(bossFor);
        }
        this.room!.allyDependencyDone('encounter', id);
        this.radio?.signal(`encounter:${id}:done`);
      }
    }
    for (const section of this.level.sections) {
      if (
        !this.sections.has(section.id) &&
        insideLevelZone(position, section.zone)
      ) {
        this.sections.add(section.id);
        if (section.radio) this.radio?.signal(section.radio);
        this.radio?.signal(`enterSection:${section.id}`);
      }
    }
    const currentIndex = this.level.checkpoints.findIndex(
      (point) => point.id === this.snapshot.checkpointId,
    );
    for (const point of this.level.checkpoints.slice(currentIndex + 1)) {
      if (
        this.runtime.satisfied(point.after, this.objectives()) &&
        (!this.payloadRoom ||
          this.payloadRoom.payload.distanceM >= point.payloadDistanceM!) &&
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
    this.objectiveNpcs.forEach((view, index) => {
      const npc = this.level.objectiveNpcs![index]!;
      // Cywile celu reach znikają dopiero po wejściu grupy do bezpiecznego szybu.
      const evacuated =
        this.objectives()[npc.objective] === 'done' &&
        this.definition.objectives.some(
          (o) => o.id === npc.objective && o.kind === 'reach',
        );
      view.update(
        { position: npc.spawn, yaw: (npc.yawDeg * Math.PI) / 180 },
        evacuated ? 'evacuated' : 'waiting',
        'idle',
        frameDt ?? 0,
      );
    });
    this.direction?.setStatus(this.state, this.saveError);
    const model = this.room?.objectiveModel();
    if (model && this.chaseClock) {
      const current = Object.entries(model.remainingS)[0];
      this.chaseClock.hidden = !current;
      this.chaseClock.textContent = current
        ? `${model.mission.objectives.find((o) => o.id === current[0])!.label} · ${Math.ceil(current[1])} s`
        : '';
    }
    if (model)
      this.direction?.update(
        this.directionModel(model),
        this.room!.playerSnapshot(),
      );
  }

  /**
   * Cel `killBoss` nie ma pozycji w danych misji: kierunek prowadzi na arenę z poziomu,
   * a w trakcie walki znika, żeby nie zasłaniać paska bossa.
   */
  private directionModel(model: MissionObjectives): MissionObjectives {
    this.directed ??= Object.create(model, {
      position: {
        value: (objective: MissionObjective) =>
          (objective.kind === 'escortPayload' && this.payloadRoom
            ? this.payloadRoom.payload.position
            : model.position(objective)) ??
          (this.level.encounters.some(
            (item) =>
              item.bossFor === objective.id && this.runtime.active.has(item.id),
          )
            ? null
            : (this.level.objectivePositions[objective.id] ?? null)),
      },
    }) as MissionObjectives;
    return this.directed;
  }

  private failPayload(): void {
    this.state = 'failed';
    this.finishPending = false;
    // Usunięcie próby jest za wcześniejszymi zapisami i może być ponowione po błędzie.
    this.enqueue(() => this.store.clearMission!());
    void this.saving.then(() => {
      if (!this.disposed && !this.saveError) this.navigate('?scene=hub');
    });
  }

  private async finish(): Promise<void> {
    if (this.state === 'failed') return;
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
          this.room!.allyDependencyDone('encounter', id);
          this.radio?.signal(`encounter:${id}:done`);
        }
        this.active.clear();
        this.updateGates();
        return 'Spotkania ukończone.';
      },
    );
    if (this.payloadRoom) {
      register('payload status', 'payload status — stan wagonu', () =>
        JSON.stringify(this.payloadRoom!.payload.snapshot()),
      );
      register('payload skip', 'payload skip — następny postój (debug)', () => {
        this.payloadRoom!.payload.skip();
        return 'Wagon przesunięty.';
      });
      register('payload hp', 'payload hp <n> — wytrzymałość wagonu', (args) => {
        const hp = Number(args[0]);
        if (args.length !== 1 || !Number.isFinite(hp) || hp < 0)
          return 'Użycie: payload hp <n>';
        this.payloadRoom!.setPayloadHp(hp);
        return 'Wytrzymałość wagonu ustawiona.';
      });
    }
    register('mission radio', 'mission radio <trigger>', (args) => {
      this.radio?.signal(args.join(' '));
      return 'Radio.';
    });
    register(
      'mission retry',
      'mission retry — ponów zapis lub rozliczenie',
      () => {
        if (this.state === 'failed') this.failPayload();
        else if (this.state === 'error') void this.finish();
        else this.persist();
        return 'Ponowiono zapis.';
      },
    );
  }

  query(name: string): unknown {
    if (name === 'payload') return this.payloadRoom?.payload.snapshot();
    if (name === 'loading') return !this.ready && this.state !== 'summary';
    if (name === 'screen') return this.state;
    if (name === 'saveError') return this.saveError;
    if (name === 'savePending')
      return this.pendingWrites > 0 || this.state === 'settling';
    if (name === 'missionRadio') return this.radio?.snapshot() ?? null;
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
            chaseRemainingS: this.room?.objectiveModel()?.remainingS ?? {},
            failedObjective: this.room?.objectiveModel()?.failed ?? null,
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
    this.chaseClock?.remove();
    for (const view of this.objectiveNpcs) view.dispose();
    this.disposeSummary?.();
  }
}

/** Adapter prototypu do hosta misji; wspólny RoomScene pozostaje bez zmian. */
class PayloadMissionRoom extends RoomScene {
  payload!: RailPayload;
  private payloadDefinition!: NonNullable<LevelDefinition['payload']>;
  private payloadHealth!: Health;
  private payloadCollider!: Collider;
  private payloadId!: EntityId;
  private payloadView?: PayloadView;
  private payloadHud?: PrototypeHud;
  private previousPayload!: ReturnType<RailPayload['snapshot']>;

  initPayload(
    level: LevelDefinition,
    distance: number,
    loadModels: boolean,
  ): void {
    this.payloadDefinition = level.payload!;
    const t = this.ctx.tuning.prototypes.payload;
    this.payload = new RailPayload(
      this.payloadDefinition.route,
      this.payloadDefinition.stops.map((stop) => ({
        ...stop,
        holdS: 0,
        wave: '',
        clearRequired: false,
      })),
      t,
      {
        reinforce: () => {},
        canDepart: (id) =>
          this.objectiveModel()!.objectives[
            this.payloadDefinition.stops.find((stop) => stop.id === id)!
              .unlockAfter
          ] === 'done',
      },
    );
    this.payloadHealth = new Health(() => t.maxHealth);
    this.payloadId = this.entities.create('payloadWagon', 'neutral');
    this.damage.register(this.payloadId, this.payloadHealth, {
      guard: (info) =>
        info.source === null || this.entities.team(info.source) === 'enemy'
          ? 1
          : 0,
    });
    this.payloadCollider = this.world.createCollider(
      this.rapier.ColliderDesc.cuboid(
        t.bodyHalfLengthM,
        t.bodyHalfHeightM,
        t.bodyHalfWidthM,
      ).setCollisionGroups(
        interactionGroups(
          CollisionGroup.Player,
          CollisionGroup.EnemyProjectile | CollisionGroup.Enemy,
        ),
      ),
    );
    this.hurtboxes.add(this.payloadId, this.payloadCollider);
    this.entities.bindCollider(this.payloadId, this.payloadCollider.handle);
    this.payloadView = new PayloadView(t);
    this.root.add(this.payloadView.root);
    if (loadModels) void this.payloadView.load();
    if (typeof document !== 'undefined')
      this.payloadHud = new PrototypeHud(
        document.querySelector<HTMLElement>('.mission-hud') ?? document.body,
      );
    this.restorePayload(distance);
  }

  restorePayload(distance: number): void {
    if (
      this.objectiveModel()!.objectives[this.payloadDefinition.objective] ===
      'done'
    )
      distance = this.payload.lengthM;
    this.payload.restore(distance);
    this.payloadHealth.reset();
    this.previousPayload = this.payload.snapshot();
    this.syncPayload();
  }

  setPayloadHp(hp: number): void {
    this.payloadHealth.set(hp);
    this.payload.setHp(this.payloadHealth.current);
  }

  override step(dt: number, input: InputSnapshot): void {
    super.step(dt, input);
    if (!this.payload || !(dt > 0)) return;
    this.previousPayload = this.payload.snapshot();
    this.payload.setHp(this.payloadHealth.current);
    const hostiles: Vec3[] = [];
    this.manager.forEach((enemy) => {
      if (!enemy.removed && enemy.current.state !== 'dead')
        hostiles.push(enemy.current.position);
    });
    this.payload.step(dt, {
      player: this.player.getState().position,
      hostiles,
    });
    this.syncPayload();
    if (this.payload.status === 'arrived')
      this.objectiveModel()!.done(this.payloadDefinition.objective);
  }

  private syncPayload(): void {
    const pose = this.payload.snapshot();
    const yaw = pose.yaw - Math.PI / 2;
    this.payloadCollider.setTranslation({
      ...pose.position,
      y: pose.position.y + this.ctx.tuning.prototypes.payload.bodyHalfHeightM,
    });
    this.payloadCollider.setRotation({
      x: 0,
      y: Math.sin(yaw / 2),
      z: 0,
      w: Math.cos(yaw / 2),
    });
    this.payloadCollider.setEnabled(!this.payload.finished);
    const text = prototypeText.payload;
    this.payloadHud?.update({
      title: text.title,
      status: text[pose.status],
      hp: { label: text.hp, current: pose.hp, max: pose.maxHp },
      bar: { label: text.progress, value: pose.progress },
      detail: pose.stopName ?? '',
      outcome: pose.status === 'destroyed' ? 'failure' : null,
    });
  }

  override render(alpha: number, frameDt?: number): void {
    super.render(alpha, frameDt);
    if (this.payload)
      this.payloadView?.update(
        lerpPose(this.previousPayload, this.payload.snapshot(), alpha),
        this.payload.status === 'waitingPlayer',
      );
  }

  override dispose(): void {
    this.payloadView?.dispose();
    this.payloadHud?.dispose();
    if (this.payloadId !== undefined) {
      this.hurtboxes.removeEntity(this.payloadId);
      this.damage.unregister(this.payloadId);
      this.entities.destroy(this.payloadId);
    }
    super.dispose();
  }
}
