// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { EventBus } from '../../src/core/events';
import { EntityRegistry } from '../../src/core/entities';
import { tuning } from '../../src/core/tuning';
import { DamageSystem, Health } from '../../src/combat/damage';
import { RunManager } from '../../src/world/run';
import { HtmlRunScreens } from '../../src/ui/runScreens';
import { BuildSelect } from '../../src/ui/buildSelect';
import { defeatMessage } from '../../src/ui/runHud';
import defeat from '../../src/data/ui/defeat.pl.json';
import progression from '../../src/data/meta/progression.json';
import tips from '../../src/data/ui/loadingTips.pl.json';
import hud from '../../src/data/ui/hud.pl.json';
import runText from '../../src/data/ui/run.pl.json';
import meta from '../../src/data/ui/meta.pl.json';
import workshop from '../../src/data/ui/workshop.pl.json';
import descriptionText from '../../src/data/ui/descriptions.pl.json';
import overload from '../../src/data/statuses/overload.json';
import { Scene as ThreeScene } from 'three';
import { RunScene } from '../../src/scenes/run';
import { Hud } from '../../src/ui/hud';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { createMemorySaveStore } from '../../src/core/save';
import type { RunScreenActions } from '../../src/ui/runScreens';

it('śmierć od Egzekutora przechodzi przez RunScene do prawdziwego ekranu podsumowania', async () => {
  const bus = new EventBus();
  const entities = new EntityRegistry(bus);
  const damage = new DamageSystem(bus, entities);
  const screens = new HtmlRunScreens();
  let actions: RunScreenActions | undefined;
  let firstNode: string | undefined;
  let player = 0;
  const scene = new RunScene({
    params: new URLSearchParams('seed=defeat&loadout=classic'),
    metaStore: createMemorySaveStore(),
    save: {
      async loadRun() {
        return null;
      },
      async saveRun() {},
      async clearRun() {},
    },
    screens: {
      show(view, nextActions) {
        actions = nextActions;
        firstNode ??= view.nodes[0]?.id;
        screens.show(view, nextActions);
      },
      hide() {
        screens.hide();
      },
      dispose() {
        screens.dispose();
      },
    },
    createRoom: (_layout, state) => ({
      id: 'defeat-test',
      async init() {
        player = entities.create('player', 'player');
        damage.register(player, new Health(() => 10));
      },
      clear() {},
      step() {},
      render() {},
      dispose() {},
      exportState() {
        return { hp: state.hp, energy: state.energy };
      },
    }),
  });
  try {
    await scene.init(
      {
        bus,
        tuning: structuredClone(tuning),
        rng: new Rng('defeat'),
        loop: new GameLoop({ step() {}, render() {} }),
        debug: false,
      },
      new ThreeScene(),
    );
    expect(actions).toBeDefined();
    expect(firstNode).toBeDefined();
    actions!.selectNode(firstNode!);
    await scene.whenReady();
    const executor = entities.create('executor', 'enemy');
    damage.deal(player, { source: executor, amount: 10, tags: ['#melee'] });
    scene.step(SIM_DT, {
      held: new Set(),
      pressed: new Set(),
      released: new Set(),
      lookDelta: { x: 0, y: 0 },
    });
    await scene.whenReady();
    const summary = document.querySelector(
      '.run-screen[data-screen="summary"]',
    );
    expect(summary).not.toBeNull();
    expect(summary?.textContent).toContain('Przyczyna: Egzekutor');
    expect(summary?.textContent).toContain(
      'Bursztynowa zapowiedź = cios przebija blok. Uskocz.',
    );
  } finally {
    scene.dispose();
  }
});

it('śmierć od Egzekutora pokazuje przyczynę i jedną wskazówkę w HUD areny; kolejna śmierć zastępuje tekst', () => {
  const bus = new EventBus();
  const entities = new EntityRegistry(bus);
  const player = entities.create('player', 'player');
  const executor = entities.create('executor', 'enemy');
  const damage = new DamageSystem(bus, entities);
  damage.register(player, new Health(() => 10));
  const arenaHud = new Hud(bus, { playerId: player });
  try {
    damage.deal(player, { source: executor, amount: 10, tags: ['#melee'] });
    const screen = document.querySelector<HTMLElement>('.hud__death')!;
    expect(screen.hidden).toBe(false);
    expect(screen.textContent).toContain('Przyczyna: Egzekutor');
    expect(screen.querySelectorAll('.hud__death-tip')).toHaveLength(1);
    expect(screen.textContent).toContain(
      'Bursztynowa zapowiedź = cios przebija blok. Uskocz.',
    );
    arenaHud.setLoadout({ weapons: ['pistol'], powers: ['push'] });
    bus.emit('player_died', { id: player });
    expect(screen.textContent).toContain(
      'Nieustalone źródło ostatniego trafienia',
    );
    expect(screen.textContent).not.toContain('Bursztynowa zapowiedź');
  } finally {
    arenaHud.dispose();
  }
});

