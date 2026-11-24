import { Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import { resolveBindings, resolveGamepadBindings } from '../../src/core/input';
import { tuning } from '../../src/core/tuning';
import { FppInspect, inspectPose } from '../../src/render/fppInspect';
import { FppViewModel } from '../../src/render/fppViewModel';

const t = tuning.hands.inspect;
const identity = new Matrix4();
const rest = { pos: [0, 0, 0], rot: [0, 0, 0] };

it('wiąże V z oglądaniem, a Y rozróżnia zamianę i oglądanie', () => {
  expect(resolveBindings().KeyV).toBe('inspect');
  expect(resolveGamepadBindings()[3]).toEqual({
    press: 'swap',
    hold: 'inspect',
  });
});

it('zwalnia subskrypcje widoku wraz z obsługą przerwania animacji', () => {
  const bus = new EventBus();
  const view = new FppViewModel(bus, 1);
  expect(bus.listenerCount).toBeGreaterThan(0);
  view.dispose();
  expect(bus.listenerCount).toBe(0);
});

describe.each(['gun', 'blade'] as const)('oglądanie %s', (kind) => {
  it('zaczyna i kończy w spoczynku, a kolejne pozy są blisko siebie', () => {
    const pose = (p: number) => inspectPose(p, t[kind]);
    expect(pose(0)).toEqual(rest);
    expect(pose(1)).toEqual(rest);
    let previous = pose(0);
    for (let i = 1; i <= 1000; i++) {
      const next = pose(i / 1000);
      for (const field of ['pos', 'rot'] as const) {
        const delta = new Vector3(...next[field]).sub(
          new Vector3(...previous[field]),
        );
        expect(delta.length()).toBeLessThan(0.02);
      }
      previous = next;
    }
  });

  it('obraca wokół przesuniętego punktu i pozwala powtórzyć dopiero po połowie', () => {
    const inspect = new FppInspect(t);
    const matrix = () => inspect.matrix(new Matrix4());
    inspect.start(kind);
    inspect.update(t.durationS / 2, kind);
    const halfway = matrix();
    const pose = inspectPose(0.5, t[kind]);
    const pivot = new Vector3(...t.pivot);
    expect(
      pivot
        .clone()
        .applyMatrix4(halfway)
        .distanceTo(pivot.add(new Vector3(...pose.pos))),
    ).toBeLessThan(1e-12);
    expect(halfway.equals(identity)).toBe(false);
    inspect.start(kind);
    expect(matrix()).toEqual(halfway);
    inspect.update(1 / 60, kind);
    inspect.start(kind);
    expect(matrix()).toEqual(identity);
    inspect.update(t.durationS, kind);
    expect(inspect.active).toBe(false);
  });

  it('przerywa bez skoku i wraca do jednostkowej macierzy w cancelS', () => {
    const inspect = new FppInspect(t);
    expect(inspect.matrix(new Matrix4().makeTranslation(1, 2, 3))).toEqual(
      identity,
    );
    inspect.start(kind);
    inspect.update(t.durationS / 2, kind);
    let previous = inspect.matrix(new Matrix4());
    inspect.cancel();
    expect(inspect.matrix(new Matrix4())).toEqual(previous);
    const frames = Math.ceil(t.cancelS * 60);
    for (let frame = 0; frame < frames; frame++) {
      expect(inspect.active).toBe(true);
      inspect.cancel();
      inspect.update(Math.min(1 / 60, t.cancelS - frame / 60), kind);
      const next = inspect.matrix(new Matrix4());
      const delta = next.elements.map((v, i) =>
        Math.abs(v - previous.elements[i]!),
      );
      expect(Math.max(...delta)).toBeLessThan(0.16);
      previous = next;
    }
    expect(inspect.active).toBe(false);
    expect(previous).toEqual(identity);
  });

  it('zmiana przedmiotu uruchamia powrót do spoczynku', () => {
    const inspect = new FppInspect(t);
    inspect.start(kind);
    inspect.update(t.durationS / 2, kind);
    const halfway = inspect.matrix(new Matrix4());
    const other = kind === 'gun' ? 'blade' : 'gun';
    inspect.update(0, other);
    expect(inspect.matrix(new Matrix4())).toEqual(halfway);
    inspect.update(t.cancelS, other);
    expect(inspect.active).toBe(false);
    expect(inspect.matrix(new Matrix4())).toEqual(identity);
  });
});
