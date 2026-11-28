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
import {
  urbanUniforms,
  arenaKinds,
  urbanLooks,
  createUrbanMaterial,
} from '../../src/render/urbanMaterials';
import { Weather } from '../../src/vfx/weather';
import { arenaSpawnPoints } from '../../src/world/arenaSpawns';
import { ArenaNavigation } from '../../src/world/arenaNavigation';
import {
  conquestModeSchema,
  modeForArena,
  selectArena,
  validateMode,
} from '../../src/world/modeSchema';
import { conquestMode } from '../../src/world/modes';
import { roomDefinitions, loadRoomDefinitions } from '../../src/world/rooms';
import { RunManager } from '../../src/world/run';
import { EventBus } from '../../src/core/events';

const port = roomDefinitions.get('arenaContainerPort')!;
const ring = roomDefinitions.get('combatRing')!;
const rain = weatherDefinitions.get('rain')!;
afterEach(() => vi.restoreAllMocks());

const rainMatrices = (weather: Weather): number[] => {
  const matrix = new Matrix4();
  const out: number[] = [];
  for (let i = 0; i < weather.rainCount; i++)
    out.push(...weather.dropMatrix(i, matrix).elements);
  return out;
};

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
      expect(dressing.weather!.rainCount).toBeGreaterThan(0);
      for (let i = 0; i < dressing.weather!.rainCount; i++) {
        dressing.weather!.dropMatrix(i, matrix);
        expect(matrix.determinant()).toBe(0);
      }
    } finally {
      dressing.dispose();
    }
  });
  it('opad i efekty otoczenia sięgają weatherFloorY (ulica pod dachami)', () => {
    const dressing = new CityDressing(
      new Group(),
      {
        weather: 'drizzleWind',
        weatherFloorY: -14,
        ambientFx: [{ kind: 'drip', position: { x: 0, y: -2, z: 0 } }],
      },
      themeDefinitions.get('neonStreet')!,
      0,
      'weather-floor',
    );
    try {
      expect(Reflect.get(dressing.weather!, 'floorY')).toBe(-14);
      expect(Reflect.get(Reflect.get(dressing, 'ambient'), 'floorY')).toBe(-14);
    } finally {
      dressing.dispose();
    }
  });
  it('waliduje profile, limity i kolory wyładowań', () => {
    expect([...weatherDefinitions.keys()].sort()).toEqual([
      'ashfall',
      'bulwarNightMarket',
      'clearNight',
      'drizzleWind',
      'helixaClinic',
      'indoorIndustrial',
      'kuroganeForestResidence',
      'kuroganeFusionPlant',
      'kuroganeOfficeTower',
      'kuroganeSecretLab',
      'kuroganeWarehouse',
      'mallAfterHours',
      'rain',
      'smog',
      'snow',
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
  it('Helixa ma spokojny deszcz, włączoną panoramę i wyłączone błyskawice', () => {
    const profile = weatherSchema.parse(weatherDefinitions.get('helixaClinic'));
    expect(profile.precipitation.kind).toBe('rain');
    expect(profile.lightning.enabled).toBe(false);
    expect(profile.lighting?.panoramaEnabled).toBe(true);
    expect(profile.fog.nearM).toBeGreaterThan(Math.hypot(36, 44));
    expect(profile.ambience.map((source) => source.kind)).toEqual([
      'rain',
      'generator',
    ]);
  });
  it('nocny targ ma deszcz, mokre powierzchnie i panoramę bez wyładowań', () => {
    const profile = weatherSchema.parse(
      weatherDefinitions.get('bulwarNightMarket'),
    );
    expect(profile).toMatchObject({
      title: 'Nocny targ na Bulwarze',
      precipitation: { kind: 'rain', density: 0.36 },
      fog: { density: 0.004 },
      surface: { gloss: 0.1, reflections: 0.7, puddles: 0.45 },
      lighting: { panoramaEnabled: true },
      sky: { horizonColor: '#2b1f3d' },
      lightning: { enabled: false },
      ambience: [
        { kind: 'rain', gain: 0.3, radiusM: 100 },
        { kind: 'crowd', gain: 0.06, radiusM: 100 },
      ],
    });
  });
  it('Biurowiec Kurogane ma deszcz za szybą, włączoną panoramę, zerową mgłę i brak błyskawic', () => {
    const profile = weatherSchema.parse(
      weatherDefinitions.get('kuroganeOfficeTower'),
    );
    expect(profile.precipitation.kind).toBe('rain');
    expect(profile.precipitation.density).toBeCloseTo(0.42);
    expect(profile.fog.density).toBe(0);
    expect(profile.fog.strength).toBe(0);
    expect(profile.dust.density).toBe(0);
    expect(profile.lightning.enabled).toBe(false);
    expect(profile.lighting).toEqual({
      hemiIntensity: 4.4,
      keyIntensity: 1.55,
      panoramaEnabled: true,
    });
    expect(profile.sky?.horizonColor).toBe('#2b1f3d');
    expect(profile.ambience.map((source) => source.kind)).toEqual([
      'generator',
      'wind',
    ]);
  });
  it.each(['snow', 'ashfall'])(
    '%s: wymaga poprawnych parametrów płatków',
    (id) => {
      const profile = weatherDefinitions.get(id)!;
      expect(weatherSchema.safeParse(profile).success).toBe(true);
      for (const flakes of [
        undefined,
        { ...profile.precipitation.flakes, sizeM: 0 },
        { ...profile.precipitation.flakes, swayM: -1 },
        { ...profile.precipitation.flakes, swayPeriodS: 0 },
        { ...profile.precipitation.flakes, windScatter: -1 },
        { ...profile.precipitation.flakes, secondaryColor: 'grey' },
      ])
        expect(
          weatherSchema.safeParse({
            ...profile,
            precipitation: { ...profile.precipitation, flakes },
          }).success,
        ).toBe(false);
      expect(
        weatherSchema.safeParse({
          ...profile,
          surface: { ...profile.surface, snowCoverage: 2 },
        }).success,
      ).toBe(false);
    },
  );
  it('kolory wszystkich profili omijają zarezerwowane zakresy barw', () => {
    const checkColors = (value: unknown): void => {
      if (typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)) {
        const [r, g, b] = [1, 3, 5].map(
          (i) => parseInt(value.slice(i, i + 2), 16) / 255,
        ) as [number, number, number];
        const max = Math.max(r, g, b),
          min = Math.min(r, g, b),
          delta = max - min;
        if (max === 0 || delta / max < 0.35) return;
        const hue =
          ((max === r
            ? (g - b) / delta
            : max === g
              ? (b - r) / delta + 2
              : (r - g) / delta + 4) *
            60 +
            360) %
          360;
        expect(
          hue < 15 ||
            hue > 345 ||
            (hue >= 170 && hue <= 195) ||
            (hue >= 285 && hue <= 335),
          value,
        ).toBe(false);
      } else if (value && typeof value === 'object')
        Object.values(value).forEach(checkColors);
    };
    for (const profile of weatherDefinitions.values()) checkColors(profile);
  });
  it('stare profile mają neutralne nowe pola', () => {
    for (const id of ['rain', 'storm', 'smog', 'drizzleWind', 'clearNight']) {
      const profile = weatherDefinitions.get(id)!;
      expect(profile.surface.snowCoverage).toBe(0);
      expect(profile.precipitation.flakes).toBeUndefined();
      expect(profile.sky).toBeUndefined();
    }
  });
  it.each(['snow', 'ashfall'])(
    '%s: ukrywa płatek po zbliżeniu kamery nawet podczas pauzy',
    (id) => {
      const weather = new Weather({}, 0, 'near-flake');
      const camera = new PerspectiveCamera();
      const matrix = new Matrix4();
      weather.setProfile(weatherDefinitions.get(id)!);
      try {
        weather.update(0, 0, camera);
        let visible = 0;
        for (; visible < weather.rainCount; visible++) {
          weather.dropMatrix(visible, matrix);
          if (matrix.determinant() !== 0) break;
        }
        expect(visible).toBeLessThan(weather.rainCount);
        camera.position.setFromMatrixPosition(matrix);
        weather.update(0, 0, camera);
        weather.dropMatrix(visible, matrix);
        expect(matrix.determinant()).toBe(0);
      } finally {
        weather.dispose();
      }
    },
  );
  it.each(['snow', 'ashfall'])(
    '%s: deterministyczne płatki bez rozbryzgów i błysków',
    (id) => {
      const a = new Weather({}, 0, 'flakes'),
        b = new Weather({}, 0, 'flakes');
      const camera = new PerspectiveCamera();
      a.setProfile(weatherDefinitions.get(id)!);
      b.setProfile(weatherDefinitions.get(id)!);
      try {
        for (let i = 0; i < 180; i++) {
          a.update(1 / 60, 1 / 60, camera);
          b.update(1 / 60, 1 / 60, camera);
        }
        expect(rainMatrices(a)).toEqual(rainMatrices(b));
        expect(a.splashCount).toBe(0);
        expect(a.flash).toBe(0);
        const paused = rainMatrices(a);
        a.update(0, 1, camera);
        expect(rainMatrices(a)).toEqual(paused);
        a.setProfile(rain);
        a.update(0, 0, camera);
        expect(a.rain.material.color.getHexString()).toBe(
          rain.precipitation.color.slice(1),
        );
        expect(a.rainUniforms.rainTintMode.value).toBe(0);
      } finally {
        a.dispose();
        b.dispose();
      }
    },
  );
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
    const coverage = urbanUniforms.snowCoverage.value;
    const snowColor = urbanUniforms.snowColor.value.clone();
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
      expect(dressing.weather!.rainCount).toBe(
        p.precipitation.kind === 'none'
          ? 0
          : Math.floor(dressing.weather!.capacity * p.precipitation.density),
      );
      expect(tuning.render.fogColor).toBe(p.fog.color);
      expect(urbanUniforms.snowCoverage.value).toBe(p.surface.snowCoverage);
      expect(tuning.render.skyHorizon).toBe(
        p.sky?.horizonColor ?? previous.skyHorizon,
      );
    }
    expect(dressing.setWeather('missing')).toBe(false);
    dressing.dispose();
    dressing.dispose();
    expect(tuning.render).toEqual(previous);
    expect(urbanUniforms.weatherGloss.value).toBe(gloss);
    expect(urbanUniforms.snowCoverage.value).toBe(coverage);
    expect(urbanUniforms.snowColor.value).toEqual(snowColor);
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
    expect([...selected].sort()).toEqual([...conquestMode.arenas!].sort());
    expect(() =>
      selectArena(conquestMode, 'any', 'combatRing', true),
    ).toThrow();
    expect(() => selectArena(conquestMode, 'any', 'unknown', true)).toThrow();
  });
  it('czyta stary roomId i punkty, zachowuje wybraną arenę w istniejącym zapisie', () => {
    const legacy = conquestModeSchema.parse({
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
    for (const room of conquestMode.arenas!.map((id) =>
      roomDefinitions.get(id)!,
    ))
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
    badSpawn.arena!.spawnPoints![0] = {
      ...badSpawn.arena!.points[0]!.position,
    };
    expect(() =>
      validateMode(
        modeForArena(conquestMode, badSpawn),
        badSpawn,
        conquestMode.enemies,
      ),
    ).toThrow('Spawn');
  });
  it.each(['arenaOverpass', 'arenaRooftops'])(
    '%s: wysokie punkty wymagają ramp i schodów, fałszywa wysokość jest odrzucana',
    (id) => {
      const room = structuredClone(roomDefinitions.get(id)!);
      const mode = modeForArena(conquestMode, room);
      validateMode(mode, room, mode.enemies);
      const navigation = new ArenaNavigation(room);
      for (const point of mode.points) {
        const path = navigation.path(room.playerSpawn, point.position);
        expect(path.length).toBeGreaterThan(0);
        for (let i = 1; i < path.length; i++)
          expect(Math.abs(path[i]!.y - path[i - 1]!.y)).toBeLessThanOrEqual(
            room.arena!.navigationMaxRiseM!,
          );
      }
      const wrongHeight = structuredClone(mode);
      wrongHeight.points[1]!.position.y += 1;
      expect(() => validateMode(wrongHeight, room, mode.enemies)).toThrow(
        'podłogą',
      );
      // Bez ramp i stopni (bloki chodzone o głębokości ≤ 1 m) wyższe poziomy są odcięte.
      room.blocks = room.blocks.filter(
        (b) =>
          !(b.walkable && (b.rotation || Math.min(b.size.x, b.size.z) <= 1)),
      );
      expect(() => validateMode(mode, room, mode.enemies)).toThrow(
        'Nieosiągalna',
      );
    },
  );
  it('powierzchnie aren używają własnych tekstur i parametrów mokrości', () => {
    for (const kind of arenaKinds) {
      expect(urbanLooks[kind].texture).toBe(kind);
      const material = createUrbanMaterial(kind);
      expect(material.userData.wetness).toBe(urbanLooks[kind].wetness);
      material.dispose();
    }
  });
  it('siatka prowadzi z każdego spawnu do każdego punktu bez przecinania osłon', () => {
    const navigation = new ArenaNavigation(port);
    const rng = new Rng('paths');
    for (const start of [port.playerSpawn, ...arenaSpawnPoints(port)]) {
      for (const goal of rng.shuffle([...port.arena!.points])) {
        const path = navigation.path(start, goal.position);
        expect(path.length).toBeGreaterThan(0);
        expect(path.at(-1)).toEqual(goal.position);
        for (let index = 1; index < path.length; index++)
          expect(
            Math.abs(path[index]!.y - path[index - 1]!.y),
          ).toBeLessThanOrEqual(port.arena!.navigationMaxRiseM!);
        expect(navigation.next(start, goal.position)).not.toEqual(start);
      }
    }
  });
});
