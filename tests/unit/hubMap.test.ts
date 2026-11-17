import hideoutData from '../../src/data/hub/hideout.json';
import { describe, expect, it } from 'vitest';
import { hubMapModel } from '../../src/world/hubMap';
import { loadHubLayout } from '../../src/world/hubSchema';

const layout = loadHubLayout(hideoutData);
const withZones = (zones: unknown) => ({ ...hideoutData, zones });
const zone = (patch: Record<string, unknown> = {}) => ({
  id: 'z',
  label: 'Z',
  rect: { x0: 0, z0: 0, x1: 2, z1: 2 },
  ...patch,
});

describe('zones w układzie', () => {
  it('hideout.json ma strefy z tabeli układu', () => {
    const ids = layout.zones!.map((z) => z.id);
    expect(ids).toEqual(
      expect.arrayContaining(['hall', 'tracks', 'wagon', 'comms', 'market']),
    );
    expect(layout.zones!.length).toBeGreaterThanOrEqual(12);
  });
  it('zły kolor (cyan, czerwień, magenta) jest odrzucany', () => {
    for (const color of ['cyan', 'red', 'magenta', '#00e5ff'])
      expect(() => loadHubLayout(withZones([zone({ color })]))).toThrow();
    expect(() =>
      loadHubLayout(withZones([zone({ color: 'amber' })])),
    ).not.toThrow();
  });
  it('strefa poza obrysem, odwrócony prostokąt i powtórzone id są odrzucane', () => {
    const rect = (x0: number, z0: number, x1: number, z1: number) =>
      zone({ rect: { x0, z0, x1, z1 } });
    expect(() => loadHubLayout(withZones([rect(0, 0, 500, 2)]))).toThrow(
      /obrys/,
    );
    expect(() => loadHubLayout(withZones([rect(2, 0, 0, 2)]))).toThrow();
    expect(() => loadHubLayout(withZones([zone(), zone()]))).toThrow(
      /Powtórzona/,
    );
  });
  it('układ bez zones nadal się ładuje', () => {
    const rest: Record<string, unknown> = { ...hideoutData };
    delete rest.zones;
    expect(loadHubLayout(rest).zones).toBeUndefined();
  });
});

describe('hubMapModel', () => {
  const model = hubMapModel(layout, { x: 0, z: 0.8 }, 0);
  it('normalizuje strefy do 0..1 osobno dla osi, a proporcje niesie aspect', () => {
    for (const z of model.zones) {
      expect(z.x).toBeGreaterThanOrEqual(0);
      expect(z.y).toBeGreaterThanOrEqual(0);
      expect(z.x + z.w).toBeLessThanOrEqual(1 + 1e-9);
      expect(z.y + z.h).toBeLessThanOrEqual(1 + 1e-9);
    }
    expect(model.aspect).toBeGreaterThan(1.3);
    const hall = layout.zones!.find((z) => z.id === 'hall')!.rect;
    const mapped = model.zones.find((z) => z.id === 'hall')!;
    expect((mapped.w * model.aspect) / mapped.h).toBeCloseTo(
      (hall.x1 - hall.x0) / (hall.z1 - hall.z0),
    );
  });
  it('prosty układ: padding 0 daje aspect 2 i pełną ramkę', () => {
    const m = hubMapModel(
      {
        blocks: layout.blocks,
        stations: [],
        zones: [{ id: 'a', label: 'A', rect: { x0: 0, z0: 0, x1: 10, z1: 5 } }],
      },
      { x: 5, z: 2.5 },
      0,
      0,
    );
    expect(m.aspect).toBe(2);
    expect(m.zones[0]).toMatchObject({
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      color: 'white',
    });
    expect(m.player.point).toEqual({ x: 0.5, y: 0.5 });
  });
  it('małe strefy nie dostają podpisu, duże mają go w lewym górnym rogu', () => {
    const caption = (id: string) =>
      model.zones.find((z) => z.id === id)!.caption;
    expect(caption('footbridge')).toBeNull(); // 3 m szerokości
    expect(caption('training')).toBeNull();
    const tracks = model.zones.find((z) => z.id === 'tracks')!;
    expect(caption('tracks')).toMatchObject({ anchor: 'start' });
    expect(caption('tracks')!.x).toBeGreaterThan(tracks.x);
    expect(caption('tracks')!.y).toBeGreaterThan(tracks.y);
    expect(caption('tracks')!.y).toBeLessThan(tracks.y + tracks.h);
  });
  it('podpis rodzica ucieka do prawego rogu, gdy lewy zajmuje dziecko', () => {
    expect(model.zones.find((z) => z.id === 'hall')!.caption).toMatchObject({
      anchor: 'end',
    });
    const peronB = model.zones.find((z) => z.id === 'platform_b')!;
    expect(peronB.caption).toMatchObject({ anchor: 'start' });
  });
  it('strefy zagnieżdżone są rysowane po rodzicu', () => {
    const order = model.zones.map((z) => z.id);
    for (const [child, parent] of [
      ['bar', 'platform_b'],
      ['training', 'hall'],
      ['mezzanine', 'hall'],
      ['wagon', 'tracks'],
    ] as const)
      expect(order.indexOf(child)).toBeGreaterThan(order.indexOf(parent));
  });
  it('gracz: punkt i kierunek (yaw 0 = w górę planu, yaw 90° = w lewo)', () => {
    expect(model.player.headingRad).toBeCloseTo(0);
    const turned = hubMapModel(layout, { x: 10, z: -5 }, Math.PI / 2);
    expect(turned.player.headingRad).toBeCloseTo(-Math.PI / 2);
    expect(turned.player.point.x).toBeGreaterThan(model.player.point.x);
    expect(turned.player.point.y).toBeLessThan(model.player.point.y);
  });
  it('stacje mają kolor napisu, a rekwizyty są punktami', () => {
    const color = Object.fromEntries(
      model.stations.map((s) => [s.id, s.color]),
    );
    expect(color).toEqual({
      missions: 'amber',
      workshop: 'green',
      talents: 'violet',
      arena: 'blue',
    });
    const missions = model.stations.find((s) => s.id === 'missions')!.point;
    const arena = model.stations.find((s) => s.id === 'arena')!.point;
    expect(missions.x).toBeLessThan(arena.x);
    expect(missions.y).toBeLessThan(0.5);
    expect(model.props.map((p) => p.id).sort()).toEqual([
      'bag',
      'jukebox',
      'noodles',
      'radio',
    ]);
    expect(model.props.every((p) => p.point.x >= 0 && p.point.x <= 1)).toBe(
      true,
    );
  });
});
