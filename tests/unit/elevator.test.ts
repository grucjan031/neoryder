import { expect, it } from 'vitest';
import { Scene } from 'three';
import { EventBus } from '../../src/core/events';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import type { InputSnapshot } from '../../src/core/input';
import { initPhysics } from '../../src/physics';
import { PlayerController } from '../../src/player/playerController';
import { Elevator } from '../../src/world/elevator';
import { ElevatorCabin } from '../../src/world/elevatorCabin';
import { ElevatorPassengers } from '../../src/world/elevatorPassengers';
import { ArenaNavigation } from '../../src/world/arenaNavigation';
import { loadRoom } from '../../src/world/roomSchema';
import {
  facePoint,
  isElevatorPortalDecor,
} from '../../src/world/elevatorSchema';
import { ElevatorTest } from '../../src/scenes/elevatorTest';
import data from '../../src/data/scenes/elevatorTest.json';

const idle: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};
const room = loadRoom(data),
  def = room.elevators![0]!;
const until = (step: () => void, done: () => boolean, n = 1800) => {
  for (let i = 0; i < n && !done(); i++) step();
  expect(done()).toBe(true);
};

it('kolejka zbiera wezwania po drodze, zmienia kierunek i nie powiela zgłoszeń', () => {
  const bus = new EventBus(),
    car = new Elevator(def, tuning.elevator, bus);
  const arrivals: number[] = [];
  bus.on('elevatorArrived', (e) => arrivals.push(e.stop));
  expect(car.request(9)).toBe(false);
  car.request(2);
  const step = () => car.step(SIM_DT);
  until(step, () => car.state.y > 0.1);
  expect(car.request(1)).toBe(true);
  expect(car.request(1)).toBe(false);
  car.request(0);
  until(step, () => arrivals.length === 3);
  expect(arrivals).toEqual([1, 2, 0]);
  expect(car.state.y).toBe(0);
  expect(JSON.parse(JSON.stringify(car.state))).toEqual(car.state);
});
it('otwiera tylko po zatrzymaniu, czeka na wolny próg i zamyka przed odjazdem', () => {
  const car = new Elevator(def, tuning.elevator);
  car.request(0);
  const step = () => car.step(SIM_DT);
  until(step, () => car.state.phase === 'open');
  car.request(2);
  for (let i = 0; i < 240; i++) car.step(SIM_DT, true);
  expect(car.state.phase).toBe('open');
  until(step, () => car.state.phase === 'moving');
  expect(car.state.door).toBe(0);
  let prev = 0;
  until(
    () => {
      step();
      expect(car.state.y - prev).toBeLessThanOrEqual(
        tuning.elevator.elevatorSpeedMps * SIM_DT + 1e-6,
      );
      prev = car.state.y;
    },
    () => car.state.phase === 'open',
  );
  expect(car.state.y).toBe(9.6);
});
it('waliduje przystanki, kierunek drzwi, podesty i pełną objętość szybu', () => {
  const parse =
    (e: unknown, blocks = data.blocks) =>
    () =>
      loadRoom({ ...data, elevators: [e], blocks });
  expect(parse(def)).not.toThrow();
  expect(
    loadRoom({
      ...data,
      elevators: [
        {
          ...def,
          stops: def.stops.map((s) => ({
            ...s,
            doorSide: s.doorSide.toUpperCase(),
          })),
        },
      ],
    }).elevators?.[0]?.stops.map((s) => s.doorSide),
  ).toEqual(['s', 's', 's']);
  for (const e of [
    { ...def, startStop: 3 },
    { ...def, stops: def.stops.slice(0, 1) },
    { ...def, stops: [...def.stops].reverse() },
    { ...def, stops: [{ y: 0, doorSide: 'w' }, ...def.stops.slice(1)] },
  ])
    expect(parse(e)).toThrow();
  expect(
    parse(def, [
      ...data.blocks,
      {
        position: { x: 0, y: 6, z: 0 },
        size: { x: 1, y: 0.2, z: 1 },
        walkable: false,
      },
    ]),
  ).toThrow(/szyb/);
  expect(() => loadRoom({ ...data, elevators: [def, def] })).toThrow(
    /id windy/,
  );
});
it('przelicza koszt jazdy względem schodów i prowadzi w obie strony', () => {
  const nav = new ArenaNavigation(room);
  const a = room.playerSpawn,
    b = { ...a, y: 9.6 };
  expect(nav.elevatorRoute(a, b)).toMatchObject([
    { id: 'biuro', kind: 'elevator', from: 0, to: 2 },
  ]);
  expect(nav.elevatorRoute(b, a)).toMatchObject([{ from: 2, to: 0 }]);
  expect(nav.path(a, b).at(-1)).toEqual(b);
  const t = structuredClone(tuning);
  t.elevator.elevatorDoorDwellS = 500;
  const stairs = new ArenaNavigation(room, t);
  expect(stairs.elevatorRoute(a, b)).toHaveLength(0);
  expect(stairs.path(a, b).some((p) => p.x > 28)).toBe(true);
  nav.dispose();
  stairs.dispose();
});
it('Rapier przenosi kapsułę gracza w górę i w dół w każdym kroku jazdy', async () => {
  const rapier = await initPhysics(),
    world = new rapier.World({ x: 0, y: tuning.physics.gravity, z: 0 });
  const car = new ElevatorCabin(def, tuning.elevator, world);
  const floors = [car];
  const p = new PlayerController(
    1,
    world,
    { bus: new EventBus(), tuning },
    {
      x: 0,
      y: tuning.player.capsuleHeight / 2 + tuning.player.controllerOffset,
      z: 0,
    },
    undefined,
    {},
    floors,
  );
  try {
    world.step();
    const step = () => {
      car.step(SIM_DT);
      p.step(SIM_DT, idle);
      world.step();
      const s = p.getState(),
        gap = s.position.y - s.height / 2 - car.body.translation().y;
      expect(gap).toBeGreaterThanOrEqual(-0.001);
      expect(gap).toBeLessThan(tuning.player.controllerOffset + 0.003);
      expect(s.grounded).toBe(true);
    };
    for (const stop of [2, 0]) {
      car.request(stop);
      until(step, () => car.state.stop === stop && car.state.phase === 'open');
    }
  } finally {
    p.dispose();
    world.free();
  }
});
it('przeciwnicy z piętra wzywają kabinę i zjeżdżają do gracza w scenie pokoju', async () => {
  class ObservedScene extends ElevatorTest {
    outOnGround() {
      const positions: { y: number; z: number }[] = [];
      this.manager.forEach((e) => positions.push(e.current.position));
      return (
        positions.length >= 2 && positions.every((p) => p.y < 0.1 && p.z > 1.6)
      );
    }
  }
  const bus = new EventBus(),
    scene = new ObservedScene(false);
  const arrivals: number[] = [];
  bus.on('elevatorArrived', (e) => arrivals.push(e.stop));
  try {
    await scene.init(
      {
        bus,
        tuning: structuredClone(tuning),
        rng: new Rng('lift'),
        loop: new GameLoop({ step() {}, render() {} }),
        debug: false,
      },
      new Scene(),
    );
    until(
      () => scene.step(SIM_DT, idle),
      () => scene.outOnGround(),
    );
    expect(arrivals).toEqual([1, 0]);
  } finally {
    scene.dispose();
  }
});
it('drzwi szybowe i kabinowe blokują pusty szyb, otwiera się tylko strona danego przystanku', async () => {
  const rapier = await initPhysics(),
    world = new rapier.World({ x: 0, y: 0, z: 0 });
  const mixed = {
    ...def,
    stops: [def.stops[0]!, { y: 4.8, doorSide: 'e' as const }],
  };
  const cabin = new ElevatorCabin(mixed, tuning.elevator, world);
  const step = () => {
    cabin.step(SIM_DT);
    world.step();
  };
  const blocked = (floor: number, side: 's' | 'e') => {
    const east = side === 'e';
    return !!world.castRay(
      new rapier.Ray(
        { x: east ? 2 : 0, y: floor + 1, z: east ? 0 : 2 },
        { x: east ? -1 : 0, y: 0, z: east ? 0 : -1 },
      ),
      2,
      true,
    );
  };
  try {
    step();
    expect(blocked(0, 's')).toBe(true);
    cabin.request(0);
    until(step, () => cabin.state.phase === 'open');
    expect(blocked(0, 's')).toBe(false);
    expect(blocked(4.8, 'e')).toBe(true);
    cabin.request(1);
    until(step, () => cabin.state.phase === 'moving');
    expect(blocked(0, 's')).toBe(true);
    until(step, () => cabin.state.phase === 'open');
    expect(blocked(0, 's')).toBe(true);
    expect(blocked(4.8, 'e')).toBe(false);
    expect(blocked(4.8, 's')).toBe(true);
  } finally {
    world.free();
  }
});
it('panel wymaga trafienia w zasięgu, na parterze wyłącza DÓŁ', async () => {
  const rapier = await initPhysics(),
    world = new rapier.World({ x: 0, y: 0, z: 0 });
  try {
    const cabin = new ElevatorCabin(def, tuning.elevator, world);
    const button = cabin.buttons.find((b) => b.action === 'up')!;
    const eye = { ...button.position, x: 0 };
    expect(cabin.hitButton(eye, { x: 1, y: 0, z: 0 }, 1.6)?.button).toBe(
      button,
    );
    expect(cabin.hitButton(eye, { x: 1, y: 0, z: 0 }, 0.2)).toBeUndefined();
    expect(cabin.hitButton(eye, { x: 0, y: 0, z: 1 }, 1.6)).toBeUndefined();
    expect(
      cabin.buttonTarget(cabin.buttons.find((b) => b.action === 'down')!),
    ).toBeUndefined();
  } finally {
    world.free();
  }
});
it('ogranicza liczbę pasażerów w kabinie i po waitTimeoutS odsyła na schody', async () => {
  const rapier = await initPhysics(),
    world = new rapier.World({ x: 0, y: 0, z: 0 });
  const nav = new ArenaNavigation(room);
  try {
    const cabin = new ElevatorCabin(
      { ...def, startStop: 1 },
      tuning.elevator,
      world,
    );
    const passengers = new ElevatorPassengers(new Map([[def.id, cabin]]), nav);
    const route = nav.elevatorRoute(
      { x: 0, y: 4.8, z: 6 },
      room.playerSpawn,
    )[0]!;
    const goal = room.playerSpawn;
    cabin.request(1);
    until(
      () => cabin.step(SIM_DT),
      () => cabin.state.phase === 'open',
    );
    for (const id of [1, 2, 3])
      passengers.update(id, route.entry, goal, SIM_DT);
    expect(passengers.waypoints.get(1)!.z).toBeLessThan(1.2);
    expect(passengers.waypoints.get(2)!.z).toBeLessThan(1.2);
    expect(passengers.waypoints.get(3)).toEqual(route.entry);
    passengers.update(3, route.entry, goal, tuning.elevator.waitTimeoutS);
    expect(passengers.waypoints.get(3)!.x).toBeGreaterThan(route.entry.x);
  } finally {
    nav.dispose();
    world.free();
  }
});

