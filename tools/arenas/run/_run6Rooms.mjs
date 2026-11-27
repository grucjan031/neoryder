// Wyposażenie tematyczne wszystkich 15 pomieszczeń (R1..R15) i Antresoli Salonu (R2-M)
// Rezydencji Pułkownika Kurogane Arms — Willa Kuroyama (run6):
// Parter L0 (y = 0.0 m): R1 (Hol Wejściowy), R2 (Wielki Dwukondygnacyjny Salon), R3 (Jadalnia),
//   R4 (Kuchnia), R5 (Kryty Basen i Ogród Zimowy), R6 (Garaż Pancerny), R7 (Pokój Ochrony Parteru).
// Piętro L1 (y = +4.8 m): R2-M (Antresola Salonu), R8 (Biuro Pułkownika z Tablicą „Iskra”),
//   R9 (Biblioteka), R10 (Sala Trofeów), R11 (Sypialnia i Garderoba), R12 (Prywatne Spa i Sauna).
// Piwnica B (y = -4.8 m): R13 (Sala Tortur i Przesłuchań), R14 (Winiarnia), R15 (Podziemny Bunkier Ochrony).
import {
  MAT_BUNKER,
  MAT_CARPET,
  MAT_CONCRETE,
  MAT_GLASS,
  MAT_MARBLE,
  MAT_WALNUT,
  PI,
  Q,
  R,
  Y_B,
  Y_B_CEIL,
  Y_L0,
  Y_L0_CEIL,
  Y_L1,
  Y_L1_CEIL,
  Y_SALON_CEIL,
  biometricArch,
  box,
  ceilingCovePanel,
  chandelierLinear,
  deco,
  holdingCageBars,
  recessedLedStrip,
  solid,
  waistDivider,
} from './_run6Kit.mjs';

/** R1 — Hol Wejściowy i Foyer z Szatnią (L0, X ∈ [-10, 10], Z ∈ [4, 16], y = 0.0 m). */
function buildRoomR1(k, p) {
  // 4 narożne filary konstrukcyjne szybu windy (X = ±1.48, Z = 15.0 ± 1.48, poza szybem [-1.3, 1.3] × [13.7, 16.3]).
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * 1.48;
      const z = 15.0 + sz * 1.48;
      p.reserve(R(x - 0.18, x + 0.18, z - 0.18, z + 0.18), Y_B);
      p.reserve(R(x - 0.18, x + 0.18, z - 0.18, z + 0.18), Y_L0);
      box(k, x, (Y_B + Y_L0_CEIL) / 2, z, 0.3, Y_L0_CEIL - Y_B, 0.3, 'metal', {
        walkable: false,
      });
    }
  }
  // Boczne ściany szybu windy (X = ±1.48, Z ∈ [13.67, 16.33]) oraz nadproże na Parterze (Z = 13.55).
  for (const sx of [-1, 1]) {
    p.reserve(R(sx * 1.48 - 0.16, sx * 1.48 + 0.16, 13.67, 16.33), Y_B);
    p.reserve(R(sx * 1.48 - 0.16, sx * 1.48 + 0.16, 13.67, 16.33), Y_L0);
    box(
      k,
      sx * 1.48,
      (Y_B + Y_L0_CEIL) / 2,
      15.0,
      0.28,
      Y_L0_CEIL - Y_B,
      2.66,
      MAT_CONCRETE,
      { walkable: false },
    );
  }
  box(k, 0, Y_L0 + 4.0, 13.55, 3.24, 1.6, 0.28, MAT_CONCRETE, {
    walkable: false,
  });
  // Portal szybu windy Stop 1 (L0, doorSide: "n", Z = 13.7) i panel wezwania (-1.65, 0.0, 13.58).
  deco(k, 'res_elevator_shaft_door', 0, Y_L0, 13.7, PI);
  deco(k, 'res_elevator_call_panel', -1.65, Y_L0, 13.58, PI);

  // Kordon dwóch bramek biometrycznych `res_biometric_arch` (Z = 8.2):
  // Zachodnia na osi startu gracza (-4, 0, 12) -> portal Salonu, wschodnia na X = +4.0.
  biometricArch(k, p, -4.0, Y_L0, 8.2, 0);
  biometricArch(k, p, 4.0, Y_L0, 8.2, 0);

  // Centralny postument z podświetlonym drzewem Bonsai `res_bonsai_pedestal` (X = 0, Z = 6.2).
  p.prop('res_bonsai_pedestal', 0, 6.2, Y_L0, 0);

  // Zachodnia strefa szatni i oczekiwania (poza wejściem R6 Z ∈ [8, 12] i Klatką #1 X ∈ [-8.4, -5.2], Z = 16).
  p.prop('res_wardrobe_glass', -7.6, 4.7, Y_L0, 0);
  p.prop('off_lounge_sofa', -7.8, 6.5, Y_L0, 0);
  p.prop('res_winter_garden_planter', -9.1, 13.6, Y_L0, 1);

  // Wschodnia strefa konsoli wejściowej i foyer (poza wejściem R7 Z ∈ [8, 12] i Klatką #2 X ∈ [5.2, 8.4], Z = 16).
  p.prop('res_wardrobe_glass', 7.6, 4.7, Y_L0, 0);
  p.prop('off_executive_desk', 7.6, 6.7, Y_L0, 0);
  p.prop('off_office_chair', 7.6, 5.6, Y_L0, 0);
  p.prop('off_lounge_sofa', 3.6, 11.6, Y_L0, -1);
  p.prop('res_coffee_table_marble', 2.1, 11.6, Y_L0, 1);
  p.prop('res_winter_garden_planter', 9.1, 13.6, Y_L0, -1);
  p.prop('mall_directory', 2.6, 14.8, Y_L0, 2);

  // Detale ścienne i oświetlenie sufitu Holu R1 (mat_light_panel, zero stożków).
  for (const sx of [-1, 1]) {
    const xWall = sx * 9.78;
    const yaw = sx > 0 ? -Q : Q;
    deco(k, 'off_acoustic_wall_panel', xWall, Y_L0 + 1.1, 6.0, yaw);
    deco(k, 'wh_wall_terminal', xWall, Y_L0 + 1.2, 13.0, yaw);
    deco(k, 'mall_security_fixture', xWall, Y_L0 + 1.25, 4.8, yaw);
  }
  chandelierLinear(k, 0, Y_L0_CEIL, 9.5, 0);
  for (const x of [-6.0, 0, 6.0]) {
    recessedLedStrip(k, x, Y_L0_CEIL, 5.8, 0);
    recessedLedStrip(k, x, Y_L0_CEIL, 12.2, 0);
  }
  ceilingCovePanel(k, -8.8, Y_L0_CEIL, 10.0, 0.45, 10.0);
  ceilingCovePanel(k, 8.8, Y_L0_CEIL, 10.0, 0.45, 10.0);
}

