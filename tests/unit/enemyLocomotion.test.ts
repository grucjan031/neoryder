import { expect, it } from 'vitest';
import { SIM_DT } from '../../src/core/loop';
import { tuning } from '../../src/core/tuning';
import {
  arrivalSpeed,
  steerVelocity,
  angleDelta,
  turnToward,
} from '../../src/enemies/locomotion';
import { gaitWeights } from '../../src/enemies/enemyAnimation';

it('ogranicza przyspieszenie i hamowanie, dojeżdża do celu bez oscylacji', () => {
  const velocity = { x: 0, z: 0 };
  let x = 0;
  const goal = 3.317;
  const { accelerationMps2: acceleration, brakingMps2: braking } =
    tuning.enemies;
  for (let i = 0; i < 180; i++) {
    const before = velocity.x;
    const desired = Math.min(4.2, arrivalSpeed(goal - x, braking, SIM_DT));
    steerVelocity(velocity, desired, 0, acceleration, braking, SIM_DT);
    expect(velocity.x - before).toBeLessThanOrEqual(
      acceleration * SIM_DT + 1e-8,
    );
    expect(before - velocity.x).toBeLessThanOrEqual(braking * SIM_DT + 1e-8);
    x += velocity.x * SIM_DT;
    expect(x).toBeLessThanOrEqual(goal + 1e-8);
  }
  expect(x).toBeCloseTo(goal, 8);
  expect(velocity.x).toBeCloseTo(0);
});

it('obraca się krótszym łukiem z limitem na krok i miesza trzy chody', () => {
  const turn = turnToward(3, -2, 90, SIM_DT);
  expect(angleDelta(3, turn)).toBeCloseTo((Math.PI / 2) * SIM_DT);
  expect(gaitWeights(0, 4, 0.5)).toEqual([1, 0, 0]);
  expect(gaitWeights(1, 4, 0.5)).toEqual([0.5, 0.5, 0]);
  expect(gaitWeights(3, 4, 0.5)).toEqual([0, 0.5, 0.5]);
  expect(gaitWeights(4, 4, 0.5)).toEqual([0, 0, 1]);
});
