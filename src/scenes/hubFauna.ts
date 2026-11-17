import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshToonMaterial,
  SphereGeometry,
} from 'three';
import type { BufferGeometry, Object3D } from 'three';
import type { AmbienceSource } from '../audio/ambienceSchema';
import type { GameContext } from '../core/context';
import type { PlayerState } from '../player/playerController';
import { gradientMap } from '../render/materials';
import { HubFaunaRuntime } from '../world/hubFauna';
import type { FaunaPose } from '../world/hubFauna';
import { wrapAngle } from '../world/hubNpcs';
import type { HubLayout } from '../world/hubSchema';

interface AnimalView {
  root: Group;
  body: Mesh;
  head: Group;
  legs: Group[];
  tail: Group[];
}

/** Siatki współdzielą trzy geometrie. Dwa szczury są ukrywane, nigdy tworzone podczas ruchu. */
export class HubFauna {
  readonly runtime: HubFaunaRuntime;
  readonly sources: AmbienceSource[];
  private readonly root = new Group();
  private readonly geometries: BufferGeometry[];
  private readonly fur: MeshToonMaterial;
  private readonly ratFur: MeshToonMaterial;
  private readonly eyes: MeshToonMaterial;
  private readonly cat: AnimalView | null;
  private readonly rats: AnimalView[];
  private readonly off: (() => void)[] = [];

