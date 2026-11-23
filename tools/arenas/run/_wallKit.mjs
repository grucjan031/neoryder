// Gęsta oprawa ścian i elewacji dla aren runu (partia B): powtarzalny wzór dekoracji na odcinku ściany.
// Plik z prefiksem `_` nie jest generatorem.

/**
 * Układa dekoracje wzdłuż ściany `rect` (strona `side`) od `from` do `to` co `step` m.
 * `kit`: lista wpisów { model, y, offset?, every?, scale? } wybieranych cyklicznie z przesunięciem
 * `salt`, żeby sąsiednie ściany nie wyglądały tak samo. `neons`: lista [tekstura, y, w, h, kolor,
 * flicker] rozmieszczana co `neonEvery` slotów.
 */
export function dressWall(
  k,
  rect,
  side,
  from,
  to,
  { step = 6, kit = [], neons = [], neonEvery = 3, salt = 0, maxY = Infinity } = {},
) {
  let slot = 0;
  for (let along = from + step / 2; along < to; along += step, slot++) {
    const entry = kit[(slot * 5 + salt) % kit.length];
    if (entry && (entry.y ?? 0) + (entry.h ?? 1.4) <= maxY)
      k.face(
        rect,
        side,
        along,
        entry.y ?? 0,
        entry.model,
        entry.offset ?? 0.3,
        entry.scale,
      );
    if (neons.length && (slot + salt) % neonEvery === 0) {
      const [texture, y, w, h, tint, flicker = 0.25] =
        neons[Math.floor((slot + salt) / neonEvery) % neons.length];
      if (y + h / 2 <= maxY)
      k.faceNeon(rect, side, along, y, texture, w, h, tint, flicker);
    }
  }
}

/** Zestawy dekoracji ściennych (modele z katalogu city). */
export const KITS = {
  street: [
    { model: 'city_pipe_run', y: 0, offset: 0.3 },
    { model: 'city_ac_unit', y: 3.2, offset: 0.35 },
    { model: 'city_shutter', y: 0, offset: 0.2 },
    { model: 'city_ad_screen', y: 1.6, offset: 0.2 },
    { model: 'city_sign_box', y: 4.2, offset: 0.15 },
    { model: 'city_door', y: 0, offset: 0.15 },
    { model: 'city_ac_unit', y: 6.2, offset: 0.35 },
    { model: 'city_awning', y: 3.1, offset: 0.6 },
  ],
  industrial: [
    { model: 'city_pipe_run', y: 0, offset: 0.3 },
    { model: 'city_ad_screen', y: 1.8, offset: 0.2 },
    { model: 'city_sign_box', y: 3.4, offset: 0.15 },
    { model: 'city_ac_unit', y: 4.4, offset: 0.35 },
    { model: 'city_shutter', y: 0, offset: 0.2 },
    { model: 'city_pipe_run', y: 4.6, offset: 0.3 },
    { model: 'city_door', y: 0, offset: 0.15 },
  ],
};
