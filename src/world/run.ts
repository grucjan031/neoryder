import { z } from 'zod';
import { modeIdSchema, type ModeId } from './modeSchema';
import { conquestDefinition } from './modes';
import type { MissionDefinition } from './missionSchema';
import type { EntityId, EventBus } from '../core/events';
import {
  NODE_TYPES,
  type MapNode,
  type RunDamageStats,
  type RunOutcome,
  type RunState,
  type RunSummary,
  type SectorMap,
} from '../core/runTypes';
import { Stats } from '../core/stats';
import { loadoutDefinitions, loadoutSchema } from '../progression/loadout';
import { resolveTalents } from '../progression/talents';
import type { Loadout } from '../progression/loadout';
import type { SectorDefinition } from './sectorSchema';

export const RUN_SCREENS = [
  'map',
  'room',
  'reward',
  'shop',
  'rest',
  'summary',
] as const;
export type RunScreen = (typeof RUN_SCREENS)[number];

export type MapGenerator = (seed: string) => SectorMap;

export interface RunManagerOptions {
  /** Generator mapy sektora z zadania F3-02 (wstrzykiwany w testach i RunScene). */
  generateMap?: MapGenerator;
  /** Definicja sektora (dostarcza domyślny id oraz parametry ekonomii). */
  sector?: Pick<SectorDefinition, 'id' | 'economy'>;
  /** Kredyty za jednostkę threatCost zabitego wroga (domyślnie z sector.economy albo 5). */
  creditsPerThreat?: number;
  /** Dodatkowe Kredyty za wyczyszczenie pokoju elity (domyślnie z sector.economy albo 0). */
  eliteBonusCredits?: number;
  /** Kredyty za rozwiązanie pokoju zagadki (domyślnie z sector.economy albo 0). */
  puzzleCredits?: number;
  /** Początkowe zdrowie gracza przy starcie runu (domyślnie 100). */
  initialHp?: number;
  /** Początkowa energia gracza przy starcie runu (domyślnie 100). */
  initialEnergy?: number;
  /** Źródło znacznika czasu startedAtMs (domyślnie Date.now). */
  now?: () => number;
}

/** Opcje startu runu zamrożone w `RunState` (ADR 0007): ekwipunek z kryjówki, talenty, Poziom zagrożenia. */
export interface NewRunOptions {
  modeId?: ModeId;
  mission?: MissionDefinition;
  /** Pełny ekwipunek; domyślnie preset `loadoutId`. */
  loadout?: Loadout;
  /** Id kupionych talentów; domyślnie brak. */
  talents?: readonly string[];
  /** Poziom zagrożenia; domyślnie 0. */
  threatLevel?: number;
  /**
   * Bazowe `maxHealth` gracza bez talentów (domyślnie `initialHp` menedżera). Talenty podnoszące
   * `maxHealth` zwiększają startowe zdrowie o różnicę względem tej bazy.
   */
  baseMaxHealth?: number;
}

export interface RoomExportState {
  hp?: number;
  energy?: number;
}

export const mapNodeSchema: z.ZodType<MapNode> = z.object({
  id: z.string().min(1),
  layer: z.number().int().min(1),
  index: z.number().int().nonnegative(),
  type: z.enum(NODE_TYPES),
  next: z.array(z.string().min(1)),
  fixed: z
    .object({
      roomId: z.string().min(1),
      objectives: z.array(z.string()),
      final: z.boolean().optional(),
    })
    .optional(),
});

export const sectorMapSchema: z.ZodType<SectorMap> = z.object({
  sectorId: z.string().min(1),
  layers: z.array(z.array(mapNodeSchema).min(1)).min(1),
});

export const runDamageStatsSchema: z.ZodType<RunDamageStats> = z.object({
  melee: z.number().finite().nonnegative(),
  power: z.number().finite().nonnegative(),
  gun: z.number().finite().nonnegative(),
  other: z.number().finite().nonnegative(),
});

