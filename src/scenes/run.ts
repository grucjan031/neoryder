import { synergyDefinitions } from '../progression/synergies';
import type { Scene as ThreeScene } from 'three';
import type { GameContext } from '../core/context';
import type { EntityId } from '../core/events';
import type { InputSnapshot } from '../core/input';
import { Rng } from '../core/rng';
import type { MapNode, RoomPlanner, RunState } from '../core/runTypes';
import playerData from '../data/scenes/roomPlayer.json';
import { enemyDefinitions } from '../enemies/registry';
import type { ImplantDefinition } from '../progression/implantSchema';
import { implantDefinitions } from '../progression/implants';
import { RunEconomy } from '../progression/runEconomy';
import { loadoutDefinitions } from '../progression/loadout';
import { createRunSavePort } from '../ui/runSave';
import { HtmlRunScreens } from '../ui/runScreens';
import type { RunScreens } from '../ui/runScreens';
import { CommandRegistry } from '../ui/debugCommands';
import { roomDefinitions } from '../world/rooms';
import type { RoomDefinition } from '../world/roomSchema';
import { RunManager } from '../world/run';
import { generateSectorMap } from '../world/sectorMap';
import type { SectorDefinition } from '../world/sectorSchema';
import { kuroganeSector } from '../world/sectors';
import { roomPlanner } from '../world/threat';
import type { WavesDefinition } from '../world/waves';
import type { Scene } from './index';
import { RoomScene } from './roomScene';

export interface RunSavePort {
  loadRun(): Promise<RunState | null>;
  saveRun(state: RunState): Promise<void>;
  clearRun(): Promise<void>;
}

export interface RunRoom extends Scene {
  clear(): void;
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
  planner?: RoomPlanner;
  sector?: SectorDefinition;
  rooms?: ReadonlyMap<string, RoomDefinition>;
  createRoom?: RunRoomFactory;
  implantDefinitions?: ReadonlyMap<string, ImplantDefinition>;
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
  private readonly save: RunSavePort;
  private readonly sector: SectorDefinition;
  private readonly rooms: ReadonlyMap<string, RoomDefinition>;
  private room: RunRoom | null = null;
  private roomId: string | null = null;
  private roomReady = false;
  private roomCommands: CommandRegistry | null = null;
  private playerId: EntityId | null = null;
  private readonly enemyKinds = new Map<EntityId, string>();
  private loading: Promise<void> | null = null;
  private saving: Promise<void> = Promise.resolve();
  private pending: 'clear' | 'end' | null = null;
  private disposed = false;
  private runError: string | null = null;
  private saveError: string | null = null;
  private readonly off: (() => void)[] = [];
  private readonly log: RunLogEntry[] = [];

  constructor(private readonly options: RunSceneOptions = {}) {
    this.save = options.save ?? createRunSavePort();
    this.sector = options.sector ?? kuroganeSector;
    this.rooms = options.rooms ?? roomDefinitions;
  }

