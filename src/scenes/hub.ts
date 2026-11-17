import { BoxGeometry, CylinderGeometry, Group, Mesh } from 'three';
import type { BufferGeometry, Scene as ThreeScene } from 'three';
import type { RigidBody, World } from '@dimforge/rapier3d-compat';
import type { GameContext } from '../core/context';
import { EntityRegistry } from '../core/entities';
import type { EntityId } from '../core/events';
import type { InputSnapshot } from '../core/input';
import type { Vec3 } from '../core/math';
import { HUB_STATION_IDS } from '../core/metaTypes';
import type { HubStationId } from '../core/metaTypes';
import { createIndexedDbSaveStore, loadSettings } from '../core/save';
import type { SaveStore } from '../core/save';
import type { BladeView } from '../combat/melee/plasmaBlade';
import hideoutData from '../data/hub/hideout.json';
import npcTextData from '../data/hub/npcs.pl.json';
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
import { createStyleLights } from '../render/lights';
import { getMaterial } from '../render/materials';
import { SceneAtmosphere } from '../render/sceneAtmosphere';
import { batchStaticGeometry } from '../render/staticBatch';
import { createMetaBar } from '../ui/hub/metaBar';
import { createHubGreetings } from '../ui/hub/greetings';
import type { MetaBar } from '../ui/hub/metaBar';
import { createMissionsPanel } from '../ui/hub/missionsPanel';
import { createTalentsPanel } from '../ui/hub/talentsPanel';
import { createWorkshopPanel } from '../ui/hub/workshopPanel';
import { HtmlHubScreens } from '../ui/hubScreens';
import { HubChatterUi } from '../ui/hubChatter';
import { HubChatter } from '../world/hubChatter';
import { HubArrival, hubArrivalContext } from '../world/hubArrival';
import type { HubArrivalContext, HubGreetings } from '../world/hubArrival';
import { HubDialog } from '../ui/hubDialog';
import { HubPrompt } from '../ui/hubPrompt';
import type { HubPanelRegistry, HubScreens } from '../ui/hubScreens';
import { registerMetaCommands } from '../ui/metaCommands';
import type { CommandHost } from '../ui/metaCommands';
import { loadHubLayout } from '../world/hubSchema';
import type { HubLayout } from '../world/hubSchema';
import {
  NpcRuntime,
  npcRadius,
  NpcDialogue,
  loadNpcTexts,
  npcFocusBox,
  npcHeight,
} from '../world/hubNpcs';
import type { NpcLine, NpcTexts } from '../world/hubNpcs';
import { HubStations, selectHubTarget } from '../world/hubStations';
import type { HubTarget } from '../world/hubStations';
import { HUB_BATCH_CELL_M, HubDecor } from './hubDecor';
import { HubNpcs } from './hubNpcs';
import { HubSoundscape } from './hubSoundscape';
import { HubFauna } from './hubFauna';
import type { Scene } from './index';
import { preserveLiteFx } from '../render/fxMode';

