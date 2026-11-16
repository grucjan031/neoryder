import {
  AdditiveBlending,
  Color,
  DoubleSide,
  ShaderMaterial,
  Vector2,
} from 'three';
import { SKY_PALETTE } from './skyline';

/**
 * Materiały nieba i panoramy (tylko tło, bez świateł punktowych).
 * Wszystko jest nieoświetlone i proceduralne; mgłę dalekich brył dokłada
 * kompozycja (`outline.ts`) z bufora głębi. Gradient nieba jest tłem przebiegu
 * koloru, więc elementy bez zapisu głębi (chmury, łuna, światła, hologramy)
 * mieszają się z nim wprost; są addytywne, bo to źródła światła.
 */
export interface SkyUniforms {
  time: { value: number };
  floorY: { value: number };
  palette: { value: Color[] };
  wall: { value: Color };
  uplight: { value: Color };
  glowLow: { value: Color };
  glowHigh: { value: Color };
  glowStrength: { value: number };
  cloudStrength: { value: number };
  cloudSpeed: { value: number };
  windowEmission: { value: number };
  beaconBrightness: { value: number };
  [key: string]: { value: unknown };
}

export function createSkyUniforms(): SkyUniforms {
  return {
    time: { value: 0 },
    floorY: { value: 0 },
    palette: { value: SKY_PALETTE.map((c) => new Color(c)) },
    wall: { value: new Color('#1c2333') },
    uplight: { value: new Color('#ffae1a') },
    glowLow: { value: new Color('#ffae1a') },
    glowHigh: { value: new Color('#8a5cff') },
    glowStrength: { value: 1 },
    cloudStrength: { value: 1 },
    cloudSpeed: { value: 0.004 },
    windowEmission: { value: 1 },
    beaconBrightness: { value: 1 },
  };
}

const paletteGlsl = /* glsl */ `
  uniform vec3 palette[5];
  vec3 paletteColor(float index) {
    int i = int(index + 0.5);
    if (i == 0) return palette[0];
    if (i == 1) return palette[1];
    if (i == 2) return palette[2];
    if (i == 3) return palette[3];
    return palette[4];
  }
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  // Addytywne źródło światła (premultipliedAlpha: ONE, ONE). Alfa = luminancja: w masce
  // bloomu kompozycja kładzie poświatę „over” z tą alfą; pełna alfa zastępowałaby
  // ostry punkt rozmytą (ciemniejszą) wersją, a halo przyciemniałoby niebo.
  vec4 glowOut(vec3 rgb) {
    return vec4(rgb, clamp(max(rgb.r, max(rgb.g, rgb.b)) * 0.3, 0.0, 1.0));
  }
`;

// --- Wieżowce ---------------------------------------------------------------

const buildingVertex = /* glsl */ `
  attribute vec4 params;   // seed, kind, windowColor, lit
  attribute vec4 params2;  // accent, tone, -, -
  varying vec3 vWorld;
  varying vec3 vLocal;
  varying vec3 vNormalL;
  varying vec3 vSize;
  varying vec4 vParams;
  varying vec4 vParams2;
  void main() {
    vec4 p = vec4(position, 1.0);
    mat4 m = modelMatrix;
    #ifdef USE_INSTANCING
      m = modelMatrix * instanceMatrix;
      vSize = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
    #else
      vSize = vec3(1.0);
    #endif
    vWorld = (m * p).xyz;
    vLocal = position * vSize;
    vNormalL = normal;
    vParams = params;
    vParams2 = params2;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
  }
`;

