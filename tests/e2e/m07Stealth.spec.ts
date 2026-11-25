import { expect, test } from '@playwright/test';
import { LOAD_TIMEOUT, SIM_TIMEOUT, waitSimSteps } from './helpers';

test('M07: patrol reaguje na strzał, zgłasza pościg i wraca na trasę po śmierci', async ({
  page,
}) => {
  test.setTimeout(360_000);
  const command = (line: string) =>
    page.evaluate((s) => window.__neoryder?.command(s), line);
  const query = (key: string) =>
    page.evaluate((s) => window.__neoryder?.query(s), key);
  const alarm = async () =>
    JSON.parse(String(await command('alarm state'))) as {
      raised: string[];
      guards: { state: string }[];
    };
  await page.goto('/?scene=run&debug=1&fx=lite');
  await expect
    .poll(() => query('screen'), { timeout: LOAD_TIMEOUT })
    .toBe('map');
  for (const id of [
    'm01-maszty',
    'm02-punkt-kontrolny',
    'm03-list-przewozowy',
    'm04-ladunek-klasy-k',
    'm06-odlewnia',
  ])
    await command('campaign complete ' + id);
  await expect.poll(() => query('savePending')).toBe(false);
  await page.goto(
    '/?scene=mission&mission=m07-nocny-dyzur&seed=m07-patrol&debug=1&fx=lite',
  );
  await expect
    .poll(() => query('screen'), { timeout: LOAD_TIMEOUT })
    .toBe('playing');
  await command('objective done krata');
  await command('checkpoint hala');
  const unaware = async () =>
    expect
      .poll(async () => (await alarm()).guards.map((g) => g.state), {
        timeout: SIM_TIMEOUT,
      })
      .toEqual(['unaware', 'unaware', 'unaware']);
  await unaware();
  const bonus = page.getByText(/Dodatkowo: Ciche przejście do magazynu/);
  await expect(bonus).toHaveAttribute('data-state', 'pending');
  await command('hold gun');
  await command('tp 165 0 -90');
  const canvas = page.getByLabel('Scena NEORYDER', { exact: true });
  await canvas.dispatchEvent('mousedown', { button: 0 });
  await waitSimSteps(page, 4);
  await canvas.dispatchEvent('mouseup', { button: 0 });
  await expect
    .poll(() => query('mission'), { timeout: SIM_TIMEOUT })
    .toMatchObject({
      raisedAlarms: ['przychodnia'],
      activeEncounters: expect.arrayContaining(['alarm-hala']),
      inCombat: true,
    });
  await expect(bonus).toHaveAttribute('data-state', 'failed');
  await command('hurt 99999');
  await expect
    .poll(() => query('mission'), { timeout: SIM_TIMEOUT })
    .toMatchObject({
      state: 'playing',
      checkpointId: 'hala',
      raisedAlarms: [],
      inCombat: false,
    });
  await unaware();
  await expect(bonus).toHaveAttribute('data-state', 'pending');
});
