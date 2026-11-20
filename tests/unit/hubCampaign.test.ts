import { expect, it } from 'vitest';
import hideoutData from '../../src/data/hub/hideout.json';
import npcTextData from '../../src/data/hub/npcs.pl.json';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import { HubArrival, hubArrivalContext } from '../../src/world/hubArrival';
import {
  applyCampaignTexts,
  applyHubCampaign,
  assertCampaignMissions,
  campaignVisible,
  collectCampaignMissionIds,
} from '../../src/world/hubCampaign';
import { loadNpcTexts } from '../../src/world/hubNpcs';
import { hubLayoutSchema, loadHubLayout } from '../../src/world/hubSchema';
import { missionDefinitions } from '../../src/world/missions';
import { lifeLayout, lifeTexts } from '../fixtures/hubLife';

const M1 = 'm01-maszty';
const M3 = 'm03-list-przewozowy';
const M6 = 'm06-odlewnia';
const layout = loadHubLayout(hideoutData);
const texts = loadNpcTexts(npcTextData, layout.npcs);

it('campaignVisible respektuje after i until', () => {
  const none = new Set<string>();
  const done = new Set([M1]);
  expect(campaignVisible({}, none)).toBe(true);
  expect(campaignVisible({ after: M1 }, none)).toBe(false);
  expect(campaignVisible({ after: M1 }, done)).toBe(true);
  expect(campaignVisible({ until: M1 }, none)).toBe(true);
  expect(campaignVisible({ until: M1 }, done)).toBe(false);
  expect(campaignVisible({ after: M1, until: M3 }, new Set([M1, M3]))).toBe(
    false,
  );
});

it('id misji w polach kampanii istnieją w danych misji', () => {
  const ids = collectCampaignMissionIds(layout, texts);
  expect(ids.length).toBeGreaterThan(0);
  expect(() =>
    assertCampaignMissions(layout, texts, new Set(missionDefinitions.keys())),
  ).not.toThrow();
  expect(() => assertCampaignMissions(layout, texts, new Set())).toThrow(
    /Nieznana misja/,
  );
});

it('dane kryjówki mają wpisy dla trzech misji dema', () => {
  const ids = new Set(collectCampaignMissionIds(layout, texts));
  expect([...ids].sort()).toEqual([M1, M3, M6].sort());
  const react = (mission: string): number =>
    texts.npcs.filter((npc) => npc.reactions?.afterMission?.[mission]).length;
  expect(react(M1)).toBeGreaterThanOrEqual(4);
  expect(react(M3)).toBeGreaterThanOrEqual(3);
  expect(react(M6)).toBeGreaterThanOrEqual(5);
});

it('otoczenie: elementy pojawiają się dopiero po misji', () => {
  const texts0 = (l: typeof layout) => l.neonTexts?.map((n) => n.text) ?? [];
  const base = applyHubCampaign(layout, new Set());
  expect(texts0(base)).not.toContain('HUTY PRZEKREŚLONE');
  expect(texts0(base)).not.toContain('NIECKA: MASZTY CISZA');
  expect(base.decor?.some((d) => d.after === M3)).toBe(false);
  const after6 = applyHubCampaign(layout, new Set([M6]));
  expect(texts0(after6)).toContain('HUTY PRZEKREŚLONE');
  expect(texts0(after6)).not.toContain('NIECKA: MASZTY CISZA');
  const after3 = applyHubCampaign(layout, new Set([M3]));
  expect(after3.decor?.filter((d) => d.model === 'city_crates').length).toBe(
    (base.decor?.filter((d) => d.model === 'city_crates').length ?? 0) + 2,
  );
});

it('Szron po M06 stoi przy tablicy, a układ nadal przechodzi walidację', () => {
  const before = applyHubCampaign(layout, new Set()).npcs!.find(
    (n) => n.id === 'szron',
  )!;
  const after = applyHubCampaign(layout, new Set([M6])).npcs!.find(
    (n) => n.id === 'szron',
  )!;
  expect(after.position).not.toEqual(before.position);
  expect(after.rotationDeg).toBe(240);
  expect(() =>
    hubLayoutSchema.parse(applyHubCampaign(layout, new Set([M1, M3, M6]))),
  ).not.toThrow();
});

