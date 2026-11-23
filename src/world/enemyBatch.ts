import type { Vec3 } from '../core/math';
import type { SimGraph } from '../wasm/neoryder-sim/neoryder_sim';

let NativeGraph: typeof SimGraph | undefined;
let loading: Promise<boolean> | undefined;

export function initEnemySim(): Promise<boolean> {
  return (loading ??= import('../wasm/neoryder-sim/neoryder_sim.js')
    .then(async (module) => {
      // Asynchroniczna kompilacja z wbudowanych bajtów: bez fetch i bez blokowania wątku UI.
      await module.default({
        module_or_path: Uint8Array.from(atob(module.binary), (c) =>
          c.charCodeAt(0),
        ),
      });
      NativeGraph = module.SimGraph;
      return true;
    })
    .catch((error: unknown) => {
      console.warn('Moduł WASM AI niedostępny, używam algorytmu TS.', error);
      return false;
    }));
}

export const NO_CELL = 0xffffffff;
export interface RouteGraph {
  offsets: Uint32Array;
  edges: Uint32Array;
  locate(p: Vec3): number | undefined;
  // Prefix of the canonical descending path, excluding the origin.
  prefix(origin: number, goal: number, depth: number): number[];
  steer(
    start: Vec3,
    goal: Vec3,
    origin: number,
    target: number,
    prefix: Uint32Array,
  ): Vec3;
}

export interface MovingAgent {
  current: { position: Vec3 };
  moveGoal?: Vec3;
  /** Ustawiane przez wsad: false, gdy `moveGoal` to węzeł pośredni trasy, nie cel końcowy. */
  moveGoalFinal?: boolean;
}

/** CSR graph uploaded once. Per tick the packed result contains route prefixes and a CSR neighbor list. */
export class EnemyBatch {
  private native?: SimGraph;
  private positions = new Float32Array(0);
  private pairs = new Uint32Array(0);

  constructor(
    private readonly graph?: RouteGraph,
    private readonly reference = false,
  ) {}

  run(
    agents: readonly MovingAgent[],
    radius: number,
    lookahead: number,
  ): Uint32Array {
    const count = agents.length;
    if (this.positions.length !== count * 2) {
      this.positions = new Float32Array(count * 2);
      this.pairs = new Uint32Array(count * 2);
    }
    const depth = this.graph
      ? Math.max(1, Math.min(64, Math.floor(lookahead)))
      : 0;
    this.pairs.fill(NO_CELL);
    for (let i = 0; i < count; i++) {
      const {
        current: { position },
        moveGoal,
      } = agents[i]!;
      this.positions[2 * i] = position.x;
      this.positions[2 * i + 1] = position.z;
      if (moveGoal && this.graph) {
        this.pairs[2 * i] = this.graph.locate(position) ?? NO_CELL;
        this.pairs[2 * i + 1] = this.graph.locate(moveGoal) ?? NO_CELL;
      }
    }
    if (NativeGraph && !this.reference)
      this.native ??= new NativeGraph(
        this.graph?.offsets ?? Uint32Array.of(0),
        this.graph?.edges ?? new Uint32Array(),
      );
    const packed = this.native
      ? this.native.frame(this.pairs, this.positions, radius, depth)
      : this.referenceFrame(radius, depth);
    if (this.graph)
      for (let i = 0; i < count; i++) {
        const agent = agents[i]!;
        if (!agent.moveGoal) continue;
        const goal = agent.moveGoal;
        agent.moveGoal = this.graph.steer(
          agent.current.position,
          goal,
          this.pairs[2 * i]!,
          this.pairs[2 * i + 1]!,
          packed.subarray(i * depth, (i + 1) * depth),
        );
        agent.moveGoalFinal =
          agent.moveGoal.x === goal.x && agent.moveGoal.z === goal.z;
      }
    // Absolute offsets become relative to the neighbor section.
    const head = count * depth;
    for (let i = head; i <= head + count; i++) packed[i] = packed[i]! - head;
    return packed.subarray(head);
  }

  private referenceFrame(radius: number, depth: number): Uint32Array {
    const count = this.positions.length / 2;
    const head = count * depth;
    const out: number[] = Array(head + count + 1).fill(NO_CELL);
    for (let i = 0; i < count; i++) {
      const origin = this.pairs[2 * i]!,
        target = this.pairs[2 * i + 1]!;
      if (this.graph && origin !== NO_CELL && target !== NO_CELL) {
        const prefix = this.graph.prefix(origin, target, depth);
        for (let k = 0; k < prefix.length; k++) out[i * depth + k] = prefix[k]!;
      }
      out[head + i] = out.length;
      for (let j = 0; j < count; j++)
        if (
          i !== j &&
          Math.abs(this.positions[2 * i]! - this.positions[2 * j]!) <= radius &&
          Math.abs(this.positions[2 * i + 1]! - this.positions[2 * j + 1]!) <=
            radius
        )
          out.push(j);
    }
    out[head + count] = out.length;
    return Uint32Array.from(out);
  }

  dispose(): void {
    this.native?.free();
    this.native = undefined;
  }
}
