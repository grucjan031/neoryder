import { ZodError } from 'zod';
import { modeIdSchema, selectArena } from '../world/modeSchema';
import { conquestMode, modeDefinitions } from '../world/modes';
import { synergyDefinitions } from '../progression/synergies';
import type { Scene as ThreeScene } from 'three';
import type { GameContext } from '../core/context';
import type { EntityId } from '../core/events';
import type { InputSnapshot } from '../core/input';
import { Rng } from '../core/rng';
import type {
  MapNode,
  RoomPlanner,
  RunState,
  RunSummary,
} from '../core/runTypes';
import playerData from '../data/scenes/roomPlayer.json';
import { enemyDefinitions } from '../enemies/registry';
import type { ImplantDefinition } from '../progression/implantSchema';
import { implantDefinitions } from '../progression/implants';
import { RunEconomy } from '../progression/runEconomy';
import { runIdOf } from '../progression/meta';
import { MetaManager, type ApplyRunResult } from '../progression/meta';
import {
  loadMetaManager,
  loadMetaManagerStrict,
  saveMetaManager,
} from '../progression/metaSave';
import { createIndexedDbSaveStore } from '../core/save';
import type { RunEnded, SaveStore } from '../core/save';
import { loadoutDefinitions } from '../progression/loadout';
import { createRunSavePort } from '../ui/runSave';
import { HtmlRunScreens } from '../ui/runScreens';
import { pickSplash, unlockedSplashAct } from '../ui/splash';
import type { RunScreens } from '../ui/runScreens';
import { CommandRegistry } from '../ui/debugCommands';
import { preserveLiteFx } from '../render/fxMode';
import { registerMetaCommands } from '../ui/metaCommands';
import type { MetaCommandsHandle } from '../ui/metaCommands';
import { roomDefinitions } from '../world/rooms';
import type { RoomDefinition } from '../world/roomSchema';
import { RunManager } from '../world/run';
import { generateSectorMap, generateMissionMap } from '../world/sectorMap';
import { missionDefinitions } from '../world/missions';
import { MissionRadio } from '../ui/missionUi';
import { achievementDefinitions } from '../progression/achievementsSchema';
import { AchievementToast } from '../ui/achievementToast';
import { AchievementTracker } from '../progression/achievementTracker';
import type { SectorDefinition } from '../world/sectorSchema';
import { kuroganeSector } from '../world/sectors';
import { roomPlanner } from '../world/threat';
import type { WavesDefinition } from '../world/waves';
import type { Scene } from './index';
import { getLiteFx } from '../render/fxMode';
import { RoomScene } from './roomScene';
import { RunInventoryMenu, buildRunInventoryView } from '../ui/runInventory';

const CUSTOM_LOADOUT_ID = 'custom';
const REWARD_SAVE_INTERVAL_MS = 2000;
const IDLE_INPUT: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};

export interface RunSavePort {
  loadRun(): Promise<RunState | null>;
  /** Zapis runu; `ended` oznacza zakończony, jeszcze nierozliczony run (ADR 0007 pkt 2). */
  saveRun(state: RunState, ended?: RunEnded): Promise<void>;
  clearRun(): Promise<void>;
  /** Zakończenie zapisanego runu (null = run w toku albo brak zapisu); brak metody = jak null. */
  loadEnded?(): Promise<RunEnded | null>;
}

export interface RunRoom extends Scene {
  clear(): void;
  missionState?(): Pick<RunState, 'objectives' | 'objectiveProgress'>;
  /** Cisza po zwycięstwie: pokój tylko „dogrywa” oprawę, gracz nie może już zginąć. */
  enterVictoryHold?(): void;
  exportState(): Pick<RunState, 'hp' | 'energy'>;
}

export type RunRoomFactory = (
  room: RoomDefinition,
  run: RunState,
  waves: WavesDefinition,
) => RunRoom;

export interface RunSceneOptions {
  params?: URLSearchParams;
  screens?: RunScreens;
  save?: RunSavePort;
  /** Zapis meta-progresu (domyślnie IndexedDB); `RunScene` czyta z niego nagrody i ekwipunek. */
  metaStore?: SaveStore;
  planner?: RoomPlanner;
  sector?: SectorDefinition;
  rooms?: ReadonlyMap<string, RoomDefinition>;
  createRoom?: RunRoomFactory;
  implantDefinitions?: ReadonlyMap<string, ImplantDefinition>;
  /** Przejście do innego adresu (domyślnie `location.assign`); w testach atrapa. */
  navigate?: (url: string) => void;
}

export type RunLogEntry =
  | { event: 'node_selected'; nodeId: string; type: MapNode['type'] }
  | { event: 'room_cleared'; nodeId: string }
  | { event: 'reward_offered'; nodeId: string; options: readonly string[] }
  | { event: 'implant_acquired'; id: string }
  | { event: 'run_ended'; outcome: 'victory' | 'death' };

