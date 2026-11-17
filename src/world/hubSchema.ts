import { z } from 'zod';
import { tuning } from '../core/tuning';
import { npcHeight, npcRadius } from './hubNpcs';
import { HUB_STATION_IDS } from '../core/metaTypes';
import {
  BLOCK_MATERIALS,
  dressingFields,
  flickerSchema,
} from './dressingSchema';
import {
  roomBlockSchema,
  roomSpawnPointSchema,
  validateLayout,
  vec3Schema,
} from './roomSchema';

const finite = z.number().finite();
const positive = z.number().finite().positive();
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const textureId = z.string().regex(/^[a-z0-9_]+$/);
const size2 = z.object({ w: positive, h: positive });

/** Materiały bloków kryjówki: materiały pokoju plus dodatkowe powierzchnie miejskie i świecące paski neonowe. */
export const HUB_BLOCK_MATERIALS = [
  ...BLOCK_MATERIALS,
  'wood',
  'fabric',
  'machine',
  'paint',
  'lacquer',
  'plastic',
  'rubber',
  'neon_amber',
  'neon_green',
  'neon_violet',
  'neon_blue',
  'neon_white',
] as const;

/**
 * Blok kryjówki: blok pokoju, opcjonalnie jasny obiekt interaktywny (materiał `interactive`, ADR 0006 pkt 2).
 * `yaw` (radiany, wielokrotność 90°) obraca model `city_*` wokół środka; `size` jest już w osiach świata.
 */
export const hubBlockSchema = roomBlockSchema.extend({
  material: z.enum(HUB_BLOCK_MATERIALS).optional(),
  interactive: z.boolean().optional(),
  yaw: finite.optional(),
  shape: z.literal('barrel').optional(),
});

/** Neonowy napis stacji (tekst z `label`), rysowany jako płaszczyzna `yaw` patrząca w +Z przy yaw = 0. */
export const hubStationSignSchema = z.object({
  position: vec3Schema,
  size: size2,
  yaw: finite,
  color: hexColor.optional(),
  flicker: flickerSchema.optional(),
});

/** Kosmetyczny napis układu, niezależny od stacji; wyłącznie paleta Neon Noir. */
export const hubNeonTextSchema = hubStationSignSchema.extend({
  text: z.string().trim().min(1),
  color: z.enum(['#ffae1a', '#6dff4a', '#8a5cff', '#3d7bff', '#fff1d6']),
});
export type HubNeonTextDef = z.infer<typeof hubNeonTextSchema>;

export const hubStationSchema = z.object({
  id: z.enum(HUB_STATION_IDS),
  /** Środek strefy na podłodze. */
  position: roomSpawnPointSchema,
  radius: positive,
  focus: z.object({
    position: vec3Schema,
    size: z.object({ x: positive, y: positive, z: positive }),
  }),
  label: z.string().min(1),
  sign: hubStationSignSchema.optional(),
});
export type HubStationDef = z.infer<typeof hubStationSchema>;

/**
 * Płaszczyzna okładziny: `tiles` — kafle ściany (`/assets/textures/surfaces/<texture>.webp`,
 * powtarzane co `tileM` metrów), `screen` — świecący ekran (`/assets/textures/screens/<texture>.webp`),
 * `poster` — nieprzezroczysty plakat, baner albo mural (`/assets/textures/posters/<texture>.webp`),
 * `tunnel` — malowany proceduralnie wylot tunelu metra (perspektywa w mrok, bez pliku; `texture` to tylko nazwa).
 * Płaszczyzna patrzy w +Z przy yaw = 0. Kosmetyka bez collidera.
 */
export const hubPanelSchema = z.object({
  kind: z.enum(['tiles', 'screen', 'poster', 'tunnel']),
  texture: textureId,
  position: vec3Schema,
  size: size2,
  yaw: finite,
  tileM: positive.optional(),
  tint: hexColor.optional(),
});
export type HubPanelDef = z.infer<typeof hubPanelSchema>;

