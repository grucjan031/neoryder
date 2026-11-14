import { BoxGeometry, Group, Mesh } from 'three';
import type { Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { applyStyle, getMaterial } from '../render/materials';
import type { Enemy } from './types';

const templates = new Map<string, Promise<Object3D | null>>();
function loadTemplate(kind: string): Promise<Object3D | null> {
  const name = kind === 'gunner' ? 'enemy_gunner' : 'enemy_trooper';
  const cached = templates.get(name);
  if (cached) return cached;
  const template = new GLTFLoader()
    .loadAsync(`/assets/models/${name}.glb`)
    .then(({ scene }) => {
      const materials = new Set<import('three').Material>();
      scene.traverse((node) => {
        if (node instanceof Mesh)
          for (const material of Array.isArray(node.material)
            ? node.material
            : [node.material])
            materials.add(material);
      });
      applyStyle(scene);
      for (const material of materials) material.dispose();
      return scene;
    })
    .catch(() => null);
  templates.set(name, template);
  return template;
}

/** Geometria GLB i materiały stylu należą do cache, pozy węzłów do pojedynczego widoku. */
export class EnemyView {
  readonly root = new Group();
  private model = new Group();
  private disposed = false;
  private readonly fallbackGeometries: BoxGeometry[] = [];
  private readonly rest = new Map<
    Object3D,
    {
      x: number;
      y: number;
      z: number;
      position: { x: number; y: number; z: number };
      scale: { x: number; y: number; z: number };
    }
  >();

  constructor(
    readonly enemy: Enemy,
    loadModels = true,
  ) {
    const body = enemy.definition.body;
    if (!body) throw new Error('Brak geometrii wroga.');
    const part = (
      parent: Object3D,
      name: string,
      position: { x: number; y: number; z: number },
      size: { x: number; y: number; z: number },
      offsetY = 0,
    ): Group => {
      const pivot = new Group();
      pivot.name = name;
      pivot.position.copy(position);
      const geometry = new BoxGeometry(size.x, size.y, size.z);
      this.fallbackGeometries.push(geometry);
      const mesh = new Mesh(
        geometry,
        getMaterial(
          name === 'baton_tip' || name === 'muzzle' || name === 'visor'
            ? 'enemyGlow'
            : 'enemy',
        ),
      );
      mesh.position.y = offsetY;
      pivot.add(mesh);
      parent.add(pivot);
      return pivot;
    };
    const pelvis = part(
      this.model,
      'pelvis',
      { x: 0, y: body.centerY / 2, z: 0 },
      { x: body.radius * 2, y: body.radius, z: body.radius },
    );
    const torso = part(
      pelvis,
      'torso',
      { x: 0, y: body.centerY / 2, z: 0 },
      { x: body.radius * 2, y: body.halfHeight * 2, z: body.radius * 2 },
    );
    const head = part(
      torso,
      'head',
      { x: 0, y: body.headY - body.centerY, z: 0 },
      {
        x: body.headRadius * 2,
        y: body.headRadius * 2,
        z: body.headRadius * 2,
      },
    );
    if (enemy.definition.kind === 'gunner')
      part(
        head,
        'visor',
        { x: 0, y: 0, z: body.headRadius },
        {
          x: body.headRadius * 2,
          y: body.headRadius / 2,
          z: body.headRadius / 2,
        },
      );
    for (const [side, sign] of [
      ['L', 1],
      ['R', -1],
    ] as const) {
      const arm = part(
        torso,
        `arm_upper_${side}`,
        { x: sign * body.radius, y: body.halfHeight, z: 0 },
        { x: body.radius / 2, y: body.halfHeight, z: body.radius / 2 },
        -body.halfHeight / 2,
      );
      const lower = part(
        arm,
        `arm_lower_${side}`,
        { x: 0, y: -body.halfHeight, z: 0 },
        { x: body.radius / 2, y: body.halfHeight, z: body.radius / 2 },
        -body.halfHeight / 2,
      );
      const hand = part(
        lower,
        `hand_${side}`,
        { x: 0, y: -body.halfHeight, z: 0 },
        { x: body.radius / 2, y: body.radius / 2, z: body.radius / 2 },
      );
      if (side === 'R') {
        const baton = part(
          hand,
          this.enemy.definition.kind === 'gunner' ? 'rifle' : 'baton',
          { x: 0, y: 0, z: body.halfHeight },
          { x: body.radius / 2, y: body.radius / 2, z: body.halfHeight * 2 },
        );
        part(
          baton,
          this.enemy.definition.kind === 'gunner' ? 'muzzle' : 'baton_tip',
          { x: 0, y: 0, z: body.halfHeight },
          { x: body.radius / 2, y: body.radius / 2, z: body.radius / 2 },
        );
      }
      const leg = part(
        pelvis,
        `leg_upper_${side}`,
        { x: (sign * body.radius) / 2, y: 0, z: 0 },
        { x: body.radius / 2, y: body.centerY / 4, z: body.radius / 2 },
        -body.centerY / 8,
      );
      part(
        leg,
        `leg_lower_${side}`,
        { x: 0, y: -body.centerY / 4, z: 0 },
        { x: body.radius / 2, y: body.centerY / 4, z: body.radius / 2 },
        -body.centerY / 8,
      );
    }
    this.captureRest();
    this.root.add(this.model);
    if (loadModels)
      void loadTemplate(enemy.definition.kind).then((source) => {
        if (!source || this.disposed) return;
        this.root.remove(this.model);
        this.model = new Group();
        this.model.add(source.clone(true));
        this.root.add(this.model);
        this.captureRest();
      });
  }

  private captureRest(): void {
    this.rest.clear();
    this.model.traverse((node) =>
      this.rest.set(node, {
        x: node.rotation.x,
        y: node.rotation.y,
        z: node.rotation.z,
        position: {
          x: node.position.x,
          y: node.position.y,
          z: node.position.z,
        },
        scale: { x: node.scale.x, y: node.scale.y, z: node.scale.z },
      }),
    );
  }

  render(alpha: number): void {
    const { previous: a, current: b, definition } = this.enemy;
    const t = Math.max(0, Math.min(1, alpha));
    this.root.position.set(
      a.position.x + (b.position.x - a.position.x) * t,
      a.position.y + (b.position.y - a.position.y) * t,
      a.position.z + (b.position.z - a.position.z) * t,
    );
    const delta = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw));
    this.root.rotation.y = a.yaw + delta * t;
    this.root.visible = b.state !== 'dead' && !this.enemy.removed;
    const anim = definition.animation;
    if (!anim) return;
    for (const [node, rest] of this.rest) {
      node.rotation.set(rest.x, rest.y, rest.z);
      node.position.copy(rest.position);
      node.scale.copy(rest.scale);
    }
    const rotate = (name: string, axis: 'x' | 'z', angle: number): void => {
      const node = this.model.getObjectByName(name);
      if (node) node.rotation[axis] += angle;
    };
    const phase =
      ((a.distance + (b.distance - a.distance) * t) / anim.strideM) *
      Math.PI *
      2;
    const walk =
      Math.sin(phase) *
      anim.walkAngle *
      Math.min(1, b.speed / definition.moveSpeed);
    for (const [side, sign] of [
      ['L', 1],
      ['R', -1],
    ] as const) {
      rotate(`leg_upper_${side}`, 'x', walk * sign);
      rotate(`leg_lower_${side}`, 'x', Math.max(0, -walk * sign));
      rotate(`arm_upper_${side}`, 'x', -walk * sign);
    }
    const time =
      a.state === b.state
        ? a.stateTimeS + (b.stateTimeS - a.stateTimeS) * t
        : b.stateTimeS;
    if (
      definition.kind === 'gunner' &&
      ['aim', 'burst', 'cooldown'].includes(b.state)
    ) {
      const angle = anim.aimAngle ?? 0;
      for (const side of ['L', 'R']) rotate(`arm_upper_${side}`, 'x', angle);
      rotate('rifle', 'x', -angle);
    }
    const rifle = this.model.getObjectByName('rifle');
    if (rifle && anim.recoilS && b.shotTimeS !== undefined) {
      const recoil =
        (anim.recoilM ?? 0) * Math.max(0, 1 - b.shotTimeS / anim.recoilS);
      // Kierunek lokalny kompensuje uniesienie ramion: odrzut wzdłuż osi karabinu.
      rifle.position.y += recoil * Math.sin(rifle.rotation.x);
      rifle.position.z -= recoil * Math.cos(rifle.rotation.x);
    }
    if (b.state === 'telegraph') {
      rotate(
        'arm_upper_R',
        'x',
        anim.telegraphAngle * Math.min(1, time / definition.telegraphS),
      );
      rotate('arm_lower_R', 'x', anim.elbowAngle);
    } else if (b.state === 'swing') {
      rotate(
        'arm_upper_R',
        'x',
        anim.telegraphAngle +
          (anim.swingAngle - anim.telegraphAngle) *
            Math.min(1, time / definition.swingActiveS),
      );
    } else if (b.state === 'recovery') {
      rotate(
        'arm_upper_R',
        'x',
        anim.swingAngle * Math.max(0, 1 - time / definition.recoveryS),
      );
    } else if (b.state === 'stunned') rotate('pelvis', 'z', anim.stunAngle);
    for (const name of definition.kind === 'gunner'
      ? ['muzzle', 'visor']
      : ['baton_tip']) {
      const tip = this.model.getObjectByName(name);
      const restScale = tip ? this.rest.get(tip)?.scale : undefined;
      if (tip && restScale) {
        const pulse =
          b.state === 'telegraph' || b.state === 'aim'
            ? 1 +
              anim.pulseScale *
                (1 + Math.sin(time * anim.pulseHz * Math.PI * 2))
            : 1;
        tip.scale.set(
          restScale.x * pulse,
          restScale.y * pulse,
          restScale.z * pulse,
        );
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    this.root.removeFromParent();
    this.root.clear();
    for (const geometry of this.fallbackGeometries) geometry.dispose();
    this.rest.clear();
  }
}
