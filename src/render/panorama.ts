import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
} from 'three';
import { Rng } from '../core/rng';
import { tuning } from '../core/tuning';
import { getMaterial } from './materials';

const vertex = /* glsl */ `
  varying vec3 world; varying vec2 texUv;
  void main() {
    texUv=uv; vec4 p=vec4(position,1.0);
    #ifdef USE_INSTANCING
      p=instanceMatrix*p;
    #endif
    world=(modelMatrix*p).xyz;
    gl_Position=projectionMatrix*viewMatrix*vec4(world,1.0);
  }`;

/** Wyłącznie tło: seed osobnego strumienia, brak ciał fizycznych. */
export class Panorama extends Group {
  private signature = '';
  private readonly geometry = new BoxGeometry(1, 1, 1);
  private readonly panelGeometry = new PlaneGeometry(1, 1);
  private readonly uniforms = {
    time: { value: 0 },
    amber: { value: new Color('#ffae1a') },
    white: { value: new Color('#fff1d6') },
    violet: { value: new Color().setRGB(0.22, 0.08, 0.65) },
  };
  private readonly beacons = new ShaderMaterial({
    uniforms: this.uniforms,
    vertexShader: vertex,
    toneMapped: false,
    fragmentShader: `varying vec3 world; uniform float time; uniform vec3 amber; uniform vec3 white;
      void main() { float pulse=step(0.1,sin(time*2.0+world.x)); gl_FragColor=vec4(mix(amber,white,step(0.5,fract(world.z)))*(0.15+0.85*pulse),1.0);
        #include <colorspace_fragment>
      }`,
  });
  private readonly hologram = new ShaderMaterial({
    uniforms: this.uniforms,
    vertexShader: vertex,
    toneMapped: false,
    transparent: true,
    depthWrite: false,
    fragmentShader: `varying vec3 world; varying vec2 texUv; uniform float time; uniform vec3 amber; uniform vec3 violet;
      void main() { float noise=fract(sin(dot(floor(texUv*100.0)+floor(time*4.0),vec2(12.9898,78.233)))*43758.5453);
        float bars=0.45+0.55*step(0.3,fract(texUv.y*12.0));
        float edge=smoothstep(0.0,0.08,texUv.x)*smoothstep(0.0,0.08,1.0-texUv.x);
        vec3 tint=mix(amber,violet,texUv.y);
        gl_FragColor=vec4(tint*(0.65+noise*0.35)*bars,edge*0.55);
        #include <colorspace_fragment>
      }`,
  });
  constructor(
    private readonly seed: string,
    private readonly floorY: number,
  ) {
    super();
    this.name = 'city-panorama';
    this.beacons.userData.bloom = true;
    this.hologram.userData.bloom = true;
  }
  sync(dt: number): void {
    const t = tuning.render;
    this.visible = t.panoramaEnabled > 0;
    this.uniforms.time.value += dt;
    const signature = `${t.panoramaDensity}:${t.panoramaHeight}`;
    if (!this.visible || signature === this.signature) return;
    this.signature = signature;
    for (const child of this.children)
      if (child instanceof InstancedMesh) child.dispose();
    this.clear();
    const rng = new Rng(this.seed).fork('panorama');
    const count = Math.max(
      1,
      Math.round(Math.min(1, Math.max(0, t.panoramaDensity)) * 40),
    );
    const matrix = new Matrix4();
    const roofs = new InstancedMesh(this.geometry, this.beacons, count * 3);
    for (let layer = 0; layer < 3; layer++) {
      const buildings = new InstancedMesh(
        this.geometry,
        getMaterial('facade'),
        count,
      );
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + rng.float(-0.035, 0.035);
        const radius = 65 + layer * 32 + rng.float(-6, 6);
        const height =
          Math.max(1, t.panoramaHeight) *
          rng.float(0.45, 1.25) *
          (1 + layer * 0.25);
        const x = Math.sin(angle) * radius,
          z = Math.cos(angle) * radius;
        matrix.makeScale(rng.float(5, 10), height, rng.float(5, 10));
        matrix.setPosition(x, this.floorY + height / 2, z);
        buildings.setMatrixAt(i, matrix);
        buildings.setColorAt(i, new Color().setScalar(0.45 - layer * 0.08));
        matrix
          .makeScale(0.22, 0.22, 0.22)
          .setPosition(x, this.floorY + height + 0.2, z);
        roofs.setMatrixAt(layer * count + i, matrix);
      }
      buildings.instanceMatrix.needsUpdate = true;
      this.add(buildings);
    }
    roofs.instanceMatrix.needsUpdate = true;
    this.add(roofs);
    for (let i = 0; i < 3; i++) {
      const panel = new Mesh(this.panelGeometry, this.hologram);
      panel.position.set((i - 1) * 40, this.floorY + 18 + i * 8, -58 - i * 14);
      panel.scale.set(12 + i * 2, 7 + i * 3, 1);
      panel.userData.noOutline = true;
      this.add(panel);
    }
  }
  dispose(): void {
    for (const child of this.children)
      if (child instanceof InstancedMesh) child.dispose();
    this.clear();
    this.removeFromParent();
    this.geometry.dispose();
    this.panelGeometry.dispose();
    this.beacons.dispose();
    this.hologram.dispose();
  }
}
