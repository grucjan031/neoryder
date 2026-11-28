import {
  AdditiveBlending,
  BackSide,
  Color,
  ShaderMaterial,
  Vector3,
} from 'three';
import { tuning } from '../core/tuning';

export function createForestUniforms(floorY: number) {
  return {
    time: { value: 0 },
    floorY: { value: floorY },
    sway: { value: tuning.forest.swayM },
    frequency: { value: tuning.forest.swayHz },
    haze: { value: new Vector3() },
    mistColor: { value: new Color() },
    moonColor: { value: new Color() },
    amber: { value: new Color() },
    moonDir: { value: new Vector3() },
    moonSize: { value: 0 },
    moonHalo: { value: 0 },
    mistOpacity: { value: 0 },
    mistSpeed: { value: 0 },
    blinkPeriod: { value: 0 },
  };
}
export type ForestUniforms = ReturnType<typeof createForestUniforms>;

const vertex = /* glsl */ `
  attribute vec4 forestData;
  uniform float time, sway, frequency;
  varying vec3 vWorld, vNormalW, vLocal;
  varying vec4 vData;
  void main() {
    vLocal = position;
    vData = forestData;
    vec4 p = instanceMatrix * vec4(position, 1.0);
    float bend = forestData.y * pow(clamp(position.y + 0.5, 0.0, 1.0), 1.8);
    p.x += sin(time * frequency + forestData.x) * sway * bend;
    p.z += cos(time * frequency * 0.7 + forestData.x) * sway * bend * 0.5;
    vWorld = (modelMatrix * p).xyz;
    // Inverse transpose for nonuniform instance scales (flat ground / wide boughs).
    mat3 im = mat3(instanceMatrix);
    vec3 invScale = vec3(dot(im[0], im[0]), dot(im[1], im[1]), dot(im[2], im[2]));
    vNormalW = normalize(mat3(modelMatrix) * im * (normal / invScale));
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
  }
`;
const common = /* glsl */ `
  uniform float time, floorY;
  uniform vec3 haze, mistColor, moonColor, amber, moonDir;
  varying vec3 vWorld, vNormalW, vLocal;
  varying vec4 vData;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
`;

export function createForestMaterial(
  u: ForestUniforms,
  color: string,
  mode: 'solid' | 'ground' | 'mist' | 'light' = 'solid',
) {
  const material = new ShaderMaterial({
    name: `forest_${mode}_${color}`,
    uniforms: { ...u, tint: { value: new Color(color) } },
    vertexShader: vertex,
    fragmentShader: /* glsl */ `
      ${common}
      uniform vec3 tint;
      uniform float mistOpacity, mistSpeed, blinkPeriod;
      void main() {
        vec3 col = tint;
        float opacity = 1.0;
        ${
          mode === 'solid' || mode === 'ground'
            ? /* glsl */ `
          vec3 n = normalize(vNormalW);
          float edge = pow(1.0 - abs(dot(n, normalize(cameraPosition - vWorld))), 3.0);
          float rim = pow(max(dot(n, moonDir), 0.0), 3.0) * edge;
          float grain = hash(floor(vWorld * vec3(9.0, 1.3, 9.0)));
          float bark = 0.8 + 0.2 * sin(vWorld.y * 2.0 + grain * 6.0);
          ${
            mode === 'ground'
              ? `float moss = smoothstep(-0.4, 0.5, sin(vWorld.x * 0.55 + sin(vWorld.z * 0.72)) * cos(vWorld.z * 0.9));
          col = mix(tint * vec3(1.4, 0.78, 0.6), tint * vec3(1.3, 1.65, 0.95), moss);`
              : ''
          }
          float needles = 0.65 + 0.35 * hash(floor(vWorld * vec3(5.0, 14.0, 5.0)));
          col *= (0.42 + 0.58 * max(n.y, 0.0)) * bark * needles;
          col *= 0.8 + 0.3 * sin(vData.x);
          col += moonColor * rim * 0.018;
          col += amber * 0.0015 * exp(-max(vWorld.y - floorY, 0.0) / 3.0);
          float fog = smoothstep(haze.x, haze.y, distance(vWorld, cameraPosition));
          fog *= 0.45 + 0.55 * exp(-max(vWorld.y - floorY, 0.0) / haze.z);
          col = mix(col, mistColor, fog * 0.22);
        `
            : mode === 'mist'
              ? /* glsl */ `
          float edge = pow(max(1.0 - length(vLocal * 2.0), 0.0), 1.3);
          float drift = 0.6 + 0.4 * sin(vWorld.x * 0.3 + vWorld.z * 0.2 + time * mistSpeed + vData.x);
          opacity = edge * drift * mistOpacity;
        `
              : /* glsl */ `
          col = vData.z < 0.5 ? amber : (vData.z < 1.5 ? tint : vec3(0.15, 0.7, 0.07));
          float blink = vData.w > 0.5 ? smoothstep(0.04, 0.12, fract(time / blinkPeriod + vData.x)) : 1.0;
          col *= blink * 2.0;
        `
        }
        gl_FragColor = vec4(col, opacity);
        #include <colorspace_fragment>
      }
    `,
    transparent: mode === 'mist',
    depthWrite: mode !== 'mist',
    toneMapped: false,
    ...(mode === 'mist' && { blending: AdditiveBlending }),
  });
  material.userData.bloom = mode === 'light';
  return material;
}

export function createForestSky(u: ForestUniforms) {
  return new ShaderMaterial({
    name: 'forest_sky',
    uniforms: u,
    side: BackSide,
    depthWrite: false,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * viewMatrix * vec4(cameraPosition + position * length(modelMatrix[0].xyz), 1.0);
        p.z = p.w * 0.99999;
        gl_Position = p;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 moonDir, moonColor, mistColor;
      uniform float moonSize, moonHalo, time, mistSpeed;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float dist = length(d - moonDir);
        float disc = 1.0 - smoothstep(moonSize * 0.9, moonSize, dist);
        float halo = exp(-dist / moonHalo) * 0.14;
        float cloud = sin(d.x * 32.0 + sin(d.z * 21.0) + time * mistSpeed) * sin(d.z * 38.0 + d.y * 16.0);
        vec3 sky = mix(mistColor * 0.55, vec3(0.004, 0.008, 0.022), max(d.y, 0.0));
        sky += moonColor * (disc * (0.9 + 0.1 * sin(d.x * 900.0) * sin(d.y * 700.0)) + halo) * (0.72 + cloud * 0.2);
        gl_FragColor = vec4(sky, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}
