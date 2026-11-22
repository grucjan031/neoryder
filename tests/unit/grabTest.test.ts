// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Line, PerspectiveCamera, Scene as ThreeScene } from 'three';
import type { LineBasicMaterial } from 'three';
import { EventBus } from '../../src/core/events';
import type { InputSnapshot } from '../../src/core/input';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import grabData from '../../src/data/powers/grab.json';
import sceneData from '../../src/data/scenes/grabTest.json';
import { GrabRenderer } from '../../src/render/grabRenderer';
import { scenes } from '../../src/scenes';
import { GrabTest, grabTestSchema } from '../../src/scenes/grabTest';
import { CommandRegistry } from '../../src/ui/debugCommands';
import { Hud } from '../../src/ui/hud';
import { GrabPhysics } from '../../src/physics/grabPhysics';

const idle: InputSnapshot = {
  pressed: new Set(),
  held: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};
const press: InputSnapshot = {
  ...idle,
  pressed: new Set(['power']),
  held: new Set(['power']),
};
const hold: InputSnapshot = { ...idle, held: new Set(['power']) };
const release: InputSnapshot = { ...idle, released: new Set(['power']) };
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const dispose of cleanup.splice(0)) dispose();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

async function setup(scale = 1) {
  const scene = new GrabTest();
  const three = new ThreeScene();
  const bus = new EventBus();
  const commands = new CommandRegistry();
  const playerDt = vi.fn((dt: number) => dt * scale);
  await scene.init(
    {
      bus,
      rng: new Rng('grab-scene'),
      commands,
      tuning: structuredClone(tuning),
      debug: false,
      loop: new GameLoop({ step() {}, render() {} }),
      camera: new PerspectiveCamera(),
      feel: { playerDt, focusActive: false },
    },
    three,
  );
  cleanup.push(() => scene.dispose());
  return { scene, three, commands, bus, playerDt };
}

describe('grab-test — kompletna scena', () => {
  it('12: hitstop zamraża interpolację wrogów, skrzyń i wiązki', async () => {
    const c = await setup();
    c.scene.step(SIM_DT, press);
    c.scene.step(SIM_DT, { ...hold, lookDelta: { x: 100, y: 0 } });
    c.scene.step(0, hold);
    const capture = (alpha: number) => {
      c.scene.render(alpha, 0);
      const positions = c.three.children[0]!.children.map((child) =>
        child.position.toArray(),
      );
      const beam = c.three.getObjectByName('grab-beam') as Line;
      return {
        positions,
        beam: Array.from(beam.geometry.getAttribute('position').array),
      };
    };
    expect(capture(0)).toEqual(capture(1));
  });

  it('5: scena przekazuje czas świata do sweep lotu podczas Skupienia', async () => {
    const c = await setup(2);
    const sweep = vi.spyOn(GrabPhysics.prototype, 'sweep');
    c.scene.step(SIM_DT, press);
    c.scene.step(SIM_DT * 0.3, release);
    expect(sweep.mock.calls.at(-1)?.[2]).toBeCloseTo(SIM_DT * 0.3, 8);
  });
  it('rejestruje scenę, waliduje dane, F łapie, puszczenie rzuca i wiązka znika', async () => {
    expect((await scenes['grab-test']?.())?.id).toBe('grab-test');
    expect(grabTestSchema.parse(sceneData)).toEqual(sceneData);
    expect(sceneData.enemies.map((enemy) => enemy.id)).toEqual(
      expect.arrayContaining(['drone', 'shielder', 'executor']),
    );
    const c = await setup();
    c.scene.step(SIM_DT, {
      ...idle,
      pressed: new Set(['power2']),
      held: new Set(['power2']),
    });
    expect(c.scene.query('heldTarget')).toBeNull();
    c.scene.step(SIM_DT, press);
    expect(c.scene.query('heldTarget')).not.toBeNull();
    expect(c.scene.query('energy')).toBe(100 - grabData.cost);
    expect(c.scene.query('cooldown')).toBe(0);
    c.scene.render(0.5);
    expect(c.three.getObjectByName('grab-beam')?.visible).toBe(true);
    c.scene.step(SIM_DT, release);
    c.scene.render(0.5);
    expect(c.scene.query('heldTarget')).toBeNull();
    expect(c.scene.query('cooldown')).toBe(grabData.cooldownS);
    expect(c.three.getObjectByName('grab-beam')?.visible).toBe(false);
  });

  it('drenuje energię i odlicza odnowienie czasem gracza; hitstop zachowuje wejście', async () => {
    const c = await setup(2);
    c.scene.step(0, press);
    expect(c.scene.query('energy')).toBe(100);
    c.scene.step(SIM_DT, hold);
    c.scene.step(SIM_DT, hold);
    expect(c.scene.query('energy')).toBeCloseTo(
      100 - grabData.cost - grabData.drainPerS * SIM_DT * 2,
    );
    c.scene.step(SIM_DT, release);
    c.scene.step(SIM_DT, idle);
    expect(c.scene.query('cooldown')).toBeCloseTo(
      grabData.cooldownS - SIM_DT * 2,
    );
    expect(c.playerDt).toHaveBeenCalledWith(0);
  });

  it('komendy energii, śmierć celu i reset sprzątają chwyt oraz ciała bez narastania zasobów', async () => {
    const c = await setup();
    const bodies = c.scene.query('bodies');
    c.scene.step(SIM_DT, press);
    c.commands.execute('kill held');
    expect(c.scene.query('heldTarget')).toBeNull();
    for (let i = 0; i < 3; i++) {
      c.scene.reset();
      expect(c.scene.query('bodies')).toBe(bodies);
      expect(c.scene.query('energy')).toBe(100);
      c.scene.step(SIM_DT, press);
      c.scene.step(SIM_DT, release);
      c.scene.render(0.5);
    }
    c.scene.reset();
    c.scene.step(SIM_DT, press);
    c.commands.execute('energy 0');
    c.scene.step(SIM_DT, hold);
    expect(c.scene.query('heldTarget')).toBeNull();
    expect(c.commands.execute('energy -1')).toContain('nieujemną');
    c.commands.execute('energy 100');
    expect(c.scene.query('energy')).toBe(100);
    expect(c.scene.query('unknown')).toBeUndefined();
    cleanup.splice(0);
    c.scene.dispose();
    expect(c.three.children).toHaveLength(0);
    expect(c.commands.help()).toBe('');
    expect(document.querySelector('.hud')).toBeNull();
    expect(() => c.bus.emit('player_died', { id: 1 })).not.toThrow();
  });
});