/** Akcent NPC (paleta neonów z ADR 0006): słaba poświata krawędzi sylwetki. */
export const NPC_ACCENTS = [
  'amber',
  'green',
  'violet',
  'blue',
  'white',
] as const;
export type NpcAccent = (typeof NPC_ACCENTS)[number];
/** Klipy animacji NPC z `public/assets/models/npc_anims.glb` (Quaternius UAL, CC0). */
export const NPC_ANIMATIONS = [
  'Idle_Loop',
  'Idle_Talking_Loop',
  'Idle_Torch_Loop',
  'Sitting_Idle_Loop',
  'Sitting_Talking_Loop',
  'Fixing_Kneeling',
  'Crouch_Idle_Loop',
  'Interact',
  'Walk_Loop',
  'Jog_Fwd_Loop',
  'Dance_Loop',
  'PickUp_Table',
  'Punch_Jab',
  'Punch_Cross',
  'Sword_Idle',
  'Spell_Simple_Idle_Loop',
  'Push_Loop',
] as const;
export type NpcAnimation = (typeof NPC_ANIMATIONS)[number];

export const npcRouteSchema = z
  .object({
    points: z.array(roomSpawnPointSchema).min(2),
    mode: z.enum(['loop', 'pingpong']).optional(),
    speedMS: positive.optional(),
    pauseS: finite.nonnegative().optional(),
    moveAnimation: z.enum(NPC_ANIMATIONS).optional(),
    pauseAnimation: z.enum(NPC_ANIMATIONS).optional(),
  })
  .superRefine((route, ctx) => {
    for (const key of ['moveAnimation', 'pauseAnimation'] as const)
      if (route[key]?.startsWith('Sitting'))
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'Trasa nie może używać animacji siedzącej.',
        });
  });
export type NpcRoute = z.infer<typeof npcRouteSchema>;

/**
 * Postać niezależna kryjówki. `rotationDeg` to kierunek patrzenia na płaszczyźnie podłogi:
 * 0 = +Z (w stronę torów), 90 = +X, 180 = −Z. Teksty rozmów: `src/data/hub/npcs.pl.json` (to samo `id`).
 */
export const hubNpcSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_]+$/),
    position: z.object({ x: finite, y: finite.optional(), z: finite }),
    rotationDeg: finite,
    scale: finite.min(0.55).max(1.15).optional(),
    look: z
      .object({
        shade: z.number().int().min(0).max(9).optional(),
        headwear: z
          .enum([
            'none',
            'cap',
            'cap_stripe',
            'beanie',
            'goggles',
            'glasses',
            'headphones',
            'bandana',
            'hood',
          ])
          .optional(),
        torso: z.enum(['vest', 'apron', 'coat', 'jacket', 'none']).optional(),
        prop: z
          .enum([
            'none',
            'pouches',
            'backpack',
            'wrench',
            'satchel',
            'toolbelt',
          ])
          .optional(),
      })
      .optional(),
    route: npcRouteSchema.optional(),
    animation: z.enum(NPC_ANIMATIONS).optional(),
    accent: z.enum(NPC_ACCENTS),
    /** Wysokość blatu siedziska nad position.y i lokalny offset korzenia od jego środka (metry). */
    seat: z.object({ heightM: positive, offset: vec3Schema }).optional(),
  })
  .superRefine((npc, ctx) => {
    if (npc.route) {
      if (npc.seat || npc.animation?.startsWith('Sitting'))
        ctx.addIssue({
          code: 'custom',
          path: ['route'],
          message: 'NPC z trasą nie może siedzieć.',
        });
      const start = npc.route.points[0]!;
      if (start && (npc.position.x !== start.x || npc.position.z !== start.z))
        ctx.addIssue({
          code: 'custom',
          path: ['route', 'points', 0],
          message: 'Początek trasy musi być równy position NPC.',
        });
    }
    if (npc.animation?.startsWith('Sitting') && !npc.seat)
      ctx.addIssue({
        code: 'custom',
        path: ['seat'],
        message: 'Siedzący NPC wymaga wysokości siedziska i offsetu korzenia.',
      });
  });
