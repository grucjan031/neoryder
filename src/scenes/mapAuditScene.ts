import {
  Euler,
  PerspectiveCamera,
  Vector3,
  type Scene as ThreeScene,
  type Object3D,
} from 'three';
import type { GameContext } from '../core/context';
import { createMemorySaveStore } from '../core/save';
import { loadMapScene } from './mapSceneLoader';
import { contains, orientedBox, surfaceY } from '../world/mapAuditGeometry';
import type { AuditMapData } from '../world/mapAudit';
import type { CameraPose, Scene } from './index';

function viewpoints(
  map: AuditMapData,
  camera: PerspectiveCamera,
  eyeHeight: number,
) {
  const blocks = map.blocks.map((b) => ({
    def: b,
    box: orientedBox(b.position, b.size, b.rotation),
  }));
  const floors = blocks.filter(
    ({ def, box }) =>
      def.walkable === true ||
      (!def.model &&
        def.walkable !== false &&
        Math.abs(box.max.y - map.playerSpawn.y) < 0.01),
  );
  if (!floors.length) throw new Error('Brak podłogi dla kamery audytu.');
  const minX = Math.min(...floors.map((f) => f.box.min.x)),
    maxX = Math.max(...floors.map((f) => f.box.max.x));
  const minZ = Math.min(...floors.map((f) => f.box.min.z)),
    maxZ = Math.max(...floors.map((f) => f.box.max.z));
  const width = maxX - minX,
    depth = maxZ - minZ;
  const center = new Vector3(
    (minX + maxX) / 2,
    map.playerSpawn.y + eyeHeight,
    (minZ + maxZ) / 2,
  );
  const candidates: Vector3[] = [
    new Vector3().copy(map.playerSpawn).add(new Vector3(0, eyeHeight, 0)),
  ];
  // Próbkuj także małe pomieszczenia i wąskie korytarze misji. Oko ma prześwit w koliderach.
  for (const floor of floors) {
    for (const fx of [-0.8, 0, 0.8])
      for (const fz of [-0.8, 0, 0.8]) {
        const x =
          floor.box.center.x + (fx * (floor.box.max.x - floor.box.min.x)) / 2;
        const z =
          floor.box.center.z + (fz * (floor.box.max.z - floor.box.min.z)) / 2;
        const y = surfaceY(floor.box, { x, y: 0, z }, 0);
        if (y === undefined) continue;
        const eye = new Vector3(x, y + eyeHeight, z);
        if (!blocks.some((b) => b !== floor && contains(b.box, eye, 0.35)))
          candidates.push(eye);
      }
  }
  const nearest = (x: number, z: number) => {
    const target = new Vector3(x, center.y, z);
    return candidates.reduce((a, b) =>
      a.distanceToSquared(target) <= b.distanceToSquared(target) ? a : b,
    );
  };
  const poses = new Map<string, CameraPose>();
  poses.set('spawn', {
    position: camera.position.clone(),
    rotation: camera.rotation.clone(),
  });
  const eye = nearest(center.x, center.z);
  const probe = new PerspectiveCamera();
  function look(name: string, from: Vector3, target: Vector3) {
    probe.position.copy(from);
    probe.lookAt(target);
    poses.set(name, {
      position: from.clone(),
      rotation: probe.rotation.clone(),
    });
  }
  for (const [name, x, z] of [
    ['north', 0, -1],
    ['east', 1, 0],
    ['south', 0, 1],
    ['west', -1, 0],
  ] as const)
    look(name, eye, eye.clone().add(new Vector3(x, 0, z)));
  for (const [name, fx, fz] of [
    ['corner-nw', 0.1, 0.1],
    ['corner-se', 0.9, 0.9],
  ] as const) {
    const corner = nearest(minX + width * fx, minZ + depth * fz);
    look(name, corner, center);
  }
  const radius = Math.hypot(width, depth) * 0.45;
  for (const [name, side] of [
    ['high-west', -1],
    ['high-east', 1],
  ] as const) {
    const offset = new Vector3(side * width, 0, side * depth)
      .normalize()
      .multiplyScalar(radius);
    offset.y = radius * Math.tan((35 * Math.PI) / 180);
    look(name, center.clone().add(offset), center);
  }
  const top = Math.max(...blocks.map((b) => b.box.max.y));
  const height =
    (1.08 * Math.max(depth, width / camera.aspect)) /
    (2 * Math.tan((camera.fov * Math.PI) / 360));
  poses.set('top', {
    position: new Vector3(center.x, top + height, center.z),
    rotation: new Euler(-Math.PI / 2, 0, 0),
  });
  return poses;
}

export class MapAuditScene implements Scene {
  readonly id = 'map-audit';
  private scene?: Scene;
  private ceilings?: Object3D;
  private views = new Map<string, CameraPose>();
  private view = 'spawn';
  private rendered = '';
  private mapId = '';
  private style?: HTMLStyleElement;
  private off?: () => void;

  async init(ctx: GameContext, three: ThreeScene) {
    if (!ctx.debug || !ctx.camera)
      throw new Error('Audyt map wymaga kamery i trybu debug.');
    const params = new URLSearchParams(location.search);
    const id = params.get('map');
    if (!id) throw new Error('Podaj identyfikator mapy w parametrze map.');
    this.mapId = id;
    const loaded = await loadMapScene(id, params, createMemorySaveStore());
    const layout = loaded.layout;
    this.scene = loaded.scene;
    await this.scene.init(ctx, three);
    this.ceilings = three.getObjectByName('room-ceilings');
    this.scene.render(1, 0);
    this.views = viewpoints(layout, ctx.camera, ctx.tuning.player.eyeHeight);
    this.style = document.createElement('style');
    this.style.textContent =
      'body > :not(#app):not(.scene-error), #app > :not(canvas):not(.scene-error) { display: none !important; }';
    document.head.append(this.style);
    this.off = ctx.commands?.register(
      'audit view',
      'audit view <ujęcie>',
      (args) => {
        const name = args[0];
        if (args.length !== 1 || !name || !this.views.has(name))
          return 'Nieznane ujęcie: ' + args.join(' ');
        this.view = name;
        this.rendered = '';
        return name;
      },
    );
    this.render();
  }
  step() {} // Stały stan AI, fizyki i zdarzeń misji dla całej serii.
  render() {
    if (this.ceilings)
      this.ceilings.visible = !['top', 'high-west', 'high-east'].includes(
        this.view,
      );
    this.scene?.render(1, 0, this.views.get(this.view));
    this.rendered = this.view;
  }
  query(name: string) {
    if (name === 'auditViews') return [...this.views.keys()];
    if (name === 'auditView') return this.rendered;
    if (name === 'auditMap') return this.mapId;
  }
  dispose() {
    this.style?.remove();
    this.off?.();
    this.scene?.dispose();
  }
}