describe('HUD Chwytu', () => {
  it('12: rozpoczęcie trzymania zeruje poprzednie odnowienie slotu', () => {
    const bus = new EventBus();
    const hud = new Hud(bus, {
      playerId: 1,
      loadout: { weapons: [], powers: ['grab'] },
    });
    cleanup.push(() => hud.dispose());
    bus.emit('power_released', { power: 'grab', user: 1 });
    hud.step(0.5);
    bus.emit('power_used', { power: 'grab', user: 1 });
    hud.step(0.2);
    expect(document.querySelector('.hud__power-cooldown')?.textContent).toBe(
      'Trzymanie',
    );
  });
  it('pokazuje obie odmowy i zaczyna odnowienie dopiero po puszczeniu', () => {
    const bus = new EventBus();
    const hud = new Hud(bus, {
      playerId: 1,
      loadout: { weapons: [], powers: ['grab'] },
    });
    cleanup.push(() => hud.dispose());
    bus.emit('power_denied', { power: 'grab', user: 1, reason: 'too_heavy' });
    expect(document.querySelector('.hud__denial')?.textContent).toBe(
      'Za ciężki',
    );
    bus.emit('power_denied', {
      power: 'grab',
      user: 1,
      reason: 'out_of_range',
    });
    expect(document.querySelector('.hud__denial')?.textContent).toBe(
      'Za daleko',
    );
    bus.emit('power_used', { power: 'grab', user: 1 });
    hud.step(2);
    expect(document.querySelector('.hud__power-cooldown')?.textContent).toBe(
      'Trzymanie',
    );
    // Puszczenie: GrabPower.startCooldown() emituje power_cooldown, potem power_released (F2-06/08: HUD liczy od power_cooldown).
    bus.emit('power_cooldown', { power: 'grab', user: 2, cooldownS: 1.5 });
    bus.emit('power_released', { power: 'grab', user: 2 });
    expect(document.querySelector('.hud__power-cooldown')?.textContent).toBe(
      'Trzymanie',
    );
    bus.emit('power_cooldown', { power: 'grab', user: 1, cooldownS: 1.5 });
    bus.emit('power_released', { power: 'grab', user: 1 });
    expect(document.querySelector('.hud__power-cooldown')?.textContent).toBe(
      '1.5 s',
    );
    hud.step(0.5);
    expect(document.querySelector('.hud__power-cooldown')?.textContent).toBe(
      '1.0 s',
    );
  });
});

describe('GrabRenderer', () => {
  it('interpoluje wyłącznie odczytywane snapshoty, korzysta ze strojenia i zwalnia zasoby', () => {
    const settings = structuredClone(tuning);
    const renderer = new GrabRenderer(settings);
    const line = renderer.root.children[0] as Line;
    const geometry = vi.spyOn(line.geometry, 'dispose');
    const material = vi.spyOn(line.material as LineBasicMaterial, 'dispose');
    const beam = {
      previous: { from: { x: 0, y: 1, z: 0 }, to: { x: 0, y: 1, z: -3 } },
      current: { from: { x: 2, y: 3, z: 0 }, to: { x: 2, y: 3, z: -5 } },
    };
    const snapshot = structuredClone(beam);
    renderer.render(beam, 0.5);
    expect(Array.from(line.geometry.getAttribute('position').array)).toEqual([
      1, 2, 0, 1, 2, -4,
    ]);
    expect(beam).toEqual(snapshot);
    const camera = new PerspectiveCamera();
    renderer.render(beam, 1, camera);
    const attribute = line.geometry.getAttribute('position');
    expect(attribute.getX(0)).toBeCloseTo(settings.vfx.grabHandSideM);
    expect(attribute.getY(0)).toBeCloseTo(-settings.vfx.grabHandDownM);
    settings.vfx.grabBeamOpacity = 0.4;
    renderer.render(beam, 1);
    expect((line.material as LineBasicMaterial).opacity).toBe(0.4);
    expect((line.material as LineBasicMaterial).color.getHexString()).toBe(
      '00e5ff',
    );
    renderer.render(null, 1);
    expect(line.visible).toBe(false);
    renderer.dispose();
    expect(geometry).toHaveBeenCalledTimes(1);
    expect(material).toHaveBeenCalledTimes(1);
    expect(renderer.root.children).toHaveLength(0);
  });
});
