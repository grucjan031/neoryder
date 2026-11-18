import { BoxGeometry, Box3, Group, Mesh, Vector3 } from 'three';
import type { BufferGeometry, Object3D, Scene as ThreeScene } from 'three';
import type { GameContext } from '../core/context';
import { CityDressing } from '../render/city/dressing';
import type { DressingLayout } from '../render/city/dressing';
import { cloneCityModel } from '../render/cityModels';
import { createStyleLights } from '../render/lights';
import { getMaterial, syncMaterials } from '../render/materials';
import type { MaterialKind } from '../render/materials';
import { SceneAtmosphere } from '../render/sceneAtmosphere';
import type { Scene } from './index';

type Mount = 'block' | 'ground' | 'wall' | 'span' | 'exhibit';
interface Slot {
  model: string;
  mount: Mount;
  side: -1 | 1;
  z: number;
  /** Odległość od osi ulicy (x = side * dist); dla rozpięć ignorowana. */
  dist: number;
  y: number;
}

/** Lista modeli galerii; nowe modele dopisz tutaj i w `slots`. */
export const CITY_PROP_MODELS = [
  'city_dumpster',
  'city_vending',
  'city_barrier',
  'city_car',
  'city_stall',
  'city_crates',
  'city_generator',
  'city_ac_unit',
  'city_pipe_run',
  'city_fire_escape',
  'city_shutter',
  'city_awning',
  'city_door',
  'city_sign_box',
  'city_street_lamp',
  'city_vent_grate',
  'city_trash_bags',
  'city_traffic_cone',
  'city_holo_projector',
  'city_antenna',
  'city_cable_span',
  'city_lantern_string',
  'city_ad_screen',
  'city_kiosk',
  'city_overpass_pillar',
  'city_overpass_deck',
  'city_highway_barrier',
  'city_highway_sign_gantry',
  'city_wrecked_car',
  'city_smog_scrubber',
  'city_roof_water_tank',
  'city_roof_hvac_unit',
  'city_market_stall_canopy',
  'city_market_stall_canopy_violet',
  'city_roof_bridge',
  'city_neon_sign_frame',
  'city_satellite_cluster',
] as const;

const HALF_WIDTH = 5;
const SIDEWALK = 4;
const SPACING = 6;
const START_Z = -18;
const COUNT = 7;
const slot = (
  model: string,
  mount: Mount,
  side: -1 | 1,
  index: number,
  dist = SIDEWALK,
): Slot => ({ model, mount, side, z: START_Z + index * SPACING, dist, y: 0 });
const wallSlot = (model: string, side: -1 | 1, i: number, y: number): Slot => ({
  model,
  mount: 'wall',
  side,
  z: START_Z + SPACING / 2 + i * SPACING,
  dist: HALF_WIDTH,
  y,
});
const span = (model: string, z: number, y: number): Slot => ({
  model,
  mount: 'span',
  side: 1,
  z,
  dist: 0,
  y,
});
const exhibit = (model: string, column: number, row: number): Slot => ({
  model,
  mount: 'exhibit',
  side: 1,
  dist: -60 + column * 25,
  z: -36 + row * 24,
  y: 0,
});
const slots: Slot[] = [
  slot('city_dumpster', 'block', -1, 0),
  slot('city_vending', 'block', -1, 1),
  slot('city_barrier', 'block', -1, 2),
  slot('city_car', 'block', -1, 3, 1.9),
  slot('city_stall', 'block', -1, 4),
  slot('city_crates', 'block', -1, 5),
  slot('city_generator', 'block', -1, 6),
  slot('city_street_lamp', 'ground', 1, 0, 4.6),
  slot('city_vent_grate', 'ground', 1, 1, 2),
  slot('city_trash_bags', 'ground', 1, 2),
  slot('city_traffic_cone', 'ground', 1, 3, 2.4),
  slot('city_holo_projector', 'ground', 1, 4, 3),
  slot('city_antenna', 'ground', 1, 5),
  slot('city_kiosk', 'block', 1, 6),
  wallSlot('city_door', -1, 0, 0),
  wallSlot('city_shutter', -1, 1, 0),
  wallSlot('city_pipe_run', -1, 2, 0),
  wallSlot('city_ac_unit', -1, 3, 3),
  wallSlot('city_fire_escape', -1, 4, 2),
  wallSlot('city_awning', 1, 0, 2.6),
  wallSlot('city_sign_box', 1, 1, 3.5),
  wallSlot('city_ad_screen', 1, 2, 0.6),
  span('city_cable_span', -6, 5.6),
  span('city_lantern_string', 6, 5),
  exhibit('city_overpass_pillar', 0, 0),
  exhibit('city_overpass_deck', 0, 1),
  exhibit('city_highway_barrier', 0, 2),
  exhibit('city_highway_sign_gantry', 0, 3),
  exhibit('city_wrecked_car', 0, 4),
  exhibit('city_smog_scrubber', 0, 5),
  exhibit('city_roof_water_tank', 1, 0),
  exhibit('city_roof_hvac_unit', 1, 1),
  exhibit('city_market_stall_canopy', 1, 2),
  exhibit('city_market_stall_canopy_violet', 1, 3),
  exhibit('city_roof_bridge', 1, 4),
  exhibit('city_neon_sign_frame', 1, 5),
  exhibit('city_satellite_cluster', 1, 6),
];