export const runStateSchema: z.ZodType<RunState> = z
  .object({
    modeId: modeIdSchema.optional(),
    missionId: z.string().min(1).optional(),
    objectives: z
      .record(z.string(), z.enum(['pending', 'active', 'done']))
      .optional(),
    objectiveProgress: z
      .record(z.string(), z.number().finite().min(0).max(1))
      .optional(),
    seed: z.string(),
    sectorId: z.string().min(1),
    loadoutId: z.string().min(1),
    loadout: loadoutSchema,
    talents: z
      .array(z.string().min(1))
      .refine(
        (ids) => new Set(ids).size === ids.length,
        'Powtórzone id talentu w stanie runu.',
      ),
    threatLevel: z.number().int().nonnegative(),
    startedAtMs: z.number().finite().nonnegative(),
    elapsedS: z.number().finite().nonnegative(),
    map: sectorMapSchema,
    currentNodeId: z.string().min(1).nullable(),
    visited: z.array(z.string().min(1)),
    hp: z.number().finite().nonnegative(),
    energy: z.number().finite().nonnegative(),
    credits: z.number().finite().nonnegative(),
    implants: z
      .array(z.string().min(1))
      .refine(
        (ids) => new Set(ids).size === ids.length,
        'Powtórzone id implantu w stanie runu.',
      ),
    stats: z.object({
      kills: z.number().int().nonnegative(),
      damage: runDamageStatsSchema,
    }),
  })
  .superRefine((state, ctx) => {
    const validIds = new Set<string>();
    for (const layer of state.map.layers)
      for (const node of layer) validIds.add(node.id);

    if (state.currentNodeId !== null && !validIds.has(state.currentNodeId))
      ctx.addIssue({
        code: 'custom',
        path: ['currentNodeId'],
        message: `Nieznany węzeł currentNodeId: ${state.currentNodeId}`,
      });

    for (const id of state.visited) {
      if (!validIds.has(id))
        ctx.addIssue({
          code: 'custom',
          path: ['visited'],
          message: `Nieznany węzeł w visited: ${id}`,
        });
    }
  });

const DEFAULT_CREDITS_PER_THREAT = 5;
const DEFAULT_INITIAL_HP = 100;
const DEFAULT_INITIAL_ENERGY = 100;

/**
 * Zarządca stanu pętli runu (F3-05, ADR 0005 pkt 4, 7, 9, 10).
 * Czysta logika symulacji bez Three.js i DOM: prowadzi maszynę ekranów
 * (`map | room | reward | shop | rest | summary`), pilnuje przejść po grafie mapy,
 * nalicza Kredyty i statystyki ze strumienia zdarzeń `EventBus` oraz buduje `RunSummary`.
 */
export class RunManager {
  private readonly generateMap?: MapGenerator;
  private readonly creditsPerThreat: number;
  private readonly eliteBonusCredits: number;
  private readonly puzzleCredits: number;
  private readonly initialHp: number;
  private readonly initialEnergy: number;
  private readonly now: () => number;
  private readonly sectorIdOverride?: string;

  private currentState: RunState | null = null;
  private currentScreen: RunScreen = 'map';
  private lastSummary: RunSummary | null = null;
  private nodeIndex = new Map<string, MapNode>();
  private readonly clearedNodes = new Set<string>();
  private maxLayerReached = 0;
  private playerId: EntityId | null = null;
  private readonly nonPlayerIds = new Set<EntityId>();
  private readonly off: (() => void)[] = [];