/** R2 — Wielki Dwukondygnacyjny Salon z Antresolą i Panoramą Lasu (L0 + L1, X ∈ [-16, 16], Z ∈ [-18, 4], H = 9.6 m). */
function buildRoomR2(k, p) {
  // 1. Monumentalny dwukondygnacyjny Kominek Kolumnowy `res_fireplace_column` (2.8 × 9.6 × 1.8 m)
  // w północno-wschodniej części Salonu (X = +4.5, Z = -11.5 — poza spawnami (8,0,-5) i (9,0,-14)).
  p.prop('res_fireplace_column', 4.5, -11.5, Y_L0, 0);
  // Niska kamienna ława opałowa przed kominkiem (wys. 1.08 m — wlicza się też do gęstości osłon <= 4.45 m).
  waistDivider(k, p, 4.5, Y_L0, -9.8, 2.8, 0.42);

  // 2. Centralna strefa wypoczynkowa na dywanie `res_plush_carpet` (X ∈ [-7.4, 3.2], Z ∈ [-9.6, -0.4]):
  // 3 narożne sofy `res_luxury_sofa_l`, 2 marmurowe stoliki `res_coffee_table_marble` i fotele/sofy boczne.
  box(k, -2.0, Y_L0 - 0.021, -5.0, 10.8, 0.04, 9.2, MAT_CARPET, {
    walkable: false,
  });
  p.prop('res_luxury_sofa_l', -5.2, -4.4, Y_L0, 1);
  p.prop('res_luxury_sofa_l', -1.2, -1.6, Y_L0, 2);
  p.prop('res_luxury_sofa_l', -1.2, -8.4, Y_L0, 0);
  p.prop('res_coffee_table_marble', -2.6, -4.8, Y_L0, 0);
  p.prop('res_coffee_table_marble', 1.4, -4.8, Y_L0, 1);

  // Wschodnia sekcja wypoczynkowa naprzeciw kominka (poza spawnem #2 (8, 0, -5)).
  p.prop('off_lounge_sofa', 4.6, -5.0, Y_L0, -1);
  p.prop('off_lounge_sofa', 4.6, -8.2, Y_L0, 0);
  p.prop('res_bonsai_pedestal', 4.6, -1.6, Y_L0, 0);

  // 3. Strefa muzyczna NW przy przeszkleniu na las: Fortepian Holograficzny `res_grand_piano_holo`
  // (X = -6.2, Z = -13.8 — poza spawnem #3 (-10, 0, -15)).
  p.prop('res_grand_piano_holo', -6.2, -13.8, Y_L0, 0);
  p.prop('res_bonsai_pedestal', -1.5, -13.5, Y_L0, 0);
  p.prop('res_winter_garden_planter', -10.2, -11.5, Y_L0, 0);

  // 4. Strefa Barku Whisky i Cygar NE (poza spawnem #4 (9, 0, -14)):
  p.prop('off_kitchenette_counter', 9.2, -9.8, Y_L0, 0);
  waistDivider(k, p, 9.2, Y_L0, -7.8, 2.8, 0.38);
  for (const x of [8.2, 9.2, 10.2])
    p.prop('off_office_chair', x, -7.0, Y_L0, 0);
  p.prop('res_winter_garden_planter', 5.2, -14.2, Y_L0, 0);

  // 5. Zabudowa pod spocznikami i wyższymi biegami Klatek Schodowych #3 i #4 (Z ∈ [-9.8, -5.0], wys. 1.9 m)
  // oraz boczne osłony zbijające puste przestrzenie Salonu poniżej 8 m (z pełną drożnością bram).
  p.reserve(R(-15.3, -11.9, -9.9, -4.9), Y_L0);
  solid(k, R(-15.2, -12.0, -9.8, -5.0), Y_L0, 1.9, MAT_WALNUT, {
    walkable: false,
  });
  p.reserve(R(11.9, 15.3, -9.9, -4.9), Y_L0);
  solid(k, R(12.0, 15.2, -9.8, -5.0), Y_L0, 1.9, MAT_WALNUT, {
    walkable: false,
  });

  p.prop('off_lounge_sofa', -9.2, -8.2, Y_L0, 1);
  waistDivider(k, p, -7.8, Y_L0, 0.8, 2.4, 0.36);
  p.prop('off_lounge_sofa', -7.8, 2.3, Y_L0, 2);
  waistDivider(k, p, 8.2, Y_L0, -1.2, 2.4, 0.36);
  p.prop('off_lounge_sofa', 8.2, 2.3, Y_L0, 2);
  p.prop('off_office_planter', -13.8, -16.8, Y_L0, 0);
  p.prop('off_office_planter', 13.8, -16.8, Y_L0, 0);

  // Obrazy `res_wall_art_triptych` na południowej ścianie Salonu (Z = +3.80, X = -7.5 z EE-11 oraz X = +7.5).
  deco(k, 'res_wall_art_triptych', -7.5, Y_L0 + 1.55, 3.74, PI);
  deco(k, 'res_wall_art_triptych', 7.5, Y_L0 + 1.55, 3.74, PI);

  // 6. Wyposażenie Antresoli Salonu `R2-M` (y = +4.80 m, poza spawnami (-14.4,4.8,-1) i (14.4,4.8,-1)):
  p.prop('off_lounge_sofa', -6.8, -17.1, Y_L1, 0);
  p.prop('off_lounge_sofa', 6.8, -17.1, Y_L1, 0);
  p.prop('off_office_planter', -4.0, -17.2, Y_L1, 0);
  p.prop('off_office_planter', 4.0, -17.2, Y_L1, 0);
  p.prop('mall_bench', -9.6, -17.2, Y_L1, 0);
  p.prop('mall_bench', 9.6, -17.2, Y_L1, 0);

  p.prop('off_lounge_sofa', -13.0, 2.8, Y_L1, 2);
  p.prop('res_coffee_table_marble', -11.2, 1.0, Y_L1, 1);
  p.prop('off_lounge_sofa', 13.0, 2.8, Y_L1, 2);
  p.prop('res_coffee_table_marble', 11.2, 1.0, Y_L1, -1);

  // 7. Oprawy sufitowe pod wysokim stropem Salonu (y = 9.60 m) i pod płytą Antresoli (y = 4.40 m).
  for (const x of [-6.0, 0, 6.0]) {
    for (const z of [-13.0, -7.0, -1.0])
      chandelierLinear(k, x, Y_SALON_CEIL, z, 0);
  }
  for (const x of [-12.0, -4.0, 4.0, 12.0])
    recessedLedStrip(k, x, Y_SALON_CEIL, -16.4, 0);
  for (const z of [-12.0, -6.0, 0.0]) {
    recessedLedStrip(k, -14.4, Y_SALON_CEIL, z, Q);
    recessedLedStrip(k, 14.4, Y_SALON_CEIL, z, Q);
  }
  ceilingCovePanel(k, 0, 4.4, -16.4, 24.0, 0.45);
  ceilingCovePanel(k, -14.4, 4.4, 1.0, 0.45, 5.0);
  ceilingCovePanel(k, 14.4, 4.4, 1.0, 0.45, 5.0);
}

