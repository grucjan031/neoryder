// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { Line, Scene as ThreeScene } from 'three';
import type { MeshBasicMaterial } from 'three';
import { DamageSystem, Health } from '../../src/combat/damage';
import { ChainPower } from '../../src/combat/powers/chain';
import { PlayerEnergy } from '../../src/combat/powers/energy';
import type { PowerDeps, PowerInput } from '../../src/combat/powers/power';
import type { PushTarget } from '../../src/combat/powers/push';
import {
  createPower,
  loadPower,
  powerDefinitions,
} from '../../src/combat/powers/registry';
import { StatusSystem } from '../../src/combat/status';
import { EntityRegistry } from '../../src/core/entities';
import { EventBus } from '../../src/core/events';
import type { EntityId, GameEvents } from '../../src/core/events';
import type { InputSnapshot } from '../../src/core/input';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import type { Vec3 } from '../../src/core/math';
import { Rng } from '../../src/core/rng';
import { Stats } from '../../src/core/stats';
import { tuning } from '../../src/core/tuning';
import chainData from '../../src/data/powers/chain.json';
import { LightningRenderer } from '../../src/render/lightningRenderer';
import { getMaterial } from '../../src/render/materials';
import { PushTest } from '../../src/scenes/meleeTest';
import { CommandRegistry } from '../../src/ui/debugCommands';

const idle: PowerInput = { pressed: false, held: false, released: false };
const press: PowerInput = { pressed: true, held: true, released: false };

function setup(
  positions: readonly Vec3[] = [
    { x: 0, y: 1, z: -4 },
    { x: 2, y: 1, z: -4 },
    { x: 2, y: 1, z: -7 },
    { x: -1, y: 1, z: -7 },
  ],
) {
  const bus = new EventBus();
  const entities = new EntityRegistry(bus);
  const owner = entities.create('player', 'player');
  const damage = new DamageSystem(bus, entities);
  const energy = new PlayerEnergy(
    owner,
    new Stats({ maxEnergy: 100, energyRegen: 0 }),
    bus,
    tuning,
  );
  const targets: PushTarget[] = positions.map((position) => {
    const id = entities.create('dummy', 'enemy');
    const stats = new Stats({ maxHealth: 200 });
    damage.register(id, new Health(() => stats.get('maxHealth')), { stats });
    return { id, position: { ...position } };
  });
  const statuses = new StatusSystem(bus, damage, {
    position: (id) => targets.find((t) => t.id === id)?.position ?? null,
    targets: () => targets.map((t) => t.id),
  });
  const deps: PowerDeps = {
    owner,
    bus,
    tuning,
    damage,
    energy,
    aim: () => ({ origin: { x: 0, y: 1, z: 0 }, dir: { x: 0, y: 0, z: -1 } }),
    targets: () => targets,
    castWall: () => null,
  };
  const chain = createPower('chain', deps) as ChainPower;
  const hits: GameEvents['damage_dealt'][] = [];
  bus.on('damage_dealt', (e) => hits.push(e));
  return { bus, damage, energy, targets, statuses, deps, chain, hits };
}

describe('Błyskawica (chain) — dane i rejestr', () => {
  it('ładuje chain.json i tworzy instancję ChainPower przez rejestr', () => {
    const def = powerDefinitions.get('chain');
    expect(def).toEqual(chainData);
    const { chain } = setup();
    expect(chain).toBeInstanceOf(ChainPower);
    expect(chain.def.name).toBe('Błyskawica');
    expect(chain.arcs).toEqual([]);
  });

  it('odrzuca nieprawidłowe parametry schematu chain', () => {
    expect(() => loadPower({ ...chainData, falloff: 1.2 })).toThrow(/mocy/);
    expect(() => loadPower({ ...chainData, falloff: -0.1 })).toThrow(/mocy/);
    expect(() => loadPower({ ...chainData, jumps: -1 })).toThrow(/mocy/);
    expect(() =>
      loadPower({
        ...chainData,
        vfx: { ...chainData.vfx, segments: 0 },
      }),
    ).toThrow(/mocy/);
  });
});

