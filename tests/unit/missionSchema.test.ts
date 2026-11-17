import { describe, expect, it } from 'vitest';
import data from '../../src/data/missions/m01-maszty.json';
import { loadMission, missionSchema } from '../../src/world/missionSchema';
import { missionDefinitions } from '../../src/world/missions';
import { roomDefinitions } from '../../src/world/rooms';

describe('Dane misji', () => {
  it('wczytuje M01 z poprawnymi pokojami i osłoną', () => {
    const mission = missionDefinitions.get('m01-maszty')!;
    expect(
      mission.fixedNodes.map((node) => node.guards?.[0]?.count ?? 0),
    ).toEqual([0, 1, 1, 2]);
    expect(roomDefinitions.get('alleyUnderpass')?.type).toBe('elite');
    expect(roomDefinitions.get('alleyUnderpassMission')?.type).toBe('combat');
  });
  it('odrzuca nieznany pokój', () => {
    const mission = structuredClone(data);
    mission.fixedNodes[0]!.roomId = 'missing';
    expect(() => loadMission(mission, roomDefinitions)).toThrow('pokój');
  });
  it('odrzuca brak finału', () => {
    const mission = structuredClone(data);
    mission.fixedNodes.forEach((node) => {
      node.final = false;
    });
    expect(missionSchema.safeParse(mission).success).toBe(false);
  });
  it('odrzuca cykl zależności', () => {
    const mission = structuredClone(data);
    const exit = mission.objectives.find(
      (objective) => objective.kind === 'exit',
    )!;
    exit.unlockAfter = ['exit'];
    expect(missionSchema.safeParse(mission).success).toBe(false);
  });
  it('odrzuca pokój o niezgodnym typie', () => {
    const mission = structuredClone(data);
    mission.fixedNodes[0]!.roomId = 'alleyUnderpass';
    expect(() => loadMission(mission, roomDefinitions)).toThrow('pokój');
  });
});
