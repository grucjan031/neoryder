import { describe, expect, it } from 'vitest';
import { tutorialStepsSchema } from '../../src/data/tutorial/schema';
import { TutorialMachine } from '../../src/data/tutorial/machine';
import { tutorialTextParts } from '../../src/data/tutorial/text';
import stepsData from '../../src/data/tutorial/steps.json';
import { roomDefinitions } from '../../src/world/rooms';

const steps = tutorialStepsSchema.parse(stepsData);
describe('dane samouczka', () => {
  it('waliduje 11 kroków i wyklucza poligon z puli pokojów', () => {
    expect(steps).toHaveLength(11);
    expect(steps.every((step) => step.start !== undefined)).toBe(true);
    expect(roomDefinitions.has('tutorialRange')).toBe(false);
  });
  it('start pozostaje opcjonalny', () => {
    expect(
      tutorialStepsSchema.parse([{ ...stepsData[0], start: undefined }])[0]
        ?.start,
    ).toBeUndefined();
  });
  it.each([
    { condition: { kind: 'unknown' } },
    { condition: { kind: 'event', event: 'invented_event', count: 1 } },
    { text: '' },
    { text: '   ' },
    { text: 'missing' },
    { start: { x: 0, z: 0 } },
    { start: { x: Infinity, z: 0, yawDeg: 0 } },
    { start: { x: 0, z: NaN, yawDeg: 0 } },
    { start: { x: 0, z: 0, yawDeg: Infinity } },
    { start: { x: 10001, z: 0, yawDeg: 0 } },
    { start: { x: 0, z: 0, yawDeg: 1000001 } },
  ])('odrzuca błędny krok %j', (invalid) => {
    expect(() =>
      tutorialStepsSchema.parse([{ ...stepsData[0], ...invalid }]),
    ).toThrow();
  });
});
describe('maszyna kroków', () => {
  it('nie zalicza obejścia belki po ślizgu wykonanym poza nią', () => {
    const machine = new TutorialMachine(steps);
    machine.goTo(3);
    machine.event('dash_used', { user: 1, dir: { x: 0, y: 0, z: -1 } });
    machine.event('slide_started', { user: 1 });
    machine.position({ x: 0, y: 0, z: -5 }, true, 0.15);
    expect(machine.flush()).toBeNull();
    machine.position({ x: 0, y: 0, z: -2 }, true, 0.15, true);
    expect(machine.flush()).toBeNull();
    machine.position({ x: 0, y: 0, z: -5 }, true, 0.15);
    expect(machine.flush()).toBe('advance');
  });
  it('liczy dwa parowania, przechodzi raz i zeruje poprzedni licznik', () => {
    const machine = new TutorialMachine(steps);
    machine.goTo(6);
    machine.event('parry_success', { projectile: 10, attacker: 2 });
    expect(machine.flush()).toBeNull();
    machine.event('parry_success', { projectile: 11, attacker: 2 });
    expect(machine.number).toBe(6);
    expect(machine.flush()).toBe('advance');
    expect(machine.number).toBe(7);
    expect(machine.flush()).toBeNull();
  });
  it('śmierć restartuje tylko finał i wygrywa z równoczesnym wave_cleared', () => {
    const machine = new TutorialMachine(steps);
    machine.goTo(10);
    machine.event('wave_cleared', { wave: 1 });
    machine.event('player_died', { id: 1 });
    expect(machine.flush()).toBe('restart');
    expect(machine.number).toBe(10);
    expect(machine.flush()).toBeNull();
    machine.event('wave_cleared', { wave: 1 });
    expect(machine.flush()).toBe('advance');
    expect(machine.finished).toBe(true);
  });
  it('przegrzanie wymaga schłodzenia i dobycia broni', () => {
    const machine = new TutorialMachine(steps);
    machine.goTo(7);
    machine.event('heat_changed', {
      id: 1,
      current: 100,
      max: 100,
      overheated: true,
    });
    expect(machine.flush()).toBeNull();
    machine.event('held_item_changed', {
      owner: 1,
      held: 'gun',
      weapon: 'blaster',
    });
    expect(machine.flush()).toBeNull();
    machine.event('heat_changed', {
      id: 1,
      current: 0,
      max: 100,
      overheated: false,
    });
    expect(machine.flush()).toBe('advance');
  });
  it('wymaga podwójnego skoku i wylądowania na podeście', () => {
    const machine = new TutorialMachine(steps);
    machine.goTo(2);
    machine.position({ x: 0, y: 2.4, z: 3 }, true, 0.15);
    expect(machine.flush()).toBeNull();
    machine.event('player_jumped', { id: 1, double: true });
    machine.position({ x: 0, y: 2.4, z: 3 }, false, 0.15);
    expect(machine.flush()).toBeNull();
    machine.position({ x: 0, y: 2.4, z: 3 }, true, 0.15);
    expect(machine.flush()).toBe('advance');
  });
  it('combo wymaga trafień w etapach 1–2–3, nie trzech machnięć', () => {
    const machine = new TutorialMachine(steps);
    machine.goTo(4);
    const hit = {
      source: 1,
      target: 2,
      amount: 25,
      tags: ['#melee'],
      point: null,
      dir: null,
      knockback: 0,
      killed: false,
    };
    for (const stage of [1, 2, 3] as const)
      machine.event('melee_swing', { attacker: 1, stage });
    expect(machine.flush()).toBeNull();
    for (const stage of [1, 2, 3] as const) {
      machine.event('melee_swing', { attacker: 1, stage });
      machine.event('damage_dealt', hit);
      machine.event('damage_dealt', hit);
    }
    expect(machine.flush()).toBe('advance');
  });
});
it('teksty korzystają z nadpisań, konfliktów i stałych przycisków myszy', () => {
  expect(
    tutorialTextParts('{dash} {jump} {attack}', { dash: 'KeyV', jump: 'KeyJ' })
      .filter((p) => p.key)
      .map((p) => p.text),
  ).toEqual(['V', 'J', 'LPM']);
  expect(tutorialTextParts('{dash}', { dash: '' })[0]?.text).toContain(
    'brak klawisza',
  );
});
