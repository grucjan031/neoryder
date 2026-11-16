import type { Material, Object3D, Scene, WebGLRenderer } from 'three';

export const FRAME_STAGES = [
  'step',
  'sceneRender',
  'city',
  'pipeline',
  'color',
  'normals',
  'reflections',
  'reflectionMask',
  'reflectionBlurX',
  'reflectionBlurY',
  'bloom',
  'bloomMask',
  'bloomBlurX1',
  'bloomBlurY1',
  'bloomBlurX2',
  'bloomBlurY2',
  'composite',
  'postFx',
] as const;
export type FrameStage = (typeof FRAME_STAGES)[number];
const WINDOW = 120;
const MAX_QUERIES = 2048;
const COUNTERS = [
  'calls',
  'triangles',
  'lights',
  'programs',
  'transparent',
] as const;
type Counter = (typeof COUNTERS)[number];

interface TimerExtension {
  readonly TIME_ELAPSED_EXT: number;
  readonly GPU_DISJOINT_EXT: number;
}

interface FrameSample {
  id: number;
  cpu: Float64Array;
  gpu: Float64Array;
  counters: Float64Array;
  pending: number;
  valid: boolean;
  complete: boolean;
}

interface TimerSegment {
  query: WebGLQuery;
  mask: number;
  frame: number;
}

export interface FrameProfile {
  enabled: boolean;
  window: number;
  frames: number;
  totalFrames: number;
  frameMs: number;
  gpuAvailable: boolean;
  gpuFrames: number;
  stages: Record<FrameStage, { cpuMs: number; gpuMs: number | null }>;
  counters: Record<Counter, number>;
}

/** Jedna instancja debug; brak instancji w zwykłym uruchomieniu gry. */
export let frameProfiler: FrameProfiler | undefined;
export function setFrameProfiler(value: FrameProfiler | undefined): void {
  frameProfiler = value;
}

export class FrameProfiler {
  private running = false;
  private samples: FrameSample[] = [];
  private current: FrameSample | undefined;
  private serial = 0;
  private readonly stack: number[] = [];
  private readonly starts = new Float64Array(FRAME_STAGES.length);
  private readonly pending: TimerSegment[] = [];
  private readonly freeQueries: WebGLQuery[] = [];
  private active: TimerSegment | undefined;
  private queryCount = 0;
  private gl: WebGL2RenderingContext | undefined;
  private extension: TimerExtension | null = null;
  private previousAutoReset = true;
  private readonly result: FrameProfile = {
    enabled: false,
    window: WINDOW,
    frames: 0,
    totalFrames: 0,
    frameMs: 0,
    gpuAvailable: false,
    gpuFrames: 0,
    stages: Object.fromEntries(
      FRAME_STAGES.map((stage) => [stage, { cpuMs: 0, gpuMs: null }]),
    ) as FrameProfile['stages'],
    counters: {
      calls: 0,
      triangles: 0,
      lights: 0,
      programs: 0,
      transparent: 0,
    },
  };

  constructor(private readonly renderer: WebGLRenderer) {}

  get enabled(): boolean {
    return this.running;
  }

  /** Ostatni raport jest buforem współdzielonym; odczyt nie tworzy obiektów. */
  get averages(): Readonly<FrameProfile> {
    return this.result;
  }

  setEnabled(value: boolean): void {
    if (value === this.running) return;
    if (!value) {
      this.releaseQueries();
      this.renderer.info.autoReset = this.previousAutoReset;
      this.current = undefined;
      this.stack.length = 0;
    } else {
      this.serial = 0;
      this.samples = Array.from({ length: WINDOW }, () => ({
        id: -1,
        cpu: new Float64Array(FRAME_STAGES.length),
        gpu: new Float64Array(FRAME_STAGES.length),
        counters: new Float64Array(COUNTERS.length + 1),
        pending: 0,
        valid: false,
        complete: false,
      }));
      const context = this.renderer.getContext();
      this.gl = 'beginQuery' in context ? context : undefined;
      this.extension =
        this.gl?.getExtension('EXT_disjoint_timer_query_webgl2') ?? null;
      this.previousAutoReset = this.renderer.info.autoReset;
      this.renderer.info.autoReset = false;
      this.renderer.info.reset();
      this.result.frames = 0;
      this.result.totalFrames = 0;
      this.result.frameMs = 0;
      this.result.gpuFrames = 0;
      this.result.gpuAvailable = this.extension !== null;
      for (const stage of FRAME_STAGES) {
        this.result.stages[stage].cpuMs = 0;
        this.result.stages[stage].gpuMs = null;
      }
      for (const counter of COUNTERS) this.result.counters[counter] = 0;
      // Odczyt kasuje zastany znacznik disjoint przed pierwszym zapytaniem.
      if (this.extension)
        this.gl?.getParameter(this.extension.GPU_DISJOINT_EXT);
    }
    this.running = value;
    this.result.enabled = value;
  }

  begin(stage: FrameStage): void {
    if (!this.running) return;
    if (!this.current) {
      const sample = this.samples[this.serial % WINDOW]!;
      sample.id = this.serial++;
      sample.cpu.fill(0);
      sample.gpu.fill(0);
      sample.counters.fill(0);
      sample.pending = 0;
      sample.valid = this.extension !== null;
      sample.complete = false;
      this.current = sample;
    }
    this.stopSegment();
    const index = FRAME_STAGES.indexOf(stage);
    this.stack.push(index);
    this.starts[index] = performance.now();
    this.startSegment();
  }

