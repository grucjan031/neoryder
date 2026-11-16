import {
  BoxGeometry,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import type { BufferGeometry, Material } from 'three';
import { tuning } from '../core/tuning';
import { buildSkyline } from './skyline';
import {
  createAdMaterial,
  createBeaconMaterial,
  createBuildingMaterial,
  createSkyMaterial,
  createSkyUniforms,
  createTrafficMaterial,
} from './skyMaterials';

/**
 * Wyłącznie tło: seed osobnego strumienia, brak ciał fizycznych, brak świateł.
 * 7 meshy: wieżowce (1 InstancedMesh), światła ostrzegawcze, pojazdy,
 * 3 hologramy reklam i kopuła nieba (łuna + chmury) w podgrupie `sky`.
 */
export class Panorama extends Group {
  private signature = '';
  private readonly uniforms = createSkyUniforms();
  private readonly quad = new PlaneGeometry(1, 1);
  private readonly sphere = new SphereGeometry(1, 32, 16);
  private readonly buildingMaterial = createBuildingMaterial(this.uniforms);
  private readonly beaconMaterial = createBeaconMaterial(this.uniforms);
  private readonly trafficMaterial = createTrafficMaterial(this.uniforms);
  private readonly skyMaterial = createSkyMaterial(this.uniforms);
  private readonly sky = new Group();
  private readonly owned: (BufferGeometry | Material)[] = [];
  constructor(
    private readonly seed: string,
    private readonly floorY: number,
  ) {
    super();
    this.name = 'city-panorama';
    this.uniforms.floorY.value = floorY;
    this.sky.name = 'city-sky';
    const dome = new Mesh(this.sphere, this.skyMaterial);
    dome.name = 'sky-dome';
    dome.frustumCulled = false;
    dome.renderOrder = -10;
    dome.userData.noOutline = true;
    this.sky.add(dome);
  }
  sync(dt: number): void {
    const t = tuning.render;
    const c = tuning.city;
    this.visible = t.panoramaEnabled > 0;
    const u = this.uniforms;
    u.time.value += dt;
    u.wall.value.set(c.panoramaWall);
    u.windowEmission.value = c.panoramaWindowEmission;
    u.beaconBrightness.value = c.panoramaBeaconBrightness;
    u.glowStrength.value = c.skyGlowStrength;
    u.cloudStrength.value = c.skyCloudStrength;
    u.cloudSpeed.value = c.skyCloudSpeed;
    const signature = `${t.panoramaDensity}:${t.panoramaHeight}:${c.panoramaTraffic}`;
    if (!this.visible || signature === this.signature) return;
    this.signature = signature;
    this.release();
    this.add(this.sky);
    const layout = buildSkyline(this.seed, {
      floorY: this.floorY,
      density: t.panoramaDensity,
      height: t.panoramaHeight,
      traffic: c.panoramaTraffic,
    });
    const matrix = new Matrix4();
    const rotation = new Quaternion();
    const up = new Vector3(0, 1, 0);
    const position = new Vector3();
    const scale = new Vector3();

    // Wieżowce: jedna instancja na bryłę; parametry okien w atrybutach instancji.
    const box = new BoxGeometry(1, 1, 1);
    const n = layout.buildings.length;
    const params = new Float32Array(n * 4);
    const params2 = new Float32Array(n * 4);
    box.setAttribute('params', new InstancedBufferAttribute(params, 4));
    box.setAttribute('params2', new InstancedBufferAttribute(params2, 4));
    const buildings = new InstancedMesh(box, this.buildingMaterial, n);
    buildings.name = 'skyline-buildings';
    layout.buildings.forEach((b, i) => {
      rotation.setFromAxisAngle(up, b.yaw);
      position.set(b.x, b.baseY + b.height / 2, b.z);
      scale.set(b.width, b.height, b.depth);
      buildings.setMatrixAt(i, matrix.compose(position, rotation, scale));
      params.set([b.seed, b.kind, b.windowColor, b.lit], i * 4);
      params2.set([b.accent, b.tone, b.layer, 0], i * 4);
    });
    buildings.instanceMatrix.needsUpdate = true;
    buildings.computeBoundingSphere();
    this.owned.push(box);
    this.add(buildings);

    // Światła ostrzegawcze (bursztyn): billboardy addytywne z bloomem.
    const beaconQuad = this.quad.clone();
    const beaconData = new Float32Array(layout.beacons.length * 4);
    beaconQuad.setAttribute(
      'beacon',
      new InstancedBufferAttribute(beaconData, 4),
    );
    const beacons = new InstancedMesh(
      beaconQuad,
      this.beaconMaterial,
      layout.beacons.length,
    );
    beacons.name = 'skyline-beacons';
    layout.beacons.forEach((b, i) => {
      beacons.setMatrixAt(i, matrix.makeTranslation(b.x, b.y, b.z));
      beaconData.set([b.size, b.period, b.phase, b.color], i * 4);
    });
    beacons.instanceMatrix.needsUpdate = true;
    beacons.frustumCulled = false;
    beacons.userData.noOutline = true;
    this.owned.push(beaconQuad);
    this.add(beacons);

    // Pojazdy: para świateł (ciepła biel z przodu, bursztyn z tyłu), ruch w shaderze.
    const trafficQuad = this.quad.clone();
    const lanes = new Float32Array(layout.lanes.length * 2 * 4);
    const lights = new Float32Array(layout.lanes.length * 2 * 2);
    layout.lanes.forEach((l, i) => {
      for (let k = 0; k < 2; k++) {
        lanes.set([l.radius, l.height, l.speed, l.phase], (i * 2 + k) * 4);
        lights.set(
          [
            k === 0 ? 1.4 * Math.sign(l.speed) : -1.4 * Math.sign(l.speed),
            k === 0 ? 1 : 0,
          ],
          (i * 2 + k) * 2,
        );
      }
    });
    trafficQuad.setAttribute('lane', new InstancedBufferAttribute(lanes, 4));
    trafficQuad.setAttribute('light', new InstancedBufferAttribute(lights, 2));
    const traffic = new InstancedMesh(
      trafficQuad,
      this.trafficMaterial,
      layout.lanes.length * 2,
    );
    traffic.name = 'skyline-traffic';
    traffic.frustumCulled = false;
    traffic.userData.noOutline = true;
    this.owned.push(trafficQuad);
    this.add(traffic);

    // Hologramy reklam na fasadach (3 panele, jednostronne logicznie, addytywne).
    layout.ads.slice(0, 3).forEach((ad, i) => {
      const material = createAdMaterial(
        this.uniforms,
        ad.color,
        ad.style,
        i * 3.7 + 1,
        ad.width,
        ad.height,
      );
      const panel = new Mesh(this.quad, material);
      panel.name = 'skyline-ad';
      panel.position.set(ad.x, ad.y, ad.z);
      panel.rotation.y = ad.yaw;
      panel.scale.set(ad.width, ad.height, 1);
      panel.userData.noOutline = true;
      this.owned.push(material);
      this.add(panel);
    });
  }
  private release(): void {
    for (const child of this.children)
      if (child instanceof InstancedMesh) child.dispose();
    for (const item of this.owned) item.dispose();
    this.owned.length = 0;
    this.clear();
  }
  dispose(): void {
    this.release();
    this.removeFromParent();
    this.quad.dispose();
    this.sphere.dispose();
    this.buildingMaterial.dispose();
    this.beaconMaterial.dispose();
    this.trafficMaterial.dispose();
    this.skyMaterial.dispose();
  }
}
