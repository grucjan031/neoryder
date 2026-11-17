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
import { loadSettings } from '../../core/save';
import { sourceFlicker } from './flicker';
import { getPowerLevel } from '../powerLevel';
import { tuning } from '../../core/tuning';
import type {
  CityLightDef,
  SignDef,
  FlickerDef,
} from '../../world/dressingSchema';
import {
  CityTextures,
  cityColor,
  cityVertex,
  disposeCityGroup,
  signGlowFragment,
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
    // Alfa z luminancji przy niezmienionym rgb * a: czarne tło tekstury nie zasłania bloomu ("over").
    float coverage = clamp(max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b)), 0.0, 1.0);
    float shaped = gl_FragColor.a * coverage;
    gl_FragColor.rgb = shaped > 1e-5 ? gl_FragColor.rgb * (gl_FragColor.a / shaped) : gl_FragColor.rgb;
    gl_FragColor.a = shaped;
  }
`;

/**
 * Kolor poświaty napisu: własny tint, w razie braku kolor najbliższego światła punktowego
 * w zasięgu `rangeM` (napisy bez tintu dziedziczą barwę z tekstury, której nie znamy przed
 * załadowaniem), w ostateczności ciepła biel.
 */
export function signGlowColor(
  def: Pick<SignDef, 'tint' | 'position'>,
  lights: readonly CityLightDef[],
  rangeM: number,
): string {
  if (def.tint) return def.tint;
  let best = rangeM * rangeM;
  let color = '#fff1d6';
  for (const light of lights) {
    const d =
      (light.position.x - def.position.x) ** 2 +
      (light.position.y - def.position.y) ** 2 +
      (light.position.z - def.position.z) ** 2;
    if (d <= best) {
      best = d;
      color = light.color;
    }
  }
  return color;
}

interface SignState {
  material: ShaderMaterial;
  glow: ShaderMaterial;
  glowBase: number;
  halo: Mesh;
  width: number;
  height: number;
  flicker: number;
  pattern: FlickerDef | undefined;
  seed: number;
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
    lights: readonly CityLightDef[] = [],
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
        depthTest: true,
        depthWrite: false,
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
      plane.renderOrder = tuning.city.glowRenderOrder;
      plane.position.z = tuning.city.surfaceOffsetM;
      group.add(plane);
      const glow = new ShaderMaterial({
        vertexShader: cityVertex,
        fragmentShader: signGlowFragment,
        uniforms: {
          tint: {
            value: cityColor(
              signGlowColor(def, lights, tuning.city.signGlowLightRangeM),
            ),
          },
          opacity: { value: 0 },
          power: { value: tuning.city.signGlowPower },
          edgeFade: { value: tuning.city.signGlowEdgeFade },
        },
        transparent: true,
        blending: AdditiveBlending,
        depthTest: true,
        depthWrite: false,
        toneMapped: false,
      });
      glow.userData.bloom = false;
      const halo = new Mesh(new PlaneGeometry(1, 1), glow);
      halo.userData.noOutline = true;
      halo.renderOrder = tuning.city.glowRenderOrder;
      halo.position.z = tuning.city.surfaceOffsetM;
      const glowScale = Math.min(
        tuning.city.signGlowScale,
        tuning.city.signGlowMaxScale,
      );
      halo.scale.set(def.size.w * glowScale, def.size.h * glowScale, 1);
      group.add(halo);
      const state: SignState = {
        glow,
        halo,
        width: def.size.w,
        height: def.size.h,
        glowBase: def.kind === 'holo' ? tuning.city.signGlowHoloFactor : 1,
        material,
        flicker: typeof def.flicker === 'number' ? def.flicker : 0,
        pattern: typeof def.flicker === 'object' ? def.flicker : undefined,
        seed: rng.fork(String(i)).getState(),
        rng: rng.fork(String(i)),
        time: typeof def.flicker === 'object' ? 0 : rng.float(0, 10),
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
            depthTest: true,
            depthWrite: false,
            // Otwarty stożek projektora jest widoczny również od środka.
            side: DoubleSide,
            toneMapped: false,
          }),
        );
        beam.rotation.z = Math.PI;
        beam.position.y = -def.size.h / 2;
        beam.material.userData.bloom = true;
        group.add(beam);
        beam.userData.noOutline = true;
        beam.renderOrder = tuning.city.glowRenderOrder;
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
    const flashes = loadSettings().flashes;
    const power = getPowerLevel();
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
      const legacyBrightness =
        sign.outage > 0
          ? t.signOutageBrightness
          : 1 +
            Math.sin(sign.time * t.signBuzzHz * Math.PI * 2) *
              sign.flicker *
              t.signBuzzAmount;
      const brightness =
        power *
        (sign.pattern
          ? sourceFlicker(sign.pattern, sign.time, sign.seed, flashes)
          : flashes
            ? legacyBrightness
            : 1);
      u.time!.value = sign.time;
      u.brightness!.value = t.signBrightness * brightness;
      u.partial!.value = flashes && sign.partial > 0 ? 1 : 0;
      u.glitch!.value =
        u.holo!.value && sign.time % t.holoGlitchIntervalS < t.holoGlitchS
          ? 1
          : 0;
      u.scanLines!.value = t.holoScanLines;
      u.scanHz!.value = t.holoScanHz;
      u.glitchUv!.value = t.holoGlitchUv;
      u.opacity!.value = u.holo!.value ? t.holoOpacity : 1;
      const glow = sign.glow.uniforms;
      glow.opacity!.value =
        t.signGlowOpacity * sign.glowBase * Math.min(1.25, brightness);
      glow.power!.value = t.signGlowPower;
      glow.edgeFade!.value = t.signGlowEdgeFade;
      const glowScale = Math.min(t.signGlowScale, t.signGlowMaxScale);
      sign.halo.scale.set(sign.width * glowScale, sign.height * glowScale, 1);
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
