import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Ally } from '../../src/allies/ally';
import type {
  AllyEnvironment,
  AllyEvent,
  AllyHostile,
  AllyLeader,
  AllyShot,
} from '../../src/allies/ally';
import {
  allyDefinitions,
  allySchema,
  loadAllyDefinitions,
} from '../../src/allies/allySchema';
import { AllySquad } from '../../src/allies/squad';
import {
  selectAllyTarget,
  selectHostileTarget,
} from '../../src/allies/targeting';
import type { HostileCandidate } from '../../src/allies/targeting';
import { DamageSystem, Health, Hurtboxes } from '../../src/combat/damage';
import { ProjectileSystem } from '../../src/combat/weapons/projectiles';
import { EntityRegistry } from '../../src/core/entities';
import { EventBus } from '../../src/core/events';
import type { Vec3 } from '../../src/core/math';
import { Rng } from '../../src/core/rng';
import { Stats } from '../../src/core/stats';
import { tuning } from '../../src/core/tuning';
import nadiaData from '../../src/data/allies/nadia.json';
import levelData from '../../src/data/levels/m01-maszty.json';
import {
  CollisionGroup,
  initPhysics,
  interactionGroups,
} from '../../src/physics';
import { levelWaves } from '../../src/world/levels';
import { levelSchema, loadLevel } from '../../src/world/levelSchema';
import { missionDefinitions } from '../../src/world/missions';

const DT = 1 / 60;
const v = (x: number, z: number, y = 0): Vec3 => ({ x, y, z });

describe('dane sojuszników', () => {
  it('ładuje Nadię i Szrona z kompletem kwestii i poprawnymi liczbami', () => {
    expect([...allyDefinitions.keys()].sort()).toEqual(['nadia', 'szron']);
    const nadia = allyDefinitions.get('nadia')!;
    const szron = allyDefinitions.get('szron')!;
    expect(nadia.role).toBe('rifleman');
    expect(szron.role).toBe('support');
    expect(nadia.moveSpeed).toBeGreaterThan(szron.moveSpeed);
    expect(szron.hp).toBeGreaterThan(nadia.hp);
    expect(szron.weapon.pellets).toBeGreaterThan(1);
    for (const ally of allyDefinitions.values())
      for (const lines of Object.values(ally.barks))
        expect(lines.length).toBeGreaterThan(0);
  });

  it('odrzuca błędne dane i powtórzone id', () => {
    expect(allySchema.safeParse({ ...nadiaData, accuracy: 1.2 }).success).toBe(
      false,
    );
    expect(allySchema.safeParse({ ...nadiaData, role: 'boss' }).success).toBe(
      false,
    );
    expect(
      allySchema.safeParse({
        ...nadiaData,
        barks: { ...nadiaData.barks, downed: [] },
      }).success,
    ).toBe(false);
    expect(allySchema.safeParse({ ...nadiaData, extra: 1 }).success).toBe(
      false,
    );
    expect(() => loadAllyDefinitions([nadiaData, nadiaData])).toThrow(
      /Powtórzone/,
    );
  });

  it('poziom liniowy przyjmuje pole allies i sprawdza id oraz zależność', () => {
    const mission = missionDefinitions.get('m01-maszty')!;
    const spawn = levelData.checkpoints[0]!.position;
    const withAllies = (allies: unknown) => ({ ...levelData, allies });
    const level = loadLevel(
      withAllies([
        { id: 'nadia', spawn },
        {
          id: 'szron',
          spawn,
          joinAfter: { kind: 'objective', id: levelData.objectiveOrder[0] },
        },
      ]),
      mission,
      levelWaves,
    );
    expect(level.allies).toHaveLength(2);
    expect(loadLevel(levelData, mission, levelWaves).allies).toBeUndefined();
    expect(() =>
      loadLevel(withAllies([{ id: 'nikt', spawn }]), mission, levelWaves),
    ).toThrow(/Nieznany sojusznik/);
    expect(
      levelSchema.safeParse(
        withAllies([
          { id: 'nadia', spawn, joinAfter: { kind: 'encounter', id: 'brak' } },
        ]),
      ).success,
    ).toBe(false);
    expect(
      levelSchema.safeParse(
        withAllies([
          { id: 'nadia', spawn },
          { id: 'nadia', spawn },
        ]),
      ).success,
    ).toBe(false);
  });

  it('symulacja sojuszników nie używa Math.random', () => {
    const dir = join(process.cwd(), 'src', 'allies');
    for (const file of readdirSync(dir))
      expect(readFileSync(join(dir, file), 'utf8'), file).not.toMatch(
        /Math\.random/,
      );
  });
});

