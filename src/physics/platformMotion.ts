import type { Vec3 } from '../core/math';

// Margines precyzji zapytań Rapiera na szwie podłogi kabiny i podestu.
export const platformSkinM = 0.001;

export interface MovingPlatform {
  floorHandle: number;
  def: { x: number; z: number; width: number; depth: number };
  previousY: number;
  state: { y: number };
}

/** Sprawdzenie styku w układzie kabiny przed krokiem świata. Przy kontakcie
 * KCC pomija wyłącznie podłogę nośną. Jej poprzednia prędkość kinematyczna
 * nie może być dodana przez Rapiera po raz drugi. */
export function supportingPlatform(
  floors: readonly MovingPlatform[] | undefined,
  position: Vec3,
  height: number,
  offset: number,
  vy: number,
) {
  if (!floors || vy > 0) return undefined;
  const feet = position.y - height / 2;
  return floors.find(
    ({ def, previousY }) =>
      Math.abs(position.x - def.x) <= def.width / 2 &&
      Math.abs(position.z - def.z) <= def.depth / 2 &&
      feet >= previousY - offset &&
      feet <= previousY + offset + 2 * platformSkinM,
  );
}