/** Modele portu (arena „Port kontenerowy”), plac za prawą pierzeją uliczki. */
export const PORT_PROP_MODELS = [
  'port_container_20_navy',
  'port_container_20_olive',
  'port_container_20_ochre',
  'port_container_20_graphite',
  'port_container_40_navy',
  'port_container_40_olive',
  'port_container_40_ochre',
  'port_container_40_graphite',
  'port_gantry_crane',
  'port_light_tower',
  'port_bollard',
  'port_bollard_rope',
  'port_reach_stacker',
  'port_quay_edge',
  'port_lashing_platform',
] as const;

/** Rekwizyt portu: pozycja świata i obrót wokół Y (radiany). */
interface PortSlot {
  model: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
}
const QUARTER = Math.PI / 2;
const CONTAINER_H = 2.591;
/** Plac: od pierzei (x = 9) do krawędzi nabrzeża (x = 44,4), wewnątrz pierścienia panoramy. */
const YARD = { x0: 9, x1: 44.4, half: 23 };
const QUAY_X = 45.2;
/** Stos kontenerów wzdłuż Z (drzwi w −Z); kolory od dołu. */
function stack(
  size: 20 | 40,
  x: number,
  z: number,
  paints: string[],
): PortSlot[] {
  return paints.map((paint, tier) => ({
    model: `port_container_${size}_${paint}`,
    x,
    y: tier * CONTAINER_H,
    z,
    yaw: QUARTER,
  }));
}
/** Pierwsze wystąpienie modelu kadruje `prop=`; suwnica stoi nad trzema rzędami. */
const portSlots: PortSlot[] = [
  ...stack(20, 28.8, -15, ['graphite']),
  ...stack(20, 28.8, -5, ['navy', 'ochre']),
  ...stack(20, 28.8, 5, ['olive', 'graphite']),
  ...stack(40, 23, -13, ['navy', 'graphite', 'olive']),
  ...stack(40, 23, 0, ['olive', 'navy']),
  ...stack(40, 23, 13, ['ochre', 'graphite', 'navy']),
  ...stack(40, 25.9, -13, ['graphite', 'ochre']),
  ...stack(40, 25.9, 0, ['ochre']),
  ...stack(40, 25.9, 13, ['navy']),
  {
    model: 'port_lashing_platform',
    x: 28.8,
    y: 2 * CONTAINER_H,
    z: 0,
    yaw: QUARTER,
  },
  { model: 'port_gantry_crane', x: 29, y: 0, z: 0, yaw: Math.PI },
  // Wózek podnosi kontener 20 ft: rama chwytaka wisi 4,33 m przed środkiem modelu.
  { model: 'port_reach_stacker', x: 37, y: 0, z: 6, yaw: 0 },
  { model: 'port_container_20_ochre', x: 37, y: 0, z: 10.33, yaw: 0 },
  { model: 'port_light_tower', x: 13.5, y: 0, z: 18, yaw: 0 },
  { model: 'port_bollard', x: 43.6, y: 0, z: -16, yaw: -QUARTER },
  { model: 'port_bollard_rope', x: 43.6, y: 0, z: 16, yaw: -QUARTER },
  { model: 'port_bollard', x: 43.6, y: 0, z: -4, yaw: -QUARTER },
  ...Array.from({ length: 11 }, (_, i) => ({
    model: 'port_quay_edge',
    x: QUAY_X,
    y: -2,
    z: -20 + i * 4,
    yaw: QUARTER,
  })),
];
const portLight = (
  x: number,
  y: number,
  z: number,
  color: string,
  intensity: number,
  range: number,
) => ({ position: { x, y, z }, color, intensity, range });
const PORT_LIGHTS = [
  portLight(15, 18.5, 16.5, '#fff1d6', 120, 30),
  portLight(29, 14.5, 0, '#fff1d6', 90, 24),
  portLight(37, 4.5, 9, '#ffae1a', 40, 11),
  portLight(42, 3, 6, '#3d7bff', 40, 12),
  portLight(19, 6, -8, '#8a5cff', 40, 12),
];