describe('selectHostileTarget', () => {
  const options = { allyBias: 1.25, stickyBias: 0.8 };
  const player: HostileCandidate = {
    id: 1,
    kind: 'player',
    position: v(0, 10),
  };
  const ally = (id: number, x: number, z: number): HostileCandidate => ({
    id,
    kind: 'ally',
    position: v(x, z),
  });

  it('bez kandydatów zwraca null, z samym graczem gracza', () => {
    expect(selectHostileTarget(v(0, 0), [], options)).toBeNull();
    expect(selectHostileTarget(v(0, 0), [player], options)).toBe(player);
  });

  it('przy podobnej odległości pierwszeństwo ma gracz', () => {
    const near = ally(2, 0, -9.5);
    expect(selectHostileTarget(v(0, 0), [near, player], options)?.id).toBe(1);
    expect(
      selectHostileTarget(v(0, 0), [ally(2, 10, 0), player], options)?.id,
    ).toBe(1);
  });

  it('wyraźnie bliższy sojusznik ściąga ogień', () => {
    expect(
      selectHostileTarget(v(0, 0), [player, ally(2, 0, -4)], options)?.id,
    ).toBe(2);
  });

  it('bieżący cel trzyma się mimo nieco bliższego kandydata', () => {
    const a = ally(2, 0, -7.5);
    // 7,5 × 1,25 = 9,4 < 10: bez histerezy wygrywa sojusznik, z nią gracz zostaje celem.
    expect(selectHostileTarget(v(0, 0), [player, a], options)?.id).toBe(2);
    expect(
      selectHostileTarget(v(0, 0), [player, a], { ...options, currentId: 1 })
        ?.id,
    ).toBe(1);
  });

  it('remis między sojusznikami rozstrzyga niższe id', () => {
    expect(
      selectHostileTarget(v(0, 0), [ally(5, 3, 0), ally(4, -3, 0)], options)
        ?.id,
    ).toBe(4);
  });
});

describe('selectAllyTarget', () => {
  const options = { rangeM: 20, attackerBias: 0.6, stickyBias: 0.85 };
  const hostile = (id: number, z: number, attackingPlayer = false) => ({
    id,
    position: v(0, z),
    attackingPlayer,
  });

  it('wybiera najbliższego widocznego wroga w zasięgu', () => {
    const list = [hostile(1, 12), hostile(2, 6), hostile(3, 30)];
    expect(selectAllyTarget(v(0, 0), list, options, () => true)?.id).toBe(2);
    expect(
      selectAllyTarget(v(0, 0), list, options, (c) => c.id !== 2)?.id,
    ).toBe(1);
    expect(
      selectAllyTarget(v(0, 0), [hostile(3, 30)], options, () => true),
    ).toBe(null);
    expect(selectAllyTarget(v(0, 0), list, options, () => false)).toBeNull();
  });

  it('woli wroga atakującego gracza, o ile nie jest dużo dalej', () => {
    expect(
      selectAllyTarget(
        v(0, 0),
        [hostile(1, 6), hostile(2, 9, true)],
        options,
        () => true,
      )?.id,
    ).toBe(2);
    expect(
      selectAllyTarget(
        v(0, 0),
        [hostile(1, 6), hostile(2, 18, true)],
        options,
        () => true,
      )?.id,
    ).toBe(1);
  });
});