  constructor(
    private readonly bus: EventBus,
    optionsOrGenerateMap?: MapGenerator | RunManagerOptions,
    extraOptions?: RunManagerOptions,
  ) {
    const opts: RunManagerOptions =
      typeof optionsOrGenerateMap === 'function'
        ? { ...extraOptions, generateMap: optionsOrGenerateMap }
        : (optionsOrGenerateMap ?? {});

    this.generateMap = opts.generateMap;
    this.sectorIdOverride = opts.sector?.id;
    this.creditsPerThreat =
      opts.creditsPerThreat ??
      opts.sector?.economy?.creditsPerThreat ??
      DEFAULT_CREDITS_PER_THREAT;
    this.eliteBonusCredits =
      opts.eliteBonusCredits ?? opts.sector?.economy?.eliteBonusCredits ?? 0;
    this.puzzleCredits =
      opts.puzzleCredits ?? opts.sector?.economy?.puzzleCredits ?? 0;
    this.initialHp = opts.initialHp ?? DEFAULT_INITIAL_HP;
    this.initialEnergy = opts.initialEnergy ?? DEFAULT_INITIAL_ENERGY;
    this.now = opts.now ?? (() => Date.now());

    this.off.push(
      bus.on('entity_spawned', ({ id, kind }) => {
        if (kind === 'player') {
          this.playerId = id;
          this.nonPlayerIds.delete(id);
        } else {
          this.nonPlayerIds.add(id);
        }
      }),
      bus.on('entity_despawned', ({ id }) => {
        if (id === this.playerId) this.playerId = null;
        this.nonPlayerIds.delete(id);
      }),
      bus.on('room_entered', ({ nodeId, layer }) => {
        if (!this.isRunActive()) return;
        const node = this.nodeIndex.get(nodeId);
        const targetLayer = node ? node.layer : layer;
        if (Number.isFinite(targetLayer) && targetLayer > 0)
          this.maxLayerReached = Math.max(this.maxLayerReached, targetLayer);
      }),
      bus.on('room_cleared', ({ nodeId }) => {
        if (!this.isRunActive()) return;
        this.clearedNodes.add(nodeId);
        const node = this.nodeIndex.get(nodeId);
        if (node)
          this.maxLayerReached = Math.max(this.maxLayerReached, node.layer);
      }),
      bus.on('implant_acquired', ({ id }) => {
        if (!this.isRunActive()) return;
        this.addImplant(id);
      }),
      bus.on('enemy_killed', ({ id, killer }) => {
        if (!this.isRunActive() || !this.currentState) return;
        if (!this.isPlayerActor(killer, id)) return;
        this.currentState.stats.kills++;
      }),
      bus.on('damage_dealt', ({ source, target, amount, tags }) => {
        if (!this.isRunActive() || !this.currentState) return;
        if (!(amount > 0) || !Number.isFinite(amount)) return;
        if (!this.isPlayerDamage(source, target)) return;

        const dmg = this.currentState.stats.damage;
        if (tags.includes('#melee')) dmg.melee += amount;
        else if (tags.includes('#power')) dmg.power += amount;
        else if (tags.includes('#gun')) dmg.gun += amount;
        else dmg.other += amount;
      }),
      bus.on('player_died', ({ id }) => {
        if (!this.isRunActive() || !this.currentState) return;
        if (this.playerId !== null && id !== this.playerId) return;
        this.currentState.hp = 0;
        this.finish('death');
      }),
    );
  }

  /** Bieżący ekran maszyny stanów runu. */
  get screen(): RunScreen {
    return this.currentScreen;
  }

  /** Czy run został zainicjalizowany i jeszcze się nie zakończył. */
  get active(): boolean {
    return this.isRunActive();
  }

  /** Bieżący stan runu (rzuca błąd, jeśli run nie został rozpoczęty ani wczytany). */
  get state(): Readonly<RunState> {
    if (!this.currentState)
      throw new Error('Run nie został jeszcze rozpoczęty ani wczytany.');
    return this.currentState;
  }

  /** Podsumowanie zakończonego runu (null przed wywołaniem finish). */
  get summary(): RunSummary | null {
    return this.lastSummary ? structuredClone(this.lastSummary) : null;
  }