const constructionPowerSlots: PortSlot[] = [
  { model: 'build_tower_crane', x: -90, y: 0, z: -18, yaw: Math.PI / 3 },
  { model: 'build_scaffold_bay', x: -84, y: 0, z: 21, yaw: 0 },
  { model: 'build_unfinished_column', x: -76, y: 0, z: 21, yaw: 0 },
  { model: 'build_rebar_bundle', x: -68, y: 0, z: 21, yaw: 0 },
  { model: 'build_precast_stack', x: -59, y: 0, z: 21, yaw: 0 },
  { model: 'build_pipe_stack', x: -50, y: 0, z: 21, yaw: 0 },
  { model: 'build_mixer_truck', x: -80, y: 0, z: 8, yaw: 0 },
  { model: 'build_site_office', x: -64, y: 0, z: 8, yaw: 0 },
  { model: 'build_site_office_stairs', x: -52, y: 0, z: 8, yaw: 0 },
  { model: 'build_hoarding_fence', x: -43, y: 0, z: 8, yaw: 0 },
  { model: 'power_cooling_tower', x: -24, y: 0, z: -35, yaw: 0 },
  { model: 'power_cooling_tower_breach', x: 31, y: 0, z: -35, yaw: 0 },
  { model: 'power_turbine_housing', x: -23, y: 0, z: 18, yaw: 0 },
  { model: 'power_transformer', x: -6, y: 0, z: 24, yaw: 0 },
  { model: 'power_hv_pylon', x: 16, y: 0, z: 8, yaw: 0 },
  { model: 'power_pipe_rack', x: 9, y: 0, z: 26, yaw: 0 },
  { model: 'power_chimney', x: 74, y: 0, z: -25, yaw: 0 },
  { model: 'power_slag_heap', x: 49, y: 0, z: 17, yaw: 0 },
];
export const CONSTRUCTION_POWER_PROP_MODELS = constructionPowerSlots.map(
  ({ model }) => model,
);
/** Widoki: 6 = budowa i elektrownia (osobny plac), 7 = nabrzeże, 8 = zajezdnia (zestaw „port i zajezdnia”). */
const CONSTRUCTION_POWER_VIEW = 6;
const CONSTRUCTION_POWER_LIGHTS = [
  portLight(-63, 10, 15, '#fff1d6', 155, 38),
  portLight(-26, 14, 8, '#3d7bff', 220, 60),
  portLight(32, 12, -2, '#fff1d6', 250, 65),
  portLight(62, 12, 20, '#ffae1a', 155, 42),
];
/** Zestaw „port i zajezdnia” (ADR 0011): kontenerowiec, suwnica STS, wagony, hala i zajezdnia maglev. */
export const PORT_RAIL_PROP_MODELS = [
  'port_ship_bow',
  'port_ship_mid',
  'port_ship_mid_hold',
  'port_ship_stern',
  'port_sts_crane',
  'port_gangway',
  'port_freight_boxcar',
  'port_freight_boxcar_open',
  'port_flatcar',
  'port_warehouse_shell_panel',
  'port_warehouse_roof_truss',
  'rail_track_straight',
  'rail_track_buffer',
  'rail_maglev_car',
  'rail_maglev_car_open',
  'rail_maglev_head',
  'rail_catenary_mast',
  'rail_signal_gantry',
  'rail_control_tower',
  'rail_platform_canopy',
  'rail_turntable',
  'rail_snow_drift',
  'rail_snow_drift_long',
  'rail_snow_drift_patch',
] as const;

/**
 * Plac zestawu daleko na północy (z ok. −440…−260), poza pierścieniami panoramy (r ≤ 170 m),
 * więc wieżowce tła nie przecinają statku ani suwnicy. Współrzędne slotów są względne.
 */
