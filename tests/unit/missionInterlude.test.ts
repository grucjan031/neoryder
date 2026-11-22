// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { missionDefinitions } from '../../src/world/missions';
import { missionSchema } from '../../src/world/missionSchema';
import { MetaManager } from '../../src/progression/meta';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import { createMissionsPanel } from '../../src/ui/hub/missionsPanel';

const expected = [
  {
    id: 'm03-list-przewozowy',
    lines: [
      {
        speaker: 'szron',
        text: 'Po masztach Kurogane zrobiło obławę na kurierów z implantami. Trzymali zatrzymanych w kontenerach na bocznicy.',
      },
      {
        speaker: 'mira',
        text: 'Druga ekipa otworzyła trzy kontenery, zanim przyjechał transport. Wyszło dwanaścioro ludzi.',
      },
      {
        speaker: 'bajt',
        text: 'Jedna z nich to Nadia. Zna nabrzeże w Hutach jak własną kieszeń i od dziś siedzi na naszym kanale.',
      },
      {
        speaker: 'szron',
        text: 'Mówi, że zatrzymanych z zeszłego miesiąca wywieźli do Magazynu 9 w porcie. Tam idziesz.',
      },
    ],
  },
  {
    id: 'm06-odlewnia',
    lines: [
      {
        speaker: 'szron',
        text: 'Dwie noce temu Mira przestawiła zwrotnicę na rozrządni i przejęła wagon z kontenerem klasy K.',
      },
      {
        speaker: 'mira',
        text: 'W środku nie było towaru. Była kobieta w aparaturze podtrzymującej. Oznaczenie K-112.',
      },
      {
        speaker: 'bajt',
        text: 'Ma na imię Ida. Na chwilę otworzyła oczy i jednym wyładowaniem wyrwała drzwi kontenera. Od tamtej pory śpi.',
      },
      {
        speaker: 'wolan',
        text: 'Leży przy stanowisku Bajta. Zostanę przy aparaturze.',
      },
      {
        speaker: 'szron',
        text: 'Brandt w odpowiedzi zamknął Huty. Kontakt Nadii zatrzymał konwój jego adiutantki, porucznik Wirskiej. Oddała kartę do sieci ochrony bez walki.',
      },
      {
        speaker: 'bajt',
        text: 'Puściliśmy ją, a ona zdążyła złożyć meldunek. W Odlewni będą na nas czekać.',
      },
    ],
  },
];

it.each(expected)(
  '$id zachowuje dokładny tekst przerywnika ze zlecenia',
  ({ id, lines }) => {
    expect(missionDefinitions.get(id)!.interlude).toEqual({
      title: 'Tymczasem w Iskrze',
      lines,
    });
  },
);

it.each([
  { title: '', lines: expected[0]!.lines },
  { title: 'Tymczasem w Iskrze', lines: [] },
  {
    title: 'Tymczasem w Iskrze',
    lines: [{ speaker: 'unknown', text: 'Tekst' }],
  },
  { title: 'Tymczasem w Iskrze', lines: [{ speaker: 'szron', text: '' }] },
])('odrzuca niekompletny przerywnik: %j', (interlude) => {
  expect(
    missionSchema.safeParse({
      ...missionDefinitions.get('m01-maszty'),
      interlude,
    }).success,
  ).toBe(false);
});

it('M03 pozostaje w danych, ale jest niedostępna na tablicy; M06 po M03 jest dostępna, M01 ma odprawę', () => {
  const state = createStarterMetaState();
  state.campaign.completed = ['m01-maszty', 'm03-list-przewozowy'];
  const original = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const panel = createMissionsPanel({
    manager: new MetaManager(state),
    navigate() {},
    save: async () => {},
    close() {},
  });
  document.body.append(panel.root);
  try {
    const foundry = panel.root.querySelector<HTMLButtonElement>(
      '[data-mission="m06-odlewnia"]',
    )!;
    expect(foundry.disabled).toBe(false);
    expect(foundry.textContent).not.toContain('Wkrótce');
    expect(missionDefinitions.get('m06-odlewnia')!.interlude).toBeDefined();
    for (const id of ['m03-list-przewozowy']) {
      const button = panel.root.querySelector<HTMLButtonElement>(
        `[data-mission="${id}"]`,
      )!;
      expect(button.disabled).toBe(true);
      expect(button.textContent).toContain('Wkrótce');
      button.click();
      expect(
        panel.root.querySelector<HTMLElement>('[data-mission-briefing]')!
          .hidden,
      ).toBe(true);
      expect(missionDefinitions.get(id)!.interlude).toBeDefined();
    }
    const m01 = panel.root.querySelector<HTMLButtonElement>(
      '[data-mission="m01-maszty"]',
    )!;
    expect(m01.disabled).toBe(false);
    m01.click();
    expect(
      panel.root.querySelector<HTMLElement>('[data-mission-briefing]')!.hidden,
    ).toBe(false);
    expect(
      panel.root.querySelector('[data-mission-briefing]')!.textContent,
    ).toContain('Odprawa · Maszty');
    expect(panel.root.querySelector('[data-mission-interlude]')).toBeNull();
  } finally {
    panel.dispose();
    HTMLElement.prototype.scrollIntoView = original;
  }
});