export interface HubSceneOptions {
  layout?: HubLayout;
  screens?: HubScreens;
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
const lookList = `${stationList}|<npc>|<propId>`;
// E jest przypisane do power2; w kryjówce nie ma walki ani mocy.
const HUB_INTERACT_ACTION = 'power2';

/** Kryjówka ruchu oporu (F4-07): peron nieczynnej stacji metra, FPP bez wrogów, stacje jako strefy z nakładkami UI. */
export class HubScene implements Scene {
  readonly id = 'hub';
  private readonly layout: HubLayout;
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
  private entities!: EntityRegistry;
  private playerId!: EntityId;
  private player!: PlayerController;
  private previous!: PlayerState;
  private fpsCamera!: FpsCamera;
  private fppView!: FppViewModel;
  private stations!: HubStations;
  private atmosphere?: SceneAtmosphere;
  private dressing?: CityDressing;
  private decor?: HubDecor;
  private soundscape?: HubSoundscape;
  private fauna?: HubFauna;
  private readonly root = new Group();
  private readonly lights = createStyleLights();
  private readonly geometries = new Set<BufferGeometry>();
  private readonly off: (() => void)[] = [];
  private pendingLook: { yaw: number; pitch: number } | null = null;
  private discardInteractAfterClose = false;
  private lookScale = 1;
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
    if (this.disposed) return;
    this.screens =
      this.screensOption ??
      new HtmlHubScreens(undefined, {
        panels: this.options.panels ?? DEFAULT_PANELS,
        host: {
          manager: this.meta,
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
    this.npcTexts = loadNpcTexts(
      this.options.npcTexts ?? npcTextData,
      this.layout.npcs ?? [],
    );
    if (this.screensOption === undefined)
      this.chatterUi = new HubChatterUi(this.layout.npcs ?? [], this.npcTexts);
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
    );
    three.add(this.root);
    this.root.add(this.lights);
    await this.buildBlocks();
    if (this.disposed) return;
    const staticDecor = new Group();
    staticDecor.name = 'static-decor';
    this.root.add(staticDecor);
    await loadDecor(staticDecor, this.layout.decor, this.loadModels);
    if (this.disposed) return;
    batchStaticGeometry(staticDecor, this.geometries, {
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
    this.soundscape = new HubSoundscape(
      ctx,
      this.root,
      this.layout,
      this.fauna.sources,
    );
    this.world.step();
    this.render(1);
  }

  // ----------------------------------------------------------------- budowa

  /** Bryły, beczki i modele `city_*` są statyczne: po wczytaniu scalane po materiale (jak w pokojach). */
  private async buildBlocks(): Promise<void> {
    const blocks = new Group();
    blocks.name = 'static-blocks';
    const models = new Group();
    models.name = 'static-models';
    this.root.add(blocks, models);
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
          this.world.createCollider(
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
    if (this.disposed) return;
    batchStaticGeometry(blocks, this.geometries, {
      cellSize: HUB_BATCH_CELL_M,
    });
    batchStaticGeometry(models, this.geometries, {
      cellSize: HUB_BATCH_CELL_M,
    });
  }

  /** NPC: widok (`HubNpcs`) i collider walca, przez który gracz nie przechodzi. */
  private buildNpcs(): void {
    const defs = this.layout.npcs ?? [];
    for (const npc of defs) {
      const state = new NpcRuntime(npc, this.ctx.tuning.hub);
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

  private focusedTarget(): HubTarget | null {
    const state = this.player.getState();
    const t = this.ctx.tuning.hub;
    return selectHubTarget(
      this.layout.stations,
      this.npcTargets,
      this.eyePosition(),
      state.yaw,
      state.pitch,
      t.interactRangeM,
      t.focusPaddingM,
      this.layout.props ?? [],
    );
  }

  private useProp(id: string): boolean {
    if (this.stations.opened) return false;
    return this.props.use(
      id,
      this.player.getState().yaw,
      this.chatter.activeId === 'lena_radio_broadcast',
    );
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
    this.props.step(dt);
    this.fauna?.step(dt, this.previous);
    const player = this.player.getState().position;
    for (const state of this.npcStates)
      state.step(
        dt,
        player,
        this.talk?.line.id === state.def.id,
        this.ctx.tuning.player.capsuleRadius,
      );
    for (const entry of this.npcBodies) {
      entry.translation.x = entry.state.position.x;
      entry.translation.y = entry.state.position.y + entry.height / 2;
      entry.translation.z = entry.state.position.z;
      entry.body.setNextKinematicTranslation(entry.translation);
    }
    this.soundscape?.step(dt, player);
    this.player.step(dt, this.withPendingLook(input));
    this.world.gravity.y = this.ctx.tuning.physics.gravity;
    this.world.timestep = dt;
    this.world.step();
    const target = this.focusedTarget();
    if (!discardInteract && target && input.pressed.has(HUB_INTERACT_ACTION)) {
      if (target.kind === 'station') this.stations.open(target.id);
      else if (target.kind === 'prop') this.useProp(target.id);
      else this.talkTo(target.id);
    }
    if (
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
    const target = this.focusedTarget();
    if (target?.kind === 'npc') {
      const name =
        this.npcTexts.npcs.find(({ id }) => id === target.id)?.name ??
        target.id;
      // Podczas rozmowy dymek zajmuje miejsce podpowiedzi (E dalej daje następną kwestię).
      this.prompt?.update(
        this.npcTexts.talkPrompt,
        this.stations.opened !== null || this.talk !== null,
        name,
      );
    } else if (target?.kind === 'prop') {
      this.prompt?.update(
        this.layout.props?.find((p) => p.id === target.id)?.label ?? null,
        this.stations.opened !== null,
      );
    } else
      this.prompt?.update(
        this.layout.stations.find(
          ({ id }) => target?.kind === 'station' && id === target.id,
        )?.label ?? null,
        this.stations.opened !== null,
      );
    this.propView?.render(alpha);
    this.warmth?.update(
      this.props.warmthLeft,
      this.ctx.tuning.hub.noodlesWarmthS,
    );
    this.decor?.update(frameDt);
    this.chatterUi?.update(this.chatter.line);
    this.npcs?.render(
      alpha,
      frameDt,
      this.ctx.camera?.position ?? this.player.getState().position,
      this.chatter.line?.npc ?? null,
    );
    this.lights.sync();
    this.atmosphere?.sync(frameDt);
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
    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    camera.rotation.set(pose.pitch, pose.yaw, pose.roll, 'YXZ');
    if (Math.abs(camera.fov - pose.fov) > 1e-3) {
      camera.fov = pose.fov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
    this.soundscape?.render(alpha, this.stations.opened !== null);
    this.dressing?.render(frameDt, camera);
    const velocity = this.player.getState().velocity;
    this.fppView.place(camera.matrixWorld, frameDt, {
      held: 'blade',
      blade: IDLE_BLADE,
      horizontalSpeed: Math.hypot(velocity.x, velocity.z),
    });
  }

  reset(): void {
    if (this.stations.opened) this.closeStation();
    this.player.teleport(this.spawnPosition());
    this.previous = this.player.getState();
  }

  query(name: string): unknown {
    if (name === 'hubFauna') return this.fauna?.runtime.query();
    switch (name) {
      case 'hubProps':
        return this.props.snapshot;
      case 'hubAmbience':
        return this.soundscape?.query() ?? [];
      case 'meta':
        return this.meta.state;
      case 'level':
        return {
          ...this.meta.xpProgress,
          talentPoints: this.meta.talentPoints,
          freePoints: this.meta.freePoints,
        };
      case 'hubStation':
        return this.stations.opened;
      case 'hubFocus':
        return this.focusedStation();
      case 'hubNpc':
        return this.focusedNpc();
      case 'hubTalk':
        return this.talk ? { ...this.talk.line } : null;
      case 'hubChatter':
        return this.chatter.line ? { ...this.chatter.line } : null;
      case 'hubArrival':
        return this.arrival?.state ?? null;
      case 'npcs':
        return this.npcStates.map((state) => ({
          id: state.def.id,
          x: state.position.x,
          y: state.position.y,
          z: state.position.z,
          bodyYaw: state.look.bodyYaw,
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
    register(
      'hub arrive',
      'hub arrive <firstVisit|victory|death> — odtwórz przybycie do kryjówki',
      (args) => {
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
      `hub look <${lookList}> — spójrz na stację albo NPC`,
      (args) => {
        const station = this.layout.stations.find(({ id }) => id === args[0]);
        const npc = this.layout.npcs?.find(({ id }) => id === args[0]);
        const focus =
          station?.focus ??
          (npc ? this.npcById.get(npc.id)?.focus : undefined) ??
          this.layout.props?.find((p) => p.id === args[0])?.focus;
        if (args.length !== 1 || !focus)
          return `Użycie: hub look <${lookList}>`;
        const eye = this.eyePosition();
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
      this.screens?.dispose();
      this.prompt?.dispose();
      this.propView?.dispose();
      this.warmth?.dispose();
      this.dialogUi?.dispose();
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