  /** Węzeł mapy, w którym aktualnie znajduje się gracz (null przed pierwszym wyborem). */
  get currentNode(): MapNode | null {
    if (!this.currentState || this.currentState.currentNodeId === null)
      return null;
    return this.nodeIndex.get(this.currentState.currentNodeId) ?? null;
  }

  /**
   * Rozpoczyna nowy run z podanym seedem i ekwipunkiem: generuje mapę sektora,
   * ustawia ekran `map` i emituje `run_started`.
   */
  newRun(
    seed: string,
    loadoutId = 'classic',
    options: NewRunOptions = {},
  ): RunState {
    if (!this.generateMap)
      throw new Error('Brak funkcji generującej mapę sektora (generateMap).');
    if (options.modeId && options.mission)
      throw new Error('Tryb i misja wykluczają się.');
    const rawMap = options.modeId
      ? {
          sectorId: options.modeId,
          layers: [
            [
              {
                id: 'conquest',
                layer: 1,
                index: 0,
                type: 'combat' as const,
                next: [],
                fixed: { roomId: conquestDefinition.roomId, objectives: [] },
              },
            ],
          ],
        }
      : this.generateMap(seed);
    const map = sectorMapSchema.parse(structuredClone(rawMap));
    this.rebuildNodeIndex(map);
    const loadout = options.loadout ?? loadoutDefinitions.get(loadoutId);
    if (!loadout) throw new Error(`Nieznany ekwipunek: ${loadoutId}`);
    const talents = [...new Set(options.talents ?? [])];
    const resolvedTalents = resolveTalents(talents);
    const baseMaxHealth = options.baseMaxHealth ?? this.initialHp;
    const healthStats = new Stats({ maxHealth: baseMaxHealth });
    for (const modifier of resolvedTalents.modifiers)
      if (modifier.stat === 'maxHealth') healthStats.add(modifier);
    const talentHealth = healthStats.get('maxHealth') - baseMaxHealth;
    const threatLevel = options.threatLevel ?? 0;
    if (!Number.isInteger(threatLevel) || threatLevel < 0)
      throw new Error(`Nieprawidłowy Poziom zagrożenia: ${threatLevel}`);

    this.currentState = {
      ...(options.modeId ? { modeId: options.modeId } : {}),
      ...(options.mission
        ? {
            missionId: options.mission.id,
            objectives: Object.fromEntries(
              options.mission.objectives.map((o) => [o.id, 'pending' as const]),
            ),
            objectiveProgress: {},
          }
        : {}),
      seed,
      sectorId: this.sectorIdOverride ?? map.sectorId,
      loadoutId,
      loadout: structuredClone(loadout),
      talents,
      threatLevel,
      startedAtMs: this.now(),
      elapsedS: 0,
      map,
      currentNodeId: null,
      visited: [],
      hp: this.initialHp + talentHealth,
      energy: this.initialEnergy,
      credits: resolvedTalents.runStartCredits,
      implants: [],
      stats: {
        kills: 0,
        damage: { melee: 0, power: 0, gun: 0, other: 0 },
      },
    };
    this.currentScreen = 'map';
    this.lastSummary = null;
    this.clearedNodes.clear();
    this.maxLayerReached = 0;
    this.playerId = null;
    this.nonPlayerIds.clear();

    this.bus.emit('run_started', { seed });
    return this.serialize();
  }

  /** Węzły mapy dostępne do wyboru w bieżącym stanie (pusta tablica poza ekranem `map`). */
  availableNodes(): readonly MapNode[] {
    if (!this.currentState || this.currentScreen !== 'map') return [];
    if (this.currentState.currentNodeId === null)
      return this.currentState.map.layers[0] ?? [];

    const current = this.nodeIndex.get(this.currentState.currentNodeId);
    if (!current) return [];
    if (this.currentState.modeId) return [current];
    const result: MapNode[] = [];
    for (const nextId of current.next) {
      const node = this.nodeIndex.get(nextId);
      if (node) result.push(node);
    }
    return result;
  }

