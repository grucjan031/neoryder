import { afterEach, describe, expect, it, vi } from 'vitest';
import { Group, Matrix4, PerspectiveCamera } from 'three';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import { CityDressing } from '../../src/render/city/dressing';
import {
  weatherDefinitions,
  weatherSchema,
  loadWeatherDefinitions,
} from '../../src/render/weatherSchema';
import { themeDefinitions } from '../../src/render/themes';
import { urbanUniforms } from '../../src/render/urbanMaterials';
import { Weather } from '../../src/vfx/weather';
import { ArenaNavigation } from '../../src/world/arenaNavigation';
import {
  modeSchema,
  modeForArena,
  selectArena,
  validateMode,
  freeModePosition,
} from '../../src/world/modeSchema';
import { conquestMode } from '../../src/world/modes';
import { roomDefinitions, loadRoomDefinitions } from '../../src/world/rooms';
import { RunManager } from '../../src/world/run';
import { EventBus } from '../../src/core/events';

const port = roomDefinitions.get('arenaContainerPort')!;
const ring = roomDefinitions.get('combatRing')!;
const rain = weatherDefinitions.get('rain')!;
afterEach(() => vi.restoreAllMocks());

describe('pogoda z danych', () => {
  it('profil w pokoju bez deszczu motywu zachowuje jego strefy osłonięte', () => {
    const dressing = new CityDressing(
      new Group(),
      {
        weather: 'storm',
        rainShelters: [
          {
            position: { x: 0, y: 0, z: 0 },
            size: { x: 1000, y: 1000, z: 1000 },
          },
        ],
      },
      themeDefinitions.get('white')!,
      0,
      'white-shelter',
    );
    try {
      dressing.render(0, new PerspectiveCamera());
      const matrix = new Matrix4();
      expect(dressing.weather!.rain.count).toBeGreaterThan(0);
      for (let i = 0; i < dressing.weather!.rain.count; i++) {
        dressing.weather!.rain.getMatrixAt(i, matrix);
        expect(matrix.determinant()).toBe(0);
      }
    } finally {
      dressing.dispose();
    }
  });
  it('waliduje pięć profili, limity i kolory wyładowań', () => {
    expect([...weatherDefinitions.keys()].sort()).toEqual([
      'clearNight',
      'drizzleWind',
      'rain',
      'smog',
      'storm',
    ]);
    for (const profile of weatherDefinitions.values())
      expect(weatherSchema.safeParse(profile).success).toBe(true);
    for (const invalid of [
      { ...rain, precipitation: { ...rain.precipitation, density: 2 } },
      { ...rain, wind: { ...rain.wind, direction: { x: 0, z: 0 } } },
      { ...rain, fog: { ...rain.fog, heightM: 0 } },
      { ...rain, lightning: { ...rain.lightning, maxIntervalS: 1 } },
      { ...rain, lightning: { ...rain.lightning, color: '#00e5ff' } },
    ])
      expect(weatherSchema.safeParse(invalid).success).toBe(false);
    expect(() => loadWeatherDefinitions([rain, rain])).toThrow('Powtórzona');
  });
  it('profil rain odwzorowuje parametry dotychczasowego motywu', () => {
    const legacy = themeDefinitions.get('neonStreet')!;
    for (const key of ['density', 'speed', 'color', 'opacity'] as const)
      expect(rain.precipitation[key]).toBe(legacy.rain[key]);
    expect(rain.wind.strength).toBe(legacy.rain.windX);
    expect(rain.fog.density).toBe(legacy.render.heightFogDensity);
    expect(1 / rain.fog.heightM).toBe(legacy.render.heightFogFalloff);
  });
  it('przełącza wszystkie profile, przywraca render i sprząta audio', () => {
    const previous = structuredClone(tuning.render);
    const gloss = urbanUniforms.weatherGloss.value;
    const audio = { setAmbience: vi.fn(), updateAmbienceSource: vi.fn() };
    const root = new Group();
    const dressing = new CityDressing(
      root,
      {},
      themeDefinitions.get('white')!,
      0,
      'profiles',
      audio,
    );
    const camera = new PerspectiveCamera();
    for (const p of weatherDefinitions.values()) {
      expect(dressing.setWeather(p.id)).toBe(true);
      dressing.step(1 / 60);
      dressing.render(1 / 60, camera);
      expect(dressing.weatherId).toBe(p.id);
      expect(dressing.weather!.rain.count).toBe(
        p.precipitation.kind === 'none'
          ? 0
          : Math.floor(dressing.weather!.capacity * p.precipitation.density),
      );
      expect(tuning.render.fogColor).toBe(p.fog.color);
    }
    expect(dressing.setWeather('missing')).toBe(false);
    dressing.dispose();
    dressing.dispose();
    expect(tuning.render).toEqual(previous);
    expect(urbanUniforms.weatherGloss.value).toBe(gloss);
    expect(audio.setAmbience).toHaveBeenLastCalledWith(null);
    expect(root.children).toHaveLength(0);
  });
  it('wyładowania respektują zakres czasu i deterministyczny seed', () => {
    const profile = weatherDefinitions.get('storm')!;
    const a = new Weather({}, 0, 'flash'),
      b = new Weather({}, 0, 'flash');
    a.setProfile(profile);
    b.setProfile(profile);
    const camera = new PerspectiveCamera();
    for (let i = 0; i < profile.lightning.minIntervalS; i++) {
      a.update(1, 1, camera);
      b.update(1, 1, camera);
      expect(a.flash).toBe(0);
    }
    let flashed = false;
    for (
      let i = profile.lightning.minIntervalS;
      i <= profile.lightning.maxIntervalS;
      i++
    ) {
      a.update(1, 1, camera);
      b.update(1, 1, camera);
      expect(a.flash).toBe(b.flash);
      flashed ||= a.flash > 0;
    }
    expect(flashed).toBe(true);
    a.dispose();
    b.dispose();
  });
});

