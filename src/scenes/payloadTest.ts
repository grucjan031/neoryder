import type { Euler, Vector3, Scene as ThreeScene } from 'three';
import type { GameContext } from '../core/context';
import type { InputSnapshot } from '../core/input';
import { roomDefinitions } from '../world/rooms';
import type { RoomDefinition } from '../world/roomSchema';
import { RailPayload } from '../world/railPayload';
import type { PayloadStatus } from '../world/railPayload';
import { payloadTest } from '../world/prototypes';
import type { PayloadTestDefinition } from '../world/prototypes';
import { loadWaves } from '../world/waves';
import type { WaveDirector } from '../world/waves';
import { PrototypeHud } from '../ui/prototypeHud';
import text from '../data/ui/prototypes.pl.json';
import {
  PrototypeScene,
  lerpPose,
  protoBaseWaves,
  protoParams,
} from './prototypeScene';
import type { PrototypeTarget } from './prototypeScene';
import { PayloadView, ZoneMarker } from './prototypeViews';
import type { ViewPose } from './prototypeViews';

export function createPayloadTest(loadModels = true): PayloadTest {
  const roomId = protoParams().get('room') ?? payloadTest.roomId;
  const room = roomDefinitions.get(roomId);
  if (!room) throw new Error(`Nieznany pokój: ${roomId}`);
  return new PayloadTest(room, payloadTest, loadModels);
}

/**
 * `?scene=payload-test` (S4-03): wagon na trasie wzdłuż torów. Jedzie, gdy gracz jest przy nim
 * i nikt wrogi nie stoi w pobliżu; na postojach rusza fala wzmocnień i skład czeka na jej koniec.
 */
export class PayloadTest extends PrototypeScene {
  override readonly id = 'payload-test';
  private payload!: RailPayload;
  private target!: PrototypeTarget;
  private view!: PayloadView;
  private readonly markers: ZoneMarker[] = [];
  private readonly directors: WaveDirector[] = [];
  private hudView?: PrototypeHud;
  private previousPose!: ViewPose;
  private currentPose!: ViewPose;

  constructor(
    room: RoomDefinition,
    private readonly def: PayloadTestDefinition,
    loadModels: boolean,
  ) {
    super(room, protoBaseWaves(room), loadModels);
  }

  override async init(ctx: GameContext, three: ThreeScene): Promise<void> {
    await super.init(ctx, three);
    if (this.disposed) return;
    const t = ctx.tuning.prototypes.payload;
    this.payload = new RailPayload(this.def.route, this.def.stops, t, {
      reinforce: (wave, stopId) => this.reinforce(wave, stopId),
    });
    this.target = this.createTarget(
      'payloadWagon',
      () => ctx.tuning.prototypes.payload.maxHealth,
      (rapier) =>
        rapier.ColliderDesc.cuboid(
          t.bodyHalfLengthM,
          t.bodyHalfHeightM,
          t.bodyHalfWidthM,
        ),
    );
    this.view = new PayloadView(t);
    this.root.add(this.view.root);
    // Słupy bursztynowe na postojach, biały pierścień na końcu trasy.
    for (const stop of this.def.stops) {
      const marker = new ZoneMarker(1, t.stopPostHeightM, 'neon_amber');
      marker.place(this.payload.poseAt(stop.atM).position);
      this.markers.push(marker);
    }
    const end = new ZoneMarker(2, t.markerHeightM, 'neon_white');
    end.place(this.payload.poseAt(this.payload.lengthM).position);
    this.markers.push(end);
    for (const marker of this.markers) this.root.add(marker.root);
    if (this.withModels) void this.view.load();
    if (typeof document !== 'undefined') this.hudView = new PrototypeHud();
    this.currentPose = this.previousPose = this.pose();
    this.syncTarget();
    this.registerPayloadCommands();
    this.protoReady = true;
    this.refreshHud();
  }

