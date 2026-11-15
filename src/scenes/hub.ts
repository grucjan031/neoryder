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
import { loadSettings } from '../core/save';
import type { BladeView } from '../combat/melee/plasmaBlade';
import hideoutData from '../data/hub/hideout.json';
import { CollisionGroup, initPhysics, interactionGroups } from '../physics';
import { FpsCamera } from '../player/fpsCamera';
import { PlayerController } from '../player/playerController';
import type { PlayerState } from '../player/playerController';
import { CityDressing } from '../render/city/dressing';
import { cloneCityModel, loadDecor } from '../render/cityModels';
import { FppViewModel } from '../render/fppViewModel';
import { createStyleLights } from '../render/lights';
import { getMaterial } from '../render/materials';
import { SceneAtmosphere } from '../render/sceneAtmosphere';
import { HtmlHubScreens } from '../ui/hubScreens';
import type { HubScreens } from '../ui/hubScreens';
import { loadHubLayout } from '../world/hubSchema';
import type { HubLayout } from '../world/hubSchema';
import { HubStations } from '../world/hubStations';
import { HubDecor } from './hubDecor';
import type { Scene } from './index';

export interface HubSceneOptions {
  layout?: HubLayout;
  screens?: HubScreens;
  params?: URLSearchParams;
  navigate?: (url: string) => void;
  loadModels?: boolean;
}

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

function randomSeed(): string {
  return Array.from(crypto.getRandomValues(new Uint32Array(4)), (value) =>
    value.toString(16),
  ).join('-');
}

/** Kryjówka ruchu oporu (F4-07): peron nieczynnej stacji metra, FPP bez wrogów, stacje jako strefy z nakładkami UI. */
export class HubScene implements Scene {
  readonly id = 'hub';
  private readonly layout: HubLayout;
  private readonly params: URLSearchParams;
  private readonly navigate: (url: string) => void;
  private readonly loadModels: boolean;
  private readonly screensOption: HubScreens | undefined;
  private screens!: HubScreens;
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
  }

  async init(ctx: GameContext, three: ThreeScene): Promise<void> {
    this.ctx = ctx;
    this.screens = this.screensOption ?? new HtmlHubScreens();
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
      ctx.tuning.hub.exitMarginM,
    );
    this.off.push(
      ctx.bus.on('hub_station_opened', ({ station }) =>
        this.showStation(station),
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
    this.screens.show(station, {
      close: () => this.closeStation(),
      ...(station === 'missions'
        ? {
            // Tymczasowo preset `classic`; zadanie 10 podmieni to na ekwipunek z meta.
            startRun: () =>
              this.go({ scene: 'run', loadout: 'classic', seed: randomSeed() }),
          }
        : {}),
      ...(station === 'arena'
        ? { openArena: () => this.go({ scene: 'arena' }) }
        : {}),
    });
  }

  private closeStation(): void {
    if (!this.stations.close()) return;
    this.screens.hide();
    this.ctx.resume?.();
  }

  private go(params: Record<string, string>): void {
    const query = new URLSearchParams(params);
    if (this.params.get('debug') === '1') query.set('debug', '1');
    this.navigate(`?${query}`);
  }

  // ----------------------------------------------------------------- pętla

  step(dt: number, input: InputSnapshot): void {
    this.dressing?.step(dt);
    this.previous = this.player.getState();
    // Nakładka otwarta: ruch gracza zatrzymany (jak ekran sklepu w RunScene).
    if (this.stations.opened || !(dt > 0)) return;
    this.player.step(dt, this.withPendingLook(input));
    this.world.gravity.y = this.ctx.tuning.physics.gravity;
    this.world.timestep = dt;
    this.world.step();
    const { position } = this.player.getState();
    this.stations.update(position.x, position.z);
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
      case 'hubStation':
        return this.stations.opened;
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