  /** Czy węzeł o podanym id może zostać teraz wybrany. */
  canSelectNode(id: string): boolean {
    return this.availableNodes().some((node) => node.id === id);
  }

  /**
   * Wybiera węzeł mapy (na starcie tylko z warstwy 1, dalej tylko z `next` bieżącego węzła).
   * Przechodzi z `map` do `room` i emituje `node_selected`. Zwraca false przy niedozwolonym ruchu.
   */
  selectNode(id: string): boolean {
    if (!this.currentState || this.currentScreen !== 'map') return false;
    if (!this.canSelectNode(id)) return false;
    const node = this.nodeIndex.get(id);
    if (!node) return false;

    this.currentState.currentNodeId = node.id;
    if (!this.currentState.visited.includes(node.id))
      this.currentState.visited.push(node.id);
    this.maxLayerReached = Math.max(this.maxLayerReached, node.layer);
    this.currentScreen = 'room';

    for (const id of node.fixed?.objectives ?? []) {
      if (this.currentState.objectives?.[id] === 'pending')
        this.currentState.objectives[id] = 'active';
    }
    this.bus.emit('node_selected', { nodeId: node.id, type: node.type });
    return true;
  }

  /**
   * Kończy bieżący pokój (`screen === 'room'`) i przechodzi do właściwego ekranu
   * według typu węzła:
   * - `combat` / `elite` → `reward` (dla elity nalicza też bonus Kredytów, jeśli skonfigurowano),
   * - `shop` → `shop`,
   * - `rest` → `rest`,
   * - `puzzle` → `map` (nalicza `puzzleCredits`, jeśli skonfigurowano),
   * - `boss` → `summary` (`finish('victory')`).
   * Opcjonalny `roomState` zapisuje zdrowie i energię na wyjściu z pokoju (bez leczenia pasywnego).
   */
  completeRoom(roomState?: RoomExportState): boolean {
    if (
      !this.currentState ||
      this.currentScreen !== 'room' ||
      this.currentState.currentNodeId === null
    )
      return false;

    const node = this.nodeIndex.get(this.currentState.currentNodeId);
    if (!node) return false;
    if (
      this.currentState.missionId &&
      node.fixed?.objectives.some(
        (id) => this.currentState!.objectives?.[id] !== 'done',
      )
    )
      return false;

    if (roomState?.hp !== undefined && Number.isFinite(roomState.hp))
      this.currentState.hp = Math.max(0, roomState.hp);
    if (roomState?.energy !== undefined && Number.isFinite(roomState.energy))
      this.currentState.energy = Math.max(0, roomState.energy);

    this.clearedNodes.add(node.id);
    this.maxLayerReached = Math.max(this.maxLayerReached, node.layer);

    if (this.currentState.modeId) {
      this.finish('victory');
      return true;
    }
    if (this.currentState.missionId && node.fixed?.final) {
      this.finish('victory');
      return true;
    }
    switch (node.type) {
      case 'combat':
        this.currentScreen = 'reward';
        break;
      case 'elite':
        if (this.eliteBonusCredits > 0) this.addCredits(this.eliteBonusCredits);
        this.currentScreen = 'reward';
        break;
      case 'shop':
        this.currentScreen = 'shop';
        break;
      case 'rest':
        this.currentScreen = 'rest';
        break;
      case 'puzzle':
        if (this.puzzleCredits > 0) this.addCredits(this.puzzleCredits);
        this.currentScreen = 'map';
        break;
      case 'boss':
        if (this.currentState.missionId) this.currentScreen = 'reward';
        else this.finish('victory');
        break;
    }
    return true;
  }

