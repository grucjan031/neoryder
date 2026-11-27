import type { horizonParameters } from './horizon';
import {
  Color,
  DepthTexture,
  HalfFloatType,
  Matrix3,
  Matrix4,
  Mesh,
  MeshNormalMaterial,
  NearestFilter,
  PlaneGeometry,
  ShaderMaterial,
  UnsignedIntType,
  Vector2,
  Vector3,
  WebGLRenderTarget,
} from 'three';
import type {
  Camera,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  Texture,
  WebGLRenderer,
} from 'three';
import type { EventBus } from '../core/events';
import { tuning } from '../core/tuning';
import { loadSettings } from '../core/save';
import { BloomPass } from './bloom';
import { getQuality } from './quality';
import { ReflectionPass, WetNormals } from './reflections';
import { surfaceTexture } from './surfaceTextures';
import { FullscreenPass, fullscreenVertex } from './fullscreen';
import { syncMaterials } from './materials';
import { hideNoOutline } from './noOutline';
import { PostFxPass, PostFxState } from './postFx';
import {
  hasViewmodel,
  renderWithViewmodel,
  viewmodelNear,
} from './viewmodelLayer';
import { frameProfiler } from './frameProfiler';

/** Ustawienia konturu zależnego od odległości (pola z `tuning.render`). */
export interface OutlineFade {
  outlineFadeNear: number;
  outlineFadeFar: number;
  outlineFarNormal: number;
  outlineFarOuter: number;
}

/**
 * Odpowiednik shadera kompozycji (TS, do testów i strojenia): mnożniki linii w odległości `depth` m.
 * `normal` — siła linii wewnątrz bryły; `depthInside` — siła obrysu sylwetki po stronie obiektu
 * (po stronie tła obrys zostaje zawsze pełny).
 */
