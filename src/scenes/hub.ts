import { BoxGeometry, CylinderGeometry, Group, Mesh } from 'three';
import type { BufferGeometry, Scene as ThreeScene } from 'three';
import type { RigidBody, World } from '@dimforge/rapier3d-compat';
import type { GameContext } from '../core/context';
import { EntityRegistry } from '../core/entities';
import type { EntityId } from '../core/events';
import type { InputSnapshot } from '../core/input';
import type { Vec3 } from '../core/math';
import type { Rng } from '../core/rng';
import { HUB_STATION_IDS } from '../core/metaTypes';
import type { HubStationId } from '../core/metaTypes';
import { createIndexedDbSaveStore, loadSettings } from '../core/save';
import type { SaveStore } from '../core/save';
import type { BladeView } from '../combat/melee/plasmaBlade';
import hideoutData from '../data/hub/hideout.json';
import { catPet } from '../data/hub/interactions.json';
import npcTextData from '../data/hub/npcs.pl.json';
import eventData from '../data/hub/events.pl.json';
import propTextData from '../data/hub/props.pl.json';
import { HubProps, hubPropTextsSchema } from '../world/hubProps';
import { HubPropView } from './hubPropView';
import { HubWarmth } from '../ui/hubWarmth';
import { CollisionGroup, initPhysics, interactionGroups } from '../physics';
import { FpsCamera } from '../player/fpsCamera';
import { PlayerController } from '../player/playerController';
import type { PlayerState } from '../player/playerController';
import type { MetaManager } from '../progression/meta';
import { loadMetaManager, saveMetaManager } from '../progression/metaSave';
import { CityDressing } from '../render/city/dressing';
import { cloneCityModel, loadDecor } from '../render/cityModels';
import { FppViewModel } from '../render/fppViewModel';
import { HubStationMarkers } from '../render/hubStationMarkers';
import { createStyleLights } from '../render/lights';
import { getMaterial } from '../render/materials';
import { worldEnvelope } from '../render/horizon';
import { SceneAtmosphere } from '../render/sceneAtmosphere';
import { batchStaticGeometry } from '../render/staticBatch';
import { createMetaBar } from '../ui/hub/metaBar';
import { createHubGreetings } from '../ui/hub/greetings';
import type { MetaBar } from '../ui/hub/metaBar';
import { createMissionsPanel } from '../ui/hub/missionsPanel';
import { missionDefinitions } from '../world/missions';
import { showDebrief } from '../ui/missionUi';
import { createTalentsPanel } from '../ui/hub/talentsPanel';
import { createWorkshopPanel } from '../ui/hub/workshopPanel';
import { HtmlHubScreens } from '../ui/hubScreens';
import { HubChatterUi } from '../ui/hubChatter';
import { HubChatter } from '../world/hubChatter';
import {
  HubPowerDip,
  loadHubEvents,
  pickDipComment,
} from '../world/hubPowerDip';
import type { HubEvents } from '../world/hubPowerDip';
import { setPowerLevel } from '../render/powerLevel';
import { HubArrival, hubArrivalContext } from '../world/hubArrival';
import {
  applyCampaignTexts,
  applyHubCampaign,
  assertCampaignMissions,
} from '../world/hubCampaign';
import type { HubArrivalContext, HubGreetings } from '../world/hubArrival';
import { HubDialog } from '../ui/hubDialog';
import { HubMap } from '../ui/hubMap';
import type { HubMapView } from '../ui/hubMap';
import { HubPrompt } from '../ui/hubPrompt';
import type { HubPanelRegistry, HubScreens } from '../ui/hubScreens';
import { registerMetaCommands } from '../ui/metaCommands';
import type { CommandHost } from '../ui/metaCommands';
import { loadHubLayout } from '../world/hubSchema';
import type { HubLayout, HubPropDef } from '../world/hubSchema';
import {
  NpcRuntime,
  npcRadius,
  NpcDialogue,
  loadNpcTexts,
  npcFocusBox,
  npcHeight,
} from '../world/hubNpcs';
import type { NpcLine, NpcTexts } from '../world/hubNpcs';
import {
  HubStations,
  rayAabbDistance,
  selectHubTarget,
} from '../world/hubStations';
import type { HubTarget } from '../world/hubStations';
import { HUB_BATCH_CELL_M, HubDecor } from './hubDecor';
import { HubNpcs } from './hubNpcs';
import { HubSoundscape } from './hubSoundscape';
import { HubFauna } from './hubFauna';
import { KIDS_CAT_CONVERSATION, KidsCatEncounter } from '../world/hubKidsCat';
import type { Scene } from './index';
import { preserveLiteFx } from '../render/fxMode';

export interface HubSceneOptions {
  layout?: HubLayout;
  screens?: HubScreens;
  /** Plan stacji (M); domyślnie nakładka HTML, w testach atrapa. */
  hubMap?: HubMapView;
  params?: URLSearchParams;
  navigate?: (url: string) => void;
  loadModels?: boolean;
  /** Teksty rozmów NPC (domyślnie `src/data/hub/npcs.pl.json`). */
  npcTexts?: NpcTexts;
  /** Pamięć ostatniego powitania (domyślnie adapter UI na localStorage). */
  greetings?: HubGreetings;
  /** Zapis meta (domyślnie IndexedDB); w testach pamięć. */
  metaStore?: SaveStore;
  /** Fabryki paneli stacji (domyślnie tablica misji, talenty i warsztat). */
  panels?: HubPanelRegistry;
  /** Pasek meta u góry ekranu; domyślnie włączony, gdy scena sama tworzy nakładki (DOM). */
  metaBar?: boolean;
}

const DEFAULT_PANELS: HubPanelRegistry = {
  missions: createMissionsPanel,
  talents: createTalentsPanel,
  workshop: createWorkshopPanel,
};

const META_EVENTS = [
  'meta_rewards',
  'level_up',
  'talents_changed',
  'unlock_purchased',
  'loadout_changed',
  'threat_selected',
] as const;

/** Ręce pokazują ostrze w spoczynku: widok bez walki (brak ciosów, bloku i rzutu). */
const IDLE_BLADE: BladeView = {
  flight: null,
  state: 'idle',
  stage: 0,
  phase: null,
  phaseT: 0,
  charge: 0,
  blockAgeS: 0,
  guardBrokenS: 0,
};

const stationList = HUB_STATION_IDS.join('|');
const lookList = `${stationList}|<npc>|<propId>|cat`;
// E jest przypisane do power2; w kryjówce nie ma walki ani mocy.
const HUB_INTERACT_ACTION = 'power2';
const SEAT_MOVE_ACTIONS = [
  'moveForward',
  'moveBack',
  'moveLeft',
  'moveRight',
] as const;
const EMPTY_ACTIONS: ReadonlySet<never> = new Set();