const SET_ORIGIN = { x: 0, z: -330 };
const HALF_TURN = Math.PI;
/** Wagon maglev stoi na torze: y modelu = 0,65 m nad spodem toru (wierzch prowadnicy 1,0 m). */
const MAGLEV_Y = 0.65;
const PLATFORM_Y = MAGLEV_Y + 1.1;
const setSlot = (
  model: string,
  x: number,
  y: number,
  z: number,
  yaw = 0,
): PortSlot => ({
  model,
  x: SET_ORIGIN.x + x,
  y,
  z: SET_ORIGIN.z + z,
  yaw,
});
const TRACK_ZS = [22, 27, 32, 37];
const setSlots: PortSlot[] = [
  // Nabrzeże: kontenerowiec burtą przy krawędzi kei (z = −40), suwnica nad nim, trap do luki w relingu.
  setSlot('port_ship_stern', -45, 0, -56),
  setSlot('port_ship_mid', -15, 0, -56),
  setSlot('port_ship_mid_hold', 15, 0, -56),
  setSlot('port_ship_bow', 44, 0, -56),
  ...[0, 1, 2, 3].flatMap((row) =>
    [0, 1].map((tier) =>
      setSlot(
        `port_container_40_${['navy', 'olive', 'ochre', 'graphite'][(row + tier) % 4]}`,
        -22.4,
        12.8 + tier * CONTAINER_H,
        -56 - 10.97 + row * 2.438,
      ),
    ),
  ),
  ...[5, 6, 7].map((row) =>
    setSlot(
      `port_container_40_${['graphite', 'navy', 'olive'][row % 3]}`,
      -7.6,
      12.8,
      -56 - 10.97 + row * 2.438,
    ),
  ),
  setSlot('port_sts_crane', 25, 0, -21, QUARTER),
  setSlot('port_gangway', -2, 0, -39, HALF_TURN),
  setSlot('port_freight_boxcar', -53, 0, 3),
  setSlot('port_freight_boxcar_open', -39, 0, 3),
  setSlot('port_flatcar', -25, 0, 3),
  // Fragment hali 12 × 30 m: dwa moduły ścian po każdej stronie i dwie kratownice na 10 m.
  ...[58, 64].flatMap((x) => [
    setSlot('port_warehouse_shell_panel', x, 0, -30, HALF_TURN),
    setSlot('port_warehouse_shell_panel', x, 0, 0),
    setSlot('port_warehouse_roof_truss', x, 10, -15, QUARTER),
  ]),
  // Zajezdnia: cztery tory wzdłuż X, kozły na zachodzie, peron z wiatami przy torze z = 37.
  ...TRACK_ZS.flatMap((z) => [
    ...Array.from({ length: 9 }, (_, i) =>
      setSlot('rail_track_straight', -30 + i * 12, 0, z),
    ),
    setSlot('rail_track_buffer', -38, 0, z, HALF_TURN),
  ]),
  setSlot('rail_maglev_car_open', 2.5, MAGLEV_Y, 37),
  setSlot('rail_maglev_car', -22.5, MAGLEV_Y, 37),
  setSlot('rail_maglev_head', 28.5, MAGLEV_Y, 37),
  setSlot('rail_maglev_head', 0, MAGLEV_Y, 27, HALF_TURN),
  ...[-30, -6, 18, 42].map((x) => setSlot('rail_catenary_mast', x, 0, 18.4)),
  setSlot('rail_signal_gantry', 63, 0, 29.5),
  ...[-12, 0, 12].map((x) =>
    setSlot('rail_platform_canopy', x, PLATFORM_Y, 42.1),
  ),
  setSlot('rail_control_tower', 76, 0, 52),
  setSlot('rail_turntable', -54, -1.5, 30),
  setSlot('rail_snow_drift', -20, 0, 48),
  setSlot('rail_snow_drift_long', 10, 0, 16.5),
  setSlot('rail_snow_drift_patch', 40, 0, 47.5),
  setSlot('rail_snow_drift', -62, 0, 47),
  setSlot('rail_snow_drift_long', 66, 0, 45, QUARTER),
  setSlot('rail_snow_drift_patch', 55, 0, 15),
];
const SET_LIGHTS = [
  portLight(SET_ORIGIN.x - 15, 15, SET_ORIGIN.z - 48, '#fff1d6', 120, 30),
  portLight(SET_ORIGIN.x - 43, 26, SET_ORIGIN.z - 46, '#fff1d6', 120, 30),
  portLight(SET_ORIGIN.x + 25, 38, SET_ORIGIN.z - 45, '#fff1d6', 140, 36),
  portLight(SET_ORIGIN.x - 39, 4, SET_ORIGIN.z + 6, '#ffae1a', 40, 12),
  portLight(SET_ORIGIN.x + 61, 7, SET_ORIGIN.z - 15, '#fff1d6', 60, 18),
  portLight(SET_ORIGIN.x, 5.5, SET_ORIGIN.z + 42, '#fff1d6', 60, 18),
  portLight(SET_ORIGIN.x + 20, 4, SET_ORIGIN.z + 30, '#3d7bff', 50, 16),
  portLight(SET_ORIGIN.x + 76, 13, SET_ORIGIN.z + 52, '#fff1d6', 60, 18),
  portLight(SET_ORIGIN.x + 63, 6, SET_ORIGIN.z + 30, '#ffae1a', 40, 14),
];