/** Host pokoi i ekranów; stan rozgrywki prowadzi RunManager. */
export class RunScene implements Scene {
  readonly id = 'run';
  private ctx!: GameContext;
  private three!: ThreeScene;
  private manager!: RunManager;
  private economy!: RunEconomy;
  private screens!: RunScreens;
  private meta!: MetaManager;
  private metaCommands: MetaCommandsHandle | null = null;
  private tracker: AchievementTracker | null = null;
  private achievementToast: AchievementToast | null = null;
  private metaResult: ApplyRunResult | null = null;
  private defeatCause: string | undefined;
  /** Zakończony run czekający na trwały zapis nagrody (null = rozliczony albo w toku). */
  private ended: RunEnded | null = null;
  /** Błąd rozliczenia pokazywany w podsumowaniu: zapis meta albo samo naliczenie. */
  private rewardError: 'save' | 'apply' | null = null;
  private settling = false;
  /** Numer bieżącego rozliczenia: przeterminowana próba nie nadpisuje błędu nowszej. */
  private settleToken = 0;
  /** Nagroda tego runu była już na dysku, ale bez rekordu w `lastRuns` (neutralny tekst). */
  private rewardAlreadySaved = false;
  /** Gracz wychodzi z podsumowania: nawigacja czeka na kolejkę zapisów. */
  private leaving = false;
  private readonly navigate: (url: string) => void;
  private metaStore: SaveStore | null = null;
  private readonly save: RunSavePort;
  private readonly sector: SectorDefinition;
  private readonly rooms: ReadonlyMap<string, RoomDefinition>;
  private missionRadio?: MissionRadio;
  private inventory?: RunInventoryMenu;
  private room: RunRoom | null = null;
  private roomId: string | null = null;
  /** Debug: nieśmiertelność nakładana na każdy nowy pokój runu. */
  private godRun = false;
  private roomReady = false;
  private roomCommands: CommandRegistry | null = null;
  private playerId: EntityId | null = null;
  private readonly enemyKinds = new Map<EntityId, string>();
  private loading: Promise<void> | null = null;
  private saving: Promise<void> = Promise.resolve();
  private pendingSaves = 0;
  private rewardSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private immediateRewardSave = false;
  private pending: 'clear' | 'end' | null = null;
  private rewardDelayRemainingS: number | null = null;
  /** Cisza po zwycięstwie: pokój bossa zostaje na ekranie, zanim pojawi się podsumowanie. */
  private victoryHoldRemainingS: number | null = null;
  private disposed = false;
  private runError: string | null = null;
  private saveError: string | null = null;
  private readonly off: (() => void)[] = [];
  private readonly log: RunLogEntry[] = [];

  constructor(private readonly options: RunSceneOptions = {}) {
    this.save = options.save ?? createRunSavePort();
    this.sector = options.sector ?? kuroganeSector;
    this.rooms = options.rooms ?? roomDefinitions;
    this.navigate =
      options.navigate ??
      ((url) => {
        if (typeof location !== 'undefined') location.assign(url);
      });
  }

