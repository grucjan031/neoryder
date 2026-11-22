import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import data from '../../src/data/missions/m01-maszty.json';
import listData from '../../src/data/missions/m03-list-przewozowy.json';
import { loadWaves } from '../../src/world/waves';
import { enemyDefinitions } from '../../src/enemies/registry';
import {
  dialogueLineSchema,
  loadMission,
  missionSchema,
} from '../../src/world/missionSchema';
import { missionDefinitions } from '../../src/world/missions';
import { roomDefinitions } from '../../src/world/rooms';

describe('Dane misji', () => {
  it('M03 ma 7 warstw, właściwe osłony, dozwolone pokoje i komplet fal', () => {
    const mission = loadMission(listData, roomDefinitions);
    expect(mission.requires).toEqual(['m01-maszty']);
    expect(mission.layers).toBe(7);
    expect(
      mission.fixedNodes.map((n) => [n.layer, n.roomId, n.final ?? false]),
    ).toEqual([
      [3, 'combatLaserYard', false],
      [6, 'combatWarehouse', false],
      [7, 'combatWarehouse', true],
    ]);
    expect(
      mission.fixedNodes[0]!.guards?.map((g) => [g.enemy, g.count]),
    ).toEqual([
      ['shielder', 1],
      ['drone', 2],
    ]);
    expect(
      mission.fixedNodes[1]!.guards?.filter((g) => g.enemy === 'turret').reduce(
        (sum, g) => sum + g.count,
        0,
      ),
    ).toBe(2);
    const terminal = mission.objectives.find((o) => o.kind === 'defend')!;
    expect(terminal.waves?.map((w) => w.atProgress)).toEqual([
      0.25, 0.55, 0.85,
    ]);
    for (const wave of terminal.waves ?? []) {
      const definition = loadWaves(
        JSON.parse(
          readFileSync(
            new URL(`../../src/data/waves/${wave.wave}.json`, import.meta.url),
            'utf8',
          ),
        ),
      );
      for (const group of definition.waves.flatMap((w) => w.groups)) {
        expect(mission.enemies).toContain(group.enemy);
        expect(enemyDefinitions.has(group.enemy)).toBe(true);
      }
    }
    expect(mission.rewards.firstClear).toEqual({ data: 95, cores: 1 });
    expect(mission.splashAct).toBe(1);
  });
  it.each([-1, 0, 1.01, Infinity])(
    'odrzuca nieprawidłowy próg fali %s',
    (atProgress) => {
      const data = structuredClone(listData);
      data.objectives[0]!.waves![0]!.atProgress = atProgress;
      expect(missionSchema.safeParse(data).success).toBe(false);
    },
  );
  it.each([
    'objective:terminal:progress:101',
    'objective:terminal:progress:-1',
    'objective:terminal:progress:0.5',
  ])('odrzuca nieprawidłowy wyzwalacz %s', (trigger) => {
    expect(
      missionSchema.safeParse({
        ...listData,
        radio: [{ trigger, lines: listData.briefing }],
      }).success,
    ).toBe(false);
  });
  it.each([
    'enterSection:targ',
    'encounter:patrol-wejscie:started',
    'encounter:patrol-wejscie:done',
    'checkpoint:po-maszcie-1',
  ])('akceptuje wyzwalacz poziomu liniowego %s', (trigger) => {
    for (const priority of [undefined, 'tactical', 'story'])
      expect(
        missionSchema.safeParse({
          ...data,
          radio: [
            {
              trigger,
              ...(priority ? { priority } : {}),
              lines: data.briefing,
            },
          ],
        }).success,
      ).toBe(true);
  });
  it.each([
    'enterSection:',
    'enterSection:targ:extra',
    'enterSection:nocny targ',
    'encounter:patrol-wejscie',
    'encounter:patrol-wejscie:cleared',
    'encounter::done',
    'checkpoint:',
    'checkpoint:start:done',
    'section:targ',
  ])('odrzuca błędny wyzwalacz poziomu liniowego %s', (trigger) => {
    expect(
      missionSchema.safeParse({
        ...data,
        radio: [{ trigger, lines: data.briefing }],
      }).success,
    ).toBe(false);
  });
  it('odrzuca nieznany priorytet radia', () => {
    expect(
      missionSchema.safeParse({
        ...data,
        radio: [
          { trigger: 'runStart', priority: 'urgent', lines: data.briefing },
        ],
      }).success,
    ).toBe(false);
  });
  it('akceptuje dawne kwestie i zachowuje opcjonalny skrót radia', () => {
    const line = { speaker: 'szron', text: 'Pełna kwestia.' };
    expect(dialogueLineSchema.parse(line)).toEqual(line);
    expect(dialogueLineSchema.parse({ ...line, shortText: 'Skrót.' })).toEqual({
      ...line,
      shortText: 'Skrót.',
    });
    expect(
      dialogueLineSchema.safeParse({ ...line, shortText: '' }).success,
    ).toBe(false);
  });
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
