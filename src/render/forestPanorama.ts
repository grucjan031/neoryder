import {
  Box3,
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  PlaneGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  SphereGeometry,
  Group,
  Euler,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
  Mesh,
} from 'three';
import type { Material } from 'three';
import { tuning } from '../core/tuning';
import { buildForestLayout, forestTerrainHeight } from './forestLayout';
import type { ForestPoint, ForestRoute } from './forestLayout';
import {
  createForestMaterial,
  createForestSky,
  createForestUniforms,
} from './forestMaterials';
import type { horizonParameters } from './horizon';

interface Part extends ForestPoint {
  sx: number;
  sy: number;
  sz: number;
  rotation?: Quaternion;
  phase?: number;
  bend?: number;
  color?: number;
  blink?: number;
}

/** Instanced scenery only: no colliders, lights or dependencies on simulation state. */
export class ForestPanorama extends Group {
  private signature = '';
  private readonly uniforms;
  private readonly owned: (BufferGeometry | Material)[] = [];
  private routes: ForestRoute[] = [];
  private droneBodies?: InstancedMesh;
  private droneLights?: InstancedMesh;
  private readonly partMatrix = new Matrix4();
  private readonly pos = new Vector3();
  private readonly scaleVector = new Vector3();
  private readonly partRotation = new Quaternion();
  constructor(
    private readonly seed: string,
    private readonly floorY: number,
    private readonly exclusion?: Box3,
  ) {
    super();
    this.name = 'forest-panorama';
    this.uniforms = createForestUniforms(floorY);
  }
  sync(dt: number, horizon?: ReturnType<typeof horizonParameters>): void {
    const t = tuning.forest,
      u = this.uniforms;
    this.visible = tuning.render.panoramaEnabled > 0;
    u.time.value += dt;
    u.sway.value = t.swayM;
    u.frequency.value = t.swayHz;
    u.haze.value.set(t.hazeNearM, t.hazeFarM, t.hazeHeightM);
    u.mistColor.value.set(t.mist);
    u.moonColor.value.set(t.moon);
    u.amber.value.set(t.amber);
    u.moonDir.value.set(
      -Math.sin(t.moonAzimuth) * Math.cos(t.moonElevation),
      Math.sin(t.moonElevation),
      Math.cos(t.moonAzimuth) * Math.cos(t.moonElevation),
    );
    u.moonSize.value = t.moonSize;
    u.moonHalo.value = t.moonHalo;
    u.mistOpacity.value = t.mistOpacity;
    u.mistSpeed.value = t.mistSpeed;
    u.blinkPeriod.value = t.blinkPeriodS;
    const signature = JSON.stringify(t);
    if (this.visible && signature !== this.signature) {
      this.signature = signature;
      this.release();
      this.build();
    }
    this.getObjectByName('forest-sky-dome')?.scale.setScalar(
      horizon?.domeRadiusM ?? t.skyRadiusM,
    );
    this.animateDrones();
  }
  private batch(
    name: string,
    geometry: BufferGeometry,
    material: Material,
    parts: Part[],
  ): InstancedMesh {
    const attributes = new Float32Array(parts.length * 4);
    const mesh = new InstancedMesh(geometry, material, parts.length);
    parts.forEach((p, i) => {
      this.pos.set(p.x, p.y, p.z);
      this.scaleVector.set(p.sx, p.sy, p.sz);
      this.partRotation.identity();
      this.partMatrix.compose(
        this.pos,
        p.rotation ?? this.partRotation,
        this.scaleVector,
      );
      mesh.setMatrixAt(i, this.partMatrix);
      attributes.set(
        [p.phase ?? 0, p.bend ?? 0, p.color ?? 0, p.blink ?? 0],
        i * 4,
      );
    });
    geometry.setAttribute(
      'forestData',
      new InstancedBufferAttribute(attributes, 4),
    );
    mesh.instanceMatrix.needsUpdate = true;
    mesh.name = name;
    mesh.frustumCulled = false;
    mesh.userData.noOutline = true;
    this.owned.push(geometry, material);
    this.add(mesh);
    return mesh;
  }
  private build(): void {
    const t = tuning.forest;
    const b = this.exclusion;
    const layout = buildForestLayout(this.seed, {
      floorY: this.floorY,
      ...(b && {
        exclusion: {
          minX: b.min.x,
          maxX: b.max.x,
          minZ: b.min.z,
          maxZ: b.max.z,
        },
      }),
    });
    const solid = (color: string) => createForestMaterial(this.uniforms, color);
    const bounds =
      b ??
      new Box3(
        new Vector3(-16, this.floorY, -18),
        new Vector3(16, this.floorY, 16),
      );
    const minX = bounds.min.x - t.clearanceM,
      maxX = bounds.max.x + t.clearanceM;
    const minZ = bounds.min.z - t.clearanceM,
      maxZ = bounds.max.z + t.clearanceM;
    const extent = t.skyRadiusM;
    // Concentric rectangles share their corner vertices and leave the cellar open.
    // Put most samples at the forest edge, where players look through the glass.
    const sides = 4,
      segments = Math.max(1, Math.floor(t.terrainSegments / sides));
    const rings = Math.max(1, Math.floor(t.terrainSegments / 2));
    const ground = new PlaneGeometry(1, 1, sides * segments, rings + 2);
    const positions = ground.getAttribute('position');
    for (let row = 0; row <= rings + 2; row++) {
      const offset = extent * (Math.max(0, row - 2) / rings) ** 2;
      const corners = [
        [minX - offset, minZ - offset],
        [maxX + offset, minZ - offset],
        [maxX + offset, maxZ + offset],
        [minX - offset, maxZ + offset],
      ] as const;
      for (let col = 0; col <= sides * segments; col++) {
        const side = Math.floor(col / segments) % sides;
        const a = corners[side]!,
          b = corners[(side + 1) % sides]!;
        const f = (col % segments) / segments;
        const x = row === 0 ? (minX + maxX) / 2 : a[0] + (b[0] - a[0]) * f;
        const z = row === 0 ? (minZ + maxZ) / 2 : a[1] + (b[1] - a[1]) * f;
        const y =
          row < 2
            ? bounds.min.y - t.clearanceM
            : forestTerrainHeight({ x, y: 0, z }, layout.hills, this.floorY);
        positions.setXYZ(row * (sides * segments + 1) + col, x, y, z);
      }
    }
    // The plane index winds inward on a ring; reverse it to face the sky.
    const index = ground.getIndex()!;
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i);
      index.setX(i, index.getX(i + 1));
      index.setX(i + 1, a);
    }
    ground.computeVertexNormals();
    this.batch(
      'forest-ground',
      ground,
      createForestMaterial(this.uniforms, t.ground, 'ground'),
      [{ x: 0, y: 0, z: 0, sx: 1, sy: 1, sz: 1 }],
    );
    const trunk: Part[] = [],
      cones: Part[] = [],
      leaves: Part[] = [],
      ferns: Part[] = [];
    const segment = (
      from: ForestPoint,
      to: ForestPoint,
      radius: number,
      phase = 0,
    ): Part => {
      const vector = new Vector3(to.x - from.x, to.y - from.y, to.z - from.z);
      const length = vector.length();
      return {
        x: (from.x + to.x) / 2,
        y: (from.y + to.y) / 2,
        z: (from.z + to.z) / 2,
        sx: radius,
        sy: length,
        sz: radius,
        rotation: new Quaternion().setFromUnitVectors(
          new Vector3(0, 1, 0),
          vector.normalize(),
        ),
        phase,
      };
    };
    for (const tree of [...layout.conifers, ...layout.deciduous]) {
      const trunkHeight = tree.height * 0.82;
      trunk.push({
        ...tree,
        y: tree.y + trunkHeight / 2,
        sx: tree.height * t.trunkRadiusShare,
        sy: trunkHeight,
        sz: tree.height * t.trunkRadiusShare,
      });
      for (let i = 0; i < t.branchesPerTree; i++) {
        const angle = tree.phase + (i * Math.PI * 2) / t.branchesPerTree;
        const y =
          tree.y +
          tree.height *
            (t.branchStartShare + (i / t.branchesPerTree) * t.crownBaseShare);
        trunk.push(
          segment(
            { ...tree, y },
            {
              x: tree.x + (Math.sin(angle) * tree.width) / 2,
              y: y + tree.height * t.branchRiseShare,
              z: tree.z + (Math.cos(angle) * tree.width) / 2,
            },
            (tree.height * t.trunkRadiusShare) / 3,
          ),
        );
      }
    }
    for (const tree of layout.conifers) {
      for (let i = 0; i < t.crownLayers; i++) {
        const f = i / Math.max(1, t.crownLayers - 1);
        const pine = Math.sin(tree.phase) > 0;
        const h = tree.height * t.crownHeightShare * (1 - f * 0.55);
        const w = tree.width * (1 - f * (pine ? 0.52 : 0.84));
        cones.push({
          ...tree,
          x: tree.x + Math.sin(tree.phase + i * 2.4) * w * 0.06,
          z: tree.z + Math.cos(tree.phase + i * 2.4) * w * 0.06,
          y:
            tree.y +
            tree.height *
              (t.crownBaseShare + (pine ? 0.18 : 0) + f * (pine ? 0.4 : 0.58)) +
            h / 2,
          sx: w,
          sy: h,
          sz: w * (pine ? 0.85 : 1),
          rotation: new Quaternion().setFromEuler(
            new Euler(0, tree.phase + i, 0),
          ),
          bend: 1,
        });
      }
    }
    for (const tree of layout.deciduous) {
      for (let i = 0; i < t.leafLobes; i++) {
        const a = tree.phase + (i * Math.PI * 2) / t.leafLobes;
        leaves.push({
          ...tree,
          x: tree.x + (Math.sin(a) * tree.width) / 3,
          y: tree.y + tree.height * (0.7 + (i % 2) * 0.12),
          z: tree.z + (Math.cos(a) * tree.width) / 3,
          sx: tree.width * (0.5 + 0.12 * Math.sin(a * 3)),
          sy: tree.height * (0.22 + 0.08 * Math.sin(a)),
          sz: tree.width * (0.5 + 0.12 * Math.cos(a * 3)),
          bend: 1,
        });
      }
    }
    for (const shrub of layout.undergrowth) {
      for (let i = 0; i < t.fernFronds; i++) {
        const a = shrub.phase + (i * Math.PI * 2) / t.fernFronds;
        ferns.push({
          ...shrub,
          y: shrub.y + shrub.height / 2,
          sx: shrub.width,
          sy: shrub.height,
          sz: shrub.width,
          rotation: new Quaternion().setFromEuler(new Euler(0, a, 0)),
          bend: 0.5,
        });
      }
    }
    this.batch(
      'forest-trunks-branches',
      new CylinderGeometry(0.8, 1, 1, 7),
      solid(t.bark),
      trunk,
    );
    // Each whorl has separate drooping sprays. Gaps show the trunk and sky even side-on.
    const tips: number[] = [];
    for (let i = 0; i < 11; i++) {
      const angle = (i * Math.PI * 2) / 11;
      const vertex = (radius: number, delta: number, y: number) => [
        Math.cos(angle + delta) * radius,
        y,
        Math.sin(angle + delta) * radius,
      ];
      const root = vertex(0.02, 0, 0.45);
      const left = vertex(0.29, -0.32, -0.12);
      const right = vertex(0.29, 0.32, -0.16);
      const ridge = vertex(0.33, 0, 0.02);
      const tip = vertex(
        0.47 + 0.04 * Math.sin(i * 5),
        0.05,
        -0.32 - 0.12 * Math.cos(i),
      );
      tips.push(
        ...root,
        ...ridge,
        ...left,
        ...root,
        ...right,
        ...ridge,
        ...ridge,
        ...tip,
        ...left,
        ...ridge,
        ...right,
        ...tip,
        ...root,
        ...left,
        ...tip,
        ...root,
        ...tip,
        ...right,
      );
    }
    const bough = new BufferGeometry();
    bough.setAttribute('position', new Float32BufferAttribute(tips, 3));
    bough.computeVertexNormals();
    this.batch('forest-conifers', bough, solid(t.needles), cones);
    this.batch(
      'forest-deciduous',
      new SphereGeometry(0.5, 9, 6),
      solid(t.leaves),
      leaves,
    );
    const leaflets: number[] = [];
    for (let i = 0; i < 7; i++) {
      const f = i / 7,
        z = f * 0.64;
      const y = -0.5 + f * (1.8 - f);
      const width = 0.035 + 0.1 * Math.sin(f * Math.PI);
      for (const side of [-1, 1])
        leaflets.push(
          0,
          y,
          z,
          side * width,
          y + 0.06,
          z + 0.14,
          0,
          y + 0.12 * (1 - f),
          z + 0.1,
        );
    }
    const frond = new BufferGeometry();
    frond.setAttribute('position', new Float32BufferAttribute(leaflets, 3));
    frond.computeVertexNormals();
    const frondMaterial = solid(t.leaves);
    frondMaterial.side = DoubleSide;
    this.batch('forest-ferns', frond, frondMaterial, ferns);
    this.batch(
      'forest-mist',
      new SphereGeometry(0.5, 12, 6),
      createForestMaterial(this.uniforms, t.mist, 'mist'),
      layout.mist.map((p) => ({
        ...p,
        sx: t.mistWidthM,
        sy: t.mistHeightM,
        sz: t.mistWidthM,
      })),
    );
    const fence: Part[] = layout.perimeterPosts.map((p) => ({
      ...p,
      y: p.y + t.fenceHeightM / 2,
      sx: t.fenceWidthM,
      sy: t.fenceHeightM,
      sz: t.fenceWidthM,
    }));
    layout.perimeterPosts.forEach((p, i) => {
      const next =
        layout.perimeterPosts[(i + 1) % layout.perimeterPosts.length]!;
      for (let j = 1; j <= t.fenceRails; j++) {
        const y = p.y + (t.fenceHeightM * j) / t.fenceRails;
        fence.push(segment({ ...p, y }, { ...next, y }, t.fenceWidthM / 2));
      }
    });
    const tower = layout.watchtower;
    fence.push({
      ...tower,
      y: tower.y + tower.height / 2,
      sx: t.fenceWidthM * 2,
      sy: tower.height,
      sz: t.fenceWidthM * 2,
    });
    for (let i = 1; i <= t.fenceRails; i++)
      fence.push({
        ...tower,
        y: tower.y + (tower.height * i) / (t.fenceRails + 1),
        sx: t.droneSizeM * 2,
        sy: t.fenceWidthM,
        sz: t.fenceWidthM,
      });
    this.batch(
      'forest-fence-mast',
      new CylinderGeometry(1, 1, 1, 6),
      solid(t.bark),
      fence,
    );
    const pad = layout.helipad;
    this.batch(
      'forest-helipad',
      new CylinderGeometry(1, 1, 1, 32),
      solid(t.ground),
      [
        {
          ...pad,
          y: pad.y - t.fenceWidthM / 2,
          sx: pad.radius,
          sy: t.fenceWidthM,
          sz: pad.radius,
        },
      ],
    );
    const marking: Part[] = [];
    // H-06: geometric marking remains available without a texture dependency.
    const label = [
      '101001110111',
      '101001010101',
      '111001010111',
      '101001010101',
      '101001110111',
    ];
    label.forEach((row, z) =>
      [...row].forEach((cell, x) => {
        if (cell === '1')
          marking.push({
            x: pad.x + (x - 5.5) * t.lightSizeM * 2,
            y: pad.y + t.fenceWidthM / 2,
            z: pad.z + (z - 2) * t.lightSizeM * 2,
            sx: t.lightSizeM * 1.5,
            sy: t.fenceWidthM / 4,
            sz: t.lightSizeM * 1.5,
            color: 1,
          });
      }),
    );
    this.batch(
      'forest-pad-H06',
      new BoxGeometry(1, 1, 1),
      createForestMaterial(this.uniforms, t.warm, 'light'),
      marking,
    );
    const lights: Part[] = layout.beacons.map((p) => ({
      ...p,
      sx: t.lightSizeM,
      sy: t.lightSizeM,
      sz: t.lightSizeM,
    }));
    layout.faunaEyes.forEach((p) => {
      for (const sign of [-1, 1])
        lights.push({
          ...p,
          x: p.x + (sign * t.eyeSeparationM) / 2,
          sx: t.eyeSizeM,
          sy: t.eyeSizeM,
          sz: t.eyeSizeM,
          blink: 1,
        });
    });
    this.batch(
      'forest-beacons-eyes',
      new SphereGeometry(1, 7, 5),
      createForestMaterial(this.uniforms, t.warm, 'light'),
      lights,
    );
    this.routes = [...layout.drones, ...layout.flybys];
    this.droneBodies = this.batch(
      'forest-drones',
      new BoxGeometry(1, 1, 1),
      solid(t.bark),
      this.routes.map((r) => ({
        ...r.start,
        sx: t.droneSizeM,
        sy: t.droneSizeM / 4,
        sz: t.droneSizeM,
      })),
    );
    this.droneLights = this.batch(
      'forest-drone-lights',
      new SphereGeometry(1, 7, 5),
      createForestMaterial(this.uniforms, t.warm, 'light'),
      this.routes.flatMap((r) =>
        [0, 1].map((color) => ({
          ...r.start,
          sx: t.lightSizeM,
          sy: t.lightSizeM,
          sz: t.lightSizeM,
          color,
        })),
      ),
    );
    const sphere = new SphereGeometry(1, 32, 16),
      skyMaterial = createForestSky(this.uniforms);
    const sky = new Mesh(sphere, skyMaterial);
    sky.name = 'forest-sky-dome';
    sky.scale.setScalar(t.skyRadiusM);
    sky.frustumCulled = false;
    sky.renderOrder = -10;
    sky.userData.noOutline = true;
    this.owned.push(sphere, skyMaterial);
    this.add(sky);
  }
  private animateDrones(): void {
    const t = tuning.forest;
    this.routes.forEach((r, i) => {
      const length = Math.hypot(r.end.x - r.start.x, r.end.z - r.start.z);
      const period = Math.max(t.flybyPeriodS, (length * 2) / t.droneSpeedMps);
      const f =
        (1 -
          Math.cos(
            (this.uniforms.time.value / period + r.phase) * Math.PI * 2,
          )) /
        2;
      this.pos.set(
        r.start.x + (r.end.x - r.start.x) * f,
        r.start.y,
        r.start.z + (r.end.z - r.start.z) * f,
      );
      this.partRotation.identity();
      this.partMatrix.compose(
        this.pos,
        this.partRotation,
        this.scaleVector.set(t.droneSizeM, t.droneSizeM / 4, t.droneSizeM),
      );
      this.droneBodies?.setMatrixAt(i, this.partMatrix);
      for (let j = 0; j < 2; j++) {
        this.partMatrix.compose(
          new Vector3(
            this.pos.x + (j - 0.5) * t.droneSizeM,
            this.pos.y,
            this.pos.z,
          ),
          this.partRotation,
          this.scaleVector.setScalar(t.lightSizeM),
        );
        this.droneLights?.setMatrixAt(i * 2 + j, this.partMatrix);
      }
    });
    if (this.droneBodies) this.droneBodies.instanceMatrix.needsUpdate = true;
    if (this.droneLights) this.droneLights.instanceMatrix.needsUpdate = true;
  }
  private release(): void {
    for (const child of this.children)
      if (child instanceof InstancedMesh) child.dispose();
    for (const resource of this.owned) resource.dispose();
    this.owned.length = 0;
    this.routes = [];
    this.clear();
  }
  dispose(): void {
    this.release();
    this.removeFromParent();
  }
}
