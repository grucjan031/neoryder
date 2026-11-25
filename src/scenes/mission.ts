import type { Scene as ThreeScene } from 'three';
import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three';
import type { Collider } from '@dimforge/rapier3d-compat';
import type { Vec3 } from '../core/math';
import { Health } from '../combat/damage';
import type { Enemy, EnemyDependencies } from '../enemies/types';
import { CollisionGroup, interactionGroups } from '../physics';
import { RailPayload, saboteurFocus } from '../world/railPayload';
import { PayloadView, EscortNpcView } from './prototypeViews';
import { lerpPose } from './prototypeScene';
import { PrototypeHud } from '../ui/prototypeHud';
import prototypeText from '../data/ui/prototypes.pl.json';
import type { GameContext } from '../core/context';
import { EventBus, type EntityId } from '../core/events';
import type { InputSnapshot } from '../core/input';
import type { RunSummary } from '../core/runTypes';
import { MetaManager } from '../progression/meta';
import { Rng } from '../core/rng';
import { MissionHints } from '../world/missionHints';
import type { HintEvent } from '../world/missionSchema';
import { MissionHintPanel } from '../ui/missionHints';
import {
  createIndexedDbSaveStore,
  loadSettings,
  saveSettings,
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
import type { CameraPose, Scene } from './index';

export interface MissionSceneOptions {
  params?: URLSearchParams;
  store?: SaveStore;
  navigate?: (url: string) => void;
  loadModels?: boolean;
  /** Testy map: encountery nigdy się nie uruchamiają (brak wrogów). */
  peaceful?: boolean;
}
type ActiveEncounter = {
  director: WaveDirector;
  enemies: Set<EntityId>;
  dispose(): void;
};

/** Host jednej ciągłej mapy; nie tworzy RunState ani RunManager. */
export class MissionScene implements Scene {
  readonly id = 'mission';
  private ctx!: GameContext;
  private definition!: MissionDefinition;
  private level!: LevelDefinition;
  private runtime!: LevelRuntime;
  private snapshot!: MissionSave & { kills: number };
  private room?: RoomScene;
  private payloadRoom?: PayloadMissionRoom;
  private radio?: MissionRadio;
  private hints?: MissionHints;
  private hintPanel?: MissionHintPanel;
  private displayedHint: MissionHints['current'] = null;
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
  private scriptedAlarm?: string;
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
      this.snapshot = { ...saved, kills: saved.kills ?? 0 };
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
        kills: 0,
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
    for (const objective of definition.objectives)
      if (
        objective.kind === 'subdue' &&
        this.snapshot.objectives[objective.neutralizeWith] !== 'done'
      )
        this.snapshot.objectives[objective.id] = 'pending';
    this.runtime = new LevelRuntime(
      this.level,
      this.snapshot.completedEncounters,
      this.snapshot.raisedAlarms,
      this.snapshot.bonusStates,
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
    const Room = this.level.payload
      ? PayloadMissionRoom
      : definition.objectives.some((o) => o.kind === 'subdue')
        ? SubdueMissionRoom
        : RoomScene;
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
          bonusState: (id) => this.runtime.bonusStates[id],
          objectives: this.snapshot.objectives,
        },
        reinforce: (_wave, key) => this.pendingReinforcements.add(key),
        missionSignal: (trigger) => {
          if (
            this.definition.objectives.some(
              (o) =>
                o.kind === 'subdue' && trigger === `objective:${o.id}:done`,
            )
          )
            this.signal('boss:defeated');
          this.objectiveSignal(trigger);
          this.signal(trigger);
          if (trigger.endsWith(':done')) {
            this.persist();
            if (trigger === 'objective:exit:done') this.finishPending = true;
          }
        },
      },
    );
    if (definition.hints?.length && typeof document !== 'undefined')
      this.initHints();
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
      (!(this.room instanceof SubdueMissionRoom) ||
        this.room.canCompleteCapture(objective)) &&
      this.runtime.satisfied(
        this.level.objectiveAfter?.[objective.id],
        objectives.objectives,
      );
    if (
      typeof document !== 'undefined' &&
      definition.objectives.some(
        (o) => o.kind === 'reach' || o.kind === 'subdue',
      )
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
        () => this.signal('payload:attacked'),
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
      ctx.bus.on('alarm_raised', ({ groupId }) => {
        if (this.runtime.raisedAlarms.has(groupId)) return;
        this.runtime.raisedAlarms.add(groupId);
        for (const b of definition.bonuses ?? [])
          if (b.alarmGroup === groupId && !this.runtime.bonusStates[b.id])
            this.runtime.bonusStates[b.id] = 'failed';
        this.signal(`alarm:${groupId}`, this.scriptedAlarm === groupId);
      }),
      ctx.bus.on('enemy_killed', ({ killer }) => {
        if (
          (this.state === 'playing' || this.state === 'respawning') &&
          killer === this.room?.playerId
        )
          this.snapshot.kills++;
      }),
      ctx.bus.on('player_died', ({ id }) => {
        if (id !== this.room?.playerId || this.state !== 'playing') return;
        this.state = 'respawning';
        this.deathTimer = ctx.tuning.level.respawnDelayS;
      }),
      // Boss spotkania nie jest bossem pokoju, więc RoomScene nie zgłasza jego faz.
      ctx.bus.on('boss_phase', ({ phase }) => {
        if (phase === 2 || phase === 3) this.signal(`boss:phase:${phase}`);
      }),
    );
    this.registerCommands();
    this.state = 'playing';
    this.ready = true;
    this.updateGates();
    this.persist();
    this.signal('runStart');
    await this.saving;
  }

  private forceAlarm(group: string): void {
    if (this.runtime.raisedAlarms.has(group)) return;
    this.room?.forceEncounterAlarm(group);
    if (!this.runtime.raisedAlarms.has(group))
      this.ctx.bus.emit('alarm_raised', { groupId: group });
  }

  private objectiveSignal(trigger: string): void {
    const [, id, action, percent] = trigger.split(':');
    if (action === 'done') {
      for (const b of this.definition.bonuses ?? []) {
        if (b.until !== id || this.runtime.bonusStates[b.id]) continue;
        this.runtime.bonusStates[b.id] = 'done';
        this.signal(`bonus:${b.id}:done`);
      }
    }
    if (action !== 'progress') return;
    const o = this.definition.objectives.find((o) => o.id === id);
    if (
      o?.kind !== 'defend' ||
      !o.raiseAlarm ||
      Number(percent) !== Math.round(o.raiseAlarm.atProgress * 100)
    )
      return;
    this.scriptedAlarm = o.raiseAlarm.group;
    try {
      this.forceAlarm(this.scriptedAlarm);
    } finally {
      this.scriptedAlarm = undefined;
    }
  }

  private signal(trigger: string, skipRadio = false): void {
    if (!skipRadio) this.radio?.signal(trigger, this.objectives());
    if (this.hints && loadSettings().missionHints) this.hints.trigger(trigger);
  }

  private initHints(): void {
    const { id, hints } = this.definition;
    this.hints = new MissionHints(hints!, loadSettings().seenMissionHints[id]);
    this.hintPanel = new MissionHintPanel();
    const event = (name: HintEvent, actor?: EntityId) => {
      if (
        this.state === 'playing' &&
        (actor === undefined || actor === this.room?.playerId)
      )
        this.hints!.event(name);
    };
    const bus = this.ctx.bus;
    let overheated = false;
    this.off.push(
      bus.on('player_jumped', (e) => event('player_jumped', e.id)),
      bus.on('dash_used', (e) => event('dash_used', e.user)),
      bus.on('melee_swing', (e) => event('melee_swing', e.attacker)),
      bus.on('parry_success', (e) => event('parry_success', e.defender)),
      bus.on('weapon_fired', (e) => event('weapon_fired', e.owner)),
      bus.on('power_used', (e) => event('power_used', e.user)),
      bus.on('execute_performed', (e) =>
        event('execute_performed', e.attacker),
      ),
      bus.on('heat_changed', (e) => {
        if (e.id !== this.room?.playerId) return;
        if (e.overheated && !overheated) event('overheated', e.id);
        overheated = e.overheated;
      }),
      bus.on('enemy_executable', (e) => {
        if (e.ready) event('enemy_executable');
      }),
    );
  }

  private updateHints(dt: number): void {
    if (!this.hints) return;
    const settings = loadSettings();
    if (settings.missionHints && this.state === 'playing') this.hints.step(dt);
    else this.hints.clear();
    const hint = this.hints.current;
    if (hint === this.displayedHint) return;
    this.displayedHint = hint;
    this.hintPanel?.show(hint);
    if (hint) {
      settings.seenMissionHints[this.definition.id] = [...this.hints.seen];
      saveSettings(settings);
    }
  }

  /** Wyzwalacze poziomu muszą wskazywać istniejące sekcje, spotkania i punkty. */
  private validateRadio(): void {
    const known: Record<string, readonly { id: string }[]> = {
      enterSection: this.level.sections,
      encounter: this.level.encounters,
      checkpoint: this.level.checkpoints,
      objective: this.definition.objectives,
      bonus: this.definition.bonuses ?? [],
      alarm: this.level.encounters.flatMap((e) =>
        e.stealth ? [{ id: e.stealth.alarmGroup ?? e.id }] : [],
      ),
    };
    for (const { trigger } of [
      ...this.definition.radio,
      ...(this.definition.hints ?? []),
    ]) {
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
    if (!this.definition.bonuses?.length)
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
    this.snapshot.objectives = { ...this.objectives() };
    this.snapshot.checkpointId = id;
    this.snapshot.raisedAlarms = [...this.runtime.raisedAlarms];
    this.snapshot.bonusStates = { ...this.runtime.bonusStates };
    this.snapshot.completedEncounters = [...this.runtime.completed];
    this.persist();
    this.room?.restoreAllies();
    this.signal(`checkpoint:${id}`);
  }

  private startEncounter(id: string): void {
    if (this.options.peaceful) return;
    if (this.active.has(id) || this.runtime.completed.has(id)) return;
    const encounter = this.level.encounters.find((item) => item.id === id)!;
    const definition = structuredClone(levelWaves.get(encounter.wave)!);
    const assaultPoints = definition.spawnPoints;
    definition.spawnPoints = encounter.spawnPoints;
    definition.maxAlive = Math.min(
      definition.maxAlive,
      this.ctx.tuning.level.maxAlive,
    );
    const enemies = new Set<EntityId>();
    let marked = 0;
    let patrolIndex = 0;
    let turn = 0;
    // Muzyka i efekty walki słuchają globalnego wave_started. Patrol ma lokalny cykl fali.
    const waveBus = encounter.stealth ? new EventBus() : this.ctx.bus;
    const off = encounter.stealth
      ? this.ctx.bus.on('enemy_killed', (e) => waveBus.emit('enemy_killed', e))
      : undefined;
    const director = new WaveDirector(
      definition,
      {
        spawn: (enemy, position) => {
          if (turn !== director.wave) {
            turn = director.wave;
            marked = 0;
          }
          const assault =
            marked < (encounter.saboteurs ?? 0) && this.payloadRoom;
          const groupId = encounter.stealth?.alarmGroup ?? encounter.id;
          const station = encounter.stealth?.patrols?.find(
            (p) => p.enemy === enemy,
          );
          const spawn = station
            ? station.points[0]!
            : assault
              ? assaultPoints[marked % assaultPoints.length]!
              : position;
          const id = this.room!.spawnEncounterEnemy(
            enemy,
            {
              ...spawn,
              y: station?.points[0]?.y ?? encounter.spawnHeightM ?? position.y,
            },
            undefined,
            undefined,
            encounter.stealth
              ? {
                  groupId,
                  reportedAt: this.runtime.raisedAlarms.has(groupId)
                    ? { ...this.room!.playerSnapshot().position }
                    : undefined,
                  visionAngleDeg: encounter.stealth.visionAngleDeg,
                  visionRangeM: encounter.stealth.visionRangeM,
                  sentry: enemy === 'drone',
                  patrol:
                    station ??
                    encounter.stealth.patrols?.[
                      patrolIndex % (encounter.stealth.patrols.length || 1)
                    ],
                }
              : undefined,
          );
          if (id !== null && encounter.stealth) patrolIndex++;
          if (id !== null) enemies.add(id);
          if (id !== null && assault) {
            assault.markSaboteur(id);
            marked++;
          }
          if (
            id !== null &&
            encounter.bossFor &&
            this.room instanceof SubdueMissionRoom
          )
            this.room.bindCapture(id, encounter.bossFor);
          return id;
        },
        playerPosition: () => this.room!.playerSnapshot().position,
        // Boss oraz obsadzone stanowiska patrolu mają stałą liczebność.
        ...(encounter.bossFor ||
        encounter.stealth?.patrols?.some((p) => p.enemy)
          ? { difficulty: 'normal' as const }
          : {}),
      },
      waveBus,
      new Rng(this.snapshot.seed).fork(`encounter:${id}`),
    );
    this.runtime.active.add(id);
    this.active.set(id, {
      director,
      enemies,
      dispose: () => {
        off?.();
        director.dispose();
      },
    });
    director.start();
    this.signal(`encounter:${id}:started`);
  }

  private updateGates(): void {
    const open = new Set(this.runtime.openGates(this.objectives()));
    for (const gate of this.level.gates)
      this.room?.setLevelGate(gate.id, gate.block, open.has(gate.id));
  }

  private respawn(): void {
    for (const entry of this.active.values()) entry.dispose();
    this.active.clear();
    this.pendingReinforcements.clear();
    this.runtime = new LevelRuntime(
      this.level,
      this.snapshot.completedEncounters,
      this.snapshot.raisedAlarms,
      this.snapshot.bonusStates,
    );
    const point = this.currentCheckpoint();
    if (this.definition.bonuses?.length)
      Object.assign(
        this.room!.objectiveModel()!.objectives,
        this.snapshot.objectives,
      );
    this.room!.resetLevelCombat(point.position, point.yawDeg);
    this.room!.objectiveModel()?.resetTimers();
    this.payloadRoom?.restorePayload(point.payloadDistanceM!);
    this.state = 'playing';
    this.updateGates();
    this.persist();
  }

  step(dt: number, input: InputSnapshot): void {
    if (!this.ready || this.disposed) return;
    this.radio?.setCombat(this.runtime.inCombat);
    this.radio?.step(dt);
    this.updateHints(dt);
    if (this.state === 'respawning') {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) this.respawn();
      return;
    }
    if (this.state !== 'playing') return;
    this.snapshot.elapsedS += dt;
    this.room!.step(dt, input);
    if (this.room!.objectiveModel()?.failed) {
      if (
        this.definition.objectives.some(
          (o) =>
            o.kind === 'subdue' && o.id === this.room!.objectiveModel()!.failed,
        )
      ) {
        this.failPayload();
        return;
      }
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
      const capture = this.definition.objectives.find(
        (o) =>
          o.kind === 'subdue' &&
          this.level.encounters.find((e) => e.id === id)?.bossFor === o.id,
      );
      if (capture?.kind === 'subdue') {
        if (this.objectives()[capture.neutralizeWith] !== 'done') continue;
        entry.director.stop();
        entry.dispose();
        this.active.delete(id);
        this.runtime.clear(id);
        this.room!.allyDependencyDone('encounter', id);
        this.signal(`encounter:${id}:done`);
        continue;
      }
      const encounter = this.level.encounters.find((e) => e.id === id)!;
      const section =
        encounter.stealth &&
        this.level.sections.find((s) =>
          insideLevelZone(encounter.zone.position, s.zone),
        );
      if (
        entry.director.currentPhase === 'done' ||
        (section &&
          this.runtime.quiet(id) &&
          !insideLevelZone(position, section.zone))
      ) {
        entry.dispose();
        this.active.delete(id);
        this.runtime.clear(id);
        const bossFor = this.level.encounters.find(
          (item) => item.id === id,
        )?.bossFor;
        if (bossFor) {
          // Kolejność jak w pokoju bossa: ostatnie słowa, potem ukończenie celu.
          this.signal('boss:defeated');
          this.room!.objectiveModel()?.done(bossFor);
        }
        this.room!.allyDependencyDone('encounter', id);
        this.signal(`encounter:${id}:done`);
      }
    }
    for (const section of this.level.sections) {
      if (
        !this.sections.has(section.id) &&
        insideLevelZone(position, section.zone)
      ) {
        this.sections.add(section.id);
        if (section.radio) this.signal(section.radio);
        this.signal(`enterSection:${section.id}`);
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

  render(alpha: number, frameDt?: number, cameraOverride?: CameraPose): void {
    if (!this.ready || this.disposed) return;
    this.room?.render(alpha, frameDt, cameraOverride);
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
    this.snapshot.bonusStates = { ...this.runtime.bonusStates };
    this.snapshot.raisedAlarms = [...this.runtime.raisedAlarms];
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
        kills: this.snapshot.kills,
        roomsCleared: 0,
        elitesCleared: 0,
        layerReached: 0,
        threatLevel: this.snapshot.threatLevel,
        implants: this.snapshot.implants,
        damage: { melee: 0, power: 0, gun: 0, other: 0 },
      };
      const result = meta.applyRun(summary, this.snapshot.attemptId);
      const bonuses = (this.definition.bonuses ?? []).map((b) => ({
        label: b.label,
        done: this.runtime.bonusStates[b.id] === 'done',
        data: this.runtime.bonusStates[b.id] === 'done' ? b.reward.data : 0,
      }));
      const extra = bonuses.reduce((sum, b) => sum + b.data, 0);
      let settled = meta;
      if (result.applied && extra > 0) {
        const state = meta.serialize();
        state.data += extra;
        state.lastRuns[0]!.rewards.data += extra;
        settled = MetaManager.restore(state);
      }
      await saveMetaManager(this.store, settled);
      await this.store.clearMission!();
      if (this.disposed) return;
      this.state = 'summary';
      if (typeof document !== 'undefined')
        this.disposeSummary = showLinearSummary(
          this.definition,
          () => this.navigate('?scene=hub'),
          bonuses,
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
    register('alarm', 'alarm <grupa> | alarm state', ([group]) => {
      const groups = [
        ...new Set(
          this.level.encounters.flatMap((e) =>
            e.stealth ? [e.stealth.alarmGroup ?? e.id] : [],
          ),
        ),
      ];
      if (group === 'state')
        return JSON.stringify({
          groups,
          raised: [...this.runtime.raisedAlarms],
          bonuses: Object.fromEntries(
            (this.definition.bonuses ?? []).map((b) => [
              b.id,
              this.runtime.bonusStates[b.id] ?? 'pending',
            ]),
          ),
          guards: this.room?.encounterObservers(),
        });
      if (!group || !groups.includes(group) || this.state !== 'playing')
        return 'Nieznana lub niedostępna grupa.';
      this.forceAlarm(group);
      return 'Alarm ogłoszony.';
    });
    register('hints', 'hints reset|off|on|list', ([action]) => {
      const settings = loadSettings();
      const { id, hints = [] } = this.definition;
      if (action === 'list')
        return (
          hints
            .map(
              (h) =>
                `${h.id}: ${this.hints?.seen.has(h.id) ? 'pokazana' : 'nowa'}`,
            )
            .join('\n') || 'Brak podpowiedzi.'
        );
      if (action === 'reset') {
        delete settings.seenMissionHints[id];
        if (this.hints) {
          this.hints = new MissionHints(hints);
          if (settings.missionHints) this.hints.trigger('runStart');
        }
      } else if (action === 'off' || action === 'on')
        settings.missionHints = action === 'on';
      else return 'hints reset|off|on|list';
      saveSettings(settings);
      this.updateHints(0);
      return 'OK';
    });
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
          if (
            this.definition.objectives.some(
              (o) =>
                o.kind === 'subdue' &&
                this.level.encounters.find((e) => e.id === id)?.bossFor ===
                  o.id,
            )
          )
            continue;
          entry.director.stop();
          entry.dispose();
          this.room!.removeEncounterEnemies([...entry.enemies]);
          this.runtime.clear(id);
          this.room!.allyDependencyDone('encounter', id);
          this.signal(`encounter:${id}:done`);
          this.active.delete(id);
        }
        this.updateGates();
        return 'Spotkania ukończone.';
      },
    );
    if (this.payloadRoom) {
      register(
        'payload saboteurs',
        'payload saboteurs — żywi sabotażyści i ich cele',
        () => JSON.stringify(this.payloadRoom!.saboteurTargets()),
      );
      register(
        'payload ambush',
        'payload ambush — ustaw podgląd zasadzki na rogatce',
        () => {
          const room = this.payloadRoom!;
          const stop = this.level.payload!.stops.find((s) => s.id === 'laser');
          const gate = this.level.encounters.find((e) => e.id === 'rogatka');
          if (!stop || !gate || this.state !== 'playing')
            return 'Zasadzka niedostępna.';
          room.payload.restore(stop.atM);
          room.objectiveModel()?.done('barricade');
          this.updateGates();
          const at = room.payload.position;
          room.teleportPlayer({ x: at.x - 10, y: at.y, z: at.z + 9 }, -58);
          this.startEncounter(gate.id);
          return 'Rogatka — zasadzka.';
        },
      );
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
      this.signal(args.join(' '));
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
            raisedAlarms: [...this.runtime.raisedAlarms],
            bonusStates: { ...this.runtime.bonusStates },
            inCombat: this.runtime.inCombat,
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
    for (const entry of this.active.values()) entry.dispose();
    this.active.clear();
    this.room?.dispose();
    this.radio?.dispose();
    this.hintPanel?.dispose();
    this.direction?.dispose();
    this.chaseClock?.remove();
    for (const view of this.objectiveNpcs) view.dispose();
    this.disposeSummary?.();
  }
}