/** R3 — Jadalnia Reprezentacyjna „Stół Koalicji” (L0 W, X ∈ [-30, -16], Z ∈ [-6, 4], y = 0.0 m). */
function buildRoomR3(k, p) {
  // Długi 12-osobowy Stół Jadalniany `res_dining_table_long` (2.0 × 1.05 × 5.2 m)
  // przy zachodnim przeszkleniu na las (X = -26.5, Z = -1.0 — poza spawnem #5 (-23, 0, -1) i osią bram X = -23!).
  box(k, -26.5, Y_L0 - 0.021, -1.0, 4.4, 0.04, 6.8, MAT_CARPET, {
    walkable: false,
  });
  p.prop('res_dining_table_long', -26.5, -1.0, Y_L0, 0);
  for (const z of [-2.8, -1.6, -0.4, 0.8]) {
    p.prop('off_office_chair', -28.0, z, Y_L0, 1);
    p.prop('off_office_chair', -25.0, z, Y_L0, -1);
  }

  // Wschodnia strefa bufetowa i kredens (X ∈ [-20.5, -16.8], poza bramą R3<->R2 na Z ∈ [-1, 3]).
  p.prop('off_kitchenette_counter', -18.6, -4.8, Y_L0, 0);
  waistDivider(k, p, -19.5, Y_L0, -2.2, 2.4, 0.38);
  p.prop('res_winter_garden_planter', -28.4, 2.8, Y_L0, 0);
  p.prop('off_office_planter', -18.8, 3.2, Y_L0, 0);

  // Obraz ścienny i oprawy sufitowe w Jadalni R3.
  deco(k, 'res_wall_art_triptych', -16.22, Y_L0 + 1.5, -3.5, -Q);
  chandelierLinear(k, -26.5, Y_L0_CEIL, -1.0, Q);
  chandelierLinear(k, -20.0, Y_L0_CEIL, -1.0, Q);
  recessedLedStrip(k, -23.0, Y_L0_CEIL, -4.5, 0);
  recessedLedStrip(k, -23.0, Y_L0_CEIL, 2.5, 0);
  ceilingCovePanel(k, -28.8, Y_L0_CEIL, -1.0, 0.45, 8.4);
}

/** R4 — Nowoczesna Kuchnia i Spiżarnia Szefa Kuchni (L0 NW, X ∈ [-30, -16], Z ∈ [-18, -6], y = 0.0 m). */
function buildRoomR4(k, p) {
  // Centralna Wyspa Kuchenna z płytą Teppanyaki `res_kitchen_island` (3.8 × 1.15 × 1.6 m)
  // na X = -23.0, Z = -10.2 (poza spawnem #6 (-23, 0, -14) i bramą R4<->R3 na Z = -6).
  p.prop('res_kitchen_island', -23.0, -10.2, Y_L0, 0);

  // Dwudrzwiowa Inteligentna Lodówka `res_smart_fridge` (1.6 × 2.2 × 0.95 m) przy ścianie północnej
  // (X = -19.2, Z = -16.8, turn = 0 — front na Z = -16.325 niesie notatkę Easter Egg #8!).
  p.prop('res_smart_fridge', -19.2, -16.8, Y_L0, 0);

  // Ciągi zabudowy kuchennej, ekspresy i zielnik hydroponiczny przy oknie NW.
  p.prop('off_kitchenette_counter', -27.8, -11.5, Y_L0, 1);
  p.prop('off_kitchenette_counter', -17.0, -8.8, Y_L0, -1);
  p.prop('off_coffee_machine', -19.2, -7.0, Y_L0, 2);
  p.prop('mall_trash_bin', -20.6, -7.0, Y_L0, 2);
  p.prop('res_winter_garden_planter', -26.8, -16.8, Y_L0, 0);
  box(k, -26.8, Y_L0 + 2.4, -17.1, 2.6, 0.08, 0.16, 'neon_green', {
    walkable: false,
  });
  p.prop('off_office_planter', -28.4, -7.4, Y_L0, 1);

  deco(k, 'wh_wall_terminal', -16.22, Y_L0 + 1.2, -10.8, -Q);
  for (const x of [-26.5, -20.0]) {
    recessedLedStrip(k, x, Y_L0_CEIL, -15.0, 0);
    recessedLedStrip(k, x, Y_L0_CEIL, -9.0, 0);
  }
  ceilingCovePanel(k, -28.8, Y_L0_CEIL, -12.0, 0.45, 10.0);
  ceilingCovePanel(k, -23.0, Y_L0_CEIL, -16.8, 11.0, 0.45);
}

/** R5 — Kryty Basen i Ogród Zimowy „Pawilon Deszczu” (L0 E, X ∈ [16, 30], Z ∈ [-18, 4], y = 0.0 m). */
function buildRoomR5(k, p) {
  // Niecka Krytego Basenu `res_indoor_pool_basin` (6.0 × 0.45 × 14.0 m) wpuszczona w posadzkę R5
  // (X ∈ [20, 26], Z ∈ [-14, 0], wierzch wody na y = 0.00 m z `walkable: true` — gracz i AI mogą biec przez wodę!).
  k.arena.block({
    model: 'res_indoor_pool_basin',
    size: { x: 6, y: 0.45, z: 14 },
    position: { x: 23, y: Y_L0 - 0.225, z: -7 },
    material: MAT_MARBLE,
    instance: true,
    walkable: true,
  });
  k.fx('steam', 23.0, Y_L0 + 0.1, -10.5, 0.8);
  k.fx('steam', 23.0, Y_L0 + 0.1, -3.5, 0.8);

  // Leżanki basenowe `res_pool_lounger` (0.95 × 0.85 × 2.1 m) wzdłuż 22-metrowej wschodniej fasady na las
  // oraz po zachodniej stronie niecki (poza spawnami (23, 0, -12) i (23, 0, 1)).
  for (const z of [-14.2, -10.2, -6.2, -2.2])
    p.prop('res_pool_lounger', 28.2, z, Y_L0, -1);
  p.prop('res_pool_lounger', 18.2, -9.8, Y_L0, 1);
  p.prop('res_pool_lounger', 18.2, -4.2, Y_L0, 1);

  // Donice Ogrodu Zimowego z bambusami `res_winter_garden_planter` (2.6 × 1.65 × 1.0 m) dające twardą osłonę.
  p.prop('res_winter_garden_planter', 23.0, -16.8, Y_L0, 0);
  p.prop('res_winter_garden_planter', 27.6, -16.8, Y_L0, 0);
  p.prop('res_winter_garden_planter', 18.4, -16.8, Y_L0, 0);
  p.prop('res_winter_garden_planter', 28.4, 1.8, Y_L0, -1);
  p.prop('off_office_planter', 18.0, 2.8, Y_L0, 0);

  // Kaskadowa Ściana Wodna Zen przy ścianie zachodniej (X = +16.6, Z = -7.0, między bramami Z = -14 i Z = +1).
  p.reserve(R(16.2, 17.1, -9.2, -4.8), Y_L0);
  box(k, 16.55, Y_L0 + 1.4, -7.0, 0.5, 2.8, 4.2, MAT_MARBLE, {
    walkable: false,
  });
  box(k, 16.82, Y_L0 + 1.4, -7.0, 0.06, 2.4, 3.6, 'canal_water', {
    walkable: false,
  });
  box(k, 16.84, Y_L0 + 2.65, -7.0, 0.08, 0.08, 3.8, 'neon_blue', {
    walkable: false,
  });

  for (const z of [-15.0, -9.5, -4.5, 1.5]) {
    recessedLedStrip(k, 19.5, Y_L0_CEIL, z, 0);
    recessedLedStrip(k, 26.5, Y_L0_CEIL, z, 0);
  }
  ceilingCovePanel(k, 28.8, Y_L0_CEIL, -7.0, 0.45, 19.0);
}

