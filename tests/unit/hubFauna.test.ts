import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import hideout from '../../src/data/hub/hideout.json';
import { HubFaunaRuntime } from '../../src/world/hubFauna';
import { FaunaGround } from '../../src/world/hubFaunaGround';
import { hubFaunaSchema, loadHubLayout } from '../../src/world/hubSchema';
import type { HubLayout } from '../../src/world/hubSchema';

const far = { x: 100, y: 0, z: 100 },
  still = { x: 0, y: 0, z: 0 };
const dt = 1 / 60;
function fixture(): HubLayout {
  return loadHubLayout({
    id: 'fauna-test',
    name: 'Fauna',
    playerSpawn: { x: 0, y: 0, z: 0 },
    blocks: [
      { position: { x: 0, y: -0.5, z: 0 }, size: { x: 20, y: 1, z: 20 } },
    ],
    stations: [
      {
        id: 'missions',
        position: { x: 6, z: 6 },
        radius: 1,
        focus: { position: { x: 6, y: 1, z: 6 }, size: { x: 1, y: 2, z: 1 } },
        label: 'Misje',
      },
    ],
    fauna: {
      cat: {
        route: [
          { x: 0, z: 0 },
          { x: 3, z: 0 },
          { x: 3, z: 3 },
          { x: 0, z: 3 },
        ],
        restS: [0.4, 0.8],
        speedMS: 1.5,
      },
      rats: {
        lanes: [
          { from: { x: -8, y: 0, z: -3 }, to: { x: 8, y: 0, z: -3 } },
          { from: { x: 8, y: 0, z: -6 }, to: { x: -8, y: 0, z: -6 } },
        ],
        intervalS: [2, 3],
      },
    },
  });
}
function setup(layout = fixture(), seed = 'fauna') {
  const t = structuredClone(tuning.hub),
    bus = new EventBus();
  const runtime = new HubFaunaRuntime(layout, new Rng(seed), t, bus);
  return { runtime, t, bus, layout };
}

