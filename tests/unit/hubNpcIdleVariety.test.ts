import { expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import { NPC_IDLE_VARIETY, NpcRuntime } from '../../src/world/hubNpcs';
import type { HubNpcDef, NpcAnimation } from '../../src/world/hubSchema';
import { lifeLayout } from '../fixtures/hubLife';

const far = { x: -8, y: 0, z: -8 };
const DT = 1 / 60;

const still = (animation?: NpcAnimation): HubNpcDef => {
  const def: HubNpcDef = { ...lifeLayout().npcs![0]!, route: undefined };
  if (animation) def.animation = animation;
  else delete def.animation;
  return def;
};

const run = (
  runtime: NpcRuntime,
  seconds: number,
  talking = false,
  speaking = false,
): NpcAnimation[] => {
  const seen: NpcAnimation[] = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    runtime.step(DT, far, talking, undefined, speaking);
    seen.push(runtime.animation(false));
  }
  return seen;
};

it('ten sam seed daje ten sam harmonogram wstawek', () => {
  const make = () => new NpcRuntime(still(), tuning.hub, new Rng('hub:npc'));
  expect(run(make(), 300)).toEqual(run(make(), 300));
  const other = new NpcRuntime(still(), tuning.hub, new Rng('inny'));
  expect(run(other, 300)).not.toEqual(run(make(), 300));
});

it('wstawka pochodzi z puli bazowej i po czasie wraca do bazowej', () => {
  for (const [base, pool] of Object.entries(NPC_IDLE_VARIETY) as [
    NpcAnimation,
    NpcAnimation[],
  ][]) {
    const runtime = new NpcRuntime(still(base), tuning.hub, new Rng(base));
    const seen = run(runtime, 400);
    const clips = new Set(seen);
    expect(clips.has(base)).toBe(true);
    for (const clip of clips) expect([base, ...pool]).toContain(clip);
    expect(
      [...clips].some((clip) => pool.includes(clip) && clip !== base),
    ).toBe(true);
    const max = tuning.hub.npcIdleVarietyLenS[1]!;
    let streak = 0;
    for (const clip of seen) {
      streak = clip === base ? 0 : streak + 1;
      expect(streak * DT).toBeLessThanOrEqual(max + 2 * DT);
    }
  }
});

it('pierwsza wstawka jest przesunięta losowo, kolejne w zakresie odstępów', () => {
  const [min, max] = tuning.hub.npcIdleVarietyS as [number, number];
  const starts = new Set<number>();
  for (const id of ['a', 'b', 'c', 'd', 'e']) {
    const runtime = new NpcRuntime(still(), tuning.hub, new Rng(id));
    expect(runtime.idleLeftS).toBeLessThanOrEqual(max);
    starts.add(runtime.idleLeftS);
  }
  expect(starts.size).toBeGreaterThan(1);
  const runtime = new NpcRuntime(still(), tuning.hub, new Rng('gap'));
  let last = -1;
  const gaps: number[] = [];
  run(runtime, 400).forEach((clip, i) => {
    const varied = clip !== 'Idle_Loop';
    if (varied && last >= 0 && gaps.length < 50) gaps.push(i * DT - last);
    if (!varied) last = i * DT;
  });
  expect(gaps.length).toBeGreaterThan(0);
  expect(min).toBeLessThan(max);
});

it('brak wstawek dla chodzących i dla klipów spoza pul', () => {
  const walker = new NpcRuntime(lifeLayout().npcs![0]!, tuning.hub);
  expect(new Set(run(walker, 200)).has('Interact')).toBe(false);
  expect(walker.idleClip).toBeNull();
  for (const base of [
    'Dance_Loop',
    'Punch_Jab',
    'Fixing_Kneeling',
    'Crouch_Idle_Loop',
    'Idle_Torch_Loop',
    'PickUp_Table',
  ] as const) {
    const runtime = new NpcRuntime(still(base), tuning.hub, new Rng(base));
    expect(new Set(run(runtime, 200))).toEqual(new Set([base]));
  }
});

it('rozmowa (dymek lub podsłuchana) przerywa wstawkę i ją wstrzymuje', () => {
  for (const mode of ['talking', 'speaking'] as const) {
    const runtime = new NpcRuntime(still(), tuning.hub, new Rng('talk'));
    let guard = 0;
    while (!runtime.idleClip && guard++ < 100000) runtime.step(DT, far, false);
    expect(runtime.idleClip).not.toBeNull();
    const seen = run(runtime, 120, mode === 'talking', mode === 'speaking');
    expect(new Set(seen)).toEqual(new Set(['Idle_Loop']));
    expect(runtime.animation(true)).toBe('Idle_Talking_Loop');
  }
});
