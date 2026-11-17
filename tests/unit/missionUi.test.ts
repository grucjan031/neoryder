// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { MetaManager } from '../../src/progression/meta';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import { createMissionsPanel } from '../../src/ui/hub/missionsPanel';
import { MissionRadio } from '../../src/ui/missionUi';
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