/** R6 — Garaż Pancerny i Warsztat Pojazdowy (L0 SW, X ∈ [-30, -10], Z ∈ [4, 16], y = 0.0 m). */
function buildRoomR6(k, p) {
  // Główna osłona w centrum garażu: Pancerna Cyber-Limuzyna Pułkownika `res_armored_limo` (5.4 × 1.65 × 2.3 m)
  // na X = -20.0, Z = +9.2 (poza spawnem #9 (-20, 0, 13) i hazardem (-27.5, 0, 6.5)).
  p.prop('res_armored_limo', -20.0, 9.2, Y_L0, 0);

  // Ściana narzędziowa `res_garage_tool_wall` (3.4 × 2.2 × 0.45 m) na ścianie północnej (Z = +4.2)
  // ze stołem diagnostycznym, obok raportu Easter Egg #1 (`res_ee_run1_forklift_memo.webp` na X = -18.0).
  deco(k, 'res_garage_tool_wall', -16.8, Y_L0 + 0.4, 4.42, 0);
  p.reserve(R(-18.6, -15.0, 4.2, 5.1), Y_L0);
  box(k, -16.8, Y_L0 + 0.5, 4.65, 3.4, 1.0, 0.5, 'metal', {
    walkable: false,
  });

  // Kolumna szybkiego ładowania EV (X = -24.2, Z = +13.5).
  p.reserve(R(-24.7, -23.7, 13.0, 14.0), Y_L0);
  box(k, -24.2, Y_L0 + 1.05, 13.5, 0.75, 2.1, 0.75, 'machine', {
    walkable: false,
  });
  box(k, -24.2, Y_L0 + 1.2, 13.9, 0.45, 1.4, 0.06, 'neon_blue', {
    walkable: false,
  });
  box(k, -24.2, Y_L0 + 1.98, 13.5, 0.8, 0.08, 0.8, 'neon_amber', {
    walkable: false,
  });

  // Skrzynie ze sprzętem taktycznym, stół zbrojmistrza i pancerne bramy garażowe na ścianie zachodniej.
  p.prop('wh_weapon_case_stack', -28.4, 10.5, Y_L0, 1);
  p.prop('wh_weapon_case_stack', -28.4, 13.8, Y_L0, 1);
  p.prop('wh_workbench_weapons', -15.2, 14.8, Y_L0, 2);
  p.prop('off_filing_cabinet', -12.2, 14.8, Y_L0, 2);

  deco(k, 'city_shutter', -29.75, Y_L0, 8.2, Q);
  deco(k, 'city_shutter', -29.75, Y_L0, 12.8, Q);
  deco(k, 'city_pipe_run', -29.7, Y_L0, 5.2, Q);
  deco(k, 'city_ac_unit', -25.0, Y_L0 + 3.2, 15.75, PI);

  for (const x of [-26.0, -20.0, -14.0]) {
    recessedLedStrip(k, x, Y_L0_CEIL, 7.2, 0);
    recessedLedStrip(k, x, Y_L0_CEIL, 12.8, 0);
  }
  ceilingCovePanel(k, -20.0, Y_L0_CEIL, 14.8, 16.0, 0.45);
}

/** R7 — Pokój Ochrony Parteru i Zbrojownia Straży (L0 SE, X ∈ [10, 30], Z ∈ [4, 16], y = 0.0 m). */
function buildRoomR7(k, p) {
  // Konsole monitoringu obwodowego wokół spawnu #10 (18, 0, 10) — z pełnym marginesem > 1.5 m od spawnu i lasera X = 24.0.
  p.prop('res_recording_console', 18.0, 6.6, Y_L0, 0);
  p.prop('off_office_chair', 18.0, 5.5, Y_L0, 0);
  p.prop('lab_security_desk', 18.0, 13.4, Y_L0, 2);
  p.prop('off_office_chair', 18.0, 14.6, Y_L0, 2);
  p.prop('off_executive_desk', 13.6, 13.4, Y_L0, 2);
  p.prop('off_filing_cabinet', 15.2, 4.8, Y_L0, 0);

  // Pylony emitera bramki laserowej `guardroom-armory-laser` (X = 24.0, Z: 6.0 -> 14.0).
  for (const z of [5.75, 14.25]) {
    p.reserve(R(23.75, 24.25, z - 0.25, z + 0.25), Y_L0);
    box(k, 24.0, Y_L0 + 0.6, z, 0.24, 1.2, 0.24, 'machine', {
      walkable: false,
    });
    box(k, 24.0, Y_L0 + 1.26, z, 0.28, 0.12, 0.28, 'neon_amber', {
      walkable: false,
    });
  }

  // Wschodni przedział Zbrojowni Straży (X ∈ [25.5, 29.5]): stojaki broni, pancerne szafy i stacja dronów.
  p.prop('lab_prototype_weapon_rack', 28.8, 7.2, Y_L0, -1);
  p.prop('lab_prototype_weapon_rack', 28.8, 10.0, Y_L0, -1);
  p.prop('lab_prototype_weapon_rack', 28.8, 12.8, Y_L0, -1);
  p.prop('lab_classified_cabinet', 26.8, 14.8, Y_L0, 2);
  p.prop('wh_weapon_case_stack', 26.8, 5.4, Y_L0, 0);

  // Ściana monitorów CCTV `res_cctv_monitor_wall` na południowej ścianie R7 (Z = +15.78).
  deco(k, 'res_cctv_monitor_wall', 18.0, Y_L0 + 0.9, 15.78, PI);
  deco(k, 'wh_wall_terminal', 10.22, Y_L0 + 1.2, 6.2, Q);
  deco(k, 'mall_security_fixture', 10.22, Y_L0 + 1.25, 13.8, Q);

  for (const x of [14.0, 20.0, 26.0]) {
    recessedLedStrip(k, x, Y_L0_CEIL, 7.2, 0);
    recessedLedStrip(k, x, Y_L0_CEIL, 12.8, 0);
  }
  ceilingCovePanel(k, 20.0, Y_L0_CEIL, 14.8, 16.0, 0.45);
}

