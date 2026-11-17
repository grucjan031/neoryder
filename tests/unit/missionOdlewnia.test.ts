import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { Scene } from 'three';
import { EventBus, type GameEvents } from '../../src/core/events';
import { Rng } from '../../src/core/rng';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { tuning } from '../../src/core/tuning';
import { RoomScene } from '../../src/scenes/roomScene';
import { CommandRegistry } from '../../src/ui/debugCommands';
import { missionDefinitions } from '../../src/world/missions';
import { MissionObjectives } from '../../src/world/missionObjectives';
import { loadMission, missionSchema } from '../../src/world/missionSchema';
import { roomDefinitions } from '../../src/world/rooms';
import { RunManager } from '../../src/world/run';
import { generateMissionMap } from '../../src/world/sectorMap';
import { kuroganeSector } from '../../src/world/sectors';
import data from '../../src/data/missions/m06-odlewnia.json';

const mission = missionDefinitions.get(data.id)!;
const ids = ['brandt', 'server', 'exit'];
const idle = {
  held: new Set<never>(),
  pressed: new Set<never>(),
  released: new Set<never>(),
  lookDelta: { x: 0, y: 0 },
};

it('M06: kontrakt danych, osłony, pokoje i wymuszone warstwy dla różnych seedów', () => {
  expect(loadMission(data, roomDefinitions)).toEqual(mission);
  expect(mission.requires).toEqual(['m03-list-przewozowy']);
  expect(mission.splashAct).toBe(2);
  expect(mission.rewards.firstClear).toEqual({ data: 150, cores: 3 });
  expect(mission.fixedNodes.map((n) => [n.layer, n.type, n.roomId])).toEqual([
    [1, 'combat', 'combatCorridor'],
    [3, 'elite', 'eliteFoundry'],
    [6, 'elite', 'eliteHall'],
    [7, 'boss', 'bossRoom'],
  ]);
  expect(mission.fixedNodes[2]!.guards?.map((g) => g.enemy)).toEqual([
    'executor',
    'shielder',
    'sniper',
  ]);
  for (let seed = 0; seed < 20; seed++) {
    const map = generateMissionMap(mission, kuroganeSector, String(seed));
    expect(map.layers).toHaveLength(7);
    for (const fixed of mission.fixedNodes) {
      expect(map.layers[fixed.layer - 1]).toHaveLength(1);
      const node = map.layers[fixed.layer - 1]![0]!;
      expect(node.fixed?.roomId).toBe(fixed.roomId);
      for (const before of map.layers[fixed.layer - 2] ?? [])
        expect(before.next).toEqual([node.id]);
    }
  }
});