export type HubNpcDef = z.infer<typeof hubNpcSchema>;

/** Płomień w beczce: skrzyżowane płaszczyzny z poświatą (czysto kosmetyczne). */
export const hubFireSchema = z.object({
  position: vec3Schema,
  size: positive.optional(),
});
export type HubFireDef = z.infer<typeof hubFireSchema>;

/** Układ kryjówki: format pokoju (bez drzwi, spawnów wrogów i walki) plus stacje. */
export const hubLayoutSchema = z
  .object({
    ...dressingFields,
    id: z.string().min(1),
    name: z.string().min(1),
    playerSpawn: vec3Schema,
    blocks: z.array(hubBlockSchema),
    stations: z.array(hubStationSchema).min(1),
    panels: z.array(hubPanelSchema).optional(),
    neonTexts: z.array(hubNeonTextSchema).optional(),
    npcs: z.array(hubNpcSchema).optional(),
    fires: z.array(hubFireSchema).optional(),
  })
  .superRefine((layout, ctx) => {
    const ids = new Set<string>();
    layout.stations.forEach((station, index) => {
      if (ids.has(station.id))
        ctx.addIssue({
          code: 'custom',
          path: ['stations', index, 'id'],
          message: `Powtórzona stacja: ${station.id}.`,
        });
      ids.add(station.id);
    });
    for (let a = 0; a < layout.stations.length; a++)
      for (let b = a + 1; b < layout.stations.length; b++) {
        const first = layout.stations[a]!;
        const second = layout.stations[b]!;
        const distance = Math.hypot(
          first.position.x - second.position.x,
          first.position.z - second.position.z,
        );
        if (distance < first.radius + second.radius)
          ctx.addIssue({
            code: 'custom',
            path: ['stations', b, 'position'],
            message: `Strefy ${first.id} i ${second.id} nachodzą na siebie.`,
          });
      }
    const npcIds = new Set<string>();
    (layout.npcs ?? []).forEach((npc, index) => {
      if (npcIds.has(npc.id))
        ctx.addIssue({
          code: 'custom',
          path: ['npcs', index, 'id'],
          message: `Powtórzony NPC: ${npc.id}.`,
        });
      npcIds.add(npc.id);
    });
    // Środki stref (i NPC stojących) przechodzą tę samą walidację co punkty spawnu pokoju: w podłodze, poza blokami, osiągalne od playerSpawn.
    validateNpcRoutes(layout, ctx);
    validateLayout(
      {
        playerSpawn: layout.playerSpawn,
        blocks: layout.blocks.map(({ size, position }) => ({ size, position })),
        spawnPoints: [
          ...layout.stations.map((station) => station.position),
          ...standingNpcs(layout).map(({ npc }) => npc.position),
        ],
      },
      {
        addIssue: (issue: { path?: PropertyKey[]; message?: string }) => {
          const [head, index, ...rest] = issue.path ?? [];
          ctx.addIssue({
            code: 'custom',
            message: issue.message ?? 'Nieprawidłowy układ.',
            path:
              head === 'spawnPoints' && typeof index === 'number'
                ? index < layout.stations.length
                  ? ['stations', index, 'position', ...rest]
                  : [
                      'npcs',
                      standingNpcs(layout)[index - layout.stations.length]!
                        .index,
                      'position',
                      ...rest,
                    ]
                : (issue.path ?? []),
          });
        },
      } as unknown as z.RefinementCtx,
    );
  });

/** NPC stojące podlegają walidacji podłogi i osiągalności; siedzący stoją na bloku (stołek). */
function standingNpcs(layout: {
  npcs?: HubNpcDef[] | undefined;
}): { npc: HubNpcDef; index: number }[] {
  return (layout.npcs ?? [])
    .map((npc, index) => ({ npc, index }))
    .filter(({ npc }) => !npc.animation?.startsWith('Sitting'));
}

