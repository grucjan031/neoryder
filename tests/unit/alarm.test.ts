import { it, expect, vi } from 'vitest';
import { AlarmGroup } from '../../src/enemies/alarm';
import { Perception } from '../../src/enemies/perception';
import { tuning } from '../../src/core/tuning';
const point = { x: 1, y: 0, z: 2 };
it('alarm obejmuje wyłącznie własną grupę i emituje raz', () => {
  const emit = vi.fn(),
    a = new AlarmGroup('a', emit),
    b = new AlarmGroup('b', emit);
  const create = (g: AlarmGroup, id: number) => {
    const p = new Perception(
      tuning.enemies.perception,
      { groupId: g.id },
      () => true,
    );
    g.members.set(id, p);
    return p;
  };
  const sender = create(a, 1),
    other = create(a, 2),
    outside = create(b, 3);
  sender.alert(point);
  const delay = tuning.enemies.alarm.alarmDelayS;
  a.step(delay / 2, delay);
  expect(other.state).toBe('unaware');
  a.step(delay / 2, delay);
  a.step(delay, delay);
  expect([other.state, other.lastKnown, outside.state]).toEqual([
    'alerted',
    point,
    'unaware',
  ]);
  expect(emit.mock.calls).toEqual([['a']]);
});
it('śmierć zgłaszającego podczas opóźnienia anuluje zgłoszenie', () => {
  const emit = vi.fn(),
    g = new AlarmGroup('a', emit);
  const p = new Perception(
    tuning.enemies.perception,
    { groupId: 'a' },
    () => true,
  );
  g.members.set(1, p);
  p.alert(point);
  g.step(0.1, 0.5);
  g.remove(1);
  g.step(1, 0.5);
  expect(emit).not.toHaveBeenCalled();
});