it.each([
  ['Odprawa (kryjówka)', data.briefing.slice(1)],
  ['W trakcie misji (radio i hala bossa)', data.radio.flatMap((r) => r.lines)],
  ['Po misji (kryjówka)', data.debrief],
] as const)(
  'M06 zachowuje kompletne, dosłowne dialogi: %s',
  (heading, lines) => {
    const source = readFileSync(
      new URL('../../docs/fabula/misje/misja-06-odlewnia.md', import.meta.url),
      'utf8',
    );
    const section = source
      .split(/^## Dialogi\r?$/m)[1]!
      .split(/^## /m)[0]!
      .split(/^### /m)
      .find((part) => part.split(/\r?\n/)[0] === heading)!;
    const expected = section.split(/\r?\n/).flatMap((line) => {
      const match = line.match(
        /^\*\*(\p{L}+)(?: \*\([^\n]+?\)\*)?:\*\* (.+)$/u,
      );
      return match
        ? [{ speaker: match[1]!.toLowerCase(), text: match[2]! }]
        : [];
    });
    expect(expected.length).toBeGreaterThan(0);
    expect(lines).toEqual(expected);
  },
);

it('D3 jest osobną pierwszą kwestią Szrona', () => {
  expect(data.briefing[0]).toEqual({
    speaker: 'szron',
    text: 'Karta Wirskiej już jest. Kontakt Nadii zdjął ją z konwoju, zanim Brandt zamknął Huty.',
  });
});

it.each(['boss:phase:1', 'boss:phase:4', 'boss:phase:2:extra', 'boss:death'])(
  'schemat odrzuca niezatwierdzony wyzwalacz %s',
  (trigger) => {
    expect(
      missionSchema.safeParse({
        ...data,
        radio: [{ trigger, lines: data.briefing }],
      }).success,
    ).toBe(false);
  },
);

it('interact sprawdza zależności i cykle tak jak exit', () => {
  for (const dependency of ['server', 'missing', 'exit']) {
    const invalid = structuredClone(data);
    invalid.objectives[1]!.unlockAfter = [dependency];
    expect(missionSchema.safeParse(invalid).success).toBe(false);
  }
});

it('serwer wymaga śmierci bossa i 3 s w strefie, winda serwera i 2 s; odejście zachowuje postęp', () => {
  const signal = vi.fn();
  const model = new MissionObjectives(
    mission,
    ids,
    {},
    { signal, explode() {} },
    1.6,
    1,
  );
  const server = { x: 0, y: 0, z: -12 };
  const exit = { x: -11, y: 0, z: -11 };
  model.step(10, server);
  expect(model.progress.server).toBeUndefined();
  expect(model.done('server')).toBe(false);
  expect(model.done('exit')).toBe(false);
  model.done('brandt');
  model.step(1, server);
  expect(model.progress.server).toBeCloseTo(1 / 3);
  model.step(10, exit);
  expect(model.progress.server).toBeCloseTo(1 / 3);
  expect(model.progress.exit).toBeUndefined();
  model.step(2, server);
  expect(model.objectives.server).toBe('done');
  expect(model.complete).toBe(false);
  model.step(1, exit);
  expect(model.complete).toBe(false);
  model.step(1, exit);
  expect(model.complete).toBe(true);
  expect(signal.mock.calls.map(([trigger]) => trigger)).toEqual([
    'objective:brandt:done',
    'objective:server:started',
    'objective:server:done',
    'objective:exit:started',
    'objective:exit:done',
    'objectivesDone',
  ]);
});

it.each([true, false])(
  'pokój i RunManager: misja=%s, śmierć bossa, rozpad, cele i zwycięstwo',
  async (isMission) => {
    const bus = new EventBus();
    const run = new RunManager(bus, {
      generateMap: () => ({
        sectorId: 'kurogane',
        layers: [
          [
            {
              id: 'boss',
              layer: 7,
              index: 0,
              type: 'boss',
              next: [],
              ...(isMission
                ? {
                    fixed: { roomId: 'bossRoom', objectives: ids, final: true },
                  }
                : {}),
            },
          ],
        ],
      }),
    });
    run.newRun('foundry-test', 'classic', isMission ? { mission } : {});
    run.selectNode('boss');
    const signal = vi.fn();
    const scene = new RoomScene(
      roomDefinitions.get('bossRoom')!,
      run.state,
      {
        id: 'boss',
        firstBreakS: 0,
        breakS: 0,
        maxAlive: 8,
        minSpawnDistance: 0,
        spawnPoints: [],
        waves: [],
      },
      { loadModels: false, missionSignal: signal },
    );
    const commands = new CommandRegistry();
    const killed: GameEvents['enemy_killed'][] = [];
    bus.on('enemy_killed', (event) => killed.push(event));
    const cleared = vi.fn(() => {
      const state = scene.missionState();
      if (state.objectives)
        run.updateObjectives(state.objectives, state.objectiveProgress ?? {});
      run.completeRoom();
    });
    bus.on('room_cleared', cleared);
    const steps = (n: number) => {
      for (let i = 0; i < n; i++) scene.step(SIM_DT, idle);
    };
    try {
      await scene.init(
        {
          bus,
          commands,
          rng: new Rng('foundry-test'),
          loop: new GameLoop({ step() {}, render() {} }),
          tuning: structuredClone(tuning),
          debug: false,
        },
        new Scene(),
      );
      commands.execute('god');
      if (isMission) {
        scene.clear();
        expect(scene.query('boss')).toMatchObject({ hp: 900 });
        expect(run.completeRoom()).toBe(false);
      }
      commands.execute('kill all');
      expect(scene.query('boss')).toMatchObject({ phase: 2 });
      steps(75);
      commands.execute('kill all');
      expect(scene.query('boss')).toMatchObject({ phase: 3 });
      steps(75);
      // Sługi wezwane przez bossa i dodatkowa osłona muszą umrzeć od świata.
      expect(commands.execute('boss pattern summon')).toContain('summon');
      steps(100);
      expect(scene.query('boss')).toMatchObject({
        minions: expect.any(Number),
      });
      expect(
        (scene.query('boss') as { minions: number }).minions,
      ).toBeGreaterThan(0);
      commands.execute('spawn shielder 1');
      const enemies = scene.query('enemies') as number;
      const before = run.state.stats.kills;
      commands.execute('kill all');
      expect(scene.query('enemies')).toBe(0);
      if (isMission) {
        expect(run.state.stats.kills).toBe(before + 1);
        expect(scene.query('kills')).toBe(1);
        expect(killed.filter((e) => e.killer === null)).toHaveLength(
          enemies - 1,
        );
        expect(killed.some((e) => e.tags.includes('#victory_hold'))).toBe(true);
        expect(cleared).not.toHaveBeenCalled();
        expect(run.screen).toBe('room');
        expect(run.summary).toBeNull();
        expect(scene.missionState().objectives).toMatchObject({
          brandt: 'done',
        });
        expect(commands.execute('objective done exit')).toBe(
          'Cel niedostępny.',
        );
        expect(
          signal.mock.calls
            .map(([s]) => s)
            .filter((s: string) => s.startsWith('boss:')),
        ).toEqual(['boss:phase:2', 'boss:phase:3', 'boss:defeated']);
        commands.execute('objective done server');
        expect(run.screen).toBe('room');
        commands.execute('objective done exit');
      }
      expect(cleared).toHaveBeenCalledOnce();
      expect(run.screen).toBe('summary');
      expect(run.summary).toMatchObject({
        outcome: 'victory',
        ...(isMission ? { missionCompleted: true, missionId: mission.id } : {}),
      });
    } finally {
      scene.dispose();
      run.dispose();
    }
  },
);