  constructor(
    private readonly ctx: GameContext,
    parent: Object3D,
    layout: HubLayout,
    private readonly player: () => PlayerState,
  ) {
    this.runtime = new HubFaunaRuntime(
      layout,
      ctx.rng.fork('hub-fauna'),
      ctx.tuning.hub,
      ctx.bus,
    );
    const t = ctx.tuning.hub;
    this.geometries = [
      new SphereGeometry(1, 8, 6),
      new ConeGeometry(1, 1, 4),
      new CylinderGeometry(1, 1, 1, 6),
    ];
    this.fur = new MeshToonMaterial({
      color: t.catColor,
      gradientMap: gradientMap,
    });
    this.ratFur = new MeshToonMaterial({
      color: t.ratColor,
      gradientMap: gradientMap,
    });
    const rim = { value: new Color(t.faunaRimColor) };
    const strength = { value: t.catRimGain };
    this.fur.onBeforeCompile = (shader) => {
      shader.uniforms.faunaRimColor = rim;
      shader.uniforms.faunaRimGain = strength;
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform vec3 faunaRimColor;\nuniform float faunaRimGain;',
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
        totalEmissiveRadiance += faunaRimColor * faunaRimGain * pow(max(0.0, 1.0-abs(dot(normal, normalize(vViewPosition)))), 3.0);`,
        );
    };
    this.fur.customProgramCacheKey = () => 'hubFaunaRim';
    this.eyes = new MeshToonMaterial({
      color: t.catEyeColor,
      emissive: t.catEyeColor,
      emissiveIntensity: t.catEyeGain,
    });
    this.cat = this.runtime.cat ? this.build(false) : null;
    if (this.cat) this.cat.root.name = 'hub-cat-wegielek';
    this.rats = this.runtime.rats.map(() => this.build(true));
    this.sources = this.runtime.cat
      ? [
          {
            kind: 'purr',
            position: { ...this.runtime.cat.position },
            radiusM: ctx.tuning.audio.ambienceProfiles.purr.radiusM,
            gain: 0,
          },
        ]
      : [];
    this.root.name = 'hub-fauna';
    parent.add(this.root);
    const register = (
      name: string,
      help: string,
      run: (args: string[]) => string,
    ): void => {
      const off = ctx.commands?.register(name, help, run);
      if (off) this.off.push(off);
    };
    register(
      'hub cat',
      'hub cat — pokaż Węgielka 2 m przed graczem',
      (args) => {
        if (args.length) return 'Użycie: hub cat';
        const p = this.player();
        return this.runtime.placeCat(p.position, p.yaw)
          ? 'Węgielek odpoczywa przed graczem.'
          : 'Brak bezpiecznej podłogi i drogi do trasy kota.';
      },
    );
    register(
      'hub rat',
      'hub rat — wymuś przebieg najbliższym wolnym pasem',
      (args) => {
        if (args.length) return 'Użycie: hub rat';
        return this.runtime.forceRat(this.player().position)
          ? 'Szczur przebiega pasem.'
          : 'Pasy zajęte albo gracz stoi przy ich początkach.';
      },
    );
  }

  private build(rat: boolean): AnimalView {
    const root = new Group(),
      head = new Group();
    const material = rat ? this.ratFur : this.fur;
    const add = (
      parent: Object3D,
      geometry: number,
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
      mat = material,
    ): Mesh => {
      const mesh = new Mesh(this.geometries[geometry]!, mat);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      parent.add(mesh);
      return mesh;
    };
    const body = add(root, 0, 0, 0.35, 0, 0.16, 0.19, 0.33);
    head.position.set(0, 0.52, 0.28);
    root.add(head);
    add(head, 0, 0, 0, 0, 0.125, 0.12, 0.12);
    for (const side of [-1, 1]) {
      add(head, rat ? 0 : 1, side * 0.085, 0.115, 0, 0.055, 0.14, 0.045);
      const eye = add(
        head,
        0,
        side * 0.061,
        0.026,
        0.102,
        0.013,
        0.016,
        0.009,
        this.eyes,
      );
      eye.userData.noOutline = true;
    }
    const legs: Group[] = [];
    for (const x of [-0.11, 0.11])
      for (const z of [-0.21, 0.21]) {
        const pivot = new Group();
        pivot.position.set(x, 0.28, z);
        root.add(pivot);
        add(pivot, 0, 0, -0.12, 0, 0.045, 0.15, 0.045);
        legs.push(pivot);
      }
    const tail: Group[] = [];
    let tailParent: Object3D = root;
    for (let i = 0; i < 5; i++) {
      const joint = new Group();
      joint.position.set(0, i === 0 ? 0.4 : 0, i === 0 ? -0.28 : -0.11);
      tailParent.add(joint);
      const segment = add(
        joint,
        2,
        0,
        0,
        -0.055,
        rat ? 0.014 : 0.025,
        0.12,
        rat ? 0.014 : 0.025,
      );
      segment.rotation.x = Math.PI / 2;
      tail.push(joint);
      tailParent = joint;
    }
    if (rat) {
      root.scale.setScalar(0.45);
      root.visible = false;
    }
    this.root.add(root);
    return { root, body, head, legs, tail };
  }

  step(dt: number, p: PlayerState): void {
    this.runtime.step(dt, p.position, p.velocity);
  }

  private place(view: AnimalView, pose: FaunaPose, alpha: number): number {
    view.root.position.set(
      pose.previous.x + (pose.position.x - pose.previous.x) * alpha,
      pose.previous.y + (pose.position.y - pose.previous.y) * alpha,
      pose.previous.z + (pose.position.z - pose.previous.z) * alpha,
    );
    view.root.rotation.y =
      pose.previousYaw + wrapAngle(pose.yaw - pose.previousYaw) * alpha;
    return (
      pose.previousDistance + (pose.distance - pose.previousDistance) * alpha
    );
  }

  render(alpha: number): void {
    const t = this.ctx.tuning.hub,
      c = this.runtime.cat,
      view = this.cat;
    this.eyes.emissiveIntensity = t.catEyeGain;
    if (c && view) {
      const distance = this.place(view, c, alpha);
      const time = c.previousAgeS + (c.ageS - c.previousAgeS) * alpha;
      const rest =
        c.state === 'sit' || c.state === 'lie' || c.state === 'groom';
      const lie = c.state === 'lie',
        groom = c.state === 'groom';
      view.body.position.y = lie ? 0.16 : rest ? 0.29 : 0.35;
      view.body.rotation.x = lie ? 0 : rest ? -0.65 : 0;
      view.body.scale.set(
        lie ? 0.23 : 0.16,
        lie ? 0.13 : 0.19,
        lie ? 0.25 : 0.33,
      );
      view.head.position.set(
        lie ? 0.14 : 0,
        lie ? 0.23 : rest ? 0.54 : 0.52,
        lie ? 0.12 : 0.28,
      );
      view.head.rotation.set(
        groom ? 0.6 + Math.sin(time * t.catGroomHz) * 0.18 : lie ? 0.25 : 0,
        lie ? -0.9 : 0,
        0,
      );
      for (let i = 0; i < view.legs.length; i++) {
        const leg = view.legs[i]!;
        leg.rotation.x = lie
          ? 1.3
          : groom && i === 1
            ? -1.1
            : rest
              ? i % 2 === 0
                ? 1
                : 0
              : Math.sin(
                  (distance / t.catStrideM) * Math.PI * 2 +
                    (i === 0 || i === 3 ? 0 : Math.PI),
                ) * t.catLegSwingRad;
        leg.scale.y = rest ? 0.7 : 1;
      }
      for (let i = 0; i < view.tail.length; i++) {
        const tail = view.tail[i]!;
        tail.rotation.y = lie
          ? 0.65
          : Math.sin(time * t.catTailHz - i * 0.65) * t.catTailSwingRad;
        tail.rotation.x = rest ? -0.15 : 0.25;
      }
      const source = this.sources[0]!;
      Object.assign(source.position, view.root.position);
      source.radiusM = this.ctx.tuning.audio.ambienceProfiles.purr.radiusM;
      source.gain = rest ? this.ctx.tuning.audio.ambienceProfiles.purr.gain : 0;
    }
    for (let i = 0; i < this.rats.length; i++) {
      const rat = this.runtime.rats[i]!,
        view = this.rats[i]!;
      view.root.visible = rat.active;
      if (!rat.active) continue;
      const distance = this.place(view, rat, alpha);
      for (let j = 0; j < view.legs.length; j++)
        view.legs[j]!.rotation.x =
          Math.sin((distance / t.catStrideM) * Math.PI * 4 + j * Math.PI) *
          t.catLegSwingRad;
      for (let j = 0; j < view.tail.length; j++)
        view.tail[j]!.rotation.y =
          Math.sin(distance * 4 - j) * t.catTailSwingRad;
    }
  }

  dispose(): void {
    for (const off of this.off) off();
    this.root.removeFromParent();
    this.root.clear();
    for (const geometry of this.geometries) geometry.dispose();
    this.fur.dispose();
    this.ratFur.dispose();
    this.eyes.dispose();
  }
}