/** Adapter pojmania: zmiany dotyczą wyłącznie instancji celu w tej misji. */
class SubdueMissionRoom extends RoomScene {
  private captive?: {
    enemy: Enemy;
    health: Health;
    objective: Extract<MissionObjective, { kind: 'subdue' }>;
  };
  private captureOff?: () => void;

  canCompleteCapture(objective: MissionObjective): boolean {
    if (objective.kind !== 'subdue') return true;
    return (
      this.captive?.objective.id === objective.id &&
      !this.captive.health.dead &&
      this.captive.health.current <=
        this.captive.health.max * objective.hpFraction
    );
  }

  bindCapture(id: EntityId, objectiveId: string): void {
    const model = this.objectiveModel()!;
    const objective = model.mission.objectives.find(
      (o) => o.id === objectiveId,
    );
    if (objective?.kind !== 'subdue') return;
    let target: Enemy | undefined;
    this.manager.forEach((enemy) => {
      if (enemy.id === id) target = enemy;
    });
    if (!target || target.definition.kind !== 'boss')
      throw new Error('Subdue wymaga bossa.');
    const enemy = target;
    const health = this.damage.health(id)!;
    this.captive = { enemy, health, objective };
    const apply = health.apply.bind(health);
    const step = enemy.step.bind(enemy);
    const subdued = () => health.current <= health.max * objective.hpFraction;
    // Limit po modyfikatorach; oryginalny BossHealth nadal pilnuje progów faz.
    health.apply = (info) =>
      apply({
        amount: Math.min(
          info.amount,
          Math.max(0, health.current - health.max * objective.hpFraction),
        ),
      });
    enemy.step = (dt) => {
      if (!subdued() || health.dead) {
        step(dt);
        return;
      }
      Object.assign(enemy.previous, structuredClone(enemy.current));
      enemy.current.state = 'stunned';
      enemy.current.knockdown = {
        x: Math.sin(enemy.current.yaw),
        z: Math.cos(enemy.current.yaw),
      };
      enemy.current.attack = undefined;
      enemy.current.field = undefined;
      enemy.current.speed = 0;
      enemy.current.stateTimeS += dt;
    };
    this.captureOff?.();
    this.captureOff = this.ctx.bus.on('enemy_killed', (event) => {
      if (event.id === id) model.failed = objective.id;
    });
    this.ctx.bus.emit('boss_spawned', {
      id,
      name: objective.targetName,
      maxHealth: health.max,
      phaseThresholds: enemy.definition
        .boss!.phases.slice(1)
        .map((p) => p.hpThreshold),
    });
  }

