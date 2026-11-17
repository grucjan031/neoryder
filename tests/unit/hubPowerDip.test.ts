import { afterEach, describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { EventBus } from '../../src/core/events';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import { CityLights } from '../../src/render/city/lights';
import { getMaterial, syncMaterials } from '../../src/render/materials';
import { getPowerLevel, setPowerLevel } from '../../src/render/powerLevel';
import {
  HubPowerDip,
  loadHubEvents,
  pickDipComment,
  powerLevel,
} from '../../src/world/hubPowerDip';
import events from '../../src/data/hub/events.pl.json';
import npcTexts from '../../src/data/hub/npcs.pl.json';

const t = tuning.hub;
afterEach(() => setPowerLevel(1));

function schedule(seed: string) {
  const bus = new EventBus();
  const starts: number[] = [];
  const ends: number[] = [];
  let time = 0;
  bus.on('hub_power_dip', ({ durationS }) => {
    expect(durationS).toBe(t.powerDipDurationS);
    starts.push(time);
  });
  const dip = new HubPowerDip(new Rng(seed), t, bus);
  dip.step(0);
  dip.step(-1);
  for (let i = 0; i < 60 * 1800; i++) {
    time = (i + 1) / 60;
    if (dip.step(1 / 60)) ends.push(time);
  }
  return { starts, ends };
}

describe('harmonogram spadku napięcia', () => {
  it('jest deterministyczny i mieści się w zakresach', () => {
    const a = schedule('x');
    expect(a).toEqual(schedule('x'));
    expect(a.starts).not.toEqual(schedule('y').starts);
    expect(a.starts[0]).toBeGreaterThanOrEqual(t.powerDipFirstS.min);
    expect(a.starts[0]).toBeLessThanOrEqual(t.powerDipFirstS.max + 1 / 60);
    for (let i = 1; i < a.starts.length; i++) {
      const gap = a.starts[i]! - a.starts[i - 1]!;
      expect(gap).toBeGreaterThanOrEqual(t.powerDipIntervalS.min);
      expect(gap).toBeLessThanOrEqual(t.powerDipIntervalS.max + 1 / 60);
    }
    expect(a.ends.length).toBe(a.starts.length);
    expect(a.ends[0]! - a.starts[0]!).toBeCloseTo(t.powerDipDurationS, 1);
  });

  it('force emituje zdarzenie, level/active/nextInS opisują stan', () => {
    const bus = new EventBus();
    let n = 0;
    bus.on('hub_power_dip', () => n++);
    const dip = new HubPowerDip(new Rng('f'), t, bus);
    expect(dip.active).toBe(false);
    expect(dip.level(true)).toBe(1);
    dip.force();
    expect(n).toBe(1);
    expect(dip.active).toBe(true);
    expect(dip.nextInS).toBeGreaterThanOrEqual(t.powerDipIntervalS.min);
    for (let i = 0; i < 60 * 1.2; i++) dip.step(1 / 60);
    expect(dip.level(true)).toBeCloseTo(t.powerDipMinLevel);
    for (let i = 0; i < 60 * 2; i++) dip.step(1 / 60);
    expect(dip.active).toBe(false);
    expect(dip.level(true)).toBe(1);
  });
});

describe('krzywa powerLevel', () => {
  const samples = (flashes: boolean) =>
    Array.from({ length: Math.round(t.powerDipDurationS * 600) + 1 }, (_, i) =>
      powerLevel(i / 600, t, flashes),
    );

  it('mieści się w 0..1, osiąga minimum, wraca do 1 i ma mrugnięcia', () => {
    const s = samples(true);
    expect(Math.min(...s)).toBeCloseTo(t.powerDipMinLevel);
    expect(Math.max(...s)).toBe(1);
    for (const v of s) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(powerLevel(t.powerDipDurationS, t, true)).toBe(1);
    expect(powerLevel(-1, t, true)).toBe(1);
    const held = s.filter((v) => v <= t.powerDipMinLevel + 1e-9).length / 600;
    expect(held).toBeGreaterThan(0.9);
    // Mrugnięcia: wejścia w poziom mrugnięcia (3 na starcie + 1 przy powrocie).
    let blinks = s[0] === t.powerDipBlinkLevel ? 1 : 0;
    for (let i = 1; i < s.length; i++)
      if (s[i] === t.powerDipBlinkLevel && s[i - 1] !== t.powerDipBlinkLevel)
        blinks++;
    expect(blinks).toBe(t.powerDipBlinkCount + 1);
  });

  it('wariant bez błysków nie skacze (krok klatki) i też schodzi do minimum', () => {
    const s = Array.from({ length: 151 }, (_, i) =>
      powerLevel(i / 60, t, false),
    );
    for (let i = 1; i < s.length; i++)
      expect(Math.abs(s[i]! - s[i - 1]!)).toBeLessThan(0.06);
    expect(Math.min(...s)).toBeCloseTo(t.powerDipMinLevel);
    expect(s[0]).toBe(1);
    expect(s.at(-1)).toBeCloseTo(1, 1);
  });
});

describe('komentarz po powrocie prądu', () => {
  const comments = [
    { npc: 'a', text: 'a1' },
    { npc: 'a', text: 'a2' },
    { npc: 'b', text: 'b1' },
  ];
  const npcs = [
    { id: 'c', position: { x: 1, y: 0, z: 0 } },
    { id: 'b', position: { x: 5, y: 0, z: 0 } },
    { id: 'a', position: { x: 9, y: 0, z: 0 } },
  ];
  const origin = { x: 0, y: 1, z: 0 };

  it('wybiera najbliższego NPC z wpisem, pomija bez wpisu, losuje kwestię z jego puli', () => {
    const picked = pickDipComment(
      comments,
      npcs,
      origin,
      14,
      new Rng('p'),
      false,
    );
    expect(picked).toEqual({ npc: 'b', text: 'b1' });
    const near = [{ ...npcs[2]!, position: { x: 1, y: 0, z: 0 } }, npcs[1]!];
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++)
      seen.add(
        pickDipComment(comments, near, origin, 14, new Rng(`s${i}`), false)!
          .text,
      );
    expect(seen).toEqual(new Set(['a1', 'a2']));
  });

  it('respektuje promień i blokadę', () => {
    const rng = new Rng('p');
    expect(pickDipComment(comments, npcs, origin, 4, rng, false)).toBeNull();
    expect(pickDipComment(comments, npcs, origin, 14, rng, true)).toBeNull();
    expect(pickDipComment(comments, [], origin, 14, rng, false)).toBeNull();
  });
});

