import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { tuning } from '../../src/core/tuning';
import {
  createNpcRouteState,
  stepNpcRoute,
  npcRadius,
  npcHeight,
  npcFocusBox,
  npcRootPosition,
  NpcRuntime,
  loadNpcTexts,
} from '../../src/world/hubNpcs';
import {
  hubNpcSchema,
  loadHubLayout,
  NPC_ANIMATIONS,
} from '../../src/world/hubSchema';
import { lifeLayout, lifeTexts } from '../fixtures/hubLife';

const walker = () => lifeLayout().npcs![0]!;
const far = { x: -8, y: 0, z: -8 };
const context = { player: far, talking: false, tuning: tuning.hub };

it('loop wraca do początku, pingpong odwraca kierunek na obu końcach', () => {
  const npc = walker(),
    route = npc.route!;
  const loop = createNpcRouteState(npc);
  stepNpcRoute(loop, route, 8, context);
  expect(loop.position).toEqual({ x: 0, y: 0, z: 0 });
  stepNpcRoute(loop, route, 1, context);
  expect(loop.position.x).toBeCloseTo(1);
  const ping = createNpcRouteState(npc);
  const pingRoute = { ...route, mode: 'pingpong' as const };
  stepNpcRoute(ping, pingRoute, 4, context);
  expect(ping.direction).toBe(-1);
  stepNpcRoute(ping, pingRoute, 1, context);
  expect(ping.position.x).toBeCloseTo(3);
  stepNpcRoute(ping, pingRoute, 3, context);
  expect(ping.position.x).toBe(0);
  expect(ping.direction).toBe(1);
});

it('postój w każdym punkcie obejmuje start i zachowuje nadmiar czasu kroku', () => {
  const npc = walker();
  npc.route!.pauseS = 1;
  const state = createNpcRouteState(npc);
  stepNpcRoute(state, npc.route!, 0.5, context);
  expect(state.position.x).toBe(0);
  expect(state.pauseLeft).toBe(0.5);
  stepNpcRoute(state, npc.route!, 5, context);
  expect(state.position.x).toBe(4);
  expect(state.pauseLeft).toBeCloseTo(0.5);
  expect(state.moving).toBe(false);
  stepNpcRoute(state, npc.route!, 1, context);
  expect(state.position.x).toBeCloseTo(3.5);
});

it('ustępuje graczowi przed sobą, ignoruje gracza z boku i z tyłu, wznawia trasę', () => {
  const npc = walker(),
    state = createNpcRouteState(npc);
  stepNpcRoute(state, npc.route!, 0.5, {
    ...context,
    player: { x: 1, y: 0, z: 0 },
  });
  expect(state.position.x).toBe(0);
  expect(state.moving).toBe(false);
  stepNpcRoute(state, npc.route!, 0.5, {
    ...context,
    player: { x: 0, y: 0, z: 1 },
  });
  expect(state.position.x).toBeCloseTo(0.5);
  stepNpcRoute(state, npc.route!, 0.5, {
    ...context,
    player: { x: 0, y: 0, z: 0 },
  });
  expect(state.position.x).toBeCloseTo(1);
});

it('rozmowa zatrzymuje trasę i obraca do gracza, po niej płynny powrót do ruchu', () => {
  const state = new NpcRuntime(walker(), tuning.hub);
  state.step(1, far, false);
  expect(state.position.x).toBe(1);
  const x = state.position.x;
  for (let i = 0; i < 60; i++) state.step(1 / 60, { x, y: 0, z: 3 }, true);
  expect(state.position.x).toBe(x);
  expect(state.route.moving).toBe(false);
  expect(state.look.bodyYaw).toBeCloseTo(0);
  state.step(1 / 60, far, false);
  expect(state.position.x).toBeGreaterThan(x);
  expect(state.look.bodyYaw).toBeLessThanOrEqual(
    tuning.hub.npcWalkTurnRadS / 60,
  );
});

it('trasa jest deterministyczna i wznawialna z JSON; render nie jest potrzebny', () => {
  const npc = walker();
  npc.route!.pauseS = 0.25;
  const a = createNpcRouteState(npc),
    b = createNpcRouteState(npc);
  for (let i = 0; i < 1000; i++) {
    const ctx = { ...context, talking: i % 100 === 0 };
    stepNpcRoute(a, npc.route!, 1 / 60, ctx);
    stepNpcRoute(b, npc.route!, 1 / 60, ctx);
  }
  expect(a).toEqual(b);
  const restored: typeof a = JSON.parse(JSON.stringify(a));
  stepNpcRoute(a, npc.route!, 1 / 60, context);
  stepNpcRoute(restored, npc.route!, 1 / 60, context);
  expect(restored).toEqual(a);
});

