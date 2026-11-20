import { describe, it, expect } from 'vitest';
import { RailPayload } from '../../src/world/railPayload';
import type { PayloadStop } from '../../src/world/railPayload';
import type { Vec3 } from '../../src/core/math';
import { tuning } from '../../src/core/tuning';

const p = tuning.prototypes.payload;
const DT = 1 / 60;
const at = (x: number, z = 0): Vec3 => ({ x, y: 0, z });
const route = [at(0), at(100)];
const stops: PayloadStop[] = [
  {
    id: 'a',
    name: 'Brama',
    atM: 40,
    holdS: 3,
    wave: 'wa',
    clearRequired: true,
  },
  {
    id: 'b',
    name: 'Rozjazd',
    atM: 70,
    holdS: 2,
    wave: 'wb',
    clearRequired: false,
  },
];

function create(list: readonly PayloadStop[] = stops) {
  const calls: [string, string][] = [];
  const payload = new RailPayload(route, list, p, {
    reinforce: (wave, id) => calls.push([wave, id]),
  });
  return { payload, calls };
}

type Input = Parameters<RailPayload['step']>[1];

/** Gracz idzie przy wagonie, o ile `input.player` nie jest jawnie daleko. */
function run(
  payload: RailPayload,
  seconds: number,
  input: Partial<Input> & { player?: Vec3 } = {},
): void {
  for (let i = 0; i < Math.round(seconds / DT); i++)
    payload.step(DT, {
      hostiles: [],
      ...input,
      player: input.player ?? payload.position,
    });
}

describe('RailPayload', () => {
  it('czeka na gracza i jedzie z zadaną prędkością, gdy ten jest blisko', () => {
    const { payload } = create();
    run(payload, 2, { player: at(p.pushRadiusM + 5), hostiles: [] });
    expect(payload.status).toBe('waitingPlayer');
    expect(payload.distanceM).toBe(0);
    run(payload, 2);
    expect(payload.status).toBe('moving');
    expect(payload.distanceM).toBeCloseTo(2 * p.speedMps, 1);
    expect(payload.snapshot().progress).toBeCloseTo(payload.distanceM / 100, 5);
  });

  it('zatrzymuje się, gdy wróg stoi w promieniu rywalizacji', () => {
    const { payload } = create();
    run(payload, 1);
    const d = payload.distanceM;
    run(payload, 2, { hostiles: [at(p.contestRadiusM - 1)] });
    expect(payload.status).toBe('contested');
    expect(payload.distanceM).toBe(d);
    run(payload, 1, { hostiles: [at(p.contestRadiusM + 30)] });
    expect(payload.distanceM).toBeGreaterThan(d);
  });

  it('staje na postoju, woła hak raz i rusza po holdS i wyczyszczeniu fali', () => {
    const { payload, calls } = create();
    run(payload, 40 / p.speedMps + 0.5);
    expect(payload.status).toBe('holding');
    expect(payload.distanceM).toBe(40);
    expect(calls).toEqual([['wa', 'a']]);
    // wrogowie żyją po upływie holdS: skład dalej stoi
    run(payload, 5, { hostiles: [at(80)] });
    expect(payload.status).toBe('holding');
    expect(payload.snapshot().holdRemainingS).toBe(0);
    // niewprowadzona jeszcze część fali też blokuje
    run(payload, 1, { pending: 2 });
    expect(payload.status).toBe('holding');
    run(payload, 0.5);
    expect(payload.status).toBe('moving');
    expect(calls).toHaveLength(1);
    expect(payload.distanceM).toBeGreaterThan(40);
  });

  it('postój bez clearRequired rusza po samym holdS', () => {
    const { payload, calls } = create();
    payload.skip();
    payload.skip();
    expect(calls.map((c) => c[1])).toEqual(['a', 'b']);
    expect(payload.snapshot().holdRemainingS).toBe(2);
    // wróg daleko od wagonu, ale żywy
    run(payload, 1.5, { hostiles: [at(90)] });
    expect(payload.status).toBe('holding');
    run(payload, 0.6, { hostiles: [at(90)] });
    expect(payload.distanceM).toBeGreaterThanOrEqual(70);
    expect(payload.status).not.toBe('holding');
  });

  it('kończy sukcesem na końcu trasy i potem nic nie robi', () => {
    const { payload, calls } = create([]);
    run(payload, 100 / p.speedMps + 1);
    expect(payload.status).toBe('arrived');
    expect(payload.distanceM).toBe(100);
    expect(payload.snapshot().progress).toBe(1);
    expect(calls).toHaveLength(0);
    payload.setHp(0);
    expect(payload.status).toBe('arrived');
    expect(payload.skip()).toBe(false);
  });

  it('niszczy się przy HP 0 i staje', () => {
    const { payload } = create();
    run(payload, 1);
    const d = payload.distanceM;
    payload.setHp(0);
    expect(payload.status).toBe('destroyed');
    run(payload, 2);
    expect(payload.distanceM).toBe(d);
    payload.setHp(p.maxHealth);
    expect(payload.status).toBe('destroyed');
    expect(payload.hp).toBe(0);
  });

  it('skip przeskakuje do kolejnych postojów i do końca', () => {
    const { payload, calls } = create();
    expect(payload.skip()).toBe(true);
    expect(payload.distanceM).toBe(40);
    expect(payload.skip()).toBe(true);
    expect(payload.distanceM).toBe(70);
    expect(payload.skip()).toBe(true);
    expect(payload.status).toBe('arrived');
    expect(calls).toHaveLength(2);
  });

  it('liczy pozycję i kierunek na łamanej trasie', () => {
    const bent = new RailPayload([at(0, 0), at(10, 0), at(10, 10)], [], p, {
      reinforce: () => {},
    });
    expect(bent.lengthM).toBe(20);
    expect(bent.poseAt(5).position).toEqual({ x: 5, y: 0, z: 0 });
    expect(bent.poseAt(5).yaw).toBeCloseTo(Math.PI / 2, 5);
    expect(bent.poseAt(15).position).toEqual({ x: 10, y: 0, z: 5 });
    expect(bent.poseAt(15).yaw).toBeCloseTo(0, 5);
    expect(bent.poseAt(99).position).toEqual({ x: 10, y: 0, z: 10 });
  });

  it('odrzuca błędną trasę i postoje', () => {
    const hooks = { reinforce: () => {} };
    const stop = (atM: number, id = 'x'): PayloadStop => ({
      id,
      name: id,
      atM,
      holdS: 1,
      wave: 'w',
      clearRequired: false,
    });
    expect(() => new RailPayload([at(0)], [], p, hooks)).toThrow();
    expect(() => new RailPayload([at(1), at(1)], [], p, hooks)).toThrow();
    expect(() => new RailPayload(route, [stop(0)], p, hooks)).toThrow();
    expect(() => new RailPayload(route, [stop(100)], p, hooks)).toThrow();
    expect(
      () => new RailPayload(route, [stop(50, 'a'), stop(40, 'b')], p, hooks),
    ).toThrow();
  });
});
