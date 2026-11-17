import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import { HubFaunaRuntime } from '../../src/world/hubFauna';
import { KidsCatEncounter } from '../../src/world/hubKidsCat';
import { NpcRuntime, loadNpcTexts } from '../../src/world/hubNpcs';
import { loadHubLayout } from '../../src/world/hubSchema';
import npcTextData from '../../src/data/hub/npcs.pl.json';

const dt = 1 / 60;
const t = tuning.hub;
const far = { x: 100, y: 0, z: 100 };

function kid(id: string, from: [number, number], to: [number, number]) {
  return {
    id,
    position: { x: from[0], y: 0, z: from[1] },
    rotationDeg: 90,
    animation: 'Jog_Fwd_Loop',
    accent: 'white',
    route: {
      points: [
        { x: from[0], z: from[1] },
        { x: to[0], z: to[1] },
      ],
      mode: 'pingpong',
      pauseS: 0,
      moveAnimation: 'Jog_Fwd_Loop',
      pauseAnimation: 'Idle_Loop',
      speedMS: 2.2,
    },
    scale: 0.68,
  };
}

function setup(stasFrom: [number, number] = [3, 8]) {
  const layout = loadHubLayout({
    id: 'kids-cat',
    name: 'Dzieci',
    playerSpawn: { x: 0, y: 0, z: 0 },
    blocks: [
      { position: { x: 0, y: -0.5, z: 0 }, size: { x: 30, y: 1, z: 30 } },
    ],
    stations: [
      {
        id: 'missions',
        position: { x: 12, z: 12 },
        radius: 1,
        focus: {
          position: { x: 12, y: 1, z: 12 },
          size: { x: 1, y: 2, z: 1 },
        },
        label: 'Misje',
      },
    ],
    npcs: [kid('ola', [0, 5], [8, 5]), kid('stas', stasFrom, [8, 8])],
    fauna: {
      cat: {
        route: [
          { x: -5, z: -5 },
          { x: -3, z: -5 },
          { x: -3, z: -3 },
        ],
        restS: [50, 60],
        speedMS: 1,
      },
    },
  });
  const fauna = new HubFaunaRuntime(layout, new Rng('kc'), t, new EventBus());
  const npcs = layout.npcs!.map((d) => new NpcRuntime(d, t));
  const cat = fauna.cat!;
  const enc = new KidsCatEncounter(npcs, cat, fauna.ground, t);
  const tick = (seconds = dt, talking: string | null = null) => {
    for (let n = 0; n < Math.round(seconds / dt); n++) {
      for (const npc of npcs) npc.step(dt, far, npc.def.id === talking);
      enc.step(dt, talking);
    }
  };
  return { fauna, npcs, cat, enc, tick, ola: npcs[0]!, stas: npcs[1]! };
}

const placeCat = (s: ReturnType<typeof setup>, x = 2, z = 6.5) => {
  expect(s.fauna.placeCatAt(x, z, 200)).toBe(true);
  s.cat.state = 'sit';
};

