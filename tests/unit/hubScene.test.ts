import hideout from '../../src/data/hub/hideout.json';
import { afterEach, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Scene as ThreeScene } from 'three';
import { EventBus } from '../../src/core/events';
import type { InputSnapshot } from '../../src/core/input';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import type { HubStationId } from '../../src/core/metaTypes';
import { Rng } from '../../src/core/rng';
import { createMemorySaveStore } from '../../src/core/save';
import {
  loadMetaManager,
  saveMetaManager,
} from '../../src/progression/metaSave';
import { MetaManager } from '../../src/progression/meta';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import type { ChatterLine } from '../../src/world/hubChatter';
import { tuning } from '../../src/core/tuning';
import { HubScene } from '../../src/scenes/hub';
import { loadHubLayout } from '../../src/world/hubSchema';
import type { HubSceneOptions } from '../../src/scenes/hub';
import { lifeLayout, lifeTexts } from '../fixtures/hubLife';
import type { HubScreenActions, HubScreens } from '../../src/ui/hubScreens';
import { CommandRegistry } from '../../src/ui/debugCommands';

const idle: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};
const walkForward: InputSnapshot = {
  ...idle,
  held: new Set(['moveForward']),
};
const interact: InputSnapshot = {
  ...idle,
  held: new Set(['power2']),
  pressed: new Set(['power2']),
};
const holdInteract: InputSnapshot = { ...idle, held: new Set(['power2']) };

class FakeScreens implements HubScreens {
  shown: { station: HubStationId; actions: HubScreenActions }[] = [];
  hidden = 0;
  disposed = 0;
  refreshed = 0;
  show(station: HubStationId, actions: HubScreenActions): void {
    this.shown.push({ station, actions });
  }
  hide(): void {
    this.hidden++;
  }
  refresh(): void {
    this.refreshed++;
  }
  dispose(): void {
    this.disposed++;
  }
}

// EventBus celowo nie udostępnia licznika w publicznym kontrakcie.
function handlerCount(bus: EventBus): number {
  const handlers = Reflect.get(bus, 'handlers') as Map<unknown, unknown[]>;
  return [...handlers.values()].reduce((total, list) => total + list.length, 0);
}