  async init(ctx: GameContext, three: ThreeScene): Promise<void> {
    this.ctx = ctx;
    this.three = three;
    this.screens = this.options.screens ?? new HtmlRunScreens();
    if (typeof document !== 'undefined')
      this.inventory = new RunInventoryMenu(ctx, () =>
        buildRunInventoryView(this.manager.state),
      );
    this.manager = new RunManager(ctx.bus, {
      generateMap: (seed) => {
        const id = (
          this.options.params ??
          new URLSearchParams(
            typeof location === 'undefined' ? '' : location.search,
          )
        ).get('mission');
        const mission = id ? missionDefinitions.get(id) : undefined;
        if (id && !mission) throw new Error(`Nieznana misja: ${id}`);
        return mission
          ? generateMissionMap(mission, this.sector, seed)
          : generateSectorMap(this.sector, seed);
      },
      sector: this.sector,
      initialHp: playerData.maxHealth,
      initialEnergy: playerData.maxEnergy,
    });
    this.economy = new RunEconomy(
      this.manager,
      ctx.bus,
      this.sector,
      this.options.implantDefinitions ?? implantDefinitions,
    );
    this.off.push(
      ctx.bus.on('entity_spawned', ({ id, kind }) => {
        if (kind === 'player') this.playerId = id;
        else if (enemyDefinitions.has(kind)) this.enemyKinds.set(id, kind);
      }),
      ctx.bus.on('entity_despawned', ({ id }) => {
        if (id === this.playerId) this.playerId = null;
        this.enemyKinds.delete(id);
      }),
      ctx.bus.on('enemy_killed', ({ id, killer }) => {
        const kind = this.enemyKinds.get(id);
        if (killer === this.playerId && kind)
          this.manager.creditKill(enemyDefinitions.get(kind)?.threatCost ?? 0);
      }),
      ctx.bus.on('node_selected', (payload) =>
        this.log.push({ event: 'node_selected', ...payload }),
      ),
      ctx.bus.on('room_cleared', ({ nodeId }) => {
        if (
          nodeId !== this.manager.state.currentNodeId ||
          this.manager.screen !== 'room'
        )
          return;
        if (this.rewardDelayRemainingS !== null || this.pending) return;
        this.log.push({ event: 'room_cleared', nodeId });
        const type = this.manager.currentNode?.type;
        if (type === 'combat' || type === 'elite')
          this.rewardDelayRemainingS = this.ctx.tuning.run.rewardDelayS;
        else this.schedule('clear');
      }),
      ctx.bus.on('reward_offered', ({ nodeId, options }) =>
        this.log.push({
          event: 'reward_offered',
          nodeId,
          options: [...options],
        }),
      ),
      ctx.bus.on('implant_acquired', ({ id }) => {
        this.log.push({ event: 'implant_acquired', id });
        this.scheduleRewardSave(true);
      }),
      ctx.bus.on('currency_changed', () => this.scheduleRewardSave(false)),
      ctx.bus.on('shop_purchase', () => this.scheduleRewardSave(true)),
      ctx.bus.on('run_ended', ({ outcome, summary, cause }) => {
        this.cancelRewardSave();
        this.defeatCause = outcome === 'death' ? cause : undefined;
        this.log.push({ event: 'run_ended', outcome });
        // Opóźniamy tylko pokazanie ekranu (w fx=lite bez opóźnienia).
        const holdS =
          outcome === 'victory' && this.roomReady && !getLiteFx()
            ? this.ctx.tuning.vfx.bossVictoryHoldS
            : 0;
        if (holdS > 0) {
          this.victoryHoldRemainingS = holdS;
          this.room?.enterVictoryHold?.();
        } else this.schedule('end');
        // Rozliczenie po ustawieniu ciszy/przejścia: jego odświeżenie nie pokaże podsumowania za wcześnie.
        // Przyrosty osiągnięć dochodzą do podsumowania przed zapisem `ended`, więc przeżywają odświeżenie.
        this.finishMeta(
          this.tracker
            ? { ...summary, achievements: this.tracker.tracked }
            : summary,
        );
      }),
    );
    const params =
      this.options.params ??
      new URLSearchParams(
        typeof location === 'undefined' ? '' : location.search,
      );
    this.meta = await loadMetaManager(this.getMetaStore(), ctx.bus);
    if (this.disposed) return;
    this.tracker = new AchievementTracker(ctx.bus, {
      base: this.meta.state.achievements,
      clock: () => this.manager.state.elapsedS,
      active: () => this.manager.active,
    });
    if (typeof document !== 'undefined')
      this.achievementToast = new AchievementToast(ctx.bus);
    if (params.get('continue') === '1') {
      const state = await this.save.loadRun();
      const ended = state ? ((await this.save.loadEnded?.()) ?? null) : null;
      if (this.disposed) return;
      if (!state) {
        // Np. odświeżenie podsumowania po rozliczeniu: nie ma czego wznawiać.
        console.warn('Brak zapisu runu do wznowienia; powrót do menu.');
        this.navigate('/');
        return;
      }
      if (ended) {
        // Zakończony, nierozliczony run: rozliczenie i podsumowanie zamiast wznowienia gry.
        this.manager.restoreEnded(state, ended.summary);
        this.ended = ended;
        this.registerCommands();
        this.settle();
        await this.saving;
        return;
      }
      if (state.loadoutId !== CUSTOM_LOADOUT_ID)
        this.validateLoadout(state.loadoutId);
      this.manager.restore(state);
      this.tracker?.restore(state.achievementProgress);
    } else {
      // Nowy run nadpisze zapis runu: zostawiony, nierozliczony run najpierw rozliczamy.
      // Gdy się nie uda, zostajemy na jego podsumowaniu (ponowienie albo porzucenie nagrody).
      const leftover = await this.loadLeftover();
      if (this.disposed) return;
      if (leftover) {
        this.manager.restoreEnded(leftover.state, leftover.ended.summary);
        this.ended = leftover.ended;
        this.settle();
        await this.saving;
        if (this.disposed) return;
        if (this.ended) {
          this.registerCommands();
          this.refresh();
          return;
        }
        this.metaResult = null;
        this.rewardAlreadySaved = false;
      }
      const modeId =
        params.get('scene') === 'conquest' ||
        params.get('scene') === 'weatherTest'
          ? 'conquest'
          : params.has('mode')
            ? modeIdSchema.parse(params.get('mode'))
            : undefined;
      if (modeId && params.has('mission'))
        throw new Error('Tryb i misja wykluczają się.');
      const missionId = params.get('mission');
      const mission = missionId ? missionDefinitions.get(missionId) : undefined;
      if (
        mission &&
        !mission.requires.every((id) =>
          this.meta.state.campaign.completed.includes(id),
        )
      )
        throw new Error('Misja jest zablokowana.');
      const loadout = params.get('loadout') ?? 'classic';
      const seed = params.get('seed') ?? String(ctx.rng.getState());
      const arenaId = modeId
        ? selectArena(
            conquestMode,
            params.get('seed') ?? undefined,
            params.get('arena'),
            ctx.debug,
          )
        : undefined;
      if (loadout === 'meta') {
        const meta = this.meta.state;
        this.manager.newRun(seed, CUSTOM_LOADOUT_ID, {
          mission,
          modeId,
          arenaId,
          loadout: this.meta.loadout(),
          talents: meta.talents,
          threatLevel: meta.threat.selected,
          baseMaxHealth: playerData.maxHealth,
        });
      } else {
        this.validateLoadout(loadout);
        this.manager.newRun(seed, loadout, { mission, modeId, arenaId });
      }
    }
    const mission = missionDefinitions.get(this.manager.state.missionId ?? '');
    if (mission && typeof document !== 'undefined') {
      this.missionRadio = new MissionRadio(mission);
      if (!this.manager.state.visited.length)
        this.missionRadio.signal('runStart');
    }
    this.registerCommands();
    this.showMap();
    await this.saving;
    if (this.manager.state.modeId) {
      const node = this.manager.state.map.layers[0]![0]!;
      this.selectNode(node.id, false);
      await this.loading;
    }
  }

  private getMetaStore(): SaveStore {
    this.metaStore ??= this.options.metaStore ?? createIndexedDbSaveStore();
    return this.metaStore;
  }

  /**
   * Kolejność (ADR 0007 pkt 2): applyRun, zapis meta, clearRun. Zapis runu znika dopiero po
   * udanym zapisie meta; inaczej zostaje z `ended`, a podsumowanie proponuje ponowienie.
   */
  private finishMeta(summary: RunSummary): void {
    this.ended = {
      runId: runIdOf(this.manager.state),
      summary: structuredClone(summary),
    };
    this.metaResult = null;
    this.rewardAlreadySaved = false;
    this.settle();
  }

  /**
   * Rozlicza `this.ended` w kolejce zapisów. Po `tuning.run.rewardSaveTimeoutS` wisząca próba
   * pokazuje błąd i pozwala ponowić; ponowienie czeka w kolejce za nią (bez równoległych zapisów).
   */
  private settle(): void {
    if (!this.ended || this.settling) return;
    const token = ++this.settleToken;
    this.settling = true;
    this.rewardError = null;
    const timer = setTimeout(() => {
      if (this.disposed || token !== this.settleToken || !this.settling) return;
      console.warn('Rozliczenie nagrody trwa zbyt długo; można ponowić.');
      this.settling = false;
      this.rewardError = 'save';
      this.refresh();
    }, this.ctx.tuning.run.rewardSaveTimeoutS * 1000);
    this.refresh();
    this.persist(async () => {
      try {
        await this.settleOnce(token);
      } finally {
        clearTimeout(timer);
        if (token === this.settleToken) this.settling = false;
        this.refresh();
      }
    });
  }