export function outlineFadeAt(
  depth: number,
  fade: OutlineFade,
): { far: number; normal: number; depthInside: number } {
  const far = smoothstep(
    fade.outlineFadeNear,
    Math.max(fade.outlineFadeFar, fade.outlineFadeNear + 1e-3),
    depth,
  );
  return {
    far,
    normal: 1 - far * (1 - fade.outlineFarNormal),
    depthInside: 1 - far * fade.outlineFarOuter,
  };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

type InkParameters = Pick<
  typeof tuning.render,
  | 'inkWidth'
  | 'inkRefDistanceM'
  | 'inkMinScale'
  | 'inkNearScale'
  | 'inkDilationMinPx'
  | 'inkFadeNearM'
  | 'inkFadeFarM'
  | 'inkNormalScale'
  | 'inkNormalFadeNearM'
  | 'inkNormalFadeFarM'
>;

/** Odpowiednik formuł tuszu świata w shaderze; promienie w px, głębia w metrach. */
export function inkAt(depth: number, ink: InkParameters) {
  const radius =
    ink.inkWidth *
    Math.min(
      ink.inkNearScale,
      Math.max(ink.inkMinScale, ink.inkRefDistanceM / Math.max(depth, 1e-3)),
    );
  const normalRadius = radius * ink.inkNormalScale;
  const opacity =
    1 -
    smoothstep(
      ink.inkFadeNearM,
      Math.max(ink.inkFadeFarM, ink.inkFadeNearM + 1e-3),
      depth,
    );
  return {
    radius,
    normalRadius,
    dilation: radius < ink.inkDilationMinPx ? 0 : radius,
    normalDilation: normalRadius < ink.inkDilationMinPx ? 0 : normalRadius,
    opacity,
    normalOpacity:
      opacity *
      (1 -
        smoothstep(
          ink.inkNormalFadeNearM,
          Math.max(ink.inkNormalFadeFarM, ink.inkNormalFadeNearM + 1e-3),
          depth,
        )),
  };
}

const inkShader = /* glsl */ `
  uniform float inkWidth;
  uniform float inkNearScale;
  uniform float inkRefDistanceM;
  uniform float inkMinScale;
  uniform float inkDilationMinPx;
  uniform float inkFadeNearM;
  uniform float inkFadeFarM;
  uniform float inkNormalScale;
  uniform float inkNormalFadeNearM;
  uniform float inkNormalFadeFarM;
  uniform float inkViewmodelWidth;
  uniform float inkViewmodelMaxRadiusPx;

  float inkRadiusAt(float depth) {
    return inkWidth * clamp(inkRefDistanceM / max(depth, 1e-3), inkMinScale, inkNearScale);
  }
  vec2 inkOpacityAt(float depth) {
    float outer = 1.0 - smoothstep(inkFadeNearM, max(inkFadeFarM, inkFadeNearM + 1e-3), depth);
    float inner = 1.0 - smoothstep(inkNormalFadeNearM, max(inkNormalFadeFarM, inkNormalFadeNearM + 1e-3), depth);
    return vec2(outer, outer * inner);
  }
`;

const layerDepthShader = /* glsl */ `
  uniform sampler2D depthMap;
  uniform sampler2D viewmodelNormalDepthMap;
  uniform sampler2D viewmodelColorDepthMap;
  uniform bool viewmodelActive;
  uniform float cameraNear;
  uniform float cameraFar;
  uniform float viewmodelNear;
  uniform bool perspective;

  float layerDepth(vec2 uv) {
    // Ujemna wartość identyfikuje piksel viewmodelu niezależnie od głębi świata.
    if (viewmodelActive) {
      float depth = texture2D(viewmodelNormalDepthMap, uv).x;
      if (depth < 1.0) return depth - 1.0;
    }
    return texture2D(depthMap, uv).x;
  }

  // Piksel viewmodelu w kolorze (głębia koloru < 1), także z obiektów bez konturu.
  bool viewmodelColorAt(vec2 uv) {
    return viewmodelActive && texture2D(viewmodelColorDepthMap, uv).x < 1.0;
  }

  // Obiekt viewmodelu bez konturu (rdzeń ostrza, błysk) zasłania bryłę z konturem lub świat:
  // jego głębia koloru jest wyraźnie bliżej niż głębia bufora normalnych. Tam nie ma linii.
  bool inkSuppressedAt(vec2 uv) {
    if (!viewmodelColorAt(uv)) return false;
    return texture2D(viewmodelColorDepthMap, uv).x <
      texture2D(viewmodelNormalDepthMap, uv).x - 5e-4;
  }

  float metricDepth(float depth) {
    float near = depth < 0.0 ? viewmodelNear : cameraNear;
    float raw = depth < 0.0 ? depth + 1.0 : depth;
    return -(perspective
      ? perspectiveDepthToViewZ(raw, near, cameraFar)
      : orthographicDepthToViewZ(raw, near, cameraFar));
  }
`;

/**
 * Poprawka na płaszczyznę: o ile względnie zmienia się głębia (z_s / z_c - 1) w innym piksełu, jeśli
 * obie próbki leżą na płaszczyźnie o normalnej `n` (przestrzeń widoku) przechodzącej przez piksel
 * środkowy. Promień widoku r = (u, v, -1), z = d / (n · r). Bez tego posadzka widziana pod bardzo
 * małym kątem (oko tuż nad jej poziomem) ma duży względny skok głębi między pikselami i cały pas
 * przy horyzoncie dostaje kontur. Zwraca 0, gdy płaszczyzny nie da się przewidzieć.
 */
export function planeDepthDelta(
  normal: readonly [number, number, number],
  rayCenter: readonly [number, number, number],
  raySample: readonly [number, number, number],
  limit: number,
): number {
  const center =
    normal[0] * rayCenter[0] +
    normal[1] * rayCenter[1] +
    normal[2] * rayCenter[2];
  const sample =
    normal[0] * raySample[0] +
    normal[1] * raySample[1] +
    normal[2] * raySample[2];
  if (center * sample <= 1e-8) return 0;
  return Math.min(Math.max(center / sample - 1, -limit), limit);
}

const planeShader = /* glsl */ `
  uniform mat4 inverseProjection;
  uniform float planeDeltaLimit;
  vec3 viewRayAt(vec2 uv) {
    return vec3((uv * 2.0 - 1.0) * vec2(inverseProjection[0][0], inverseProjection[1][1]), -1.0);
  }
  // Lustro planeDepthDelta (TS, testy).
  float planeDepthDelta(vec3 n, vec3 rayCenter, vec2 uv) {
    float center = dot(n, rayCenter);
    float sampleCos = dot(n, viewRayAt(uv));
    if (center * sampleCos <= 1e-8) return 0.0;
    return clamp(center / sampleCos - 1.0, -planeDeltaLimit, planeDeltaLimit);
  }
`;

const fragmentShader = /* glsl */ `
  #include <packing>
  ${inkShader}
  ${layerDepthShader}
  uniform sampler2D colorMap;
  uniform sampler2D colorDepthMap;
  uniform sampler2D normalMap;
  uniform vec2 texelSize;
  uniform float thickness;
  uniform float depthThreshold;
  uniform float normalThreshold;
  uniform float outlineFadeNear;
  uniform float outlineFadeFar;
  uniform float outlineFarNormal;
  uniform float outlineFarOuter;
  uniform vec3 outlineColor;
  uniform sampler2D bloomMap;
  uniform float bloomStrength;
  uniform mat3 cameraRotation;
  uniform float fogStrength;
  uniform float skyFlash;
  uniform vec3 skyFlashColor;
  uniform float fogNear;
  uniform float fogFar;
  uniform vec3 fogColor;
  uniform mat4 cameraWorld;
  uniform vec3 eyePosition;
  uniform float floorY;
  uniform float heightFogDensity;
  uniform float heightFogFalloff;
  uniform sampler2D reflectionMap;
  uniform mat4 reflectionProjection;
  uniform float reflectionStrength;
  uniform float reflectionDistortion;
  uniform float reflectionPuddles;
  uniform float floorTolerance;
  uniform sampler2D puddleMap;
  uniform float puddleReady;
  uniform float renderTime;
  uniform float aspect;
  uniform float vignetteStrength;
  uniform float vignetteRadius;
  uniform float vignetteSoftness;
  uniform sampler2D edgeMap;
  uniform float celBands;
  uniform float celStrength;
  uniform float hatchStrength;
  uniform float hatchThreshold;
  uniform float hatchSpacing;
  uniform float paintStrength;
  varying vec2 vUv;

  vec3 normalAt(vec2 uv) {
    return texture2D(normalMap, uv).xyz * 2.0 - 1.0;
  }
  ${planeShader}

  // Głębia źródła maski, nie tła, ogranicza grubość dylatacji dalekiej sylwetki.
  vec2 inkSample(vec2 uv, float distancePx) {
    vec4 sampleEdge = texture2D(edgeMap, uv);
    vec2 radius = inkRadiusAt(sampleEdge.a) * vec2(1.0, inkNormalScale);
    return sampleEdge.rg * step(vec2(inkDilationMinPx), radius) * step(vec2(distancePx), radius + 1e-3);
  }

  float hash3(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float valueNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x),
                   mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x),
                   mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
  }

  void main() {
    float rawDepth = layerDepth(vUv);
    float centerDepth = max(metricDepth(rawDepth), 1e-4);
    vec2 offset = texelSize * thickness;
    float dx = 0.0;
    float dy = 0.0;
    vec3 nx = vec3(0.0);
    vec3 ny = vec3(0.0);
    float nearest = centerDepth;
    // Najbliższa próbka po odjęciu płaszczyzny środka (względem środka, <= 0).
    float closest = 0.0;
    bool planar = perspective && rawDepth >= 0.0 && rawDepth < 1.0;
    vec3 centerNormal = planar ? normalAt(vUv) : vec3(0.0);
    vec3 centerRay = viewRayAt(vUv);
    bool viewmodelInk = rawDepth < 0.0;
    bool viewmodelColor = viewmodelColorAt(vUv);
    bool layerEdge = false;
    float inkReach = max(inkWidth, inkViewmodelWidth) * inkNearScale;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 uv = vUv + vec2(float(x), float(y)) * offset;
        float wx = float(x) * (y == 0 ? 2.0 : 1.0);
        float wy = float(y) * (x == 0 ? 2.0 : 1.0);
        // Różnica względem środka ogranicza utratę precyzji daleko od kamery.
        float sampleRawDepth = layerDepth(uv);
        layerEdge = layerEdge || ((rawDepth < 0.0) != (sampleRawDepth < 0.0));
        float sampleDepth = metricDepth(sampleRawDepth);
        nearest = min(nearest, sampleDepth);
        float depth = (sampleDepth - centerDepth) / centerDepth;
        if (planar && sampleRawDepth >= 0.0 && sampleRawDepth < 1.0)
          depth -= planeDepthDelta(centerNormal, centerRay, uv);
        closest = min(closest, depth);
        dx += depth * wx;
        dy += depth * wy;
        nx += normalAt(uv) * wx;
        ny += normalAt(uv) * wy;
        if (inkWidth > 0.0) {
          // Szukamy głębi obiektu również po zewnętrznej stronie grubego obrysu.
          vec2 probe = vUv + vec2(float(x), float(y)) * texelSize * inkReach;
          float probeDepth = layerDepth(probe);
          nearest = min(nearest, metricDepth(probeDepth));
          float probeRel = (metricDepth(probeDepth) - centerDepth) / centerDepth;
          if (planar && probeDepth >= 0.0 && probeDepth < 1.0)
            probeRel -= planeDepthDelta(centerNormal, centerRay, probe);
          closest = min(closest, probeRel);
          viewmodelInk = viewmodelInk || probeDepth < 0.0 || sampleRawDepth < 0.0;
        }
      }
    }
    float depthEdge = length(vec2(dx, dy)) / 8.0;
    float normalEdge = sqrt(dot(nx, nx) + dot(ny, ny)) / 8.0;
    // Z odległością linie wewnątrz bryły (normalne) gasną, a obrys sylwetki (głębia) przechodzi
    // na stronę tła: cienkie kończyny dalekich wrogów zostają w swoim kolorze zamiast w kolorze linii.
    float far = smoothstep(outlineFadeNear, max(outlineFadeFar, outlineFadeNear + 1e-3), centerDepth);
    float behind = step(depthThreshold, -closest);
    float depthLine = layerEdge ? 1.0 : step(depthThreshold, depthEdge) * mix(1.0, behind, far * outlineFarOuter);
    float normalLine = step(normalThreshold, normalEdge) * (1.0 - far * (1.0 - outlineFarNormal));
    float edge = max(depthLine, normalLine);
    if (thickness <= 0.0) edge = 0.0;
    if (inkWidth > 0.0 && thickness > 0.0) {
      if (viewmodelInk) {
        // Dotychczasowy tusz FPP, także po stronie tła: bez skalowania i nowego wygaszania.
        // Odległość strony viewmodelu: po stronie tła głębia środka byłaby głębią świata za ręką.
        float inkNear = 1.0 - smoothstep(outlineFadeNear * 0.5, max(outlineFadeFar, outlineFadeNear * 0.5 + 1e-3), nearest);
        float radius = inkViewmodelWidth * mix(1.0, inkNearScale, inkNear);
        if (rawDepth < 0.0) radius = min(radius, inkViewmodelMaxRadiusPx);
        float ink = edge;
        float hits = 0.0;
        for (int i = 0; i < 12; i++) {
          float a = float(i) * 0.5235988;
          vec2 dir = vec2(cos(a), sin(a)) * texelSize;
          float outer = texture2D(edgeMap, vUv + dir * radius).b;
          float inner = texture2D(edgeMap, vUv + dir * radius * 0.5).b;
          ink = max(ink, max(outer, inner));
          hits += outer + inner;
        }
        edge = max(edge, ink * (1.0 - smoothstep(0.5, 0.8, hits / 24.0)));
      } else {
        vec2 radius = inkRadiusAt(nearest) * vec2(1.0, inkNormalScale);
        vec2 core = texture2D(edgeMap, vUv).rg;
        vec2 ink = core;
        vec2 hits = vec2(0.0);
        for (int i = 0; i < 12; i++) {
          float a = float(i) * 0.5235988;
          vec2 dir = vec2(cos(a), sin(a)) * texelSize;
          vec2 outer = vec2(0.0);
          vec2 inner = vec2(0.0);
          if (radius.x >= inkDilationMinPx) {
            outer.x = inkSample(vUv + dir * radius.x, radius.x).r;
            inner.x = inkSample(vUv + dir * radius.x * 0.5, radius.x * 0.5).r;
          }
          if (radius.y >= inkDilationMinPx) {
            outer.y = inkSample(vUv + dir * radius.y, radius.y).g;
            inner.y = inkSample(vUv + dir * radius.y * 0.5, radius.y * 0.5).g;
          }
          ink = max(ink, max(outer, inner));
          hits += outer + inner;
        }
        // Gęste detale zachowują samą maskę 1 px; każdy kanał ma własny promień i krycie.
        ink = max(core, ink * (1.0 - smoothstep(vec2(0.5), vec2(0.8), hits / 24.0)));
        edge = max(ink.r, ink.g);
      }
    }
    if (viewmodelColor && inkSuppressedAt(vUv)) edge = 0.0;
    vec4 color = texture2D(colorMap, vUv);
    vec3 rgb = color.rgb;
    vec3 line = outlineColor;
    bool worldSurface = rawDepth >= 0.0 && rawDepth < 1.0 && !viewmodelColor;
    vec3 worldPoint = vec3(0.0);
    if (worldSurface) {
      vec4 viewPoint = inverseProjection * vec4(vUv*2.0-1.0, rawDepth*2.0-1.0, 1.0);
      worldPoint = (cameraWorld * vec4(viewPoint.xyz / viewPoint.w,1.0)).xyz;
    }
    if (reflectionStrength > 0.0 && worldSurface) {
      float wet = texture2D(normalMap,vUv).a;
      vec3 worldNormal = cameraRotation * normalAt(vUv);
      float floorMask = step(0.9,worldNormal.y) * (1.0-smoothstep(floorTolerance*0.5,floorTolerance,abs(worldPoint.y-floorY)));
      vec4 projected = reflectionProjection * vec4(worldPoint,1.0);
      vec2 reflectionUv = (projected.w > 1e-4 ? projected.xy/projected.w : vec2(-1.0))*0.5+0.5;
      vec2 wave = vec2(sin(worldPoint.z*19.0+renderTime*2.3),sin(worldPoint.x*23.0-renderTime*1.7));
      reflectionUv += wave * reflectionDistortion * 0.35;
      float inside = step(0.0,reflectionUv.x)*step(reflectionUv.x,1.0)*step(0.0,reflectionUv.y)*step(reflectionUv.y,1.0)*step(0.0,projected.w);
      float puddle = smoothstep(-0.5,0.6,sin(worldPoint.x*1.8+sin(worldPoint.z*0.9))*cos(worldPoint.z*1.1));
      if (puddleReady > 0.5) puddle = texture2D(puddleMap,worldPoint.xz*0.25).r;
      puddle = mix(1.0,0.18+0.82*puddle,reflectionPuddles);
      float fresnel = 0.25+0.75*pow(1.0-abs(normalize(eyePosition-worldPoint).y),3.0);
      rgb += texture2D(reflectionMap,reflectionUv).rgb * reflectionStrength * wet * floorMask * puddle * fresnel * inside;
    }
    if ((celStrength > 0.0 || hatchStrength > 0.0 || paintStrength > 0.0) &&
        worldSurface) {
      float luma = dot(rgb, vec3(0.299, 0.587, 0.114));
      float hi = max(max(rgb.r, rgb.g), rgb.b);
      float lo = min(min(rgb.r, rgb.g), rgb.b);
      float saturation = hi > 1e-3 ? (hi - lo) / hi : 0.0;
      // Wrogowie, neony i efekty (nasycone lub jasne) zostają czyste.
      float plain = (1.0 - smoothstep(0.45, 0.7, saturation)) * (1.0 - smoothstep(0.75, 0.95, luma));
      if (celStrength > 0.0 && celBands > 0.0 && luma > 1e-3) {
        // Pasma tylko przyciemniają (dół pasma): cienie robią się płaskie i ciemne, nie mgliste.
        // Tylko cienie i półcienie — jasne gradienty świateł (lampy, plamy światła) zostają
        // miękkie, inaczej robią się z nich koncentryczne pierścienie.
        float shadowOnly = 1.0 - smoothstep(0.38, 0.55, luma);
        // Krótkie, miękkie przejście między pasmami (a nie skok o 1 px) i łagodniejszy dół:
        // płaskie plamy na bryłach, bez twardych pierścieni na gradientach światła.
        float bandT = luma * celBands;
        float bandStep = floor(bandT) + smoothstep(0.78, 1.0, fract(bandT));
        float banded = max(bandStep / celBands, luma * 0.6);
        rgb *= mix(1.0, min(banded / luma, 1.0), celStrength * plain * shadowOnly);
      }
      if (paintStrength > 0.0) {
        float blot = valueNoise(worldPoint * 1.7) * 0.6 + valueNoise(worldPoint * 6.0) * 0.4;
        rgb *= 1.0 + (blot - 0.5) * paintStrength * plain;
      }
      if (hatchStrength > 0.0) {
        // Kreski tuszem tylko w półcieniach (nie w czerni i nie w świetle), rzadkie i grube.
        float mid = smoothstep(hatchThreshold * 0.25, hatchThreshold * 0.6, luma)
          * (1.0 - smoothstep(hatchThreshold * 0.8, hatchThreshold * 1.4, luma));
        vec2 px = gl_FragCoord.xy / max(hatchSpacing, 1.0);
        float stroke = abs(fract(px.x * 0.7 + px.y) - 0.5) * 2.0;
        float wobble = valueNoise(vec3(gl_FragCoord.xy * 0.02, 0.0));
        float hatch = (1.0 - smoothstep(0.18, 0.32, stroke)) * mid * step(0.35, wobble);
        rgb = mix(rgb, outlineColor, hatch * hatchStrength * plain);
      }
    }
    // Brak geometrii w buforze głębi koloru = niebo. Gradient nieba jest już w buforze koloru
    // (tło rysowane w przebiegu koloru przed obiektami przezroczystymi, skyBackgroundFragment),
    // więc hologramy, deszcz i viewmodel na niebie mają poprawne krycie; tu tylko błysk burzy
    // i brak mgły. Głębia koloru, nie normalnych: obiekty bez konturu (rdzeń ostrza, błysk)
    // nie trafiają do bufora normalnych i bez tego znikały na tle nieba.
    if (!viewmodelColor && texture2D(colorDepthMap, vUv).x >= 1.0) {
      rgb += skyFlashColor * skyFlash;
    } else if ((fogStrength > 0.0 || heightFogDensity > 0.0) && worldSurface && !viewmodelColor) {
      // Mgła ku bieli ściąga też kontury, więc dalekie obiekty odcinają się od bliskich.
      float fog = smoothstep(fogNear, fogFar, centerDepth) * fogStrength;
      // Ca?ka g?sto?ci wzd?u? promienia: stabilna tak?e dla poziomego spojrzenia.
      if (heightFogDensity > 0.0) {
        float eyeHeight = max(eyePosition.y-floorY,0.0);
        float pointHeight = max(worldPoint.y-floorY,0.0);
        float heightDelta = (pointHeight-eyeHeight)*heightFogFalloff;
        float integratedDensity = abs(heightDelta)<0.001 ? exp(-eyeHeight*heightFogFalloff)
          : (exp(-eyeHeight*heightFogFalloff)-exp(-pointHeight*heightFogFalloff))/heightDelta;
        float heightFog = 1.0-exp(-heightFogDensity*length(worldPoint-eyePosition)*integratedDensity);
        fog = 1.0-(1.0-fog)*(1.0-heightFog);
      }
      vec3 flashedFog = fogColor + skyFlashColor * skyFlash;
      rgb = mix(rgb, flashedFog, fog);
      // Zewnętrzny obrys rąk leży na tle, ale należy do viewmodelu: nie blednie we mgle tła.
      if (!viewmodelInk) line = mix(line, flashedFog, fog);
    }
    if (inkWidth > 0.0) {
      // Świecące (neony, ostrze, efekty) zostają czyste: tusz ich nie zalewa. Tylko jasne
      // i nasycone — białe ściany i jasne niebo dostają normalny czarny tusz (inaczej
      // pogrubiony tusz na jasnym tle robi się bladoszarą aureolą).
      float glowMax = max(color.r, max(color.g, color.b));
      float glowMin = min(color.r, min(color.g, color.b));
      float glowSat = glowMax > 1e-3 ? (glowMax - glowMin) / glowMax : 0.0;
      edge *= 1.0 - smoothstep(0.7, 0.95, glowMax) * smoothstep(0.25, 0.5, glowSat);
    }
    rgb = mix(rgb, line, edge);
    if (bloomStrength > 0.0) {
      // Halo nakładane "over": widoczne także na bieli, która sama się nie rozmywa.
      vec4 glow = texture2D(bloomMap, vUv);
      rgb = rgb * (1.0 - clamp(glow.a * bloomStrength, 0.0, 1.0)) + glow.rgb * bloomStrength;
    }
    if (vignetteStrength > 0.0) {
      vec2 c = (vUv - 0.5) * vec2(aspect, 1.0);
      float radius = length(c) / length(vec2(aspect, 1.0)) * 2.0;
      rgb *= 1.0 - vignetteStrength * smoothstep(vignetteRadius, vignetteRadius + max(vignetteSoftness, 1e-3), radius);
    }
    gl_FragColor = vec4(rgb, color.a);
    #include <colorspace_fragment>
  }
`;

/**
 * Tło nieba w przebiegu koloru: pełnoekranowy quad na dalekiej płaszczyźnie (głębia NDC 1),
 * bez zapisu głębi. Test LEQUAL przepuszcza go tylko tam, gdzie nie ma geometrii
 * nieprzezroczystej; najniższy `renderOrder` stawia go przed wszystkimi obiektami
 * przezroczystymi, które mieszają się już z gradientem (nie z płaskim kolorem tła).
 * Alfa = `skyGradient`: przy 0 zostaje kolor tła sceny, jak wcześniej w kompozycji.
 */
export const SKY_BACKGROUND_ORDER = -1e9;
const skyBackgroundVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`;

/** Ostra maska krawędzi (1 px) dla tuszu komiksowego; pogrubiana w kompozycji. */
const edgeFragmentShader = /* glsl */ `
  #include <packing>
  ${inkShader}
  ${layerDepthShader}
  uniform sampler2D normalMap;
  uniform vec2 texelSize;
  uniform float depthThreshold;
  uniform float normalThreshold;
  uniform float outlineFadeNear;
  uniform float outlineFadeFar;
  uniform float outlineFarNormal;
  uniform float outlineFarOuter;
  varying vec2 vUv;
  vec3 normalAt(vec2 uv) { return texture2D(normalMap, uv).xyz * 2.0 - 1.0; }
  ${planeShader}
  void main() {
    float rawDepth = layerDepth(vUv);
    float centerDepth = max(metricDepth(rawDepth), 1e-4);
    float dx = 0.0; float dy = 0.0;
    vec3 nx = vec3(0.0); vec3 ny = vec3(0.0);
    float nearest = centerDepth;
    float closest = 0.0;
    bool planar = perspective && rawDepth >= 0.0 && rawDepth < 1.0;
    vec3 centerNormal = planar ? normalAt(vUv) : vec3(0.0);
    vec3 centerRay = viewRayAt(vUv);
    bool layerEdge = false;
    bool suppressed = inkSuppressedAt(vUv);
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 uv = vUv + vec2(float(x), float(y)) * texelSize;
        float wx = float(x) * (y == 0 ? 2.0 : 1.0);
        float wy = float(y) * (x == 0 ? 2.0 : 1.0);
        float sampleRawDepth = layerDepth(uv);
        layerEdge = layerEdge || ((rawDepth < 0.0) != (sampleRawDepth < 0.0));
        float sampleDepth = metricDepth(sampleRawDepth);
        nearest = min(nearest, sampleDepth);
        float depth = (sampleDepth - centerDepth) / centerDepth;
        if (planar && sampleRawDepth >= 0.0 && sampleRawDepth < 1.0)
          depth -= planeDepthDelta(centerNormal, centerRay, uv);
        closest = min(closest, depth);
        dx += depth * wx; dy += depth * wy;
        nx += normalAt(uv) * wx; ny += normalAt(uv) * wy;
      }
    }
    float depthEdge = length(vec2(dx, dy)) / 8.0;
    float normalEdge = sqrt(dot(nx, nx) + dot(ny, ny)) / 8.0;
    float far = smoothstep(outlineFadeNear, max(outlineFadeFar, outlineFadeNear + 1e-3), centerDepth);
    float behind = step(depthThreshold, -closest);
    float depthLine = layerEdge ? 1.0 : step(depthThreshold, depthEdge) * mix(1.0, behind, far * outlineFarOuter);
    float normalLine = step(normalThreshold, normalEdge) * (1.0 - far * (1.0 - outlineFarNormal));
    // R/G: sylwetka i detal osobno; B: dawny tusz FPP; A: metryczna głębia źródła.
    // Obrys na tle dziedziczy odległość najbliższej bryły zamiast odległości tła.
    // B (tusz viewmodelu) zawiera tylko linie po stronie viewmodelu: dalekie krawędzie tła
    // nie są pogrubiane wokół rąk. Piksele zasłonięte obiektem bez konturu nie mają linii.
    vec2 opacity = inkOpacityAt(nearest);
    float viewmodelLine = (rawDepth < 0.0 || layerEdge) ? max(depthLine, normalLine) : 0.0;
    if (suppressed) gl_FragColor = vec4(0.0, 0.0, 0.0, nearest);
    else gl_FragColor = vec4(depthLine * opacity.r, normalLine * opacity.g,
      viewmodelLine, nearest);
  }