/** Wspólny kod okien: maska, oświetlenie i kolor (rytm pięter, nie szum). */
const buildingCommon = /* glsl */ `
  ${paletteGlsl}
  uniform float floorY;
  uniform float time;
  uniform float windowEmission;
  varying vec3 vWorld;
  varying vec3 vLocal;
  varying vec3 vNormalL;
  varying vec3 vSize;
  varying vec4 vParams;
  varying vec4 vParams2;
  const vec2 pitch = vec2(2.6, 3.4);
  float windowMask;
  float windowLit;
  vec3 windowTint;
  float accentMask;
  vec3 accentTint;
  void computeWindows() {
    windowMask = 0.0; windowLit = 0.0; accentMask = 0.0;
    windowTint = paletteColor(vParams.z);
    accentTint = paletteColor(max(vParams2.x, 0.0));
    bool side = abs(vNormalL.x) > 0.5;
    bool roof = abs(vNormalL.y) > 0.5;
    float halfW = side ? vSize.z * 0.5 : vSize.x * 0.5;
    float u = side ? vLocal.z : vLocal.x;
    float v = vWorld.y - floorY;           // wysokość nad ulicą
    float topY = vLocal.y + vSize.y * 0.5; // wysokość od podstawy bryły
    float fromTop = vSize.y - topY;
    if (vParams.y > 0.5 || roof) return;  // maszt, dach
    // Neonowy wieniec pod dachem i krawędzie narożników (tylko wybrane wieże).
    if (vParams2.x >= 0.0) {
      float band = step(1.2, fromTop) * step(fromTop, 1.9);
      float edge = step(halfW - 0.3, abs(u)) * step(fromTop, vSize.y * 0.6) * step(3.5, vParams2.z);
      accentMask = max(band, edge * 0.7);
    }
    // Siatka okien w metrach od środka ściany; parzyste rozmieszczenie kolumn.
    vec2 coord = vec2(u / pitch.x + 0.5, v / pitch.y);
    vec2 cell = floor(coord);
    vec2 f = fract(coord);
    float cols = floor((halfW * 2.0 - 1.6) / pitch.x);
    float inside = step(abs(cell.x) - 0.5, cols * 0.5 - 0.5) * step(1.0, cell.y) * step(2.6, fromTop);
    vec2 fw = fwidth(coord);
    vec2 lo = vec2(0.3, 0.3), hi = vec2(0.7, 0.72);
    vec2 aa = max(fw, vec2(1e-4));
    vec2 box = smoothstep(lo - aa, lo + aa, f) * (1.0 - smoothstep(hi - aa, hi + aa, f));
    float sharp = box.x * box.y;
    float area = (hi.x - lo.x) * (hi.y - lo.y);
    // Daleko komórka mieści się w pikselu: średnie pokrycie zamiast migotania.
    float far = smoothstep(0.35, 0.9, max(fw.x, fw.y));
    windowMask = mix(sharp, area, far) * inside;
    // Rytm: całe piętra zgaszone, oświetlone ciągi 2–5 okien, nie pojedyncze piksele.
    float seed = vParams.x * 97.0;
    float row = hash12(vec2(seed, cell.y));
    float runLen = 2.0 + floor(hash12(vec2(cell.y, seed + 3.1)) * 4.0);
    float run = floor((cell.x + 40.0) / runLen);
    float runHash = hash12(vec2(run + seed, cell.y * 1.7 + 11.0));
    float rowOn = step(0.18, row);
    windowLit = rowOn * step(runHash, vParams.w);
    // Pojedyncze okna w innym odcieniu (bursztyn / błękit) ożywiają ciepłą biel.
    float odd = hash12(cell + seed);
    if (odd > 0.93) windowTint = paletteColor(odd > 0.975 ? 2.0 : 0.0);
    windowTint *= 0.4 + 0.6 * hash12(cell * 1.3 + seed);
  }
`;

const buildingFragment = /* glsl */ `
  ${buildingCommon}
  uniform vec3 wall;
  uniform vec3 uplight;
  void main() {
    computeWindows();
    float tone = vParams2.y;
    vec3 n = vNormalL;
    // Ściana frontowa (do pokoju) jaśniejsza od bocznych: czytelna bryła bez świateł.
    float face = abs(n.z) > 0.5 ? 1.0 : 0.72;
    if (abs(n.y) > 0.5) face = 0.45;
    float v = vWorld.y - floorY;
    vec3 col = wall * tone * face;
    // Łuna miasta od dołu: ciepłe podświetlenie dolnych pięter.
    col += uplight * 0.06 * exp(-max(v, 0.0) / 22.0) * tone;
    // Delikatne pasy stropów (poziomy rytm także przy zgaszonych oknach).
    col *= 1.0 - 0.18 * step(0.92, fract(v / pitch.y)) * step(0.5, 1.0 - abs(n.y));
    col = mix(col, vec3(0.006, 0.008, 0.014), windowMask * (1.0 - windowLit));
    col += windowTint * windowLit * windowMask * windowEmission;
    col += accentTint * accentMask * 0.6;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

/** Wersja do maski bloomu i odbić: tylko światło okien i neonowe wieńce. */
const buildingGlowFragment = /* glsl */ `
  ${buildingCommon}
  void main() {
    computeWindows();
    float w = windowLit * windowMask;
    vec3 rgb = windowTint * w * 0.6 + accentTint * accentMask * 0.7;
    gl_FragColor = vec4(rgb, clamp(w * 0.16 + accentMask * 0.55, 0.0, 1.0));
    #include <colorspace_fragment>
  }