interface Harness {
  ally: Ally;
  health: Health;
  events: AllyEvent[];
  shots: AllyShot[];
  hostiles: AllyHostile[];
  leader: AllyLeader;
  walls: { blocked: boolean };
  step(seconds: number, assist?: boolean): void;
}

/** Sojusznik na płaskim, pustym terenie; `walls.blocked` zasłania każdą linię wzroku i ruchu. */
function harness(id = 'nadia', start = v(0, 0)): Harness {
  const definition = allyDefinitions.get(id)!;
  const stats = new Stats({
    maxHealth: definition.hp,
    moveSpeed: definition.moveSpeed,
    damage: definition.weapon.damage,
  });
  const health = new Health(() => stats.get('maxHealth'));
  const h: Omit<Harness, 'ally' | 'step'> = {
    health,
    events: [],
    shots: [],
    hostiles: [],
    leader: { position: v(0, 0), yaw: 0, alive: true },
    walls: { blocked: false },
  };
  const env: AllyEnvironment = {
    navigation: () => null,
    clear: () => !h.walls.blocked,
    ground: (point) => point.y,
    hostiles: () => h.hostiles,
    leader: () => h.leader,
    mates: () => [],
    fire: (_, shot) => h.shots.push(shot),
    emit: (_, event) => h.events.push(event),
  };
  const ally = new Ally(
    77,
    definition,
    0,
    start,
    health,
    stats,
    env,
    structuredClone(tuning.allies),
    new Rng('ally-test'),
  );
  return {
    ...h,
    ally,
    step(seconds, assist = false) {
      for (let i = 0; i < Math.round(seconds / DT); i++) {
        if (assist) ally.assist();
        ally.step(DT);
      }
    },
  };
}

const enemyAt = (x: number, z: number, id = 5): AllyHostile => ({
  id,
  position: v(x, z),
  centerM: 1,
  attackingPlayer: false,
});

