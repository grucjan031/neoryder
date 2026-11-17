import { expect, it } from 'vitest';
import hideoutData from '../../src/data/hub/hideout.json';
import npcTexts from '../../src/data/hub/npcs.pl.json';
import { tuning } from '../../src/core/tuning';
import {
  NPC_RADIUS_M,
  NPC_SEATED_HEIGHT_M,
  NPC_STANDING_HEIGHT_M,
  NpcDialogue,
  loadNpcTexts,
  npcFocusBox,
  updateNpcLook,
  wrapAngle,
} from '../../src/world/hubNpcs';
import type { NpcLookParams } from '../../src/world/hubNpcs';
import { loadHubLayout } from '../../src/world/hubSchema';
import { selectHubTarget } from '../../src/world/hubStations';

const layout = loadHubLayout(hideoutData);
const texts = loadNpcTexts(npcTexts, layout.npcs);

it('teksty NPC są poprawne i obejmują każdego NPC z układu (po jednej lub więcej kwestii)', () => {
  expect(texts.npcs.map(({ id }) => id).sort()).toEqual(
    layout.npcs!.map(({ id }) => id).sort(),
  );
  expect(texts.talkPrompt.length).toBeGreaterThan(0);
  for (const npc of layout.npcs ?? []) {
    const entry = texts.npcs.find(({ id }) => id === npc.id);
    expect(entry, npc.id).toBeDefined();
    expect(entry!.name.length).toBeGreaterThan(0);
    expect(entry!.role.length).toBeGreaterThan(0);
    expect(entry!.lines.length).toBeGreaterThanOrEqual(1);
  }
});

it('rozmowy wskazują istniejących uczestników i mówców', () => {
  expect(texts.conversations!.length).toBeGreaterThanOrEqual(16);
  const ids = new Set(layout.npcs!.map(({ id }) => id));
  for (const conversation of texts.conversations!) {
    for (const id of conversation.npcs) expect(ids.has(id), id).toBe(true);
    for (const line of conversation.lines)
      expect(ids.has(line.npc), line.npc).toBe(true);
  }
});

it('schemat tekstów odrzuca NPC bez kwestii i pusty prompt', () => {
  expect(() =>
    loadNpcTexts({
      talkPrompt: 'x',
      npcs: [{ id: 'a', name: 'A', role: 'R', lines: [] }],
    }),
  ).toThrow();
  expect(() => loadNpcTexts({ talkPrompt: '', npcs: [] })).toThrow();
});

it('schemat zachowuje reakcje dziesięciu mieszkańców bez zmiany tekstów', () => {
  const residents = [
    'szron',
    'mira',
    'wolan',
    'bajt',
    'tomasz',
    'hela',
    'witek',
    'zofia',
    'rudy',
    'ola',
  ];
  for (const id of residents) {
    const npc = texts.npcs.find((entry) => entry.id === id)!;
    const original = npcTexts.npcs.find((entry) => entry.id === id)!;
    expect(npc.reactions).toEqual(original.reactions);
    for (const kind of ['firstVisit', 'victory', 'death'] as const)
      expect(npc.reactions?.[kind]?.length).toBeGreaterThan(0);
  }
});

it.each([{ lines: [] }, { lines: [''] }, { lines: ['   '] }])(
  'schemat odrzuca pustą listę lub tekst reakcji: $lines',
  ({ lines }) => {
    for (const kind of ['firstVisit', 'victory', 'death'])
      expect(() =>
        loadNpcTexts({
          talkPrompt: 'x',
          npcs: [
            {
              id: 'a',
              name: 'A',
              role: 'R',
              lines: ['x'],
              reactions: { [kind]: lines },
            },
          ],
        }),
      ).toThrow();
  },
);

it('kwestie idą po kolei w pętli, osobno dla każdego NPC', () => {
  const dialogue = new NpcDialogue([
    { id: 'a', name: 'A', role: 'R', lines: ['1', '2', '3'] },
    { id: 'b', name: 'B', role: 'R', lines: ['x'] },
  ]);
  const lines = Array.from({ length: 7 }, () => dialogue.talk('a')!.line);
  expect(lines).toEqual(['1', '2', '3', '1', '2', '3', '1']);
  expect(dialogue.talk('b')!.line).toBe('x');
  expect(dialogue.talk('b')!.line).toBe('x');
  expect(dialogue.talk('a')!.line).toBe('2');
  expect(dialogue.talk('nikt')).toBeNull();
  expect(dialogue.has('a')).toBe(true);
  expect(dialogue.has('nikt')).toBe(false);
  expect(dialogue.talk('a')).toMatchObject({ id: 'a', name: 'A', role: 'R' });
});

