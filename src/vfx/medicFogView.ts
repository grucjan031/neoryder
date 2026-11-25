import {
  Group,
  Mesh,
  CylinderGeometry,
  RingGeometry,
  CircleGeometry,
  MeshBasicMaterial,
  DoubleSide,
  PlaneGeometry,
  ShaderMaterial,
  InstancedMesh,
  Object3D,
  Vector3,
} from 'three';
import type { MedicFog } from '../enemies/medic';

const cloudsPerZone = 16;
export class MedicFogView {
  readonly root = new Group();
  private readonly sprite = new PlaneGeometry(1, 1);
  private readonly haze = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    vertexShader:
      'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
    fragmentShader:
      'varying vec2 vUv; void main(){vec2 p=vUv*2.-1.;float w=1.-smoothstep(.12,1.,dot(p,p));gl_FragColor=vec4(.5,.58,.3,w*.42);}',
  });
  private readonly red = new MeshBasicMaterial({
    color: 0xe32931,
    side: DoubleSide,
  });
  private readonly silver = new MeshBasicMaterial({ color: 0xbcc1bb });
  private readonly ring = new RingGeometry(0.975, 1, 64);
  // Zabarwienie podłoża: gracz stojący w mgle widzi chorobliwą plamę pod nogami.
  private readonly disc = new CircleGeometry(1, 48);
  private readonly stain = new MeshBasicMaterial({
    color: 0x8a9a4c,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });
  private readonly stains: Mesh[] = [];
  private readonly barrel = new CylinderGeometry(0.021, 0.016, 0.2, 8);
  private readonly piston = new CylinderGeometry(0.026, 0.026, 0.05, 8);
  private readonly dots: InstancedMesh;
  private readonly outlines: Mesh[] = [];
  private readonly needles: Group[] = [];
  private readonly pose = new Object3D();
  private readonly axis = new Vector3(0, 1, 0);
  private readonly direction = new Vector3();

  constructor(limit: number) {
    this.dots = new InstancedMesh(
      this.sprite,
      this.haze,
      limit * cloudsPerZone,
    );
    this.dots.frustumCulled = false;
    this.root.add(this.dots);
    for (let i = 0; i < limit; i++) {
      const outline = new Mesh(this.ring, this.red);
      outline.rotation.x = -Math.PI / 2;
      const needle = new Group();
      const piston = new Mesh(this.piston, this.red);
      piston.position.y = -0.125;
      needle.add(new Mesh(this.barrel, this.silver), piston);
      const stain = new Mesh(this.disc, this.stain);
      stain.rotation.x = -Math.PI / 2;
      stain.renderOrder = 1;
      stain.userData.noOutline = true;
      outline.userData.noOutline = true;
      outline.renderOrder = 2;
      this.root.add(stain, outline, needle);
      this.stains.push(stain);
      this.outlines.push(outline);
      this.needles.push(needle);
    }
  }

  render(sim: MedicFog, alpha: number, yaw: number): void {
    let count = 0;
    for (let i = 0; i < this.needles.length; i++) {
      const flight = sim.flights[i],
        needle = this.needles[i]!;
      needle.visible = !!flight;
      if (flight) {
        needle.position.copy(flight.previous).lerp(flight.position, alpha);
        this.direction.copy(flight.position).sub(flight.previous);
        if (this.direction.lengthSq() > 0)
          needle.quaternion.setFromUnitVectors(
            this.axis,
            this.direction.normalize(),
          );
      }
      const zone = sim.zones[i],
        ring = this.outlines[i]!;
      const stain = this.stains[i]!;
      ring.visible = !!zone;
      stain.visible = !!zone;
      if (!zone) continue;
      const { center, params, remaining } = zone;
      ring.position.set(center.x, center.y + 0.035, center.z);
      ring.scale.setScalar(params.fogRadiusM);
      stain.position.set(center.x, center.y + 0.02, center.z);
      stain.scale.setScalar(params.fogRadiusM * 0.98);
      for (let j = 0; j < cloudsPerZone; j++) {
        const a = j * 2.4 + remaining * 0.1;
        const r = params.fogRadiusM * 0.7 * Math.sqrt(j / cloudsPerZone);
        this.pose.position.set(
          center.x + r * Math.cos(a),
          center.y + 0.42 + 0.1 * Math.sin(a),
          center.z + r * Math.sin(a),
        );
        this.pose.rotation.y = yaw;
        this.pose.scale.set(params.fogRadiusM * 0.9, 0.95, 1);
        this.pose.updateMatrix();
        this.dots.setMatrixAt(count++, this.pose.matrix);
      }
    }
    this.dots.count = count;
    this.dots.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.root.removeFromParent();
    for (const resource of [
      this.dots,
      this.sprite,
      this.haze,
      this.red,
      this.silver,
      this.ring,
      this.disc,
      this.stain,
      this.barrel,
      this.piston,
    ])
      resource.dispose();
  }
}