describe('walidacja fauny', () => {
  it('akceptuje opcjonalne zwierzęta i sprawdza dane kryjówki', () => {
    expect(hubFaunaSchema.parse({})).toEqual({});
    const layout = loadHubLayout(hideout);
    expect(layout.fauna?.cat?.route.length).toBeGreaterThanOrEqual(3);
    expect(layout.fauna?.rats?.lanes).toHaveLength(3);
  });
  it('odrzuca krótką trasę, odwrócone zakresy, niepoprawną prędkość i pasy', () => {
    const fauna = fixture().fauna!;
    expect(
      hubFaunaSchema.safeParse({
        ...fauna,
        cat: {
          ...fauna.cat,
          route: [
            { x: 0, z: 0 },
            { x: 1, z: 1 },
          ],
        },
      }).success,
    ).toBe(false);
    for (const restS of [
      [5, 2],
      [-1, 2],
      [0, 0],
      [1, Infinity],
    ])
      expect(
        hubFaunaSchema.safeParse({ ...fauna, cat: { ...fauna.cat, restS } })
          .success,
      ).toBe(false);
    expect(
      hubFaunaSchema.safeParse({ ...fauna, cat: { ...fauna.cat, speedMS: 0 } })
        .success,
    ).toBe(false);
    expect(
      hubFaunaSchema.safeParse({ rats: { ...fauna.rats, lanes: [] } }).success,
    ).toBe(false);
    expect(
      hubFaunaSchema.safeParse({ rats: { ...fauna.rats, intervalS: [3, 2] } })
        .success,
    ).toBe(false);
    expect(
      hubFaunaSchema.safeParse({
        rats: { intervalS: [1, 2], lanes: [{ from: still, to: still }] },
      }).success,
    ).toBe(false);
  });
  it('sprawdza segmenty, domknięcie pętli, podłogę, bloki i odstęp od statycznych NPC', () => {
    const original = fixture();
    const offFloor = structuredClone(original);
    offFloor.fauna!.cat!.route[1]!.x = 11;
    expect(() => loadHubLayout(offFloor)).toThrow(/Trasa kota/);
    const blocked = structuredClone(original);
    blocked.blocks.push({
      position: { x: 1.5, y: 0.2, z: 0 },
      size: { x: 0.1, y: 0.4, z: 0.1 },
    });
    expect(() => loadHubLayout(blocked)).toThrow(/Trasa kota/);
    const closure = structuredClone(original);
    closure.blocks.push({
      position: { x: 0, y: 0.2, z: 1.5 },
      size: { x: 0.1, y: 0.4, z: 0.1 },
    });
    expect(() => loadHubLayout(closure)).toThrow(/Trasa kota/);
    const npc = structuredClone(original);
    npc.npcs = [
      {
        id: 'resident',
        position: { x: 1.5, z: 0.5 },
        rotationDeg: 0,
        accent: 'white',
      },
    ];
    expect(() => loadHubLayout(npc)).toThrow(/Trasa kota/);
    npc.npcs[0]!.route = {
      points: [
        { x: 1.5, z: 0.5 },
        { x: 2, z: 0.5 },
      ],
    };
    expect(() => loadHubLayout(npc)).not.toThrow();
    const rat = structuredClone(original);
    rat.fauna!.rats!.lanes[0]!.to.x = 11;
    expect(() => loadHubLayout(rat)).toThrow(/Pas szczurów/);
  });
  it('suma stykających się podłóg nie tworzy szczeliny, lecz wykrywa prawdziwy otwór', () => {
    const layout = fixture();
    layout.blocks = [
      { position: { x: -2, y: -0.5, z: 0 }, size: { x: 4, y: 1, z: 6 } },
      { position: { x: 2, y: -0.5, z: 0 }, size: { x: 4, y: 1, z: 6 } },
    ];
    expect(new FaunaGround(layout, tuning.hub, 0).segment(-3, 0, 3, 0)).toBe(
      true,
    );
    layout.blocks[1]!.position.x = 2.1;
    expect(new FaunaGround(layout, tuning.hub, 0).segment(-3, 0, 3, 0)).toBe(
      false,
    );
  });
});

