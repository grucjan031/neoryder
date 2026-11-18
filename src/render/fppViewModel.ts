import { Group, Matrix4, Vector3 } from 'three';
import type { HeldItemView, HeldKind } from '../combat/heldItem';
import { plasmaBladeDefinition } from '../combat/melee/bladeSchema';
import type { BladeDefinition } from '../combat/melee/bladeSchema';
import type { BladeView } from '../combat/melee/plasmaBlade';
import type { EntityId, EventBus } from '../core/events';
import { tuning } from '../core/tuning';
import type { Tuning } from '../core/tuning';
import { FppBlade } from './fppBlade';
import { FppBlaster } from './fppBlaster';
import type { FppBlasterOptions } from './fppBlaster';
import { FppMotion, shownHeld } from './fppMotion';
import { FppOffhand } from './fppOffhand';
import { applyViewmodelLayer, registerViewmodel } from './viewmodelLayer';

export interface FppViewModelOptions {
  bladeDefinition?: BladeDefinition;
  modelOf?: FppBlasterOptions['modelOf'];
  modulesOf?: (weaponId: string) => readonly string[];
  tuning?: Pick<Tuning, 'hands' | 'weapons' | 'player'>;
}

export type FppViewModelFrame = {
  horizontalSpeed: number;
  visible?: boolean;
  /** Celowanie 0–1: broń przesuwa się do środka kadru („przy oku”). */
  aim?: number;
} & (
  | { held: 'gun'; blade?: BladeView }
  | { held: 'blade' | HeldItemView; blade: BladeView }
);

/** Wspólny skład renderu rąk i przedmiotu, krokowany raz na klatkę. */
export class FppViewModel {
  readonly root = new Group();
  private readonly blade: FppBlade;
  private readonly blaster: FppBlaster;
  private readonly offhand: FppOffhand;
  private readonly motion: FppMotion;
  private readonly origin = new Vector3();
  private definition: BladeDefinition;
  private loadModels = true;
  private readonly unregister: () => void;

  constructor(
    bus: EventBus,
    owner: EntityId,
    options: FppViewModelOptions = {},
  ) {
    this.blade = new FppBlade(options.bladeDefinition);
    this.definition = options.bladeDefinition ?? plasmaBladeDefinition;
    const t = options.tuning ?? tuning;
    this.blaster = new FppBlaster(bus, owner, {
      modelOf: options.modelOf,
      modulesOf: options.modulesOf,
      tuning: t,
    });
    this.motion = new FppMotion(t);
    this.offhand = new FppOffhand(bus, owner, t);
    this.root.add(this.blade.root, this.blaster.root, this.offhand.root);
    this.unregister = registerViewmodel(this.root);
  }

  async load(loadModels = true): Promise<void> {
    this.loadModels = loadModels;
    await this.blade.load(loadModels, this.definition);
    await this.blaster.load(loadModels);
    await this.offhand.load(loadModels);
  }

  setBladeDefinition(def: BladeDefinition): Promise<void> {
    this.definition = def;
    return this.blade.setDefinition(def, this.loadModels);
  }

  place(
    cameraMatrix: Matrix4,
    frameDt: number,
    frame: FppViewModelFrame,
  ): void {
    const held = typeof frame.held === 'string' ? undefined : frame.held;
    const handMatrix = this.motion.place(
      cameraMatrix,
      frameDt,
      frame.horizontalSpeed,
      held,
    );
    const shown: HeldKind =
      typeof frame.held === 'string' ? frame.held : shownHeld(frame.held);
    const visible = frame.visible ?? true;
    if (frame.blade)
      this.blade.place(
        handMatrix,
        frame.blade,
        frameDt,
        visible && shown === 'blade',
      );
    this.blade.root.visible &&= visible && shown === 'blade';
    this.blaster.root.visible = visible && shown === 'gun';
    this.blaster.place(handMatrix, frameDt, frame.aim ?? 0);
    this.offhand.place(
      handMatrix,
      frameDt,
      shown,
      this.definition.offhand,
      this.blaster.supportMatrix(),
      this.blaster.supportPose,
    );
    this.offhand.root.visible &&= visible;
    applyViewmodelLayer(this.root);
  }

  get beamOrigin(): Vector3 {
    return this.blaster.root.getWorldPosition(this.origin);
  }

  dispose(): void {
    this.blade.dispose();
    this.blaster.dispose();
    this.offhand.dispose();
    this.unregister();
    this.root.removeFromParent();
  }
}