describe('maszyna stanów sojusznika', () => {
  it('follow: stoi przy graczu, rusza za nim i dogania biegiem', () => {
    const h = harness();
    h.step(1);
    expect(h.ally.state).toBe('follow');
    expect(h.ally.snapshot().motion).toBe('idle');
    h.leader.position = v(0, -30);
    h.step(0.5);
    expect(h.ally.snapshot().motion).toBe('run');
    h.step(8);
    const gap = Math.hypot(h.ally.position.x, h.ally.position.z + 30);
    expect(gap).toBeLessThan(h.ally.definition.followDistanceM + 1.5);
    expect(h.ally.snapshot().motion).toBe('idle');
  });

  it('follow → engage przy wrogu w zasięgu, strzela seriami i wraca do follow', () => {
    const h = harness();
    h.hostiles.push(enemyAt(0, 60));
    h.step(1);
    expect(h.ally.state).toBe('follow');
    expect(h.shots).toHaveLength(0);
    h.hostiles[0] = enemyAt(0, 12);
    h.step(1.5);
    expect(h.ally.state === 'engage' || h.ally.state === 'reposition').toBe(
      true,
    );
    expect(h.shots.length).toBeGreaterThanOrEqual(3);
    expect(h.events).toContainEqual({
      type: 'state',
      from: 'follow',
      to: 'engage',
    });
    expect(
      h.events.some((e) => e.type === 'bark' && e.kind === 'contact'),
    ).toBe(true);
    // strzał leci w stronę wroga (+z)
    expect(h.shots[0]!.dir.z).toBeGreaterThan(0.95);
    h.hostiles.length = 0;
    h.step(2.5);
    expect(h.ally.state).toBe('follow');
  });

  it('nie strzela, gdy linia do celu jest zasłonięta', () => {
    const h = harness();
    h.hostiles.push(enemyAt(0, 10));
    h.walls.blocked = true;
    h.step(3);
    expect(h.shots).toHaveLength(0);
    expect(h.ally.state).toBe('follow');
    h.walls.blocked = false;
    h.step(1.5);
    expect(h.shots.length).toBeGreaterThan(0);
    // ściana wraca w trakcie walki: kolejne strzały nie padają
    h.walls.blocked = true;
    const before = h.shots.length;
    h.step(3);
    expect(h.shots.length).toBe(before);
  });

  it('przeładowuje po `burstsPerReload` seriach', () => {
    const h = harness();
    h.hostiles.push(enemyAt(0, 12));
    h.step(14);
    expect(h.events.some((e) => e.type === 'bark' && e.kind === 'reload')).toBe(
      true,
    );
  });

  it('downed → reviving → follow: gracz podnosi przez reviveS, przerwane podnoszenie się cofa', () => {
    const h = harness();
    h.step(0.5);
    h.health.set(0);
    h.step(DT);
    expect(h.ally.state).toBe('downed');
    expect(h.ally.invulnerable).toBe(true);
    expect(h.events.some((e) => e.type === 'downed')).toBe(true);
    h.hostiles.push(enemyAt(0, 8));
    h.step(1);
    expect(h.shots).toHaveLength(0);
    h.step(h.ally.definition.reviveS / 2, true);
    expect(h.ally.state).toBe('reviving');
    expect(h.ally.snapshot().reviveProgress).toBeGreaterThan(0.4);
    h.step(1);
    expect(h.ally.state).toBe('downed');
    expect(h.ally.snapshot().reviveProgress).toBe(0);
    h.hostiles.length = 0;
    h.step(h.ally.definition.reviveS + DT, true);
    expect(h.ally.state).toBe('follow');
    expect(h.health.current).toBeCloseTo(
      h.health.max * tuning.allies.reviveHpFraction,
    );
    expect(h.events).toContainEqual({ type: 'revived', by: 'player' });
  });

  it('niepodniesiony przez downedTimeoutS czeka na checkpoint i wraca z pełnym zdrowiem', () => {
    const h = harness();
    h.ally.knockDown(null);
    h.step(tuning.allies.downedTimeoutS + 0.5);
    expect(h.ally.evacuated).toBe(true);
    expect(h.events).toContainEqual({ type: 'evacuated' });
    h.step(5, true);
    expect(h.ally.state).toBe('downed');
    h.ally.revive('checkpoint', v(4, 4));
    expect(h.ally.state).toBe('follow');
    expect(h.ally.evacuated).toBe(false);
    expect(h.health.current).toBe(h.health.max);
    expect(h.ally.position).toMatchObject({ x: 4, z: 4 });
  });

  it('hold: zostaje na miejscu, walczy i nie idzie za graczem; follow przywraca marsz', () => {
    const h = harness();
    h.ally.setOrder('hold');
    h.leader.position = v(0, -20);
    h.step(3);
    expect(h.ally.state).toBe('hold');
    expect(Math.hypot(h.ally.position.x, h.ally.position.z)).toBeLessThan(0.1);
    h.hostiles.push(enemyAt(0, 10));
    h.step(1.5);
    expect(h.shots.length).toBeGreaterThan(0);
    h.hostiles.length = 0;
    h.ally.setOrder('follow');
    h.step(4);
    expect(h.ally.position.z).toBeLessThan(-10);
  });

  it('ustępuje graczowi, który na niego wszedł, i dołącza skokiem z bardzo daleka', () => {
    const h = harness('nadia', v(0.3, 0.3));
    h.step(1);
    expect(
      Math.hypot(h.ally.position.x, h.ally.position.z),
    ).toBeGreaterThanOrEqual(tuning.allies.yieldRadiusM - 0.05);
    h.leader.position = v(0, -200);
    h.step(DT * 2);
    expect(
      Math.hypot(h.ally.position.x, h.ally.position.z + 200),
    ).toBeLessThanOrEqual(tuning.allies.teleportBehindM + 0.5);
  });

  it('w rozkazie follow zrywa walkę, gdy gracz odejdzie dalej niż leashM', () => {
    const h = harness();
    h.hostiles.push(enemyAt(0, 10));
    h.step(1);
    expect(h.ally.state).not.toBe('follow');
    h.leader.position = v(0, -(tuning.allies.leashM + 6));
    h.step(1.2);
    expect(h.ally.state).toBe('follow');
    expect(h.ally.position.z).toBeLessThan(-1);
  });

  it('ten sam seed daje ten sam przebieg', () => {
    const run = () => {
      const h = harness();
      h.hostiles.push(enemyAt(3, 12));
      h.step(6);
      return { shots: h.shots, snapshot: h.ally.snapshot() };
    };
    expect(run()).toEqual(run());
  });
});