  override step(dt: number, input: InputSnapshot): void {
    const captive = this.captive;
    const model = this.objectiveModel()!;
    if (captive && !captive.enemy.removed) {
      const { enemy, health, objective } = captive;
      if (health.dead) model.failed = objective.id;
      else if (
        this.canCompleteCapture(objective) &&
        model.objectives[objective.id] !== 'done'
      ) {
        const interaction = model.mission.objectives.find(
          (o) => o.id === objective.neutralizeWith,
        )!;
        if (interaction.kind === 'interact')
          interaction.position = {
            ...enemy.current.position,
            y:
              enemy.current.position.y -
              enemy.definition.body!.controllerOffset,
          };
        model.done(objective.id);
      }
    }
    super.step(dt, input);
  }

  override resetLevelCombat(position: Vec3, yawDeg: number): void {
    this.captureOff?.();
    this.captive = undefined;
    const model = this.objectiveModel();
    for (const objective of model?.mission.objectives ?? [])
      if (
        objective.kind === 'subdue' &&
        model!.objectives[objective.neutralizeWith] !== 'done'
      ) {
        model!.objectives[objective.id] = 'pending';
        model!.progress[objective.id] = 0;
        model!.progress[objective.neutralizeWith] = 0;
      }
    super.resetLevelCombat(position, yawDeg);
  }

