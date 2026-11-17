// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { MetaManager } from '../../src/progression/meta';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import { createMissionsPanel } from '../../src/ui/hub/missionsPanel';
import { MissionRadio, splitRadioText } from '../../src/ui/missionUi';
import { missionDefinitions } from '../../src/world/missions';

it('wybór misji pokazuje odprawę, powrót przywraca listę, start przekazuje id', () => {
  const manager = new MetaManager(createStarterMetaState());
  const navigate = vi.fn();
  const scroll = vi.fn();
  const original = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = scroll;
  const panel = createMissionsPanel({
    manager,
    navigate,
    save: async () => {},
    close: () => {},
  });
  document.body.append(panel.root);
  try {
    panel.root
      .querySelector<HTMLButtonElement>('[data-mission="m01-maszty"]')!
      .click();
    const briefing = panel.root.querySelector<HTMLElement>(
      '[data-mission-briefing]',
    )!;
    expect(briefing.hidden).toBe(false);
    expect(
      panel.root.querySelector('.missions-panel__sector-text')!.textContent,
    ).toBe(missionDefinitions.get('m01-maszty')!.summary);
    expect(
      panel.root.querySelector<HTMLElement>('.missions-panel__sector')!.hidden,
    ).toBe(false);
    expect(briefing.textContent).toContain('Trzy maszty w Niecce.');
    expect(document.activeElement).toBe(briefing);
    expect(
      panel.root.querySelector<HTMLElement>('.missions-panel__levels')!.hidden,
    ).toBe(true);
    panel.root
      .querySelector<HTMLButtonElement>('[data-action="start-run"]')!
      .click();
    expect(new URLSearchParams(navigate.mock.calls[0]![0]).get('mission')).toBe(
      'm01-maszty',
    );
    briefing.querySelector<HTMLButtonElement>('button')!.click();
    expect(briefing.hidden).toBe(true);
    panel.root
      .querySelector<HTMLButtonElement>('[data-mission="regular"]')!
      .click();
    expect(
      panel.root.querySelector('.missions-panel__sector-text')!.textContent,
    ).toContain('aż do szefa');
    expect(
      panel.root.querySelector<HTMLElement>('.missions-panel__levels')!.hidden,
    ).toBe(false);
  } finally {
    panel.dispose();
    HTMLElement.prototype.scrollIntoView = original;
  }
});

it('radio odtwarza długą kwestię w kolejnych fragmentach bez utraty słów', () => {
  const mission = missionDefinitions.get('m01-maszty')!;
  const radio = new MissionRadio(mission);
  const expected = mission.radio.find((entry) => entry.trigger === 'runStart')!
    .lines[0]!.text;
  radio.signal('runStart');
  const chunks: string[] = [];
  try {
    for (let i = 0; i < 10; i++) {
      radio.step(100);
      const node = document.querySelector<HTMLElement>('.mission-radio--run')!;
      if (node.hidden) break;
      const paragraph = node.querySelector('p')!;
      chunks.push(paragraph.lastChild!.textContent!);
    }
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(' ')).toBe(expected);
  } finally {
    radio.dispose();
  }
});

it('kwestie M01 pozostają całe, gdy mieszczą się w dwóch liniach, a podział nie zaczyna się małą literą', () => {
  const mission = missionDefinitions.get('m01-maszty')!;
  for (const { lines } of mission.radio)
    for (const line of lines) {
      expect(splitRadioText(line.text, () => true)).toEqual([line.text]);
      for (const limit of [40, 80, 160]) {
        const chunks = splitRadioText(
          line.text,
          (text) => text.length <= limit,
        );
        expect(chunks.join(' ')).toBe(line.text);
        for (const chunk of chunks) expect(chunk).toMatch(/^\p{Lu}/u);
        for (const chunk of chunks.slice(0, -1))
          expect(chunk).toMatch(/[.!?]$/);
      }
    }
  const sentence =
    'Pierwszy ucichł, reszta sieci podbiła moc — wiedzą już, że to nie awaria bezpieczników.';
  expect(splitRadioText(sentence, () => false)).toEqual([sentence]);
});