  override step(dt: number, input: InputSnapshot): void {
    super.step(dt, input);
    if (!this.protoReady || !(dt > 0)) return;
    this.payload.setHp(this.target.health.current);
    for (const director of this.directors) director.step(dt);
    let pending = 0;
    for (const d of this.directors)
      pending += d.queued + (d.currentPhase === 'break' ? 1 : 0);
    this.payload.step(dt, {
      player: this.playerFeet(),
      hostiles: this.hostilePositions(),
      pending,
    });
    this.previousPose = this.currentPose;
    this.currentPose = this.pose();
    this.syncTarget();
    this.refreshHud();
  }

  override render(
    alpha: number,
    frameDt = 1 / 60,
    cameraOverride?: { position: Vector3; rotation: Euler },
  ): void {
    super.render(alpha, frameDt, cameraOverride);
    if (!this.protoReady) return;
    this.view.update(
      lerpPose(this.previousPose, this.currentPose, alpha),
      this.payload.status === 'waitingPlayer',
    );
  }

  override query(name: string): unknown {
    if (name === 'payload')
      return {
        ...this.payload.snapshot(),
        waves: this.directors.map((d) => ({
          wave: d.wave,
          phase: d.currentPhase,
          alive: d.aliveCount,
          queued: d.queued,
        })),
      };
    return super.query(name);
  }

  override dispose(): void {
    this.hudView?.dispose();
    this.view?.dispose();
    for (const marker of this.markers) marker.dispose();
    for (const director of this.directors) director.dispose();
    if (this.target) this.removeTarget(this.target);
    super.dispose();
  }

  private pose(): ViewPose {
    const s = this.payload.snapshot();
    return { position: s.position, yaw: s.yaw };
  }

  /** Hak postoju: fala z danych startuje z własnymi punktami spawnu. */
  private reinforce(wave: string, stopId: string): void {
    const definition = loadWaves(this.def.waves[wave]);
    const director = this.createWaveDirector(definition, stopId);
    this.directors.push(director);
    director.start();
  }

  private syncTarget(): void {
    const t = this.ctx.tuning.prototypes.payload;
    const s = this.payload.snapshot();
    this.placeTarget(
      this.target,
      {
        x: s.position.x,
        y: s.position.y + t.bodyHalfHeightM,
        z: s.position.z,
      },
      s.yaw - Math.PI / 2,
    );
    this.target.collider.setEnabled(!this.payload.finished);
  }

  private refreshHud(): void {
    if (!this.hudView) return;
    const s = this.payload.snapshot();
    const t = text.payload;
    const status: PayloadStatus = s.status;
    const stop = s.stopName
      ? status === 'holding'
        ? `${t.holding}: ${s.stopName} · ${t.departure} ${Math.ceil(s.holdRemainingS)} s`
        : `${t.next}: ${s.stopName}`
      : '';
    this.hudView.update({
      title: t.title,
      status: t[status],
      hp: { label: t.hp, current: s.hp, max: s.maxHp },
      bar: { label: t.progress, value: s.progress },
      detail: stop,
      outcome:
        status === 'arrived'
          ? 'success'
          : status === 'destroyed'
            ? 'failure'
            : null,
    });
  }

  private registerPayloadCommands(): void {
    this.command('payload status', 'payload status — stan wagonu', () =>
      JSON.stringify(this.payload.snapshot()),
    );
    this.command(
      'payload skip',
      'payload skip — skocz do następnego postoju',
      () => {
        if (!this.payload.skip()) return 'Wagon zakończył trasę.';
        this.syncTarget();
        return `Wagon: ${this.payload.distanceM.toFixed(0)} m`;
      },
    );
    this.command(
      'payload hp',
      'payload hp <n> — wytrzymałość wagonu',
      (args) => {
        const hp = Number(args[0]);
        if (args.length !== 1 || !Number.isFinite(hp) || hp < 0)
          return 'Użycie: payload hp <n>';
        this.target.health.set(hp);
        return `Wytrzymałość wagonu: ${this.target.health.current}`;
      },
    );
  }
}
