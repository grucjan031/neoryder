import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { createIndexedDbSaveStore, SAVE_VERSION } from '../../src/core/save';
import { createStarterMetaState } from '../../src/progression/progressionSchema';

it('migruje meta v3 do pustej kampanii, zachowując waluty i idempotencję', async () => {
  const name = 'mission-migration-v3';
  const starter = createStarterMetaState();
  const legacy: Partial<typeof starter> = { ...starter };
  delete legacy.campaign;
  legacy.data = 123;
  legacy.appliedRunIds = ['older-run'];
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('saves');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('saves', 'readwrite');
      transaction
        .objectStore('saves')
        .put(
          { saveVersion: 3, createdAt: 1, updatedAt: 2, meta: legacy },
          'meta',
        );
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onabort = () => {
        db.close();
        reject(transaction.error);
      };
    };
  });
  const saved = await createIndexedDbSaveStore(name).loadMetaStrict!();
  expect(saved).toMatchObject({
    saveVersion: SAVE_VERSION,
    meta: {
      data: 123,
      appliedRunIds: ['older-run'],
      campaign: { completed: [], pendingDebrief: null },
    },
  });
});
