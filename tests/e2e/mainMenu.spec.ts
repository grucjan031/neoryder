import { expect, test } from '@playwright/test';
import type { RunSave } from '../../src/core/save';
import type { RunState } from '../../src/core/runTypes';

test('menu pokazuje Kryjówkę, Kontynuuj run i Poligon; Poligon otwiera arenę', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'NEORYDER' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kryjówka' })).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Kontynuuj run' }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Nowy run (presety)' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Poligon' }).click();
  await expect(page).toHaveURL(/scene=arena/);
  expect(errors).toEqual([]);
});

test('odświeżenie i Kontynuuj zachowują zapisany węzeł, Kredyty i implanty', async ({
  page,
}) => {
  await page.goto('/?scene=run&seed=resume-e2e&loadout=blade&debug=1');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.query('screen')))
    .toBe('map');
  // Stan mapy po pokoju jako fixture; walka i nagrody mają osobne testy.
  const saved = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('neoryder', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise<RunState>((resolve, reject) => {
      const tx = db.transaction('saves', 'readwrite');
      const store = tx.objectStore('saves');
      const request = store.get('run');
      let state: RunState;
      request.onsuccess = () => {
        const save = request.result as RunSave;
        state = save.run;
        state.currentNodeId = state.map.layers[0]![0]!.id;
        state.visited = [state.currentNodeId];
        state.hp = 37;
        state.credits = 42;
        state.implants = ['fixture-implant'];
        store.put(save, 'run');
      };
      tx.oncomplete = () => {
        db.close();
        resolve(state);
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    });
  });
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Kontynuuj run' }),
  ).toBeEnabled();
  await expect(page.getByRole('status')).toContainText('Zdrowie: 37');
  await page.getByRole('button', { name: 'Kontynuuj run' }).click();
  await expect(page).toHaveURL(/scene=run&continue=1/);
  await expect(page.locator('[aria-current="step"]')).toHaveAttribute(
    'data-node-id',
    saved.currentNodeId!,
  );
  await expect(page.locator('.run-screen')).toContainText('Kredyty: 42');
  await page.reload();
  await expect(page.locator('[aria-current="step"]')).toHaveAttribute(
    'data-node-id',
    saved.currentNodeId!,
  );
  await page.goto('/?scene=run&continue=1&debug=1');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const state = window.__neoryder?.query('runState') as
          RunState | undefined;
        return (
          state && {
            currentNodeId: state.currentNodeId,
            credits: state.credits,
            implants: state.implants,
            map: state.map,
          }
        );
      }),
    )
    .toEqual({
      currentNodeId: saved.currentNodeId,
      credits: saved.credits,
      implants: saved.implants,
      map: saved.map,
    });
});
