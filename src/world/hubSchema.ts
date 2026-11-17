import { z } from 'zod';
import { HUB_STATION_IDS } from '../core/metaTypes';
import { BLOCK_MATERIALS, dressingFields } from './dressingSchema';
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
] as const;
export type NpcAnimation = (typeof NPC_ANIMATIONS)[number];

/**
 * Postać niezależna kryjówki. `rotationDeg` to kierunek patrzenia na płaszczyźnie podłogi:
 * 0 = +Z (w stronę torów), 90 = +X, 180 = −Z. Teksty rozmów: `src/data/hub/npcs.pl.json` (to samo `id`).
 */
export const hubNpcSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_]+$/),
    position: z.object({ x: finite, y: finite.optional(), z: finite }),
    rotationDeg: finite,
    animation: z.enum(NPC_ANIMATIONS).optional(),
    accent: z.enum(NPC_ACCENTS),
    /** Wysokość blatu siedziska nad position.y i lokalny offset korzenia od jego środka (metry). */
    seat: z.object({ heightM: positive, offset: vec3Schema }).optional(),
  })
  .superRefine((npc, ctx) => {
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