it('campaignNpc: ostatni pasujący wariant wygrywa', () => {
  const base = lifeLayout();
  const npc = {
    ...base.npcs![1]!,
    campaignPositions: [
      { after: 'a', position: { x: 1, z: 1 }, rotationDeg: 10 },
      { after: 'b', position: { x: 2, z: 2 } },
    ],
  };
  const l = { ...base, npcs: [npc] };
  expect(applyHubCampaign(l, new Set()).npcs![0]!.position).toEqual(
    npc.position,
  );
  const a = applyHubCampaign(l, new Set(['a'])).npcs![0]!;
  expect(a.position).toEqual({ x: 1, z: 1 });
  expect(a.rotationDeg).toBe(10);
  const b = applyHubCampaign(l, new Set(['a', 'b'])).npcs![0]!;
  expect(b.position).toEqual({ x: 2, z: 2 });
  expect(b.rotationDeg).toBe(npc.rotationDeg);
});

it('campaignLines dochodzą do puli po misji, rozmowy filtrują after/until', () => {
  const base = lifeTexts();
  base.npcs[0]!.campaignLines = [
    { after: 'a', lines: ['Nowa 1', 'Nowa 2'] },
    { after: 'b', lines: ['Nowa 3'] },
  ];
  base.conversations!.push(
    {
      id: 'late',
      npcs: ['kid'],
      after: 'a',
      lines: [{ npc: 'kid', text: 'Po a' }],
    },
    {
      id: 'early',
      npcs: ['kid'],
      until: 'a',
      lines: [{ npc: 'kid', text: 'Do a' }],
    },
  );
  const ids = (t: typeof base) => t.conversations!.map((c) => c.id);
  const none = applyCampaignTexts(base, new Set());
  expect(none.npcs[0]!.lines).toEqual(['Cześć!', 'Do zobaczenia!']);
  expect(ids(none)).toEqual(['hello', 'early']);
  const a = applyCampaignTexts(base, new Set(['a']));
  expect(a.npcs[0]!.lines).toEqual([
    'Cześć!',
    'Do zobaczenia!',
    'Nowa 1',
    'Nowa 2',
  ]);
  expect(ids(a)).toEqual(['hello', 'late']);
  const ab = applyCampaignTexts(base, new Set(['b', 'a']));
  expect(ab.npcs[0]!.lines.at(-1)).toBe('Nowa 3');
});

it('hubArrivalContext dodaje missionId tylko dla zwycięstwa z ukończonej misji', () => {
  const meta = createStarterMetaState();
  meta.stats.runs = 1;
  meta.lastRuns = [
    {
      runId: 'r:1',
      outcome: 'victory',
      elapsedS: 1,
      layerReached: 1,
      threatLevel: 0,
      rewards: { xp: 0, data: 0, cores: 0 },
    },
  ];
  expect(hubArrivalContext(meta, null)?.missionId).toBeUndefined();
  meta.campaign.pendingDebrief = M1;
  expect(hubArrivalContext(meta, null)?.missionId).toBeUndefined();
  meta.campaign.completed = [M1];
  expect(hubArrivalContext(meta, null)).toEqual({
    kind: 'victory',
    key: 'r:1',
    missionId: M1,
  });
  meta.lastRuns[0]!.outcome = 'death';
  expect(hubArrivalContext(meta, null)?.missionId).toBeUndefined();
});

it('reakcja po misji zastępuje victory tylko u NPC z wpisem', () => {
  const l = lifeLayout();
  const t = lifeTexts().npcs;
  t[0]!.reactions = {
    victory: ['Ogólna'],
    afterMission: { a: ['Po misji a'] },
  };
  t[1]!.reactions = { victory: ['Friend ogólna'] };
  const arrival = (missionId?: string) =>
    new HubArrival(
      { kind: 'victory', key: 'k:1', missionId },
      t,
      l.npcs!,
      l.playerSpawn,
    );
  const withMission = arrival('a');
  expect(withMission.react('kid')!.line).toBe('Po misji a');
  expect(withMission.react('friend')!.line).toBe('Friend ogólna');
  expect(arrival('inna').react('kid')!.line).toBe('Ogólna');
  expect(arrival().react('kid')!.line).toBe('Ogólna');
  const g = arrival('a').greet()!;
  expect(g.line).toBe(g.id === 'kid' ? 'Po misji a' : 'Friend ogólna');
});

it('afterMission bez victory też kwalifikuje NPC do reakcji', () => {
  const l = lifeLayout();
  const t = lifeTexts().npcs;
  t[0]!.reactions = { afterMission: { a: ['Tylko po a'] } };
  const a = new HubArrival(
    { kind: 'victory', key: 'k', missionId: 'a' },
    t,
    l.npcs!,
    l.playerSpawn,
  );
  expect(a.isPending('kid')).toBe(true);
  const plain = new HubArrival(
    { kind: 'victory', key: 'k' },
    t,
    l.npcs!,
    l.playerSpawn,
  );
  expect(plain.isPending('kid')).toBe(false);
});