/** R8 — Biuro Pułkownika Vane'a „Gabinet Egzekutora” (L1, X ∈ [-12, 12], Z ∈ [-30, -18], y = +4.80 m). */
function buildRoomR8(k, p) {
  // 1. GŁÓWNA TABLICA ŚLEDCZA „OPERACJA ISKRA” `res_investigation_board_iskra` (3.2 × 1.8 × 0.22 m)
  // na centralnej ścianie północnej gabinetu (X = 0.0, Y = 5.85, Z = -29.78).
  deco(k, 'res_investigation_board_iskra', 0, Y_L1 + 1.05, -29.78, 0);
  // Dedykowana listwa oświetleniowa `light_panel` nad Tablicą Śledczą „Iskra”.
  box(k, 0, Y_L1 + 3.05, -29.72, 3.6, 0.08, 0.18, 'light_panel', {
    walkable: false,
  });

  // 2. Monumentalne Biurko Pułkownika Vane'a `res_colonel_desk` (3.0 × 1.15 × 1.35 m)
  // na X = 0.0, Z = -25.4 (poza spawnem #13 (0, 4.8, -22) i punktem B (0, 4.8, -24)) + fotel Pułkownika.
  p.prop('res_colonel_desk', 0, -25.4, Y_L1, 0);
  p.prop('off_office_chair', 0, -26.8, Y_L1, 0);

  // Bramka biometryczna przy wejściu z Antresoli Salonu (Z = -19.2, prześwit 2.5 m na osi X = 0).
  biometricArch(k, p, 0, Y_L1, -19.2, 0);

  // 3. Zachodnia strefa gabinetowa VIP (X ∈ [-10.5, -3.5]):
  box(k, -7.2, Y_L1 - 0.021, -23.5, 5.6, 0.04, 6.2, MAT_CARPET, {
    walkable: false,
  });
  p.prop('res_coffee_table_marble', -7.2, -23.5, Y_L1, 0);
  p.prop('off_lounge_sofa', -7.2, -21.3, Y_L1, 2);
  p.prop('off_lounge_sofa', -7.2, -25.7, Y_L1, 0);
  p.prop('res_bookshelf_wall', -9.2, -29.3, Y_L1, 0);
  p.prop('off_office_planter', -10.4, -19.4, Y_L1, 0);

  // 4. Wschodnia strefa odpraw taktycznych i tajnych akt (X ∈ [3.5, 10.5]):
  p.prop('res_holo_globe_stand', 6.5, -23.5, Y_L1, 0);
  p.prop('res_trophy_case_tall', 9.2, -19.2, Y_L1, 2);
  p.prop('lab_classified_cabinet', 3.4, -29.2, Y_L1, 0);
  p.prop('lab_classified_cabinet', 10.8, -28.0, Y_L1, -1);
  p.prop('off_lounge_sofa', 6.5, -20.2, Y_L1, 2);
  p.prop('off_office_planter', 10.4, -21.2, Y_L1, 0);

  // Oprawy sufitowe pod stropem Biura R8 (y = 9.60 m).
  chandelierLinear(k, 0, Y_L1_CEIL, -24.0, 0);
  chandelierLinear(k, -7.2, Y_L1_CEIL, -24.0, 0);
  chandelierLinear(k, 6.8, Y_L1_CEIL, -24.0, 0);
  for (const x of [-7.2, 0, 7.2]) {
    recessedLedStrip(k, x, Y_L1_CEIL, -20.2, 0);
    recessedLedStrip(k, x, Y_L1_CEIL, -27.8, 0);
  }
  ceilingCovePanel(k, 0, Y_L1_CEIL, -29.0, 20.0, 0.45);
}

/** R9 — Biblioteka i Archiwum Prywatne (L1 W, X ∈ [-30, -12], Z ∈ [-30, -18], y = +4.80 m). */
function buildRoomR9(k, p) {
  // Dywan biblioteczny i 4 dwustronne podświetlane Regały Biblioteczne `res_bookshelf_wall` (3.2 × 2.8 × 0.75 m)
  // tworzące labirynt osłon CQB wokół spawnu #14 (-21, 4.8, -24).
  box(k, -22.5, Y_L1 - 0.021, -24.0, 12.0, 0.04, 9.0, MAT_CARPET, {
    walkable: false,
  });
  p.prop('res_bookshelf_wall', -21.0, -27.2, Y_L1, 0);
  p.prop('res_bookshelf_wall', -21.0, -20.8, Y_L1, 0);
  p.prop('res_bookshelf_wall', -25.6, -29.3, Y_L1, 0);
  p.prop('res_bookshelf_wall', -25.6, -18.7, Y_L1, 2);

  // Strefa czytelnicza z Holo-Globusem `res_holo_globe_stand` i stolikiem z księgami Easter Egg #9.
  p.prop('res_holo_globe_stand', -25.8, -24.5, Y_L1, 0);
  p.prop('res_coffee_table_marble', -25.0, -21.2, Y_L1, 0);
  p.prop('off_lounge_sofa', -28.2, -24.0, Y_L1, 1);
  p.prop('off_executive_desk', -16.0, -24.0, Y_L1, 1);
  p.prop('off_office_chair', -17.3, -24.0, Y_L1, 1);
  p.prop('lab_classified_cabinet', -13.2, -28.8, Y_L1, 0);
  p.prop('off_office_planter', -28.4, -19.6, Y_L1, 1);
  p.prop('off_office_planter', -28.4, -28.4, Y_L1, 1);

  for (const x of [-26.0, -21.0, -16.0]) {
    recessedLedStrip(k, x, Y_L1_CEIL, -21.0, 0);
    recessedLedStrip(k, x, Y_L1_CEIL, -27.0, 0);
  }
  ceilingCovePanel(k, -28.8, Y_L1_CEIL, -24.0, 0.45, 10.0);
}