it('domyślne tempo, klipy postoju/ruchu, mówienie i skala modelu kolidera/focus', () => {
  const npc = walker();
  delete npc.route!.speedMS;
  const runtime = new NpcRuntime(npc, tuning.hub);
  expect(runtime.animation(false)).toBe('Idle_Loop');
  expect(runtime.animation(true)).toBe('Idle_Talking_Loop');
  runtime.step(0.1, far, false);
  expect(runtime.position.x).toBeCloseTo(tuning.hub.npcWalkSpeedMS * 0.1);
  expect(runtime.animation(false)).toBe('Walk_Loop');
  expect(npcRadius(npc)).toBeCloseTo(0.4 * 0.68);
  expect(npcHeight(npc)).toBeCloseTo(1.8 * 0.68);
  const box = npcFocusBox(npc, runtime.position);
  expect(box.size.x).toBeCloseTo(0.8 * 0.68);
  expect(box.size.y).toBeCloseTo(1.8 * 0.68);
  expect(box.position.x).toBe(runtime.position.x);
  for (const scale of [0.54, 1.16, NaN, Infinity])
    expect(hubNpcSchema.safeParse({ ...npc, scale }).success).toBe(false);
  const adult = { ...npc, scale: undefined };
  expect(npcHeight(adult)).toBe(1.8);
});

it('skaluje lokalny offset siedziska, zachowując fizyczną wysokość siedziska', () => {
  const npc = {
    ...walker(),
    route: undefined,
    animation: 'Sitting_Idle_Loop' as const,
    seat: { heightM: 0.4, offset: { x: 0.2, y: -0.4, z: 0.3 } },
  };
  expect(npcRootPosition(npc, 0)).toEqual({
    x: 0.2 * 0.68,
    y: 0.4 - 0.4 * 0.68,
    z: 0.3 * 0.68,
  });
  expect(npcHeight(npc)).toBeCloseTo(1.35 * 0.68);
  const runtime = new NpcRuntime(npc, tuning.hub);
  expect(runtime.animation(true)).toBe('Sitting_Talking_Loop');
  expect(runtime.animation(false)).toBe('Sitting_Idle_Loop');
});

it('odrzuca trasę poza podłogą, zły start, siedzenie i pustą trasę', () => {
  const layout = lifeLayout();
  layout.npcs![0]!.route!.points[1]!.x = 12;
  expect(() => loadHubLayout(layout)).toThrow(/podłog/);
  const npc = walker();
  expect(
    hubNpcSchema.safeParse({ ...npc, route: { points: [] } }).success,
  ).toBe(false);
  expect(
    hubNpcSchema.safeParse({ ...npc, position: { x: 1, z: 0 } }).success,
  ).toBe(false);
  expect(
    hubNpcSchema.safeParse({
      ...npc,
      seat: { heightM: 1, offset: { x: 0, y: 0, z: 0 } },
    }).success,
  ).toBe(false);
});

it('powtórzony punkt nie blokuje przejścia do kolejnego; trasa w jednym miejscu nie zapętla kroku', () => {
  const npc = walker();
  npc.route!.points.unshift({ ...npc.route!.points[0]! });
  const state = createNpcRouteState(npc);
  stepNpcRoute(state, npc.route!, 1, context);
  expect(state.position.x).toBeCloseTo(1);
  npc.route!.points = [
    { x: 0, z: 0 },
    { x: 0, z: 0 },
  ];
  const still = createNpcRouteState(npc);
  stepNpcRoute(still, npc.route!, 1, context);
  expect(still.position.x).toBe(0);
  expect(still.moving).toBe(false);
});

it('próbkuje środek odcinka, uwzględnia promień i statycznych NPC', () => {
  const blocked = lifeLayout();
  blocked.blocks.push({
    position: { x: 2, y: 1, z: 0 },
    size: { x: 0.2, y: 2, z: 1 },
  });
  expect(() => loadHubLayout(blocked)).toThrow(/blok/);
  const nearBlock = lifeLayout();
  nearBlock.blocks.push({
    position: { x: 2, y: 1, z: 0.35 },
    size: { x: 0.2, y: 2, z: 0.2 },
  });
  expect(() => loadHubLayout(nearBlock)).toThrow(/kolidera/);
  const shelf = lifeLayout();
  shelf.blocks.push({
    position: { x: 2, y: 1, z: 0 },
    size: { x: 0.2, y: 0.2, z: 1 },
  });
  expect(() => loadHubLayout(shelf)).toThrow(/blok/);
  shelf.blocks[1]!.position.y = 3;
  expect(() => loadHubLayout(shelf)).not.toThrow();
  const nearNpc = lifeLayout();
  nearNpc.npcs![1]!.position = { x: 2, z: 0.8 };
  expect(() => loadHubLayout(nearNpc)).toThrow(/statycznego NPC/);
  const edge = lifeLayout();
  edge.npcs![0]!.route!.points[1]!.x = 9.9;
  expect(() => loadHubLayout(edge)).toThrow(/zapasu/);
});

