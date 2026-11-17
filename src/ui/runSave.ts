import { createIndexedDbSaveStore, SAVE_VERSION } from '../core/save';
import type { SaveStore } from '../core/save';
import type { RunSavePort } from '../scenes/run';

export function createRunSavePort(
  store: SaveStore = createIndexedDbSaveStore(),
): RunSavePort {
  return {
    loadRun: async () => (await store.loadRun())?.run ?? null,
    loadEnded: async () => (await store.loadRun())?.ended ?? null,
    saveRun: (run, ended) =>
      store.saveRun({
        saveVersion: SAVE_VERSION,
        seed: run.seed,
        startedAt: run.startedAtMs,
        run,
        ...(ended ? { ended } : {}),
      }),
    clearRun: () => store.clearRun(),
  };
}