const raw = import.meta.glob<Record<string, unknown>>(
  [
    '../../src/data/talents/*.json',
    '../../src/data/implants/*.json',
    '../../src/data/powers/*.json',
    '../../src/data/modules/*.json',
    '../../src/data/synergies/*.json',
    '../../src/data/statuses/*.json',
  ],
  { eager: true, import: 'default' },
);
const descriptionSchema = z
  .object({
    id: z.string(),
    description: z.string().trim().min(1).max(140),
  })
  .passthrough();
for (const [file, data] of Object.entries(raw)) {
  for (const category of ['powers', 'synergies', 'statuses'] as const) {
    if (file.includes(`/${category}/`)) {
      raw[file] = {
        ...data,
        description: (descriptionText[category] as Record<string, string>)[
          String(data.id)
        ],
      };
    }
  }
}
const entries = Object.entries(raw).flatMap(([file, data]) =>
  (Array.isArray(data.nodes) ? data.nodes : [data]).map((entry: unknown) => ({
    file,
    entry,
  })),
);
const pl = (value: number): string =>
  String(Math.round(value * 10000) / 10000).replace('.', ',');

/** Kontrola liczb w prozie; jednostki i warunki sprawdzamy osobno poniżej i w review. */
function numericValues(value: unknown): number[] {
  if (typeof value === 'number') return [Math.abs(value)];
  if (Array.isArray(value)) return value.flatMap(numericValues);
  if (!value || typeof value !== 'object') return [];
  const item = value as Record<string, unknown>;
  const values = Object.entries(item)
    .filter(
      ([key]) =>
        !['description', 'id', 'name', 'tier', 'cost', 'requires'].includes(
          key,
        ),
    )
    .flatMap(([, child]) => numericValues(child));
  if (typeof item.value === 'number') {
    if (item.type === 'percent') values.push(Math.abs(item.value * 100));
    if (item.type === 'mult' || item.op === 'mul')
      values.push(Math.abs((item.value - 1) * 100));
    if (
      item.path === 'blockDamageMult' ||
      item.path === 'pierceFalloff' ||
      item.path === 'aimFovScale'
    )
      values.push(Math.abs(item.value * 100));
  }
  for (const key of [
    'damageMult',
    'falloff',
    'worldScale',
    'damageTakenPerStack',
  ]) {
    if (typeof item[key] === 'number') values.push(item[key] * 100);
  }
  return values;
}

describe('czytelność opisów danych', () => {
  it.each(entries)(
    '$file: opis istnieje, ma do 140 znaków i liczby z danych',
    ({ file, entry }) => {
      const data = descriptionSchema.parse(entry);
      const allowed = numericValues(data);
      if (data.id === 'overloadCell')
        allowed.push(overload.maxStacks, overload.damageTakenPerStack * 100);
      if (file.includes('/powers/') && typeof data.cost === 'number')
        allowed.push(data.cost);
      if (data.id === 'hybridDoubleJump')
        allowed.push(tuning.player.doubleJumpStaminaCost);
      for (const match of data.description.matchAll(/\d+(?:[.,]\d+)?/g)) {
        const number = Number(match[0].replace(',', '.'));
        expect(
          allowed.some((value) => Math.abs(value - number) < 0.00001),
          `${data.id}: ${match[0]}`,
        ).toBe(true);
      }
    },
  );

  it('koszt i odnowienie każdej mocy są przypisane do właściwej wartości', () => {
    for (const [file, data] of Object.entries(raw)) {
      if (!file.includes('/powers/')) continue;
      expect(data.description).toContain(
        `Koszt: ${pl(Number(data.cost))} energii`,
      );
      expect(data.description).toContain(
        `Odnowienie: ${pl(Number(data.cooldownS))} s`,
      );
    }
  });

  it('stałe modyfikatory implantów są ujawnione w opisach', () => {
    for (const [file, data] of Object.entries(raw)) {
      if (!file.includes('/implants/')) continue;
      const modifiers = z
        .array(z.object({ type: z.string(), value: z.number() }))
        .parse(data.modifiers);
      const description = String(data.description);
      for (const modifier of modifiers) {
        const value =
          modifier.type === 'percent'
            ? Math.abs(modifier.value * 100)
            : Math.abs(modifier.value);
        const tokens = [...description.matchAll(/\d+(?:[.,]\d+)?/g)].map(
          (match) => match[0],
        );
        // Doskok opisujemy procentem skrócenia, redukcję obrażeń mnożnikiem.
        expect(
          tokens.includes(pl(value)) ||
            (modifier.type === 'mult' &&
              tokens.includes(pl(Math.abs((modifier.value - 1) * 100)))),
          file,
        ).toBe(true);
      }
    }
  });

  it('waluty mają spójne etykiety i porada używa aktualnego limitu modułów', () => {
    expect(hud.credits).toBe(runText.credits);
    expect(workshop.currency.data).toBe(meta.summary.data);
    expect(workshop.currency.cores).toBe(meta.summary.cores);
    expect(
      tips.tips.find((tip) => tip.text.startsWith('Broń ma '))?.text,
    ).toContain(`${progression.moduleSlotsPerWeapon} miejsca`);
  });

  it('wybór zestawu udostępnia opisy mocy i synergii', () => {
    const select = new BuildSelect({ onSelect() {} });
    select.show();
    expect(
      document.querySelector('[title*="Koszt: 10 energii"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[title*="Style Ostrza i Rezonansu"]'),
    ).not.toBeNull();
    select.dispose();
  });
});

