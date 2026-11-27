import { expect, it } from 'vitest';
import {
  auditMap,
  type AuditFinding,
  type AuditMapData,
} from '../../src/world/mapAudit';
import { auditMaps } from '../../tools/levels/mapAuditCatalog';
import baseline from './mapAudit.baseline.json';

const pos = (x = 0, y = 0, z = 0) => ({ x, y, z });
const block = (
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
) => ({ position: pos(x, y, z), size: pos(w, h, d) });
const floor = block(0, -0.5, 0, 20, 1, 20);
const car = { model: 'city_car', position: pos() };
const base: AuditMapData = {
  id: 'fixture',
  playerSpawn: pos(),
  blocks: [floor],
};
function matches(rule: AuditFinding['rule'], data: Partial<AuditMapData>) {
  return auditMap({ ...base, ...data }).filter((f) => f.rule === rule);
}

it('duży model na podłodze lub podeście, mały model, osobny kolider i dach tła', () => {
  expect(matches('noCollisionLargeProp', { decor: [car] })).toMatchObject([
    { severity: 'error', path: 'decor[0]', mapId: 'fixture', position: pos() },
  ]);
  const raised = { ...car, position: pos(0, 2, 0) };
  expect(
    matches('noCollisionLargeProp', {
      blocks: [floor, block(0, 1, 0, 6, 2, 6)],
      decor: [raised],
    }),
  ).toHaveLength(1);
  const proxy = { ...block(0, 0.7, 0, 4, 1.4, 2), visible: false };
  expect(
    matches('noCollisionLargeProp', { blocks: [floor, proxy], decor: [car] }),
  ).toEqual([]);
  expect(
    matches('noCollisionLargeProp', {
      decor: [
        { ...car, scale: 0.1 },
        { ...car, position: pos(0, 5, 0) },
      ],
    }),
  ).toEqual([]);
  const facade = { ...block(0, 5, -14, 8, 10, 4), material: 'facade' };
  expect(
    matches('noCollisionLargeProp', {
      blocks: [floor, facade],
      decor: [{ ...car, position: pos(0, 10, -14) }],
    }),
  ).toEqual([]);
  expect(
    matches('noCollisionLargeProp', {
      blocks: [floor],
      decor: [
        { model: 'lab_blast_door_frame', position: pos(-4, 0, 0) },
        { model: 'lab_bio_scanner_gate', position: pos(4, 0, 0) },
        { model: 'off_glass_partition_door', position: pos(-4, 0, -4) },
        { model: 'off_security_turnstile', position: pos(4, 0, -4) },
        { model: 'city_car', position: pos(0, 0, 6) },
      ],
    }).map((f) => f.path),
  ).toEqual(['decor[4]']);
});

it('spód modelu, elewacja, szyld i oprawa lampy potrzebują podparcia', () => {
  const ac = { model: 'city_ac_unit', position: pos(0, 2, 0) };
  const sign = {
    kind: 'neon',
    position: pos(1, 2, 0),
    size: { w: 1, h: 0.5 },
    yaw: 0,
  };
  const light = { model: 'city_street_lamp', position: pos(-1, 2, 0) };
  const wall = block(0, 2, -0.5, 8, 4, 1);
  expect(
    matches('floatingObject', {
      decor: [ac],
      signs: [sign],
      lights: [light],
    }).map((f) => f.path),
  ).toEqual(['decor[0]', 'lights[0]', 'signs[0]']);
  expect(
    matches('floatingObject', {
      blocks: [floor, wall],
      decor: [ac],
      signs: [sign],
      lights: [light],
    }),
  ).toEqual([]);
  expect(
    matches('floatingObject', { decor: [{ ...ac, position: pos() }] }),
  ).toHaveLength(1);
  expect(
    matches('floatingObject', {
      decor: [car],
      lights: [{ position: pos(0, 6, 0) }],
    }),
  ).toEqual([]);
});

it('oprawa Kurogane wymaga podwieszenia, a terminal mocowania bocznego', () => {
  const lamp = { model: 'wh_ceiling_lamp', position: pos(0, 3.55, 0) };
  const terminal = { model: 'wh_wall_terminal', position: pos(0, 2, 0) };
  const roof = block(0, 4.2, 0, 5, 0.4, 5);
  const wall = block(0, 2, -0.55, 5, 4, 1);
  expect(
    matches('floatingObject', { blocks: [floor, roof], decor: [lamp] }),
  ).toEqual([]);
  expect(
    matches('floatingObject', { blocks: [floor, wall], decor: [terminal] }),
  ).toEqual([]);
  expect(
    matches('floatingObject', { blocks: [floor, wall], decor: [lamp] }),
  ).toHaveLength(1);
  expect(
    matches('floatingObject', { blocks: [floor, roof], decor: [terminal] }),
  ).toHaveLength(1);
  expect(
    matches('floatingObject', {
      decor: [
        { ...lamp, position: pos() },
        { ...terminal, position: pos(3, 0, 0) },
      ],
    }).map((finding) => finding.path),
  ).toEqual(['decor[0]', 'decor[1]']);
});