describe('drużyna w świecie Rapiera', () => {
  async function world() {
    const rapier = await initPhysics();
    const w = new rapier.World({ x: 0, y: -9.81, z: 0 });
    const bus = new EventBus();
    const entities = new EntityRegistry(bus);
    const damage = new DamageSystem(bus, entities);
    const hurtboxes = new Hurtboxes();
    const t = structuredClone(tuning);
    const projectiles = new ProjectileSystem(
      w,
      entities,
      hurtboxes,
      damage,
      bus,
      t,
    );
    const solid = interactionGroups(CollisionGroup.World, 0xffff);
    w.createCollider(
      rapier.ColliderDesc.cuboid(40, 0.5, 40)
        .setTranslation(0, -0.5, 0)
        .setCollisionGroups(solid),
    );
    const wall = w.createCollider(
      rapier.ColliderDesc.cuboid(6, 2, 0.25)
        .setTranslation(0, 2, 5)
        .setCollisionGroups(solid),
    );
    const playerId = entities.create('player', 'player');
    const enemyId = entities.create('gunner', 'enemy');
    const enemyHealth = new Health(() => 1000);
    damage.register(enemyId, enemyHealth);
    const enemyBox = w.createCollider(
      rapier.ColliderDesc.capsule(0.5, 0.35)
        .setTranslation(0, 1, 10)
        .setSensor(true)
        .setCollisionGroups(interactionGroups(CollisionGroup.Enemy, 0xffff)),
    );
    hurtboxes.add(enemyId, enemyBox);
    const state = { enemyAlive: true };
    const squad = new AllySquad({
      ctx: { bus, rng: new Rng('squad'), tuning: t },
      rapier,
      world: w,
      entities,
      damage,
      hurtboxes,
      projectiles,
      navigation: () => null,
      leader: () => ({
        id: playerId,
        position: v(0, -1),
        yaw: 0,
        alive: true,
      }),
      hostiles: () =>
        state.enemyAlive
          ? [{ id: enemyId, position: v(0, 10), centerM: 1 }]
          : [],
    });
    const step = (seconds: number, reviveHeld = false) => {
      for (let i = 0; i < Math.round(seconds / DT); i++) {
        damage.step(DT);
        squad.step(DT, reviveHeld);
        w.timestep = DT;
        w.step();
        projectiles.step(DT);
      }
    };
    w.step();
    return {
      w,
      bus,
      squad,
      wall,
      damage,
      entities,
      projectiles,
      enemyId,
      enemyHealth,
      playerId,
      state,
      step,
      t,
    };
  }

  it('sojusznik nie strzela przez ścianę; po jej zniknięciu rani wroga pociskami drużyny', async () => {
    const s = await world();
    const ally = s.squad.add('nadia', v(0, 0))!;
    s.step(3);
    expect(ally.snapshot().shots).toBe(0);
    expect(s.projectiles.activeCount).toBe(0);
    expect(s.enemyHealth.current).toBe(1000);
    s.wall.setEnabled(false);
    s.step(3);
    expect(ally.snapshot().shots).toBeGreaterThan(0);
    expect(s.enemyHealth.current).toBeLessThan(1000);
    s.squad.dispose();
    s.w.free();
  });

  it('zabójstwo liczy się sojusznikowi, a gracz i drużyna go nie ranią', async () => {
    const s = await world();
    s.wall.setEnabled(false);
    const ally = s.squad.add('nadia', v(0, 0))!;
    s.enemyHealth.set(5);
    s.step(3);
    expect(s.enemyHealth.dead).toBe(true);
    expect(s.squad.kills).toBe(1);
    s.state.enemyAlive = false;
    const hp = ally.snapshot().hp;
    expect(
      s.damage.deal(ally.entity, {
        amount: 30,
        source: s.playerId,
        tags: ['#explosion'],
      }),
    ).toBe(0);
    expect(ally.snapshot().hp).toBe(hp);
    s.squad.dispose();
    s.w.free();
  });

  it('obrażenia wroga powalają, wróg przestaje go wybierać, gracz podnosi klawiszem', async () => {
    const s = await world();
    const events: string[] = [];
    s.bus.on('ally_downed', ({ ally }) => events.push(`down:${ally}`));
    s.bus.on('ally_revived', ({ ally, by }) => events.push(`up:${ally}:${by}`));
    s.bus.on('player_died', () => events.push('player_died'));
    s.bus.on('enemy_killed', () => events.push('enemy_killed'));
    const ally = s.squad.add('szron', v(0, 0))!;
    const player = { id: s.playerId, position: v(0, -1, 0.9) };
    // sojusznik stoi między wrogiem a graczem: jest wyraźnie bliżej, więc ściąga ogień
    const enemy = { id: s.enemyId, position: v(0, 2.5) };
    expect(s.squad.targetFor(enemy, player)?.id).toBe(ally.entity);
    expect(s.squad.targetFor(enemy, null)?.id).toBe(ally.entity);
    expect(
      s.damage.deal(ally.entity, {
        amount: 10_000,
        source: s.enemyId,
        tags: ['#gun'],
      }),
    ).toBeGreaterThan(0);
    expect(ally.state).toBe('downed');
    expect(events).toEqual(['down:szron']);
    expect(s.squad.targetFor(enemy, player)?.id).toBe(s.playerId);
    expect(s.squad.targetFor(enemy, null)).toBeNull();
    expect(
      s.damage.deal(ally.entity, {
        amount: 10,
        source: s.enemyId,
        tags: ['#gun'],
      }),
    ).toBe(0);
    expect(s.squad.reviveCandidate()).toBe(ally);
    s.step(ally.definition.reviveS + 0.2, true);
    expect(ally.state).not.toBe('downed');
    expect(ally.down).toBe(false);
    expect(events).toEqual(['down:szron', 'up:szron:player']);
    s.squad.dispose();
    s.w.free();
  });

  it('restore: checkpoint stawia całą drużynę przy punkcie, a bez punktu wracają tylko ewakuowani', async () => {
    const s = await world();
    s.state.enemyAlive = false;
    s.squad.add('nadia', v(0, 0));
    s.squad.add('szron', v(1.5, 0));
    expect(s.squad.add('nadia', v(0, 0))).toBeNull();
    expect(s.squad.knockDown('nadia')).toBe(true);
    s.squad.restore();
    expect(s.squad.get('nadia')!.state).toBe('downed');
    s.step(s.t.allies.downedTimeoutS + 0.5);
    expect(s.squad.get('nadia')!.evacuated).toBe(true);
    expect(s.squad.reviveCandidate()).toBeNull();
    s.squad.restore();
    expect(s.squad.get('nadia')!.down).toBe(false);
    s.squad.knockDown('szron');
    s.squad.restore(v(20, 20));
    for (const snapshot of s.squad.snapshots()) {
      expect(snapshot.state).toBe('follow');
      expect(snapshot.hp).toBe(snapshot.maxHp);
      expect(
        Math.hypot(snapshot.position.x - 20, snapshot.position.z - 20),
      ).toBeLessThan(3);
    }
    s.squad.setOrder('hold');
    expect(s.squad.snapshots().every((a) => a.order === 'hold')).toBe(true);
    s.squad.dispose();
    s.w.free();
  });
});
