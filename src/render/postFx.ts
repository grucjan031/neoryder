import { Color, HalfFloatType, ShaderMaterial, WebGLRenderTarget } from 'three';
import type { Texture, WebGLRenderer } from 'three';
import type { EventBus } from '../core/events';
import { tuning } from '../core/tuning';
import { loadSettings } from '../core/save';
import { FullscreenPass, fullscreenVertex } from './fullscreen';

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Stan impulsów kompozycji końcowej (bez GPU): obrażenia gracza i Skupienie.
 * Czas to czas rzeczywisty klatki, więc hitstop i slowmo nie rozciągają efektu.
 */
export class PostFxState {
  /** 0..1, maleje liniowo do zera w `damagePulseS`. */
  damage = 0;
  /** 0..1, płynnie dąży do `focusActive`. */
  focus = 0;
  focusActive = false;
  private playerId: number | null = null;
  private lastHealth: number | null = null;

  hit(amount: number): void {
    if (!loadSettings().flashes) return;
    this.damage = Math.max(this.damage, clamp01(amount));
  }

  update(dt: number): void {
    if (!loadSettings().flashes) this.damage = 0;
    const t = tuning.render;
    if (dt <= 0) return;
    this.damage = Math.max(
      0,
      this.damage - dt / Math.max(t.damagePulseS, 1e-3),
    );
    const fade = this.focusActive ? t.focusFadeInS : t.focusFadeOutS;
    const step = dt / Math.max(fade, 1e-3);
    this.focus = this.focusActive
      ? Math.min(1, this.focus + step)
      : Math.max(0, this.focus - step);
  }

  /** Czy któryś impuls jest aktywny (bez tego pass końcowy jest pomijany). */
  get active(): boolean {
    return this.damage > 0 || this.focus > 0;
  }

  reset(): void {
    this.damage = 0;
    this.focus = 0;
    this.focusActive = false;
    this.lastHealth = null;
  }

  /** Podpina zdarzenia: spadek HP gracza i `focus`. Zwraca funkcję odpinającą. */
  bind(bus: EventBus): () => void {
    const offs = [
      bus.on('entity_spawned', ({ id, kind }) => {
        if (kind !== 'player') return;
        this.playerId = id;
        this.lastHealth = null;
      }),
      bus.on('entity_despawned', ({ id }) => {
        if (id !== this.playerId) return;
        this.playerId = null;
        this.lastHealth = null;
      }),
      bus.on('health_changed', ({ id, current, max }) => {
        if (id !== this.playerId) return;
        const previous = this.lastHealth;
        this.lastHealth = current;
        if (previous === null || current >= previous) return;
        const t = tuning.render;
        const share = max > 0 ? (previous - current) / max : 1;
        this.hit(t.damagePulseMin + share * t.damagePulseHpGain);
      }),
      bus.on('focus', ({ durationS }) => {
        this.focusActive = durationS > 0;
      }),
    ];
    return () => {
      for (const off of offs) off();
    };
  }
}

const fragmentShader = /* glsl */ `
  uniform sampler2D colorMap;
  uniform float aspect;
  uniform float damage;
  uniform float damageAberration;
  uniform float damageTint;
  uniform vec3 damageTintColor;
  uniform float focus;
  uniform float focusTint;
  uniform vec3 focusTintColor;
  uniform float focusDesaturate;
  varying vec2 vUv;

  void main() {
    vec2 c = vUv - 0.5;
    float radius = length(c * vec2(aspect, 1.0)) / length(vec2(aspect, 1.0)) * 2.0;
    // Aberracja rośnie z odległością od środka, więc środek zostaje ostry.
    vec2 offset = c * damage * damageAberration * (0.4 + radius);
    vec3 col = vec3(
      texture2D(colorMap, vUv + offset).r,
      texture2D(colorMap, vUv).g,
      texture2D(colorMap, vUv - offset).b
    );
    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(col, vec3(luma), focus * focusDesaturate);
    col *= mix(vec3(1.0), focusTintColor, focus * focusTint);
    float edge = smoothstep(0.35, 1.0, radius);
    col = mix(col, damageTintColor, damage * damageTint * edge);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

/** Pass impulsów: aberracja i czerwone krawędzie przy obrażeniach, odcień Skupienia. Winieta jest w kompozycji. */
export class PostFxPass {
  private readonly target = new WebGLRenderTarget(1, 1, {
    type: HalfFloatType,
    depthBuffer: false,
  });
  private readonly uniforms = {
    colorMap: { value: this.target.texture },
    aspect: { value: 1 },
    damage: { value: 0 },
    damageAberration: { value: 0 },
    damageTint: { value: 0 },
    damageTintColor: { value: new Color() },
    focus: { value: 0 },
    focusTint: { value: 0 },
    focusTintColor: { value: new Color() },
    focusDesaturate: { value: 0 },
  };
  private readonly pass = new FullscreenPass(
    new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: fullscreenVertex,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }),
  );

  constructor(private readonly state: PostFxState) {}

  /** Cel pośredni, do którego rysuje kompozycja przed tym passem. */
  get input(): WebGLRenderTarget {
    return this.target;
  }

  setSize(width: number, height: number): void {
    this.target.setSize(width, height);
    this.uniforms.aspect.value = width / height;
  }

  get texture(): Texture {
    return this.target.texture;
  }

  render(renderer: WebGLRenderer, target: WebGLRenderTarget | null): void {
    const t = tuning.render;
    const u = this.uniforms;
    u.damage.value = this.state.damage;
    u.damageAberration.value = t.damageAberration;
    u.damageTint.value = t.damageTint;
    u.damageTintColor.value.set(t.damageTintColor);
    u.focus.value = this.state.focus;
    u.focusTint.value = t.focusTint;
    u.focusTintColor.value.set(t.focusTintColor);
    u.focusDesaturate.value = t.focusDesaturate;
    this.pass.render(renderer, target);
  }

  dispose(): void {
    this.target.dispose();
    this.pass.dispose();
  }
}