/** Kryjówka ruchu oporu (F4-07): peron nieczynnej stacji metra, FPP bez wrogów, stacje jako strefy z nakładkami UI. */
export class HubScene implements Scene {
  readonly id = 'hub';
  private layout: HubLayout;
  private readonly params: URLSearchParams;
  private readonly navigate: (url: string) => void;
  private readonly loadModels: boolean;
  private readonly screensOption: HubScreens | undefined;
  private readonly options: HubSceneOptions;
  private metaStore: SaveStore | null = null;
  private meta!: MetaManager;
  private metaBar: MetaBar | null = null;
  private screens!: HubScreens;
  private prompt: HubPrompt | null = null;
  private dialogUi: HubDialog | null = null;
  private hubMap: HubMapView | null = null;
  private npcTexts!: NpcTexts;
  private dialogue!: NpcDialogue;
  private npcs?: HubNpcs;
  private readonly npcStates: NpcRuntime[] = [];
  private readonly npcById = new Map<string, NpcRuntime>();
  private npcTargets: { id: string; focus: ReturnType<typeof npcFocusBox> }[] =
    [];
  private readonly npcBodies: {
    state: NpcRuntime;
    body: RigidBody;
    height: number;
    translation: Vec3;
  }[] = [];
  private props!: HubProps;
  private propView?: HubPropView;
  private warmth?: HubWarmth;
  private chatter!: HubChatter;
  private powerDip!: HubPowerDip;
  private hubEvents!: HubEvents;
  private dipRng!: Rng;
  private greetings!: HubGreetings;
  private arrival: HubArrival | null = null;
  private arrivalElapsedS = 0;
  private arrivalPending = false;
  private chatterUi: HubChatterUi | null = null;
  private talk: {
    line: NpcLine;
    remainingS: number;
    anywhere: boolean;
  } | null = null;
  private ctx!: GameContext;
  private rapier!: Awaited<ReturnType<typeof initPhysics>>;
  private world!: World;
  private readonly blockColliders = new Set<number>();
  private entities!: EntityRegistry;
  private playerId!: EntityId;
  private player!: PlayerController;
  private previous!: PlayerState;
  private fpsCamera!: FpsCamera;
  private fppView!: FppViewModel;
  private stations!: HubStations;
  private markers?: HubStationMarkers;
  private atmosphere?: SceneAtmosphere;
  private dressing?: CityDressing;
  private decor?: HubDecor;
  private soundscape?: HubSoundscape;
  private fauna?: HubFauna;
  private kidsCat?: KidsCatEncounter;
  private readonly root = new Group();
  private readonly lights = createStyleLights();
  private readonly geometries = new Set<BufferGeometry>();
  private readonly off: (() => void)[] = [];
  private pendingLook: { yaw: number; pitch: number } | null = null;
  private discardInteractAfterClose = false;
  private lookScale = 1;
  /** Siedzisko, na którym gracz siedzi; `seatPose` zostaje do końca powrotu kamery. */
  private seat: HubPropDef | null = null;
  private seatPose: HubPropDef | null = null;
  private seatBlend = 0;
  private previousSeatBlend = 0;
  private readonly isArrivalPending = (id: string): boolean =>
    this.arrival?.isPending(id) === true;
  private disposed = false;

  constructor(options: HubSceneOptions = {}) {
    this.layout = options.layout ?? loadHubLayout(hideoutData);
    this.params =
      options.params ??
      new URLSearchParams(
        typeof location === 'undefined' ? '' : location.search,
      );
    this.navigate = options.navigate ?? ((url) => location.assign(url));
    this.loadModels = options.loadModels ?? true;
    this.screensOption = options.screens;
    this.options = options;
  }