`;

export function createBuildingMaterial(uniforms: SkyUniforms): ShaderMaterial {
  const material = new ShaderMaterial({
    name: 'sky_buildings',
    uniforms,
    vertexShader: buildingVertex,
    fragmentShader: buildingFragment,
    toneMapped: false,
  });
  const glow = new ShaderMaterial({
    name: 'sky_buildings_glow',
    uniforms,
    vertexShader: buildingVertex,
    fragmentShader: buildingGlowFragment,
    toneMapped: false,
  });
  material.userData.bloom = true;
  material.userData.bloomMaterial = glow;
  material.addEventListener('dispose', () => glow.dispose());
  return material;
}

// --- Światła ostrzegawcze i pojazdy (billboardy) ----------------------------

const billboard = /* glsl */ `
  vec3 cameraRight() { return vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]); }
  vec3 cameraUp() { return vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]); }
  vec4 billboardClip(vec3 center, vec2 corner, float size, float minAngle) {
    float dist = length(center - cameraPosition);
    // Minimalny rozmiar kątowy: dalekie światło nadal ma kilka pikseli.
    float s = max(size, dist * minAngle);
    // Przesunięcie ku kamerze: światło na maszcie/dachu nie chowa się w bryle, na której stoi.
    vec3 world = center + normalize(cameraPosition - center) * s * 0.6
      + (cameraRight() * corner.x + cameraUp() * corner.y) * s;
    return projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;

const beaconVertex = /* glsl */ `
  attribute vec4 beacon; // size, period, phase, color
  uniform float time;
  varying vec2 vUv;
  varying float vOn;
  varying float vColor;
  ${billboard}
  void main() {
    vUv = uv * 2.0 - 1.0;
    vec3 center = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float t = beacon.y > 0.0 ? fract((time + beacon.z) / beacon.y) : 0.0;
    // Krótki błysk z miękkim wygaszeniem (światło przeszkodowe), poza nim słaba poświata.
    vOn = beacon.y > 0.0 ? 0.45 + 0.55 * (smoothstep(0.0, 0.04, t) * (1.0 - smoothstep(0.12, 0.34, t))) : 1.0;
    vColor = beacon.w;
    gl_Position = billboardClip(center, position.xy, beacon.x, 0.032);
  }
`;

const beaconFragment = /* glsl */ `
  ${paletteGlsl}
  uniform float beaconBrightness;
  varying vec2 vUv;
  varying float vOn;
  varying float vColor;
  void main() {
    float r = length(vUv);
    float core = 1.0 - smoothstep(0.1, 0.22, r);
    float halo = pow(max(1.0 - r, 0.0), 3.0) * 0.6;
    vec3 c = paletteColor(vColor);
    vec3 rgb = (c * halo + mix(c, vec3(1.0, 0.95, 0.85), 0.3) * core * 2.5) * vOn * beaconBrightness;
    gl_FragColor = glowOut(rgb);
    #include <colorspace_fragment>
  }
`;

export function createBeaconMaterial(uniforms: SkyUniforms): ShaderMaterial {
  const material = new ShaderMaterial({
    name: 'sky_beacons',
    uniforms,
    vertexShader: beaconVertex,
    fragmentShader: beaconFragment,
    toneMapped: false,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    premultipliedAlpha: true,
  });
  material.userData.bloom = true;
  return material;
}

const trafficVertex = /* glsl */ `
  attribute vec4 lane;  // radius, height, speed, phase
  attribute vec2 light; // przesunięcie wzdłuż toru [m], kolor (0 bursztyn, 1 ciepła biel)
  uniform float time;
  varying vec2 vUv;
  varying float vColor;
  varying float vFade;
  ${billboard}
  void main() {
    vUv = uv * 2.0 - 1.0;
    float a = lane.w + lane.z * time + light.x / lane.x;
    vec3 center = vec3(sin(a) * lane.x, lane.y + sin(time * 0.6 + lane.w * 3.0) * 0.8, cos(a) * lane.x);
    vColor = light.y;
    // Pojazd przelatuje odcinek łuku i gaśnie (znika za zabudową, nie krąży bez końca).
    float cycle = fract((lane.z * time + lane.w) * 0.35);
    vFade = smoothstep(0.0, 0.08, cycle) * (1.0 - smoothstep(0.55, 0.65, cycle));
    gl_Position = billboardClip(center, position.xy, 0.55, 0.02);
  }
`;

const trafficFragment = /* glsl */ `
  ${paletteGlsl}
  varying vec2 vUv;
  varying float vColor;
  varying float vFade;
  void main() {
    float r = length(vUv);
    float core = 1.0 - smoothstep(0.1, 0.25, r);
    float halo = pow(max(1.0 - r, 0.0), 3.0) * 0.4;
    vec3 c = vColor > 0.5 ? palette[1] : palette[0];
    gl_FragColor = glowOut(c * (core * 1.8 + halo) * vFade);
    #include <colorspace_fragment>
  }
`;

export function createTrafficMaterial(uniforms: SkyUniforms): ShaderMaterial {
  const material = new ShaderMaterial({
    name: 'sky_traffic',
    uniforms,
    vertexShader: trafficVertex,
    fragmentShader: trafficFragment,
    toneMapped: false,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    premultipliedAlpha: true,
  });
  material.userData.bloom = true;
  return material;
}

// --- Hologramy reklam -------------------------------------------------------

const holoVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const holoFragment = /* glsl */ `
  ${paletteGlsl}
  uniform float time;
  uniform vec3 tint;
  uniform float style;
  uniform float seed;
  uniform vec2 size;
  varying vec2 vUv;
  float glyphs(vec2 uv, vec2 grid) {
    vec2 cell = floor(uv * grid);
    vec2 f = fract(uv * grid);
    // Znak = 3x3 kreski w komórce; wybór losowy, zmiana co kilka sekund (rotacja reklam).
    float page = floor(time / 4.0 + seed);
    vec2 sub = floor(f * vec2(3.0, 3.0));
    float on = step(0.45, hash12(cell * 7.1 + sub * 1.3 + page + seed));
    vec2 inner = fract(f * 3.0);
    float stroke = step(0.15, inner.x) * step(inner.x, 0.85) * step(0.15, inner.y) * step(inner.y, 0.85);
    float margin = step(0.12, f.x) * step(f.x, 0.88) * step(0.1, f.y) * step(f.y, 0.9);
    return on * stroke * margin;
  }
  void main() {
    vec2 uv = vUv;
    float edge = smoothstep(0.0, 0.03, uv.x) * smoothstep(0.0, 0.03, 1.0 - uv.x) * smoothstep(0.0, 0.03, uv.y) * smoothstep(0.0, 0.03, 1.0 - uv.y);
    float frame = 1.0 - step(0.025, uv.x) * step(uv.x, 0.975) * step(0.02, uv.y) * step(uv.y, 0.98);
    float content = 0.0;
    if (style < 0.5) {
      // Pionowy pas znaków (jak neon na wieżowcu).
      float rows = floor(size.y / size.x * 1.0 + 0.5);
      content = glyphs(vec2(0.5, uv.y), vec2(1.0, max(rows, 3.0))) * step(0.2, uv.x) * step(uv.x, 0.8);
      content = max(content, glyphs(vec2((uv.x - 0.2) / 0.6, uv.y), vec2(1.0, max(rows, 3.0))) * step(0.2, uv.x) * step(uv.x, 0.8));
    } else if (style < 1.5) {
      // Szeroki baner: linia znaków i przesuwające się pasy.
      content = glyphs(vec2(fract(uv.x + time * 0.03), uv.y), vec2(7.0, 1.0)) * step(0.3, uv.y) * step(uv.y, 0.85);
      content = max(content, step(0.12, uv.y) * step(uv.y, 0.2) * step(0.5, fract(uv.x * 14.0 - time * 1.5)) * 0.6);
    } else {
      // Znak: pierścień z pionową kreską (abstrakcyjne logo), pod nim napis.
      vec2 c = (uv - vec2(0.5, 0.62)) * vec2(size.x / size.y, 1.0);
      float r = length(c);
      content = smoothstep(0.24, 0.22, r) * smoothstep(0.17, 0.19, r);
      content = max(content, step(abs(c.x), 0.03) * step(r, 0.22));
      content = max(content, glyphs(vec2(uv.x, (uv.y - 0.12) / 0.2), vec2(5.0, 1.0)) * step(0.12, uv.y) * step(uv.y, 0.32));
    }
    float scan = 0.72 + 0.28 * step(0.45, fract(uv.y * size.y * 1.5 - time * 0.8));
    float flicker = 0.85 + 0.15 * step(0.08, fract(sin(floor(time * 9.0) + seed) * 43758.5453));
    // Rzadki zanik całego panelu (zakłócenie projektora).
    float glitch = 1.0 - 0.7 * step(0.985, hash12(vec2(floor(time * 3.0), seed)));
    float body = 0.08 + content * 0.9 + frame * 0.55;
    vec3 rgb = tint * body * scan * flicker * glitch * edge;
    gl_FragColor = glowOut(rgb);
    #include <colorspace_fragment>
  }
`;

export function createAdMaterial(
  uniforms: SkyUniforms,
  color: number,
  style: number,
  seed: number,
  width: number,
  height: number,
): ShaderMaterial {
  const tint = new Color(SKY_PALETTE[color] ?? SKY_PALETTE[0]).multiplyScalar(
    1.4,
  );
  const material = new ShaderMaterial({
    name: 'sky_ad',
    uniforms: {
      ...uniforms,
      tint: { value: tint },
      style: { value: style },
      seed: { value: seed },
      size: { value: new Vector2(width, height) },
    },
    vertexShader: holoVertex,
    fragmentShader: holoFragment,
    toneMapped: false,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    premultipliedAlpha: true,
  });
  material.userData.bloom = true;
  return material;
}

// --- Niebo: łuna miasta i chmury podświetlone od dołu -----------------------

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 clip = projectionMatrix * viewMatrix * vec4(cameraPosition + position * 100.0, 1.0);
    // Zawsze za całą geometrią sceny (bez zapisu głębi: kompozycja traktuje to jako niebo).
    clip.z = clip.w * 0.99999;
    gl_Position = clip;
  }