  end(): void {
    if (!this.running) return;
    const now = performance.now();
    this.stopSegment();
    const index = this.stack.pop();
    if (index === undefined || !this.current) return;
    this.current.cpu[index]! += now - this.starts[index]!;
    this.startSegment();
  }

  endFrame(scene: Scene, frameDt: number): void {
    if (!this.running || !this.current) return;
    const sample = this.current;
    sample.counters[0] = this.renderer.info.render.calls;
    sample.counters[1] = this.renderer.info.render.triangles;
    sample.counters[3] = this.renderer.info.programs?.length ?? 0;
    sample.counters[COUNTERS.length] = frameDt * 1000;
    scene.traverseVisible(this.countObject);
    sample.complete = true;
    this.current = undefined;
    this.renderer.info.reset();
    this.pollQueries();
    this.updateAverages();
  }

  private readonly countObject = (object: Object3D): void => {
    const counters = this.current!.counters;
    if ('isLight' in object) counters[2]!++;
    const material = (object as Object3D & { material?: Material | Material[] })
      .material;
    if (Array.isArray(material)) {
      for (const item of material) {
        if (item.visible && item.transparent) {
          counters[4]!++;
          break;
        }
      }
    } else if (material?.visible && material.transparent) counters[4]!++;
  };

  private startSegment(): void {
    if (!this.extension || !this.gl || !this.stack.length || !this.current)
      return;
    let query = this.freeQueries.pop();
    if (!query && this.queryCount < MAX_QUERIES) {
      query = this.gl.createQuery() ?? undefined;
      if (query) this.queryCount++;
    }
    if (!query) {
      this.current.valid = false;
      return;
    }
    let mask = 0;
    for (const index of this.stack) mask |= 1 << index;
    this.active = { query, mask, frame: this.current.id };
    this.current.pending++;
    this.gl.beginQuery(this.extension.TIME_ELAPSED_EXT, query);
  }

  private stopSegment(): void {
    if (!this.active || !this.gl || !this.extension) return;
    this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = undefined;
  }

  private pollQueries(): void {
    if (!this.gl || !this.extension) return;
    const gl = this.gl;
    if (
      gl.getParameter(this.extension.GPU_DISJOINT_EXT) ||
      gl.isContextLost()
    ) {
      this.releaseQueries();
      for (const sample of this.samples) sample.valid = false;
      return;
    }
    let retained = 0;
    for (const segment of this.pending) {
      const sample = this.samples[segment.frame % WINDOW]!;
      const expired = sample.id !== segment.frame;
      if (
        !expired &&
        !gl.getQueryParameter(segment.query, gl.QUERY_RESULT_AVAILABLE)
      ) {
        this.pending[retained++] = segment;
        continue;
      }
      if (!expired) {
        const ms =
          Number(gl.getQueryParameter(segment.query, gl.QUERY_RESULT)) / 1e6;
        if (!Number.isFinite(ms) || ms < 0) sample.valid = false;
        else {
          for (let i = 0; i < FRAME_STAGES.length; i++)
            if (segment.mask & (1 << i)) sample.gpu[i]! += ms;
        }
        sample.pending--;
      }
      this.freeQueries.push(segment.query);
    }
    this.pending.length = retained;
  }

  private updateAverages(): void {
    const result = this.result;
    result.frames = Math.min(this.serial, WINDOW);
    result.totalFrames = this.serial;
    result.gpuFrames = 0;
    result.frameMs = 0;
    for (const stage of FRAME_STAGES) {
      result.stages[stage].cpuMs = 0;
      result.stages[stage].gpuMs = null;
    }
    for (const counter of COUNTERS) result.counters[counter] = 0;
    for (const sample of this.samples) {
      if (!sample.complete) continue;
      const gpuValid = sample.valid && sample.pending === 0;
      if (gpuValid) result.gpuFrames++;
      result.frameMs += sample.counters[COUNTERS.length]!;
      for (let i = 0; i < FRAME_STAGES.length; i++) {
        const stage = result.stages[FRAME_STAGES[i]!];
        stage.cpuMs += sample.cpu[i]!;
        if (gpuValid) stage.gpuMs = (stage.gpuMs ?? 0) + sample.gpu[i]!;
      }
      for (let i = 0; i < COUNTERS.length; i++)
        result.counters[COUNTERS[i]!] += sample.counters[i]!;
    }
    result.frameMs /= result.frames;
    for (const stage of FRAME_STAGES) {
      result.stages[stage].cpuMs /= result.frames;
      if (result.gpuFrames) result.stages[stage].gpuMs! /= result.gpuFrames;
    }
    for (const counter of COUNTERS) result.counters[counter] /= result.frames;
  }

  private releaseQueries(): void {
    this.stopSegment();
    for (const segment of this.pending) this.gl?.deleteQuery(segment.query);
    for (const query of this.freeQueries) this.gl?.deleteQuery(query);
    this.pending.length = 0;
    this.freeQueries.length = 0;
    this.queryCount = 0;
  }

  dispose(): void {
    this.setEnabled(false);
    if (frameProfiler === this) setFrameProfiler(undefined);
  }
}