  /**
   * Jedna próba rozliczenia: ślad `ended` w zapisie runu, świeży odczyt meta z dysku (błąd
   * odczytu nie nadpisuje meta), `applyRun` (idempotentne po runId), zapis meta, `clearRun`.
   * Nagroda już obecna na dysku: bez zapisu meta, tylko `clearRun` i podsumowanie.
   */
  private async settleOnce(token: number): Promise<void> {
    const ended = this.ended;
    if (!ended) return;
    const fail = (
      kind: 'save' | 'apply',
      message: string,
      error: unknown,
    ): void => {
      console.warn(message, error);
      if (token === this.settleToken) this.rewardError = kind;
    };
    try {
      await this.save.saveRun(this.manager.serialize(), ended);
    } catch (error) {
      // Dane odrzucone przez walidację nie zmienią się po ponowieniu: zostaje „Porzuć nagrodę”.
      fail(
        error instanceof ZodError ? 'apply' : 'save',
        'Nie można zapisać zakończenia runu.',
        error,
      );
      return;
    }
    const store = this.getMetaStore();
    let meta: MetaManager;
    try {
      meta = await loadMetaManagerStrict(store, this.ctx.bus);
    } catch (error) {
      fail(
        'save',
        'Nie można odczytać meta-progresu; zapis nietknięty.',
        error,
      );
      return;
    }
    let result: ApplyRunResult;
    try {
      result = meta.applyRun(ended.summary, ended.runId);
    } catch (error) {
      fail('apply', 'Nie można naliczyć nagród meta.', error);
      return;
    }
    if (result.applied) {
      try {
        await saveMetaManager(store, meta);
      } catch (error) {
        fail(
          error instanceof ZodError ? 'apply' : 'save',
          'Nie można zapisać meta-progresu.',
          error,
        );
        return;
      }
    }
    this.adoptMeta(meta);
    this.metaResult = result.applied ? result : this.recordedResult(ended);
    this.rewardAlreadySaved = this.metaResult === null;
    this.ended = null;
    this.rewardError = null;
    try {
      await this.save.clearRun();
    } catch (error) {
      // Nagroda jest zapisana; zostawiony ślad `ended` przy Kontynuuj tylko się wyczyści.
      console.warn('Nie można usunąć zapisu runu.', error);
    }
    this.dropContinueParam();
  }

  /** Nagroda z rekordu `lastRuns`, gdy run był już rozliczony na dysku (bez awansu w widoku). */
  private recordedResult(ended: RunEnded): ApplyRunResult | null {
    const record = this.meta.state.lastRuns.find(
      (run) => run.runId === ended.runId,
    );
    if (!record) return null;
    const level = this.meta.level;
    return {
      applied: false,
      rewards: record.rewards,
      achievements: (record.achievements ?? []).map((id) => {
        const def = achievementDefinitions.get(id);
        return {
          id,
          reward: {
            data: def?.reward.data ?? 0,
            cores: def?.reward.cores ?? 0,
          },
        };
      }),
      levelBefore: level,
      levelAfter: level,
      threatUnlocked: false,
    };
  }

  /** Świeżo wczytany i rozliczony stan meta staje się stanem sceny (także dla komend meta). */
  private adoptMeta(meta: MetaManager): void {
    this.meta = meta;
    this.tracker?.setBase(meta.state.achievements);
    if (!this.metaCommands || this.disposed) return;
    this.metaCommands.dispose();
    this.metaCommands = registerMetaCommands(
      this.ctx.commands,
      this.meta,
      this.getMetaStore(),
    );
  }

  /** Jawna decyzja gracza po błędzie naliczenia: usuwa zapis runu bez nagrody. */
  private abandonReward(): void {
    if (!this.ended || this.rewardError !== 'apply') return;
    this.persist(async () => {
      try {
        await this.save.clearRun();
        this.ended = null;
        this.rewardError = null;
        this.dropContinueParam();
      } catch (error) {
        console.warn('Nie można usunąć zapisu runu.', error);
      } finally {
        this.refresh();
      }
    });
  }

  /** Zostawiony w zapisie zakończony run (błąd odczytu wstrzymuje nowy run). */
  private async loadLeftover(): Promise<{
    state: RunState;
    ended: RunEnded;
  } | null> {
    if (!this.save.loadEnded) return null;
    try {
      const ended = await this.save.loadEnded();
      if (!ended) return null;
      const state = await this.save.loadRun();
      return state ? { state, ended } : null;
    } catch (error) {
      throw new Error(
        'Nie można odczytać zapisu runu; nowy run wstrzymany, żeby nie nadpisać nierozliczonej nagrody.',
        { cause: error },
      );
    }
  }

  /** Po rozliczeniu `continue=1` nie ma już czego wznawiać: odświeżenie nie rzuci błędem. */
  private dropContinueParam(): void {
    if (typeof location === 'undefined' || typeof history === 'undefined')
      return;
    const params = new URLSearchParams(location.search);
    if (params.get('continue') !== '1') return;
    params.delete('continue');
    history.replaceState(
      null,
      '',
      `${location.pathname}?${params}${location.hash}`,
    );
  }

  /** Odświeżenie ekranu; podsumowanie po ciszy zwycięstwa pokaże flushTransitions. */
  private refresh(): void {
    if (this.victoryHoldRemainingS === null && this.pending === null)
      this.show();
  }

  /** Wyjście z podsumowania czeka na kolejkę zapisów (przyciski w stanie zapisywania). */
  private leave(go: () => void): void {
    if (this.leaving) return;
    this.leaving = true;
    this.refresh();
    void this.saving.then(() => {
      if (!this.disposed) go();
    });
  }

  private validateLoadout(id: string): void {
    if (!loadoutDefinitions.has(id))
      throw new Error(`Nieznany ekwipunek: ${id}`);
  }

