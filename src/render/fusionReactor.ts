import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  Object3D,
  Points,
  ShaderMaterial,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import type { Material } from 'three';
import { tuning } from '../core/tuning';
import type { SetPieceDefinition } from '../world/roomSchema';
import type { CityLightDef } from '../world/dressingSchema';
import { gradientMap } from './materials';

const TAU = Math.PI * 2;
const vertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vLocal;
  void main() {
    vUv = uv;
    vLocal = position;
    vec4 p = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      p = instanceMatrix * p;
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * p;
  }
`;
const plasmaFragment = /* glsl */ `
  uniform float timeS, brightness, pulse, flowSpeed;
  uniform vec3 amber, warmWhite, violet, blue;
  varying vec2 vUv;
  varying vec3 vLocal;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
      mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
  }
  void main() {
    float angle = vUv.x * 6.2831853;
    // Periodic coordinates keep the torus seam closed as the turbulence flows.
    vec2 p = vec2(cos(angle-timeS*flowSpeed), sin(angle-timeS*flowSpeed));
    float n = noise(p*8.0 + vec2(vUv.y*9.0, timeS*0.35));
    float filament = pow(0.5+0.5*sin(vUv.y*62.83185+n*5.0-timeS*4.0), 6.0);
    vec3 base = mix(amber, warmWhite, smoothstep(0.25,0.85,n));
    vec3 rim = mix(violet, blue, n);
    base = mix(base, rim, (1.0-filament)*0.16);
    gl_FragColor = vec4(base * brightness * pulse * (0.5+n*0.6+filament), 1.0);
    #include <colorspace_fragment>
  }
`;
const bandFragment = /* glsl */ `
  uniform float timeS, brightness, pulse;
  uniform vec3 amber, warmWhite;
  varying vec2 vUv;
  varying vec3 vLocal;
  void main() {
    float band = 0.65 + 0.35*sin(vLocal.y*2.0-timeS*2.0+vUv.x*6.2831853);
    gl_FragColor = vec4(mix(amber,warmWhite,band)*brightness*pulse,1.0);
    #include <colorspace_fragment>
  }
