import type { RigidBody } from '@dimforge/rapier3d-compat';
import type { EntityId } from '../../core/events';
import type { Vec3 } from '../../core/math';

export interface GrabTarget {
  readonly id: EntityId;
  readonly body: RigidBody;
  readonly enemy: boolean;
  readonly grabbable: boolean;
  readonly massKg: number;
  readonly controlled?: boolean;
  setControlled?(controlled: boolean): void;
}

export interface GrabContact {
  readonly impact: boolean;
  readonly enemy: EntityId | null;
  readonly point: Vec3;
  readonly normalY: number;
  readonly normal: Vec3;
}
