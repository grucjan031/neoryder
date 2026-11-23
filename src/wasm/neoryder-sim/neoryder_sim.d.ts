/* tslint:disable */
/* eslint-disable */

export class SimGraph {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Output: n rows of route prefixes, n+1 absolute neighbor offsets, then spawn indices.
     */
    frame(pairs: Uint32Array | number[], positions: Float32Array | number[], radius: number, depth: number): Uint32Array;
    constructor(offsets: Uint32Array | number[], edges: Uint32Array | number[]);
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_simgraph_free: (a: number, b: number) => void;
    readonly simgraph_frame: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number];
    readonly simgraph_new: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;

export const binary: string;