  private show(): void {
    if (this.disposed) return;
    this.screens.show(
      {
        screen: this.manager.screen,
        state: this.manager.serialize(),
        nodes: structuredClone(this.manager.availableNodes()),
        summary: this.manager.summary,
        cause: this.defeatCause,
        // Nagrody dopiero po potwierdzonym zapisie meta.
        meta:
          this.metaResult && !this.rewardError && !this.settling
            ? this.metaResult
            : undefined,
        rewardError: this.rewardError,
        rewardPending: this.settling,
        rewardAlreadySaved: this.rewardAlreadySaved,
        leaving: this.leaving,
        busy: this.manager.screen === 'room' && !this.roomReady,
        splash: this.loadingSplash(),
        error: this.runError,
        offers: (() => {
          const definitions =
            this.options.implantDefinitions ?? implantDefinitions;
          const tags = [
            ...this.manager.state.loadout.tags,
            ...this.manager.state.implants.flatMap(
              (id) => definitions.get(id)?.tags ?? [],
            ),
          ];
          const active = (
            all: string[],
            def: (typeof synergyDefinitions)[number],
          ) =>
            def.requires.every((tag) => all.includes(tag)) &&
            Object.entries(def.requiresCount ?? {}).every(
              ([tag, count]) =>
                all.filter((entry) => entry === tag).length >= count,
            );
          const describe = (id: string, price?: number) => {
            const implant = definitions.get(id)!;
            const target = implant.upgradesTo
              ? definitions.get(implant.upgradesTo)
              : undefined;
            return {
              id,
              label: implant.name,
              price,
              description: implant.description,
              rarity: implant.rarity,
              tags: implant.tags,
              nextRarity: target?.rarity,
              synergies: synergyDefinitions
                .filter(
                  (def) =>
                    !active(tags, def) &&
                    active([...tags, ...implant.tags], def),
                )
                .map((def) => def.name),
            };
          };
          if (this.manager.screen === 'reward')
            return this.economy.offerReward().map((id) => describe(id));
          if (this.manager.screen === 'shop')
            return this.economy
              .stockShop()
              .map(({ id, price }) => describe(id, price));
          if (this.manager.screen === 'rest')
            return this.economy.upgradeOptions().map((id) => describe(id));
          return [];
        })(),
        healPrice: this.sector.economy?.shopHealPrice,
        fallbackCredits: this.sector.economy?.puzzleCredits,
      },
      {
        selectNode: (id) => {
          this.selectNode(id);
        },
        chooseReward: (id) => {
          if (this.economy.chooseReward(id)) this.showMap();
        },
        buy: (id) => {
          this.economy.buy(id);
          this.show();
        },
        rest: (choice, id) => {
          if (this.economy.rest(choice, id)) {
            this.disposeRoom();
            this.showMap();
          }
        },
        next: () => {
          if (
            this.manager.screen === 'reward' &&
            this.economy.offerReward().length
          )
            return;
          if (this.manager.screen === 'reward') this.economy.chooseReward();
          if (this.manager.screen === 'map' || this.manager.returnToMap()) {
            this.disposeRoom();
            this.showMap();
          }
        },
        newRun: () => {
          const seed = Array.from(
            crypto.getRandomValues(new Uint32Array(4)),
            (value) => value.toString(16),
          ).join('-');
          const params = new URLSearchParams({
            scene: 'run',
            seed,
            loadout:
              this.manager.state.loadoutId === CUSTOM_LOADOUT_ID
                ? 'meta'
                : this.manager.state.loadoutId,
          });
          if (this.manager.state.modeId)
            params.set('mode', this.manager.state.modeId);
          this.leave(() => this.navigate(`/?${params}`));
        },
        hub: () => {
          const current = new URLSearchParams(
            typeof location === 'undefined' ? '' : location.search,
          );
          const params = new URLSearchParams({ scene: 'hub' });
          if (current.get('debug') === '1') params.set('debug', '1');
          preserveLiteFx(current, params);
          this.leave(() => this.navigate(`/?${params}`));
        },
        menu: () => {
          this.leave(() => this.navigate('/'));
        },
        ...(this.rewardError === 'save' && !this.settling
          ? { retrySave: () => this.settle() }
          : {}),
        ...(this.rewardError === 'apply' && this.ended
          ? { abandonReward: () => this.abandonReward() }
          : {}),
      },
    );
  }

  private showMap(): void {
    this.cancelRewardSave();
    if (this.tracker) this.manager.setAchievementProgress(this.tracker.tracked);
    const state = this.manager.serialize();
    this.persist(async () => {
      await this.save.saveRun(state);
      if (this.disposed || typeof location === 'undefined') return;
      const params = new URLSearchParams(location.search);
      if (params.get('scene') !== 'run') return;
      params.set('continue', '1');
      params.delete('seed');
      params.delete('loadout');
      history.replaceState(
        null,
        '',
        `${location.pathname}?${params}${location.hash}`,
      );
    });
    this.show();
  }

  private persist(operation: () => Promise<void>): void {
    this.pendingSaves++;
    this.saving = this.saving
      .then(operation)
      .catch((error: unknown) => {
        this.saveError = error instanceof Error ? error.message : String(error);
        console.warn('Nie można zapisać runu.', error);
      })
      .finally(() => {
        this.pendingSaves--;
      });
  }

  private cancelRewardSave(): void {
    if (this.rewardSaveTimer !== null) clearTimeout(this.rewardSaveTimer);
    this.rewardSaveTimer = null;
    this.immediateRewardSave = false;
  }

  private scheduleRewardSave(immediate: boolean): void {
    if (this.disposed || !this.manager.active) return;
    if (immediate) {
      if (this.immediateRewardSave) return;
      this.cancelRewardSave();
      this.immediateRewardSave = true;
      // Koszt, implant i leczenie muszą znaleźć się w tej samej migawce.
      queueMicrotask(() => {
        if (!this.immediateRewardSave) return;
        this.immediateRewardSave = false;
        this.saveRewards();
      });
    } else if (this.rewardSaveTimer === null && !this.immediateRewardSave) {
      this.rewardSaveTimer = setTimeout(() => {
        this.rewardSaveTimer = null;
        this.saveRewards();
      }, REWARD_SAVE_INTERVAL_MS);
    }
  }