`;

/** Pure time function; no accumulated integration state or simulation RNG. */
export function fusionPulse(timeS: number): number {
  const t = tuning.render.fusionReactor;
  return (
    1 +
    t.pulseDepth * Math.sin((TAU * timeS) / Math.max(0.01, t.pulsePeriodS)) +
    t.tremorDepth * Math.sin(TAU * timeS * t.tremorHz)
  );
}

function hash(value: number): number {
  const n = Math.sin(value * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Render-only tokamak. Geometry owns no colliders, DOM or WebGL context. */
export class FusionReactor {
  readonly root = new Group();
  readonly lightDefs: CityLightDef[] = [];
  private readonly body = new Group();
  private readonly rings: Group[] = [];
  private readonly geometries = new Set<BufferGeometry>();
  private readonly materials = new Set<Material>();
  private readonly instances: InstancedMesh[] = [];
  private readonly dummy = new Object3D();
  private readonly uniforms = {
    timeS: { value: 0 },
    brightness: { value: 1 },
    pulse: { value: 1 },
    flowSpeed: { value: 0 },
    amber: { value: new Color(tuning.render.fusionReactor.amberColor) },
    warmWhite: { value: new Color(tuning.render.fusionReactor.whiteColor) },
    violet: { value: new Color(tuning.render.fusionReactor.violetColor) },
    blue: { value: new Color(tuning.render.fusionReactor.blueColor) },
  };
  private readonly warning = new MeshBasicMaterial({ toneMapped: false });
  private readonly arcMaterial = new LineBasicMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending: AdditiveBlending,
  });
  private readonly arcPositions: BufferAttribute;
  private readonly arcs: LineSegments;
  private readonly steam: ShaderMaterial;
  private arcBucket = NaN;
  private amberColor = tuning.render.fusionReactor.amberColor;
  private whiteColor = tuning.render.fusionReactor.whiteColor;
  private violetColor = tuning.render.fusionReactor.violetColor;
  private blueColor = tuning.render.fusionReactor.blueColor;
  private disposed = false;
  private readonly coilCount: number;
  private readonly arcCount: number;
  private readonly arcSegments: number;

  constructor(def: SetPieceDefinition) {
    const t = tuning.render.fusionReactor;
    this.root.name = 'fusionReactor';
    this.root.position.copy(def.position);
    this.root.rotation.y = def.yaw ?? 0;
    this.root.scale.setScalar(def.scale ?? 1);
    this.root.add(this.body);
    this.coilCount = Math.max(12, Math.min(18, Math.floor(t.coilCount)));
    this.arcCount = Math.max(1, Math.floor(t.arcCount));
    this.arcSegments = Math.max(2, Math.floor(t.arcSegments));
    const metal = this.material(
      new MeshToonMaterial({ color: t.metalColor, gradientMap }),
    );
    const winding = this.material(
      new MeshToonMaterial({ color: t.coilColor, gradientMap }),
    );
    const amber = this.material(
      new MeshBasicMaterial({ color: t.amberColor, toneMapped: false }),
    );
    amber.userData.bloom = true;
    const glass = this.material(
      new MeshToonMaterial({
        color: t.blueColor,
        gradientMap,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    this.warning.userData.bloom = true;
    this.material(this.warning);
    this.arcMaterial.userData.bloom = true;
    this.material(this.arcMaterial);
    const plasma = this.material(
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: plasmaFragment,
        uniforms: this.uniforms,
        toneMapped: false,
      }),
    );
    plasma.userData.bloom = true;
    const bands = this.material(
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: bandFragment,
        uniforms: this.uniforms,
        toneMapped: false,
      }),
    );
    bands.userData.bloom = true;

    this.mesh(
      new CylinderGeometry(
        t.foundationRadiusM,
        t.foundationRadiusM + 0.4,
        t.foundationHeightM,
        64,
      ),
      metal,
      0,
      t.foundationHeightM / 2,
      0,
    );
    this.torus(t.foundationRadiusM - 0.3, 0.22, metal, t.foundationHeightM);
    this.torus(
      t.foundationRadiusM - 0.6,
      0.06,
      amber,
      t.foundationHeightM + 0.1,
    );
    this.mesh(
      new CylinderGeometry(
        1.5,
        1.9,
        t.solenoidHeightM - t.foundationHeightM,
        32,
      ),
      metal,
      0,
      (t.solenoidHeightM + t.foundationHeightM) / 2,
      0,
    );
    this.batch(
      new TorusGeometry(1.52, 0.065, 6, 48).rotateX(Math.PI / 2),
      bands,
      24,
      (i, d) =>
        d.position.set(0, 1.25 + (i * (t.solenoidHeightM - 1.6)) / 24, 0),
    );
    this.torus(1.65, 0.22, winding, t.solenoidHeightM - 0.25);

    const core = this.torus(
      t.majorRadiusM,
      t.plasmaRadiusM,
      plasma,
      t.chamberHeightM,
    );
    core.userData.noOutline = true;
    const window = this.torus(
      t.majorRadiusM,
      t.chamberRadiusM,
      glass,
      t.chamberHeightM,
    );
    window.userData.noOutline = true;
    const armor = new TorusGeometry(
      t.majorRadiusM,
      t.chamberRadiusM + 0.06,
      12,
      8,
      (TAU / this.coilCount) * 0.35,
    ).rotateX(Math.PI / 2);
    this.batch(armor, metal, this.coilCount, (i, d) => {
      d.position.y = t.chamberHeightM;
      d.rotation.y = (i * TAU) / this.coilCount;
    });

    // Straight inner leg and rounded outer leg form a D in each radial plane.
    const r = t.coilRadiusM,
      h = t.coilHeightM;
    const points = [
      new Vector3(-r * 0.72, -h, 0),
      new Vector3(-r * 0.72, h, 0),
      new Vector3(r * 0.35, h, 0),
      new Vector3(r, h * 0.55, 0),
      new Vector3(r, -h * 0.55, 0),
      new Vector3(r * 0.35, -h, 0),
    ];
    const curve = new CatmullRomCurve3(points, true, 'centripetal');
    const coilGeometry = new TubeGeometry(curve, 64, t.coilThicknessM, 8, true);
    this.batch(coilGeometry, winding, this.coilCount, (i, d) => {
      const a = (i * TAU) / this.coilCount;
      d.position.set(
        t.majorRadiusM * Math.cos(a),
        t.chamberHeightM,
        -t.majorRadiusM * Math.sin(a),
      );
      d.rotation.y = a;
    });
    this.batch(
      new BoxGeometry(0.7, 1.8, 0.9),
      metal,
      this.coilCount,
      (i, d) => {
        const a = (i * TAU) / this.coilCount;
        d.position.set(
          t.majorRadiusM * Math.cos(a),
          1.65,
          -t.majorRadiusM * Math.sin(a),
        );
        d.rotation.y = a;
      },
    );
    this.batch(
      new BoxGeometry(0.4, 0.13, 0.5),
      this.warning,
      this.coilCount,
      (i, d) => {
        const a = (i * TAU) / this.coilCount;
        d.position.set(
          (t.majorRadiusM + r) * Math.cos(a),
          t.chamberHeightM + h * 0.52,
          -(t.majorRadiusM + r) * Math.sin(a),
        );
        d.rotation.y = a;
      },
    );

    for (
      let i = 0;
      i < Math.min(3, Math.max(2, Math.floor(t.ringCount)));
      i++
    ) {
      const ring = new Group();
      ring.position.y = t.chamberHeightM + (i - 1) * (h - 0.25);
      this.body.add(ring);
      this.rings.push(ring);
      const radius = t.majorRadiusM + r + 0.5;
      this.torus(radius, 0.16, winding, 0, ring);
      this.torus(radius, 0.035, amber, 0.19, ring);
      this.batch(
        new BoxGeometry(0.7, 0.48, 1.1),
        metal,
        8,
        (j, d) => {
          const a = (j * TAU) / 8;
          d.position.set(radius * Math.cos(a), 0, -radius * Math.sin(a));
          d.rotation.y = a;
        },
        ring,
      );
    }

    const pipe = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(t.majorRadiusM + r, t.chamberHeightM, 0),
        new Vector3(t.majorRadiusM + r + 0.6, 2.2, 0),
        new Vector3(t.foundationRadiusM + 0.5, 0.85, 0),
      ]),
      20,
      0.13,
      6,
      false,
    );
    this.batch(pipe, winding, this.coilCount * 3, (i, d) => {
      d.rotation.y =
        (Math.floor(i / 3) * TAU) / this.coilCount + ((i % 3) - 1) * 0.035;
    });
    this.batch(
      new CylinderGeometry(0.65, 0.65, 3.1, 16),
      winding,
      6,
      (i, d) => {
        const a = (i * TAU) / 6;
        d.position.set(
          (t.foundationRadiusM + 1.4) * Math.cos(a),
          2.1,
          (t.foundationRadiusM + 1.4) * Math.sin(a),
        );
      },
    );
    for (const y of [0.7, 3.5])
      this.batch(
        new TorusGeometry(0.66, 0.1, 6, 16).rotateX(Math.PI / 2),
        metal,
        6,
        (i, d) => {
          const a = (i * TAU) / 6;
          d.position.set(
            (t.foundationRadiusM + 1.4) * Math.cos(a),
            y,
            (t.foundationRadiusM + 1.4) * Math.sin(a),
          );
        },
      );

    const arcGeometry = this.geometry(new BufferGeometry());
    this.arcPositions = new BufferAttribute(
      new Float32Array(this.arcCount * this.arcSegments * 6),
      3,
    );
    this.arcPositions.setUsage(DynamicDrawUsage);
    arcGeometry.setAttribute('position', this.arcPositions);
    this.arcs = new LineSegments(arcGeometry, this.arcMaterial);
    this.arcs.frustumCulled = false;
    this.arcs.userData.noOutline = true;
    this.body.add(this.arcs);

    const steamGeometry = this.geometry(new BufferGeometry());
    const count = Math.max(1, Math.floor(t.steamCount));
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = TAU * hash(i + 1);
      positions[i * 3] = (t.foundationRadiusM + hash(i + 90)) * Math.cos(a);
      positions[i * 3 + 1] = t.foundationHeightM;
      positions[i * 3 + 2] = (t.foundationRadiusM + hash(i + 90)) * Math.sin(a);
      seeds[i] = hash(i + 200);
    }
    steamGeometry.setAttribute('position', new BufferAttribute(positions, 3));
    steamGeometry.setAttribute('seed', new BufferAttribute(seeds, 1));
    this.steam = this.material(
      new ShaderMaterial({
        uniforms: {
          timeS: this.uniforms.timeS,
          lifetime: { value: t.steamLifetimeS },
          rise: { value: t.steamRiseM },
          size: { value: t.steamSizeM },
          opacity: { value: t.steamOpacity },
          tint: this.uniforms.warmWhite,
        },
        vertexShader: /* glsl */ `
        uniform float timeS, lifetime, rise, size;
        attribute float seed;
        varying float fade;
        void main() {
          float age = fract(timeS / lifetime + seed);
          vec3 p = position + vec3(sin(seed*60.0+age*3.0)*age, age*rise, cos(seed*80.0+age*2.0)*age);
          vec4 view = modelViewMatrix * vec4(p,1.0);
          gl_Position = projectionMatrix * view;
          float worldScale = length(modelMatrix[0].xyz);
          gl_PointSize = clamp(size*worldScale*(0.5+age)*300.0/max(1.0,-view.z),1.0,96.0);
          fade = sin(age*3.14159265);
        }
      `,
        fragmentShader: /* glsl */ `
        uniform float opacity;
        uniform vec3 tint;
        varying float fade;
        void main() {
          float d = length(gl_PointCoord-0.5)*2.0;
          gl_FragColor = vec4(tint, (1.0-smoothstep(0.1,1.0,d))*fade*opacity);
          #include <colorspace_fragment>
        }
      `,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.steam.userData.bloom = false;
    const steam = new Points(steamGeometry, this.steam);
    steam.frustumCulled = false;
    steam.userData.noOutline = true;
    this.root.add(steam);

    this.root.updateMatrixWorld(true);
    for (const x of [-t.majorRadiusM, t.majorRadiusM]) {
      const at = new Vector3(x, t.chamberHeightM, 0).applyMatrix4(
        this.root.matrixWorld,
      );
      this.lightDefs.push({
        position: { x: at.x, y: at.y, z: at.z },
        color: t.amberColor,
        intensity: t.lightIntensity,
        range: t.lightRangeM * (def.scale ?? 1),
        groundGlow: false,
      });
    }
    this.update(0);
  }

  private geometry<T extends BufferGeometry>(geometry: T): T {
    // Every primitive uses one material; cap/face groups would only split passes.
    geometry.clearGroups();
    this.geometries.add(geometry);
    return geometry;
  }

  private material<T extends Material>(material: T): T {
    this.materials.add(material);
    return material;
  }

  private mesh(
    geometry: BufferGeometry,
    material: Material,
    x: number,
    y: number,
    z: number,
    parent = this.body,
  ): Mesh {
    const mesh = new Mesh(this.geometry(geometry), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  private torus(
    radius: number,
    tube: number,
    material: Material,
    y: number,
    parent = this.body,
  ): Mesh {
    return this.mesh(
      new TorusGeometry(radius, tube, 12, 96).rotateX(Math.PI / 2),
      material,
      0,
      y,
      0,
      parent,
    );
  }

  private batch(
    geometry: BufferGeometry,
    material: Material,
    count: number,
    place: (index: number, dummy: Object3D) => void,
    parent = this.body,
  ): InstancedMesh {
    const mesh = new InstancedMesh(this.geometry(geometry), material, count);
    for (let i = 0; i < count; i++) {
      this.dummy.position.set(0, 0, 0);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(1, 1, 1);
      place(i, this.dummy);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(i, this.dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    this.instances.push(mesh);
    parent.add(mesh);
    return mesh;
  }

  /** Absolute render time in seconds, including seeking backwards. No per-frame allocations. */
  update(timeS: number, flashes = true): void {
    if (this.disposed) return;
    const t = tuning.render.fusionReactor;
    const time = Number.isFinite(timeS) ? Math.max(0, timeS) : 0;
    const pulse = flashes
      ? fusionPulse(time)
      : 1 +
        t.pulseDepth * Math.sin((TAU * time) / Math.max(0.01, t.pulsePeriodS));
    this.uniforms.timeS.value = time;
    this.uniforms.pulse.value = pulse;
    this.uniforms.brightness.value = t.brightness;
    this.uniforms.flowSpeed.value = t.flowSpeed;
    if (this.amberColor !== t.amberColor) {
      this.amberColor = t.amberColor;
      this.uniforms.amber.value.set(t.amberColor);
    }
    if (this.whiteColor !== t.whiteColor) {
      this.whiteColor = t.whiteColor;
      this.uniforms.warmWhite.value.set(t.whiteColor);
    }
    if (this.violetColor !== t.violetColor) {
      this.violetColor = t.violetColor;
      this.uniforms.violet.value.set(t.violetColor);
    }
    if (this.blueColor !== t.blueColor) {
      this.blueColor = t.blueColor;
      this.uniforms.blue.value.set(t.blueColor);
    }
    this.steam.uniforms.lifetime!.value = Math.max(0.01, t.steamLifetimeS);
    this.steam.uniforms.rise!.value = t.steamRiseM;
    this.steam.uniforms.size!.value = t.steamSizeM;
    this.steam.uniforms.opacity!.value = t.steamOpacity;
    for (let i = 0; i < this.rings.length; i++)
      this.rings[i]!.rotation.y =
        time * t.ringSpeed * (i % 2 ? -1 : 1) * (1 + i * 0.15);
    const peak = Math.max(0, pulse - 1);
    this.body.position.x = flashes
      ? Math.sin(time * t.tremorHz * TAU) * t.vibrationM * peak
      : 0;
    this.body.position.z = flashes
      ? Math.cos(time * t.tremorHz * TAU) * t.vibrationM * peak
      : 0;
    this.warning.color
      .copy(this.uniforms.amber.value)
      .multiplyScalar(
        t.brightness *
          (flashes
            ? 0.35 +
              0.65 * (0.5 + 0.5 * Math.sin(time * TAU * t.warningHz)) ** 4
            : 0.6),
      );
    const phase = time * Math.max(0, t.arcFrequencyHz);
    const bucket = Math.floor(phase);
    this.arcs.visible =
      flashes && t.arcFrequencyHz > 0 && phase - bucket < t.arcDuty;
    this.arcMaterial.color
      .copy(this.uniforms.blue.value)
      .multiplyScalar(t.brightness);
    this.arcMaterial.opacity = this.arcs.visible
      ? 1 - (phase - bucket) / Math.max(0.01, t.arcDuty)
      : 0;
    if (bucket !== this.arcBucket) {
      this.arcBucket = bucket;
      this.writeArcs(bucket);
    }
    for (const light of this.lightDefs) {
      light.intensity = t.lightIntensity * t.brightness * pulse;
      light.color = t.amberColor;
    }
  }

  private writeArcs(bucket: number): void {
    const t = tuning.render.fusionReactor;
    for (let arc = 0; arc < this.arcCount; arc++) {
      const coil = Math.floor(hash(bucket * 13 + arc * 71) * this.coilCount);
      const from = (coil * TAU) / this.coilCount;
      const to = ((coil + 1) * TAU) / this.coilCount;
      const radius = t.majorRadiusM + t.coilRadiusM;
      const y =
        t.chamberHeightM + (hash(bucket + arc * 19) - 0.5) * t.coilHeightM;
      for (let j = 0; j < this.arcSegments; j++) {
        for (let end = 0; end < 2; end++) {
          const step = j + end;
          const f = step / this.arcSegments;
          const envelope = Math.sin(f * Math.PI) * t.arcJitterM;
          const seed = bucket * 101 + arc * 37 + step * 7;
          const offset = (arc * this.arcSegments + j) * 2 + end;
          this.arcPositions.setXYZ(
            offset,
            radius * ((1 - f) * Math.cos(from) + f * Math.cos(to)) +
              (hash(seed) - 0.5) * envelope,
            y + (hash(seed + 1) - 0.5) * envelope,
            -radius * ((1 - f) * Math.sin(from) + f * Math.sin(to)) +
              (hash(seed + 2) - 0.5) * envelope,
          );
        }
      }
    }
    this.arcPositions.needsUpdate = true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const mesh of this.instances) mesh.dispose();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.root.removeFromParent();
  }
}
