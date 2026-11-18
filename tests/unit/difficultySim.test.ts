import { describe, expect, it } from 'vitest';
import { PIERCE_BLOCK_TAG } from '../../src/combat/damage';
import { SIM_DT } from '../../src/core/loop';
import type { DifficultyId } from '../../src/world/difficulty';
import { baselineProfile, difficultyArena } from './difficultyHarness';

/** HP gracza w pokojach walki (`src/data/scenes/roomPlayer.json`). */
const PLAYER_HP = 100;
const BOT_TURN_DEG_S = 240;
const BOT_REACH_M = 2.8;
const BOT_CONE_COS = Math.cos((35 * Math.PI) / 180);
const LEVELS = ['baseline', 'easy', 'normal', 'hard', 'nightmare'] as const;
type Level = (typeof LEVELS)[number];
type Bot = 'block' | 'fight';

/**
 * Bot o stałym zachowaniu na jednej fali (6 Szturmowców + 2 Strzelców, liczba wg poziomu):
 * - `block`: stoi i blokuje (×0,3 obrażeń, ciężkie ciosy przebijają), każde zablokowane trafienie
 *   emituje `melee_blocked` jak prawdziwy blok ostrza;
 * - `fight`: bez bloku, co 0,9 s obraca się do najbliższego wroga i tnie (co trzeci cios ciężki,
 *   obrót 240°/s, trafienie 35 po 0,3 s w stożku ±35°, 2,8 m), co 4 s doskok w stronę najbliższego Strzelca (bez ruchu).
 * `baseline` = gra sprzed zmian: mnożniki 1, tokeny pokoju, taktyki wyłączone.
 */
async function simulate(level: Level, bot: Bot, seed: string, s = 30) {
  const id: DifficultyId = level === 'baseline' ? 'normal' : level;
  const a = await difficultyArena(
    id,
    seed,
    bot === 'block',
    level === 'baseline' ? baselineProfile : undefined,
  );
  try {
    let taken = 0,
      time = 0,
      deathS: number | null = null,
      kills = 0,
      blocked = 0;
    a.bus.on('damage_dealt', (event) => {
      if (event.target === a.player) {
        taken += event.amount;
        if (deathS === null && taken >= PLAYER_HP) deathS = time;
        if (bot === 'block' && !event.tags.includes(PIERCE_BLOCK_TAG)) {
          blocked++;
          a.bus.emit('melee_blocked', {
            defender: a.player,
            attacker: event.source,
            amount: event.amount,
          });
        }
      } else if (event.killed) kills++;
    });
    const wave = a.startWave();
    const alive = () =>
      a.enemies.filter((e) => !e.removed && e.current.state !== 'dead');
    const nearest = (kinds?: readonly string[]) => {
      let best = null as (typeof a.enemies)[number] | null,
        bestD = Infinity;
      for (const enemy of alive()) {
        if (kinds && !kinds.includes(enemy.definition.kind)) continue;
        const d = Math.hypot(
          enemy.current.position.x,
          enemy.current.position.z,
        );
        if (d < bestD) [best, bestD] = [enemy, d];
      }
      return best;
    };
    let swing = 0,
      yaw = 0,
      nextSwingS = 0.9,
      hitAtS = Infinity,
      nextDashS = 4;
    const turn = ((BOT_TURN_DEG_S * Math.PI) / 180) * SIM_DT;
    const steps = Math.round(s / SIM_DT);
    for (let i = 0; i < steps; i++) {
      time += SIM_DT;
      a.step();
      if (bot !== 'fight') continue;
      const target = nearest();
      if (target) {
        const p = target.current.position;
        const want = Math.atan2(-p.x, -p.z);
        const delta = Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw));
        yaw += Math.max(-turn, Math.min(turn, delta));
        a.face(yaw);
      }
      if (time >= nextSwingS && target) {
        nextSwingS += 0.9;
        swing++;
        a.bus.emit('melee_swing', {
          attacker: a.player,
          stage: swing % 3 === 0 ? 'heavy' : 1,
        });
        hitAtS = time + 0.3;
      }
      if (time >= hitAtS) {
        hitAtS = Infinity;
        // Cios trafia tylko najbliższego wroga w stożku ±35° przed botem.
        const fx = -Math.sin(yaw),
          fz = -Math.cos(yaw);
        let victim = null as (typeof a.enemies)[number] | null,
          best = BOT_REACH_M;
        for (const enemy of alive()) {
          const p = enemy.current.position;
          const d = Math.hypot(p.x, p.z);
          if (
            d > best ||
            (p.x * fx + p.z * fz) / Math.max(d, 1e-6) < BOT_CONE_COS
          )
            continue;
          [victim, best] = [enemy, d];
        }
        if (victim)
          a.damage.deal(victim.id, {
            amount: 35,
            source: a.player,
            tags: ['#melee'],
          });
      }
      if (time >= nextDashS) {
        nextDashS += 4;
        const gunner = nearest(['gunner']);
        if (gunner) {
          const p = gunner.current.position;
          const d = Math.max(1e-6, Math.hypot(p.x, p.z));
          a.bus.emit('dash_used', {
            user: a.player,
            dir: { x: p.x / d, y: 0, z: p.z / d },
          });
        }
      }
    }
    return {
      level,
      taken: Number(taken.toFixed(2)),
      deathS: deathS === null ? null : Number((deathS as number).toFixed(2)),
      kills,
      blocked,
      spawns: wave.spawnLog.length,
      trace: a.trace,
      states: a.enemies.map((enemy) => ({ ...enemy.current })),
    };
  } finally {
    a.dispose();
  }
}

const SEEDS = ['difficulty-a', 'difficulty-b', 'difficulty-c', 'difficulty-d'];
const mean = (values: number[]) =>
  Number((values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2));

describe('symulacja poziomów bez renderu', () => {
  it('ten sam seed i poziom dają identyczne zdarzenia, pozycje i obrażenia', async () => {
    for (const bot of ['block', 'fight'] as const)
      expect(await simulate('hard', bot, 'repeat', 12)).toEqual(
        await simulate('hard', bot, 'repeat', 12),
      );
  }, 60000);

  it.each(['block', 'fight'] as const)(
    'bot %s: obrażenia rosną monotonicznie od Łatwego do Koszmaru',
    async (bot) => {
      const rows = [];
      for (const level of LEVELS) {
        const runs = [];
        for (const seed of SEEDS) runs.push(await simulate(level, bot, seed));
        const deaths = runs.map((r) => r.deathS ?? Infinity);
        rows.push({
          level,
          taken: mean(runs.map((r) => r.taken)),
          samples: runs.map((r) => r.taken),
          deathS: deaths.every(Number.isFinite) ? mean(deaths) : null,
          kills: mean(runs.map((r) => r.kills)),
          spawns: runs[0]!.spawns,
        });
      }
      console.info(`[difficulty-simulation:${bot}]`, JSON.stringify(rows));
      // Linia bazowa (gra sprzed zmian) jest tylko w raporcie: patrz docs/systems/difficulty.md.
      const order: Level[] = ['easy', 'normal', 'hard', 'nightmare'];
      const byLevel = new Map(rows.map((r) => [r.level, r.taken]));
      for (let i = 1; i < order.length; i++)
        expect(byLevel.get(order[i]!)!).toBeGreaterThan(
          byLevel.get(order[i - 1]!)! * 1.2,
        );
    },
    120000,
  );
});