it.each(['city_lantern_string', 'city_cable_span'])(
  '%s sprawdza oba końce po obrocie i skali',
  (model) => {
    const decor = [
      { model, position: pos(0, 4, 0), yaw: Math.PI / 2, scale: 1.5 },
    ];
    const west = block(0, 2, 7.5, 1, 4, 1),
      east = block(0, 2, -7.5, 1, 4, 1);
    expect(
      matches('floatingObject', { blocks: [floor, west, east], decor }),
    ).toEqual([]);
    expect(
      matches('floatingObject', { blocks: [floor, west], decor }),
    ).toMatchObject([
      { message: expect.stringContaining('1/2'), position: { z: -7.5 } },
    ]);
  },
);

it('wykrywa pustkę za ścianą, toleruje zamocowanie na zewnętrznej fasadzie', () => {
  const island = { ...block(40, -0.5, 0, 4, 1, 4), walkable: true };
  expect(
    matches('noCollisionLargeProp', {
      blocks: [floor, island],
      decor: [{ ...car, position: pos(40, 0, 0) }],
    }),
  ).toEqual([]);
  const facade = { ...block(0, 5, -18, 10, 10, 4), material: 'facade' };
  const blocks = [floor, facade];
  const decor = [
    { ...car, position: pos(0, 1, -13) },
    { model: 'city_antenna', position: pos(0, 10, -18) },
    car,
  ];
  expect(matches('outOfBounds', { blocks, decor }).map((f) => f.path)).toEqual([
    'decor[0]',
  ]);
  const wall = { ...block(0, 2, -8, 20, 4, 1), model: 'wall' };
  const behind = { ...car, scale: 0.5, position: pos(0, 0, -9.8) };
  expect(
    matches('noCollisionLargeProp', { blocks: [floor, wall], decor: [behind] }),
  ).toEqual([]);
  expect(
    matches('outOfBounds', { blocks: [floor, wall], decor: [behind] }),
  ).toHaveLength(1);
});

it('rozróżnia duplikat, przenikanie, styk podłogi i strefę interakcji', () => {
  const crate = { ...block(0, 0.5, 0, 1, 1, 1), model: 'crate' };
  expect(
    matches('overlap', {
      blocks: [floor, crate],
      props: [
        { kind: 'crate', position: crate.position },
        { kind: 'bossSpawn', position: crate.position },
      ],
    }),
  ).toMatchObject([{ path: 'props[0]', severity: 'warn' }]);
  expect(matches('overlap', { decor: [car, car] })).toMatchObject([
    { path: 'decor[1]', severity: 'error' },
  ]);
  expect(
    matches('overlap', {
      decor: [car],
      blocks: [floor, block(0, 1, 0, 4, 2, 2)],
    }),
  ).toHaveLength(1);
  const long = { ...car, yaw: Math.PI / 4 };
  expect(
    matches('overlap', {
      decor: [long, { ...long, position: pos(1.6, 0, 1.6) }],
    }),
  ).toEqual([]);
  expect(
    matches('overlap', { decor: [car], props: [{ kind: 'seat' }] }),
  ).toEqual([]);
});

it.each(['#ff0010', '#00e5ff', '#ff2bd6'])(
  'sprawdza HSV %s w kolorach światła, emisji, szyldu i materiału',
  (color) => {
    const data = (hex: string) => ({
      lights: [{ position: pos(), color: hex }],
      signs: [{ position: pos(), size: { w: 1, h: 1 }, yaw: 0, tint: hex }],
      blocks: [{ ...floor, material: hex }],
      decor: [{ ...car, emissive: hex }],
    });
    expect(matches('forbiddenColor', data(color)).map((f) => f.path)).toEqual([
      'blocks[0].material',
      'decor[0].emissive',
      'signs[0].tint',
      'lights[0].color',
    ]);
    for (const hex of ['#ffae1a', '#efeeee', '#661011', '#8a5cff'])
      expect(matches('forbiddenColor', data(hex))).toEqual([]);
  },
);

it('raportuje osobno brakujące warstwy oprawy', () => {
  expect(matches('emptyRoom', {}).map((f) => f.path)).toEqual([
    'lights',
    'decor',
    'signs',
  ]);
  expect(
    matches('emptyRoom', {
      lights: [{ position: pos() }],
      decor: [car],
      signs: [{ position: pos(), size: { w: 1, h: 1 }, yaw: 0 }],
    }),
  ).toEqual([]);
});

it('każda mapa ma próg błędów', () => {
  expect([...auditMaps.keys()].sort()).toEqual(Object.keys(baseline).sort());
});
it('run7 przechodzi audyt także bez ostrzeżeń', () => {
  expect(auditMap(auditMaps.get('run7')!, { mapId: 'run7' })).toEqual([]);
});
it.each(Object.entries(baseline))(
  '%s mieści się w bazowej liczbie error (%i)',
  (mapId, limit) => {
    const findings = auditMap(auditMaps.get(mapId)!, { mapId }).filter(
      (f) => f.severity === 'error',
    );
    expect(
      findings.length,
      findings.map((f) => f.path + ' ' + f.message).join('\n'),
    ).toBeLessThanOrEqual(limit);
  },
);