describe('kot', () => {
  it('przechodzi całą pętlę i odpoczywa w każdym punkcie w zadanym zakresie', () => {
    const { runtime: r, t } = setup();
    t.catGroomChance = 0;
    const c = r.cat!,
      visited = new Set<number>([0]);
    let rests = 0;
    for (let i = 0; i < 1800; i++) {
      const before = c.point;
      r.step(dt, far, still);
      if (c.point !== before) {
        visited.add(c.point);
        rests++;
        expect(c.restLeftS).toBeGreaterThanOrEqual(0.4);
        expect(c.restLeftS).toBeLessThanOrEqual(0.8);
        expect(c.position).toEqual({
          ...fixture().fauna!.cat!.route[c.point],
          y: 0,
        });
      }
    }
    expect(visited.size).toBe(4);
    expect(rests).toBeGreaterThan(4);
  });
  it('przechodzi pełną trasę kryjówki z kładką i zachowuje bezpieczną podłogę', () => {
    const layout = loadHubLayout(hideout),
      { runtime: r, t } = setup(layout);
    t.catGroomChance = 0;
    layout.fauna!.cat!.restS = [dt, dt];
    layout.fauna!.cat!.speedMS = 3;
    const c = r.cat!,
      visited = new Set([0]);
    for (let i = 0; i < 8000; i++) {
      r.step(dt, far, still);
      visited.add(c.point);
      if (i % 30 === 0)
        expect(r.ground.safe(c.position.x, c.position.z)).toBe(true);
    }
    expect(visited.size).toBe(layout.fauna!.cat!.route.length);
  });
  it('ustępuje graczowi na drodze w 0,8 m, a gracza za sobą przepuszcza', () => {
    const { runtime: r, t } = setup();
    t.catGroomChance = 0;
    const c = r.cat!;
    c.restLeftS = 0;
    c.state = 'walk';
    r.step(dt, { x: 0.5, y: 0, z: 0 }, still);
    expect(c.position.x).toBe(0);
    expect(c.moving).toBe(false);
    r.step(dt, { x: -0.5, y: 0, z: 0 }, still);
    expect(c.position.x).toBeGreaterThan(0);
    r.step(dt, { x: c.position.x, y: 0, z: 0 }, still);
    expect(c.moving).toBe(false);
  });
  it('ucieka na bezpieczną stronę przy krawędzi i wraca do punktu opuszczenia trasy', () => {
    const { runtime: r, t } = setup();
    t.catGroomChance = 0;
    const c = r.cat!;
    c.position.z = 9.7;
    c.restLeftS = 0;
    c.state = 'walk';
    r.step(dt, { x: -1, y: 0, z: 9.7 }, { x: 5, y: 0, z: 0 });
    expect(c.state).toBe('flee');
    expect(c.detour.z).toBeLessThan(9.7);
    const anchor = { ...c.anchor };
    let returned = false;
    for (let i = 0; i < 120; i++) {
      const state = c.state as string;
      r.step(dt, far, still);
      expect(r.ground.safe(c.position.x, c.position.z)).toBe(true);
      if (state === 'return' && c.state === 'walk') {
        returned = true;
        expect(c.position).toEqual(anchor);
        break;
      }
    }
    expect(returned).toBe(true);
  });
  it('nie ucieka poza wąską podłogę ani przed graczem biegnącym w przeciwną stronę', () => {
    const layout = fixture();
    layout.blocks[0]!.size.z = 0.7;
    const { runtime: r } = setup(layout),
      c = r.cat!;
    c.restLeftS = 0;
    c.state = 'walk';
    r.step(dt, { x: -1, y: 0, z: 0 }, { x: 5, y: 0, z: 0 });
    expect(c.state).toBe('walk');
    expect(c.position.z).toBe(0);
    r.step(dt, { x: -1, y: 0, z: 0 }, { x: -5, y: 0, z: 0 });
    expect(c.state).toBe('walk');
  });
  it('losuje mycie, rzadkie miau oraz bezpieczny teleport debug z odpoczynkiem', () => {
    const { runtime: r, t, bus } = setup();
    t.catGroomChance = 1;
    t.catMeowChance = 1;
    const sounds: string[] = [];
    bus.on('hub_fauna_sound', (e) => sounds.push(e.kind));
    const c = r.cat!;
    c.restLeftS = 0;
    c.state = 'walk';
    c.groomLeftS = 0;
    r.step(dt, far, still);
    expect(c.state).toBe('groom');
    expect(c.restLeftS).toBeGreaterThanOrEqual(t.catGroomMinS);
    expect(c.restLeftS).toBeLessThanOrEqual(t.catGroomMaxS);
    c.meowCooldownS = 0;
    expect(r.placeCat({ x: 0, y: 0, z: 2 }, 0)).toBe(true);
    expect(c.position).toEqual(still);
    expect(c.previous).toEqual(c.position);
    expect(c.restLeftS).toBeGreaterThan(0);
    expect(sounds).toEqual(['meow']);
    r.placeCat({ x: 0, y: 0, z: 2 }, 0);
    expect(sounds).toHaveLength(1);
    expect(r.placeCat({ x: 50, y: 0, z: 50 }, 0)).toBe(false);
  });
});