export type HubLayout = z.infer<typeof hubLayoutSchema>;

export function loadHubLayout(data: unknown): HubLayout {
  return hubLayoutSchema.parse(data);
}

/** Próbki trasy sprawdzają cały zapas kolidera, także na styku sąsiednich podłóg. */
function validateNpcRoutes(layout: HubLayout, ctx: z.RefinementCtx): void {
  const ground = layout.playerSpawn.y;
  const floors = layout.blocks.filter(
    (b) => b.position.y + b.size.y / 2 === ground,
  );
  const onFloor = (x: number, z: number, radius: number): boolean => {
    const xs = [x - radius, x + radius];
    const zs = [z - radius, z + radius];
    for (const b of floors) {
      for (const edge of [
        b.position.x - b.size.x / 2,
        b.position.x + b.size.x / 2,
      ])
        if (edge > x - radius && edge < x + radius) xs.push(edge);
      for (const edge of [
        b.position.z - b.size.z / 2,
        b.position.z + b.size.z / 2,
      ])
        if (edge > z - radius && edge < z + radius) zs.push(edge);
    }
    xs.sort((a, b) => a - b);
    zs.sort((a, b) => a - b);
    for (let a = 1; a < xs.length; a++)
      for (let b = 1; b < zs.length; b++) {
        const px = (xs[a - 1]! + xs[a]!) / 2,
          pz = (zs[b - 1]! + zs[b]!) / 2;
        if (
          !floors.some(
            (f) =>
              Math.abs(px - f.position.x) <= f.size.x / 2 &&
              Math.abs(pz - f.position.z) <= f.size.z / 2,
          )
        )
          return false;
      }
    return true;
  };
  (layout.npcs ?? []).forEach((npc, index) => {
    if (!npc.route) return;
    const issue = (message: string) =>
      ctx.addIssue({
        code: 'custom',
        path: ['npcs', index, 'route'],
        message,
      });
    if ((npc.position.y ?? 0) !== ground) {
      issue('Trasa NPC musi leżeć na poziomie playerSpawn.y.');
      return;
    }
    const points = npc.route.points;
    const segments =
      npc.route.mode === 'pingpong' ? points.length - 1 : points.length;
    const radius = npcRadius(npc);
    const obstacles = layout.blocks.filter(
      (block) =>
        block.position.y - block.size.y / 2 < ground + npcHeight(npc) &&
        block.position.y + block.size.y / 2 > ground,
    );
    for (let segment = 0; segment < segments; segment++) {
      const from = points[segment]!,
        to = points[(segment + 1) % points.length]!;
      const samples = Math.ceil(
        Math.hypot(to.x - from.x, to.z - from.z) / tuning.hub.npcRouteSampleM,
      );
      for (let sample = 0; sample <= samples; sample++) {
        const t = samples === 0 ? 0 : sample / samples;
        const x = from.x + (to.x - from.x) * t,
          z = from.z + (to.z - from.z) * t;
        if (!onFloor(x, z, radius)) {
          issue('Trasa NPC poza podłogą lub bez zapasu promienia kolidera.');
          return;
        }
        if (
          obstacles.some(
            (b) =>
              Math.hypot(
                Math.max(0, Math.abs(x - b.position.x) - b.size.x / 2),
                Math.max(0, Math.abs(z - b.position.z) - b.size.z / 2),
              ) < radius,
          )
        ) {
          issue('Trasa NPC przechodzi przez blok lub zapas kolidera.');
          return;
        }
        if (
          (layout.npcs ?? []).some(
            (other) =>
              !other.route &&
              Math.hypot(x - other.position.x, z - other.position.z) <
                tuning.hub.npcRouteStaticClearanceM,
          )
        ) {
          issue(
            'Trasa NPC przechodzi zbyt blisko statycznego NPC (minimum 0,9 m).',
          );
          return;
        }
      }
    }
  });
}