/**
 * Zestaw „estakada, dachy, doki” (areny arenaOverpass, arenaRooftops, arenaFloodedDocks): osobny plac
 * bez uliczki (`view=9` albo `prop=<model zestawu>`). Kolumny od zachodu: estakada, dachy, doki.
 */
const overpassRoofsDocksSlots: PortSlot[] = [
  { model: 'hw_vent_tower', x: -64, y: 0, z: -30, yaw: 0 },
  { model: 'hw_broken_deck_end', x: -48, y: 0, z: -28, yaw: 0 },
  { model: 'hw_toll_booth', x: -35, y: 0, z: -28, yaw: 0 },
  { model: 'hw_gas_canopy', x: -50, y: 0, z: 6, yaw: 0 },
  { model: 'hw_gas_pump', x: -54.5, y: 0, z: 6, yaw: 0 },
  { model: 'hw_gas_pump', x: -45.5, y: 0, z: 6, yaw: 0 },
  { model: 'hw_storm_culvert', x: -70, y: 0, z: 26, yaw: 0 },
  { model: 'hw_camp_tent_dome', x: -58, y: 0, z: 27, yaw: 0.4 },
  { model: 'hw_camp_tent_ridge', x: -52, y: 0, z: 28, yaw: -0.3 },
  { model: 'hw_camp_shack', x: -45, y: 0, z: 27, yaw: 0 },
  { model: 'hw_fire_barrel', x: -50.5, y: 0, z: 32, yaw: 0 },
  { model: 'roof_clock_tower', x: -12, y: 0, z: -28, yaw: 0 },
  { model: 'roof_giant_sign', x: 8, y: 0, z: -28, yaw: 0 },
  { model: 'roof_stairwell_hut', x: -12, y: 0, z: 6, yaw: 0 },
  { model: 'roof_skylight', x: -3, y: 0, z: 6, yaw: 0 },
  { model: 'roof_chimney_stack', x: 5, y: 0, z: 6, yaw: 0 },
  { model: 'dock_pump_house', x: 50, y: 0, z: -34, yaw: 0 },
  { model: 'dock_lock_gate', x: 32, y: 0, z: -6, yaw: 0 },
  { model: 'dock_half_sunken_car', x: 69, y: 0, z: -6, yaw: 0.5 },
  { model: 'dock_barge', x: 52, y: 0, z: 12, yaw: 0 },
  { model: 'dock_pontoon', x: 52, y: 0, z: 27, yaw: 0 },
  { model: 'dock_mooring_post', x: 44, y: 0, z: 27, yaw: 0 },
  { model: 'dock_skiff', x: 64, y: 0, z: 27, yaw: 0 },
];
export const OVERPASS_ROOFS_DOCKS_PROP_MODELS = [
  ...new Set(overpassRoofsDocksSlots.map(({ model }) => model)),
];
const OVERPASS_ROOFS_DOCKS_VIEW = 9;
/** Plac zestawu i korytarz kamery przeglądu: panorama nie stawia tu wieżowców. */
const OVERPASS_ROOFS_DOCKS_BOUNDS = new Box3(
  new Vector3(-80, 0, -46),
  new Vector3(80, 60, 112),
);
const OVERPASS_ROOFS_DOCKS_GROUND: readonly [V3, V3, MaterialKind][] = [
  [[56, 0.3, 86], [-52, -0.15, -3], 'asphalt'],
  [[48, 0.3, 86], [0, -0.15, -3], 'roof_tar'],
  [[56, 0.3, 86], [52, -0.15, -3], 'quay_concrete'],
];
const OVERPASS_ROOFS_DOCKS_LIGHTS = [
  portLight(-50, 4.8, 6, '#fff1d6', 120, 26),
  portLight(-60, 12, -24, '#6dff4a', 90, 24),
  portLight(-50, 2, 30, '#ffae1a', 60, 14),
  portLight(-2, 14, -20, '#8a5cff', 140, 32),
  portLight(-8, 6, 10, '#3d7bff', 60, 18),
  portLight(50, 8, -20, '#ffae1a', 120, 30),
  portLight(52, 6, 18, '#fff1d6', 90, 24),
];