describe('przyczyny porażki', () => {
  it('każdy produkcyjny rodzaj wroga ma dopasowaną wskazówkę', () => {
    const enemies = import.meta.glob<{ kind: string }>(
      '../../src/data/enemies/*.json',
      { eager: true, import: 'default' },
    );
    for (const enemy of Object.values(enemies))
      expect(Object.hasOwn(defeat.causes, enemy.kind), enemy.kind).toBe(true);
  });
  it.each(Object.entries(defeat.causes))(
    '%s ma etykietę i co najmniej jedną krótką wskazówkę',
    (cause, entry) => {
      expect(entry.label.trim()).not.toBe('');
      expect(entry.tips.length).toBeGreaterThan(0);
      for (const tip of entry.tips) expect(tip.length).toBeGreaterThan(0);
      for (const tip of entry.tips) expect(tip.length).toBeLessThanOrEqual(140);
      expect(defeatMessage(cause).tip).toContain(entry.tips[0]);
    },
  );

  it.each([undefined, 'removed-enemy', '__proto__', 'constructor'])(
    'brak lub nieznana przyczyna %s daje bezpieczny tekst',
    (cause) => {
      expect(defeatMessage(cause)).toEqual(defeatMessage('unknown'));
    },
  );

  it.each([
    ['executor', [], 'executor'],
    ['gunner', [], 'gunner'],
    ['gunner', ['#status', '#fire'], 'burning'],
    ['gunner', ['#status', '#elektrycznosc'], 'overload'],
    [null, ['#hazard', '#laser'], 'laserHazard'],
    [null, ['#hazard', '#elektrycznosc'], 'electricHazard'],
    ['gunner', ['#hazard', '#explosion'], 'explosion'],
    [null, ['#hazard'], 'hazard'],
    [null, [], 'unknown'],
  ] as const)(
    'ostatni cios %s %j → %s, także po usunięciu źródła',
    (kind, tags, cause) => {
      const bus = new EventBus();
      const entities = new EntityRegistry(bus);
      const player = entities.create('player', 'player');
      const source = kind ? entities.create(kind, 'enemy') : null;
      const damage = new DamageSystem(bus, entities);
      damage.register(player, new Health(() => 10));
      const died = vi.fn();
      bus.on('player_died', died);
      bus.on('damage_dealt', ({ killed }) => {
        if (killed && source !== null) entities.destroy(source);
      });
      damage.deal(player, { source, amount: 1, tags });
      expect(died).not.toHaveBeenCalled();
      damage.deal(player, { source, amount: 10, tags });
      expect(died).toHaveBeenCalledExactlyOnceWith({ id: player, cause });
      damage.deal(player, { source, amount: 10, tags });
      expect(died).toHaveBeenCalledOnce();
    },
  );

  it('przenosi przyczynę do run_ended i pokazuje ją tylko dla porażki', () => {
    const bus = new EventBus();
    const manager = new RunManager(bus, () => ({
      sectorId: 'test',
      layers: [[{ id: 'a', layer: 1, index: 0, type: 'combat', next: [] }]],
    }));
    manager.newRun('clarity', 'blade');
    const ended = vi.fn();
    bus.on('run_ended', ended);
    bus.emit('player_died', { id: 1, cause: 'executor' });
    expect(ended).toHaveBeenCalledOnce();
    expect(ended.mock.calls[0]?.[0]).toMatchObject({
      cause: 'executor',
      outcome: 'death',
    });
    const screens = new HtmlRunScreens();
    const view = {
      screen: 'summary' as const,
      state: manager.state,
      nodes: [],
      summary: manager.summary,
      busy: false,
      error: null,
      cause: 'executor',
    };
    const actions = { selectNode() {}, next() {}, menu() {} };
    screens.show(view, actions);
    expect(document.body.textContent).toContain('Przyczyna: Egzekutor');
    expect(document.body.textContent).toContain('Bursztynowa zapowiedź');
    screens.show(
      { ...view, summary: { ...manager.summary!, outcome: 'victory' } },
      actions,
    );
    expect(document.body.textContent).not.toContain('Przyczyna:');
    screens.dispose();
    manager.dispose();
  });
});