  override query(name: string): unknown {
    if (name === 'subdue') {
      const c = this.captive;
      return c
        ? {
            id: c.enemy.id,
            hp: c.health.current,
            maxHp: c.health.max,
            subdued: this.canCompleteCapture(c.objective),
            position: { ...c.enemy.current.position },
            captured:
              this.objectiveModel()!.objectives[c.objective.neutralizeWith] ===
              'done',
          }
        : null;
    }
    return super.query(name);
  }

  override dispose(): void {
    this.captureOff?.();
    super.dispose();
  }
}

/** Adapter prototypu do hosta misji; wspólny RoomScene pozostaje bez zmian. */
class PayloadMissionRoom extends RoomScene {
  private readonly saboteurs = new Map<
    EntityId,
    { until: number; target: string }
  >();
  private clockS = 0;
  private hitFlashUntil = 0;
  private flash?: Mesh<BoxGeometry, MeshBasicMaterial>;
  private offDamage?: () => void;
  private attacked = false;

  markSaboteur(id: EntityId): void {
    this.saboteurs.set(id, { until: 0, target: 'drużyna' });
  }

  saboteurTargets() {
    const list: {
      id: EntityId;
      target: string;
      kind: string;
      state: string;
      position: Vec3;
    }[] = [];
    this.manager.forEach((e) => {
      const role = this.saboteurs.get(e.id);
      if (role && !e.removed && e.current.state !== 'dead')
        list.push({
          id: e.id,
          target: role.target,
          kind: e.definition.kind,
          state: e.current.state,
          position: e.current.position,
        });
    });
    return list;
  }

