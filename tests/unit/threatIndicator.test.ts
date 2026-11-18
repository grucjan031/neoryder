import { expect, it } from 'vitest';
import {
  selectThreatIndicators,
  type ThreatSource,
} from '../../src/ui/threatIndicator';

const origin = { x: 0, y: 0, z: 0 };
const options = { radiusM: 22, halfAngleDeg: 40, maxIndicators: 4 };
const source = (id: number, x: number, z: number): ThreatSource => ({
  id,
  removed: false,
  current: { position: { x, y: 0, z }, state: 'telegraph', stateTimeS: 0.5 },
});
const select = (sources: ThreatSource[], yaw = 0) =>
  selectThreatIndicators(
    sources,
    new Map(sources.map((s) => [s.id, { kind: 'heavy', durationS: 1 }])),
    origin,
    yaw,
    options,
  );

it('projects left, right and behind in camera coordinates and hides forward', () => {
  const result = select([
    source(1, -2, 0),
    source(2, 2, 0),
    source(3, 0, 2),
    source(4, 0, -2),
  ]);
  expect(result.map((s) => s.angleDeg)).toEqual([-90, 90, 180]);
  expect(select([source(1, -2, 0)], Math.PI / 2)).toEqual([]);
});

it('selects four nearest in range without mutating input', () => {
  const sources = [30, 22, 8, 6, 4, 2].map((x, i) => source(i, x, 0));
  expect(select(sources).map((s) => s.distanceM)).toEqual([2, 4, 6, 8]);
  expect(sources[0]?.current.position.x).toBe(30);
});

it('uses horizontal cone boundary and full 3D distance', () => {
  expect(
    select([
      source(
        1,
        Math.sin((39 * Math.PI) / 180),
        -Math.cos((39 * Math.PI) / 180),
      ),
    ]),
  ).toEqual([]);
  expect(
    select([
      source(
        1,
        Math.sin((41 * Math.PI) / 180),
        -Math.cos((41 * Math.PI) / 180),
      ),
    ]),
  ).toHaveLength(1);
  const high = source(1, 20, 0);
  high.current.position.y = 20;
  expect(select([high])).toEqual([]);
});

it('ignores removed, interrupted, expired and unknown telegraphs', () => {
  const base = source(1, 2, 0);
  for (const state of ['idle', 'swing', 'stunned', 'dead', 'burst'])
    expect(select([{ ...base, current: { ...base.current, state } }])).toEqual(
      [],
    );
  expect(select([{ ...base, removed: true }])).toEqual([]);
  expect(
    select([{ ...base, current: { ...base.current, stateTimeS: 1 } }]),
  ).toEqual([]);
  expect(selectThreatIndicators([base], new Map(), origin, 0, options)).toEqual(
    [],
  );
});

it('preserves kind and simulation progress, including aim and frozen time', () => {
  const s = source(1, 2, 0);
  const sources = [{ ...s, current: { ...s.current, state: 'aim' } }];
  const events = new Map([[1, { kind: 'aim', durationS: 2 }]]);
  const result = selectThreatIndicators(sources, events, origin, 0, options);
  expect(result[0]).toMatchObject({ kind: 'aim', progress: 0.25 });
  expect(selectThreatIndicators(sources, events, origin, 0, options)).toEqual(
    result,
  );
});
