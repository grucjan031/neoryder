import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  SAVE_VERSION,
  createIndexedDbSaveStore,
  createMemorySaveStore,
} from '../../src/core/save';
import { EventBus } from '../../src/core/events';
import { MetaManager } from '../../src/progression/meta';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import { RunManager } from '../../src/world/run';
import { generateSectorMap } from '../../src/world/sectorMap';
import { kuroganeSector } from '../../src/world/sectors';

function sampleRun() {
  const manager = new RunManager(
    new EventBus(),
    (seed) => generateSectorMap(kuroganeSector, seed),
    { sector: kuroganeSector, now: () => 300 },
  );
  manager.newRun('s', 'classic');
  return manager.serialize();
}

async function seed(name: string, value: unknown): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('saves');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(value, 'meta');
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}

function legacyMeta() {
  const meta: Record<string, unknown> = { ...createStarterMetaState() };
  delete meta.achievements;
  meta.data = 321;
  meta.cores = 4;
  meta.xp = 99;
  meta.appliedRunIds = ['old-run'];
  meta.unlocks = ['blade:plasmaBlade', 'weapon:blaster', 'power:push'];
  return meta;
}

describe('zapis v5: osiągnięcia', () => {
  it('SAVE_VERSION to 5', () => {
    expect(SAVE_VERSION).toBe(5);
  });

  it('migruje meta v4 -> v5: puste osiągnięcia, reszta nietknięta', async () => {
    await seed('ach-v4', {
      saveVersion: 4,
      createdAt: 1,
      updatedAt: 2,
      meta: legacyMeta(),
    });
    const saved = await createIndexedDbSaveStore('ach-v4').loadMetaStrict!();
    expect(saved).toMatchObject({
      saveVersion: 5,
      createdAt: 1,
      meta: {
        data: 321,
        cores: 4,
        xp: 99,
        appliedRunIds: ['old-run'],
        achievements: { unlocked: [], counters: {} },
      },
    });
    expect(saved!.meta.unlocks).toEqual([
      'blade:plasmaBlade',
      'weapon:blaster',
      'power:push',
    ]);
  });

  it('migruje meta v3 -> v5: kampania i osiągnięcia dopisane, waluty zachowane', async () => {
    const legacy = legacyMeta();
    delete legacy.campaign;
    await seed('ach-v3', {
      saveVersion: 3,
      createdAt: 1,
      updatedAt: 2,
      meta: legacy,
    });
    const saved = await createIndexedDbSaveStore('ach-v3').loadMetaStrict!();
    expect(saved).toMatchObject({
      saveVersion: 5,
      meta: {
        data: 321,
        campaign: { completed: [], pendingDebrief: null },
        achievements: { unlocked: [], counters: {} },
      },
    });
  });

  it('po migracji rozliczenie runu dolicza naszywki i zapis wraca w v5', async () => {
    await seed('ach-v4-apply', {
      saveVersion: 4,
      createdAt: 1,
      updatedAt: 2,
      meta: legacyMeta(),
    });
    const store = createIndexedDbSaveStore('ach-v4-apply');
    const loaded = (await store.loadMetaStrict!())!;
    const meta = MetaManager.restore(loaded.meta);
    meta.applyRun(
      {
        outcome: 'victory',
        seed: 's',
        loadoutId: 'custom',
        elapsedS: 1,
        kills: 1,
        roomsCleared: 1,
        elitesCleared: 0,
        threatLevel: 0,
        layerReached: 1,
        implants: [],
        damage: { melee: 1, power: 0, gun: 0, other: 0 },
        achievements: {
          counters: { victories: 1 },
          flags: ['pierwsze-zwyciestwo'],
        },
      },
      'new-run',
    );
    await store.saveMeta({ ...loaded, meta: meta.serialize() });
    const again = (await store.loadMetaStrict!())!;
    expect(again.saveVersion).toBe(5);
    expect(again.meta.achievements).toEqual({
      unlocked: ['pierwsze-zwyciestwo'],
      counters: { victories: 1 },
    });
  });

  it('zapis runu v4 z zakończeniem bez achievements czyta się w v5, a z achievements zachowuje je', async () => {
    const store = createMemorySaveStore();
    const baseSummary = {
      outcome: 'death' as const,
      seed: 's',
      loadoutId: 'classic',
      elapsedS: 3,
      kills: 1,
      roomsCleared: 0,
      elitesCleared: 0,
      threatLevel: 0,
      layerReached: 1,
      implants: [],
      damage: { melee: 1, power: 0, gun: 0, other: 0 },
    };
    const progress = { counters: { dash_used: 3 }, flags: ['pierwsza-krew'] };
    const run = sampleRun();
    await store.saveRun({
      saveVersion: SAVE_VERSION,
      seed: 's',
      startedAt: 1,
      run,
      ended: {
        runId: 'r',
        summary: { ...baseSummary, achievements: progress },
      },
    });
    expect((await store.loadRun())!.ended!.summary.achievements).toEqual(
      progress,
    );
    await store.saveRun({
      saveVersion: SAVE_VERSION,
      seed: 's',
      startedAt: 1,
      run,
      ended: { runId: 'r', summary: baseSummary },
    });
    expect(
      (await store.loadRun())!.ended!.summary.achievements,
    ).toBeUndefined();
  });
});