describe('szczury i determinizm', () => {
  it('losuje interwały, biegnie 2,5–3,5 m/s, znika i ponownie używa puli', () => {
    const layout = fixture();
    delete layout.fauna!.cat;
    for (const lane of layout.fauna!.rats!.lanes) {
      lane.from.x = -2;
      lane.to.x = 2;
    }
    const { runtime: r, bus } = setup(layout),
      pool = [...r.rats];
    let time = 0;
    const starts: number[] = [];
    bus.on('hub_fauna_sound', () => starts.push(time));
    expect(r.ratWaitS).toBeGreaterThanOrEqual(2);
    expect(r.ratWaitS).toBeLessThanOrEqual(3);
    for (let i = 0; i < 1200; i++) {
      const before = r.rats.map((p) => ({ active: p.active, d: p.distance }));
      time += dt;
      r.step(dt, far, still);
      r.rats.forEach((p, j) => {
        if (p.active && before[j]!.active && p.distance > 0) {
          const speed = (p.distance - before[j]!.d) / dt;
          expect(speed).toBeGreaterThanOrEqual(2.5 - 1e-8);
          expect(speed).toBeLessThanOrEqual(3.5 + 1e-8);
        }
      });
      expect(r.query().rats).toBeLessThanOrEqual(2);
    }
    expect(starts.length).toBeGreaterThan(5);
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i]! - starts[i - 1]!).toBeGreaterThanOrEqual(2);
      expect(starts[i]! - starts[i - 1]!).toBeLessThan(3 + dt);
    }
    expect(r.rats[0]).toBe(pool[0]);
    expect(r.rats[1]).toBe(pool[1]);
    r.ratWaitS = 100;
    r.step(20, far, still);
    expect(r.query().rats).toBe(0);
  });
  it('omija start pasa przy graczu, czeka gdy brak innego i pilnuje limitu 2', () => {
    const { runtime: r, layout } = setup();
    const start = layout.fauna!.rats!.lanes[0]!.from;
    r.ratWaitS = 0;
    r.step(dt, start, still);
    expect(r.rats.find((p) => p.active)?.lane).toBe(1);
    expect(r.forceRat(far)).toBe(true);
    expect(r.forceRat(far)).toBe(false);
    const single = fixture();
    single.fauna!.rats!.lanes.splice(1);
    const waiting = setup(single).runtime;
    waiting.ratWaitS = 0;
    waiting.step(dt, start, still);
    expect(waiting.query().rats).toBe(0);
    expect(waiting.ratWaitS).toBe(tuning.hub.ratRetryS);
    waiting.step(tuning.hub.ratRetryS, far, still);
    expect(waiting.query().rats).toBe(1);
  });
  it('wybiera najbliższy pas dla komendy debug', () => {
    const { runtime: r } = setup();
    expect(r.forceRat({ x: 0, y: 0, z: -6 })).toBe(true);
    expect(r.rats[0]!.lane).toBe(1);
  });
  it('ten sam seed i kroki dają identyczny stan, inny seed zmienia harmonogram', () => {
    const a = setup().runtime,
      b = setup().runtime,
      c = setup(fixture(), 'other').runtime;
    for (let i = 0; i < 1500; i++) {
      a.step(dt, far, still);
      b.step(dt, far, still);
      c.step(dt, far, still);
    }
    expect(a.cat).toEqual(b.cat);
    expect(a.rats).toEqual(b.rats);
    expect(a.ratWaitS).toBe(b.ratWaitS);
    expect(a.ratWaitS).not.toBe(c.ratWaitS);
    expect(a.query()).toEqual({
      cat: { x: a.cat!.position.x, z: a.cat!.position.z, state: a.cat!.state },
      rats: a.rats.filter((r) => r.active).length,
    });
  });
  it('układ bez fauny jest bezczynny', () => {
    const layout = fixture();
    delete layout.fauna;
    const r = setup(layout).runtime;
    r.step(dt, far, still);
    expect(r.query()).toEqual({ cat: null, rats: 0 });
    expect(r.placeCat(still, 0)).toBe(false);
    expect(r.forceRat(still)).toBe(false);
  });
});
