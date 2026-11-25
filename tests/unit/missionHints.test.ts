import { describe, expect, it } from 'vitest';
import mission from '../../src/data/missions/m01-maszty.json';
import { MissionHints } from '../../src/world/missionHints';
import {
  missionSchema,
  missionHintSchema,
} from '../../src/world/missionSchema';

const first = missionHintSchema.parse({
  id: 'a',
  text: 'Skocz {jump}',
  trigger: 'runStart',
  delayS: 2,
  doneOn: [{ event: 'player_jumped', count: 2 }],
});
const second = missionHintSchema.parse({
  id: 'b',
  text: 'Ruszaj',
  trigger: 'event:overheated',
});

describe('MissionHints', () => {
  it('wyświetla po opóźnieniu, chowa po dwóch skokach i zachowuje odstęp w kolejce', () => {
    const model = new MissionHints([first, second]);
    model.trigger('runStart');
    model.event('overheated');
    model.step(0);
    model.step(1);
    expect(model.current).toBeNull();
    model.step(1);
    expect(model.current).toBe(first);
    model.event('player_jumped');
    expect(model.current).toBe(first);
    model.event('player_jumped');
    expect(model.current).toBeNull();
    model.step(0.59);
    expect(model.current).toBeNull();
    model.step(0.02);
    expect(model.current).toBe(second);
    model.step(8.99);
    model.step(0);
    expect(model.current).toBe(second);
    model.step(0.02);
    expect(model.current).toBeNull();
  });
  it('pomija czynność wykonaną przed wyzwalaczem lub podczas oczekiwania', () => {
    for (const before of [true, false]) {
      const model = new MissionHints([first, second]);
      if (before) model.trigger('runStart');
      model.event('player_jumped');
      model.event('player_jumped');
      model.trigger('runStart');
      model.event('overheated');
      model.step(2);
      expect(model.current).toBe(second);
      expect([...model.seen]).toEqual(['b']);
    }
  });
  it('respektuje timeout z danych i historię poprzedniej próby', () => {
    const model = new MissionHints([{ ...second, timeoutS: 1 }]);
    model.event('overheated');
    model.step(0);
    expect(model.current).toBeNull();
    model.step(1);
    expect(model.current?.id).toBe('b');
    model.step(1);
    model.event('overheated');
    model.step(2);
    expect(model.current).toBeNull();
    const retry = new MissionHints([second], [...model.seen]);
    retry.event('overheated');
    retry.step(2);
    expect(retry.current).toBeNull();
  });
  it('sprawdza wyzwalacze, akcje i komplet dziewięciu krótkich instrukcji M01', () => {
    expect(missionSchema.parse(mission).hints).toHaveLength(9);
    for (const hint of mission.hints)
      expect(hint.text.replace(/\{\w+\}/g, '').length).toBeLessThanOrEqual(90);
    for (const trigger of [
      'encounter:patrol',
      'event:',
      'event:health_changed',
      'oops',
    ])
      expect(
        missionSchema.safeParse({ ...mission, hints: [{ ...first, trigger }] })
          .success,
      ).toBe(false);
    expect(
      missionHintSchema.safeParse({ ...first, text: '{interact}' }).success,
    ).toBe(false);
  });
});