interface SoloSet {
  view: number;
  slots: readonly PortSlot[];
  lights: readonly ReturnType<typeof portLight>[];
  bounds: Box3;
  ground: readonly [V3, V3, MaterialKind][];
}
/** Zestawy z osobnym placem zamiast uliczki i portu (`view=<numer>` albo `prop=<model zestawu>`). */
const SOLO_SETS: readonly SoloSet[] = [
  {
    view: CONSTRUCTION_POWER_VIEW,
    slots: constructionPowerSlots,
    lights: CONSTRUCTION_POWER_LIGHTS,
    bounds: new Box3(new Vector3(-103, 0, -70), new Vector3(93, 120, 80)),
    ground: [[[196, 0.3, 150], [-5, -0.17, 5], 'asphalt']],
  },
  {
    view: OVERPASS_ROOFS_DOCKS_VIEW,
    slots: overpassRoofsDocksSlots,
    lights: OVERPASS_ROOFS_DOCKS_LIGHTS,
    bounds: OVERPASS_ROOFS_DOCKS_BOUNDS,
    ground: OVERPASS_ROOFS_DOCKS_GROUND,
  },
];

const LIGHT_COLORS = ['#ffae1a', '#8a5cff', '#6dff4a', '#3d7bff', '#fff1d6'];
type V3 = [number, number, number];
const REVIEW_VIEWS: readonly { from: V3; to: V3 }[] = [
  { from: [0.7, 1.75, 23], to: [-0.2, 2.6, -14] },
  { from: [-0.7, 1.75, -21], to: [0.2, 2.6, 14] },
  { from: [0, 17, 36], to: [0, 0, 0] },
  { from: [14, 13, 32], to: [31, 3, -4] },
  { from: [-88, 60, 142], to: [-60, 0, 25] },
  { from: [-63, 60, 150], to: [-35, 0, 35] },
  { from: [0, 55, 122], to: [-5, 45, -19] },
  {
    from: [SET_ORIGIN.x + 60, 45, SET_ORIGIN.z + 55],
    to: [SET_ORIGIN.x - 5, 8, SET_ORIGIN.z - 45],
  },
  {
    from: [SET_ORIGIN.x - 75, 30, SET_ORIGIN.z + 85],
    to: [SET_ORIGIN.x + 5, 2, SET_ORIGIN.z + 32],
  },
  { from: [0, 46, 76], to: [0, 0, -8] },
];
const DEFAULT_YAW_DEG = 35;
const FILL_RATIO = 0.65;
const PROP_ELEVATION = 0.2;

function slotYaw(s: Slot): number {
  if (s.mount === 'span' || s.mount === 'exhibit') return 0;
  return s.side < 0 ? Math.PI / 2 : -Math.PI / 2;
}

/** Galeria wszystkich modeli miejskich w uliczce Neon Noir do oceny na zrzutach. */
export class CityPropsTest implements Scene {
  readonly id = 'city-props-test';
  private readonly root = new Group();
  private readonly lights = createStyleLights();
  private readonly geometries = new Set<BufferGeometry>();
  private atmosphere?: SceneAtmosphere;
  private dressing?: CityDressing;
  private ctx?: GameContext;
  private disposed = false;
  private readonly params = new URLSearchParams(
    typeof location === 'undefined' ? '' : location.search,
  );
  private focus?: Slot;
  private portFocus?: PortSlot;
  private view = 0;
  private solo?: SoloSet;
  private readonly cameraPos = new Vector3();
  private readonly cameraTarget = new Vector3();
  private hasPropCamera = false;