describe('areny Przejęcia', () => {
  it('wybiera domyślny port, deterministyczny seed i wyłącznie debugowy override', () => {
    expect(selectArena(conquestMode)).toBe(port.id);
    const selected = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const seed = `arena-${i}`;
      expect(selectArena(conquestMode, seed)).toBe(
        selectArena(conquestMode, seed),
      );
      expect(selectArena(conquestMode, seed, 'combatRing', false)).toBe(
        selectArena(conquestMode, seed),
      );
      selected.add(selectArena(conquestMode, seed));
    }
    expect([...selected].sort()).toEqual(['arenaContainerPort', 'combatRing']);
    expect(selectArena(conquestMode, 'any', 'combatRing', true)).toBe(ring.id);
    expect(() => selectArena(conquestMode, 'any', 'unknown', true)).toThrow();
  });
  it('czyta stary roomId i punkty, zachowuje wybraną arenę w istniejącym zapisie', () => {
    const legacy = modeSchema.parse({
      ...conquestMode,
      arenas: undefined,
      roomId: 'combatRing',
      points: ring.arena!.points,
    });
    expect(selectArena(legacy, 'old')).toBe('combatRing');
    expect(modeForArena(legacy, { ...ring, arena: undefined }).points).toEqual(
      ring.arena!.points,
    );
    validateMode(modeForArena(legacy, ring), ring, legacy.enemies);
    const manager = new RunManager(new EventBus(), {
      generateMap: () => ({ sectorId: 'unused', layers: [] }),
    });
    manager.newRun('port', 'classic', { modeId: 'conquest', arenaId: port.id });
    expect(manager.serialize().map.layers[0]![0]!.fixed?.roomId).toBe(port.id);
  });
  it('waliduje granice punktów, osiągalność i spawny poza strefami', () => {
    expect(() => loadRoomDefinitions([port])).not.toThrow();
    for (const room of [port, ring])
      validateMode(
        modeForArena(conquestMode, room),
        room,
        conquestMode.enemies,
      );
    const invalid = structuredClone(port);
    invalid.arena!.points[0]!.position.x = 100;
    expect(() =>
      validateMode(
        modeForArena(conquestMode, invalid),
        invalid,
        conquestMode.enemies,
      ),
    ).toThrow();
    const badSpawn = structuredClone(port);
    badSpawn.spawnPoints[0] = { ...badSpawn.arena!.points[0]!.position };
    expect(() =>
      validateMode(
        modeForArena(conquestMode, badSpawn),
        badSpawn,
        conquestMode.enemies,
      ),
    ).toThrow('Spawn');
  });
  it('siatka prowadzi z każdego spawnu do każdego punktu bez przecinania osłon', () => {
    const navigation = new ArenaNavigation(port);
    const rng = new Rng('paths');
    for (const start of [
      port.playerSpawn,
      ...port.spawnPoints.map((p) => ({ ...p, y: 0 })),
    ]) {
      for (const goal of rng.shuffle([...port.arena!.points])) {
        const path = navigation.path(start, goal.position);
        expect(path.length).toBeGreaterThan(0);
        expect(path.at(-1)).toEqual(goal.position);
        for (const p of path)
          expect(
            freeModePosition(port, p, port.arena!.navigationClearanceM),
          ).toBe(true);
        expect(navigation.next(start, goal.position)).not.toEqual(start);
      }
    }
  });
});