  private saveRewards(): void {
    if (this.disposed || !this.manager.active) return;
    const state = this.manager.checkpoint();
    this.persist(() => this.save.saveRun(state));
  }

  private selectNode(id: string, resume = true): boolean {
    if (this.disposed || this.loading || !this.manager.selectNode(id))
      return false;
    this.show();
    if (resume) this.ctx.resume?.();
    this.loading = this.openRoom()
      .catch((error: unknown) => {
        this.runError = error instanceof Error ? error.message : String(error);
        this.show();
      })
      .finally(() => {
        this.loading = null;
      });
    return true;
  }

  private chooseRoom(node: MapNode, rng: Rng): RoomDefinition {
    const mission = missionDefinitions.get(this.manager.state.missionId ?? '');
    if (node.fixed) {
      const room = this.rooms.get(node.fixed.roomId);
      if (!room) throw new Error(`Nieznany pokój: ${node.fixed.roomId}`);
      return room;
    }
    const pool =
      mission?.roomPools?.find(
        (entry) =>
          entry.type === node.type &&
          entry.fromLayer <= node.layer &&
          entry.toLayer >= node.layer,
      )?.rooms ?? this.sector.roomPools?.[node.type];
    const candidates = pool
      ? pool.map((id) => {
          const room = this.rooms.get(id);
          if (!room) throw new Error(`Nieznany pokój w puli sektora: ${id}`);
          return room;
        })
      : [...this.rooms.values()].filter((room) => room.type === node.type);
    // Zapas dla sektorów bez puli danego typu: układ zwykłej walki.
    const eligible = candidates.filter(
      (room) =>
        !room.arena?.exclusive && (mission || !room.id.endsWith('Mission')),
    );
    const available = eligible.length
      ? eligible
      : [...this.rooms.values()].filter(
          (room) =>
            room.type === 'combat' &&
            !room.arena?.exclusive &&
            !room.id.endsWith('Mission'),
        );
    return rng
      .fork(`room-layout:${node.id}`)
      .pick(available.sort((a, b) => a.id.localeCompare(b.id)));
  }

  /**
   * Losowy splashart ekranu ładowania pokoju spośród odblokowanych aktów.
   * W `fx=lite` (testy) bez obrazu.
   */
  private loadingSplash(): { file: string; title: string } | undefined {
    if (
      getLiteFx() ||
      this.manager.screen !== 'room' ||
      this.roomReady ||
      !this.manager.currentNode
    )
      return undefined;
    const entry = pickSplash(
      unlockedSplashAct(
        this.meta.state.campaign.completed.length
          ? this.meta.state.campaign.completed
          : this.meta.state.stats.victories,
      ),
    );
    return entry ? { file: entry.file, title: entry.title } : undefined;
  }

  private async openRoom(): Promise<void> {
    const node = this.manager.currentNode!;
    const state = this.manager.serialize();
    const rng = new Rng(state.seed);
    const layout = this.chooseRoom(node, rng);
    const combat =
      node.type === 'combat' || node.type === 'elite' || node.type === 'boss';
    // Sklep i odpoczynek nie mają fal (nakładka otwiera się od razu po wejściu);
    // pokój bossa (layout.bossEnemy) też nie: walkę prowadzi boss, nie WaveDirector.
    const bossRoom = node.type === 'boss' && layout.bossEnemy !== undefined;
    const mission = missionDefinitions.get(state.missionId ?? '');
    const missionSector = structuredClone(this.sector);
    if (mission?.enemies && missionSector.threat) {
      missionSector.threat.unlockLayer = {};
      for (const type of ['combat', 'elite'] as const) {
        const pool = missionSector.threat.pools[type];
        if (pool)
          missionSector.threat.pools[type] = Object.fromEntries(
            Object.entries(pool).filter(([id]) =>
              mission.enemies!.includes(id),
            ),
          );
      }
    }
    const waves: WavesDefinition =
      state.modeId || node.type === 'shop' || node.type === 'rest' || bossRoom
        ? {
            id: `room:${node.id}`,
            firstBreakS: 0,
            breakS: 0,
            maxAlive: state.modeId
              ? modeDefinitions[state.modeId].maxAlive
              : bossRoom
                ? (layout.maxAlive ?? 1)
                : 1,
            minSpawnDistance: 0,
            spawnPoints: [],
            waves: [],
          }
        : (this.options.planner ?? roomPlanner).planWaves(
            layout,
            missionSector,
            node.type === 'combat' || node.type === 'elite'
              ? node
              : { ...node, type: 'combat' },
            rng,
            state.threatLevel,
          );
    const room =
      this.options.createRoom?.(layout, state, waves) ??
      new RoomScene(layout, state, waves, {
        implantDefinitions: this.options.implantDefinitions,
        missionSignal: (trigger) => this.missionRadio?.signal(trigger),
      });
    this.room = room;
    this.roomId = layout.id;
    this.roomCommands = new CommandRegistry();
    try {
      await room.init(
        {
          ...this.ctx,
          commands: this.roomCommands,
          rng: rng.fork(`room:${node.id}`),
        },
        this.three,
      );
    } catch (error) {
      try {
        room.dispose();
      } catch {
        // Niedokończony init: sprzątanie motywu robi dispose() w finally.
      }
      this.room = null;
      this.roomId = null;
      this.roomCommands = null;
      throw error;
    }
    if (this.disposed) {
      room.dispose();
      this.room = null;
      return;
    }
    // Debug/testy: `god` wydane poza pokojem włącza nieśmiertelność na cały run — każdy pokój
    // dostaje ją przed pierwszym krokiem symulacji (fx=lite na wolnym CI liczy wiele kroków na
    // klatkę, więc strażnicy zdążali zabić gracza, zanim test włączył ją w pokoju).
    if (this.godRun) this.roomCommands.execute('god');
    this.roomReady = true;
    if (!this.manager.active) {
      this.schedule('end');
      return;
    }
    if (combat) this.screens.hide();
    else {
      room.clear();
      this.flushTransitions();
    }
  }