describe('dzieci przy kocie', () => {
  it('startuje tylko przy odpoczywającym kocie w zasięgu i poza odnowieniem', () => {
    const s = setup();
    s.tick(0.5);
    expect(s.enc.active).toBe(false);
    placeCat(s, 9, 9); // daleko od Oli
    s.tick(0.1);
    expect(s.enc.active).toBe(false);
    placeCat(s);
    s.cat.state = 'walk';
    s.tick(0.1);
    expect(s.enc.active).toBe(false);
    s.cat.state = 'sit';
    s.tick(0.1);
    expect(s.enc.active).toBe(true);
    expect(s.enc.query().kids).toContain('ola');
  });

  it('dziecko podchodzi, kuca, potem wraca na trasę i biegnie dalej', () => {
    const s = setup([9, 9]);
    placeCat(s);
    s.tick(dt);
    const origin = { ...s.ola.position };
    expect(s.ola.controlled).toBe(true);
    let crouched = false;
    for (let i = 0; i < 60 * 3 && !crouched; i++) {
      s.tick();
      crouched = s.ola.animation(false) === 'Crouch_Idle_Loop';
    }
    expect(crouched).toBe(true);
    expect(
      Math.hypot(
        s.ola.position.x - s.cat.position.x,
        s.ola.position.z - s.cat.position.z,
      ),
    ).toBeCloseTo(t.kidsCatStandM, 1);
    for (let i = 0; i < 60 * 20 && s.ola.controlled; i++) s.tick();
    expect(s.ola.controlled).toBe(false);
    expect(s.enc.active).toBe(false);
    expect(
      Math.hypot(s.ola.position.x - origin.x, s.ola.position.z - origin.z),
    ).toBeLessThan(0.05);
    expect(s.enc.query().cooldownLeft).toBeGreaterThan(t.kidsCatCooldownS - 1);
    const x = s.ola.position.x;
    s.tick(0.5);
    expect(s.ola.route.moving).toBe(true);
    expect(s.ola.animation(false)).toBe('Jog_Fwd_Loop');
    expect(Math.abs(s.ola.position.x - x)).toBeGreaterThan(0.5);
    s.cat.state = 'sit';
    s.tick(0.5);
    expect(s.enc.active).toBe(false); // odnowienie
  });

  it('drugie dziecko w zasięgu dołącza z drugiej strony kota', () => {
    const s = setup();
    placeCat(s);
    s.tick(0.1);
    expect(s.enc.query().kids).toEqual(['ola', 'stas']);
    s.tick(5);
    const side = (k: NpcRuntime) =>
      (k.position.x - s.cat.position.x) * 1 +
      (k.position.z - s.cat.position.z) * 0;
    expect(
      Math.hypot(
        s.ola.position.x - s.stas.position.x,
        s.ola.position.z - s.stas.position.z,
      ),
    ).toBeGreaterThan(t.kidsCatStandM);
    expect(
      Math.sign(side(s.ola)) * Math.sign(side(s.stas)),
    ).toBeLessThanOrEqual(0.5);
  });

  it('ucieczka kota przerywa spotkanie i dzieci wracają na trasę', () => {
    const s = setup();
    placeCat(s);
    s.tick(1);
    expect(s.enc.active).toBe(true);
    s.cat.state = 'flee';
    s.cat.restLeftS = 0;
    s.tick(5);
    expect(s.enc.active).toBe(false);
    expect(s.ola.controlled).toBe(false);
    expect(s.stas.controlled).toBe(false);
  });

  it('rozmowa jest zgłaszana raz na spotkanie', () => {
    const s = setup();
    placeCat(s);
    expect(s.enc.chatPending).toBe(false);
    let pending = false;
    for (let i = 0; i < 60 * 4 && !pending; i++) {
      s.tick();
      pending = s.enc.chatPending;
    }
    expect(pending).toBe(true);
    s.enc.markChatted();
    s.tick(1);
    expect(s.enc.chatPending).toBe(false);
    s.tick(t.kidsCatPetS + 3);
    expect(s.enc.active).toBe(false);
  });

  it('bez bezpiecznej drogi dziecko tylko się zatrzymuje na trasie', () => {
    const s = setup([9, 9]);
    placeCat(s);
    s.ola.position.x = 2;
    s.ola.position.z = 5;
    s.cat.position.x = 2;
    s.cat.position.z = 7.4; // punkt stania (0,7 m) wypada poza podłogą? użyj blokady: wymuś niedostępność
    (s.fauna.ground as unknown as { safe: () => boolean }).safe = () => false;
    (s.fauna.ground as unknown as { segment: () => boolean }).segment = () =>
      false;
    s.tick(0.2);
    expect(s.enc.active).toBe(true);
    expect(s.ola.animation(false)).not.toBe('Crouch_Idle_Loop');
    expect(s.ola.position.z).toBeCloseTo(5, 2);
    s.tick(t.kidsCatPetS + 1);
    expect(s.ola.controlled).toBe(false);
  });

  it('jest deterministyczne', () => {
    const run = () => {
      const s = setup();
      placeCat(s);
      s.tick(12);
      return JSON.stringify([s.ola.position, s.stas.position, s.enc.query()]);
    };
    expect(run()).toBe(run());
  });

  it('rozmowa ola_stas_cat jest w danych i nie startuje sama (promień 0,001 m)', () => {
    const texts = loadNpcTexts(npcTextData);
    const c = texts.conversations!.find((x) => x.id === 'ola_stas_cat')!;
    expect(c.npcs).toEqual(['ola', 'stas']);
    expect(c.lines.length).toBeGreaterThanOrEqual(3);
    expect(c.radiusM).toBeLessThan(0.01);
  });
});
