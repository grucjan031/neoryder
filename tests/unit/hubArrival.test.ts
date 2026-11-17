import { expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import { HubArrival, hubArrivalContext } from '../../src/world/hubArrival';
import { lifeLayout, lifeTexts } from '../fixtures/hubLife';

it('pierwszy pobyt ma stały klucz i nie powtarza przywitanego kontekstu', () => {
  const meta = createStarterMetaState();
  expect(hubArrivalContext(meta, null)).toEqual({
    kind: 'firstVisit',
    key: 'first-visit',
  });
  expect(hubArrivalContext(meta, 'first-visit')).toBeNull();
});

it.each(['victory', 'death'] as const)(
  'powrót po %s używa najnowszego runu i jego klucza',
  (outcome) => {
    const meta = createStarterMetaState();
    meta.stats.runs = 2;
    const record = {
      runId: 'new:2',
      outcome,
      elapsedS: 30,
      layerReached: 1,
      threatLevel: 0,
      rewards: { xp: 0, data: 0, cores: 0 },
    };
    meta.lastRuns = [record, { ...record, runId: 'old:1' }];
    expect(hubArrivalContext(meta, 'old:1')).toEqual({
      kind: outcome,
      key: 'new:2',
    });
    expect(hubArrivalContext(meta, 'new:2')).toBeNull();
  },
);

it('brak ostatniego runu po rozegraniu runów daje null', () => {
  const meta = createStarterMetaState();
  meta.stats.runs = 1;
  expect(hubArrivalContext(meta, null)).toBeNull();
});

it('najbliższy NPC z reakcją wita deterministycznie; pierwsza rozmowa nie powtarza powitania', () => {
  const layout = lifeLayout();
  const texts = lifeTexts().npcs;
  texts[0]!.reactions = { victory: ['Brawo!', 'Wróciłeś!', 'Udało się!'] };
  // Bliższy friend nie ma reakcji victory.
  texts[1]!.reactions = { death: ['Żyjesz.'] };
  const context = { kind: 'victory' as const, key: 'seed:12' };
  const create = () =>
    new HubArrival(context, texts, layout.npcs!, layout.playerSpawn);
  const a = create(),
    b = create();
  const greeting = a.greet()!;
  expect(greeting.id).toBe('kid');
  expect(greeting.line).toBe(
    new Rng('seed:12:kid').pick(texts[0]!.reactions.victory!),
  );
  expect(b.greet()).toEqual(greeting);
  expect(a.greet()).toBeNull();
  const reaction = a.react('kid')!;
  expect(reaction.line).not.toBe(greeting.line);
  expect(b.react('kid')).toEqual(reaction);
  expect(a.react('kid')).toBeNull();
  expect(a.react('friend')).toBeNull();
  expect(a.state).toEqual({
    ...context,
    greetedNpc: 'kid',
    reacted: ['kid'],
    pending: [],
  });
  a.state.reacted.push('friend');
  expect(a.state.reacted).toEqual(['kid']);
});

it('rozmowa przed powitaniem też dostaje inną kwestię; pojedynczą reakcję można powtórzyć', () => {
  const layout = lifeLayout();
  const texts = lifeTexts().npcs;
  texts[1]!.reactions = { firstVisit: ['A', 'B'] };
  const arrival = new HubArrival(
    { kind: 'firstVisit', key: 'first-visit' },
    texts,
    layout.npcs!,
    layout.playerSpawn,
  );
  const reaction = arrival.react('friend')!;
  expect(arrival.greet()!.line).not.toBe(reaction.line);
  texts[1]!.reactions.firstVisit = ['A'];
  const single = new HubArrival(
    { kind: 'firstVisit', key: 'first-visit' },
    texts,
    layout.npcs!,
    layout.playerSpawn,
  );
  expect(single.greet()!.line).toBe('A');
  expect(single.react('friend')!.line).toBe('A');
  expect(single.react('friend')).toBeNull();
});

it('bez NPC z reakcją nie ma powitania ani reakcji', () => {
  const arrival = new HubArrival(
    { kind: 'death', key: 'run:1' },
    lifeTexts().npcs,
    [],
    { x: 0, y: 0, z: 0 },
  );
  expect(arrival.greet()).toBeNull();
  expect(arrival.react('kid')).toBeNull();
});

it('pending i isPending listują NPC z niewykorzystaną reakcją', () => {
  const layout = lifeLayout();
  const texts = lifeTexts().npcs;
  texts[0]!.reactions = { victory: ['Brawo!', 'Wróciłeś!'] };
  const arrival = new HubArrival(
    { kind: 'victory', key: 'seed:1' },
    texts,
    layout.npcs!,
    layout.playerSpawn,
  );
  expect(arrival.state.pending).toEqual(['kid']);
  expect(arrival.isPending('kid')).toBe(true);
  expect(arrival.isPending('friend')).toBe(false);
  arrival.greet();
  expect(arrival.isPending('kid')).toBe(true);
  arrival.react('kid');
  expect(arrival.isPending('kid')).toBe(false);
  expect(arrival.state.pending).toEqual([]);
});
