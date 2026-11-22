// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { MetaManager } from '../../src/progression/meta';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import { createMissionsPanel } from '../../src/ui/hub/missionsPanel';
import { MissionHud, MissionRadio } from '../../src/ui/missionUi';
import { splitDialogueText } from '../../src/ui/missionDialogue';
import { MissionObjectives } from '../../src/world/missionObjectives';
import { missionDefinitions } from '../../src/world/missions';

it('radio M06 natychmiast reaguje na fazę i śmierć bossa, pokazując imię i ikonę Brandta', () => {
  const radio = new MissionRadio(missionDefinitions.get('m06-odlewnia')!);
  try {
    radio.signal('enterNode:7');
    radio.step(0);
    radio.signal('boss:phase:2');
    radio.step(0);
    const root = document.querySelector('.mission-radio--run')!;
    expect(root.textContent).toContain('Otworzyć boczne śluzy.');
    expect(
      root.querySelector('[data-speaker="brandt"] strong')!.textContent,
    ).toBe('Brandt');
    expect(root.querySelector('.mission-dialogue__icon')!.textContent).toBe(
      'Br',
    );
    radio.signal('boss:defeated');
    radio.step(0);
    expect(root.textContent).toContain('...Bez różnicy.');
    const ending = [root.textContent];
    for (let i = 0; i < 5; i++) {
      radio.step(100);
      ending.push(root.textContent);
    }
    expect(ending.join(' ')).toContain('...Ja tylko dowożę.');
    expect(ending.join(' ')).not.toContain('Otworzyć');
    expect(root.textContent).toBe('');
  } finally {
    radio.dispose();
  }
});

it('HUD M03 rozróżnia podłączenie, transfer i pauzę bez zerowania paska', () => {
  const model = new MissionObjectives(
    missionDefinitions.get('m03-list-przewozowy')!,
    ['terminal', 'exit'],
    {},
    { signal() {}, explode() {} },
    1.6,
    1,
  );
  const hud = new MissionHud(model);
  try {
    hud.step();
    const root = document.querySelector('.mission-hud')!;
    expect(root.textContent).toContain('Podłączanie dekodera: 0%');
    model.step(2, { x: 0, y: 0, z: 1 });
    hud.step();
    expect(root.textContent).toContain('Transfer: 0%');
    expect(root.querySelector('progress')!.value).toBe(0);
    model.step(22.5, { x: 0, y: 0, z: 1 });
    hud.step();
    expect(root.textContent).toContain('Transfer: 25%');
    model.step(10, { x: 0, y: 0, z: 7 });
    hud.step();
    expect(root.textContent).toContain('TRANSFER WSTRZYMANY — wróć do strefy');
    expect(root.querySelector('progress')!.value).toBe(0.25);
    model.step(9, { x: 0, y: 0, z: 1 });
    hud.step();
    expect(root.textContent).toContain('Transfer: 35%');
    expect(root.textContent).not.toContain('WSTRZYMANY');
  } finally {
    hud.dispose();
  }
});

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
    expect(document.activeElement).toBe(
      briefing.querySelector('.mission-dialogue-player'),
    );
    expect(
      panel.root.querySelector<HTMLElement>('.missions-panel__levels')!.hidden,
    ).toBe(true);
    panel.root
      .querySelector<HTMLButtonElement>('[data-action="start-run"]')!
      .click();
    expect(new URLSearchParams(navigate.mock.calls[0]![0]).get('mission')).toBe(
      'm01-maszty',
    );
    briefing.querySelector<HTMLButtonElement>('.mission-choice')!.click();
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
  const trigger = 'objective:mast-2:done';
  const radio = new MissionRadio(mission);
  const lines = mission.radio
    .filter((entry) => entry.trigger === trigger)
    .flatMap((entry) => entry.lines);
  const expected = lines.map((line) => line.shortText ?? line.text).join(' ');
  radio.signal(trigger);
  const chunks: string[] = [];
  try {
    for (let i = 0; i < 40; i++) {
      radio.step(100);
      const node = document.querySelector<HTMLElement>('.mission-radio--run')!;
      if (node.hidden) break;
      const paragraph = node.querySelector('p')!;
      chunks.push(paragraph.lastChild!.textContent!);
    }
    expect(chunks.length).toBeGreaterThan(lines.length);
    expect(chunks.join(' ')).toBe(expected);
  } finally {
    radio.dispose();
  }
});

it('radio używa opcjonalnego skrótu, zachowuje kolejność i znika po ostatniej kwestii', () => {
  const mission = missionDefinitions.get('m01-maszty')!;
  const trigger = 'objective:mast-1:done';
  const radio = new MissionRadio(mission);
  try {
    radio.signal(trigger);
    radio.step(0);
    const root = document.querySelector<HTMLElement>('.mission-radio--run')!;
    const lines = mission.radio
      .filter((event) => event.trigger === trigger)
      .flatMap((event) => event.lines);
    expect(root.querySelector('p')!.textContent).toBe(lines[0]!.shortText);
    expect(root.querySelector('dialog, button')).toBeNull();
    radio.step(100);
    expect(root.querySelector('p')!.textContent).toBe(lines[1]!.text);
    for (let i = 0; i < 5; i++) radio.step(100);
    expect(root.hidden).toBe(true);
  } finally {
    radio.dispose();
  }
});

it('podział preferuje całe zdania, mieści długie zdania i obsługuje długie wyrazy', () => {
  const value =
    'Pierwszy ucichł. Reszta sieci podbiła moc, wiedzą już o sabotażu.';
  expect(splitDialogueText(value, (text) => text.length <= 36)).toEqual([
    'Pierwszy ucichł.',
    'Reszta sieci podbiła moc, wiedzą już',
    'o sabotażu.',
  ]);
  expect(splitDialogueText(value, () => true)).toEqual([value]);
  expect(splitDialogueText('123456789', (text) => text.length <= 4)).toEqual([
    '1234',
    '5678',
    '9',
  ]);
});
