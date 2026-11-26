import { describe, expect, it } from 'vitest';
import { pathToNode, pickRoomChain } from '../../src/world/roomChain';

const path = Array.from({ length: 12 }, (_, i) => `n${i}`);

describe('pickRoomChain', () => {
  it('nie powtarza pokoju pod rząd przy puli dwuelementowej', () => {
    for (let s = 0; s < 40; s++) {
      const rooms = pickRoomChain(`seed${s}`, path, () => ['run1', 'run2']);
      for (let i = 1; i < rooms.length; i++)
        expect(rooms[i]).not.toBe(rooms[i - 1]);
    }
  });

  it('pula jednoelementowa zawsze daje ten pokój', () => {
    expect(pickRoomChain('x', path, () => ['run1'])).toEqual(
      path.map(() => 'run1'),
    );
  });

  it('jest deterministyczny, a prefiks ścieżki daje ten sam wynik', () => {
    const a = pickRoomChain('s', path, () => ['run1', 'run2']);
    expect(pickRoomChain('s', path, () => ['run1', 'run2'])).toEqual(a);
    expect(
      pickRoomChain('s', path.slice(0, 5), () => ['run1', 'run2']),
    ).toEqual(a.slice(0, 5));
  });

  it('pokój innego typu między walkami przerywa ciąg', () => {
    const rooms = pickRoomChain('s', ['a', 'b', 'c'], (id) =>
      id === 'b' ? ['shop'] : ['run1', 'run2'],
    );
    expect(rooms[1]).toBe('shop');
  });

  it('pathToNode obcina visited do bieżącego węzła', () => {
    expect(pathToNode(['a', 'b', 'c'], 'b')).toEqual(['a', 'b']);
    expect(pathToNode(['a'], 'z')).toEqual(['a', 'z']);
  });
});