/** R10 — Sala Trofeów i Kolekcja Ostrzy „Sanktuarium Kurogane” (L1 E, X ∈ [12, 30], Z ∈ [-30, -18], y = +4.80 m). */
function buildRoomR10(k, p) {
  // Centralny Postument z Pancerzem Egzekutora `res_armor_display_stand` (1.6 × 2.35 × 1.2 m)
  // na X = +21.0, Z = -21.2 (chroniony od północy bramką laserową Z = -24.0, poza spawnem #15 (21, 4.8, -27)).
  p.prop('res_armor_display_stand', 21.0, -21.2, Y_L1, 0);

  // Pylony emitera bramki laserowej `trophy-room-security-laser` (Z = -24.0, X: 18.5 -> 23.5).
  for (const x of [18.25, 23.75]) {
    p.reserve(R(x - 0.25, x + 0.25, -24.25, -23.75), Y_L1);
    box(k, x, Y_L1 + 0.6, -24.0, 0.24, 1.2, 0.24, 'machine', {
      walkable: false,
    });
    box(k, x, Y_L1 + 1.26, -24.0, 0.28, 0.12, 0.28, 'neon_violet', {
      walkable: false,
    });
  }

  // 4 wysokie Pancerne Gabloty Trofeów `res_trophy_case_tall` (2.4 × 2.4 × 0.85 m).
  p.prop('res_trophy_case_tall', 21.5, -29.2, Y_L1, 0);
  p.prop('res_trophy_case_tall', 26.5, -29.2, Y_L1, 0);
  p.prop('res_trophy_case_tall', 21.5, -18.8, Y_L1, 2);
  p.prop('res_trophy_case_tall', 26.5, -18.8, Y_L1, 2);

  // Postument Zachodni (X = +16.5, Z = -24.0) z ostrzem z warsztatu Miry (Easter Egg #10):
  p.reserve(R(15.85, 17.15, -24.65, -23.35), Y_L1);
  box(k, 16.5, Y_L1 + 0.55, -24.0, 1.2, 1.1, 1.2, MAT_MARBLE, {
    walkable: false,
  });
  box(k, 16.5, Y_L1 + 1.06, -24.0, 1.24, 0.06, 1.24, 'neon_amber', {
    walkable: false,
  });

  // Postument Wschodni (X = +25.5, Z = -24.0) z próbką ze Zbiornika nr 04 z Sektora X-51 (Easter Egg #3):
  p.reserve(R(24.85, 26.15, -24.65, -23.35), Y_L1);
  box(k, 25.5, Y_L1 + 0.55, -24.0, 1.2, 1.1, 1.2, MAT_MARBLE, {
    walkable: false,
  });
  box(k, 25.5, Y_L1 + 1.06, -24.0, 1.24, 0.06, 1.24, 'neon_violet', {
    walkable: false,
  });

  // Dodatkowe stojaki prototypów przy ścianie wschodniej (X = +29.1).
  p.prop('lab_prototype_weapon_rack', 29.1, -21.8, Y_L1, -1);
  p.prop('lab_prototype_weapon_rack', 29.1, -26.2, Y_L1, -1);
  p.prop('mall_kurogane_display', 18.0, -18.8, Y_L1, 2);

  chandelierLinear(k, 21.0, Y_L1_CEIL, -24.0, 0);
  for (const x of [16.0, 21.0, 26.0]) {
    recessedLedStrip(k, x, Y_L1_CEIL, -20.5, 0);
    recessedLedStrip(k, x, Y_L1_CEIL, -27.5, 0);
  }
  ceilingCovePanel(k, 28.8, Y_L1_CEIL, -24.0, 0.45, 10.0);
}

/** R11 — Sypialnia Pułkownika i Garderoba „Apartament Główny” (L1 NW, X ∈ [-24, 4], Z ∈ [-42, -30], y = +4.80 m). */
function buildRoomR11(k, p) {
  // 1. Strefa sypialniana (X ∈ [-24, -8], poza spawnem #16 (-14, 4.8, -39)):
  // Łoże Platformowe King-Size `res_master_bed_king` (2.8 × 1.25 × 2.6 m) na X = -14.0, Z = -35.2.
  box(k, -14.0, Y_L1 - 0.021, -35.2, 5.2, 0.04, 4.8, MAT_CARPET, {
    walkable: false,
  });
  p.prop('res_master_bed_king', -14.0, -35.2, Y_L1, 0);

  // Narożnik wypoczynkowy NW przy panoramicznym oknie na las i lądowisko drona H-06.
  p.prop('res_luxury_sofa_l', -20.8, -35.5, Y_L1, 1);
  p.prop('res_coffee_table_marble', -18.2, -35.5, Y_L1, 1);
  p.prop('res_bonsai_pedestal', -21.5, -40.2, Y_L1, 0);
  p.prop('off_office_planter', -22.2, -31.5, Y_L1, 0);
  deco(k, 'res_wall_art_triptych', -10.0, Y_L1 + 1.5, -30.22, 0);

  // 2. Przeszklona Garderoba Walk-In (X ∈ [-8, 4]):
  // 2 szafy `res_wardrobe_glass` (3.2 × 2.4 × 0.85 m), ścianka ekspozycyjna na X = +1.5, Z = -36.0 (nośnik EE-02!)
  // oraz gablota zegarków `mall_kurogane_display`.
  p.prop('res_wardrobe_glass', -6.8, -40.8, Y_L1, 0);
  p.prop('res_wardrobe_glass', -1.8, -40.8, Y_L1, 0);
  p.prop('mall_kurogane_display', -8.8, -35.5, Y_L1, 1);
  p.prop('lab_locker_bench', -4.2, -36.0, Y_L1, 0);

  p.reserve(R(1.25, 1.75, -37.4, -34.6), Y_L1);
  box(k, 1.5, Y_L1 + 1.4, -36.0, 0.36, 2.8, 2.6, MAT_WALNUT, {
    walkable: false,
  });
  box(k, 1.5, Y_L1 + 2.76, -36.0, 0.42, 0.08, 2.68, 'light_panel', {
    walkable: false,
  });

  for (const x of [-20.0, -14.0, -7.0, -1.0]) {
    recessedLedStrip(k, x, Y_L1_CEIL, -33.0, 0);
    recessedLedStrip(k, x, Y_L1_CEIL, -39.0, 0);
  }
  ceilingCovePanel(k, -10.0, Y_L1_CEIL, -40.8, 24.0, 0.45);
}

