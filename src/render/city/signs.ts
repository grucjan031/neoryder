import {
  AdditiveBlending,
  BoxGeometry,
  ConeGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
} from 'three';
import type { Camera } from 'three';
import { Rng } from '../../core/rng';
import { tuning } from '../../core/tuning';
import type { SignDef } from '../../world/dressingSchema';
import {
  CityTextures,
  cityColor,
  cityVertex,
  disposeCityGroup,
} from './resources';
import type { TextureLoad } from './resources';

const fragment = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 tint;
  uniform float brightness, time, partial, noiseSeed, holo, glitch, scanLines, scanHz, glitchUv, opacity;
  varying vec2 vUv;
  float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
  void main() {
    vec2 uv = vUv;
    float band = floor(uv.y * 16.0);
    uv.x += (hash(band + floor(time * 20.0)) - 0.5) * glitch * glitchUv;
    vec4 texel = texture2D(map, uv);
    // Przesunięcie kanałów zachowuje barwę palety: aberracja dotyczy luminancji.
    vec3 split = vec3(texture2D(map, uv + vec2(glitch * glitchUv, 0.0)).r,
      texel.g, texture2D(map, uv - vec2(glitch * glitchUv, 0.0)).b);
    float mask = mix(1.0, step(0.3, hash(floor(uv.x * 12.0) + band + noiseSeed)), partial);
    float scan = mix(1.0, 0.78 + 0.22 * sin((uv.y * scanLines - time * scanHz) * 6.283185), holo);
    float fade = mix(1.0, smoothstep(0.0, 0.45, uv.y), holo);
    gl_FragColor = vec4(split * tint * brightness * mask * scan, texel.a * fade * opacity);
    #include <colorspace_fragment>
  }
`;

interface SignState {
  material: ShaderMaterial;
  flicker: number;
  rng: Rng;
  time: number;
  outage: number;
  partial: number;
  nextEvent: number;
  projector?: Mesh<ConeGeometry, MeshBasicMaterial>;
}

export class SignRenderer {
  readonly root = new Group();
  private readonly textures: CityTextures;
  private readonly signs: SignState[] = [];
  private disposed = false;

  constructor(
    defs: readonly SignDef[],
    seed: string | number = 'city-signs',
    load?: TextureLoad,
  ) {
    this.textures = new CityTextures(load);
    const rng = new Rng(seed);
    defs.forEach((def, i) => {
      const group = new Group();
      group.position.copy(def.position);
      group.rotation.y = def.yaw;
      const material = new ShaderMaterial({
        vertexShader: cityVertex,
        fragmentShader: fragment,
        uniforms: {
          map: { value: null },
          tint: { value: cityColor(def.tint ?? '#fff1d6') },
          brightness: { value: tuning.city.signBrightness },
          time: { value: 0 },
          partial: { value: 0 },
          noiseSeed: { value: i },
          holo: { value: def.kind === 'holo' ? 1 : 0 },
          glitch: { value: 0 },
          scanLines: { value: tuning.city.holoScanLines },
          scanHz: { value: tuning.city.holoScanHz },
          glitchUv: { value: tuning.city.holoGlitchUv },
          opacity: { value: def.kind === 'holo' ? tuning.city.holoOpacity : 1 },
        },
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
      });
      material.userData.bloom = true;
      this.textures.request(
        def.kind === 'holo' ? 'holo' : 'signs',
        def.texture,
        (texture) => {
          material.uniforms.map!.value = texture;
        },
      );
      const plane = new Mesh(
        new PlaneGeometry(def.size.w, def.size.h),
        material,
      );
      plane.userData.noOutline = true;
      plane.position.z = tuning.city.surfaceOffsetM;
      group.add(plane);
      const state: SignState = {
        material,
        flicker: def.flicker ?? 0,
        rng: rng.fork(String(i)),
        time: rng.float(0, 10),
        outage: 0,
        partial: 0,
        nextEvent: 0,
      };
      if (def.kind === 'neon') {
        const frame = new Mesh(
          new BoxGeometry(
            def.size.w + tuning.city.signFrameM,
            def.size.h + tuning.city.signFrameM,
            tuning.city.signFrameM,
          ),
          new MeshBasicMaterial({ color: '#111824' }),
        );
        frame.material.userData.bloom = false;
        frame.position.z = -tuning.city.signFrameM / 2;
        group.add(frame);
      } else {
        const beam = new Mesh(
          new ConeGeometry(def.size.w / 2, def.size.h, 24, 1, true),
          new MeshBasicMaterial({
            color: def.tint ?? '#8a5cff',
            transparent: true,
            opacity: tuning.city.holoProjectorOpacity,
            blending: AdditiveBlending,
            depthWrite: false,
            side: DoubleSide,
            toneMapped: false,
          }),
        );
        beam.rotation.z = Math.PI;
        beam.position.y = -def.size.h / 2;
        beam.material.userData.bloom = true;
        group.add(beam);
        beam.userData.noOutline = true;
        state.projector = beam;
      }
      this.signs.push(state);
      this.root.add(group);
    });
  }

  update(_dtWorldS: number, dtRealS: number, _camera: Camera): void {
    void _camera;
    if (this.disposed) return;
    const dt = Math.max(0, dtRealS);
    const t = tuning.city;
    for (const sign of this.signs) {
      sign.time += dt;
      sign.outage = Math.max(0, sign.outage - dt);
      sign.partial = Math.max(0, sign.partial - dt);
      sign.nextEvent -= dt;
      if (sign.nextEvent <= 0 && dt > 0) {
        sign.nextEvent = t.signOutageS;
        if (
          sign.rng.chance(
            1 - Math.exp(-sign.flicker * t.signOutageRate * t.signOutageS),
          )
        )
          sign.outage = t.signOutageS * sign.rng.float(0.3, 1);
        if (
          sign.rng.chance(
            1 - Math.exp(-sign.flicker * t.signPartialRate * t.signOutageS),
          )
        ) {
          sign.partial = t.signPartialS;
          sign.material.uniforms.noiseSeed!.value = sign.rng.float(0, 1000);
        }
      }
      const u = sign.material.uniforms;
      const brightness =
        sign.outage > 0
          ? t.signOutageBrightness
          : 1 +
            Math.sin(sign.time * t.signBuzzHz * Math.PI * 2) *
              sign.flicker *
              t.signBuzzAmount;
      u.time!.value = sign.time;
      u.brightness!.value = t.signBrightness * brightness;
      u.partial!.value = sign.partial > 0 ? 1 : 0;
      u.glitch!.value =
        u.holo!.value && sign.time % t.holoGlitchIntervalS < t.holoGlitchS
          ? 1
          : 0;
      u.scanLines!.value = t.holoScanLines;
      u.scanHz!.value = t.holoScanHz;
      u.glitchUv!.value = t.holoGlitchUv;
      u.opacity!.value = u.holo!.value ? t.holoOpacity : 1;
      if (sign.projector)
        sign.projector.material.opacity = t.holoProjectorOpacity * brightness;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.textures.dispose();
    disposeCityGroup(this.root);
    this.signs.length = 0;
  }
}
