import { BoxGeometry, Group, Mesh } from 'three';
import type { BufferGeometry, Scene as ThreeScene } from 'three';
import type { World } from '@dimforge/rapier3d-compat';
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
import { createMetaBar } from '../ui/hub/metaBar';
import type { MetaBar } from '../ui/hub/metaBar';
import { createMissionsPanel } from '../ui/hub/missionsPanel';
import { createTalentsPanel } from '../ui/hub/talentsPanel';
import { createWorkshopPanel } from '../ui/hub/workshopPanel';
import { HtmlHubScreens } from '../ui/hubScreens';
import { HubPrompt } from '../ui/hubPrompt';
import type { HubPanelRegistry, HubScreens } from '../ui/hubScreens';
import { registerMetaCommands } from '../ui/metaCommands';
import type { CommandHost } from '../ui/metaCommands';
import { loadHubLayout } from '../world/hubSchema';
import type { HubLayout } from '../world/hubSchema';
import { HubStations, selectHubFocus } from '../world/hubStations';
import { HubDecor } from './hubDecor';
import type { Scene } from './index';

export interface HubSceneOptions {
  layout?: HubLayout;
  screens?: HubScreens;
  params?: URLSearchParams;
  navigate?: (url: string) => void;
  loadModels?: boolean;
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
    if (this.screensOption === undefined) this.prompt = new HubPrompt();
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
    await loadDecor(this.root, this.layout.decor, this.loadModels);
    if (this.disposed) return;
    this.dressing = new CityDressing(
      this.root,
      this.layout,
      this.atmosphere.theme,
      floorY,
      this.layout.id,
    );
    this.decor = new HubDecor(this.layout.panels ?? [], this.layout.stations);
    this.root.add(this.decor.root);

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
      ctx.bus.on('hub_station_opened', ({ station }) =>
        this.showStation(station),
      ),
      ...META_EVENTS.map((name) =>
        ctx.bus.on(name, () => this.screens.refresh?.()),
      ),
    );
    this.registerCommands();
    this.world.step();
    this.render(1);
  }

  // ----------------------------------------------------------------- budowa

  private async buildBlocks(): Promise<void> {
    await Promise.all(
      this.layout.blocks.map(
        async ({ size, position, model, material, interactive }) => {
          this.world.createCollider(
            this.rapier.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
              .setTranslation(position.x, position.y, position.z)
              .setCollisionGroups(
                interactionGroups(CollisionGroup.World, 0xffff),
              ),
          );
          const geometry = new BoxGeometry(size.x, size.y, size.z);
          this.geometries.add(geometry);
          const fallback = new Mesh(
            geometry,
            getMaterial(interactive ? 'interactive' : (material ?? 'world')),
          );
          fallback.position.set(position.x, position.y, position.z);
          this.root.add(fallback);
          if (!model?.startsWith('city_') || !this.loadModels) return;
          try {
            const scene = await cloneCityModel(model);
            if (!scene || this.disposed) return;
            scene.position.set(position.x, position.y - size.y / 2, position.z);
            this.root.remove(fallback);
            this.root.add(scene);
          } catch {
            // Bryła zastępcza zostaje (ten sam collider).
          }
        },
      ),
    );
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

  private focusedStation(): HubStationId | null {
    const state = this.player.getState();
    const t = this.ctx.tuning.hub;
    return selectHubFocus(
      this.layout.stations,
      this.eyePosition(),
      state.yaw,
      state.pitch,
      this.layout.playerSpawn.y + t.focusHeightM,
      t.interactAngleDeg,
    );
  }

  private go(params: URLSearchParams | Record<string, string>): void {
    const query = new URLSearchParams(params);
    if (this.params.get('debug') === '1') query.set('debug', '1');
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
    this.player.step(dt, this.withPendingLook(input));
    this.world.gravity.y = this.ctx.tuning.physics.gravity;
    this.world.timestep = dt;
    this.world.step();
    const focused = this.focusedStation();
    if (!discardInteract && focused && input.pressed.has(HUB_INTERACT_ACTION))
      this.stations.open(focused);
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
    const focused = this.focusedStation();
    this.prompt?.update(
      this.layout.stations.find(({ id }) => id === focused)?.label ?? null,
      this.stations.opened !== null,
    );
    this.lights.sync();
    this.atmosphere?.sync(frameDt);
    const camera = this.ctx.camera;
    if (!camera) {
      this.dressing?.render(frameDt, undefined);
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
    switch (name) {
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
      `hub look <${stationList}> — spójrz na stację`,
      (args) => {
        const station = this.layout.stations.find(({ id }) => id === args[0]);
        if (args.length !== 1 || !station)
          return `Użycie: hub look <${stationList}>`;
        const eye = this.eyePosition();
        const dx = station.position.x - eye.x;
        const dz = station.position.z - eye.z;
        const dy =
          this.layout.playerSpawn.y + this.ctx.tuning.hub.focusHeightM - eye.y;
        this.pendingLook = {
          yaw: Math.atan2(-dx, -dz),
          pitch: Math.atan2(dy, Math.hypot(dx, dz)),
        };
        return `Patrzysz na: ${station.id}`;
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
      this.metaBar?.dispose();
      this.fppView?.dispose();
      this.fpsCamera?.dispose();
      this.player?.dispose();
      if (this.entities && this.playerId !== undefined)
        this.entities.destroy(this.playerId);
      this.world?.free();
    } finally {
      this.decor?.dispose();
      this.dressing?.dispose();
      this.root.removeFromParent();
      this.root.clear();
      this.atmosphere?.dispose();
      for (const geometry of this.geometries) geometry.dispose();
      this.geometries.clear();
    }
  }
}