`;

const skyFragment = /* glsl */ `
  uniform float time;
  uniform vec3 glowLow;
  uniform vec3 glowHigh;
  uniform float glowStrength;
  uniform float cloudStrength;
  uniform float cloudSpeed;
  varying vec3 vDir;
  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
    return s;
  }
  void main() {
    vec3 d = normalize(vDir);
    float el = d.y;
    float az = atan(d.x, d.z);
    // Łuna: najjaśniejsza tuż nad horyzontem, nierówna w azymucie (dzielnice).
    float hot = 0.6 + 0.4 * (0.5 + 0.5 * sin(az * 2.0 + 2.6)) * (0.6 + 0.4 * sin(az * 5.0 - 0.7));
    float pos = max(el, 0.0);
    float band = exp(-pos * 7.0) * smoothstep(-0.12, 0.0, el);
    vec3 glow = mix(glowHigh * 0.05, glowLow * 0.085, exp(-pos * 16.0)) * band * hot * glowStrength;
    // Pokład chmur/smogu: rzut płaski, dryf w czasie.
    float h = max(el, 0.0) + 0.22;
    vec2 uv = d.xz / h * 1.1 + vec2(time * cloudSpeed, time * cloudSpeed * 0.37) * 6.0;
    float n = fbm(uv);
    float n2 = fbm(uv * 2.7 + 4.0);
    float cloud = smoothstep(0.42, 0.72, n * 0.75 + n2 * 0.25);
    // Spód chmur oświetlony od dołu przez miasto: ciepło przy horyzoncie, fiolet wyżej.
    float under = exp(-pos * 1.4);
    vec3 lit = mix(glowHigh * 0.07, glowLow * 0.13, exp(-pos * 5.0));
    vec3 clouds = lit * cloud * (0.25 + 0.75 * under) * cloudStrength * hot;
    // Przy samym horyzoncie rzut się ściska: wygaszamy, zostaje gładka łuna.
    clouds *= smoothstep(0.01, 0.12, el);
    gl_FragColor = vec4(glow + clouds, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createSkyMaterial(uniforms: SkyUniforms): ShaderMaterial {
  const material = new ShaderMaterial({
    name: 'sky_dome',
    uniforms,
    vertexShader: skyVertex,
    fragmentShader: skyFragment,
    toneMapped: false,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
  });
  material.userData.bloom = false;
  return material;
}