  async init(ctx: GameContext, three: ThreeScene): Promise<void> {
    this.ctx = ctx;
    this.metaStore = this.options.metaStore ?? createIndexedDbSaveStore();
    const store = this.metaStore;
    this.meta = await loadMetaManager(store, ctx.bus);
    const missionSave = await store.loadMission?.().catch((error: unknown) => {
      console.warn('Nie można odczytać misji.', error);
      return null;
    });
    if (this.disposed) return;
    this.screens =
      this.screensOption ??
      new HtmlHubScreens(undefined, {
        panels: this.options.panels ?? DEFAULT_PANELS,
        host: {
          manager: this.meta,
          missionSave,
          save: () => saveMetaManager(store, this.meta),
          navigate: (url) =>
            this.go(new URLSearchParams(url.replace(/^\?/, ''))),
        },
      });
    if (this.options.metaBar ?? this.screensOption === undefined)
      this.metaBar = createMetaBar(this.meta, ctx.bus);
    if (this.screensOption === undefined) {
      this.prompt = new HubPrompt();
      this.dialogUi = new HubDialog();
    }
    this.hubMap =
      this.options.hubMap ??
      (this.screensOption === undefined ? new HubMap(this.layout) : null);
    const loadedTexts = loadNpcTexts(
      this.options.npcTexts ?? npcTextData,
      this.layout.npcs ?? [],
    );
    assertCampaignMissions(
      this.layout,
      loadedTexts,
      new Set(missionDefinitions.keys()),
    );
    const completed = this.campaignCompleted();
    this.layout = applyHubCampaign(this.layout, completed);
    this.npcTexts = applyCampaignTexts(loadedTexts, completed);
    if (this.screensOption === undefined)
      this.chatterUi = new HubChatterUi(this.layout.npcs ?? [], this.npcTexts);
    // Walidacja względem danych gry; sceny testowe z własnymi NPC po prostu pomijają wpisy bez NPC.
    this.hubEvents = loadHubEvents(
      eventData,
      new Set(npcTextData.npcs.map(({ id }) => id)),
    );
    this.dialogue = new NpcDialogue(this.npcTexts.npcs);
    this.greetings = this.options.greetings ?? createHubGreetings();
    this.setArrival(hubArrivalContext(this.meta.state, this.greetings.last()));
    this.rapier = await initPhysics();
    if (this.disposed) return;
    this.world = new this.rapier.World({
      x: 0,
      y: ctx.tuning.physics.gravity,
      z: 0,
    });
    this.entities = new EntityRegistry(ctx.bus);
    const floorY = this.layout.playerSpawn.y;
    this.atmosphere = new SceneAtmosphere(
      three,
      this.layout.theme,
      this.layout.id,
      floorY,
      undefined,
      worldEnvelope(this.layout.blocks, this.layout.playerSpawn),
      ctx.camera,
    );
    three.add(this.root);
    this.root.add(this.lights);
    // Bryły, modele i dekoracje scalane razem: ten sam materiał z różnych korzeni to jedna siatka na komórkę.
    const staticWorld = new Group();
    staticWorld.name = 'static-world';
    this.root.add(staticWorld);
    await this.buildBlocks(staticWorld);
    if (this.disposed) return;
    const staticDecor = new Group();
    staticDecor.name = 'static-decor';
    staticWorld.add(staticDecor);
    await loadDecor(staticDecor, this.layout.decor, this.loadModels);
    if (this.disposed) return;
    batchStaticGeometry(staticWorld, this.geometries, {
      cellSize: HUB_BATCH_CELL_M,
    });
    this.dressing = new CityDressing(
      this.root,
      this.layout,
      this.atmosphere.theme,
      floorY,
      this.layout.id,
    );
    this.decor = new HubDecor(
      this.layout.panels ?? [],
      this.layout.stations,
      this.layout.fires ?? [],
      ctx.tuning.hub,
      this.layout.neonTexts ?? [],
      `${this.layout.id}:labels`,
    );
    this.root.add(this.decor.root);
    this.root.add(
      (this.markers = new HubStationMarkers(this.layout.stations, floorY)).root,
    );
    this.props = new HubProps(
      this.layout.props ?? [],
      ctx.tuning.hub,
      ctx.bus,
      ctx.rng.fork('hub-props'),
      hubPropTextsSchema.parse(propTextData),
    );
    this.propView = new HubPropView(this.props, ctx.tuning.hub);
    this.root.add(this.propView.root);
    if (this.screensOption === undefined) this.warmth = new HubWarmth();

    this.buildNpcs();
    this.chatter = new HubChatter(
      this.npcTexts.conversations ?? [],
      new Map(this.npcStates.map((state) => [state.def.id, state.position])),
      ctx.tuning.hub,
      ctx.bus,
    );
    this.powerDip = new HubPowerDip(
      ctx.rng.fork('hub-power-dip'),
      ctx.tuning.hub,
      ctx.bus,
    );
    this.dipRng = ctx.rng.fork('hub-power-dip-comment');
    if (this.loadModels) await this.npcs?.load();
    if (this.disposed) return;

    this.playerId = this.entities.create('player', 'player');
    const settings = loadSettings();
    this.lookScale =
      ctx.tuning.player.lookSensitivity * settings.mouseSensitivity;
    this.player = new PlayerController(
      this.playerId,
      this.world,
      ctx,
      this.spawnPosition(),
      settings,
    );
    this.entities.bindCollider(this.playerId, this.player.colliderHandle);
    this.previous = this.player.getState();
    this.fpsCamera = new FpsCamera(ctx.tuning, this.playerId, ctx.bus);
    this.fppView = new FppViewModel(ctx.bus, this.playerId, {
      tuning: ctx.tuning,
    });
    await this.fppView.load(this.loadModels);
    if (this.disposed) {
      this.fppView.dispose();
      return;
    }
    this.root.add(this.fppView.root);

    this.stations = new HubStations(
      this.layout.stations.map(({ id, position, radius }) => ({
        id,
        position,
        radius,
      })),
      ctx.bus,
    );
    this.off.push(
      ctx.bus.on('hub_prop_used', ({ prop, kind }) =>
        this.onPropUsed(prop, kind),
      ),
      ctx.bus.on('hub_station_opened', ({ station }) =>
        this.showStation(station),
      ),
      ...META_EVENTS.map((name) =>
        ctx.bus.on(name, () => this.screens.refresh?.()),
      ),
    );
    this.registerCommands();
    this.fauna = new HubFauna(ctx, this.root, this.layout, () =>
      this.player.getState(),
    );
    if (this.loadModels) await this.fauna.load();
    if (this.disposed) return;
    if (this.fauna.runtime.cat)
      this.kidsCat = new KidsCatEncounter(
        this.npcStates,
        this.fauna.runtime.cat,
        this.fauna.runtime.ground,
        ctx.tuning.hub,
      );
    this.soundscape = new HubSoundscape(
      ctx,
      this.root,
      this.layout,
      this.fauna.sources,
    );
    this.world.step();
    this.render(1);
    const debriefId = this.meta.state.campaign.pendingDebrief;
    const mission = debriefId ? missionDefinitions.get(debriefId) : undefined;
    if (
      mission &&
      typeof document !== 'undefined' &&
      this.screensOption === undefined
    ) {
      this.off.push(
        showDebrief(mission, async () => {
          this.meta.clearDebrief();
          await saveMetaManager(store, this.meta);
        }),
      );
    }
  }

  // ----------------------------------------------------------------- budowa

  /** Bryły, beczki i modele `city_*` są statyczne: scala je `init` po materiale (jak w pokojach). */
  private async buildBlocks(staticWorld: Group): Promise<void> {
    const blocks = new Group();
    blocks.name = 'static-blocks';
    const models = new Group();
    models.name = 'static-models';
    staticWorld.add(blocks, models);
    await Promise.all(
      this.layout.blocks.map(
        async ({
          size,
          position,
          model,
          material,
          interactive,
          yaw,
          shape,
        }) => {
          const collider = this.world.createCollider(
            (shape === 'barrel'
              ? this.rapier.ColliderDesc.cylinder(size.y / 2, size.x / 2)
              : this.rapier.ColliderDesc.cuboid(
                  size.x / 2,
                  size.y / 2,
                  size.z / 2,
                )
            )
              .setTranslation(position.x, position.y, position.z)
              .setCollisionGroups(
                interactionGroups(CollisionGroup.World, 0xffff),
              ),
          );
          this.blockColliders.add(collider.handle);
          if (shape === 'barrel') {
            const barrel = new Group();
            barrel.name = 'hub:barrel';
            barrel.position.copy(position);
            const add = (
              geometry: CylinderGeometry,
              surface: 'rust' | 'metal' | 'rubber',
              y = 0,
            ): void => {
              this.geometries.add(geometry);
              const mesh = new Mesh(geometry, getMaterial(surface));
              mesh.position.y = y;
              barrel.add(mesh);
            };
            const radius = size.x / 2;
            add(
              new CylinderGeometry(radius, radius, size.y, 20, 1, true),
              'rust',
            );
            for (const y of [-0.44, -0.22, 0.22, 0.48])
              add(
                new CylinderGeometry(
                  radius * 1.03,
                  radius * 1.03,
                  size.y * 0.04,
                  20,
                  1,
                  true,
                ),
                'metal',
                size.y * y,
              );
            add(
              new CylinderGeometry(
                radius * 0.98,
                radius * 0.98,
                size.y * 0.02,
                20,
              ),
              'rubber',
              size.y * 0.36,
            );
            blocks.add(barrel);
            return;
          }
          const geometry = new BoxGeometry(size.x, size.y, size.z);
          this.geometries.add(geometry);
          const fallback = new Mesh(
            geometry,
            getMaterial(interactive ? 'interactive' : (material ?? 'world')),
          );
          fallback.position.set(position.x, position.y, position.z);
          blocks.add(fallback);
          if (!model?.startsWith('city_') || !this.loadModels) return;
          try {
            const scene = await cloneCityModel(model);
            if (!scene || this.disposed) return;
            scene.position.set(position.x, position.y - size.y / 2, position.z);
            scene.rotation.y = yaw ?? 0;
            blocks.remove(fallback);
            models.add(scene);
          } catch {
            // Bryła zastępcza zostaje (ten sam collider).
          }
        },
      ),
    );
  }