  init(ctx: GameContext, three: ThreeScene): Promise<void> {
    this.ctx = ctx;
    const requested = this.params.get('prop');
    const soloFocus = SOLO_SETS.find((set) =>
      set.slots.some((slot) => slot.model === requested),
    );
    const view = Number(this.params.get('view') ?? 0);
    this.view =
      Number.isInteger(view) && view >= 0 && view < REVIEW_VIEWS.length
        ? view
        : 0;
    this.solo =
      soloFocus ??
      (requested ? undefined : SOLO_SETS.find((set) => set.view === this.view));
    this.atmosphere = new SceneAtmosphere(
      three,
      'neonStreet',
      'city-props-test',
      0,
      this.solo?.bounds,
    );
    this.root.name = this.id;
    three.add(this.root);
    this.root.add(this.lights);
    if (this.solo) {
      this.portFocus = soloFocus?.slots.find((s) => s.model === requested);
      for (const [size, position, kind] of this.solo.ground)
        this.box(size, position, kind);
    } else {
      if (SOLO_SETS.some((set) => set.view === this.view)) this.view = 0;
      this.buildStreet();
      if (requested) {
        this.focus = slots.find((s) => s.model === requested);
        this.portFocus =
          portSlots.find((s) => s.model === requested) ??
          setSlots.find((s) => s.model === requested);
        if (!this.focus && !this.portFocus)
          console.warn(`city-props-test: nieznany model "${requested}"`);
      }
    }
    this.dressing = new CityDressing(
      this.root,
      this.layout(),
      this.atmosphere.theme,
      0,
      'city-props-test',
    );
    this.render(0);
    return this.loadModels();
  }

  private buildStreet(): void {
    this.box([52, 0.3, 166], [-47.5, -0.15, 36], 'asphalt');
    const length = SPACING * COUNT + 4;
    this.box([6, 0.3, length], [0, -0.15, 0], 'asphalt');
    // Plac portu za prawą pierzeją: mokry asfalt do krawędzi nabrzeża i ciemna woda za nią.
    this.box(
      [YARD.x1 - YARD.x0, 0.3, YARD.half * 2],
      [(YARD.x0 + YARD.x1) / 2, -0.15, 0],
      'quay_lines',
    );
    this.box([7, 0.2, YARD.half * 2], [YARD.x1 + 5.1, -1.85, 0], 'cable');
    this.buildSetGround();
    for (const side of [-1, 1]) {
      this.box([2.4, 0.3, length], [side * 4.2, -0.15, 0], 'concrete');
      this.box([0.12, 0.15, length], [side * 3.06, 0.075, 0], 'trim');
      for (let i = 0; i < COUNT; i++) {
        this.box(
          [4, 12 + (i % 3) * 2, 5.8],
          [side * (HALF_WIDTH + 2), 6 + (i % 3), START_Z + i * SPACING],
          'facade',
        );
      }
    }
  }

  private layout(): DressingLayout {
    const lights = this.solo
      ? [...this.solo.lights]
      : [...PORT_LIGHTS, ...SET_LIGHTS];
    for (let i = 0; !this.solo && i < 8; i++) {
      lights.push({
        position: { x: (i % 2 ? 1 : -1) * 3.4, y: 4, z: -19 + i * 5.4 },
        color: LIGHT_COLORS[i % LIGHT_COLORS.length] ?? '#fff1d6',
        intensity: 48,
        range: 12,
      });
    }
    const f = this.focus;
    if (f) {
      const isExhibit = f.mount === 'exhibit';
      const x = f.mount === 'span' ? 0 : f.side * (isExhibit ? f.dist : 3);
      const y = f.mount === 'span' ? f.y - 1 : isExhibit ? 6 : 2.4;
      lights.push(
        {
          position: { x, y, z: f.z + 2.5 },
          color: '#fff1d6',
          intensity: 26,
          range: isExhibit ? 22 : 9,
        },
        {
          position: { x, y, z: f.z - 2.5 },
          color: '#3d7bff',
          intensity: 22,
          range: isExhibit ? 22 : 9,
        },
      );
    }
    const p = this.portFocus;
    if (p) {
      const yaw = p.yaw + this.cameraYawDeg() * (Math.PI / 180);
      lights.push(
        portLight(
          p.x + Math.sin(yaw) * 6,
          p.y + 5,
          p.z + Math.cos(yaw) * 6,
          '#fff1d6',
          40,
          14,
        ),
      );
    }
    return { lights };
  }