  private schedule(transition: 'clear' | 'end'): void {
    if (transition === 'end') this.rewardDelayRemainingS = null;
    if (this.pending !== 'end') this.pending = transition;
    queueMicrotask(() => this.flushTransitions());
  }

  private flushTransitions(): void {
    if (this.disposed || !this.pending || (this.room && !this.roomReady))
      return;
    const transition = this.pending;
    this.pending = null;
    if (transition === 'end') {
      this.disposeRoom();
      this.show();
      return;
    }
    this.syncMission();
    if (!this.room || !this.manager.completeRoom(this.room.exportState()))
      return;
    if (this.manager.screen === 'shop' || this.manager.screen === 'rest') {
      this.show();
      return;
    }
    if (this.victoryHoldRemainingS !== null) return;
    this.disposeRoom();
    if (this.manager.screen === 'reward') {
      this.economy.offerReward();
      this.show();
    } else if (this.manager.screen === 'map') this.showMap();
    // Boss: completeRoom emituje run_ended, którego obsługa pokaże summary.
    this.flushTransitions();
  }

  private disposeRoom(): void {
    if (!this.room || !this.roomReady) return;
    this.room.dispose();
    this.room = null;
    this.roomId = null;
    this.roomReady = false;
    this.roomCommands = null;
    this.playerId = null;
    this.enemyKinds.clear();
  }

  private syncMission(): void {
    const state = this.room?.missionState?.();
    if (state?.objectives)
      this.manager.updateObjectives(
        state.objectives,
        state.objectiveProgress ?? {},
      );
  }

  step(dt: number, input: InputSnapshot): void {
    if (this.disposed) return;
    this.manager.step(dt);
    this.missionRadio?.step(dt);
    if (this.roomReady && this.manager.screen === 'room' && !this.pending)
      this.inventory?.step(input);
    const waitingForReward = this.rewardDelayRemainingS !== null;
    const holding = this.victoryHoldRemainingS !== null;
    // W ciszy pokój krokuje dalej (rozpad, odłamki, spowolnienie), ale bez wejścia gracza.
    if (
      this.roomReady &&
      (this.manager.screen === 'room' || holding) &&
      !this.pending
    )
      this.room?.step(dt, holding ? IDLE_INPUT : input);
    if (this.victoryHoldRemainingS !== null) {
      this.victoryHoldRemainingS = Math.max(0, this.victoryHoldRemainingS - dt);
      if (this.victoryHoldRemainingS === 0) {
        this.victoryHoldRemainingS = null;
        this.schedule('end');
      }
    }
    if (
      this.roomReady &&
      waitingForReward &&
      this.rewardDelayRemainingS !== null
    ) {
      this.rewardDelayRemainingS = Math.max(0, this.rewardDelayRemainingS - dt);
      if (this.rewardDelayRemainingS === 0) {
        this.rewardDelayRemainingS = null;
        this.schedule('clear');
      }
    }
    if (
      this.manager.active &&
      (this.manager.state.modeId === 'assault' ||
        this.manager.state.modeId === 'heist') &&
      (
        this.room?.query?.(this.manager.state.modeId) as {
          outcome?: string;
        } | null
      )?.outcome === 'death'
    ) {
      this.manager.setHp(0);
      this.manager.finish('death');
    }
    this.syncMission();
    this.flushTransitions();
  }

  render(alpha: number, frameDt?: number): void {
    if (
      this.roomReady &&
      (this.manager.screen === 'room' || this.victoryHoldRemainingS !== null)
    )
      this.room?.render(alpha, frameDt);
  }

  async whenReady(): Promise<void> {
    await this.loading;
    this.flushTransitions();
    await this.saving;
    await this.metaCommands?.settled();
  }

  query(name: string): unknown {
    switch (name) {
      case 'mission':
        return this.manager.state.missionId
          ? {
              id: this.manager.state.missionId,
              objectives:
                this.room?.missionState?.().objectives ??
                this.manager.state.objectives,
            }
          : null;
      case 'screen':
        // Wynik jest już zapisany, ale podsumowanie pojawi się dopiero po ciszy.
        return this.victoryHoldRemainingS !== null
          ? 'room'
          : this.manager.screen;
      case 'victoryHold':
        return this.victoryHoldRemainingS;
      case 'runState':
        return this.manager.serialize();
      case 'map':
        return this.manager.serialize().map;
      case 'room':
        return this.roomId;
      case 'meta':
        return this.meta.state;
      case 'achievements':
        return this.meta.state.achievements;
      case 'runAchievements':
        return this.tracker?.tracked ?? null;
      case 'level':
        return {
          ...this.meta.xpProgress,
          talentPoints: this.meta.talentPoints,
          freePoints: this.meta.freePoints,
        };
      case 'runLog':
        return structuredClone(this.log);
      case 'loading':
        return this.loading !== null;
      case 'runError':
        return this.runError;
      case 'savePending':
        return (
          this.pendingSaves > 0 ||
          this.rewardSaveTimer !== null ||
          this.immediateRewardSave
        );
      case 'saveError':
        return this.saveError;
      case 'rewardError':
        return this.rewardError;
      default:
        return this.roomReady ? this.room?.query?.(name) : undefined;
    }
  }

