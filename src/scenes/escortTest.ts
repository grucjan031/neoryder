import type { Euler, Vector3, Scene as ThreeScene } from 'three';
import type { GameContext } from '../core/context';
import type { InputSnapshot } from '../core/input';
import { roomDefinitions } from '../world/rooms';
import type { RoomDefinition } from '../world/roomSchema';
import { EscortNpc } from '../world/escortNpc';
import { escortTest } from '../world/prototypes';
import type { EscortTestDefinition } from '../world/prototypes';
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
import { EscortNpcView, ZoneMarker } from './prototypeViews';
import type { ViewPose } from './prototypeViews';

export function createEscortTest(loadModels = true): EscortTest {
  const roomId = protoParams().get('room') ?? escortTest.roomId;
  const room = roomDefinitions.get(roomId);
  if (!room) throw new Error(`Nieznany pokój: ${roomId}`);
  return new EscortTest(room, escortTest, loadModels);
}

/**
 * `?scene=escort-test` (S4-03): więzień klęczy w arenie z nawigacją; gracz stoi przy nim,
 * uwalnia go i prowadzi do strefy ewakuacji, a po uwolnieniu rusza fala pościgu.
 */
export class EscortTest extends PrototypeScene {
  override readonly id = 'escort-test';
  private npc!: EscortNpc;
  private target!: PrototypeTarget;
  private view!: EscortNpcView;
  private freeMarker!: ZoneMarker;
  private evacMarker!: ZoneMarker;
  private hudView?: PrototypeHud;
  private pursuit: WaveDirector | null = null;
  private previousPose!: ViewPose;
  private currentPose!: ViewPose;

  constructor(
    room: RoomDefinition,
    private readonly def: EscortTestDefinition,
    loadModels: boolean,
  ) {
    super(room, protoBaseWaves(room), loadModels);
  }

  override async init(ctx: GameContext, three: ThreeScene): Promise<void> {
    await super.init(ctx, three);
    if (this.disposed) return;
    const t = ctx.tuning.prototypes.escort;
    const nav = this.navigation!;
    this.npc = new EscortNpc(this.def.prisoner, this.def.evacuation, nav, t);
    this.target = this.createTarget(
      'escortNpc',
      () => ctx.tuning.prototypes.escort.maxHealth,
      (rapier) =>
        rapier.ColliderDesc.capsule(
          (t.colliderHeightM - 2 * t.colliderRadiusM) / 2,
          t.colliderRadiusM,
        ),
    );
    this.view = new EscortNpcView(
      ctx.tuning,
      t.colliderHeightM,
      t.colliderRadiusM,
    );
    this.freeMarker = new ZoneMarker(
      t.freeRadiusM,
      t.markerHeightM,
      'neon_amber',
    );
    this.evacMarker = new ZoneMarker(
      t.evacRadiusM,
      t.markerHeightM,
      'neon_white',
    );
    this.freeMarker.place(this.def.prisoner);
    this.evacMarker.place(this.def.evacuation);
    this.root.add(this.view.root, this.freeMarker.root, this.evacMarker.root);
    if (this.withModels) void this.view.load();
    if (typeof document !== 'undefined') this.hudView = new PrototypeHud();
    this.currentPose = this.previousPose = this.pose();
    this.syncTarget();
    this.registerEscortCommands();
    this.protoReady = true;
    this.refreshHud();
  }

  override step(dt: number, input: InputSnapshot): void {
    super.step(dt, input);
    if (!this.protoReady || !(dt > 0)) return;
    this.npc.setHp(this.target.health.current);
    const feet = this.playerFeet();
    this.npc.step(dt, feet, this.navGoal(feet));
    if (this.npc.state !== 'waiting' && !this.pursuit) this.startPursuit();
    this.pursuit?.step(dt);
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
    const snapshot = this.npc.snapshot();
    this.view.update(
      lerpPose(this.previousPose, this.currentPose, alpha),
      snapshot.state,
      snapshot.motion,
      frameDt,
    );
    this.freeMarker.root.visible = snapshot.state === 'waiting';
    this.evacMarker.root.visible = !this.npc.finished;
  }

  override query(name: string): unknown {
    if (name === 'escort')
      return {
        ...this.npc.snapshot(),
        evacuation: { ...this.def.evacuation },
        pursuit: this.pursuit?.wave ?? 0,
      };
    if (name === 'escortPath')
      return this.navigation!.path(this.npc.position, this.def.evacuation);
    return super.query(name);
  }

  override dispose(): void {
    this.hudView?.dispose();
    this.view?.dispose();
    this.freeMarker?.dispose();
    this.evacMarker?.dispose();
    this.pursuit?.dispose();
    if (this.target) this.removeTarget(this.target);
    super.dispose();
  }

  private pose(): ViewPose {
    const s = this.npc.snapshot();
    return { position: s.position, yaw: s.yaw };
  }

  private startPursuit(): void {
    const definition = loadWaves(this.def.waves[this.def.pursuitWave]);
    this.pursuit = this.createWaveDirector(definition, this.def.pursuitWave);
    this.pursuit.start();
  }

  /** Hurtbox idzie za więźniem; po końcu (ewakuacja, śmierć) nie blokuje już pocisków. */
  private syncTarget(): void {
    const t = this.ctx.tuning.prototypes.escort;
    const p = this.npc.position;
    this.placeTarget(this.target, {
      x: p.x,
      y: p.y + t.colliderHeightM / 2,
      z: p.z,
    });
    this.target.collider.setEnabled(!this.npc.finished);
  }

  private refreshHud(): void {
    if (!this.hudView) return;
    const s = this.npc.snapshot();
    const t = text.escort;
    this.hudView.update({
      title: t.title,
      status: t[s.state],
      hp: {
        label: t.hp,
        current: s.hp,
        max: s.maxHp,
      },
      bar:
        s.state === 'waiting' ? { label: t.free, value: s.freeProgress } : null,
      detail: `${t.stuck}: ${s.stuckEvents}`,
      outcome:
        s.state === 'evacuated'
          ? 'success'
          : s.state === 'dead'
            ? 'failure'
            : null,
    });
  }

  private registerEscortCommands(): void {
    this.command('escort free', 'escort free — uwolnij więźnia', () =>
      this.npc.free() ? 'Więzień uwolniony.' : 'Więzień nie czeka.',
    );
    this.command(
      'escort tp',
      'escort tp <x> <z> — przenieś więźnia',
      (args) => {
        const [x, z] = args.map(Number);
        if (args.length !== 2 || !Number.isFinite(x) || !Number.isFinite(z))
          return 'Użycie: escort tp <x> <z>';
        this.npc.teleport(x!, z!, this.playerFeet().y);
        this.syncTarget();
        return `Więzień: ${x}, ${z}`;
      },
    );
    this.command('escort status', 'escort status — stan więźnia', () =>
      JSON.stringify(this.npc.snapshot()),
    );
    this.command('escort hp', 'escort hp <n> — zdrowie więźnia', (args) => {
      const hp = Number(args[0]);
      if (args.length !== 1 || !Number.isFinite(hp) || hp < 0)
        return 'Użycie: escort hp <n>';
      this.target.health.set(hp);
      return `Zdrowie więźnia: ${this.target.health.current}`;
    });
  }
}
