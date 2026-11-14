// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { Scene as ThreeScene } from 'three';
import { EventBus } from '../../src/core/events';
import { GameLoop } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import { scenes } from '../../src/scenes';
import { CommandRegistry } from '../../src/ui/debugCommands';
import { generateSectorMap } from '../../src/world/sectorMap';
import { kuroganeSector } from '../../src/world/sectors';

it('map-test pokazuje seed z URL, rejestruje map i usuwa UI oraz komendę', () => {
  window.history.replaceState(null, '', '?scene=map-test&seed=test-mapy');
  const scene = scenes['map-test']!();
  const commands = new CommandRegistry();
  scene.init(
    {
      bus: new EventBus(),
      rng: new Rng('test-mapy'),
      loop: new GameLoop({ step() {}, render() {} }),
      tuning,
      debug: true,
      commands,
    },
    new ThreeScene(),
  );
  expect(scene.query?.('map')).toEqual(
    generateSectorMap(kuroganeSector, 'test-mapy'),
  );
  const text = document.querySelector('pre')!.textContent;
  expect(text).toContain('test-mapy');
  expect(text).toContain('L8N1 boss');
  expect(commands.execute('map')).toBe(text);
  scene.dispose();
  expect(document.querySelector('pre')).toBeNull();
  expect(commands.execute('map')).toContain('Nieznana komenda');
  window.history.replaceState(null, '', '/');
});
