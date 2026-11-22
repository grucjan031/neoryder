import { describe, expect, it } from 'vitest';
import { tuning } from '../../src/core/tuning';
import { RadioQueue, type RadioLine } from '../../src/ui/missionDialogue';

const line = (text: string): RadioLine => ({ speaker: 'szron', text });
const HOLD = 4;

/** Krok kolejki tak, jak robi to `MissionRadio`: nowa karta dostaje swój czas. */
function step(queue: RadioQueue, dt: number): string | null | undefined {
  const next = queue.step(dt);
  if (next) queue.hold(HOLD);
  return next ? next.text : next;
}

/** Teksty kart pokazanych w kolejnych krokach; `null` oznacza schowanie radia. */
function play(queue: RadioQueue, seconds: number, dt = 0.5) {
  const shown: (string | null)[] = [];
  for (let t = 0; t < seconds; t += dt) {
    const next = step(queue, dt);
    if (next !== undefined) shown.push(next);
  }
  return shown;
}

describe('RadioQueue', () => {
  it('pokazuje jedną kartę naraz: kolejna dopiero po czasie poprzedniej', () => {
    const queue = new RadioQueue();
    queue.push([line('a'), line('b'), line('c')], 'tactical');
    expect(step(queue, 0)).toBe('a');
    expect(queue.active?.text).toBe('a');
    expect(queue.pending.tactical).toBe(2);
    // Kolejne zgłoszenia nie podmieniają trwającej karty taktycznej.
    queue.push([line('d')], 'tactical');
    expect(step(queue, HOLD - 0.5)).toBeUndefined();
    expect(queue.active?.text).toBe('a');
    expect(step(queue, 0.5)).toBe('b');
    expect(play(queue, 3 * HOLD + 1)).toEqual(['c', 'd', null]);
    expect(queue.active).toBeUndefined();
  });

  it('bez hosta zgłaszającego walkę kwestie fabularne grają od razu, po taktycznych', () => {
    const queue = new RadioQueue();
    queue.push([line('fabuła')], 'story');
    queue.push([line('ostrzeżenie')], 'tactical');
    expect(play(queue, 3 * HOLD)).toEqual(['ostrzeżenie', 'fabuła', null]);
  });

  it('kwestie fabularne czekają na koniec walki i chwilę spokoju, taktyczne grają w walce', () => {
    const queue = new RadioQueue();
    queue.setCombat(true);
    queue.push([line('fabuła 1'), line('fabuła 2')], 'story');
    queue.push([line('ostrzeżenie')], 'tactical');
    expect(play(queue, 3 * HOLD)).toEqual(['ostrzeżenie', null]);
    expect(queue.pending.story).toBe(2);
    queue.setCombat(false);
    // Sam koniec spotkania nie wystarcza: potrzebne `radioCalmDelayS` ciszy.
    expect(step(queue, tuning.mission.radioCalmDelayS - 0.1)).toBeUndefined();
    expect(step(queue, 0.1)).toBe('fabuła 1');
    expect(queue.active?.priority).toBe('story');
    expect(play(queue, 2 * HOLD + 1)).toEqual(['fabuła 2', null]);
  });

  it('walka wstrzymuje następne kwestie fabularne, ale nie urywa już pokazanej', () => {
    const queue = new RadioQueue();
    queue.setCombat(false);
    queue.push([line('fabuła 1'), line('fabuła 2')], 'story');
    expect(play(queue, tuning.mission.radioCalmDelayS + 0.5)).toEqual([
      'fabuła 1',
    ]);
    queue.setCombat(true);
    expect(play(queue, HOLD + 2)).toEqual([null]);
    expect(queue.pending.story).toBe(1);
  });

  it('ostrzeżenie taktyczne przerywa kartę fabularną, a ta wraca po walce w całości', () => {
    const queue = new RadioQueue();
    queue.push([line('fabuła 1'), line('fabuła 2')], 'story');
    expect(step(queue, 0)).toBe('fabuła 1');
    queue.setCombat(true);
    queue.push([line('ostrzeżenie')], 'tactical');
    expect(step(queue, 1)).toBe('ostrzeżenie');
    expect(queue.active?.priority).toBe('tactical');
    expect(queue.pending.story).toBe(2);
    expect(play(queue, HOLD + 1)).toEqual([null]);
    queue.setCombat(false);
    expect(play(queue, tuning.mission.radioCalmDelayS + 2 * HOLD + 1)).toEqual([
      'fabuła 1',
      'fabuła 2',
      null,
    ]);
  });

  it('karta fabularna przerwana pod koniec swojego czasu liczy się jako przeczytana', () => {
    const queue = new RadioQueue();
    queue.push([line('fabuła 1'), line('fabuła 2')], 'story');
    expect(step(queue, 0)).toBe('fabuła 1');
    queue.setCombat(true);
    queue.push([line('ostrzeżenie')], 'tactical');
    expect(
      step(queue, HOLD * tuning.mission.radioStoryReadFraction + 0.1),
    ).toBe('ostrzeżenie');
    expect(queue.pending.story).toBe(1);
    queue.setCombat(false);
    expect(play(queue, HOLD + tuning.mission.radioCalmDelayS + 1)).toEqual([
      'fabuła 2',
    ]);
  });

  it('w długiej walce jedna kwestia fabularna gra po radioStoryMaxWaitS, kolejna czeka znowu', () => {
    const queue = new RadioQueue();
    queue.setCombat(true);
    queue.push([line('fabuła 1'), line('fabuła 2')], 'story');
    const max = tuning.mission.radioStoryMaxWaitS;
    expect(play(queue, max - 1)).toEqual([]);
    expect(play(queue, 1.5)).toEqual(['fabuła 1']);
    expect(play(queue, max - 2)).toEqual([null]);
    expect(play(queue, 3)).toEqual(['fabuła 2']);
  });

  it('clear usuwa zaległe kwestie i chowa bieżącą kartę przy najbliższym kroku', () => {
    const queue = new RadioQueue();
    queue.push([line('a'), line('b')], 'tactical');
    queue.push([line('fabuła')], 'story');
    expect(step(queue, 0)).toBe('a');
    queue.clear();
    expect(queue.pending).toEqual({ tactical: 0, story: 0 });
    expect(step(queue, 0)).toBeNull();
    // Nowa kwestia po czyszczeniu (faza bossa) zastępuje starą bez czekania.
    queue.push([line('a')], 'tactical');
    expect(step(queue, 0)).toBe('a');
    queue.clear();
    queue.push([line('faza')], 'tactical');
    expect(step(queue, 0)).toBe('faza');
  });

  it('dalsze strony podzielonej kwestii grają przed resztą kolejki tego samego priorytetu', () => {
    const queue = new RadioQueue();
    queue.push([line('strona 1'), line('następna')], 'tactical');
    expect(step(queue, 0)).toBe('strona 1');
    queue.unshift([line('strona 2')], 'tactical');
    expect(play(queue, 3 * HOLD + 1)).toEqual(['strona 2', 'następna', null]);
  });

  it('requeueActive oddaje bieżącą kartę na początek jej kolejki', () => {
    const queue = new RadioQueue();
    queue.push([line('a'), line('b')], 'tactical');
    expect(step(queue, 0)).toBe('a');
    queue.requeueActive();
    expect(queue.active).toBeUndefined();
    expect(step(queue, 0)).toBe('a');
  });
});
