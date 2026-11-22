import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import { SIM_DT } from '../../src/core/loop';
import { HubProps, hubPropTextsSchema } from '../../src/world/hubProps';
import { hubPropSchema, loadHubLayout } from '../../src/world/hubSchema';
import { selectHubTarget } from '../../src/world/hubStations';
import { HubPropView } from '../../src/scenes/hubPropView';
import hideout from '../../src/data/hub/hideout.json';
import texts from '../../src/data/hub/props.pl.json';

const layout = loadHubLayout(hideout);
function setup() {
  const bus = new EventBus();
  const used: string[] = [];
  bus.on('hub_prop_used', ({ prop }) => used.push(prop));
  return {
    props: new HubProps(
      layout.props!,
      structuredClone(tuning.hub),
      bus,
      new Rng('props'),
      hubPropTextsSchema.parse(texts),
    ),
    used,
  };
}

describe('dane rekwizytów', () => {
  it('waliduje teksty, dodatnie focus i unikalne id', () => {
    expect(hubPropTextsSchema.safeParse(texts).success).toBe(true);
    expect(
      hubPropTextsSchema.safeParse({
        ...texts,
        jukebox: { ...texts.jukebox, tracks: ['x'] },
      }).success,
    ).toBe(false);
    expect(
      hubPropTextsSchema.safeParse({ ...texts, noodles: { lines: [] } })
        .success,
    ).toBe(false);
    const prop = layout.props![0]!;
    expect(() => loadHubLayout({ ...layout, props: [prop, prop] })).toThrow();
    expect(hubPropSchema.safeParse({ ...prop, kind: 'chair' }).success).toBe(
      false,
    );
    expect(
      hubPropSchema.safeParse({
        ...prop,
        focus: { ...prop.focus, size: { x: 0, y: 1, z: 1 } },
      }).success,
    ).toBe(false);
    for (const p of layout.props!) expect(p.label).toBe(texts.labels[p.kind]);
  });

  it('seat wymaga sit, a pozostałe rodzaje go nie przyjmują', () => {
    const seats = layout.props!.filter((p) => p.kind === 'seat');
    expect(seats).toHaveLength(4);
    for (const s of seats)
      expect(hubPropSchema.safeParse(s).success).toBe(true);
    const seat = seats[0]!;
    expect(hubPropSchema.safeParse({ ...seat, sit: undefined }).success).toBe(
      false,
    );
    expect(
      hubPropSchema.safeParse({ ...layout.props![0]!, sit: seat.sit }).success,
    ).toBe(false);
    expect(
      hubPropSchema.safeParse({
        ...seat,
        sit: { ...seat.sit, yawDeg: Infinity },
      }).success,
    ).toBe(false);
  });

  it('siedziska gracza nie leżą na NPC', () => {
    for (const s of layout.props!.filter((p) => p.kind === 'seat'))
      for (const npc of layout.npcs!)
        expect(
          Math.hypot(
            s.sit!.position.x - npc.position.x,
            s.sit!.position.z - npc.position.z,
          ),
          `${s.id} / ${npc.id}`,
        ).toBeGreaterThan(0.8);
  });

  it('wybiera najbliższe trafienie rekwizytu przed NPC i stacją oraz odrzuca zasięg i pudło', () => {
    const focus = (z: number) => ({
      position: { x: 0, y: 1.6, z },
      size: { x: 1, y: 1, z: 0.5 },
    });
    const station = {
      id: 'missions' as const,
      position: { x: 0, z: -3 },
      radius: 1,
      focus: focus(-3),
    };
    const npc = { id: 'npc', focus: focus(-2) };
    const prop = { id: 'prop', focus: focus(-1) };
    const eye = { x: 0, y: 1.6, z: 0 };
    expect(
      selectHubTarget([station], [npc], eye, 0, 0, 3.5, 0, [prop]),
    ).toEqual({ kind: 'prop', id: 'prop' });
    expect(
      selectHubTarget([station], [npc], eye, 0, 0, 0.5, 0, [prop]),
    ).toBeNull();
    expect(selectHubTarget([], [], eye, Math.PI, 0, 3.5, 0, [prop])).toBeNull();
    expect(
      selectHubTarget([station], [npc], eye, 0, 0, 3.5, 0, [
        { ...prop, focus: focus(-3.2) },
      ]),
    ).toEqual({ kind: 'npc', id: 'npc' });
    expect(
      selectHubTarget([station], [], eye, 0, 0, 3.5, 0, [
        { ...prop, focus: focus(-3.2) },
      ]),
    ).toEqual({ kind: 'station', id: 'missions' });
  });
});