  private async loadModels(): Promise<void> {
    const placed = new Map<Slot, Object3D>();
    const placedPort = new Map<PortSlot, Object3D>();
    // Zbliżenie modelu zestawu ładuje tylko ten model (sąsiednie bryły nie zasłaniają kadru).
    const freestanding = this.solo
      ? this.portFocus
        ? [this.portFocus]
        : this.solo.slots
      : [...portSlots, ...setSlots];
    await Promise.all([
      ...(this.solo ? [] : slots).map(async (s) => {
        const model = await cloneCityModel(s.model);
        if (!model || this.disposed) return;
        model.name = s.model;
        model.position.set(s.mount === 'span' ? 0 : s.side * s.dist, s.y, s.z);
        model.rotation.y = slotYaw(s);
        this.root.add(model);
        placed.set(s, model);
      }),
      ...freestanding.map(async (s) => {
        const model = await cloneCityModel(s.model);
        if (!model || this.disposed) return;
        model.name = s.model;
        model.position.set(s.x, s.y, s.z);
        model.rotation.y = s.yaw;
        this.root.add(model);
        placedPort.set(s, model);
      }),
    ]);
    if (this.disposed) return;
    if (this.focus) this.frameProp(placed.get(this.focus), slotYaw(this.focus));
    else if (this.portFocus)
      this.frameProp(placedPort.get(this.portFocus), this.portFocus.yaw);
    if (typeof document !== 'undefined')
      document.body.dataset.cityPropsReady = '1';
  }

  private cameraYawDeg(): number {
    const parsed = Number(this.params.get('yaw') ?? DEFAULT_YAW_DEG);
    return Number.isFinite(parsed) ? parsed : DEFAULT_YAW_DEG;
  }

  /** Kamera 3/4 wokół modelu: `modelYaw` to jego obrót, parametr `yaw` dodaje kąt w stopniach. */
  private frameProp(model: Object3D | undefined, modelYaw: number): void {
    const camera = this.ctx?.camera;
    if (!model || !camera) return;
    model.updateMatrixWorld(true);
    const box = new Box3().setFromObject(model);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const yaw = modelYaw + this.cameraYawDeg() * (Math.PI / 180);
    const tan = Math.tan((camera.fov * Math.PI) / 360);
    const horizontal = Math.max(size.x, size.z);
    const need = Math.max(
      size.y / FILL_RATIO,
      horizontal / (FILL_RATIO * Math.max(camera.aspect, 0.5)),
    );
    const dist = need / (2 * tan) + horizontal / 2;
    const dir = new Vector3(Math.sin(yaw), PROP_ELEVATION, Math.cos(yaw));
    this.cameraTarget.copy(center);
    this.cameraPos.copy(center).addScaledVector(dir.normalize(), dist);
    this.cameraPos.y = Math.max(this.cameraPos.y, 0.4);
    this.hasPropCamera = true;
  }

  /** Podłoże placu zestawu: keja, woda, plac zajezdni z otworem na obrotnicę i peron. */
  private buildSetGround(): void {
    const { x, z } = SET_ORIGIN;
    this.box([150, 0.3, 50], [x + 5, -0.15, z - 15], 'quay_lines');
    this.box([150, 0.2, 70], [x + 5, -0.15, z - 75], 'cable');
    // Plac zajezdni z = 10…70 bez kwadratu 24 × 24 m pod obrotnicą (środek x = −54, z = 30).
    this.box([150, 0.3, 8], [x + 5, -0.15, z + 14], 'concrete');
    this.box([150, 0.3, 28], [x + 5, -0.15, z + 56], 'concrete');
    this.box([4, 0.3, 24], [x - 68, -0.15, z + 30], 'concrete');
    this.box([122, 0.3, 24], [x + 19, -0.15, z + 30], 'concrete');
    this.box(
      [42, PLATFORM_Y, 6.2],
      [x + 1, PLATFORM_Y / 2, z + 42.15],
      'concrete',
    );
  }

  private box(size: V3, position: V3, kind: MaterialKind): void {
    const geometry = new BoxGeometry(...size);
    this.geometries.add(geometry);
    const mesh = new Mesh(geometry, getMaterial(kind));
    mesh.position.set(...position);
    this.root.add(mesh);
  }

  step(dt = 0): void {
    this.dressing?.step(dt);
  }

  render(_alpha: number, dt = 1 / 60): void {
    syncMaterials();
    this.lights.sync();
    this.atmosphere?.sync(dt);
    const camera = this.ctx?.camera;
    if (camera) {
      if (this.hasPropCamera) {
        camera.position.copy(this.cameraPos);
        camera.lookAt(this.cameraTarget);
      } else {
        const v = REVIEW_VIEWS[this.view] ?? REVIEW_VIEWS[0]!;
        camera.position.set(...v.from);
        camera.lookAt(...v.to);
      }
      camera.updateMatrixWorld();
    }
    this.dressing?.render(dt, camera);
  }

  dispose(): void {
    this.disposed = true;
    this.dressing?.dispose();
    this.atmosphere?.dispose();
    this.root.removeFromParent();
    this.root.clear();
    for (const geometry of this.geometries) geometry.dispose();
    this.geometries.clear();
  }
}