  /** NPC: widok (`HubNpcs`) i collider walca, przez który gracz nie przechodzi. */
  private buildNpcs(): void {
    const defs = this.layout.npcs ?? [];
    for (const npc of defs) {
      const state = new NpcRuntime(
        npc,
        this.ctx.tuning.hub,
        this.ctx.rng.fork(`hub-npc-idle:${npc.id}`),
      );
      this.npcStates.push(state);
      this.npcById.set(npc.id, state);
      const height = npcHeight(npc);
      const collider = this.rapier.ColliderDesc.cylinder(
        height / 2,
        npcRadius(npc),
      ).setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff));
      if (npc.route) {
        const translation = {
          x: state.position.x,
          y: state.position.y + height / 2,
          z: state.position.z,
        };
        const body = this.world.createRigidBody(
          this.rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(
            translation.x,
            translation.y,
            translation.z,
          ),
        );
        this.world.createCollider(collider, body);
        this.npcBodies.push({ state, body, height, translation });
      } else {
        collider.setTranslation(
          state.position.x,
          state.position.y + height / 2,
          state.position.z,
        );
        this.world.createCollider(collider);
      }
    }
    this.npcTargets = this.npcStates.map((state) => ({
      id: state.def.id,
      focus: state.focus,
    }));
    this.npcs = new HubNpcs(this.npcStates, this.ctx.tuning);
    this.root.add(this.npcs.root);
  }

  private spawnPosition(): Vec3 {
    const t = this.ctx.tuning.player;
    const spawn = this.layout.playerSpawn;
    return {
      x: spawn.x,
      y: spawn.y + t.capsuleHeight / 2 + t.controllerOffset,
      z: spawn.z,
    };
  }

  // ----------------------------------------------------------------- stacje

  private showStation(station: HubStationId): void {
    if (this.disposed) return;
    this.prompt?.update(null);
    this.hubMap?.close();
    this.endTalk();
    this.chatter.interrupt();
    this.screens.show(station, {
      close: () => this.closeStation(),
      ...(station === 'arena'
        ? { openArena: () => this.go({ scene: 'arena' }) }
        : {}),
    });
  }

  private closeStation(): void {
    if (!this.stations.close()) return;
    // Podczas pauzy Input nie tworzy snapshotów: pierwszy po zamknięciu może zawierać E z nakładki.
    this.discardInteractAfterClose = true;
    this.screens.hide();
    this.ctx.resume?.();
  }

  private eyePosition(): Vec3 {
    const state = this.player.getState();
    const t = this.ctx.tuning.player;
    return {
      ...state.position,
      y: state.position.y + state.height / 2 - (t.capsuleHeight - t.eyeHeight),
    };
  }

  private focusedTarget(): HubTarget | { kind: 'cat'; id: 'cat' } | null {
    const state = this.player.getState();
    const t = this.ctx.tuning.hub;
    const eye = this.eyePosition();
    const cat = this.fauna?.petFocus(eye);
    const props = this.layout.props ?? [];
    const target = selectHubTarget(
      this.layout.stations,
      this.npcTargets,
      eye,
      state.yaw,
      state.pitch,
      t.interactRangeM,
      t.focusPaddingM,
      cat ? [...props, { id: 'cat', focus: cat }] : props,
    );
    const isCat = target?.kind === 'prop' && target.id === 'cat' && cat;
    const focus = isCat
      ? cat
      : target?.kind === 'npc'
        ? this.npcById.get(target.id)?.focus
        : null;
    if (!focus) return target;
    const direction = {
      x: -Math.sin(state.yaw) * Math.cos(state.pitch),
      y: Math.sin(state.pitch),
      z: -Math.cos(state.yaw) * Math.cos(state.pitch),
    };
    const distance = rayAabbDistance(eye, direction, focus, t.focusPaddingM);
    if (
      distance !== null &&
      this.world.castRay(
        new this.rapier.Ray(eye, direction),
        distance,
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        (collider) => this.blockColliders.has(collider.handle),
      )
    )
      return null;
    return isCat ? { kind: 'cat', id: 'cat' } : target;
  }

  private useProp(id: string): boolean {
    if (this.stations.opened) return false;
    const def = this.layout.props?.find((p) => p.id === id);
    if (def?.kind === 'seat') return this.toggleSeat(id);
    return this.props.use(
      id,
      this.player.getState().yaw,
      this.chatter.activeId === 'lena_radio_broadcast',
    );
  }

  private toggleSeat(id: string): boolean {
    if (this.seat) return this.stand();
    return this.sit(id);
  }

  private sit(id: string): boolean {
    const def = this.layout.props?.find((p) => p.id === id);
    if (
      !def?.sit ||
      this.seat ||
      this.stations.opened ||
      this.hubMap?.isOpen === true ||
      this.talk !== null
    )
      return false;
    this.seat = def;
    this.seatPose = def;
    this.chatter.interrupt();
    return true;
  }

  private stand(instant = false): boolean {
    if (!this.seat) return false;
    this.seat = null;
    if (instant) {
      this.seatPose = null;
      this.seatBlend = this.previousSeatBlend = 0;
    }
    return true;
  }

  /** Siedząc, gracz nie rusza się, a obrót głowy jest ograniczony do zakresu wokół kierunku siedziska. */
  private seatedInput(input: InputSnapshot, dt: number): InputSnapshot {
    const sit = this.seat!.sit!;
    const t = this.ctx.tuning.hub;
    const state = this.player.getState();
    let yaw = state.yaw - input.lookDelta.x * this.lookScale;
    const center = (sit.yawDeg * Math.PI) / 180;
    const nearest =
      center + Math.round((state.yaw - center) / (2 * Math.PI)) * 2 * Math.PI;
    if (this.seatBlend >= 1) {
      const limit = (t.sitYawLimitDeg * Math.PI) / 180;
      yaw = Math.max(nearest - limit, Math.min(nearest + limit, yaw));
    } else
      yaw +=
        (nearest - yaw) * (1 - Math.exp(-dt / Math.max(1e-3, t.sitBlendS / 3)));
    return {
      held: EMPTY_ACTIONS,
      pressed: EMPTY_ACTIONS,
      released: EMPTY_ACTIONS,
      lookDelta: {
        x: this.lookScale > 0 ? (state.yaw - yaw) / this.lookScale : 0,
        y: input.lookDelta.y,
      },
    };
  }

  private onPropUsed(
    id: string,
    kind: 'jukebox' | 'noodles' | 'radio' | 'bag',
  ): void {
    if (kind === 'bag') return;
    this.endTalk();
    // First-use arrival must not replace a prop's explicit message.
    this.arrivalPending = false;
    if (kind === 'jukebox') {
      const track = this.props.track(id);
      this.soundscape?.setJukeboxTrack(track);
      this.chatter.say({
        conversation: id,
        npc: this.props.texts.jukebox.speaker,
        text: this.props.texts.jukebox.tracks[track]!,
      });
    } else if (kind === 'noodles') {
      this.npcs?.serveSoup();
      this.chatter.say({
        conversation: id,
        npc: 'hela',
        text: this.props.noodleLine(),
      });
    } else if (this.chatter.activeId === 'lena_radio_broadcast')
      this.chatter.interrupt(true);
    else this.chatter.force('lena_radio_broadcast');
  }

  private focusedStation(): HubStationId | null {
    const target = this.focusedTarget();
    return target?.kind === 'station' ? target.id : null;
  }

  private focusedNpc(): string | null {
    const target = this.focusedTarget();
    return target?.kind === 'npc' ? target.id : null;
  }

  /** Pokazuje kolejną kwestię NPC (E przy spojrzeniu albo `hub talk`, które nie wymaga bliskości); `null`, gdy brak tekstów NPC. */
  private talkTo(id: string, anywhere = false): NpcLine | null {
    const line = this.arrival?.react(id) ?? this.dialogue.talk(id);
    if (!line) return null;
    this.chatter.interrupt();
    const state = this.npcById.get(id);
    if (state?.def.route) state.route.moving = false;
    this.talk = { line, remainingS: this.ctx.tuning.hub.npcLineS, anywhere };
    this.dialogUi?.show(line);
    return line;
  }

  private endTalk(): void {
    this.talk = null;
    this.dialogUi?.hide();
  }

  /** Ukończone misje: w debugu `?campaign=` (lista po przecinku, `none` = brak) zastępuje zapis meta. */
  private campaignCompleted(): ReadonlySet<string> {
    const override = this.ctx.commands ? this.params.get('campaign') : null;
    if (override === null) return new Set(this.meta.state.campaign.completed);
    return new Set(
      override
        .split(',')
        .filter(
          (id) => id !== '' && id !== 'none' && missionDefinitions.has(id),
        ),
    );
  }

  private setArrival(context: HubArrivalContext | null): void {
    this.arrival = context
      ? new HubArrival(
          context,
          this.npcTexts.npcs,
          this.layout.npcs ?? [],
          this.layout.playerSpawn,
        )
      : null;
    this.arrivalElapsedS = 0;
    this.arrivalPending = context !== null;
  }

  private tickArrival(dt: number): void {
    if (!this.arrivalPending || !this.arrival) return;
    this.arrivalElapsedS += dt;
    if (
      this.arrivalElapsedS < this.ctx.tuning.hub.arrivalDelayS ||
      this.stations.opened ||
      this.talk
    )
      return;
    this.arrivalPending = false;
    const line = this.arrival.greet();
    if (!line) return;
    this.chatter.say({
      conversation: 'arrival',
      npc: line.id,
      text: line.line,
    });
    this.greetings.mark(this.arrival.state.key);
  }

  /** Po powrocie prądu najbliższy mieszkaniec z komentarzem mówi kwestię (o ile nic innego nie trwa). */
  private commentPowerDip(player: Vec3): void {
    const blocked =
      this.talk !== null ||
      this.chatter.line !== null ||
      this.chatter.activeId !== null ||
      this.stations.opened !== null ||
      this.hubMap?.isOpen === true;
    const comment = pickDipComment(
      this.hubEvents.powerDip,
      this.npcStates.map(({ def, position }) => ({ id: def.id, position })),
      player,
      this.ctx.tuning.hub.powerDipCommentRadiusM,
      this.dipRng,
      blocked,
    );
    if (comment)
      this.chatter.say({
        conversation: 'power_dip',
        npc: comment.npc,
        text: comment.text,
      });
  }

  /** Dymek znika po `npcLineS` s albo gdy gracz odejdzie od NPC. */
  private tickTalk(dt: number): void {
    const talk = this.talk;
    if (!talk) return;
    talk.remainingS -= dt;
    const npc = this.npcById.get(talk.line.id);
    const player = this.player.getState().position;
    const away =
      !talk.anywhere &&
      npc !== undefined &&
      Math.hypot(player.x - npc.position.x, player.z - npc.position.z) >
        this.ctx.tuning.hub.interactRangeM + 1;
    if (talk.remainingS <= 0 || away) this.endTalk();
  }

  private go(params: URLSearchParams | Record<string, string>): void {
    const query = new URLSearchParams(params);
    if (this.params.get('debug') === '1') query.set('debug', '1');
    preserveLiteFx(this.params, query);
    this.navigate(`?${query}`);
  }

  // ----------------------------------------------------------------- pętla

  step(dt: number, input: InputSnapshot): void {
    const discardInteract = this.discardInteractAfterClose;
    this.discardInteractAfterClose = false;
    this.dressing?.step(dt);
    this.previous = this.player.getState();
    // Nakładka otwarta: ruch gracza zatrzymany (jak ekran sklepu w RunScene).
    if (this.stations.opened || !(dt > 0)) return;
    if (input.pressed.has('map') && this.talk === null) this.hubMap?.toggle();
    const mapOpen = this.hubMap?.isOpen === true;
    this.props.step(dt);
    const seated = this.seat !== null;
    if (seated && SEAT_MOVE_ACTIONS.some((a) => input.pressed.has(a)))
      this.stand();
    this.previousSeatBlend = this.seatBlend;
    const blendStep = dt / Math.max(1e-3, this.ctx.tuning.hub.sitBlendS);
    this.seatBlend = Math.max(
      0,
      Math.min(1, this.seatBlend + (this.seat ? blendStep : -blendStep)),
    );
    if (!this.seat && this.seatBlend === 0) this.seatPose = null;
    this.fauna?.step(dt, this.previous);
    const player = this.player.getState().position;
    for (const state of this.npcStates)
      state.step(
        dt,
        player,
        this.talk?.line.id === state.def.id,
        this.ctx.tuning.player.capsuleRadius,
        this.chatter.line?.npc === state.def.id,
        this.talk?.line.id === state.def.id
          ? null
          : this.chatter.lookTargetFor(state.def.id),
      );
    this.stepKidsCat(dt, player);
    for (const entry of this.npcBodies) {
      entry.translation.x = entry.state.position.x;
      entry.translation.y = entry.state.position.y + entry.height / 2;
      entry.translation.z = entry.state.position.z;
      entry.body.setNextKinematicTranslation(entry.translation);
    }
    this.soundscape?.step(dt, player);
    if (this.powerDip.step(dt)) this.commentPowerDip(player);
    this.player.step(
      dt,
      this.seat ? this.seatedInput(input, dt) : this.withPendingLook(input),
    );
    this.world.gravity.y = this.ctx.tuning.physics.gravity;
    this.world.timestep = dt;
    this.world.step();
    if (
      seated &&
      this.seat &&
      !mapOpen &&
      !discardInteract &&
      input.pressed.has(HUB_INTERACT_ACTION)
    )
      this.stand();
    const target = seated ? null : this.focusedTarget();
    if (
      !mapOpen &&
      !discardInteract &&
      target &&
      input.pressed.has(HUB_INTERACT_ACTION)
    ) {
      if (target.kind === 'station') this.stations.open(target.id);
      else if (target.kind === 'prop') this.useProp(target.id);
      else if (target.kind === 'cat') this.fauna?.pet();
      else this.talkTo(target.id);
    }
    if (
      !mapOpen &&
      target?.kind === 'prop' &&
      input.pressed.has('attack') &&
      this.layout.props?.find((p) => p.id === target.id)?.kind === 'bag'
    )
      this.useProp(target.id);
    this.tickTalk(dt);
    this.chatter.step(
      dt,
      this.player.getState().position,
      this.stations.opened !== null || this.talk !== null,
    );
    this.tickArrival(dt);
  }

  /** Dzieci przy kocie; rozmowa raz na spotkanie, gdy nic innego nie trwa i gracz jest w zasięgu. */
  private stepKidsCat(dt: number, player: Vec3): void {
    const encounter = this.kidsCat;
    if (!encounter) return;
    encounter.step(dt, this.talk?.line.id ?? null);
    if (
      !encounter.chatPending ||
      this.talk !== null ||
      this.chatter.line !== null ||
      this.chatter.activeId !== null ||
      this.stations.opened !== null ||
      this.hubMap?.isOpen === true
    )
      return;
    const ids = encounter.activeIds();
    let x = 0,
      z = 0;
    for (const id of ids) {
      const p = this.npcById.get(id)!.position;
      x += p.x;
      z += p.z;
    }
    if (
      Math.hypot(player.x - x / ids.length, player.z - z / ids.length) >
      this.ctx.tuning.hub.chatterRadiusM
    )
      return;
    encounter.markChatted();
    this.chatter.force(KIDS_CAT_CONVERSATION);
  }

  /** Komenda debug `hub tp`: ustawia kierunek patrzenia jako jednorazowy ruch myszy w następnym kroku. */
  private withPendingLook(input: InputSnapshot): InputSnapshot {
    const target = this.pendingLook;
    if (!target) return input;
    this.pendingLook = null;
    const state = this.player.getState();
    return {
      ...input,
      lookDelta: {
        x: input.lookDelta.x - (target.yaw - state.yaw) / this.lookScale,
        y: input.lookDelta.y - (target.pitch - state.pitch) / this.lookScale,
      },
    };
  }

  render(alpha: number, frameDt = 1 / 60): void {
    this.fauna?.render(alpha);
    const mapOpen = this.hubMap?.isOpen === true;
    if (mapOpen) {
      const state = this.player.getState();
      this.hubMap?.update(state.position, state.yaw);
    }
    const target = this.seat ? null : this.focusedTarget();
    if (this.seat) {
      this.prompt?.update(
        this.props.texts.labels.stand,
        this.stations.opened !== null || mapOpen,
      );
    } else if (target?.kind === 'npc') {
      const name =
        this.npcTexts.npcs.find(({ id }) => id === target.id)?.name ??
        target.id;
      // Podczas rozmowy dymek zajmuje miejsce podpowiedzi (E dalej daje następną kwestię).
      this.prompt?.update(
        this.npcTexts.talkPrompt,
        this.stations.opened !== null || this.talk !== null || mapOpen,
        name,
      );
    } else if (target?.kind === 'prop' || target?.kind === 'cat') {
      this.prompt?.update(
        target.kind === 'cat'
          ? catPet.label
          : (this.layout.props?.find((p) => p.id === target.id)?.label ?? null),
        this.stations.opened !== null || mapOpen,
      );
    } else
      this.prompt?.update(
        this.layout.stations.find(
          ({ id }) => target?.kind === 'station' && id === target.id,
        )?.label ?? null,
        this.stations.opened !== null || mapOpen,
      );
    this.warmth?.update(
      this.props.warmthLeft,
      this.ctx.tuning.hub.noodlesWarmthS,
    );
    const power = this.powerDip.level(loadSettings().flashes);
    setPowerLevel(power);
    this.ctx.audio?.setPowerLevel(power);
    this.decor?.update(frameDt);
    this.chatterUi?.update(this.chatter.line);
    this.npcs?.render(
      alpha,
      frameDt,
      this.ctx.camera?.position ?? this.player.getState().position,
      this.talk?.line.id ?? this.chatter.line?.npc ?? null,
      this.arrival ? this.isArrivalPending : null,
    );
    this.propView?.render(alpha, this.npcs?.soupProgress);
    this.lights.sync();
    this.atmosphere?.sync(frameDt);
    this.markers?.update(
      frameDt ?? 1 / 60,
      this.ctx.camera?.position ?? this.player.getState().position,
    );
    const camera = this.ctx.camera;
    if (!camera) {
      this.dressing?.render(frameDt, undefined);
      this.soundscape?.render(alpha, this.stations.opened !== null);
      return;
    }
    const pose = this.fpsCamera.update(
      frameDt,
      this.previous,
      this.player.getState(),
      alpha,
    );
    const sit = this.seatPose?.sit;
    if (sit) {
      const linear =
        this.previousSeatBlend +
        (this.seatBlend - this.previousSeatBlend) * alpha;
      const e = linear * linear * (3 - 2 * linear);
      pose.position.x += (sit.position.x - pose.position.x) * e;
      pose.position.y += (sit.position.y - pose.position.y) * e;
      pose.position.z += (sit.position.z - pose.position.z) * e;
    }
    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    camera.rotation.set(pose.pitch, pose.yaw, pose.roll, 'YXZ');
    if (Math.abs(camera.fov - pose.fov) > 1e-3) {
      camera.fov = pose.fov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
    this.npcs?.cull(camera);
    this.soundscape?.render(alpha, this.stations.opened !== null);
    this.dressing?.render(frameDt, camera);
    const velocity = this.player.getState().velocity;
    this.fppView.place(camera.matrixWorld, frameDt, {
      held: 'blade',
      blade: IDLE_BLADE,
      horizontalSpeed: Math.hypot(velocity.x, velocity.z),
      visible: !this.fauna?.renderPetHand(camera.matrixWorld, alpha),
    });
  }

  reset(): void {
    if (this.stations.opened) this.closeStation();
    this.stand(true);
    this.player.teleport(this.spawnPosition());
    this.previous = this.player.getState();
  }

  query(name: string): unknown {
    if (name === 'horizon') return this.atmosphere?.horizon();
    if (name === 'hubFauna') return this.fauna?.runtime.query();
    if (name === 'hubKidsCat') return this.kidsCat?.query() ?? null;
    switch (name) {
      case 'hubNpcVisible':
        return this.npcs?.visibleCount ?? 0;
      case 'hubProps':
        return this.props.snapshot;
      case 'hubPower':
        return {
          level: this.powerDip.level(loadSettings().flashes),
          active: this.powerDip.active,
          nextInS: this.powerDip.nextInS,
        };
      case 'hubAmbience':
        return this.soundscape?.query() ?? [];
      case 'meta':
        return this.meta.state;
      case 'achievements':
        return this.meta.state.achievements;
      case 'level':
        return {
          ...this.meta.xpProgress,
          talentPoints: this.meta.talentPoints,
          freePoints: this.meta.freePoints,
        };
      case 'hubStation':
        return this.stations.opened;
      case 'hubMap':
        return { open: this.hubMap?.isOpen === true };
      case 'hubFocus':
        return this.focusedStation();
      case 'hubNpc':
        return this.focusedNpc();
      case 'hubTalk':
        return this.talk ? { ...this.talk.line } : null;
      case 'hubChatter':
        return this.chatter.line ? { ...this.chatter.line } : null;
      case 'playerLook': {
        const { yaw, pitch } = this.player.getState();
        return { yaw, pitch };
      }
      case 'hubSeat':
        return this.seat?.id ?? null;
      case 'hubArrival':
        return this.arrival?.state ?? null;
      case 'npcs':
        return this.npcStates.map((state) => ({
          id: state.def.id,
          x: state.position.x,
          y: state.position.y,
          z: state.position.z,
          bodyYaw: state.look.bodyYaw,
          clip: state.animation(
            this.talk?.line.id === state.def.id ||
              this.chatter.line?.npc === state.def.id,
          ),
        }));
      case 'playerPos':
        return { ...this.player.getState().position };
      case 'stations':
        return this.layout.stations.map(({ id, position, radius }) => ({
          id,
          x: position.x,
          z: position.z,
          radius,
        }));
      default:
        return undefined;
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
    const host: CommandHost | undefined = this.ctx.commands && {
      register: (name, help, run) =>
        this.ctx.commands!.register(name, help, (args) => {
          const result = run(args);
          this.metaBar?.refresh();
          this.screens.refresh?.();
          return result;
        }),
    };
    const metaCommands = registerMetaCommands(host, this.meta, this.metaStore!);
    this.off.push(() => metaCommands.dispose());
    register('hub use', 'hub use <propId>', (args) => {
      if (args.length !== 1 || !args[0]) return 'hub use <propId>';
      return String(this.useProp(args[0]));
    });
    register('hub sit', 'hub sit <seatId> — usiądź na siedzisku', (args) => {
      if (args.length !== 1 || !args[0]) return 'hub sit <seatId>';
      return this.sit(args[0]) ? `Siedzisz: ${args[0]}` : 'Nie można usiąść.';
    });
    register('hub stand', 'hub stand — wstań', () =>
      this.stand() ? 'Wstałeś.' : 'Nie siedzisz.',
    );
    register(
      'hub campaign',
      'hub campaign <missionId...|clear> — ustaw ukończone misje (tylko ta wizyta, bez zapisu) i przeładuj kryjówkę',
      (args) => {
        if (args.length === 0)
          return `Użycie: hub campaign <${[...missionDefinitions.keys()].join('|')}...|clear>`;
        const clear = args.length === 1 && args[0] === 'clear';
        const unknown = clear
          ? undefined
          : args.find((id) => !missionDefinitions.has(id));
        if (unknown) return `Nieznana misja: ${unknown}`;
        this.go({ scene: 'hub', campaign: clear ? 'none' : args.join(',') });
        return clear
          ? 'Kampania wyczyszczona (przeładowanie).'
          : `Ukończone misje: ${args.join(', ')} (przeładowanie).`;
      },
    );
    register(
      'hub arrive',
      'hub arrive <firstVisit|victory|death|mission <missionId>> — odtwórz przybycie do kryjówki',
      (args) => {
        if (args[0] === 'mission') {
          const id = args[1];
          if (args.length !== 2 || !id || !missionDefinitions.has(id))
            return 'Użycie: hub arrive mission <missionId>';
          this.endTalk();
          this.chatter.interrupt();
          this.setArrival({
            kind: 'victory',
            key: `debug:mission:${id}`,
            missionId: id,
          });
          return `Przybycie: victory po ${id}`;
        }
        const kind = args[0];
        if (
          args.length !== 1 ||
          (kind !== 'firstVisit' && kind !== 'victory' && kind !== 'death')
        )
          return 'Użycie: hub arrive <firstVisit|victory|death>';
        this.endTalk();
        this.chatter.interrupt();
        this.setArrival({ kind, key: `debug:${kind}` });
        return `Przybycie: ${kind}`;
      },
    );
    register(
      'hub open',
      `hub open <${stationList}> — otwórz nakładkę stacji`,
      (args) => {
        const id = HUB_STATION_IDS.find((station) => station === args[0]);
        if (args.length !== 1 || !id)
          return `Użycie: hub open <${stationList}>`;
        if (this.stations.opened)
          return `Stacja już otwarta: ${this.stations.opened}`;
        return this.stations.open(id)
          ? `Stacja: ${id}`
          : `Brak stacji w układzie: ${id}`;
      },
    );
    register(
      'hub look',
      `hub look <${lookList}> — spójrz na cel interakcji`,
      (args) => {
        const station = this.layout.stations.find(({ id }) => id === args[0]);
        const npc = this.layout.npcs?.find(({ id }) => id === args[0]);
        const eye = this.eyePosition();
        const focus =
          station?.focus ??
          (npc ? this.npcById.get(npc.id)?.focus : undefined) ??
          this.layout.props?.find((p) => p.id === args[0])?.focus ??
          (args[0] === 'cat' ? this.fauna?.petFocus(eye) : null);
        if (args.length !== 1 || !focus)
          return `Użycie: hub look <${lookList}>`;
        const dx = focus.position.x - eye.x;
        const dz = focus.position.z - eye.z;
        const dy = focus.position.y + (npc ? 0.35 : 0) - eye.y;
        this.pendingLook = {
          yaw: Math.atan2(-dx, -dz),
          pitch: Math.atan2(dy, Math.hypot(dx, dz)),
        };
        return `Patrzysz na: ${args[0]}`;
      },
    );
    register(
      'hub tp',
      'hub tp <x> <z> [yawDeg] [pitchDeg] — teleport gracza (yaw 0 = patrzy w −Z)',
      (args) => {
        const [x, z, yaw = 0, pitch = 0] = args.map(Number);
        if (
          args.length < 2 ||
          args.length > 4 ||
          [x, z, yaw, pitch].some((value) => !Number.isFinite(value))
        )
          return 'Użycie: hub tp <x> <z> [yawDeg] [pitchDeg]';
        this.stand(true);
        this.player.teleport({ ...this.spawnPosition(), x: x!, z: z! });
        this.previous = this.player.getState();
        this.pendingLook = {
          yaw: (yaw! * Math.PI) / 180,
          pitch: (pitch! * Math.PI) / 180,
        };
        return `Gracz: ${x}, ${z}`;
      },
    );
    register(
      'hub talk',
      'hub talk <npc> — pokaż kolejną kwestię NPC (bez patrzenia na niego)',
      (args) => {
        const id = args[0];
        if (args.length !== 1 || !id || !this.dialogue.has(id))
          return `Użycie: hub talk <${this.npcTexts.npcs.map((npc) => npc.id).join('|')}>`;
        if (this.stations.opened)
          return `Stacja otwarta: ${this.stations.opened}`;
        const line = this.talkTo(id, true);
        return line ? `${line.name}: ${line.line}` : `Brak NPC: ${id}`;
      },
    );
    register(
      'hub kidscat',
      'hub kidscat — kot odpoczywa przy trasie dzieci, wymuś spotkanie',
      (args) => {
        const kidsCat = this.kidsCat,
          runtime = this.fauna?.runtime,
          ola = this.npcById.get('ola');
        if (args.length || !kidsCat || !runtime || !ola)
          return 'Użycie: hub kidscat (wymaga kota i dzieci na trasie)';
        const t = this.ctx.tuning.hub;
        const route = ola.def.route!.points;
        const to =
          route[
            (ola.route.segment + ola.route.direction + route.length) %
              route.length
          ]!;
        const dx = to.x - ola.position.x,
          dz = to.z - ola.position.z,
          d = Math.hypot(dx, dz) || 1;
        for (const side of [1, -1]) {
          const x = ola.position.x - (dz / d) * t.kidsCatDebugM * side,
            z = ola.position.z + (dx / d) * t.kidsCatDebugM * side;
          if (runtime.placeCatAt(x, z, t.kidsCatPetS + 12)) {
            kidsCat.force();
            return 'Węgielek odpoczywa przy trasie dzieci.';
          }
        }
        return 'Brak bezpiecznego miejsca dla kota przy trasie Oli.';
      },
    );
    register(
      'hub chatter',
      'hub chatter <id> — wymuś podsłuchiwaną rozmowę',
      (args) => {
        if (this.stations.opened)
          return `Stacja otwarta: ${this.stations.opened}`;
        if (
          args.length !== 1 ||
          !args[0] ||
          !this.npcTexts.conversations?.some((c) => c.id === args[0])
        )
          return 'Użycie: hub chatter <id rozmowy>';
        this.endTalk();
        this.chatter.force(args[0]);
        return `Rozmowa: ${args[0]}`;
      },
    );
    register('hub dip', 'hub dip — wymuś spadek napięcia', (args) => {
      if (args.length) return 'Użycie: hub dip';
      this.powerDip.force();
      return 'Prąd przygasa.';
    });
    register('hub map', 'hub map — przełącz plan stacji', () => {
      if (!this.hubMap) return 'Plan stacji niedostępny.';
      if (this.stations.opened || this.talk !== null)
        return 'Plan stacji niedostępny przy otwartej stacji lub rozmowie.';
      this.hubMap.toggle();
      return this.hubMap.isOpen
        ? 'Plan stacji: otwarty'
        : 'Plan stacji: zamknięty';
    });
    register('hub close', 'hub close — zamknij nakładkę stacji', () => {
      const closed = this.stations.opened;
      this.closeStation();
      return closed ? `Zamknięto: ${closed}` : 'Żadna stacja nie jest otwarta.';
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    try {
      for (const off of this.off.splice(0)) off();
      this.stations?.dispose();
      this.markers?.dispose();
      this.screens?.dispose();
      this.prompt?.dispose();
      this.propView?.dispose();
      this.warmth?.dispose();
      this.dialogUi?.dispose();
      this.hubMap?.dispose();
      this.chatterUi?.dispose();
      this.npcs?.dispose();
      this.metaBar?.dispose();
      this.fppView?.dispose();
      this.fpsCamera?.dispose();
      this.player?.dispose();
      if (this.entities && this.playerId !== undefined)
        this.entities.destroy(this.playerId);
      this.world?.free();
    } finally {
      setPowerLevel(1);
      this.ctx?.audio?.setPowerLevel(1);
      this.decor?.dispose();
      this.soundscape?.dispose();
      this.fauna?.dispose();
      this.dressing?.dispose();
      this.root.removeFromParent();
      this.root.clear();
      this.atmosphere?.dispose();
      for (const geometry of this.geometries) geometry.dispose();
      this.geometries.clear();
    }
  }
}
