import { expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import { tuning } from '../../src/core/tuning';
import { HubChatter } from '../../src/world/hubChatter';
import type { ChatterLine } from '../../src/world/hubChatter';
import { lifeTexts } from '../fixtures/hubLife';

const player = { x: 0, y: 0, z: 0 };
const far = { x: 30, y: 0, z: 0 };
function setup(two = false) {
  const defs = lifeTexts().conversations!;
  if (two) defs.push({ ...defs[0]!, id: 'second', npcs: ['friend'] });
  const kid = { x: 0, y: 0, z: 0 },
    friend = { x: 4, y: 0, z: 0 };
  const bus = new EventBus(),
    lines: ChatterLine[] = [];
  bus.on('hub_chatter_line', (line) => lines.push(line));
  const t = {
    ...tuning.hub,
    chatterLineBaseS: 1,
    chatterLineCharS: 0.1,
    chatterGapS: 0.5,
    chatterCooldownS: 4,
  };
  const chatter = new HubChatter(
    defs,
    new Map([
      ['kid', kid],
      ['friend', friend],
    ]),
    t,
    bus,
  );
  return { chatter, lines, kid, friend, t, defs };
}

it('startuje w promieniu od środka uczestników; bierze ich bieżące pozycje', () => {
  const { chatter, kid, friend } = setup();
  chatter.step(0.1, far, false);
  expect(chatter.line).toBeNull();
  kid.x = 28;
  friend.x = 32;
  chatter.step(0.1, far, false);
  expect(chatter.line).toMatchObject({ conversation: 'hello', npc: 'kid' });
});

it('kwestie, czasy bazowy+znaki, przerwa i pełne odnowienie po ostatniej kwestii', () => {
  const { chatter, lines } = setup();
  chatter.step(0.1, player, false);
  expect(lines).toHaveLength(1);
  expect(chatter.line?.text).toBe('Gotowe?'); // 1 + 7 * 0.1 = 1.7 s
  chatter.step(1.69, player, false);
  expect(chatter.line?.npc).toBe('kid');
  chatter.step(0.02, player, false);
  expect(chatter.line).toBeNull();
  chatter.step(0.48, player, false);
  expect(chatter.line).toBeNull();
  chatter.step(0.02, player, false);
  expect(chatter.line?.npc).toBe('friend');
  chatter.step(1.4, player, false);
  expect(chatter.line).toBeNull();
  expect(lines.map((l) => l.npc)).toEqual(['kid', 'friend']);
  chatter.step(3.9, player, false);
  expect(chatter.line).toBeNull();
  chatter.step(0.11, player, false);
  expect(chatter.line?.npc).toBe('kid');
});

it('wyjście z histerezą przerywa; powrót zaczyna od pierwszej kwestii bez odnowienia', () => {
  const { chatter } = setup();
  chatter.step(0.1, player, false);
  chatter.step(0.1, { ...player, x: 7.5 }, false); // od środka 5,5; promień 5 + margines 1
  expect(chatter.line).not.toBeNull();
  chatter.step(0.1, { ...player, x: 8.1 }, false);
  expect(chatter.line).toBeNull();
  chatter.step(0.1, player, false);
  expect(chatter.line?.npc).toBe('kid');
});

it('stacja i dymek E blokują start oraz przerywają aktywną rozmowę', () => {
  const { chatter, lines } = setup();
  chatter.step(0.1, player, true);
  expect(chatter.line).toBeNull();
  chatter.step(0.1, player, false);
  expect(chatter.line).not.toBeNull();
  chatter.step(0.1, player, true);
  expect(chatter.line).toBeNull();
  chatter.step(0.1, player, false);
  expect(chatter.line?.npc).toBe('kid');
  expect(lines).toHaveLength(2);
});

it('wybiera najbliższą rozmowę i nigdy nie nakłada na nią drugiej', () => {
  const { chatter, lines } = setup(true);
  chatter.step(0.1, { ...player, x: 4 }, false);
  expect(chatter.line?.conversation).toBe('second');
  chatter.step(0.1, player, false);
  expect(chatter.line?.conversation).toBe('second');
  expect(lines).toHaveLength(1);
});

it('debug pomija dystans i cooldown, zmienia rozmowę; E nadal ją przerywa', () => {
  const { chatter } = setup(true);
  expect(chatter.force('missing')).toBe(false);
  expect(chatter.force('hello')).toBe(true);
  chatter.step(0.1, far, false);
  expect(chatter.line?.conversation).toBe('hello');
  chatter.step(4, far, false);
  expect(chatter.line).toBeNull();
  expect(chatter.force('hello')).toBe(true);
  expect(chatter.line?.npc).toBe('kid');
  expect(chatter.force('second')).toBe(true);
  expect(chatter.line?.conversation).toBe('second');
  chatter.step(0.1, far, true);
  expect(chatter.line).toBeNull();
});

it('wyjście podczas przerwy też przerywa; domyślny promień z tuning', () => {
  const { defs, t } = setup();
  delete defs[0]!.radiusM;
  const chatter = new HubChatter(
    defs,
    new Map([
      ['kid', player],
      ['friend', player],
    ]),
    t,
  );
  chatter.step(0.1, { ...player, x: t.chatterRadiusM + 0.01 }, false);
  expect(chatter.line).toBeNull();
  chatter.step(0.1, player, false);
  chatter.step(1.8, player, false);
  expect(chatter.line).toBeNull();
  chatter.step(0.1, far, false);
  chatter.step(0.1, player, false);
  expect(chatter.line?.npc).toBe('kid');
});

it('activeId rozpoznaje wymuszoną rozmowę w przerwie i jawne wyłączenie nakłada cooldown', () => {
  const { chatter } = setup();
  chatter.force('hello');
  chatter.step(1.8, player, false);
  expect(chatter.line).toBeNull();
  expect(chatter.activeId).toBe('hello');
  chatter.interrupt(true);
  chatter.step(0.1, player, false);
  expect(chatter.activeId).toBeNull();
  expect(chatter.force('hello')).toBe(true);
  expect(chatter.activeId).toBe('hello');
});

it('te same kroki i pozycje dają te same zdarzenia', () => {
  const a = setup(),
    b = setup();
  for (let i = 0; i < 1500; i++) {
    const position = i % 300 < 200 ? player : far;
    a.chatter.step(1 / 60, position, i % 100 === 0);
    b.chatter.step(1 / 60, position, i % 100 === 0);
  }
  expect(a.lines).toEqual(b.lines);
  expect(a.chatter.line).toEqual(b.chatter.line);
});

it('pojedyncze powitanie pomija promień, emituje zdarzenie, wygasa i podlega blokadzie E', () => {
  const { chatter, lines, t } = setup();
  const line = { conversation: 'arrival', npc: 'kid', text: 'Witaj!' };
  chatter.say(line);
  expect(lines).toEqual([line]);
  chatter.step(0.1, far, false);
  expect(chatter.line).toEqual(line);
  chatter.step(
    t.chatterLineBaseS + t.chatterLineCharS * line.text.length,
    far,
    false,
  );
  expect(chatter.line).toBeNull();
  chatter.say(line);
  chatter.step(0.1, far, true);
  expect(chatter.line).toBeNull();
});