it('focus NPC wynika z kolidera: stojący 1,8 m, siedzący niższy, szerokość to średnica', () => {
  const standing = layout.npcs!.find((npc) => npc.animation === 'Idle_Loop')!;
  const seated = layout.npcs!.find((npc) =>
    npc.animation?.startsWith('Sitting'),
  )!;
  const stand = npcFocusBox(standing);
  expect(stand.size).toEqual({
    x: NPC_RADIUS_M * 2,
    y: NPC_STANDING_HEIGHT_M,
    z: NPC_RADIUS_M * 2,
  });
  expect(stand.position.y).toBeCloseTo(NPC_STANDING_HEIGHT_M / 2);
  expect(stand.position.x).toBe(standing.position.x);
  const sit = npcFocusBox(seated);
  expect(sit.size.y).toBe(NPC_SEATED_HEIGHT_M);
  expect(sit.position.y).toBeCloseTo(NPC_SEATED_HEIGHT_M / 2);
});

it('selectHubTarget wybiera najbliższy cel: NPC przed stacją, stacja przed odległym NPC, poza zasięgiem null', () => {
  const eye = { x: 0, y: 1.65, z: 0 };
  const stationZone = {
    id: 'missions' as const,
    position: { x: 0, z: -5 },
    radius: 1,
    focus: {
      position: { x: 0, y: 1.2, z: -5 },
      size: { x: 3, y: 2.4, z: 0.3 },
    },
  };
  const npc = {
    id: 'mira',
    focus: {
      position: { x: 0, y: 0.9, z: -2 },
      size: { x: 0.8, y: 1.8, z: 0.8 },
    },
  };
  const range = tuning.hub.interactRangeM;
  const pad = tuning.hub.focusPaddingM;
  // Patrzymy w −Z (yaw 0), lekko w dół: NPC (2 m) zasłania stację (5 m, poza zasięgiem 3,5 m).
  expect(
    selectHubTarget([stationZone], [npc], eye, 0, -0.3, range, pad),
  ).toEqual({ kind: 'npc', id: 'mira' });
  expect(selectHubTarget([stationZone], [], eye, 0, 0, range, pad)).toBeNull();
  const near = { ...stationZone, focus: { ...stationZone.focus } };
  near.focus.position = { x: 0, y: 1.2, z: -3 };
  expect(
    selectHubTarget(
      [near],
      [
        {
          ...npc,
          focus: { ...npc.focus, position: { x: 0, y: 0.9, z: -3.3 } },
        },
      ],
      eye,
      0,
      0,
      range,
      pad,
    ),
  ).toEqual({ kind: 'station', id: 'missions' });
});

const params: NpcLookParams = {
  rangeM: tuning.hub.npcTurnRangeM,
  turnSpeedRadS: tuning.hub.npcTurnSpeedRadS,
  headMaxRad: tuning.hub.npcHeadMaxRad,
  bodyMaxRad: tuning.hub.npcStandBodyMaxRad,
};

it('obrót NPC: głowa szybsza od tułowia, poza zasięgiem powrót do pozy bazowej, kąty w granicach', () => {
  const base = 0; // patrzy na +Z
  const npc = { x: 0, y: 0, z: 0 };
  const player = { x: 2, y: 0, z: 0 }; // na +X: yaw 90°
  let state = { bodyYaw: base, headYaw: 0 };
  state = updateNpcLook(state, base, npc, player, 0.1, params);
  expect(state.headYaw).toBeGreaterThan(state.bodyYaw);
  for (let i = 0; i < 200; i++)
    state = updateNpcLook(state, base, npc, player, 1 / 60, params);
  expect(state.bodyYaw).toBeCloseTo(Math.PI / 2, 2);
  expect(Math.abs(state.headYaw)).toBeLessThan(0.05);
  // Gracz za plecami, poza zakresem tułowia: tułów zatrzymuje się na limicie, głowa nie przekracza swojego.
  const behind = { x: 0, y: 0, z: -3 };
  for (let i = 0; i < 400; i++)
    state = updateNpcLook(state, base, npc, behind, 1 / 60, params);
  expect(Math.abs(wrapAngle(state.bodyYaw - base))).toBeLessThanOrEqual(
    params.bodyMaxRad + 1e-6,
  );
  expect(Math.abs(state.headYaw)).toBeLessThanOrEqual(params.headMaxRad + 1e-6);
  // Daleko: powrót.
  const far = { x: 30, y: 0, z: 0 };
  for (let i = 0; i < 400; i++)
    state = updateNpcLook(state, base, npc, far, 1 / 60, params);
  expect(wrapAngle(state.bodyYaw - base)).toBeCloseTo(0, 2);
  expect(state.headYaw).toBeCloseTo(0, 2);
});

it('siedzący NPC obraca tułów mniej niż stojący', () => {
  expect(tuning.hub.npcSeatedBodyMaxRad).toBeLessThan(
    tuning.hub.npcStandBodyMaxRad,
  );
});
