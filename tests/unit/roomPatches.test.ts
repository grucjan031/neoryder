import { afterEach, expect, it } from 'vitest';
import { Scene as ThreeScene } from 'three';
import { EventBus } from '../../src/core/events';
import type { EntityId } from '../../src/core/events';
import type { InputSnapshot } from '../../src/core/input';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import type { DefinitionPatch } from '../../src/core/metaTypes';
import { Rng } from '../../src/core/rng';
import type { RunState } from '../../src/core/runTypes';
import { tuning } from '../../src/core/tuning';
import { powerDefinitions } from '../../src/combat/powers/registry';
import { loadoutDefinitions } from '../../src/progression/loadout';
import type { Loadout } from '../../src/progression/loadout';
import { RoomScene } from '../../src/scenes/roomScene';
import { CommandRegistry } from '../../src/ui/debugCommands';
import { roomDefinitions } from '../../src/world/rooms';
import { loadWaves } from '../../src/world/waves';
import wavesData from '../../src/data/waves/roomTest.json';

const idle: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};
const pressPower: InputSnapshot = {
  ...idle,
  held: new Set(['power']),
  pressed: new Set(['power']),
};
const active = new Set<RoomScene>();

function runState(): RunState {
  return {
    seed: 'room-patches',
    sectorId: 'test',
    loadoutId: 'resonance',
    loadout: loadoutDefinitions.get('resonance')!,
    talents: [],
    threatLevel: 0,
    startedAtMs: 0,
    elapsedS: 0,
    map: {
      sectorId: 'test',
      layers: [[{ id: 'node', layer: 2, index: 0, type: 'combat', next: [] }]],
    },
    currentNodeId: 'node',
    visited: [],
    hp: 100,
    energy: 100,
    credits: 0,
    implants: [],
    stats: { kills: 0, damage: { melee: 0, power: 0, gun: 0, other: 0 } },
  };
}

async function setup(patches: readonly DefinitionPatch[], loadout?: Loadout) {
  const run = runState();
  if (loadout) run.loadout = loadout;
  const room = roomDefinitions.get('combatYard')!;
  const waves = loadWaves({
    ...wavesData,
    maxAlive: 8,
    spawnPoints: room.spawnPoints,
  });
  const scene = new RoomScene(room, run, waves, { loadModels: false, patches });
  const bus = new EventBus();
  const commands = new CommandRegistry();
  await scene.init(
    {
      bus,
      commands,
      rng: new Rng(run.seed).fork('room:node'),
      loop: new GameLoop({ step() {}, render() {} }),
      tuning: structuredClone(tuning),
      debug: false,
    },
    new ThreeScene(),
  );
  active.add(scene);
  return { scene, bus, commands };
}

/** Liczba różnych wrogów trafionych jednym użyciem Błyskawicy. */
async function chainTargets(
  patches: readonly DefinitionPatch[],
): Promise<number> {
  const { scene, bus, commands } = await setup(patches);
  const hit = new Set<EntityId>();
  bus.on('damage_dealt', (event) => {
    if (event.tags.includes('#elektrycznosc')) hit.add(event.target);
  });
  commands.execute('spawn assaulter 6');
  scene.step(SIM_DT, pressPower);
  return hit.size;
}

afterEach(() => {
  for (const scene of active) scene.dispose();
  active.clear();
});

it('pistolet z modułem incendiary nakłada burning w pokoju przez rzeczywiste trafienie pocisku', async () => {
  const { scene, bus, commands } = await setup([], {
    ...loadoutDefinitions.get('classic')!,
    weapons: ['pistol'],
    startHeld: 'gun',
    modules: { pistol: ['incendiary'] },
  });
  const applied: { status: string; target: number }[] = [];
  bus.on('status_applied', (event) => applied.push(event));
  commands.execute('spawn assaulter 1');
  scene.step(SIM_DT, {
    ...idle,
    held: new Set(['attack']),
    pressed: new Set(['attack']),
  });
  for (let i = 0; i < 30 && applied.length === 0; i++) scene.step(SIM_DT, idle);
  expect(applied).toEqual([expect.objectContaining({ status: 'burning' })]);
  expect(scene.query('resolvedLoadout')).toMatchObject({
    weapons: [{ id: 'pistol', statuses: [{ id: 'burning', durationS: 3 }] }],
  });
});

it('łatka power:chain add jumps 1 trafia o jeden cel więcej', async () => {
  const base = await chainTargets([]);
  const patched = await chainTargets([
    { target: 'power:chain', op: 'add', path: 'jumps', value: 1 },
  ]);
  expect(base).toBe(4);
  expect(patched).toBe(base + 1);
});

it('query resolvedLoadout zwraca użyte definicje, a mapy globalne zostają nietknięte', async () => {
  const original = structuredClone(powerDefinitions.get('chain'));
  const { scene } = await setup([
    { target: 'power:chain', op: 'add', path: 'jumps', value: 2 },
  ]);
  const resolved = scene.query('resolvedLoadout') as {
    powers: { id: string; jumps?: number }[];
    blade: { id: string };
  };
  expect(resolved.blade.id).toBe('plasmaBlade');
  expect(resolved.powers.find((power) => power.id === 'chain')?.jumps).toBe(5);
  expect(powerDefinitions.get('chain')).toEqual(original);
});

it('bez łatek query resolvedLoadout odpowiada definicjom z map', async () => {
  const { scene } = await setup([]);
  const resolved = scene.query('resolvedLoadout') as { powers: unknown[] };
  expect(resolved.powers).toEqual(
    loadoutDefinitions
      .get('resonance')!
      .powers.map((id) => powerDefinitions.get(id)),
  );
});

it('błędna łatka na przedmiot z ekwipunku przerywa budowę pokoju', () => {
  const room = roomDefinitions.get('combatYard')!;
  const waves = loadWaves({ ...wavesData, spawnPoints: room.spawnPoints });
  expect(
    () =>
      new RoomScene(room, runState(), waves, {
        loadModels: false,
        patches: [{ target: 'power:chain', op: 'add', path: 'nope', value: 1 }],
      }),
  ).toThrow('nieznana ścieżka');
});