`;

export const skyBackgroundFragment = /* glsl */ `
  uniform float skyGradient;
  uniform float skyHeight;
  uniform vec3 skyTop;
  uniform vec3 skyHorizon;
  uniform mat4 inverseProjection;
  uniform mat3 cameraRotation;
  varying vec2 vUv;
  void main() {
    vec4 view = inverseProjection * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
    float up = (cameraRotation * normalize(view.xyz / view.w)).y;
    vec3 sky = mix(skyHorizon, skyTop, smoothstep(0.0, skyHeight, up));
    gl_FragColor = vec4(sky, skyGradient);
    #include <colorspace_fragment>
  }
`;

/**
 * Kompiluje materiały tak, jak użyłby ich `renderer.render(scene, camera)` w bieżącym stanie
 * (cel, maska warstw kamery, `scene.overrideMaterial`). `compileAsync` sam widzi tylko własne
 * materiały obiektów, więc przy nadpisaniu (przebieg normalnych) podmienia je na czas wywołania.
 */
function compileForPass(
  renderer: WebGLRenderer,
  scene: Object3D,
  camera: Camera,
): Promise<unknown> {
  const override =
    'isScene' in scene ? (scene as Scene).overrideMaterial : null;
  if (!override) return renderer.compileAsync(scene, camera);
  const swapped: [Mesh, Mesh['material']][] = [];
  scene.traverseVisible((object) => {
    if (
      !('isMesh' in object || 'isPoints' in object || 'isLine' in object) &&
      !('isSprite' in object)
    )
      return;
    const drawable = object as Mesh;
    swapped.push([drawable, drawable.material]);
    drawable.material = override;
  });
  try {
    return renderer.compileAsync(scene, camera);
  } finally {
    for (const [drawable, material] of swapped) drawable.material = material;
  }
}

/**
 * Na czas jednego synchronicznego przebiegu rozgrzewki wyłącza odrzucanie poza kadrem, żeby
 * programy i tekstury obiektów poza polem widzenia kamery też trafiły na GPU. Zwraca funkcję
 * przywracającą poprzednie flagi (obiekty z własnym `frustumCulled = false` zostają bez zmian).
 */
function disableCulling(scene: Scene): () => void {
  const culled: Object3D[] = [];
  scene.traverse((object) => {
    if (object.frustumCulled) {
      object.frustumCulled = false;
      culled.push(object);
    }
  });
  return () => {
    for (const object of culled) object.frustumCulled = true;
  };
}

/**
 * Pipeline stylu: kolor + normalne/głębia (obrys Sobela, niebo, mgła), opcjonalnie bloom
 * selektywny, opcjonalnie końcowy pass kompozycji (winieta, impulsy obrażeń i Skupienia).
 */
export class StylePipeline {
  private readonly colorTarget = new WebGLRenderTarget(1, 1, {
    type: HalfFloatType,
    depthTexture: new DepthTexture(1, 1, UnsignedIntType),
  });
  private readonly normalTarget = new WebGLRenderTarget(1, 1, {
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    depthTexture: new DepthTexture(1, 1, UnsignedIntType),
  });
  private readonly viewmodelColorDepth = new DepthTexture(
    1,
    1,
    UnsignedIntType,
  );
  private readonly viewmodelNormalDepth = new DepthTexture(
    1,
    1,
    UnsignedIntType,
  );
  private readonly normalMaterial = new MeshNormalMaterial({
    toneMapped: false,
  });
  private readonly uniforms = {
    colorMap: { value: this.colorTarget.texture },
    colorDepthMap: { value: this.colorTarget.depthTexture as Texture },
    normalMap: { value: this.normalTarget.texture },
    depthMap: { value: this.normalTarget.depthTexture },
    viewmodelColorDepthMap: { value: this.colorTarget.depthTexture },
    viewmodelNormalDepthMap: { value: this.normalTarget.depthTexture },
    viewmodelActive: { value: false },
    texelSize: { value: new Vector2(1, 1) },
    thickness: { value: 1 },
    depthThreshold: { value: 0 },
    normalThreshold: { value: 0 },
    outlineFadeNear: { value: 0 },
    outlineFadeFar: { value: 1 },
    outlineFarNormal: { value: 1 },
    outlineFarOuter: { value: 0 },
    outlineColor: { value: new Color() },
    cameraNear: { value: 0.1 },
    cameraFar: { value: 100 },
    viewmodelNear: { value: tuning.camera.viewmodelNearM },
    perspective: { value: true },
    bloomMap: { value: this.colorTarget.texture as Texture },
    bloomStrength: { value: 0 },
    skyGradient: { value: 0 },
    skyHeight: { value: 0.5 },
    skyTop: { value: new Color() },
    skyHorizon: { value: new Color() },
    inverseProjection: { value: new Matrix4() },
    planeDeltaLimit: { value: 0 },
    cameraRotation: { value: new Matrix3() },
    fogStrength: { value: 0 },
    skyFlash: { value: 0 },
    skyFlashColor: { value: new Color() },
    fogNear: { value: 0 },
    fogFar: { value: 1 },
    fogColor: { value: new Color() },
    cameraWorld: { value: new Matrix4() },
    eyePosition: { value: new Vector3() },
    floorY: { value: 0 },
    heightFogDensity: { value: 0 },
    heightFogFalloff: { value: 0 },
    reflectionMap: { value: this.colorTarget.texture as Texture },
    reflectionProjection: { value: new Matrix4() },
    reflectionStrength: { value: 0 },
    reflectionDistortion: { value: 0 },
    reflectionPuddles: { value: 0 },
    floorTolerance: { value: 0.08 },
    puddleMap: { value: null as Texture | null },
    puddleReady: { value: 0 },
    renderTime: { value: 0 },
    aspect: { value: 1 },
    vignetteStrength: { value: 0 },
    vignetteRadius: { value: 0.55 },
    vignetteSoftness: { value: 0.6 },
    inkNearScale: { value: 1 },
    inkWidth: { value: 0 },
    inkRefDistanceM: { value: tuning.render.inkRefDistanceM },
    inkMinScale: { value: tuning.render.inkMinScale },
    inkDilationMinPx: { value: tuning.render.inkDilationMinPx },
    inkFadeNearM: { value: tuning.render.inkFadeNearM },
    inkFadeFarM: { value: tuning.render.inkFadeFarM },
    inkNormalScale: { value: tuning.render.inkNormalScale },
    inkNormalFadeNearM: { value: tuning.render.inkNormalFadeNearM },
    inkNormalFadeFarM: { value: tuning.render.inkNormalFadeFarM },
    inkViewmodelWidth: { value: tuning.render.inkViewmodelWidth },
    inkViewmodelMaxRadiusPx: { value: tuning.render.inkViewmodelMaxRadiusPx },
    edgeMap: { value: null as Texture | null },
    celBands: { value: 0 },
    celStrength: { value: 0 },
    hatchStrength: { value: 0 },
    hatchThreshold: { value: 0.22 },
    hatchSpacing: { value: 5 },
    paintStrength: { value: 0 },
  };
  private readonly composite = new FullscreenPass(
    new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: fullscreenVertex,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  private readonly edgeTarget = new WebGLRenderTarget(1, 1, {
    type: HalfFloatType,
    minFilter: NearestFilter,
    magFilter: NearestFilter,
  });
  private readonly edgePass = new FullscreenPass(
    new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: fullscreenVertex,
      fragmentShader: edgeFragmentShader,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  /** Dodawane do sceny tylko na czas przebiegu koloru (nie trafia do normalnych, bloomu, odbić). */
  readonly skyBackground = new Mesh(
    new PlaneGeometry(2, 2),
    new ShaderMaterial({
      name: 'sky_background',
      uniforms: this.uniforms,
      vertexShader: skyBackgroundVertex,
      fragmentShader: skyBackgroundFragment,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  private readonly drawingSize = new Vector2();
  private readonly clearColor = new Color();
  /** Tworzone przy pierwszym użyciu: wyłączone przełączniki nie kosztują pamięci. */
  private bloom: BloomPass | undefined;
  private reflections: ReflectionPass | undefined;
  private wetNormals: WetNormals | undefined;
  private postFx: PostFxPass | undefined;
  private readonly postFxState = new PostFxState();
  private lastRenderMs = 0;
  private offEvents: (() => void) | undefined;

  constructor(private readonly renderer: WebGLRenderer) {
    const size = renderer.getSize(new Vector2());
    this.setSize(size.x, size.y);
    this.skyBackground.name = 'sky-background';
    this.skyBackground.frustumCulled = false;
    this.skyBackground.renderOrder = SKY_BACKGROUND_ORDER;
    this.skyBackground.userData.noOutline = true;
    this.skyBackground.userData.bloom = false;
  }

  /** Stan impulsów kompozycji (obrażenia, Skupienie); testy i debug mogą go ustawiać wprost. */
  get fxState(): PostFxState {
    return this.postFxState;
  }

  /** Podpina zdarzenia: spadek HP gracza i `focus`. Odpina `dispose()`. */
  bindEvents(bus: EventBus): void {
    this.offEvents?.();
    this.postFxState.reset();
    this.offEvents = this.postFxState.bind(bus);
  }

  /** Rozmiar CSS; cele uwzględniają aktualne devicePixelRatio renderera. */
  setSize(width: number, height: number): void {
    const ratio = this.renderer.getPixelRatio();
    const w = Math.max(1, Math.floor(width * ratio));
    const h = Math.max(1, Math.floor(height * ratio));
    if (w !== this.colorTarget.width || h !== this.colorTarget.height) {
      for (const depth of [
        this.viewmodelColorDepth,
        this.viewmodelNormalDepth,
      ]) {
        depth.dispose();
        depth.image.width = w;
        depth.image.height = h;
      }
    }
    this.colorTarget.setSize(w, h);
    this.normalTarget.setSize(w, h);
    this.edgeTarget.setSize(w, h);
    this.uniforms.texelSize.value.set(1 / w, 1 / h);
    this.uniforms.aspect.value = w / h;
    this.bloom?.setSize(w, h);
    this.reflections?.setSize(w, h);
    this.postFx?.setSize(w, h);
  }

  /**
   * `dt` to czas rzeczywisty klatki w s (impulsy kompozycji); bez niego liczony z zegara.
   * `outline = 0` omija cały pipeline stylu: zwykły render bez mgły, bloomu i postFx.
   */
  render(
    scene: Scene,
    camera: PerspectiveCamera | OrthographicCamera,
    dt?: number,
  ): void {
    syncMaterials();
    const now = performance.now();
    const frameDt =
      dt ?? (this.lastRenderMs > 0 ? (now - this.lastRenderMs) / 1000 : 0);
    this.lastRenderMs = now;
    this.postFxState.update(Math.min(frameDt, 0.25));
    const quality = getQuality();
    if (tuning.render.outline === 0 || quality.outline === 0) {
      frameProfiler?.begin('color');
      try {
        renderWithViewmodel(this.renderer, scene, camera);
      } finally {
        frameProfiler?.end();
      }
      return;
    }
    // Zmiana DPR nie musi wywołać zdarzenia resize.
    this.renderer.getDrawingBufferSize(this.drawingSize);
    if (
      this.colorTarget.width !== this.drawingSize.x ||
      this.colorTarget.height !== this.drawingSize.y
    ) {
      const size = this.renderer.getSize(new Vector2());
      this.setSize(size.x, size.y);
    }
    const t = tuning.render;
    camera.updateMatrixWorld();
    const uniforms = this.uniforms;
    uniforms.thickness.value = t.outlineThickness;
    uniforms.depthThreshold.value = t.outlineDepthThreshold;
    uniforms.normalThreshold.value = t.outlineNormalThreshold;
    uniforms.outlineFadeNear.value = t.outlineFadeNear;
    uniforms.outlineFadeFar.value = t.outlineFadeFar;
    uniforms.outlineFarNormal.value = t.outlineFarNormal;
    uniforms.outlineFarOuter.value = t.outlineFarOuter;
    uniforms.outlineColor.value.set(t.outlineColor);
    uniforms.cameraNear.value = camera.near;
    uniforms.cameraFar.value = camera.far;
    const viewmodelActive = hasViewmodel();
    uniforms.viewmodelActive.value = viewmodelActive;
    uniforms.viewmodelNear.value = viewmodelNear(camera);
    uniforms.viewmodelColorDepthMap.value = viewmodelActive
      ? this.viewmodelColorDepth
      : this.colorTarget.depthTexture;
    uniforms.viewmodelNormalDepthMap.value = viewmodelActive
      ? this.viewmodelNormalDepth
      : this.normalTarget.depthTexture;
    uniforms.perspective.value = 'isPerspectiveCamera' in camera;
    uniforms.skyGradient.value = t.skyGradient;
    uniforms.skyHeight.value = Math.max(t.skyGradientHeight, 1e-3);
    uniforms.skyTop.value.set(t.skyTop);
    uniforms.skyHorizon.value.set(t.skyHorizon);
    uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
    uniforms.planeDeltaLimit.value = t.outlinePlaneDeltaLimit;
    uniforms.cameraRotation.value.setFromMatrix4(camera.matrixWorld);
    uniforms.cameraWorld.value.copy(camera.matrixWorld);
    uniforms.eyePosition.value.setFromMatrixPosition(camera.matrixWorld);
    uniforms.heightFogDensity.value = t.heightFogDensity * quality.heightFog;
    uniforms.heightFogFalloff.value = t.heightFogFalloff;
    uniforms.floorY.value =
      typeof scene.userData.reflectionFloorY === 'number'
        ? scene.userData.reflectionFloorY
        : 0;
    uniforms.renderTime.value += Math.min(frameDt, 0.25);
    uniforms.reflectionStrength.value =
      t.reflectionStrength * quality.reflections;
    uniforms.reflectionDistortion.value = t.reflectionDistortion;
    uniforms.reflectionPuddles.value = t.reflectionPuddles;
    uniforms.floorTolerance.value = Math.max(t.reflectionFloorTolerance, 0.001);
    const horizon = scene.userData.horizon as
      ReturnType<typeof horizonParameters> | undefined;
    uniforms.fogStrength.value = horizon ? 1 : t.fogStrength;
    uniforms.skyFlash.value = loadSettings().flashes ? t.skyFlash : 0;
    // Stary błysk zachowuje dokładne składowe liniowe, profile wybierają ciepłą biel.
    if (tuning.weather.skyFlashColor === '#9eadef')
      uniforms.skyFlashColor.value.setRGB(0.62, 0.68, 0.95);
    else uniforms.skyFlashColor.value.set(tuning.weather.skyFlashColor);
    uniforms.fogNear.value = horizon?.fogNear ?? t.fogNear;
    uniforms.fogFar.value = Math.max(
      horizon?.fogFar ?? t.fogFar,
      uniforms.fogNear.value + 1e-3,
    );
    uniforms.fogColor.value.set(t.fogColor);
    const bloomOn = quality.bloom > 0 && t.bloom > 0 && t.bloomStrength > 0;
    const postFxOn = t.postFx > 0;
    uniforms.vignetteStrength.value = postFxOn ? t.vignetteStrength : 0;
    uniforms.vignetteRadius.value = t.vignetteRadius;
    uniforms.vignetteSoftness.value = t.vignetteSoftness;
    uniforms.inkNearScale.value = t.inkNearScale;
    uniforms.inkWidth.value = t.inkWidth;
    uniforms.inkRefDistanceM.value = t.inkRefDistanceM;
    uniforms.inkMinScale.value = t.inkMinScale;
    uniforms.inkDilationMinPx.value = t.inkDilationMinPx;
    uniforms.inkFadeNearM.value = t.inkFadeNearM;
    uniforms.inkFadeFarM.value = t.inkFadeFarM;
    uniforms.inkNormalScale.value = t.inkNormalScale;
    uniforms.inkNormalFadeNearM.value = t.inkNormalFadeNearM;
    uniforms.inkNormalFadeFarM.value = t.inkNormalFadeFarM;
    uniforms.inkViewmodelWidth.value = t.inkViewmodelWidth;
    uniforms.inkViewmodelMaxRadiusPx.value = t.inkViewmodelMaxRadiusPx;
    uniforms.celBands.value = t.celBands;
    uniforms.celStrength.value = t.celStrength;
    uniforms.hatchStrength.value = t.hatchStrength;
    uniforms.hatchThreshold.value = t.hatchThreshold;
    uniforms.hatchSpacing.value = t.hatchSpacing;
    uniforms.paintStrength.value = t.paintStrength;
    const impulse = postFxOn && this.postFxState.active;

    const renderer = this.renderer;
    const target = renderer.getRenderTarget();
    const override = scene.overrideMaterial;
    const background = scene.background;
    const autoClear = renderer.autoClear;
    renderer.getClearColor(this.clearColor);
    const clearAlpha = renderer.getClearAlpha();
    let restoreHidden: (() => void) | null = null;
    try {
      renderer.autoClear = true;
      frameProfiler?.begin('color');
      try {
        renderer.setRenderTarget(this.colorTarget);
        // Gradient nieba jako tło przebiegu koloru (tylko ten przebieg, tylko warstwa świata).
        if (t.skyGradient > 0) scene.add(this.skyBackground);
        renderWithViewmodel(renderer, scene, camera, this.viewmodelColorDepth);
      } finally {
        this.skyBackground.removeFromParent();
        frameProfiler?.end();
      }
      frameProfiler?.begin('normals');
      try {
        scene.overrideMaterial = this.normalMaterial;
        scene.background = null;
        renderer.setClearColor(0x000000, 0);
        renderer.setRenderTarget(this.normalTarget);
        restoreHidden = hideNoOutline(scene);
        if (uniforms.reflectionStrength.value > 0) {
          this.wetNormals ??= new WetNormals();
          this.wetNormals.render(
            renderer,
            scene,
            camera,
            this.viewmodelNormalDepth,
          );
        } else {
          renderWithViewmodel(
            renderer,
            scene,
            camera,
            this.viewmodelNormalDepth,
          );
        }
        restoreHidden();
        restoreHidden = null;
      } finally {
        frameProfiler?.end();
      }
      if (uniforms.reflectionStrength.value > 0) {
        this.reflections ??= new ReflectionPass(
          this.colorTarget.width,
          this.colorTarget.height,
        );
        this.reflections.render(renderer, scene, camera, uniforms.floorY.value);
        uniforms.reflectionMap.value = this.reflections.texture;
        uniforms.reflectionProjection.value.copy(this.reflections.projection);
        const puddle = surfaceTexture('asphalt_puddles');
        uniforms.puddleMap.value = puddle.map.value;
        uniforms.puddleReady.value = puddle.ready.value;
      }
      if (bloomOn) {
        this.bloom ??= new BloomPass(
          this.colorTarget.width,
          this.colorTarget.height,
        );
        this.bloom.setSize(this.colorTarget.width, this.colorTarget.height);
        this.bloom.render(
          renderer,
          scene,
          camera,
          this.colorTarget,
          viewmodelActive ? this.viewmodelColorDepth : undefined,
        );
      }
      uniforms.bloomMap.value = bloomOn
        ? this.bloom!.texture
        : this.colorTarget.texture;
      uniforms.bloomStrength.value = bloomOn ? t.bloomStrength : 0;
      scene.overrideMaterial = override;
      scene.background = background;
      renderer.setClearColor(this.clearColor, clearAlpha);
      if (t.inkWidth > 0) {
        this.edgePass.render(renderer, this.edgeTarget, 'composite');
        uniforms.edgeMap.value = this.edgeTarget.texture;
      }
      if (impulse) {
        if (!this.postFx) {
          this.postFx = new PostFxPass(this.postFxState);
          this.postFx.setSize(this.colorTarget.width, this.colorTarget.height);
        }
        this.composite.render(renderer, this.postFx.input, 'composite');
        this.postFx.render(renderer, target);
      } else {
        this.composite.render(renderer, target, 'composite');
      }
    } finally {
      restoreHidden?.();
      scene.overrideMaterial = override;
      scene.background = background;
      renderer.setClearColor(this.clearColor, clearAlpha);
      renderer.autoClear = autoClear;
      renderer.setRenderTarget(target);
    }
  }

  /**
   * Rozgrzewka przed pierwszą klatką gry. Faza 1: pełny przebieg pipeline'u w trybie kompilacji —
   * `renderer.render` jest na ten czas podmieniony na `compileAsync` z tymi samymi celami, warstwami
   * i materiałami nadpisanymi co w prawdziwym przebiegu (kolor, normalne, maski bloomu i odbić,
   * kompozycja), więc wszystkie programy kompilują się równolegle (`KHR_parallel_shader_compile`)
   * i trafiają do cache pod tymi samymi kluczami co później. Faza 2: jeden prawdziwy przebieg bez
   * odrzucania poza kadrem (tekstury, bufory, uniformy) — programy są już gotowe, więc trwa krótko.
   * Obraz zostaje pod nakładką ładowania; stan sceny nie jest zmieniany.
   */
  async warmUp(
    scene: Scene,
    camera: PerspectiveCamera | OrthographicCamera,
    cancelled: () => boolean = () => false,
  ): Promise<void> {
    const renderer = this.renderer;
    if (typeof renderer.compileAsync === 'function') {
      const pending: Promise<unknown>[] = [];
      const draw = renderer.render;
      renderer.render = (target, viewCamera) => {
        pending.push(compileForPass(renderer, target, viewCamera));
      };
      const restoreScene = disableCulling(scene);
      try {
        this.render(scene, camera, 0);
      } finally {
        renderer.render = draw;
        restoreScene();
      }
      await Promise.all(pending);
    }
    if (cancelled()) return;
    const restoreScene = disableCulling(scene);
    try {
      this.render(scene, camera, 0);
    } finally {
      restoreScene();
    }
  }

  dispose(): void {
    this.offEvents?.();
    this.offEvents = undefined;
    this.colorTarget.depthTexture?.dispose();
    this.colorTarget.dispose();
    this.normalTarget.depthTexture?.dispose();
    this.normalTarget.dispose();
    this.viewmodelColorDepth.dispose();
    this.viewmodelNormalDepth.dispose();
    this.normalMaterial.dispose();
    this.skyBackground.geometry.dispose();
    this.skyBackground.material.dispose();
    this.composite.dispose();
    this.edgePass.dispose();
    this.edgeTarget.dispose();
    this.postFx?.dispose();
    this.bloom?.dispose();
    this.reflections?.dispose();
    this.wetNormals?.dispose();
  }
}

export function createRenderPipeline(renderer: WebGLRenderer): StylePipeline {
  return new StylePipeline(renderer);
}