  /**
   * Zamyka ekran po-pokojowy (`reward`, `shop` lub `rest`) i wraca na ekran `map`.
   * Zwraca false, gdy bieżący ekran nie pozwala na powrót na mapę.
   */
  returnToMap(): boolean {
    if (
      !this.currentState ||
      (this.currentScreen !== 'reward' &&
        this.currentScreen !== 'shop' &&
        this.currentScreen !== 'rest')
    )
      return false;
    this.currentScreen = 'map';
    return true;
  }

  updateObjectives(
    objectives: NonNullable<RunState['objectives']>,
    progress: Record<string, number>,
  ): void {
    if (!this.isRunActive() || !this.currentState?.missionId) return;
    this.currentState.objectives = structuredClone(objectives);
    this.currentState.objectiveProgress = structuredClone(progress);
  }

  /** Alias powrotu na mapę z ekranu nagrody (`reward` → `map`). */
  completeReward(): boolean {
    if (this.currentScreen !== 'reward') return false;
    return this.returnToMap();
  }

  /** Alias powrotu na mapę ze sklepu (`shop` → `map`). */
  leaveShop(): boolean {
    if (this.currentScreen !== 'shop') return false;
    return this.returnToMap();
  }

  /** Alias powrotu na mapę z odpoczynku (`rest` → `map`). */
  leaveRest(): boolean {
    if (this.currentScreen !== 'rest') return false;
    return this.returnToMap();
  }

  /**
   * Nalicza Kredyty za zabicie wroga o podanym `threatCost` (`round(threatCost * creditsPerThreat)`).
   * Zwraca liczbę dodanych Kredytów (0, gdy koszt <= 0 lub run nieaktywny).
   */
  creditKill(threatCost: number): number {
    if (
      !this.isRunActive() ||
      !Number.isFinite(threatCost) ||
      !(threatCost > 0)
    )
      return 0;
    const gained = Math.round(threatCost * this.creditsPerThreat);
    if (gained <= 0) return 0;
    this.addCredits(gained);
    return gained;
  }

  /** Dodaje Kredyty (> 0) i emituje `currency_changed`. Zwraca false dla wartości <= 0 lub po końcu runu. */
  addCredits(amount: number): boolean {
    if (
      !this.isRunActive() ||
      !this.currentState ||
      !Number.isFinite(amount) ||
      !(amount > 0)
    )
      return false;
    const delta = Math.round(amount);
    if (delta <= 0) return false;
    this.currentState.credits += delta;
    this.bus.emit('currency_changed', {
      currency: 'credits',
      amount: this.currentState.credits,
      delta,
    });
    return true;
  }

  /**
   * Wydaje Kredyty (> 0) i emituje `currency_changed` z ujemną deltą.
   * Gdy brakuje środków lub kwota jest niepoprawna — zwraca false i nie zmienia stanu.
   */
  spendCredits(amount: number): boolean {
    if (
      !this.isRunActive() ||
      !this.currentState ||
      !Number.isFinite(amount) ||
      !(amount > 0)
    )
      return false;
    const cost = Math.round(amount);
    if (cost <= 0 || cost > this.currentState.credits) return false;
    this.currentState.credits -= cost;
    this.bus.emit('currency_changed', {
      currency: 'credits',
      amount: this.currentState.credits,
      delta: -cost,
    });
    return true;
  }

  /** Jawne ustawienie zdrowia w stanie runu (obcięte do [0, maxHp]). */
  setHp(hp: number, maxHp?: number): boolean {
    if (!this.isRunActive() || !this.currentState || !Number.isFinite(hp))
      return false;
    const cap =
      maxHp !== undefined && Number.isFinite(maxHp)
        ? Math.max(0, maxHp)
        : Number.POSITIVE_INFINITY;
    this.currentState.hp = Math.min(cap, Math.max(0, hp));
    return true;
  }

