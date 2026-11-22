import { missionSchema, type MissionDefinition } from './missionSchema';

const modules = import.meta.glob('../data/missions/*.json', {
  eager: true,
  import: 'default',
});
/** Surowe pliki misji; pełną walidację z pokojami robi `world/missions`. */
export const missionData: readonly unknown[] = Object.values(modules);

/**
 * Misje sprawdzone samym schematem, bez pokoi (2 MB danych): dla menu, ekranu startowego i meta-progresu.
 * Rozgrywka bierze `missionDefinitions` z `world/missions`, które sprawdza też pokoje i wymagania.
 */
export const missionCatalog: ReadonlyMap<string, MissionDefinition> = new Map(
  missionData.map((raw) => {
    const mission = missionSchema.parse(raw);
    return [mission.id, mission] as const;
  }),
);
