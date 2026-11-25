import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  ShaderMaterial,
  Texture,
} from 'three';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import { CityDressing, lightSpotFloors } from '../../src/render/city/dressing';
import { DecalRenderer } from '../../src/render/city/decals';
import { resolveTextureKey } from '../../src/render/comicSurfaces';
import { getMaterial } from '../../src/render/materials';
import { themeDefinitions } from '../../src/render/themes';
import { weatherDefinitions } from '../../src/render/weatherSchema';
import { MapAuditScene } from '../../src/scenes/mapAuditScene';
import { testRoomById } from '../../src/scenes/roomTest';
import { ArenaNavigation } from '../../src/world/arenaNavigation';
import { selectWaveSpawn } from '../../src/world/arenaSpawns';
import {
  blockMaterialSchema,
  decalSchema,
} from '../../src/world/dressingSchema';
import { roomSchema } from '../../src/world/roomSchema';

const room = testRoomById('indoorTest')!;
const pos = (x: number, y: number, z: number) => ({ x, y, z });
const slab = (x: number, z: number, w: number, d: number) => ({
  position: pos(x, 0.1, z),
  size: pos(w, 0.4, d),
});

describe('fundamenty wnętrz', () => {
  it('preferuje osłonięty punkt w zasięgu trasy, uwzględniając obejście ściany', () => {
    const nav = new ArenaNavigation(room);
    const player = pos(1, 0, 0),
      acrossWall = pos(5, 0, 0);
    const behind = pos(-7, 0, 3),
      visible = pos(-6, 0, 3);
    const pick = (points: (typeof player)[], max: number) =>
      selectWaveSpawn(
        points,
        player,
        6,
        max,
        nav,
        (p) => p !== visible,
        new Rng('test'),
      );
    expect(pick([acrossWall, behind, player, visible], 12)).toEqual(behind);
    expect(pick([acrossWall, visible], 22)).toEqual(acrossWall);
  });

  const player = pos(0, 0, 0);
  const pickSpawn = (
    points: (typeof player)[],
    hidden: (point: typeof player) => boolean,
    unreachable?: typeof player,
  ) =>
    selectWaveSpawn(
      points,
      player,
      6,
      22,
      { path: (start, goal) => (start === unreachable ? [] : [goal]) },
      hidden,
      new Rng('fallback'),
    );

  it('wybiera osłonę, gdy wszystkie trasy przekraczają 22 m', () => {
    const hidden = pos(30, 0, 0);
    const visible = pos(23, 0, 0);
    expect(pickSpawn([visible, hidden], (p) => p === hidden)).toEqual(hidden);
    expect(pickSpawn([pos(10, 0, 0), hidden], (p) => p === hidden)).toEqual(
      hidden,
    );
  });

  it('gdy wszystkie punkty są w kadrze, wybiera osiągalny punkt w minimalnej odległości', () => {
    const reachable = pos(26, 0, 0);
    const unreachable = pos(10, 0, 0);
    expect(
      pickSpawn(
        [pos(3, 0, 0), unreachable, reachable],
        () => false,
        unreachable,
      ),
    ).toEqual(reachable);
  });

  it('przy braku odpowiedniej trasy stosuje dotychczasowe losowanie według odległości poziomej', () => {
    const near = pos(1, 2, 0);
    const far = pos(12, 2, 0);
    expect(pickSpawn([near, far], () => true, far)).toEqual(far);
    const tooClose = [near, pos(3, 0, 0)];
    expect(pickSpawn(tooClose, () => true)).toEqual(
      new Rng('fallback').pick(tooClose),
    );
    expect(pickSpawn([], () => false)).toBeNull();
  });

  it('waliduje materiały bloków i rozwiązuje oba zestawy tekstur', () => {
    for (const id of [
      'machine',
      'paint',
      'lacquer',
      'plastic',
      'rubber',
      'wood',
      'fabric',
      'hivis',
      'neon_blue',
      'neon_violet',
      'neon_white',
      'tiles_wall',
      'tread_plate',
    ]) {
      expect(getMaterial(blockMaterialSchema.parse(id)).name).toBe('mat_' + id);
    }
    for (const id of ['tiles_wall', 'tread_plate'])
      for (const comic of [true, false]) {
        const key = resolveTextureKey('surfaces', id, comic);
        expect(key).toBe(
          comic ? 'komiks/surfaces/komiks_' + id : 'surfaces/' + id,
        );
        expect(existsSync('public/assets/textures/' + key + '.webp')).toBe(
          true,
        );
      }
  });

  it('stosuje światło profilu, przywraca motyw po zmianie pogody i zwalnia stan po wyjściu', () => {
    const before = { ...tuning.render };
    const p = weatherDefinitions.get('indoorIndustrial')!;
    const dressing = new CityDressing(
      new Group(),
      { weather: p.id },
      themeDefinitions.get('neonStreet')!,
      0,
      'test',
    );
    try {
      expect(p.precipitation.kind).toBe('none');
      expect(p.lightning.enabled).toBe(false);
      expect(tuning.render).toMatchObject({
        hemiIntensity: 0.55,
        keyIntensity: 0.45,
        panoramaEnabled: 0,
      });
      dressing.setWeather('clearNight');
      expect(tuning.render.hemiIntensity).toBe(before.hemiIntensity);
      expect(tuning.render.panoramaEnabled).toBe(before.panoramaEnabled);
      dressing.setWeather(p.id);
    } finally {
      dressing.dispose();
    }
    expect(tuning.render).toEqual(before);
  });

  it('przełącza widoczność sufitu dla kompletu ujęć audytu', () => {
    const audit = new MapAuditScene();
    const roof = new Group();
    Reflect.set(audit, 'ceilings', roof);
    for (const [view, visible] of [
      ['spawn', true],
      ['high-west', false],
      ['top', false],
      ['east', true],
      ['high-east', false],
      ['corner-se', true],
    ] as const) {
      Reflect.set(audit, 'view', view);
      audit.render();
      expect(roof.visible, view).toBe(visible);
    }
  });

  it('stożek kończy się na podeście, jawne floorY ma pierwszeństwo', () => {
    const light = room.lights![0]!;
    const root = new Group();
    const dressing = new CityDressing(
      root,
      { lights: [light], blocks: room.blocks },
      themeDefinitions.get('white')!,
      0,
      'cone',
    );
    try {
      expect(
        lightSpotFloors([light, { ...light, floorY: -1 }], 0, room.blocks),
      ).toEqual([1.2, -1]);
      dressing.render(0, new PerspectiveCamera());
      const cones: InstancedMesh[] = [];
      root.traverse((o) => {
        if (o instanceof InstancedMesh) cones.push(o);
      });
      expect(cones).toHaveLength(1);
      expect(cones[0]!.instanceMatrix.array[5]).toBeCloseTo(
        light.position.y - 1.2,
      );
      expect(
        (
          cones[0]!.material as ShaderMaterial
        ).uniforms.tint!.value.getHexString(),
      ).toBe(light.color.slice(1));
    } finally {
      dressing.dispose();
    }
  });

  it('scala rozłączne oznaczenia i zachowuje kolor, alfę i osobne warstwy nakładek', () => {
    const decal = decalSchema.parse(room.decals![0]);
    const decals = [
      decal,
      { ...decal, position: pos(-9, 0, 1) },
      { ...decal, tint: '#ffffff', position: pos(8, 0, 1) },
    ];
    for (const d of room.decals!)
      expect(
        existsSync('public/assets/textures/decals/' + d.texture + '.webp'),
      ).toBe(true);
    for (const [defs, count] of [
      [decals, 2],
      [[decal, decal], 2],
    ] as const) {
      const renderer = new DecalRenderer(defs, (_url, ready) =>
        ready(new Texture()),
      );
      try {
        expect(renderer.root.children).toHaveLength(count);
        const mesh = renderer.root.children.find(
          (o) =>
            o instanceof Mesh &&
            o.material.color.getHexString() === decal.tint!.slice(1),
        ) as Mesh;
        expect((mesh.material as MeshBasicMaterial).transparent).toBe(true);
      } finally {
        renderer.dispose();
      }
    }
  });

  it('akceptuje ułamkową wysokość i pełny szew, odrzuca szczelinę i obróconą przeszkodę na spawnie', () => {
    const raw = {
      ...room,
      playerSpawn: pos(-2, 0.3, 0),
      spawnPoints: Array(4).fill({ x: 2, z: 0 }),
      blocks: [slab(-1.75, 0, 4.5, 6), slab(2.25, 0, 3.5, 6)],
    };
    expect(roomSchema.safeParse(raw).success).toBe(true);
    expect(
      roomSchema.safeParse({
        ...raw,
        blocks: [raw.blocks[0], slab(2.25, 0, 3.4, 6)],
      }).success,
    ).toBe(false);
    const wall = {
      position: pos(2, 0.8, 1.2),
      size: pos(4, 1, 0.4),
      rotation: pos(0, Math.PI / 2, 0),
    };
    expect(
      roomSchema.safeParse({ ...raw, blocks: [...raw.blocks, wall] }).success,
    ).toBe(false);
  });
});