  /**
   * Jawne leczenie gracza (sklep, odpoczynek, bonus maxHealth z implantu).
   * Jedyna droga zwiększania zdrowia obok `setHp` — `RunManager` nigdy nie leczy pasywnie.
   */
  heal(amount: number, maxHp?: number): number {
    if (
      !this.isRunActive() ||
      !this.currentState ||
      !Number.isFinite(amount) ||
      !(amount > 0) ||
      this.currentState.hp <= 0
    )
      return 0;
    const before = this.currentState.hp;
    const cap =
      maxHp !== undefined && Number.isFinite(maxHp)
        ? Math.max(0, maxHp)
        : Number.POSITIVE_INFINITY;
    this.currentState.hp = Math.min(cap, Math.max(before, before + amount));
    return this.currentState.hp - before;
  }

  /** Jawne ustawienie energii w stanie runu (obcięte do [0, maxEnergy]). */
  setEnergy(energy: number, maxEnergy?: number): boolean {
    if (!this.isRunActive() || !this.currentState || !Number.isFinite(energy))
      return false;
    const cap =
      maxEnergy !== undefined && Number.isFinite(maxEnergy)
        ? Math.max(0, maxEnergy)
        : Number.POSITIVE_INFINITY;
    this.currentState.energy = Math.min(cap, Math.max(0, energy));
    return true;
  }

  /** Dodaje implant do stanu runu (odrzuca puste id i duplikaty). */
  addImplant(id: string): boolean {
    if (
      !this.isRunActive() ||
      !this.currentState ||
      !id ||
      this.currentState.implants.includes(id)
    )
      return false;
    this.currentState.implants.push(id);
    return true;
  }

  /** Zastępuje posiadany implant jego ulepszeniem (`upgradesTo`), pilnując unikalności. */
  upgradeImplant(fromId: string, toId: string): boolean {
    if (!this.isRunActive() || !this.currentState || !toId) return false;
    const idx = this.currentState.implants.indexOf(fromId);
    if (idx < 0 || this.currentState.implants.includes(toId)) return false;
    this.currentState.implants[idx] = toId;
    return true;
  }

  /** Krokuje czas trwania runu w czasie symulacji (bez pasywnej regeneracji zdrowia). */
  step(dt: number): void {
    if (!this.isRunActive() || !this.currentState) return;
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    this.currentState.elapsedS += dt;
  }

  /**
   * Kończy run ze wskazanym wynikiem (`'victory' | 'death'`), przechodzi do ekranu `summary`
   * i emituje `run_ended` z podsumowaniem `RunSummary`. Wywołanie powtórne jest idempotentne.
   */
  finish(outcome: RunOutcome): RunSummary {
    if (!this.currentState)
      throw new Error('Run nie został jeszcze rozpoczęty ani wczytany.');
    if (this.currentScreen === 'summary' && this.lastSummary)
      return structuredClone(this.lastSummary);

    if (
      outcome === 'victory' &&
      this.currentState.missionId &&
      (!this.currentNode?.fixed?.final ||
        this.currentNode.fixed.objectives.some(
          (id) => this.currentState!.objectives?.[id] !== 'done',
        ))
    )
      throw new Error('Cele finału misji nie są ukończone.');
    if (outcome === 'victory' && this.currentState.currentNodeId !== null) {
      this.clearedNodes.add(this.currentState.currentNodeId);
      const node = this.nodeIndex.get(this.currentState.currentNodeId);
      if (node)
        this.maxLayerReached = Math.max(this.maxLayerReached, node.layer);
    }

    const summary: RunSummary = {
      ...(this.currentState.modeId ? { modeId: this.currentState.modeId } : {}),
      ...(this.currentState.missionId
        ? {
            missionId: this.currentState.missionId,
            missionCompleted: outcome === 'victory',
          }
        : {}),
      outcome,
      seed: this.currentState.seed,
      loadoutId: this.currentState.loadoutId,
      elapsedS: this.currentState.elapsedS,
      kills: this.currentState.stats.kills,
      roomsCleared: this.currentState.modeId
        ? outcome === 'victory'
          ? conquestDefinition.rewardRooms
          : 0
        : this.clearedNodes.size,
      elitesCleared: this.countClearedElites(),
      threatLevel: this.currentState.threatLevel,
      layerReached: this.computeLayerReached(),
      implants: [...this.currentState.implants],
      damage: { ...this.currentState.stats.damage },
    };

    this.currentScreen = 'summary';
    this.lastSummary = summary;
    this.bus.emit('run_ended', {
      outcome,
      summary: structuredClone(summary),
    });
    return structuredClone(summary);
  }

