import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Box3,
  Group,
  InstancedMesh,
  LineSegments,
  Mesh,
  MeshToonMaterial,
  PerspectiveCamera,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three';
import { tuning } from '../../src/core/tuning';
import { EventBus } from '../../src/core/events';
import { FusionReactor } from '../../src/render/fusionReactor';
import { CityDressing } from '../../src/render/city/dressing';
import { resolveTheme } from '../../src/render/themes';
import { gradientMap } from '../../src/render/materials';
import { AudioSystem } from '../../src/audio/audioSystem';
import type { AudioBackend } from '../../src/audio/synth';
import { loadSfx } from '../../src/audio/sfxSchema';
import { loadRoom, setPieceSchema } from '../../src/world/roomSchema';
import yard from './fixtures/legacyYard.json';
import sfx from '../../src/data/audio/sfx.json';

const definition = {
  kind: 'fusionReactor',
  position: { x: 0, y: 0, z: 0 },
} as const;
const baseline = { ...tuning.render.fusionReactor };
afterEach(() => {
  Object.assign(tuning.render.fusionReactor, baseline);
  vi.restoreAllMocks();
});

describe('render-only fusion reactor', () => {
  it('validates optional room setPieces without changing legacy maps or collision blocks', () => {
    expect(loadRoom(yard).setPieces).toBeUndefined();
    const room = loadRoom({
      ...yard,
      setPieces: [
        definition,
        { ...definition, position: { x: 2, y: 3, z: -4 }, yaw: 1.2, scale: 2 },
      ],
    });
    expect(room.setPieces).toHaveLength(2);
    expect(room.blocks).toEqual(yard.blocks);
    expect(room.spawnPoints).toEqual(yard.spawnPoints);
    expect(loadRoom({ ...yard, setPieces: [] }).setPieces).toEqual([]);
    for (const invalid of [
      { ...definition, kind: 'other' },
      { ...definition, scale: 0 },
      { ...definition, scale: -1 },
      { ...definition, scale: Infinity },
      { ...definition, yaw: NaN },
      { ...definition, position: { x: 0, y: 0 } },
      { ...definition, position: { x: Infinity, y: 0, z: 0 } },
    ])
      expect(setPieceSchema.safeParse(invalid).success).toBe(false);
  });

  it('builds a monumental toon tokamak in Node within the draw/object budget', () => {
    const reactor = new FusionReactor(definition);
    let objects = 0,
      draws = 0,
      instanced = 0,
      toon = 0,
      emissive = 0;
    reactor.root.traverse((node) => {
      objects++;
      if (
        node instanceof Mesh ||
        node instanceof LineSegments ||
        node instanceof Points
      ) {
        const material = node.material;
        expect(Array.isArray(material)).toBe(false);
        const one = Array.isArray(material) ? material[0]! : material;
        draws += Math.max(1, node.geometry.groups.length);
        if (one instanceof MeshToonMaterial) {
          expect(one.gradientMap).toBe(gradientMap);
          toon++;
        }
        if (one.userData.bloom) emissive++;
      }
      if (node instanceof InstancedMesh) instanced++;
    });
    expect(objects).toBeLessThanOrEqual(150);
    expect(draws).toBeLessThanOrEqual(150);
    // Color, normals, bloom mask and an additional full geometry pass.
    expect(draws * 4).toBeLessThanOrEqual(150);
    expect(instanced).toBeGreaterThanOrEqual(10);
    expect(toon).toBeGreaterThan(10);
    expect(emissive).toBeGreaterThan(5);
    const size = new Box3().setFromObject(reactor.root).getSize(new Vector3());
    expect(size.x).toBeGreaterThan(20);
    expect(size.x).toBeLessThan(26);
    expect(size.y).toBeGreaterThan(9);
    expect(size.y).toBeLessThan(11);
    expect(reactor.lightDefs).toHaveLength(2);
    reactor.dispose();
  });

  it('applies yaw, position and scale to geometry and light source positions', () => {
    const original = new FusionReactor(definition);
    const moved = new FusionReactor({
      ...definition,
      position: { x: 11, y: 3, z: -7 },
      yaw: Math.PI / 2,
      scale: 2,
    });
    expect(moved.root.position.toArray()).toEqual([11, 3, -7]);
    expect(moved.root.scale.toArray()).toEqual([2, 2, 2]);
    const expected = new Vector3()
      .copy(original.lightDefs[0]!.position)
      .applyMatrix4(moved.root.matrixWorld);
    expect(moved.lightDefs[0]!.position.x).toBeCloseTo(expected.x);
    expect(moved.lightDefs[0]!.position.y).toBeCloseTo(expected.y);
    expect(moved.lightDefs[0]!.position.z).toBeCloseTo(expected.z);
    expect(moved.lightDefs[0]!.range).toBe(original.lightDefs[0]!.range * 2);
    original.dispose();
    moved.dispose();
  });

  it('reproduces the same animation state when seeking time; reuses geometry and buffers', () => {
    const reactor = new FusionReactor(definition);
    const other = new FusionReactor(definition);
    const state = (value: FusionReactor) => {
      value.root.updateMatrixWorld(true);
      const transforms: number[][] = [];
      const buffers: number[][] = [];
      const uniforms: number[] = [];
      value.root.traverse((node) => {
        transforms.push([...node.matrix.elements, Number(node.visible)]);
        if (node instanceof LineSegments)
          buffers.push(
            Array.from(node.geometry.getAttribute('position').array),
          );
        if (node instanceof Mesh && node.material instanceof ShaderMaterial)
          uniforms.push(
            node.material.uniforms.timeS!.value as number,
            node.material.uniforms.pulse!.value as number,
          );
      });
      return {
        transforms,
        buffers,
        uniforms,
        lights: value.lightDefs.map((light) => light.intensity),
      };
    };
    const arcs = reactor.root.children[0]!.children.find(
      (node) => node instanceof LineSegments,
    ) as LineSegments;
    const buffer = arcs.geometry.getAttribute('position').array;
    const geometry = arcs.geometry;
    reactor.update(1.04);
    const expected = state(reactor);
    reactor.update(8.2);
    expect(state(reactor)).not.toEqual(expected);
    reactor.update(1.04);
    other.update(1.04);
    expect(state(reactor)).toEqual(expected);
    expect(state(other)).toEqual(expected);
    expect(arcs.geometry).toBe(geometry);
    expect(arcs.geometry.getAttribute('position').array).toBe(buffer);
    reactor.update(1.04, false);
    expect(arcs.visible).toBe(false);
    reactor.dispose();
    other.dispose();
  });

  it('updates set pieces only in render, shares the city light pool, and cleans up once', () => {
    const root = new Group();
    const setFusionReactors = vi.fn();
    const updateAmbience = vi.fn();
    const theme = resolveTheme('white');
    const dressing = new CityDressing(
      root,
      { setPieces: [definition] },
      theme,
      0,
      'test',
      {
        setAmbience: vi.fn(),
        updateAmbienceSource: vi.fn(),
        setFusionReactors,
        updateAmbience,
      },
    );
    expect(dressing.active).toBe(true);
    const reactor = root.getObjectByName('fusionReactor')!;
    const body = reactor.children[0]!;
    const ring = body.children.find((node) => node instanceof Group)!;
    dressing.step(5);
    expect(ring.rotation.y).toBe(0);
    const camera = new PerspectiveCamera(70, 1, 0.1, 100);
    camera.position.set(0, 8, 20);
    camera.lookAt(0, 5, 0);
    dressing.render(1, camera);
    expect(ring.rotation.y).not.toBe(0);
    let points = 0;
    root.traverse((node) => {
      if (node.type === 'PointLight') points++;
    });
    expect(points).toBeLessThanOrEqual(tuning.city.maxLights);
    expect(setFusionReactors).toHaveBeenCalledTimes(1);
    expect(updateAmbience).toHaveBeenCalledTimes(1);
    const toon = body.children.find((node) => node instanceof Mesh) as Mesh;
    const dispose = vi.spyOn(toon.geometry, 'dispose');
    dressing.dispose();
    dressing.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(root.getObjectByName('fusionReactor')).toBeUndefined();
    expect(setFusionReactors).toHaveBeenLastCalledWith(null);
  });

  it('contains no simulation imports or nondeterministic random calls in the new FX path', () => {
    for (const file of [
      'src/render/fusionReactor.ts',
      'src/audio/fusionReactorHum.ts',
    ]) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(/Math\.random\s*\(/);
      expect(source).not.toMatch(
        /from ['"].*(?:physics|combat|enemies|player)\//,
      );
    }
  });
});

it('starts procedural hum after unlock, pans/attenuates it, respects pause/volume, and releases nodes', () => {
  let started = 0,
    stopped = 0;
  const gains: { value: number }[] = [];
  const pans: { value: number }[] = [];
  const param = () => {
    const p = {
      value: 0,
      setValueAtTime(value: number) {
        p.value = value;
      },
      setTargetAtTime(value: number) {
        p.value = value;
      },
    };
    return p;
  };
  const node = () => ({ connect() {}, disconnect() {} });
  const source = () => ({
    ...node(),
    start() {
      started++;
    },
    stop() {
      stopped++;
    },
  });
  const ctx = {
    state: 'suspended',
    currentTime: 0,
    sampleRate: 8000,
    destination: node(),
    createGain() {
      const gain = param();
      gains.push(gain);
      return { ...node(), gain };
    },
    createStereoPanner() {
      const pan = param();
      pans.push(pan);
      return { ...node(), pan };
    },
    createOscillator() {
      return { ...source(), frequency: param(), type: 'sine' };
    },
    createBiquadFilter() {
      return { ...node(), frequency: param(), type: 'lowpass' };
    },
    createBufferSource() {
      return { ...source(), buffer: null, loop: false };
    },
    createBuffer(_channels: number, length: number) {
      return { getChannelData: () => new Float32Array(length) };
    },
    async resume() {
      ctx.state = 'running';
    },
  };
  const listener = { position: { x: 0, y: 0, z: 0 }, yaw: 0 };
  let volume = 1;
  const audio = new AudioSystem(new EventBus(), loadSfx(sfx), {
    createContext: () => ctx as unknown as AudioBackend,
    tuning,
    masterVolume: () => volume,
    listener: () => listener,
  });
  audio.setFusionReactors([{ x: 8, y: 0, z: 0 }]);
  audio.updateAmbience();
  expect(started).toBe(0);
  ctx.state = 'running';
  audio.updateAmbience();
  expect(started).toBe(3);
  expect(pans[0]!.value).toBeGreaterThan(0);
  const nearGain = gains[1]!.value;
  listener.position.x = -100;
  audio.updateAmbience();
  expect(gains[1]!.value).toBeLessThan(nearGain);
  audio.updateAmbience(true);
  expect(gains[1]!.value).toBe(0);
  volume = 0;
  audio.updateAmbience();
  expect(gains[0]!.value).toBe(0);
  audio.setFusionReactors(null);
  expect(stopped).toBe(3);
  audio.dispose();
  expect(stopped).toBe(3);
});