const active = new Set<HubScene>();
afterEach(() => {
  for (const scene of active) scene.dispose();
  active.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function setup(
  params = '',
  options: HubSceneOptions = {},
  camera?: PerspectiveCamera,
) {
  const bus = new EventBus();
  const baseline = handlerCount(bus);
  const commands = new CommandRegistry();
  const screens = new FakeScreens();
  const navigate = vi.fn();
  const resume = vi.fn();
  const metaStore = createMemorySaveStore();
  const scene = new HubScene({
    screens,
    metaStore,
    navigate,
    params: new URLSearchParams(params),
    loadModels: false,
    ...options,
  });
  const opened: HubStationId[] = [];
  const three = new ThreeScene();
  bus.on('hub_station_opened', ({ station }) => opened.push(station));
  await scene.init(
    {
      bus,
      camera,
      commands,
      rng: new Rng('hub-unit'),
      loop: new GameLoop({ step() {}, render() {} }),
      tuning: structuredClone(tuning),
      debug: true,
      resume,
    },
    three,
  );
  active.add(scene);
  return {
    scene,
    bus,
    commands,
    screens,
    navigate,
    resume,
    opened,
    baseline,
    metaStore,
    three,
  };
}

const position = (scene: HubScene) =>
  scene.query('playerPos') as { x: number; y: number; z: number };

it('Iga odpowiada tylko od strony korytarza, gdy ściana z plakatem nie przesłania celu', async () => {
  const { scene, commands } = await setup();
  commands.execute('hub tp -10 -5.5');
  commands.execute('hub look iga');
  scene.step(SIM_DT, interact);
  expect(scene.query('hubNpc')).toBeNull();
  expect(scene.query('hubTalk')).toBeNull();

  commands.execute('hub tp -10 -9.9');
  commands.execute('hub look iga');
  scene.step(SIM_DT, interact);
  expect(scene.query('hubNpc')).toBe('iga');
  expect(scene.query('hubTalk')).toMatchObject({ id: 'iga' });
});

it('NPC za ladą (niska geometria) odpowiada, także gdy promień przechodzi nad ladą w dolną część ciała', async () => {
  const { scene, commands } = await setup();
  // Pitch -22,5° z oka 1,8 m: promień mija blat (1,1 m) tuż nad nim i trafia w ciało Marka.
  commands.execute('hub tp -25 12.5 180 -22.5');
  scene.step(SIM_DT, idle);
  expect(scene.query('hubNpc')).toBe('marek');
  scene.step(SIM_DT, interact);
  expect(scene.query('hubTalk')).toMatchObject({ id: 'marek' });
});

it('rekwizyt za wysoką ścianą nie reaguje na E, a przez przejście w ścianie tak', async () => {
  const { scene, commands } = await setup();
  commands.execute('hub tp -16.5 -10.65');
  commands.execute('hub look seat_canteen_bench');
  scene.step(SIM_DT, idle);
  expect(scene.query('hubTarget')).toBeNull();
  scene.step(SIM_DT, interact);
  expect(scene.query('hubSeat')).toBeNull();

  commands.execute('hub tp -14.2 -10.65');
  commands.execute('hub look seat_canteen_bench');
  scene.step(SIM_DT, idle);
  expect(scene.query('hubTarget')).toMatchObject({
    kind: 'prop',
    id: 'seat_canteen_bench',
  });
});

it('Węgielka można pogłaskać po podejściu na 2,1 m w poziomie (zasięg XZ, nie 3D od oka)', async () => {
  const { scene, commands } = await setup();
  // Kot leży w (-14.5, 12.5); gracz stoi z boku skrzyni, 2,1 m od niego w poziomie.
  commands.execute('hub tp -16 14.0');
  commands.execute('hub look cat');
  scene.step(SIM_DT, idle);
  expect(scene.query('hubTarget')).toMatchObject({ kind: 'cat' });
  commands.execute('hub tp -18.1 14.0');
  commands.execute('hub look cat');
  scene.step(SIM_DT, idle);
  expect(scene.query('hubTarget')).toBeNull();
});

it('E przy Węgielku uruchamia głaskanie FPP, kładzie kota i raz emituje miauknięcie', async () => {
  const { scene, commands, bus, three } = await setup(
    '',
    {},
    new PerspectiveCamera(),
  );
  const meow = vi.fn();
  bus.on('hub_fauna_sound', meow);
  const hand = three.getObjectByName('hub-cat-pet-hand')!;
  commands.execute('hub tp -14.5 13.5');
  expect(commands.execute('hub look cat')).toBe('Patrzysz na: cat');
  scene.step(SIM_DT, interact);
  scene.render(1);
  expect(hand.visible).toBe(true);
  expect(scene.query('hubFauna')).toMatchObject({ cat: { state: 'lie' } });
  expect(meow).toHaveBeenCalledExactlyOnceWith({
    kind: 'meow',
    point: { x: -14.5, y: 0, z: 12.5 },
  });
  const start = hand.matrix.clone();
  for (let i = 0; i < 20; i++) scene.step(SIM_DT, holdInteract);
  scene.render(1);
  expect(hand.matrix.equals(start)).toBe(false);
  scene.step(SIM_DT, interact);
  expect(meow).toHaveBeenCalledTimes(1);
  for (let i = 0; i < Math.ceil(tuning.hub.catPetDurationS / SIM_DT); i++)
    scene.step(SIM_DT, holdInteract);
  scene.render(1);
  expect(hand.visible).toBe(false);
  expect(meow).toHaveBeenCalledTimes(1);
});

it('rekwizyty działają przez E, debug i atak; przytrzymane E i cooldown nie powtarzają użycia', async () => {
  const { scene, commands, bus } = await setup();
  const used: string[] = [];
  bus.on('hub_prop_used', ({ prop }) => used.push(prop));
  commands.execute('hub tp -6.8 13.9');
  commands.execute('hub look jukebox');
  scene.step(SIM_DT, interact);
  expect(used).toEqual(['jukebox']);
  expect(scene.query('hubProps')).toContainEqual({
    id: 'jukebox',
    kind: 'jukebox',
    cooldownLeft: tuning.hub.propCooldownS,
    track: 1,
  });
  expect(scene.query('hubChatter')).toMatchObject({
    npc: 'Szafa grająca',
    text: 'Deszcz na kredyt',
  });
  for (let i = 0; i < 70; i++) scene.step(SIM_DT, holdInteract);
  expect(used).toEqual(['jukebox']);
  scene.step(SIM_DT, interact);
  expect(used).toEqual(['jukebox', 'jukebox']);
  expect(commands.execute('hub use jukebox')).toBe('false');
  expect(commands.execute('hub use noodles')).toBe('true');
  expect(scene.query('hubChatter')).toMatchObject({ npc: 'hela' });
  expect(commands.execute('hub use noodles')).toBe('false');
  commands.execute('hub tp 18.3 0');
  commands.execute('hub look bag');
  scene.step(SIM_DT, { ...idle, pressed: new Set(['attack']) });
  expect(used.at(-1)).toBe('bag');
  expect(scene.query('hubProps')).toContainEqual(
    expect.objectContaining({ id: 'bag', angle: { x: 0, z: 0 } }),
  );
  scene.step(SIM_DT, idle);
  const props = scene.query('hubProps') as {
    id: string;
    angle?: { z: number };
  }[];
  expect(props.find((p) => p.id === 'bag')!.angle!.z).toBeLessThan(0);
});

it('radio wymusza audycję i drugie E przerywa ją również przed końcem cooldownu', async () => {
  const { scene, commands } = await setup();
  commands.execute('hub tp 5 -18.3');
  commands.execute('hub look radio');
  scene.step(SIM_DT, interact);
  expect(scene.query('hubChatter')).toMatchObject({
    conversation: 'lena_radio_broadcast',
  });
  scene.step(SIM_DT, holdInteract);
  expect(scene.query('hubChatter')).toMatchObject({
    conversation: 'lena_radio_broadcast',
  });
  scene.step(SIM_DT, interact);
  expect(scene.query('hubChatter')).toBeNull();
  scene.step(SIM_DT, idle);
  expect(scene.query('hubChatter')).toBeNull();
});

it('startuje na playerSpawn bez otwartej stacji i bez wrogów', async () => {
  const { scene, screens } = await setup();
  expect(scene.id).toBe('hub');
  expect(scene.query('hubStation')).toBeNull();
  expect(screens.shown).toEqual([]);
  expect(position(scene).x).toBeCloseTo(0);
  expect(position(scene).z).toBeCloseTo(0.8);
  expect(scene.query('enemies')).toBeUndefined();
});

it('hub open pokazuje nakładkę i emituje zdarzenie, hub close ją zamyka i wznawia grę', async () => {
  const { scene, commands, screens, opened, resume } = await setup();
  expect(commands.execute('hub open missions')).toBe('Stacja: missions');
  expect(scene.query('hubStation')).toBe('missions');
  expect(opened).toEqual(['missions']);
  expect(screens.shown.map((entry) => entry.station)).toEqual(['missions']);
  expect(commands.execute('hub open talents')).toContain('już otwarta');
  expect(commands.execute('hub close')).toBe('Zamknięto: missions');
  expect(scene.query('hubStation')).toBeNull();
  expect(screens.hidden).toBe(1);
  expect(resume).toHaveBeenCalledOnce();
  expect(commands.execute('hub close')).toContain('Żadna stacja');
  expect(commands.execute('hub open nieznana')).toContain('Użycie');
});

it('stacja wymaga patrzenia i zbocza E; nakładka ignoruje E, po zamknięciu można otworzyć ją ponownie', async () => {
  const { scene, commands, screens, opened } = await setup();
  commands.execute('hub tp 14.05 13.6 0');
  scene.step(SIM_DT, idle);
  expect(scene.query('hubFocus')).toBeNull();
  scene.step(SIM_DT, interact);
  expect(opened).toEqual([]);
  expect(commands.execute('hub look talents')).toBe('Patrzysz na: talents');
  scene.step(SIM_DT, holdInteract);
  expect(scene.query('hubFocus')).toBe('talents');
  expect(scene.query('hubStation')).toBeNull();
  expect(screens.shown).toEqual([]);
  scene.step(SIM_DT, interact);
  expect(scene.query('hubStation')).toBe('talents');
  expect(opened).toEqual(['talents']);
  scene.step(SIM_DT, interact);
  expect(screens.shown).toHaveLength(1);
  expect(opened).toEqual(['talents']);
  screens.shown[0]!.actions.close();
  expect(scene.query('hubStation')).toBeNull();
  for (let i = 0; i < 10; i++) scene.step(SIM_DT, holdInteract);
  expect(opened).toEqual(['talents']);
  scene.step(SIM_DT, idle);
  scene.step(SIM_DT, interact);
  expect(opened).toEqual(['talents', 'talents']);
});

it.each([false, true])(
  'odrzuca zaległe E po zamknięciu nakładki (kroki przy otwartej: %s)',
  async (stepsWhileOpen) => {
    const { scene, commands, screens, opened } = await setup();
    commands.execute('hub tp 14.05 13.6');
    commands.execute('hub look talents');
    scene.step(SIM_DT, interact);
    expect(scene.query('hubStation')).toBe('talents');
    // E przy otwartej nakładce: snapshot może zostać dostarczony dopiero po wznowieniu pętli.
    if (stepsWhileOpen) scene.step(SIM_DT, interact);
    screens.shown[0]!.actions.close();
    scene.step(SIM_DT, interact);
    expect(scene.query('hubStation')).toBeNull();
    scene.step(SIM_DT, holdInteract);
    expect(opened).toEqual(['talents']);
    scene.step(SIM_DT, idle);
    scene.step(SIM_DT, interact);
    expect(scene.query('hubStation')).toBe('talents');
    expect(opened).toEqual(['talents', 'talents']);
  },
);

it.each(['workshop', 'missions', 'talents', 'arena'] as const)(
  'hub look i E otwierają stację %s tylko w zasięgu',
  async (id) => {
    const { scene, commands, opened } = await setup();
    const stations = scene.query('stations') as {
      id: HubStationId;
      x: number;
      z: number;
    }[];
    const station = stations.find((station) => station.id === id)!;
    commands.execute(`hub tp ${station.x} ${station.z}`);
    commands.execute(`hub look ${id}`);
    scene.step(SIM_DT, idle);
    expect(scene.query('hubFocus')).toBe(id);
    expect(scene.query('hubStation')).toBeNull();
    scene.step(SIM_DT, interact);
    expect(opened).toEqual([id]);
    commands.execute('hub close');
    commands.execute('hub tp 0 0.8');
    commands.execute(`hub look ${id}`);
    scene.step(SIM_DT, interact);
    expect(scene.query('hubFocus')).toBeNull();
    expect(scene.query('hubStation')).toBeNull();
    expect(commands.execute('hub look nieznana')).toContain('Użycie');
    expect(commands.execute(`hub look ${id} extra`)).toContain('Użycie');
  },
);

it('przy otwartej nakładce ruch gracza jest zatrzymany', async () => {
  const { scene, commands } = await setup();
  commands.execute('hub open workshop');
  const before = position(scene);
  for (let i = 0; i < 30; i++) scene.step(SIM_DT, walkForward);
  expect(position(scene)).toEqual(before);
  commands.execute('hub close');
  for (let i = 0; i < 30; i++) scene.step(SIM_DT, walkForward);
  expect(position(scene).z).toBeLessThan(before.z - 0.5);
});

it('niecka torów nie jest pułapką: gracz staje na dnie i wychodzi skokiem na peron', async () => {
  const { scene, commands } = await setup();
  commands.execute('hub tp 0 2.0 180');
  for (let i = 0; i < 20; i++) scene.step(SIM_DT, idle);
  for (let i = 0; i < 60; i++) scene.step(SIM_DT, walkForward);
  const inTrough = position(scene);
  expect(inTrough.z).toBeGreaterThan(3.6);
  // Środek kapsuły: dno niecki 0,8 m poniżej peronu, więc oczy nadal ponad dnem.
  expect(inTrough.y).toBeGreaterThan(-0.5);
  expect(inTrough.y).toBeLessThan(0.5);
  commands.execute('hub tp 0 5 0');
  for (let i = 0; i < 20; i++) scene.step(SIM_DT, idle);
  const climb: InputSnapshot = {
    ...idle,
    held: new Set(['moveForward']),
    pressed: new Set(['jump']),
  };
  scene.step(SIM_DT, climb);
  for (let i = 0; i < 80; i++) scene.step(SIM_DT, walkForward);
  expect(position(scene).z).toBeLessThan(3.4);
  expect(position(scene).y).toBeGreaterThan(0.5);
});

it('przycisk poligonu nawiguje, zachowując debug; tablica misji nie dostaje już akcji startRun', async () => {
  const { commands, screens, navigate } = await setup('debug=1');
  commands.execute('hub open missions');
  expect(screens.shown[0]!.actions.openArena).toBeUndefined();
  expect(Object.keys(screens.shown[0]!.actions)).toEqual(['close']);
  commands.execute('hub close');
  commands.execute('hub open arena');
  screens.shown[1]!.actions.openArena?.();
  expect(navigate.mock.calls[0]![0]).toBe('?scene=arena&debug=1');
});

it('wczytuje meta z zapisu, wystawia query meta i level oraz komendy meta zapisujące stan', async () => {
  const { scene, commands, metaStore } = await setup();
  expect((scene.query('meta') as { xp: number }).xp).toBe(0);
  expect(scene.query('level')).toMatchObject({ level: 1, freePoints: 0 });
  expect(commands.execute('meta xp 500')).toContain('Poziom');
  expect((scene.query('level') as { level: number }).level).toBeGreaterThan(1);
  expect(commands.execute('meta threat 3')).toContain('max 3');
  expect((scene.query('meta') as { threat: { max: number } }).threat.max).toBe(
    3,
  );
  await vi.waitFor(async () => {
    const saved = await loadMetaManager(metaStore);
    expect(saved.state.threat.max).toBe(3);
    expect(saved.state.xp).toBe(500);
  });
});

it('zdarzenia meta odświeżają nakładkę, a dispose wyrejestrowuje komendy meta', async () => {
  const { scene, bus, commands, screens } = await setup();
  bus.emit('threat_selected', { level: 0 });
  bus.emit('level_up', { level: 2 });
  expect(screens.refreshed).toBe(2);
  commands.execute('hub open talents');
  expect(commands.execute('meta state')).toContain('"xp"');
  scene.dispose();
  active.delete(scene);
  expect(commands.execute('meta state')).toContain('Nieznana komenda');
});

it('bez debug w URL nawigacja go nie dodaje', async () => {
  const { commands, screens, navigate } = await setup();
  commands.execute('hub open arena');
  screens.shown[0]!.actions.openArena?.();
  expect(navigate).toHaveBeenCalledExactlyOnceWith('?scene=arena');
});

it('dispose nie zostawia subskrypcji EventBus ani komend i zwalnia nakładki', async () => {
  const { scene, bus, commands, screens, baseline } = await setup();
  // Jedna subskrypcja testu (opened) + subskrypcje sceny.
  expect(handlerCount(bus)).toBeGreaterThan(baseline);
  scene.dispose();
  active.delete(scene);
  // Zostaje wyłącznie subskrypcja testu (hub_station_opened).
  expect(handlerCount(bus)).toBe(baseline + 1);
  expect(screens.disposed).toBe(1);
  expect(commands.execute('hub open missions')).toContain('Nieznana komenda');
  expect(() => scene.dispose()).not.toThrow();
});

it.each(hideout.stations)(
  'ze strefy stacji $id spojrzenie w środek focus i E działają',
  async (station) => {
    const { scene, commands, opened } = await setup();
    commands.execute(`hub tp ${station.position.x} ${station.position.z}`);
    commands.execute(`hub look ${station.id}`);
    scene.step(SIM_DT, idle);
    expect(scene.query('hubFocus')).toBe(station.id);
    scene.step(SIM_DT, interact);
    expect(opened).toEqual([station.id]);
  },
);

const npcSpot = (scene: HubScene, id: string) =>
  (scene.query('npcs') as { id: string; x: number; z: number }[]).find(
    (npc) => npc.id === id,
  )!;

it('NPC: spojrzenie pokazuje cel hubNpc, E daje kolejne kwestie w pętli, bez otwierania stacji', async () => {
  const { scene, commands, opened } = await setup();
  const mira = npcSpot(scene, 'mira');
  commands.execute(`hub tp ${mira.x - 1.6} ${mira.z - 0.4}`);
  expect(commands.execute('hub look mira')).toBe('Patrzysz na: mira');
  scene.step(SIM_DT, holdInteract);
  expect(scene.query('hubNpc')).toBe('mira');
  expect(scene.query('hubFocus')).toBeNull();
  expect(scene.query('hubTalk')).toBeNull();
  scene.step(SIM_DT, idle);
  scene.step(SIM_DT, interact);
  const first = scene.query('hubTalk') as { line: string; name: string };
  expect(first.name).toBe('Mira');
  scene.step(SIM_DT, idle);
  scene.step(SIM_DT, interact);
  const second = scene.query('hubTalk') as { line: string };
  expect(second.line).not.toBe(first.line);
  expect(opened).toEqual([]);
  expect(scene.query('hubStation')).toBeNull();
});

it('NPC: dymek znika po npcLineS sekundach i po odejściu gracza', async () => {
  const { scene, commands } = await setup();
  const wolan = npcSpot(scene, 'wolan');
  commands.execute(`hub tp ${wolan.x - 1.6} ${wolan.z - 0.4}`);
  commands.execute('hub look wolan');
  scene.step(SIM_DT, idle);
  scene.step(SIM_DT, interact);
  expect(scene.query('hubTalk')).not.toBeNull();
  for (let i = 0; i < (tuning.hub.npcLineS - 0.5) * 60; i++)
    scene.step(SIM_DT, idle);
  expect(scene.query('hubTalk')).not.toBeNull();
  for (let i = 0; i < 60; i++) scene.step(SIM_DT, idle);
  expect(scene.query('hubTalk')).toBeNull();
  // Odejście gracza kończy rozmowę; komenda debug nie wymaga bliskości.
  commands.execute(`hub tp ${wolan.x - 1.6} ${wolan.z - 0.4}`);
  commands.execute('hub look wolan');
  scene.step(SIM_DT, idle);
  scene.step(SIM_DT, interact);
  expect(scene.query('hubTalk')).not.toBeNull();
  commands.execute('hub tp 0 0.8');
  scene.step(SIM_DT, idle);
  expect(scene.query('hubTalk')).toBeNull();
  commands.execute('hub talk wolan');
  scene.step(SIM_DT, idle);
  expect(scene.query('hubTalk')).not.toBeNull();
});

it('hub talk <npc> pokazuje kwestię bez patrzenia; nieznany NPC daje użycie', async () => {
  const { scene, commands } = await setup();
  expect(commands.execute('hub talk tomasz')).toContain('Stary Tomasz');
  expect((scene.query('hubTalk') as { id: string }).id).toBe('tomasz');
  expect(commands.execute('hub talk nikt')).toContain('Użycie');
  expect(commands.execute('hub talk')).toContain('Użycie');
});

it('NPC mają kolidery: gracz idący w NPC zatrzymuje się przed nim', async () => {
  const { scene, commands } = await setup();
  const szron = npcSpot(scene, 'szron');
  // Gracz idzie w −Z prosto na Szrona (stoi przy tablicy misji).
  commands.execute(`hub tp ${szron.x} ${szron.z + 3} 0`);
  for (let i = 0; i < 20; i++) scene.step(SIM_DT, idle);
  for (let i = 0; i < 45; i++) scene.step(SIM_DT, walkForward);
  // Promień NPC 0,4 m + promień gracza 0,35 m.
  expect(position(scene).z).toBeGreaterThan(szron.z + 0.7);
});

it('NPC zwraca się do gracza w zasięgu i wraca do pozy bazowej po jego odejściu', async () => {
  const { scene, commands } = await setup();
  const yawOf = (id: string): number =>
    (scene.query('npcs') as { id: string; bodyYaw: number }[]).find(
      (npc) => npc.id === id,
    )!.bodyYaw;
  const base = yawOf('szron');
  const szron = npcSpot(scene, 'szron');
  commands.execute(`hub tp ${szron.x + 2} ${szron.z + 2}`);
  scene.step(SIM_DT, idle);
  for (let i = 0; i < 90; i++) {
    scene.step(SIM_DT, idle);
    scene.render(1, SIM_DT);
  }
  // Gracz stoi za plecami Szrona (+X/+Z): tułów obraca się do granicy zakresu, głowa dokończy obrót.
  expect(yawOf('szron')).toBeCloseTo(base + tuning.hub.npcStandBodyMaxRad, 1);
  commands.execute('hub tp 0 0.8');
  scene.step(SIM_DT, idle);
  for (let i = 0; i < 180; i++) {
    scene.step(SIM_DT, idle);
    scene.render(1, SIM_DT);
  }
  expect(Math.cos(yawOf('szron') - base)).toBeCloseTo(1, 2);
});

it('fixture życia: ruch działa bez renderu/DOM, rozmowy emitują zdarzenia, debug i E je przerywają', async () => {
  const { scene, commands, bus } = await setup('', {
    layout: lifeLayout(),
    npcTexts: lifeTexts(),
  });
  const lines: string[] = [];
  const off = bus.on('hub_chatter_line', ({ npc }) => lines.push(npc));
  scene.step(SIM_DT, idle);
  expect(scene.query('hubChatter')).toMatchObject({
    conversation: 'hello',
    npc: 'kid',
  });
  expect(lines).toEqual(['kid']);
  for (let i = 0; i < 30; i++) scene.step(SIM_DT, idle);
  expect(npcSpot(scene, 'kid').x).toBeGreaterThan(0.4);
  const beforeRender = npcSpot(scene, 'kid').x;
  for (let i = 0; i < 10; i++) scene.render(0.5, SIM_DT);
  expect(npcSpot(scene, 'kid').x).toBe(beforeRender);
  commands.execute(`hub tp ${beforeRender} 2`);
  commands.execute('hub look kid');
  scene.step(SIM_DT, idle);
  expect(scene.query('hubNpc')).toBe('kid');
  scene.step(SIM_DT, interact);
  expect(scene.query('hubTalk')).toMatchObject({ id: 'kid' });
  expect(scene.query('hubChatter')).toBeNull();
  const stopped = npcSpot(scene, 'kid').x;
  for (let i = 0; i < 60; i++) scene.step(SIM_DT, idle);
  expect(npcSpot(scene, 'kid').x).toBe(stopped);
  expect(scene.query('hubChatter')).toBeNull();
  commands.execute('hub tp -8 -8');
  for (let i = 0; i < 60; i++) scene.step(SIM_DT, idle);
  expect(npcSpot(scene, 'kid').x).toBeGreaterThan(stopped);
  expect(commands.execute('hub chatter hello')).toBe('Rozmowa: hello');
  scene.step(SIM_DT, idle);
  expect(scene.query('hubChatter')).toMatchObject({ conversation: 'hello' });
  commands.execute('hub talk friend');
  expect(scene.query('hubChatter')).toBeNull();
  commands.execute('hub chatter hello');
  commands.execute('hub open missions');
  expect(scene.query('hubChatter')).toBeNull();
  off();
});

it('fixture życia: kinematyczny NPC ma skalowany walec i zatrzymuje character controller', async () => {
  const { scene, commands } = await setup('', {
    layout: lifeLayout(),
    npcTexts: lifeTexts(),
  });
  // Debugowa rozmowa zatrzymuje trasę także daleko od gracza.
  commands.execute('hub talk kid');
  commands.execute('hub tp 0 2 0');
  for (let i = 0; i < 20; i++) scene.step(SIM_DT, idle);
  for (let i = 0; i < 50; i++) scene.step(SIM_DT, walkForward);
  const kid = npcSpot(scene, 'kid');
  expect(kid.x).toBe(0);
  expect(position(scene).z).toBeGreaterThan(
    0.4 * 0.68 + tuning.player.capsuleRadius - 0.05,
  );
  expect(position(scene).z).toBeLessThan(1);
  const bodies = Reflect.get(scene, 'npcBodies') as {
    body: import('@dimforge/rapier3d-compat').RigidBody;
  }[];
  const body = bodies[0]!.body;
  expect(body.isKinematic()).toBe(true);
  expect(body.collider(0).radius()).toBeCloseTo(0.4 * 0.68);
  expect(body.collider(0).halfHeight()).toBeCloseTo((1.8 * 0.68) / 2);
  commands.execute('hub tp -8 -8');
  for (let i = 0; i < 300; i++) scene.step(SIM_DT, idle);
  expect(body.translation().x).toBeCloseTo(npcSpot(scene, 'kid').x, 5);
  expect(npcSpot(scene, 'kid').x).toBeGreaterThan(0);
});

it('gracz stojący obok trasy NPC nie jest wleczony, a NPC rusza po jego odejściu', async () => {
  const { scene, commands } = await setup('', {
    layout: lifeLayout(),
    npcTexts: lifeTexts(),
  });
  commands.execute('hub tp 0.39 0.7');
  for (let i = 0; i < 180; i++) scene.step(SIM_DT, idle);
  expect(Math.abs(position(scene).x - 0.39)).toBeLessThan(0.05);
  expect(Math.abs(position(scene).z - 0.7)).toBeLessThan(0.05);
  expect(npcSpot(scene, 'kid').x).toBeLessThan(0.5);
  commands.execute('hub tp -8 -8');
  for (let i = 0; i < 120; i++) scene.step(SIM_DT, idle);
  expect(npcSpot(scene, 'kid').x).toBeGreaterThan(1);
});

function arrivalOptions(): HubSceneOptions {
  const layout = lifeLayout();
  // Obaj NPC poza promieniem podsłuchiwanych rozmów; friend bliżej spawnu.
  delete layout.npcs![0]!.route;
  layout.npcs![0]!.position.z = -9;
  layout.npcs![1]!.position.z = -6;
  const npcTexts = lifeTexts();
  for (const npc of npcTexts.npcs)
    npc.reactions = {
      firstVisit: [`${npc.id} pierwszy A`, `${npc.id} pierwszy B`],
      victory: [`${npc.id} wygrana A`, `${npc.id} wygrana B`],
      death: [`${npc.id} porażka A`, `${npc.id} porażka B`],
    };
  return { layout, npcTexts };
}

function advanceArrival(
  scene: HubScene,
  seconds = tuning.hub.arrivalDelayS,
): void {
  for (let i = 0; i < Math.ceil(seconds / SIM_DT) + 1; i++)
    scene.step(SIM_DT, idle);
}

it('powitanie po opóźnieniu wybiera NPC najbliższego spawn i zapisuje klucz przez fałszywe greetings', async () => {
  const greetings = { last: vi.fn(() => null), mark: vi.fn() };
  const { scene, bus, commands } = await setup('', {
    ...arrivalOptions(),
    greetings,
  });
  const lines: ChatterLine[] = [];
  bus.on('hub_chatter_line', (line) => lines.push(line));
  expect(greetings.last).toHaveBeenCalledOnce();
  expect(scene.query('hubArrival')).toEqual({
    kind: 'firstVisit',
    key: 'first-visit',
    greetedNpc: null,
    reacted: [],
    pending: ['kid', 'friend'],
  });
  expect(scene.query('hubChatter')).toBeNull();
  for (let i = 0; i < 149; i++) scene.step(SIM_DT, idle);
  expect(lines).toEqual([]);
  expect(greetings.mark).not.toHaveBeenCalled();
  // Po wejściu gracz podchodzi do kid; wybór nadal odnosi się do spawnu.
  commands.execute('hub tp 8 -9');
  scene.step(SIM_DT, idle);
  scene.step(SIM_DT, idle);
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatchObject({ conversation: 'arrival', npc: 'friend' });
  expect(greetings.mark).toHaveBeenCalledExactlyOnceWith('first-visit');
  expect(scene.query('hubArrival')).toMatchObject({
    greetedNpc: 'friend',
    reacted: [],
  });
});

it('otwarta odprawa misji wstrzymuje powitanie i ruch, jak otwarta stacja', async () => {
  let open = true;
  const { scene, bus } = await setup('', {
    ...arrivalOptions(),
    debriefOpen: () => open,
  });
  const lines: ChatterLine[] = [];
  bus.on('hub_chatter_line', (line) => lines.push(line));
  const before = position(scene);
  advanceArrival(scene, tuning.hub.arrivalDelayS * 2);
  for (let i = 0; i < 30; i++) scene.step(SIM_DT, walkForward);
  expect(lines).toEqual([]);
  expect(position(scene)).toEqual(before);
  open = false;
  advanceArrival(scene);
  expect(lines.filter((line) => line.conversation === 'arrival')).toHaveLength(
    1,
  );
});

it('E daje reakcję każdemu NPC raz, potem zwykłe kwestie; powitanie nie zużywa reakcji', async () => {
  const options = arrivalOptions();
  const { scene, commands } = await setup('', options);
  advanceArrival(scene);
  const greeting = scene.query('hubChatter') as ChatterLine;
  for (const id of ['kid', 'friend']) {
    const npc = npcSpot(scene, id);
    commands.execute(`hub tp ${npc.x} ${npc.z + 2}`);
    commands.execute(`hub look ${id}`);
    scene.step(SIM_DT, idle);
    expect(scene.query('hubNpc')).toBe(id);
    scene.step(SIM_DT, interact);
    const reaction = scene.query('hubTalk') as { line: string };
    const text = options.npcTexts!.npcs.find((npc) => npc.id === id)!;
    expect(text.reactions!.firstVisit).toContain(reaction.line);
    if (id === greeting.npc) expect(reaction.line).not.toBe(greeting.text);
    expect(scene.query('hubChatter')).toBeNull();
    scene.step(SIM_DT, interact);
    expect(scene.query('hubTalk')).toMatchObject({ line: text.lines[0] });
    scene.step(SIM_DT, interact);
    expect(scene.query('hubTalk')).toMatchObject({
      line: text.lines[1 % text.lines.length],
    });
  }
  expect(scene.query('hubArrival')).toMatchObject({
    reacted: ['kid', 'friend'],
  });
});

it('już przywitany kontekst nie emituje powitania ani reakcji w rozmowie', async () => {
  const greetings = { last: () => 'first-visit', mark: vi.fn() };
  const { scene, bus, commands } = await setup('', {
    ...arrivalOptions(),
    greetings,
  });
  const lines: ChatterLine[] = [];
  bus.on('hub_chatter_line', (line) => lines.push(line));
  advanceArrival(scene);
  expect(scene.query('hubArrival')).toBeNull();
  expect(lines).toEqual([]);
  expect(greetings.mark).not.toHaveBeenCalled();
  commands.execute('hub talk friend');
  expect(scene.query('hubTalk')).toMatchObject({ line: 'Witaj.' });
});

it.each(['victory', 'death'] as const)(
  'wczytany run %s ustawia reakcję i pamięta powitanie między wizytami',
  async (outcome) => {
    const metaStore = createMemorySaveStore();
    const meta = createStarterMetaState();
    meta.stats.runs = 1;
    meta.lastRuns = [
      {
        runId: 'saved:42',
        outcome,
        elapsedS: 10,
        layerReached: 1,
        threatLevel: 0,
        rewards: { xp: 0, data: 0, cores: 0 },
      },
    ];
    await saveMetaManager(metaStore, new MetaManager(meta));
    let greeted: string | null = null;
    const greetings = {
      last: () => greeted,
      mark: (key: string) => {
        greeted = key;
      },
    };
    const options = { ...arrivalOptions(), metaStore, greetings };
    const a = await setup('', options);
    expect(a.scene.query('hubArrival')).toMatchObject({
      kind: outcome,
      key: 'saved:42',
    });
    advanceArrival(a.scene);
    const line = a.scene.query('hubChatter') as ChatterLine;
    expect(options.npcTexts!.npcs[1]!.reactions![outcome]).toContain(line.text);
    expect(greeted).toBe('saved:42');
    const b = await setup('', options);
    expect(b.scene.query('hubArrival')).toBeNull();
    b.commands.execute('hub talk friend');
    expect(b.scene.query('hubTalk')).toMatchObject({ line: 'Witaj.' });
  },
);

it('brak localStorage nie powtarza powitania w obrębie wizyty', async () => {
  vi.stubGlobal('localStorage', undefined);
  const { scene, bus } = await setup('', arrivalOptions());
  const lines: ChatterLine[] = [];
  bus.on('hub_chatter_line', (line) => lines.push(line));
  advanceArrival(scene, 20);
  expect(lines.filter((line) => line.conversation === 'arrival')).toHaveLength(
    1,
  );
  expect(scene.query('hubArrival')).toMatchObject({ greetedNpc: 'friend' });
});

it('powitanie czeka na zamknięcie stacji i koniec rozmowy E', async () => {
  const greetings = { last: () => null, mark: vi.fn() };
  const { scene, commands } = await setup('', {
    ...arrivalOptions(),
    greetings,
  });
  commands.execute('hub open missions');
  advanceArrival(scene);
  expect(greetings.mark).not.toHaveBeenCalled();
  commands.execute('hub close');
  commands.execute('hub talk friend');
  advanceArrival(scene);
  expect(greetings.mark).not.toHaveBeenCalled();
  advanceArrival(scene, tuning.hub.npcLineS);
  expect(greetings.mark).toHaveBeenCalledOnce();
});

it('debug wymusza kontekst, czyści reakcje i deterministycznie odtwarza powitanie', async () => {
  const greetings = { last: () => 'first-visit', mark: vi.fn() };
  const { scene, commands } = await setup('', {
    ...arrivalOptions(),
    greetings,
  });
  expect(commands.execute('hub arrive bogus')).toContain('Użycie');
  expect(commands.execute('hub arrive')).toContain('Użycie');
  expect(commands.execute('hub arrive victory extra')).toContain('Użycie');
  for (const kind of ['firstVisit', 'victory', 'death']) {
    expect(commands.execute(`hub arrive ${kind}`)).toBe(`Przybycie: ${kind}`);
    expect(scene.query('hubArrival')).toEqual({
      kind,
      key: `debug:${kind}`,
      greetedNpc: null,
      reacted: [],
      pending: ['kid', 'friend'],
    });
    advanceArrival(scene);
    const first = scene.query('hubChatter');
    commands.execute('hub talk friend');
    expect(scene.query('hubArrival')).toMatchObject({ reacted: ['friend'] });
    const reaction = scene.query('hubTalk');
    commands.execute(`hub arrive ${kind}`);
    expect(scene.query('hubTalk')).toBeNull();
    expect(scene.query('hubArrival')).toMatchObject({
      greetedNpc: null,
      reacted: [],
    });
    advanceArrival(scene);
    expect(scene.query('hubChatter')).toEqual(first);
    commands.execute('hub talk friend');
    expect(scene.query('hubTalk')).toEqual(reaction);
  }
});

class FakeMap {
  isOpen = false;
  disposed = 0;
  toggle(): void {
    this.isOpen = !this.isOpen;
  }
  close(): void {
    this.isOpen = false;
  }
  update(): void {}
  dispose(): void {
    this.disposed++;
  }
}
const mapKey: InputSnapshot = { ...idle, pressed: new Set(['map']) };

it('M przełącza plan stacji, query i komenda hub map działają', async () => {
  const hubMap = new FakeMap();
  const { scene, commands } = await setup('', { hubMap });
  expect(scene.query('hubMap')).toEqual({ open: false });
  scene.step(SIM_DT, mapKey);
  expect(scene.query('hubMap')).toEqual({ open: true });
  scene.step(SIM_DT, mapKey);
  expect(scene.query('hubMap')).toEqual({ open: false });
  expect(commands.execute('hub map')).toContain('otwarty');
  expect(hubMap.isOpen).toBe(true);
  scene.dispose();
  expect(hubMap.disposed).toBe(1);
});

it('otwarty plan blokuje E, a otwarta stacja blokuje M', async () => {
  const hubMap = new FakeMap();
  const { scene, commands, opened } = await setup('', { hubMap });
  commands.execute('hub tp -6 -4.4');
  commands.execute('hub look missions');
  scene.step(SIM_DT, idle);
  scene.step(SIM_DT, mapKey);
  scene.step(SIM_DT, interact);
  expect(opened).toEqual([]);
  scene.step(SIM_DT, mapKey);
  scene.step(SIM_DT, interact);
  expect(opened).toEqual(['missions']);
  scene.step(SIM_DT, mapKey);
  expect(hubMap.isOpen).toBe(false);
  expect(commands.execute('hub map')).toContain('niedostępny');
});

it('hub open zamyka otwarty plan', async () => {
  const hubMap = new FakeMap();
  const { scene, commands } = await setup('', { hubMap });
  scene.step(SIM_DT, mapKey);
  commands.execute('hub open missions');
  expect(hubMap.isOpen).toBe(false);
});

const moveKey: InputSnapshot = { ...idle, pressed: new Set(['moveForward']) };
const SEAT_ID = 'seat_canteen_bench';
const seatDef = () =>
  loadHubLayout(hideout).props!.find((p) => p.id === SEAT_ID)!;
const look = (scene: HubScene) =>
  scene.query('playerLook') as { yaw: number; pitch: number };

async function atSeat(params = '', options: HubSceneOptions = {}) {
  const env = await setup(params, options);
  env.commands.execute('hub tp -16.1 -11.4');
  env.commands.execute(`hub look ${SEAT_ID}`);
  env.scene.step(SIM_DT, idle);
  return env;
}

function settle(scene: HubScene): void {
  for (let i = 0; i < Math.ceil(tuning.hub.sitBlendS / SIM_DT) + 3; i++)
    scene.step(SIM_DT, idle);
}

it('E na siedzisku siada, ruch jest ignorowany, E albo WASD wstaje bez zmiany pozycji', async () => {
  const { scene } = await atSeat();
  expect(scene.query('hubSeat')).toBeNull();
  const before = { ...position(scene) };
  scene.step(SIM_DT, interact);
  expect(scene.query('hubSeat')).toBe(SEAT_ID);
  scene.step(SIM_DT, idle);
  for (let i = 0; i < 30; i++)
    scene.step(SIM_DT, {
      ...walkForward,
      held: new Set(['jump', 'dash', 'moveForward']),
    });
  // Samo przytrzymanie ruchu nie wstaje; pozycja ciała stoi.
  expect(scene.query('hubSeat')).toBe(SEAT_ID);
  expect(position(scene).x).toBeCloseTo(before.x, 2);
  expect(position(scene).z).toBeCloseTo(before.z, 2);
  expect(position(scene).y).toBeCloseTo(before.y, 2);
  scene.step(SIM_DT, interact);
  expect(scene.query('hubSeat')).toBeNull();
  scene.step(SIM_DT, interact);
  expect(scene.query('hubSeat')).toBe(SEAT_ID);
  scene.step(SIM_DT, idle);
  scene.step(SIM_DT, moveKey);
  expect(scene.query('hubSeat')).toBeNull();
  expect(position(scene).z).toBeCloseTo(before.z, 2);
});

it('siedząc, yaw jest ograniczony do sitYawLimitDeg wokół yawDeg, pitch jak zwykle', async () => {
  const { scene } = await atSeat();
  scene.step(SIM_DT, interact);
  settle(scene);
  const center = (seatDef().sit!.yawDeg * Math.PI) / 180;
  const limit = (tuning.hub.sitYawLimitDeg * Math.PI) / 180;
  for (const x of [-1e5, 1e5]) {
    scene.step(SIM_DT, { ...idle, lookDelta: { x, y: 0 } });
    const yaw = look(scene).yaw;
    expect(Math.abs(yaw - center)).toBeLessThanOrEqual(limit + 1e-6);
    expect(Math.abs(yaw - center)).toBeGreaterThan(limit - 1e-3);
  }
  scene.step(SIM_DT, { ...idle, lookDelta: { x: 0, y: -1e5 } });
  expect(look(scene).pitch).toBeGreaterThan(0.5);
});

it('mapa, stacja i dymek blokują siadanie; hub sit / hub stand działają', async () => {
  const { scene, commands } = await atSeat('', { hubMap: new FakeMap() });
  scene.step(SIM_DT, mapKey);
  scene.step(SIM_DT, interact);
  expect(scene.query('hubSeat')).toBeNull();
  expect(commands.execute(`hub sit ${SEAT_ID}`)).toContain('Nie można');
  scene.step(SIM_DT, mapKey);
  commands.execute('hub open missions');
  expect(commands.execute(`hub sit ${SEAT_ID}`)).toContain('Nie można');
  commands.execute('hub close');
  commands.execute('hub talk tomasz');
  expect(scene.query('hubTalk')).not.toBeNull();
  expect(commands.execute(`hub sit ${SEAT_ID}`)).toContain('Nie można');
  for (let i = 0; i < 400 && scene.query('hubTalk'); i++)
    scene.step(SIM_DT, idle);
  expect(commands.execute('hub sit')).toContain('hub sit');
  expect(commands.execute('hub sit jukebox')).toContain('Nie można');
  expect(commands.execute(`hub sit ${SEAT_ID}`)).toContain(SEAT_ID);
  expect(scene.query('hubSeat')).toBe(SEAT_ID);
  expect(commands.execute(`hub sit ${SEAT_ID}`)).toContain('Nie można');
  expect(commands.execute('hub stand')).toContain('Wstałeś');
  expect(scene.query('hubSeat')).toBeNull();
  expect(commands.execute('hub stand')).toContain('Nie siedzisz');
});

it('hub tp zdejmuje siedzenie, a reset też', async () => {
  const { scene, commands } = await atSeat();
  commands.execute(`hub sit ${SEAT_ID}`);
  commands.execute('hub tp 0 0');
  expect(scene.query('hubSeat')).toBeNull();
  commands.execute(`hub sit ${SEAT_ID}`);
  scene.reset();
  expect(scene.query('hubSeat')).toBeNull();
});

it('znacznik reakcji: pending po wejściu z kontekstem, znika po rozmowie, brak bez kontekstu', async () => {
  const { scene, commands } = await setup('', arrivalOptions());
  const pending = () =>
    (scene.query('hubArrival') as { pending: string[] }).pending;
  expect(pending()).toEqual(['kid', 'friend']);
  commands.execute('hub talk kid');
  expect(pending()).toEqual(['friend']);
  commands.execute('hub talk kid');
  expect(pending()).toEqual(['friend']);
  commands.execute('hub talk friend');
  expect(pending()).toEqual([]);
  const none = await setup('', {
    ...arrivalOptions(),
    greetings: { last: () => 'first-visit', mark: vi.fn() },
  });
  expect(none.scene.query('hubArrival')).toBeNull();
});

it('hub dip: zdarzenie, hubPower i komentarz najbliższego mieszkańca po powrocie prądu', async () => {
  const { scene, commands, bus } = await setup();
  const dips: number[] = [];
  bus.on('hub_power_dip', ({ durationS }) => dips.push(durationS));
  expect(scene.query('hubPower')).toMatchObject({ level: 1, active: false });
  commands.execute('hub tp 10 5');
  for (let i = 0; i < 60 * 20; i++) scene.step(SIM_DT, idle);
  expect(scene.query('hubChatter')).toBeNull();
  expect(commands.execute('hub dip extra')).toContain('Użycie');
  commands.execute('hub dip');
  expect(dips).toEqual([tuning.hub.powerDipDurationS]);
  expect(scene.query('hubPower')).toMatchObject({ active: true });
  for (let i = 0; i < 60 * 3; i++) scene.step(SIM_DT, idle);
  expect(scene.query('hubPower')).toMatchObject({ level: 1, active: false });
  expect(scene.query('hubChatter')).toMatchObject({
    conversation: 'power_dip',
  });
});