  protected override enemyTarget(
    enemy: { id: EntityId | null; position: Vec3 },
    player: ReturnType<EnemyDependencies['getTarget']>,
  ) {
    const role = enemy.id === null ? undefined : this.saboteurs.get(enemy.id);
    if (!role) return super.enemyTarget(enemy, player);
    const focus = saboteurFocus(
      role,
      this.clockS,
      enemy.position,
      player?.position,
      this.payload,
      this.ctx.tuning.missions,
    );
    if (focus === 'gracz' && player) {
      role.target = 'gracz';
      return player;
    }
    if (focus === 'wagon' && !this.payloadHealth.dead) {
      role.target = 'wagon';
      const center = this.payloadCollider.translation();
      const position =
        this.payloadCollider.projectPoint(
          { ...enemy.position, y: center.y },
          true,
        )?.point ?? center;
      return { id: this.payloadId, position };
    }
    const fallback = super.enemyTarget(enemy, player);
    role.target = !fallback
      ? 'brak'
      : fallback.id === player?.id
        ? 'gracz'
        : 'sojusznik';
    return fallback;
  }
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
    onAttacked: () => void,
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
          ? this.ctx.tuning.missions.payloadEnemyDamageScale
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
    this.flash = new Mesh(
      new BoxGeometry(
        2 * t.bodyHalfLengthM,
        2 * t.bodyHalfHeightM,
        2 * t.bodyHalfWidthM,
      ),
      new MeshBasicMaterial({
        color: 0xff601c,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    this.flash.visible = false;
    this.flash.position.y = t.bodyHalfHeightM;
    this.payloadView.root.add(this.flash);
    this.offDamage = this.ctx.bus.on(
      'damage_dealt',
      ({ source, target, amount }) => {
        if (amount <= 0) return;
        const role = this.saboteurs.get(target);
        if (role && source === this.playerId)
          role.until = this.clockS + this.ctx.tuning.missions.saboteurAggroS;
        if (target !== this.payloadId) return;
        this.hitFlashUntil =
          this.clockS + this.ctx.tuning.missions.payloadHitFlashS;
        if (!this.attacked && source !== null && this.saboteurs.has(source)) {
          this.attacked = true;
          onAttacked();
        }
      },
    );
    this.root.add(this.payloadView.root);
    if (loadModels) void this.payloadView.load();
    if (typeof document !== 'undefined')
      this.payloadHud = new PrototypeHud(
        document.querySelector<HTMLElement>('.mission-hud') ?? document.body,
      );
    this.restorePayload(distance);
  }

  restorePayload(distance: number): void {
    this.saboteurs.clear();
    this.hitFlashUntil = 0;
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
    this.clockS += dt;
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

  override render(
    alpha: number,
    frameDt?: number,
    cameraOverride?: CameraPose,
  ): void {
    super.render(alpha, frameDt, cameraOverride);
    if (this.payload)
      this.payloadView?.update(
        lerpPose(this.previousPayload, this.payload.snapshot(), alpha),
        this.payload.status === 'waitingPlayer',
      );
    if (this.flash)
      this.flash.visible =
        this.clockS < this.hitFlashUntil && loadSettings().flashes;
  }

  override dispose(): void {
    this.payloadView?.dispose();
    this.offDamage?.();
    this.flash?.geometry.dispose();
    this.flash?.material.dispose();
    this.payloadHud?.dispose();
    if (this.payloadId !== undefined) {
      this.hurtboxes.removeEntity(this.payloadId);
      this.damage.unregister(this.payloadId);
      this.entities.destroy(this.payloadId);
    }
    super.dispose();
  }
}
