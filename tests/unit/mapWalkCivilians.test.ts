import { readFile } from 'node:fs/promises';
import { Scene, SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it, vi } from 'vitest';
import type { CivilianSnapshot } from '../../src/civilians/civilian';
import { EventBus } from '../../src/core/events';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import { MapWalkScene } from '../../src/scenes/mapWalk';
import { CommandRegistry } from '../../src/ui/debugCommands';

it('spacer po klinice wyświetla personel i symuluje cywili przy zatrzymanych falach', async () => {
  vi.stubGlobal(
    'location',
    new URL('http://localhost/?scene=map-walk&map=run5'),
  );
  // Wczytaj modele postaci z dysku. Geometria otoczenia w teście pochodzi z bloków mapy.
  const assets = vi
    .spyOn(GLTFLoader.prototype, 'loadAsync')
    .mockImplementation(async function (this: GLTFLoader, path) {
      if (!path.startsWith('/assets/models/city/')) {
        const data = await readFile('public' + path);
        return this.parseAsync(Uint8Array.from(data).buffer, '');
      }
      return this.parseAsync(
        '{"asset":{"version":"2.0"},"scene":0,"scenes":[{}]}',
        '',
      );
    });
  const commands = new CommandRegistry();
  const three = new Scene();
  const walk = new MapWalkScene();
  const people = () => walk.query('civilians') as CivilianSnapshot[];
  const idle = {
    held: new Set<never>(),
    released: new Set<never>(),
    pressed: new Set<never>(),
    lookDelta: { x: 0, y: 0 },
  };
  try {
    await walk.init(
      {
        bus: new EventBus(),
        rng: new Rng('clinic-walk'),
        commands,
        debug: false,
        tuning: structuredClone(tuning),
        loop: new GameLoop({ step() {}, render() {} }),
      },
      three,
    );
    expect(people()).toHaveLength(6);
    walk.render(1, SIM_DT);
    await vi.waitFor(() => {
      const coats: SkinnedMesh[] = [];
      three.traverseVisible((node) => {
        if (node instanceof SkinnedMesh && node.name.startsWith('top_coat'))
          coats.push(node);
      });
      expect(coats.length).toBeGreaterThanOrEqual(6);
    });
    expect(walk.query('phase')).toBe('stopped');
    commands.execute('tp 15.5 10.25');
    for (let i = 0; i < 60; i++) walk.step(SIM_DT, idle);
    expect(people().some((c) => c.state === 'fleeing')).toBe(true);
    for (
      let i = 0;
      i < 1200 && !people().some((c) => c.state === 'crouching');
      i++
    )
      walk.step(SIM_DT, idle);
    expect(people().some((c) => c.state === 'crouching')).toBe(true);
    commands.execute('civilian kill');
    walk.step(SIM_DT, idle);
    expect(people().some((c) => c.state === 'dead' && c.deathS > 0)).toBe(true);
    expect(walk.query('enemies')).toBe(0);
  } finally {
    walk.dispose();
    assets.mockRestore();
    vi.unstubAllGlobals();
  }
});
