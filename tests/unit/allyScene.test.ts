import { describe, expect, it } from 'vitest';
import { Scene } from 'three';
import type { AllySnapshot } from '../../src/allies/ally';
import { allyDefinitions } from '../../src/allies/allySchema';
import { EventBus } from '../../src/core/events';
import type { InputSnapshot } from '../../src/core/input';
import { resolveBindings } from '../../src/core/input';
import { GameLoop } from '../../src/core/loop';
import type { Vec3 } from '../../src/core/math';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import { scenes } from '../../src/scenes';
import { AllyTest, allyTest } from '../../src/scenes/allyTest';
import { CommandRegistry } from '../../src/ui/debugCommands';
import { roomDefinitions } from '../../src/world/rooms';

const input = (held: string[] = [], pressed: string[] = []): InputSnapshot => ({
  held: new Set(held) as InputSnapshot['held'],
  pressed: new Set(pressed) as InputSnapshot['pressed'],
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
});

async function setup() {
  const scene = new AllyTest(
    roomDefinitions.get(allyTest.roomId)!,
    allyTest,
    false,
  );
  const bus = new EventBus();
  const commands = new CommandRegistry();
  await scene.init(
    {
      bus,
      commands,
      rng: new Rng('ally-scene'),
      loop: new GameLoop({ step() {}, render() {} }),
      tuning: structuredClone(tuning),
      debug: false,
    },
    new Scene(),
  );
  const allies = () => scene.query('allies') as AllySnapshot[];
  return {
    scene,
    bus,
    allies,
    ally: (id: string) => allies().find((a) => a.id === id)!,
    step: (n = 1, held: string[] = [], pressed: string[] = []) => {
      for (let i = 0; i < n; i++)
        scene.step(1 / 60, input(held, i === 0 ? pressed : []));
    },
    run: (line: string) => String(commands.execute(line)),
  };
}

describe('scena ally-test', () => {
  it('jest zarejestrowana, a komenda drużyny ma wolny klawisz T', () => {
    expect(scenes['ally-test']).toBeDefined();
    expect(resolveBindings().KeyT).toBe('squadCommand');
  });

  it('sojusznicy idą za graczem, walczą z falą i zabijają wrogów', async () => {
    const s = await setup();
    try {
      expect(s.allies().map((a) => a.id)).toEqual(['nadia', 'szron']);
      s.run('god');
      // gracz przechodzi na drugi koniec placu: drużyna idzie za nim
      s.run('tp -8 -2');
      s.step(240);
      const player = s.scene.query('playerPos') as Vec3;
      for (const ally of s.allies())
        expect(
          Math.hypot(ally.position.x - player.x, ally.position.z - player.z),
          ally.id,
        ).toBeLessThan(7);
      // fale ruszają po firstBreakS; drużyna strzela i zabija
      let kills = 0;
      for (let i = 0; i < 60 && kills === 0; i++) {
        s.step(60);
        kills = s.scene.query('allyKills') as number;
      }
      expect(kills).toBeGreaterThan(0);
      expect(s.scene.query('kills')).toBe(0);
      expect(s.allies().some((a) => a.shots > 0)).toBe(true);
    } finally {
      s.scene.dispose();
    }
  }, 60_000);

  it('wrogowie atakują sojuszników, gdy ci są bliżej niż gracz', async () => {
    const s = await setup();
    try {
      s.run('god');
      s.run('ally hold');
      // gracz chowa się w rogu, drużyna zostaje na środku placu
      s.run('tp 9.5 9.5');
      const hurt = () =>
        s.allies().some((a) => a.hp < a.maxHp || a.state === 'downed');
      for (let i = 0; i < 90 && !hurt(); i++) s.step(60);
      expect(hurt()).toBe(true);
    } finally {
      s.scene.dispose();
    }
  }, 60_000);

  it('komendy: powalenie, podniesienie przez E (bez rzucania mocy), hold i follow', async () => {
    const s = await setup();
    try {
      const events: string[] = [];
      s.bus.on('ally_downed', ({ ally }) => events.push(`down:${ally}`));
      s.bus.on('ally_revived', ({ ally, by }) =>
        events.push(`up:${ally}:${by}`),
      );
      s.bus.on('ally_order', ({ order }) => events.push(`order:${order}`));
      s.bus.on('power_used', () => events.push('power'));
      s.bus.on('power_denied', () => events.push('power'));
      s.run('god');
      s.run('kill all');
      expect(s.run('ally down nadia')).toBe('Sojusznik powalony.');
      s.step(2);
      expect(s.ally('nadia').state).toBe('downed');
      const at = s.ally('nadia').position;
      s.run(`tp ${at.x + 0.8} ${at.z + 0.8}`);
      const reviveSteps = Math.ceil(allyDefinitions.get('nadia')!.reviveS * 60);
      s.step(reviveSteps + 30, ['power2'], ['power2']);
      expect(s.ally('nadia').state).not.toBe('downed');
      expect(s.ally('nadia').state).not.toBe('reviving');
      expect(s.ally('nadia').hp).toBeGreaterThan(0);
      expect(events).toEqual(['down:nadia', 'up:nadia:player']);

      expect(s.run('ally hold')).toBe('Drużyna trzyma pozycję.');
      expect(s.scene.query('squadOrder')).toBe('hold');
      s.step(1, [], ['squadCommand']);
      expect(s.scene.query('squadOrder')).toBe('follow');
      expect(s.run('ally follow')).toBe('Drużyna idzie za graczem.');
      expect(events.slice(2)).toEqual(['order:hold', 'order:follow']);
      expect(s.run('ally spawn nadia')).toMatch(/już jest/);
      expect(s.run('ally spawn nikt')).toMatch(/Użycie/);
      expect(JSON.parse(s.run('ally status'))).toHaveLength(2);
    } finally {
      s.scene.dispose();
    }
  }, 60_000);
});