describe('Błyskawica — wybór pierwszego celu, przeskoki i obrażenia', () => {
  it('wybiera cel o najmniejszym kącie do osi celowania (remis: bliższy), pomija cele poza stożkiem i zasięgiem', () => {
    const c = setup([
      { x: 4, y: 1, z: -3 }, // poza stożkiem 20°
      { x: 0, y: 1, z: -20 }, // poza zasięgiem 14 m
      { x: 0.4, y: 1, z: -4 }, // w stożku, ale większy kąt (~5.7°) choć bliżej
      { x: 0, y: 1, z: -9 }, // dokładnie na osi (0°), dalej
      { x: 0, y: 1, z: -6 }, // dokładnie na osi (0°), bliżej — wygrywa remis kąta
    ]);
    const singleJump = new ChainPower({ ...c.chain.def, jumps: 0 }, c.deps);
    expect(singleJump.use()).toBe(1);
    expect(c.hits).toHaveLength(1);
    expect(c.hits[0]?.target).toBe(c.targets[4]?.id);
  });

  it('przeskakuje kolejno do najbliższych celów bez powtórzeń i zatrzymuje się po jumps', () => {
    const c = setup([
      { x: 0, y: 1, z: -4 }, // 0: pierwszy cel (na osi)
      { x: 4.5, y: 1, z: -4 }, // 1: 4.5 m od 0, ale 1.5 m od 2
      { x: 3, y: 1, z: -4 }, // 2: 3 m od 0 (bliżej niż 1, ale dalej niż 3)
      { x: 1.5, y: 1, z: -4 }, // 3: 1.5 m od 0 -> skok 1 (potem do 2 -> skok 2, potem do 1 -> skok 3)
      { x: 5.5, y: 1, z: -4 }, // 4: 1 m od 1, ale limit jumps = 3 już osiągnięty
    ]);
    expect(c.chain.use()).toBe(4);
    expect(c.hits.map((h) => h.target)).toEqual([
      c.targets[0]?.id,
      c.targets[3]?.id,
      c.targets[2]?.id,
      c.targets[1]?.id,
    ]);
  });

  it('przerywa łańcuch, gdy najbliższy kolejny cel jest dalej niż jumpRangeM', () => {
    const c = setup([
      { x: 0, y: 1, z: -4 }, // 0: pierwszy cel
      { x: 2, y: 1, z: -4 }, // 1: 2 m od 0 (w zasięgu 5 m)
      { x: 2, y: 1, z: -9.5 }, // 2: 5.5 m od 1 (poza jumpRangeM = 5 m)
    ]);
    expect(c.chain.use()).toBe(2);
    expect(c.hits.map((h) => h.target)).toEqual([
      c.targets[0]?.id,
      c.targets[1]?.id,
    ]);
  });

  it('stosuje multiplikatywny spadek obrażeń damage × (1 − falloff)^(n−1) i przekazuje tagi oraz kierunek', () => {
    const c = setup();
    c.chain.step(SIM_DT, press);
    const { damage, falloff } = c.chain.def;
    expect(c.hits.map((h) => h.amount)).toEqual([
      damage,
      damage * (1 - falloff),
      damage * Math.pow(1 - falloff, 2),
      damage * Math.pow(1 - falloff, 3),
    ]);
    for (const hit of c.hits) {
      expect(hit.source).toBe(c.deps.owner);
      expect(hit.tags).toEqual(['#power', '#elektrycznosc']);
      expect(hit.point).not.toBeNull();
      expect(hit.dir).not.toBeNull();
    }
  });

  it('nakłada przeciążenie (overload) przez StatusSystem na każdy trafiony cel i wyzwala wyładowanie przy 3 stosach', () => {
    const c = setup([
      { x: 0, y: 1, z: -4 },
      { x: 2, y: 1, z: -4 },
    ]);
    c.chain.use();
    const firstId = c.targets[0]!.id;
    const secondId = c.targets[1]!.id;
    expect(c.statuses.stacks(firstId, 'overload')).toBe(1);
    expect(c.statuses.stacks(secondId, 'overload')).toBe(1);
    expect(c.statuses.remaining(firstId, 'overload')).toBe(4);

    // Dwa kolejne użycia po odnowieniu dobijają do 3 stosów -> ogłuszenie i wyładowanie.
    for (let i = 0; i < 2; i++) {
      c.energy.set(100);
      c.chain.step(c.chain.def.cooldownS, press);
    }
    expect(c.statuses.has(firstId, 'stunned')).toBe(true);
    expect(c.statuses.has(secondId, 'stunned')).toBe(true);
    expect(c.hits.some((h) => h.tags.includes('#status'))).toBe(true);
  });

  it('ściana blokuje przeskok oraz trafienie pierwszego celu', () => {
    const c = setup([
      { x: 0, y: 1, z: -4 },
      { x: 3, y: 1, z: -4 },
    ]);
    // Ściana między celem 0 a celem 1 (na 1,5 m w kierunku +X) blokuje przeskok.
    c.deps.castWall = (_from, dir, max) =>
      dir.x > 0.5 && max >= 1.5 ? 1.5 : null;
    expect(c.chain.use()).toBe(1);
    expect(c.hits.map((h) => h.target)).toEqual([c.targets[0]?.id]);

    // Ściana przed pierwszym celem blokuje całe użycie mocy.
    c.chain.reset();
    c.deps.castWall = () => 1;
    expect(c.chain.use()).toBeNull();
    expect(c.hits).toHaveLength(1);
  });

  it('brak celu w stożku nie zużywa energii, nie ustawia odnowienia i nie emituje power_used', () => {
    const c = setup([
      { x: 5, y: 1, z: -2 }, // poza stożkiem
      { x: 0, y: 1, z: 4 }, // za plecami
    ]);
    const used = vi.fn();
    const denied = vi.fn();
    c.bus.on('power_used', used);
    c.bus.on('power_denied', denied);

    c.chain.step(SIM_DT, press);
    expect(c.energy.current).toBe(100);
    expect(c.chain.cooldownRemaining).toBe(0);
    expect(used).not.toHaveBeenCalled();
    expect(denied).not.toHaveBeenCalled();
    expect(c.hits).toHaveLength(0);
    expect(c.chain.arcs).toHaveLength(0);
  });
});

