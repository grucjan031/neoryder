import { z } from 'zod';
import { HUB_STATION_IDS } from '../core/metaTypes';
import { dressingFields } from './dressingSchema';
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

/** Blok kryjówki: blok pokoju, opcjonalnie jasny obiekt interaktywny (materiał `interactive`, ADR 0006 pkt 2). */
export const hubBlockSchema = roomBlockSchema.extend({
  interactive: z.boolean().optional(),
});

/** Neonowy napis stacji (tekst z `label`), rysowany jako płaszczyzna `yaw` patrząca w +Z przy yaw = 0. */
export const hubStationSignSchema = z.object({
  position: vec3Schema,
  size: size2,
  yaw: finite,
  color: hexColor.optional(),
});

export const hubStationSchema = z.object({
  id: z.enum(HUB_STATION_IDS),
  /** Środek strefy na podłodze. */
  position: roomSpawnPointSchema,
  radius: positive,
  label: z.string().min(1),
  sign: hubStationSignSchema.optional(),
});
export type HubStationDef = z.infer<typeof hubStationSchema>;

/**
 * Płaszczyzna okładziny: `tiles` — kafle ściany (`/assets/textures/surfaces/<texture>.webp`,
 * powtarzane co `tileM` metrów), `screen` — świecący ekran (`/assets/textures/screens/<texture>.webp`).
 * Płaszczyzna patrzy w +Z przy yaw = 0. Kosmetyka bez collidera.
 */
export const hubPanelSchema = z.object({
  kind: z.enum(['tiles', 'screen']),
  texture: textureId,
  position: vec3Schema,
  size: size2,
  yaw: finite,
  tileM: positive.optional(),
  tint: hexColor.optional(),
});
export type HubPanelDef = z.infer<typeof hubPanelSchema>;

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
    // Środki stref przechodzą tę samą walidację co punkty spawnu pokoju: w podłodze, poza blokami, osiągalne od playerSpawn.
    validateLayout(
      {
        playerSpawn: layout.playerSpawn,
        blocks: layout.blocks,
        spawnPoints: layout.stations.map((station) => station.position),
      },
      {
        addIssue: (issue: { path?: PropertyKey[]; message?: string }) => {
          const [head, index, ...rest] = issue.path ?? [];
          ctx.addIssue({
            code: 'custom',
            message: issue.message ?? 'Nieprawidłowy układ.',
            path:
              head === 'spawnPoints' && typeof index === 'number'
                ? ['stations', index, 'position', ...rest]
                : (issue.path ?? []),
          });
        },
      } as unknown as z.RefinementCtx,
    );
  });

export type HubLayout = z.infer<typeof hubLayoutSchema>;

export function loadHubLayout(data: unknown): HubLayout {
  return hubLayoutSchema.parse(data);
}