it('pasażer w kabinie trzyma drzwi otwarte, a wezwanie je zamyka i rusza', () => {
  const car = new Elevator(def, tuning.elevator);
  car.request(0);
  until(
    () => car.step(SIM_DT, false, true),
    () => car.state.phase === 'open',
  );
  for (let i = 0; i < 600; i++) car.step(SIM_DT, false, true);
  expect(car.state.phase).toBe('open');
  car.request(1);
  until(
    () => car.step(SIM_DT, false, true),
    () => car.state.stop === 1 && car.state.phase === 'open',
  );
  // Bez pasażera drzwi zamykają się po postoju; pasażer w zamkniętej kabinie je otwiera.
  until(
    () => car.step(SIM_DT),
    () => car.state.phase === 'idle',
  );
  car.step(SIM_DT, false, true);
  expect(car.state.phase).toBe('doorsOpening');
});

it('przejście zwalnia się przy elevatorDoorPassFraction, nie dopiero przy pełnym otwarciu', async () => {
  const rapier = await initPhysics(),
    world = new rapier.World({ x: 0, y: 0, z: 0 });
  const car = new ElevatorCabin(def, tuning.elevator, world);
  try {
    const barriers = (
      car as unknown as {
        barriers: {
          part: { stop?: number };
          collider: { isEnabled(): boolean };
        }[];
      }
    ).barriers;
    const here = () =>
      barriers
        .filter((b) => b.part.stop === undefined || b.part.stop === 0)
        .filter((b) => !b.collider.isEnabled()).length;
    car.request(0);
    until(
      () => car.step(SIM_DT),
      () => car.state.door >= tuning.elevator.elevatorDoorPassFraction,
    );
    expect(car.state.door).toBeLessThan(1);
    expect(here()).toBe(2);
    expect(
      barriers.filter((b) => (b.part.stop ?? 0) > 0 && !b.collider.isEnabled()),
    ).toHaveLength(0);
  } finally {
    world.free();
  }
});

it('statyczny portal z danych mapy na przystanku windy z zestawem modeli jest pomijany', () => {
  const lift = { ...def, model: 'res_elevator_cab' };
  const at = facePoint(lift, 's', 4.8);
  const decor = (model: string, dx = 0) => ({
    model,
    position: { x: at.x + dx, y: at.y, z: at.z },
  });
  expect(isElevatorPortalDecor(decor('res_elevator_shaft_door'), [lift])).toBe(
    true,
  );
  expect(isElevatorPortalDecor(decor('res_elevator_call_panel'), [lift])).toBe(
    false,
  );
  expect(
    isElevatorPortalDecor(decor('res_elevator_shaft_door', 3), [lift]),
  ).toBe(false);
  expect(isElevatorPortalDecor(decor('res_elevator_shaft_door'), [def])).toBe(
    false,
  );
});