describe('Błyskawica — stan arcs i LightningRenderer', () => {
  it('tworzy łuk z punktami łańcucha, postarza go w step i usuwa po arcLifeS oraz przy reset', () => {
    const c = setup([
      { x: 0, y: 1, z: -4 },
      { x: 2, y: 1, z: -4 },
    ]);
    c.chain.step(SIM_DT, press);
    expect(c.chain.arcs).toHaveLength(1);
    expect(c.chain.arcs[0]?.ageS).toBe(0);
    expect(c.chain.arcs[0]?.points).toEqual([
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 1, z: -4 },
      { x: 2, y: 1, z: -4 },
    ]);

    // Hitstop (dt = 0) nie postarza łuku.
    c.chain.step(0, idle);
    expect(c.chain.arcs[0]?.ageS).toBe(0);

    const half = c.chain.def.vfx.arcLifeS / 2;
    c.chain.step(half, idle);
    expect(c.chain.arcs).toHaveLength(1);
    expect(c.chain.arcs[0]?.ageS).toBeCloseTo(half);

    c.chain.step(half, idle);
    expect(c.chain.arcs).toHaveLength(0);

    // Reset natychmiast czyści aktywne łuki.
    c.chain.step(c.chain.def.cooldownS, press);
    expect(c.chain.arcs).toHaveLength(1);
    c.chain.reset();
    expect(c.chain.arcs).toHaveLength(0);
  });

  it('LightningRenderer buduje zygzak z materiałem power, zanika, ponownie używa geometrii i sprząta w dispose', () => {
    const c = setup([
      { x: 0, y: 1, z: -4 },
      { x: 2, y: 1, z: -4 },
    ]);
    const parent = new ThreeScene();
    const renderer = new LightningRenderer();
    parent.add(renderer.root);

    c.chain.step(SIM_DT, press);
    renderer.render(c.chain);

    expect(renderer.root.children).toHaveLength(1);
    const line = renderer.root.children[0] as Line;
    expect(line).toBeInstanceOf(Line);
    expect(line.visible).toBe(true);
    const geometry = line.geometry;
    const material = line.material as MeshBasicMaterial;
    expect(material.color.getHex()).toBe(getMaterial('power').color.getHex());
    expect(material.opacity).toBeCloseTo(1);

    const expectedVertices =
      (c.chain.arcs[0]!.points.length - 1) * c.chain.def.vfx.segments + 1;
    expect(geometry.drawRange.count).toBe(expectedVertices);

    // Zanikanie w połowie czasu życia.
    c.chain.step(c.chain.def.vfx.arcLifeS / 2, idle);
    renderer.render(c.chain);
    expect(material.opacity).toBeCloseTo(0.5);

    // Po wygaśnięciu linia staje się niewidoczna, a przy kolejnym łuku ta sama geometria jest użyta ponownie.
    c.chain.step(c.chain.def.vfx.arcLifeS / 2, idle);
    renderer.render(c.chain);
    expect(line.visible).toBe(false);

    c.chain.step(c.chain.def.cooldownS, press);
    renderer.render([c.chain]);
    expect(line.visible).toBe(true);
    expect(line.geometry).toBe(geometry);

    const geoDispose = vi.spyOn(geometry, 'dispose');
    const matDispose = vi.spyOn(material, 'dispose');
    renderer.dispose();
    expect(geoDispose).toHaveBeenCalledOnce();
    expect(matDispose).toHaveBeenCalledOnce();
    expect(parent.children).toHaveLength(0);
  });

  it('w scenie push-test komenda power 1 chain pozwala razić łańcuchem manekiny i nałożyć statusy', async () => {
    const bus = new EventBus();
    const commands = new CommandRegistry();
    const three = new ThreeScene();
    const scene = new PushTest(false);
    await scene.init(
      {
        bus,
        commands,
        rng: new Rng('chain-push-scene'),
        debug: false,
        loop: new GameLoop({ step: () => {}, render: () => {} }),
        tuning: structuredClone(tuning),
      },
      three,
    );
    const applied: EntityId[] = [];
    bus.on('status_applied', ({ target, status }) => {
      if (status === 'overload') applied.push(target);
    });

    expect(commands.execute('power 1 chain')).toContain('Błyskawica');
    const snap: InputSnapshot = {
      held: new Set(['power']),
      pressed: new Set(['power']),
      released: new Set(),
      lookDelta: { x: 0, y: 0 },
    };
    scene.step(SIM_DT, snap);
    scene.render(1);

    const hp = scene.query('dummyHp') as number[];
    // 4 z 5 manekinów trafione (pierwszy + 3 przeskoki).
    expect(hp.filter((v) => v < 100)).toHaveLength(4);
    expect(applied).toHaveLength(4);

    scene.dispose();
  });
});