describe('events.pl.json', () => {
  const ids = new Set(npcTexts.npcs.map(({ id }) => id));
  it('przechodzi walidację i zna wszystkich NPC', () => {
    expect(loadHubEvents(events, ids).powerDip.length).toBeGreaterThan(0);
  });
  it('odrzuca nieznanego NPC, pusty tekst i brak wpisów', () => {
    expect(() =>
      loadHubEvents({ powerDip: [{ npc: 'nikt', text: 'x' }] }, ids),
    ).toThrow(/Nieznany NPC/);
    expect(() =>
      loadHubEvents({ powerDip: [{ npc: 'iga', text: '' }] }, ids),
    ).toThrow();
    expect(() => loadHubEvents({ powerDip: [] }, ids)).toThrow();
  });
});

describe('mnożnik zasilania w renderze', () => {
  it('globalny poziom jest ograniczony do 0..1', () => {
    setPowerLevel(2);
    expect(getPowerLevel()).toBe(1);
    setPowerLevel(-1);
    expect(getPowerLevel()).toBe(0);
    setPowerLevel(Number.NaN);
    expect(getPowerLevel()).toBe(1);
  });

  it('światła punktowe CityLights mnożą natężenie przez poziom', () => {
    const cam = new PerspectiveCamera(70, 1, 0.1, 100);
    cam.updateMatrixWorld();
    const lights = new CityLights([
      {
        position: { x: 0, y: 3, z: -5 },
        color: '#ffae1a',
        intensity: 4,
        range: 10,
      },
    ]);
    for (let i = 0; i < 200; i++) lights.update(1, 0.1, cam);
    const full = Math.max(...lights.pool.map((l) => l.intensity));
    expect(full).toBeGreaterThan(0);
    setPowerLevel(0.25);
    lights.update(1, 0.1, cam);
    expect(Math.max(...lights.pool.map((l) => l.intensity))).toBeCloseTo(
      full * 0.25,
      5,
    );
    lights.dispose();
  });

  it('wspólne materiały neonów przygasają, a barwa gracza nie', () => {
    const neon = getMaterial('neon_amber');
    const player = getMaterial('player');
    syncMaterials();
    const neonFull = neon.color.clone();
    const playerFull = player.color.clone();
    setPowerLevel(0.5);
    syncMaterials();
    expect(neon.color.r).toBeCloseTo(neonFull.r * 0.5);
    expect(player.color.equals(playerFull)).toBe(true);
    setPowerLevel(1);
    syncMaterials();
    expect(neon.color.equals(neonFull)).toBe(true);
  });
});
