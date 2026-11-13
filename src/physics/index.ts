import * as RAPIER from '@dimforge/rapier3d-compat';

let initialization: Promise<typeof RAPIER> | undefined;
export async function initPhysics(): Promise<
  typeof import('@dimforge/rapier3d-compat')
> {
  initialization ??= RAPIER.init().then(() => RAPIER);
  return initialization;
}

export const CollisionGroup = {
  World: 1,
  Player: 2,
  Enemy: 4,
  PlayerProjectile: 8,
  EnemyProjectile: 16,
  Debris: 32,
} as const;
export function interactionGroups(member: number, filter: number): number {
  return (member << 16) | filter;
}
