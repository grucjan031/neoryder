import { expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import { HubChatter } from '../../src/world/hubChatter';
import { NpcRuntime, wrapAngle } from '../../src/world/hubNpcs';
import type { HubNpcDef, NpcAnimation } from '../../src/world/hubSchema';
import { lifeLayout, lifeTexts } from '../fixtures/hubLife';

const DT = 1 / 60;
const far = { x: -8, y: 0, z: -8 };

const still = (animation?: NpcAnimation): HubNpcDef => {
  const def: HubNpcDef = { ...lifeLayout().npcs![0]!, route: undefined };
  if (animation) def.animation = animation;
  else delete def.animation;
  return def;
};

it('dymek: klip rozmowy dla Idle_Loop i Sitting_Idle_Loop, także w trakcie wstawki, potem powrót', () => {
  for (const [base, talk] of [
    ['Idle_Loop', 'Idle_Talking_Loop'],
    ['Sitting_Idle_Loop', 'Sitting_Talking_Loop'],
  ] as const) {
    const runtime = new NpcRuntime(still(base), tuning.hub, new Rng('d'));
    runtime.idleClip = 'Interact';
    runtime.idleLeftS = 5;
    expect(runtime.animation(true)).toBe(talk);
    // dymek aktywny: wstawka zostaje wyczyszczona, klip to rozmowa
    runtime.step(DT, far, true, undefined, false);
    expect(runtime.idleClip).toBeNull();
    expect(runtime.animation(true)).toBe(talk);
    // po zniknięciu dymka wraca bazowy
    runtime.step(DT, far, false, undefined, false);
    expect(runtime.animation(false)).toBe(base);
  }
});

const total = (r: NpcRuntime): number => r.look.bodyYaw + r.look.headYaw;
const spin = (
  r: NpcRuntime,
  player: typeof far,
  lookAt?: typeof far | null,
) => {
  for (let i = 0; i < 600; i++)
    r.step(DT, player, false, undefined, false, lookAt);
};

it('cel spojrzenia z rozmowy zastępuje gracza, a dymek (null) zostawia gracza', () => {
  const make = () => new NpcRuntime(still(), tuning.hub, new Rng('l'));
  const east = { ...make().position, x: make().position.x + 2 };
  const west = { ...make().position, x: make().position.x - 2 };
  const toTarget = make();
  spin(toTarget, west, east);
  const toPlayer = make();
  spin(toPlayer, west, null);
  const defaultLook = make();
  spin(defaultLook, west);
  expect(Math.abs(wrapAngle(total(toTarget) - Math.PI / 2))).toBeLessThan(
    Math.abs(wrapAngle(total(toPlayer) - Math.PI / 2)),
  );
  expect(total(toPlayer)).toBeCloseTo(total(defaultLook), 10);
  expect(total(toTarget)).not.toBeCloseTo(total(defaultLook), 3);
});

function chatterOf(npcs: string[], lines: { npc: string; text: string }[]) {
  const pos = new Map<string, { x: number; y: number; z: number }>([
    ['a', { x: 0, y: 0, z: 0 }],
    ['b', { x: 2, y: 0, z: 0 }],
    ['c', { x: 6, y: 0, z: 0 }],
  ]);
  const base = lifeTexts().conversations![0]!;
  const chatter = new HubChatter(
    [{ ...base, id: 'x', npcs, lines, radiusM: 50 }],
    pos,
    {
      ...tuning.hub,
      chatterLineBaseS: 1,
      chatterLineCharS: 0.1,
      chatterGapS: 0.5,
    },
  );
  return { chatter, pos };
}

it('słuchacze patrzą na mówiącego, mówiący na najbliższego uczestnika (też w przerwie)', () => {
  const { chatter, pos } = chatterOf(
    ['a', 'b', 'c'],
    [
      { npc: 'a', text: 'Raz.' },
      { npc: 'c', text: 'Dwa.' },
    ],
  );
  const p = { x: 0, y: 0, z: 0 };
  chatter.step(0.1, p, false);
  expect(chatter.line?.npc).toBe('a');
  expect(chatter.lookTargetFor('b')).toBe(pos.get('a'));
  expect(chatter.lookTargetFor('c')).toBe(pos.get('a'));
  expect(chatter.lookTargetFor('a')).toBe(pos.get('b'));
  chatter.step(1.6, p, false); // koniec kwestii a: przerwa
  expect(chatter.line).toBeNull();
  expect(chatter.lookTargetFor('b')).toBe(pos.get('a'));
  chatter.step(0.6, p, false);
  expect(chatter.line?.npc).toBe('c');
  expect(chatter.lookTargetFor('a')).toBe(pos.get('c'));
  expect(chatter.lookTargetFor('c')).toBe(pos.get('b'));
  expect(chatter.lookTargetFor('nieznany')).toBeNull();
});

it('rozmowy jednoosobowe, powitania i brak rozmowy nie zmieniają celu spojrzenia', () => {
  const { chatter } = chatterOf(['a'], [{ npc: 'a', text: 'Hej.' }]);
  expect(chatter.lookTargetFor('a')).toBeNull();
  chatter.step(0.1, { x: 0, y: 0, z: 0 }, false);
  expect(chatter.lookTargetFor('a')).toBeNull();
  chatter.say({ conversation: 'arrival', npc: 'a', text: 'Witaj.' });
  expect(chatter.lookTargetFor('a')).toBeNull();
  chatter.interrupt();
  expect(chatter.lookTargetFor('a')).toBeNull();
});