  async init(ctx: GameContext, three: ThreeScene): Promise<void> {
    this.ctx = ctx;
    this.three = three;
    this.screens = this.options.screens ?? new HtmlRunScreens();
    this.manager = new RunManager(ctx.bus, {
      generateMap: (seed) => generateSectorMap(this.sector, seed),
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
        this.log.push({ event: 'room_cleared', nodeId });
        this.schedule('clear');
      }),
      ctx.bus.on('reward_offered', ({ nodeId, options }) =>
        this.log.push({
          event: 'reward_offered',
          nodeId,
          options: [...options],
        }),
      ),
      ctx.bus.on('implant_acquired', ({ id }) =>
        this.log.push({ event: 'implant_acquired', id }),
      ),
      ctx.bus.on('run_ended', ({ outcome }) => {
        this.log.push({ event: 'run_ended', outcome });
        this.persist(() => this.save.clearRun());
        this.schedule('end');
      }),
    );
    const params =
      this.options.params ??
      new URLSearchParams(
        typeof location === 'undefined' ? '' : location.search,
      );
    if (params.get('continue') === '1') {
      const state = await this.save.loadRun();
      if (this.disposed) return;
      if (!state) throw new Error('Brak zapisu runu do wznowienia.');
      this.validateLoadout(state.loadoutId);
      this.manager.restore(state);
    } else {
      const loadout = params.get('loadout') ?? 'classic';
      this.validateLoadout(loadout);
      this.manager.newRun(
        params.get('seed') ?? String(ctx.rng.getState()),
        loadout,
      );
    }
    this.registerCommands();
    this.showMap();
    await this.saving;
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
        busy: this.manager.screen === 'room' && !this.roomReady,
        error: this.runError,
        offers: (() => {
          const definitions =
            this.options.implantDefinitions ?? implantDefinitions;
          const tags = [
            ...(loadoutDefinitions.get(this.manager.state.loadoutId)?.tags ??
              []),
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
            loadout: this.manager.state.loadoutId,
          });
          location.assign(`/?${params}`);
        },
        menu: () => {
          if (typeof location !== 'undefined') location.assign('/');
        },
      },
    );
  }

  private showMap(): void {
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
    this.saving = this.saving.then(operation).catch((error: unknown) => {
      this.saveError = error instanceof Error ? error.message : String(error);
      console.warn('Nie można zapisać runu.', error);
    });
  }

  private selectNode(id: string): boolean {
    if (this.disposed || this.loading || !this.manager.selectNode(id))
      return false;
    this.show();
    this.ctx.resume?.();
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
    const pool = this.sector.roomPools?.[node.type];
    const candidates = pool
      ? pool.map((id) => {
          const room = this.rooms.get(id);
          if (!room) throw new Error(`Nieznany pokój w puli sektora: ${id}`);
          return room;
        })
      : [...this.rooms.values()].filter((room) => room.type === node.type);
    // Zapas dla sektorów bez puli danego typu: układ zwykłej walki.
    const available = candidates.length
      ? candidates
      : [...this.rooms.values()].filter((room) => room.type === 'combat');
    return rng
      .fork(`room-layout:${node.id}`)
      .pick(available.sort((a, b) => a.id.localeCompare(b.id)));
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
    const waves: WavesDefinition =
      node.type === 'shop' || node.type === 'rest' || bossRoom
        ? {
            id: `room:${node.id}`,
            firstBreakS: 0,
            breakS: 0,
            maxAlive: bossRoom ? (layout.maxAlive ?? 1) : 1,
            minSpawnDistance: 0,
            spawnPoints: [],
            waves: [],
          }
        : (this.options.planner ?? roomPlanner).planWaves(
            layout,
            this.sector,
            node.type === 'combat' || node.type === 'elite'
              ? node
              : { ...node, type: 'combat' },
            rng,
          );
    const room =
      this.options.createRoom?.(layout, state, waves) ??
      new RoomScene(layout, state, waves, {
        implantDefinitions: this.options.implantDefinitions,
      });
    this.room = room;
    this.roomId = layout.id;
    this.roomCommands = new CommandRegistry();
    await room.init(
      {
        ...this.ctx,
        commands: this.roomCommands,
        rng: rng.fork(`room:${node.id}`),
      },
      this.three,
    );
    if (this.disposed) {
      room.dispose();
      this.room = null;
      return;
    }
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
    if (!this.room || !this.manager.completeRoom(this.room.exportState()))
      return;
    if (this.manager.screen === 'shop' || this.manager.screen === 'rest') {
      this.show();
      return;
    }
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

  step(dt: number, input: InputSnapshot): void {
    if (this.disposed) return;
    this.manager.step(dt);
    if (this.roomReady && this.manager.screen === 'room' && !this.pending)
      this.room?.step(dt, input);
    this.flushTransitions();
  }

  render(alpha: number, frameDt?: number): void {
    if (this.roomReady && this.manager.screen === 'room')
      this.room?.render(alpha, frameDt);
  }

  async whenReady(): Promise<void> {
    await this.loading;
    this.flushTransitions();
    await this.saving;
  }

  query(name: string): unknown {
    switch (name) {
      case 'screen':
        return this.manager.screen;
      case 'runState':
        return this.manager.serialize();
      case 'map':
        return this.manager.serialize().map;
      case 'room':
        return this.roomId;
      case 'runLog':
        return structuredClone(this.log);
      case 'loading':
        return this.loading !== null;
      case 'runError':
        return this.runError;
      case 'saveError':
        return this.saveError;
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
    register('run node', 'run node <id> — wybierz dostępny węzeł', (args) =>
      args.length === 1 && this.selectNode(args[0]!)
        ? 'Wczytywanie pokoju.'
        : 'Węzeł niedostępny.',
    );
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
      'hold',
      'status',
      'spawn',
      'hit',
      'kill all',
      'boss phase',
      'boss pattern',
      'wave',
      'god',
    ]) {
      register(name, `${name} — komenda aktywnego pokoju`, (args) =>
        this.roomReady && this.manager.screen === 'room'
          ? this.roomCommands!.execute([name, ...args].join(' '))
          : 'Brak aktywnego pokoju.',
      );
    }
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
    for (const off of this.off.splice(0)) off();
    this.disposeRoom();
    this.manager?.dispose();
    this.screens?.dispose();
  }
}