  private registerCommands(): void {
    const register = (
      name: string,
      help: string,
      run: (args: string[]) => string,
    ): void => {
      const off = this.ctx.commands?.register(name, help, run);
      if (off) this.off.push(off);
    };
    this.metaCommands = registerMetaCommands(
      this.ctx.commands,
      this.meta,
      this.getMetaStore(),
    );
    this.off.push(() => this.metaCommands?.dispose());
    register('run node', 'run node <id> — wybierz dostępny węzeł', (args) =>
      args.length === 1 && this.selectNode(args[0]!)
        ? 'Wczytywanie pokoju.'
        : 'Węzeł niedostępny.',
    );
    register(
      'mission start',
      'mission start <id> — rozpocznij misję',
      (args) => {
        const mission = missionDefinitions.get(args[0] ?? '');
        if (
          !mission ||
          !mission.requires.every((id) =>
            this.meta.state.campaign.completed.includes(id),
          )
        )
          return 'Misja niedostępna.';
        const params = new URLSearchParams({
          scene: mission.level ? 'mission' : 'run',
          loadout: 'meta',
          mission: mission.id,
          debug: '1',
        });
        preserveLiteFx(new URLSearchParams(window.location.search), params);
        this.navigate(`?${params.toString()}`);
        return 'Start misji.';
      },
    );
    register(
      'campaign complete',
      'campaign complete <id> — ukończ misję bez nagród (debug)',
      (args) => {
        const mission = missionDefinitions.get(args[0] ?? '');
        if (args.length !== 1 || !mission) return 'Podaj istniejące id misji.';
        const state = this.meta.serialize();
        if (state.campaign.completed.includes(mission.id))
          return 'Misja już ukończona.';
        state.campaign.completed.push(mission.id);
        this.adoptMeta(MetaManager.restore(state, this.ctx.bus));
        this.persist(() => saveMetaManager(this.getMetaStore(), this.meta));
        return 'Zapis kampanii zlecony.';
      },
    );
    register(
      'mission radio',
      'mission radio <wyzwalacz> — odtwórz komunikaty radia misji',
      (args) => {
        if (!this.missionRadio || args.length !== 1)
          return 'Brak radia misji albo wyzwalacza.';
        this.missionRadio.signal(args[0]!);
        return `Radio: ${args[0]}.`;
      },
    );
    register('objective done', 'objective done <id> — ukończ cel', (args) => {
      if (!this.roomReady || this.manager.screen !== 'room')
        return 'Brak aktywnego pokoju.';
      const result = this.roomCommands!.execute(
        ['objective done', ...args].join(' '),
      );
      this.syncMission();
      return result;
    });
    register('run clear', 'run clear — wyczyść pokój', () => {
      if (!this.roomReady || this.manager.screen !== 'room')
        return 'Brak aktywnego pokoju.';
      this.room!.clear();
      return 'Pokój wyczyszczony.';
    });
    register('run state', 'run state — stan runu', () =>
      JSON.stringify(this.manager.serialize()),
    );
    register('run end', 'run end win|lose — zakończ run', (args) => {
      if (args.length !== 1 || (args[0] !== 'win' && args[0] !== 'lose'))
        return 'Użycie: run end win|lose';
      this.manager.finish(args[0] === 'win' ? 'victory' : 'death');
      return 'Run zakończony.';
    });
    register('hurt', 'hurt <n> — obrażenia gracza', (args) => {
      const amount = Number(args[0]);
      if (args.length !== 1 || !Number.isFinite(amount) || amount < 0)
        return 'Podaj obrażenia.';
      if (this.manager.screen === 'room')
        return this.roomReady
          ? this.roomCommands!.execute(`hurt ${amount}`)
          : 'Pokój nie jest gotowy.';
      if (!this.manager.active) return 'Run zakończony.';
      this.manager.setHp(this.manager.state.hp - amount);
      if (this.manager.active && this.manager.state.hp <= 0)
        this.manager.finish('death');
      this.show();
      return 'Obrażenia zadane.';
    });
    for (const name of [
      'conquest capture',
      'conquest tickets',
      'assault destroy',
      'assault lives',
      'heist grab',
      'heist drop',
      'heist extract',
      'heist lives',
      'weather',
      'tp',
      'hold',
      'status',
      'spawn',
      'hit',
      'kill all',
      'boss phase',
      'boss pattern',
      'wave',
    ]) {
      register(name, `${name} — komenda aktywnego pokoju`, (args) =>
        this.roomReady && this.manager.screen === 'room'
          ? this.roomCommands!.execute([name, ...args].join(' '))
          : 'Brak aktywnego pokoju.',
      );
    }
    register('god', 'god — nieśmiertelność (poza pokojem: na cały run)', () => {
      if (this.roomReady && this.manager.screen === 'room')
        return this.roomCommands!.execute('god');
      this.godRun = !this.godRun;
      return `Nieśmiertelność w runie: ${this.godRun ? 'włączona' : 'wyłączona'}`;
    });
    register('credits', 'credits <n> — dodaj Kredyty', (args) => {
      if (args.length !== 1 || !this.manager.addCredits(Number(args[0])))
        return 'Podaj dodatnią liczbę Kredytów.';
      if (this.manager.screen !== 'room') this.show();
      return `Kredyty: ${this.manager.state.credits}`;
    });
    register('implant', 'implant <id> — dodaj implant na mapie', (args) => {
      if (this.manager.screen === 'room' && this.roomReady)
        return this.roomCommands!.execute(['implant', ...args].join(' '));
      const implant = (
        this.options.implantDefinitions ?? implantDefinitions
      ).get(args[0] ?? '');
      if (
        args.length !== 1 ||
        !implant ||
        this.manager.screen !== 'map' ||
        this.manager.state.implants.includes(implant.id)
      )
        return 'Podaj nowy implant na ekranie mapy.';
      this.economy.addDebugImplant(implant.id);
      this.show();
      return `Implant: ${implant.id}`;
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelRewardSave();
    for (const off of this.off.splice(0)) off();
    this.disposeRoom();
    this.manager?.dispose();
    this.tracker?.dispose();
    this.achievementToast?.dispose();
    this.missionRadio?.dispose();
    this.inventory?.dispose();
    this.screens?.dispose();
  }
}