  /** Zwraca głęboką, czysto serializowalną kopię `RunState`. */
  serialize(): RunState {
    if (!this.currentState)
      throw new Error('Run nie został jeszcze rozpoczęty ani wczytany.');
    return structuredClone(this.currentState);
  }

  /**
   * Odtwarza stan runu z zapisanego `RunState` (walidacja schematem zod),
   * ustawia ekran `map` i emituje `run_started`.
   */
  restore(state: RunState): RunState {
    const parsed = runStateSchema.parse(structuredClone(state));
    this.rebuildNodeIndex(parsed.map);
    this.currentState = parsed;
    this.currentScreen = 'map';
    this.lastSummary = null;
    this.clearedNodes.clear();
    for (const visitedId of parsed.visited) this.clearedNodes.add(visitedId);
    this.maxLayerReached = 0;
    this.maxLayerReached = this.computeLayerReached();
    this.playerId = null;
    this.nonPlayerIds.clear();

    this.bus.emit('run_started', { seed: parsed.seed });
    return this.serialize();
  }

  /**
   * Odtwarza zakończony run z zapisu (stan + podsumowanie) prosto na ekran `summary`,
   * bez ponownego `run_ended`: rozliczenie nagród prowadzi `RunScene`.
   */
  restoreEnded(state: RunState, summary: RunSummary): RunState {
    this.restore(state);
    this.currentScreen = 'summary';
    this.lastSummary = structuredClone(summary);
    return this.serialize();
  }

  /** Odpina nasłuchiwacze `EventBus`. */
  dispose(): void {
    for (const off of this.off.splice(0)) off();
  }

  private isRunActive(): boolean {
    return this.currentState !== null && this.currentScreen !== 'summary';
  }

  private rebuildNodeIndex(map: SectorMap): void {
    this.nodeIndex = new Map<string, MapNode>();
    for (const layer of map.layers)
      for (const node of layer) this.nodeIndex.set(node.id, node);
  }

  private countClearedElites(): number {
    let count = 0;
    for (const id of this.clearedNodes)
      if (this.nodeIndex.get(id)?.type === 'elite') count++;
    return count;
  }

  private computeLayerReached(): number {
    if (!this.currentState) return 0;
    let maxLayer = this.maxLayerReached;
    for (const id of this.currentState.visited) {
      const node = this.nodeIndex.get(id);
      if (node && node.layer > maxLayer) maxLayer = node.layer;
    }
    if (this.currentState.currentNodeId !== null) {
      const current = this.nodeIndex.get(this.currentState.currentNodeId);
      if (current && current.layer > maxLayer) maxLayer = current.layer;
    }
    for (const id of this.clearedNodes) {
      const node = this.nodeIndex.get(id);
      if (node && node.layer > maxLayer) maxLayer = node.layer;
    }
    return maxLayer;
  }

  private isPlayerActor(killer: EntityId | null, victimId: EntityId): boolean {
    if (killer === null || killer === victimId) return false;
    if (this.nonPlayerIds.has(killer)) return false;
    if (this.playerId !== null) return killer === this.playerId;
    return true;
  }

  private isPlayerDamage(source: EntityId | null, target: EntityId): boolean {
    if (source === null || source === target) return false;
    if (this.nonPlayerIds.has(source)) return false;
    if (this.playerId !== null)
      return source === this.playerId && target !== this.playerId;
    return true;
  }
}
