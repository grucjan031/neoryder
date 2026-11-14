import { describe, expect, it } from 'vitest';
import { selectEnemyAnimation } from '../../src/enemies/enemyAnimation';
import { enemySchema } from '../../src/enemies/enemySchema';
import type { EnemySnapshot, EnemyState } from '../../src/enemies/types';
import trooper from '../../src/data/enemies/assaulter.json';
import gunner from '../../src/data/enemies/gunner.json';
import sniper from '../../src/data/enemies/sniper.json';
import shielder from '../../src/data/enemies/shielder.json';
import executor from '../../src/data/enemies/executor.json';

const snapshot = (state: EnemyState, speed = 0): EnemySnapshot => ({
  state,
  speed,
  stateTimeS: 0,
  distance: 0,
  yaw: 0,
  position: { x: 0, y: 0, z: 0 },
});

describe('wybór klipów humanoidów', () => {
  it.each([
    [trooper, 'idle', 'Idle_Loop'],
    [gunner, 'idle', 'Pistol_Idle_Loop'],
    [sniper, 'aim', 'Pistol_Aim_Neutral'],
    [gunner, 'burst', 'Pistol_Shoot'],
    [gunner, 'cooldown', 'Pistol_Aim_Neutral'],
    [trooper, 'telegraph', 'Sword_Idle'],
    [trooper, 'swing', 'Sword_Attack'],
    [executor, 'swing', 'Sword_Attack'],
    [shielder, 'telegraph', 'Punch_Enter'],
    [shielder, 'swing', 'Punch_Cross'],
    [trooper, 'stunned', 'Hit_Chest'],
    [trooper, 'dead', 'Idle_Loop'],
    [trooper, 'recovery', 'Idle_Loop'],
  ] as const)('%s / %s -> %s', (raw, state, clip) => {
    expect(
      selectEnemyAnimation(enemySchema.parse(raw), snapshot(state)).clip,
    ).toBe(clip);
  });
  it('wybiera chód i bieg wg prędkości oraz nie zmienia snapshotu', () => {
    const definition = enemySchema.parse(trooper);
    const slow = snapshot('chase', definition.moveSpeed / 2);
    const before = structuredClone(slow);
    expect(selectEnemyAnimation(definition, slow)).toMatchObject({
      clip: 'Walk_Loop',
      moving: true,
    });
    expect(
      selectEnemyAnimation(
        definition,
        snapshot('reposition', definition.moveSpeed),
      ),
    ).toMatchObject({ clip: 'Jog_Fwd_Loop', moving: true });
    expect(selectEnemyAnimation(definition, snapshot('chase'))).toMatchObject({
      clip: 'Idle_Loop',
      moving: false,
    });
    expect(slow).toEqual(before);
  });
  it('dopasowuje cios do istniejącego okna i pokazuje reakcję na przejęcie', () => {
    const definition = enemySchema.parse(trooper);
    expect(selectEnemyAnimation(definition, snapshot('swing'))).toMatchObject({
      once: true,
      durationS: definition.swingActiveS,
    });
    expect(
      selectEnemyAnimation(definition, {
        ...snapshot('idle'),
        controlled: true,
      }).clip,
    ).toBe('Hit_Head');
  });
});
