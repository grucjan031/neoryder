import { loadMission, type MissionDefinition } from './missionSchema';
import { missionData } from './missionCatalog';
import { roomDefinitions } from './rooms';

export function loadMissionDefinitions(
  data: readonly unknown[],
): ReadonlyMap<string, MissionDefinition> {
  const definitions = new Map<string, MissionDefinition>();
  for (const raw of data) {
    const mission = loadMission(raw, roomDefinitions);
    if (definitions.has(mission.id))
      throw new Error(`Powtórzone id misji: ${mission.id}`);
    definitions.set(mission.id, mission);
  }
  for (const mission of definitions.values())
    for (const required of mission.requires) {
      if (!definitions.has(required))
        throw new Error(`Nieznana wymagana misja: ${required}`);
    }
  return definitions;
}
export const missionDefinitions = loadMissionDefinitions(missionData);