/** R12 — Prywatne Spa, Sauna i Łazienka Marmurowa (L1 NE, X ∈ [4, 24], Z ∈ [-42, -30], y = +4.80 m). */
function buildRoomR12(k, p) {
  // 1. Przeszklona Kabina Sauny Cedrowej `res_sauna_cabin` (2.8 × 2.4 × 2.2 m) w narożniku SE (X = +21.2, Z = -32.2).
  p.prop('res_sauna_cabin', 21.2, -32.2, Y_L1, 2);

  // 2. Monolityczna Wolnostojąca Wanna Kamienna przed północnym oknem na las (X = +14.0, Z = -39.2) z parą `steam`.
  p.reserve(R(12.7, 15.3, -40.0, -38.4), Y_L1);
  box(k, 14.0, Y_L1 + 0.44, -39.2, 2.4, 0.88, 1.3, MAT_MARBLE, {
    walkable: false,
  });
  box(k, 14.0, Y_L1 + 0.89, -39.2, 2.0, 0.04, 0.95, 'canal_water', {
    walkable: false,
  });
  box(k, 14.0, Y_L1 + 0.06, -39.2, 2.5, 0.08, 1.4, 'neon_blue', {
    walkable: false,
  });
  k.fx('steam', 14.0, Y_L1 + 0.95, -39.2, 0.7);

  // 3. Podwójna Konsola Umywalkowa z lustrem LED przy ścianie południowej (X = +12.0, Z = -30.7, między bramami X = 8 i X = 16).
  p.reserve(R(10.5, 13.5, -31.2, -30.2), Y_L1);
  box(k, 12.0, Y_L1 + 0.48, -30.65, 2.8, 0.96, 0.72, MAT_MARBLE, {
    walkable: false,
  });
  box(k, 12.0, Y_L1 + 1.65, -30.26, 2.6, 1.2, 0.06, MAT_GLASS, {
    walkable: false,
  });
  box(k, 12.0, Y_L1 + 2.28, -30.26, 2.68, 0.08, 0.08, 'light_panel', {
    walkable: false,
  });

  // Leżanki relaksacyjne, wyspa ręcznikowa w centrum i donice z bambusem.
  waistDivider(k, p, 14.0, Y_L1, -35.5, 2.6, 0.38);
  p.prop('res_pool_lounger', 8.2, -39.2, Y_L1, 0);
  p.prop('res_pool_lounger', 19.6, -39.2, Y_L1, 0);
  p.prop('res_winter_garden_planter', 22.2, -36.5, Y_L1, -1);
  p.prop('off_office_planter', 5.6, -40.6, Y_L1, 0);

  for (const x of [8.5, 14.0, 19.5]) {
    recessedLedStrip(k, x, Y_L1_CEIL, -33.0, 0);
    recessedLedStrip(k, x, Y_L1_CEIL, -39.0, 0);
  }
  ceilingCovePanel(k, 14.0, Y_L1_CEIL, -40.8, 17.0, 0.45);
}

/** R13 — Sala Tortur i Przesłuchań „Komora Wydobywania Danych” (Piwnica B SW, X ∈ [-28, -10], Z ∈ [16, 32], y = -4.80 m). */
function buildRoomR13(k, p) {
  // 1. Centrum Sali Tortur (X = -19.0, Z = +24.0 — poza spawnem #17 (-22, -4.8, 24)):
  // Fotel Przesłuchań z Pasami `res_interrogation_chair` (1.25 × 1.45 × 1.35 m),
  // Krata Odpływowa w posadzce pod fotelem oraz nisko zawieszona zimno-biała Lampa Przesłuchań (`light_panel`).
  p.prop('res_interrogation_chair', -19.0, 24.0, Y_B, 0);
  deco(k, 'city_vent_grate', -19.0, Y_B, 24.0, 0);
  box(k, -19.0, -0.75, 24.0, 0.08, 1.5, 0.08, 'metal', {
    ceiling: true,
    walkable: false,
  });
  box(k, -19.0, -1.54, 24.0, 1.25, 0.12, 0.85, 'light_panel', {
    ceiling: true,
    walkable: false,
  });

  // 2. Stalowy Wózek z Narzędziami Ekstrakcji `res_instrument_trolley` (1.4 × 1.05 × 0.75 m)
  // obok fotela (X = -16.2, Z = +24.0 — niesie teczkę Easter Egg #5 `res_ee_helixa_akord_dossier.webp`)
  // oraz drugi wózek pomocniczy na (X = -19.0, Z = +20.8).
  p.prop('res_instrument_trolley', -16.2, 24.0, Y_B, 0);
  p.prop('res_instrument_trolley', -19.0, 20.8, Y_B, 0);

  // 3. Klatka Przetrzymywania Więźniów `res_holding_cage_bars` (4.0 × 3.4 × 0.22 m × 3) wzdłuż ściany południowej (Z = +28.8):
  for (const x of [-24.0, -20.0, -16.0])
    holdingCageBars(k, p, x, Y_B, 28.8, 0);
  // Belka nadprożowa nad kratami celi (y = -1.4..0.0 m) i boczne domknięcie celi na X = -14.0.
  box(k, -20.0, -0.7, 28.8, 12.0, 1.4, 0.32, MAT_BUNKER, {
    walkable: false,
  });
  p.reserve(R(-14.2, -13.8, 28.8, 32.0), Y_B);
  box(k, -14.0, Y_B + 2.4, 30.4, 0.36, 4.8, 3.2, MAT_BUNKER, {
    walkable: false,
  });
  p.prop('lab_locker_bench', -24.0, 30.8, Y_B, 0);
  p.prop('lab_locker_bench', -16.0, 30.8, Y_B, 0);

  // 4. Lustro Weneckie na ścianie zachodniej (X = -27.76, Z = +24.0) oraz Konsola Nagrań `res_recording_console`
  // (X = -26.2, Z = +24.0 — 3.75 m na zachód od spawnu #17 (-22, -4.8, 24)).
  box(k, -27.76, Y_B + 1.85, 24.0, 0.1, 1.8, 3.4, MAT_GLASS, {
    walkable: false,
  });
  box(k, -27.74, Y_B + 2.78, 24.0, 0.14, 0.08, 3.5, 'light_panel', {
    walkable: false,
  });
  p.prop('res_recording_console', -26.2, 24.0, Y_B, 1);
  p.prop('off_office_chair', -25.0, 24.0, Y_B, -1);

  // Północna strefa aparatury i archiwum przesłuchań (Z ∈ [16.5, 19.5]).
  p.prop('lab_classified_cabinet', -26.2, 17.0, Y_B, 0);
  p.prop('lab_cryo_server_rack', -23.2, 17.0, Y_B, 0);
  p.prop('wh_weapon_case_stack', -15.5, 17.2, Y_B, 0);
  deco(k, 'city_pipe_run', -27.7, Y_B, 19.0, Q);
  deco(k, 'city_ac_unit', -20.0, Y_B + 3.2, 16.25, 0);
  deco(k, 'wh_wall_terminal', -10.22, Y_B + 1.2, 24.0, -Q);

  for (const x of [-24.0, -19.0, -14.0]) {
    recessedLedStrip(k, x, Y_B_CEIL, 19.5, 0);
    recessedLedStrip(k, x, Y_B_CEIL, 24.0, 0);
    recessedLedStrip(k, x, Y_B_CEIL, 27.5, 0);
  }
}

