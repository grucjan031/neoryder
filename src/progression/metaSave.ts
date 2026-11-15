import type { EventBus } from '../core/events';
import { SAVE_VERSION } from '../core/save';
import type { SaveStore } from '../core/save';
import { MetaManager } from './meta';
import type { MetaRules } from './meta';
import { createStarterMetaState } from './progressionSchema';

/**
 * Wczytuje `MetaManager` z zapisu. Brak zapisu daje stan startowy z danych. Zapis nieczytelny
 * (uszkodzony, nowszej wersji, błąd bazy) też daje stan startowy z ostrzeżeniem w konsoli, ale
 * niczego nie nadpisuje: zapis zmienia się dopiero przy pierwszym `saveMetaManager`.
 */
export async function loadMetaManager(
  store: SaveStore,
  bus?: EventBus,
  rules?: MetaRules,
): Promise<MetaManager> {
  try {
    const save = await store.loadMeta();
    if (save) return MetaManager.restore(save.meta, bus, rules);
  } catch (error) {
    console.warn('Nie można wczytać meta-progresu; stan startowy.', error);
  }
  return new MetaManager(
    createStarterMetaState(rules?.progression.starter),
    bus,
    rules,
  );
}

const queues = new WeakMap<SaveStore, Promise<void>>();

/**
 * Zapisuje bieżący stan `MetaManager` jako `MetaSave` v3 (zachowuje `createdAt` istniejącego
 * zapisu, ustawia `updatedAt`). Migawka stanu powstaje w chwili wywołania, a zapisy do jednego
 * `SaveStore` idą po kolei, więc starszy stan nie nadpisze nowszego. Błąd zapisu odrzuca obietnicę.
 */
export function saveMetaManager(
  store: SaveStore,
  manager: MetaManager,
  now: () => number = Date.now,
): Promise<void> {
  const meta = manager.serialize();
  const previous = queues.get(store) ?? Promise.resolve();
  const write = previous.then(async () => {
    const existing = await store.loadMeta().catch(() => null);
    const stamp = now();
    await store.saveMeta({
      saveVersion: SAVE_VERSION,
      createdAt: existing?.createdAt ?? stamp,
      updatedAt: stamp,
      meta,
    });
  });
  queues.set(
    store,
    write.catch(() => undefined),
  );
  return write;
}