it('odnowienie jest per id, miska ma dłuższe; jukebox obiega 0→1→2→0', () => {
  const { props, used } = setup();
  expect(props.track('jukebox')).toBe(0);
  expect(props.use('jukebox', 0)).toBe(true);
  expect(props.track('jukebox')).toBe(1);
  expect(props.use('jukebox', 0)).toBe(false);
  expect(props.use('noodles', 0)).toBe(true);
  expect(props.warmthLeft).toBe(tuning.hub.noodlesWarmthS);
  props.step(tuning.hub.propCooldownS);
  expect(props.use('jukebox', 0)).toBe(true);
  expect(props.track('jukebox')).toBe(2);
  expect(props.use('noodles', 0)).toBe(false);
  props.step(tuning.hub.propCooldownS);
  expect(props.use('jukebox', 0)).toBe(true);
  expect(props.track('jukebox')).toBe(0);
  props.step(tuning.hub.noodlesCooldownS);
  expect(props.warmthLeft).toBe(0);
  expect(props.use('noodles', 0)).toBe(true);
  expect(props.use('missing', 0)).toBe(false);
  expect(used).toEqual(['jukebox', 'noodles', 'jukebox', 'jukebox', 'noodles']);
});

it('miska z zupą stoi na ladzie i przesuwa się podczas podawania', () => {
  const { props } = setup();
  const view = new HubPropView(props, tuning.hub);
  try {
    const bowl = view.root.getObjectByName('hub:soup:noodles')!;
    expect(bowl.children).toHaveLength(2);
    const counter = layout.blocks.find(
      ({ position, size }) => position.z === -17.6 && size.x === 3.6,
    )!;
    expect(bowl.position.y).toBeCloseTo(
      counter.position.y + counter.size.y / 2,
    );
    const restZ = bowl.position.z;
    view.render(1, 0.55);
    expect(bowl.position.z).toBeGreaterThan(counter.position.z);
    expect(bowl.position.z).toBeLessThan(
      counter.position.z + counter.size.z / 2,
    );
    view.render(1, 1);
    expect(bowl.position.z).toBeCloseTo(restZ);
  } finally {
    view.dispose();
  }
});

it('worek dostaje impuls w kierunku spojrzenia, interpoluje i wygasa deterministycznie', () => {
  const a = setup().props,
    b = setup().props;
  const view = new HubPropView(a, tuning.hub);
  for (const props of [a, b]) props.use('bag', -Math.PI / 2);
  expect(a.bags[0]!.velocity.x).toBeGreaterThan(0);
  expect(a.bags[0]!.velocity.z).toBeCloseTo(0);
  a.step(SIM_DT);
  b.step(SIM_DT);
  view.render(0.5);
  expect(view.root.getObjectByName('hub:bag:bag')!.rotation.z).toBeCloseTo(
    -a.bags[0]!.angle.x / 2,
  );
  let peak = 0;
  for (let i = 0; i < 3600; i++) {
    a.step(SIM_DT);
    b.step(SIM_DT);
    peak = Math.max(peak, Math.abs(a.bags[0]!.angle.x));
  }
  expect(peak).toBeGreaterThan(0.1);
  expect(a.bags).toEqual(b.bags);
  expect(a.bags[0]!.angle).toEqual({ x: 0, z: 0 });
  expect(a.bags[0]!.velocity).toEqual({ x: 0, z: 0 });
  view.dispose();
});

it('kwestie Heli są z danych i powtarzalne dla seeda', () => {
  const a = setup().props,
    b = setup().props;
  const lines = Array.from({ length: 30 }, () => a.noodleLine());
  expect(lines).toEqual(Array.from({ length: 30 }, () => b.noodleLine()));
  expect(new Set(lines).size).toBeGreaterThan(1);
  expect(lines.every((line) => texts.noodles.lines.includes(line))).toBe(true);
});

it('strzałki korytarza mieszczą się na podłodze i prowadzą na zachód / wschód', () => {
  const arrows = layout.decals!.filter(
    (d) => d.texture === 'floor_arrow' && d.position.z < -8,
  );
  expect(arrows).toHaveLength(3);
  for (const d of arrows) {
    expect(d.surface).toBe('floor');
    expect(
      layout.blocks.some((b) => {
        const halfX =
          (Math.abs(Math.cos(d.yaw)) * d.size.w +
            Math.abs(Math.sin(d.yaw)) * d.size.h) /
          2;
        const halfZ =
          (Math.abs(Math.sin(d.yaw)) * d.size.w +
            Math.abs(Math.cos(d.yaw)) * d.size.h) /
          2;
        return (
          Math.abs(b.position.y + b.size.y / 2 - (d.position.y - 0.012)) <
            1e-6 &&
          Math.abs(d.position.x - b.position.x) + halfX <= b.size.x / 2 &&
          Math.abs(d.position.z - b.position.z) + halfZ <= b.size.z / 2
        );
      }),
    ).toBe(true);
    expect(d.yaw).toBe(d.position.x < 0 ? Math.PI / 2 : -Math.PI / 2);
  }
  expect(layout.lights).toHaveLength(28);
});