/** R14 — Prywatna Winiarnia i Degustatornia „Krypta Roczników” (Piwnica B Center, X ∈ [-10, 10], Z ∈ [16, 32], y = -4.80 m). */
function buildRoomR14(k, p) {
  // Portal szybu windy Stop 0 (Piwnica B, doorSide: "s", Z = 16.3), nadproże i panel wezwania (+1.65, -4.8, 16.42).
  box(k, 0, Y_B + 4.0, 16.45, 3.24, 1.6, 0.28, MAT_CONCRETE, {
    walkable: false,
  });
  deco(k, 'res_elevator_shaft_door', 0, Y_B, 16.3, 0);
  deco(k, 'res_elevator_call_panel', 1.65, Y_B, 16.42, 0);

  // Kamienno-dębowy Stół Degustacyjny w centrum Winiarni (X = 0.0, Z = +26.2 — poza spawnem #18 (0,-4.8,21) i punktem C (0,-4.8,24))
  // z kartą degustacyjną Easter Egg #7 (`res_ee_vintage_2048_wine.webp`).
  p.reserve(R(-1.7, 1.7, 25.4, 27.0), Y_B);
  box(k, 0, Y_B + 0.52, 26.2, 3.2, 1.04, 1.4, MAT_WALNUT, {
    walkable: false,
  });
  box(k, 0, Y_B + 1.07, 26.2, 3.4, 0.06, 1.56, MAT_MARBLE, {
    walkable: false,
  });
  box(k, 0, Y_B + 1.02, 26.2, 3.28, 0.04, 1.44, 'neon_amber', {
    walkable: false,
  });

  // 4 podświetlane Ścienne Regały na Wino `res_wine_rack_wall` (3.2 × 2.8 × 0.65 m):
  // 2 przy ścianie południowej (Z = 31.3) oraz 2 wzdłuż wewnętrznych policzków Klatek Schodowych #1 i #2 (X = ±4.5).
  p.prop('res_wine_rack_wall', -3.2, 31.3, Y_B, 2);
  p.prop('res_wine_rack_wall', 3.2, 31.3, Y_B, 2);
  p.prop('res_wine_rack_wall', -4.5, 22.5, Y_B, 1);
  p.prop('res_wine_rack_wall', 4.5, 22.5, Y_B, -1);

  // Dębowe leżnie beczek wina (X = ±4.3, Z = 27.2) oraz zabudowa pod niższym biegiem schodów (Z ∈ [21.5, 26.2], wys. 1.7 m)
  // — strefa Z ∈ [16.0, 21.0] pod górnym biegiem pozostaje w 100% otwarta dla północnych bram Z = 18.4!
  for (const sx of [-1, 1]) {
    p.reserve(R(sx * 4.3 - 0.55, sx * 4.3 + 0.55, 26.0, 28.4), Y_B);
    box(k, sx * 4.3, Y_B + 0.72, 27.2, 1.0, 1.44, 2.2, MAT_WALNUT, {
      walkable: false,
    });
    box(k, sx * 4.3, Y_B + 0.1, 27.2, 1.06, 0.06, 2.26, 'neon_amber', {
      walkable: false,
    });
  }
  p.reserve(R(-8.4, -5.2, 21.5, 26.2), Y_B);
  solid(k, R(-8.4, -5.2, 21.5, 26.2), Y_B, Y_B + 1.7, MAT_WALNUT, {
    walkable: false,
  });
  p.reserve(R(5.2, 8.4, 21.5, 26.2), Y_B);
  solid(k, R(5.2, 8.4, 21.5, 26.2), Y_B, Y_B + 1.7, MAT_WALNUT, {
    walkable: false,
  });

  for (const x of [-3.0, 0, 3.0]) {
    recessedLedStrip(k, x, Y_B_CEIL, 19.5, 0);
    recessedLedStrip(k, x, Y_B_CEIL, 25.0, 0);
    recessedLedStrip(k, x, Y_B_CEIL, 30.0, 0);
  }
}

/** R15 — Podziemny Bunkier Ochrony, Serwerownia i Śluza Ewakuacyjna (Piwnica B SE, X ∈ [10, 28], Z ∈ [16, 32], y = -4.80 m). */
function buildRoomR15(k, p) {
  // 1. Wielka Ściana Monitorów CCTV `res_cctv_monitor_wall` (4.0 × 2.4 × 0.25 m) na ścianie wschodniej (X = +27.78, Z = +21.5).
  deco(k, 'res_cctv_monitor_wall', 27.78, Y_B + 0.9, 21.5, -Q);

  // 2. Szafy serwerowe Orbis Grid wokół pola wyładowań UPS `bunker-ups-discharge` (23.5, -3.8, 25.0).
  for (const x of [21.5, 23.5, 25.5])
    p.prop('off_office_server_rack', x, 17.2, Y_B, 0);
  p.prop('lab_cryo_server_rack', 23.5, 29.8, Y_B, 2);
  p.prop('lab_cryo_server_rack', 25.8, 29.8, Y_B, 2);
  deco(k, 'city_vent_grate', 23.5, Y_B, 25.0, 0);

  // 3. Konsole dowodzenia bunkrem tworzące szykanę przed śluzą ewakuacyjną `exit` (19, -3.3, 32.5),
  // z zachowaniem pełnego odstępu od spawnów #19 (16, -4.8, 21), #20 (19, -4.8, 29) oraz beczki (14, -4.8, 29.5).
  p.prop('res_recording_console', 19.5, 21.0, Y_B, -1);
  p.prop('off_office_chair', 20.6, 21.0, Y_B, 1);
  p.prop('lab_security_desk', 16.0, 25.2, Y_B, 0);
  p.prop('off_office_chair', 16.0, 24.0, Y_B, 0);
  p.prop('lab_prototype_weapon_rack', 13.5, 16.8, Y_B, 0);
  p.prop('wh_weapon_case_stack', 11.6, 24.0, Y_B, 1);

  deco(k, 'city_ac_unit', 24.0, Y_B + 3.2, 16.25, 0);
  deco(k, 'city_pipe_run', 27.7, Y_B, 29.0, -Q);
  deco(k, 'wh_wall_terminal', 10.22, Y_B + 1.2, 24.0, Q);
  deco(k, 'mall_security_fixture', 16.2, Y_B + 1.25, 31.78, PI);

  for (const x of [14.0, 19.0, 24.0]) {
    recessedLedStrip(k, x, Y_B_CEIL, 19.5, 0);
    recessedLedStrip(k, x, Y_B_CEIL, 24.5, 0);
    recessedLedStrip(k, x, Y_B_CEIL, 29.5, 0);
  }
}

export function buildRooms(k, placer) {
  buildRoomR1(k, placer);
  buildRoomR2(k, placer);
  buildRoomR3(k, placer);
  buildRoomR4(k, placer);
  buildRoomR5(k, placer);
  buildRoomR6(k, placer);
  buildRoomR7(k, placer);
  buildRoomR8(k, placer);
  buildRoomR9(k, placer);
  buildRoomR10(k, placer);
  buildRoomR11(k, placer);
  buildRoomR12(k, placer);
  buildRoomR13(k, placer);
  buildRoomR14(k, placer);
  buildRoomR15(k, placer);
}