it('loop sprawdza także ostatni→pierwszy odcinek, pingpong go pomija', () => {
  const layout = lifeLayout();
  layout.npcs![0]!.route!.points = [
    { x: 0, z: 0 },
    { x: 4, z: 0 },
    { x: 4, z: 4 },
  ];
  layout.blocks.push({
    position: { x: 2, y: 1, z: 2 },
    size: { x: 0.2, y: 2, z: 0.2 },
  });
  expect(() => loadHubLayout(layout)).toThrow(/blok/);
  layout.npcs![0]!.route!.mode = 'pingpong';
  expect(() => loadHubLayout(layout)).not.toThrow();
});

it('waliduje uczestników, mówców i unikalność rozmów względem układu', () => {
  const texts = lifeTexts(),
    layout = lifeLayout();
  texts.conversations![0]!.lines[0]!.npc = 'unknown';
  expect(() => loadNpcTexts(texts, layout.npcs)).toThrow(/uczestników/);
  const unknown = lifeTexts();
  unknown.conversations![0]!.npcs.push('unknown');
  expect(() => loadNpcTexts(unknown, layout.npcs)).toThrow(/Nieznany NPC/);
  const duplicates = lifeTexts();
  duplicates.conversations!.push(duplicates.conversations![0]!);
  expect(() => loadNpcTexts(duplicates, layout.npcs)).toThrow(/Powtórzona/);
});

it('GLB zawiera wszystkie 17 klipów, korzeń chodu i truchtu ma zerowe X/Z', () => {
  const bytes = readFileSync('public/assets/models/npc_anims.glb');
  const length = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + length).toString()) as {
    animations: {
      name: string;
      channels: { sampler: number; target: { node: number; path: string } }[];
      samplers: { output: number }[];
    }[];
    nodes: { name?: string }[];
    accessors: { bufferView: number; byteOffset?: number; count: number }[];
    bufferViews: { byteOffset: number }[];
  };
  expect(json.animations.map((a) => a.name)).toEqual([...NPC_ANIMATIONS]);
  for (const name of ['Walk_Loop', 'Jog_Fwd_Loop']) {
    const clip = json.animations.find((a) => a.name === name)!;
    const channel = clip.channels.find(
      (c) =>
        json.nodes[c.target.node]!.name === 'root' &&
        c.target.path === 'translation',
    )!;
    const accessor = json.accessors[clip.samplers[channel.sampler]!.output]!;
    const start =
      28 +
      length +
      json.bufferViews[accessor.bufferView]!.byteOffset +
      (accessor.byteOffset ?? 0);
    for (let i = 0; i < accessor.count; i++) {
      expect(bytes.readFloatLE(start + i * 12)).toBe(0);
      expect(bytes.readFloatLE(start + i * 12 + 8)).toBe(0);
    }
  }
});

it('strefa kontaktu: NPC czeka, gdy w następnym kroku wszedłby w gracza obok trasy; gracz za plecami nie blokuje', () => {
  const npc = walker(),
    route = npc.route!;
  const contactRadiusM = npcRadius(npc) + tuning.player.capsuleRadius;
  const ctx = { ...context, contactRadiusM };
  const beside = { x: 0.39, y: 0, z: 0.7 };
  const state = createNpcRouteState(npc);
  for (let i = 0; i < 180; i++)
    stepNpcRoute(state, route, 1 / 60, { ...ctx, player: beside });
  expect(state.position.x).toBeLessThan(0.1);
  expect(state.moving).toBe(false);
  stepNpcRoute(state, route, 1, { ...ctx, player: far });
  expect(state.position.x).toBeGreaterThan(0.9);
  const behind = createNpcRouteState(npc);
  stepNpcRoute(behind, route, 0.5, { ...ctx, player: { x: -0.5, y: 0, z: 0 } });
  expect(behind.position.x).toBeCloseTo(0.5);
});
