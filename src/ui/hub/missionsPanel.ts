import { z } from 'zod';
import { loadSettings, saveSettings } from '../../core/save';
import { bulwarUnlocked } from '../../world/sectors';
import type { ModeId } from '../../world/modeSchema';
import modeText from '../../data/ui/modes.pl.json';
import { missionDefinitions } from '../../world/missions';
import type { MissionDefinition } from '../../world/missionSchema';
import { MissionDialogue } from '../missionDialogue';
import '../missionUi.css';
import missionText from '../../data/ui/missionDialogue.pl.json';
import textData from '../../data/ui/missions.pl.json';
import { threatLevels } from '../../progression/threatSchema';
import type { ThreatLevel } from '../../progression/threatSchema';
import { playUiSound } from '../../audio/uiSounds';
import uiText from '../../data/ui/ui.pl.json';
import { uiButton } from '../components/button';
import { uiBadge } from '../components/controls';
import { el } from '../components/dom';
import { bindUiFeedback } from '../components/feedback';
import type { HubPanel, HubPanelFactory } from './hubPanel';
import { createSquadPicker } from '../squadPicker';
import { squadParam } from '../../allies/roster';
import { missionIcon } from './missionIcons';
import type { MissionIconKind } from './missionIcons';
import './missionsPanel.css';

const text = z
  .object({
    firstClear: z.object({
      reward: z.string(),
      claimed: z.string(),
      cores: z.object({ one: z.string(), few: z.string(), many: z.string() }),
    }),
    groups: z.object({ story: z.string(), modes: z.string(), run: z.string() }),
    types: z.object({ story: z.string(), mode: z.string(), run: z.string() }),
    cardReward: z.string(),
    threatBadge: z.string(),
    boardLabel: z.string(),
    detailsLabel: z.string(),
    levelCaption: z.string(),
    sector: z.object({ name: z.string(), description: z.string() }),
    threat: z.object({
      heading: z.string(),
      level: z.string(),
      recommended: z.string(),
      locked: z.string(),
      modifiers: z.string(),
      baseline: z.string(),
      reward: z.string(),
      baseReward: z.string(),
      victoryCores: z.object({
        one: z.string(),
        few: z.string(),
        many: z.string(),
      }),
      saveError: z.string(),
    }),
    seed: z.object({ label: z.string(), placeholder: z.string() }),
    start: z.string(),
  })
  .parse(textData.missions);

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

const percent = (fraction: number): number => Math.round(fraction * 100);

function coresText(count: number, forms = text.threat.victoryCores): string {
  const last = count % 10;
  const form =
    count === 1
      ? forms.one
      : last >= 2 && last <= 4 && (count % 100 < 12 || count % 100 > 14)
        ? forms.few
        : forms.many;
  return fill(form, { count });
}

/** Seed runu z kryjówki: czysto interfejsowy (symulacja dostaje go przez URL), więc nie przechodzi przez `Rng`. */
function randomSeed(): string {
  return Array.from(crypto.getRandomValues(new Uint32Array(4)), (value) =>
    value.toString(16),
  ).join('-');
}

function detailLines(level: ThreatLevel): string[] {
  const neutral =
    level.enemyHealth === 0 &&
    level.enemyDamage === 0 &&
    level.budgetMult === 1;
  const lines = [
    neutral
      ? text.threat.baseline
      : fill(text.threat.modifiers, {
          health: percent(level.enemyHealth),
          damage: percent(level.enemyDamage),
          budget: percent(level.budgetMult - 1),
        }),
    level.rewardMult === 1
      ? text.threat.baseReward
      : fill(text.threat.reward, { percent: percent(level.rewardMult - 1) }),
  ];
  if (level.victoryCores > 0) lines.push(coresText(level.victoryCores));
  return lines;
}

interface CardParts {
  button: HTMLButtonElement;
  state: HTMLElement;
  threat: HTMLElement;
}

/** Tablica misji: karty pogrupowane (Fabuła / Tryby / Run), z prawej szczegóły wyboru, Poziom zagrożenia i start. */
export const createMissionsPanel: HubPanelFactory = (ctx): HubPanel => {
  const { manager } = ctx;
  const root = el('div', 'missions-panel');
  root.dataset.panel = 'missions';

  const squadPicker = createSquadPicker({
    completed: () => manager.state.campaign.completed,
  });

  const mainCol = el('div', 'missions-panel__main ui-scroll');
  mainCol.setAttribute('aria-label', text.boardLabel);
  const side = el('aside', 'missions-panel__side ui-scroll');
  side.setAttribute('aria-label', text.detailsLabel);

  const sector = el('section', 'missions-panel__sector');
  const firstClear = el('p', 'missions-panel__reward');
  firstClear.dataset.firstClear = '';
  firstClear.hidden = true;
  const sectorName = el('h2', 'missions-panel__sector-name', text.sector.name);
  const sectorDescription = el(
    'p',
    'missions-panel__sector-text',
    text.sector.description,
  );
  sector.append(sectorName, sectorDescription, firstClear);
  const districtText = textData.missions.district;
  const districtLabel = el('label', 'missions-panel__seed', districtText.label);
  const district = el('select', 'missions-panel__seed-input');
  const bulwar = el('option', '', districtText.bulwar);
  bulwar.value = 'bulwar';
  const kurogane = el('option', '', districtText.kurogane);
  kurogane.value = 'kurogane';
  district.append(kurogane, bulwar);
  const lock = el(
    'span',
    'missions-panel__sector-text',
    `${districtText.bulwar} · ${districtText.locked}`,
  );
  districtLabel.append(district, lock);
  district.setAttribute('aria-label', districtText.label);
  district.addEventListener('change', () => {
    saveSettings({
      ...loadSettings(),
      lastDistrict: district.value === 'bulwar' ? 'bulwar' : 'kurogane',
    });
    describe();
  });
  const describe = (mission?: MissionDefinition) => {
    // Misje liniowe mają własnych towarzyszy z danych poziomu.
    squadPicker.root.hidden = !!mission?.level;
    districtLabel.hidden = !!mission;
    const onBulwar = district.value === 'bulwar';
    sectorName.textContent =
      mission?.title ?? (onBulwar ? districtText.bulwar : text.sector.name);
    sectorDescription.textContent =
      mission?.summary ??
      (onBulwar ? districtText.description : text.sector.description);
    firstClear.hidden = !mission?.level;
    firstClear.textContent = !mission?.level
      ? ''
      : manager.state.campaign.completed.includes(mission.id)
        ? text.firstClear.claimed
        : fill(text.firstClear.reward, {
            data: mission.rewards.firstClear.data,
          }) +
          (mission.rewards.firstClear.cores
            ? coresText(mission.rewards.firstClear.cores, text.firstClear.cores)
            : '');
  };

  const heading = el(
    'h3',
    'missions-panel__heading ui-heading',
    text.threat.heading,
  );
  const list = el('div', 'missions-panel__levels');
  list.setAttribute('role', 'group');
  list.setAttribute('aria-label', text.threat.heading);
  const caption = el('p', 'missions-panel__caption');
  const details = el('ul', 'missions-panel__details');
  details.setAttribute('aria-live', 'polite');
  const status = el('p', 'missions-panel__status');
  status.setAttribute('role', 'status');

  let selectedMission: MissionDefinition | undefined;
  let selectedMode: ModeId | undefined;
  let dialogue: MissionDialogue | undefined;
  const disposeDialogue = () => {
    dialogue?.dispose();
    dialogue = undefined;
  };
  const choices = el('section', 'missions-panel__board');
  choices.dataset.missionList = '';
  const briefing = el('section', 'missions-panel__briefing');
  briefing.dataset.missionBriefing = '';
  briefing.hidden = true;

  const cards = new Map<string, CardParts>();
  const markSelected = (key: string): void => {
    for (const [id, parts] of cards)
      parts.button.setAttribute('aria-pressed', String(id === key));
  };

  /** Karta: ikona typu, tytuł, stan, plakietki (typ, zagrożenie) i nagroda. */
  const card = (
    key: string,
    title: string,
    icon: MissionIconKind,
    type: string,
    onClick: () => void,
    reward?: string,
  ): CardParts => {
    const button = el('button', 'mission-card ui-interactive');
    button.type = 'button';
    button.setAttribute('aria-pressed', 'false');
    const iconBox = el('span', 'mission-card__icon');
    iconBox.append(missionIcon(icon));
    const body = el('span', 'mission-card__body');
    const state = el('span', 'mission-card__state');
    const meta = el('span', 'mission-card__meta');
    const threat = el('span', 'mission-card__threat');
    meta.append(uiBadge(type, 'neutral'), threat);
    if (reward) meta.append(el('span', 'mission-card__reward', reward));
    body.append(el('span', 'mission-card__title', title), state, meta);
    button.append(iconBox, body);
    button.addEventListener('click', () => {
      if (button.getAttribute('aria-disabled') === 'true') {
        playUiSound('error');
        return;
      }
      markSelected(key);
      onClick();
    });
    bindUiFeedback(button, false);
    const parts = { button, state, threat };
    cards.set(key, parts);
    return parts;
  };

  const group = (title: string): HTMLElement => {
    const section = el('section', 'missions-panel__group');
    section.append(el('h3', 'missions-panel__group-title ui-heading', title));
    const grid = el('div', 'missions-panel__grid');
    section.append(grid);
    choices.append(section);
    return grid;
  };

  const storyGrid = group(text.groups.story);
  const missionCards = [...missionDefinitions.values()]
    .sort((a, b) => a.number - b.number)
    .map((mission) => {
      const reward = mission.level
        ? fill(text.cardReward, { data: mission.rewards.firstClear.data }) +
          (mission.rewards.firstClear.cores
            ? coresText(mission.rewards.firstClear.cores, text.firstClear.cores)
            : '')
        : undefined;
      const parts = card(
        mission.id,
        mission.title,
        'story',
        text.types.story,
        () => {
          selectedMission = mission;
          selectedMode = undefined;
          describe(mission);
          const back = uiButton({
            label: missionText.back,
            variant: 'secondary',
            sound: 'back',
            onClick: () => {
              disposeDialogue();
              selectedMission = undefined;
              describe();
              briefing.hidden = true;
              choices.hidden = false;
              heading.hidden = false;
              list.hidden = false;
              caption.hidden = false;
              details.hidden = false;
              setStartLabel(text.start);
              markSelected('regular');
              parts.button.focus();
            },
          });
          disposeDialogue();
          const title = `${missionText.briefing} · ${mission.title}`;
          dialogue = new MissionDialogue([
            ...(mission.interlude
              ? [{ ...mission.interlude, interlude: true }]
              : []),
            { title, lines: mission.briefing },
          ]);
          const briefingHeading = el('h3', 'ui-heading', title);
          briefingHeading.hidden = !dialogue.root.hidden;
          briefing.replaceChildren(briefingHeading, dialogue.root, back);
          briefing.hidden = false;
          choices.hidden = true;
          heading.hidden = true;
          list.hidden = true;
          caption.hidden = true;
          details.hidden = true;
          setStartLabel(missionText.start);
          (dialogue.root.hidden ? back : dialogue.root).focus({
            preventScroll: true,
          });
          sector.scrollIntoView?.({ block: 'start' });
        },
        reward,
      );
      parts.button.dataset.mission = mission.id;
      storyGrid.append(parts.button);
      return { mission, parts };
    });

  const modeGrid = group(text.groups.modes);
  const runGrid = group(text.groups.run);
  const selectDefault = (): void => {
    disposeDialogue();
    selectedMode = undefined;
    selectedMission = undefined;
    describe();
    briefing.hidden = true;
    setStartLabel(text.start);
  };
  const regular = card(
    'regular',
    missionText.regular,
    'run',
    text.types.run,
    () => {
      selectDefault();
      start.focus();
    },
  );
  regular.button.dataset.mission = 'regular';
  regular.state.textContent = missionText.available;
  runGrid.append(regular.button);
  markSelected('regular');
  if (ctx.missionSave) {
    const saved = ctx.missionSave;
    const resume = card(
      'continue-mission',
      `${missionText.continueMission} · ${missionDefinitions.get(saved.missionId)?.title ?? saved.missionId}`,
      'continue',
      text.types.story,
      () =>
        ctx.navigate(
          `?scene=mission&mission=${encodeURIComponent(saved.missionId)}&continue=1`,
        ),
    );
    resume.button.dataset.action = 'continue-mission';
    resume.state.textContent = missionText.available;
    resume.threat.hidden = true;
    runGrid.prepend(resume.button);
  }

  const modeDefs: {
    id: ModeId;
    title: string;
    description: string;
    start: string;
    icon: MissionIconKind;
  }[] = [
    {
      id: 'conquest',
      title: modeText.conquest,
      description: modeText.description,
      start: modeText.start,
      icon: 'conquest',
    },
    {
      id: 'assault',
      title: modeText.assault.title,
      description: modeText.assault.description,
      start: modeText.assault.start,
      icon: 'assault',
    },
    {
      id: 'heist',
      title: modeText.heist.title,
      description: modeText.heist.description,
      start: modeText.heist.start,
      icon: 'heist',
    },
  ];
  for (const mode of modeDefs) {
    const parts = card(mode.id, mode.title, mode.icon, text.types.mode, () => {
      disposeDialogue();
      briefing.hidden = true;
      selectedMode = mode.id;
      districtLabel.hidden = true;
      selectedMission = undefined;
      sectorName.textContent = mode.title;
      sectorDescription.textContent = mode.description;
      firstClear.hidden = true;
      setStartLabel(mode.start);
      start.focus();
    });
    parts.button.dataset.mode = mode.id;
    parts.state.textContent = missionText.available;
    modeGrid.append(parts.button);
  }
  for (const title of modeText.soon) {
    const parts = card(
      `soon:${title}`,
      title,
      'assault',
      text.types.mode,
      () => {},
    );
    parts.button.setAttribute('aria-disabled', 'true');
    parts.state.textContent = missionText.soon;
    modeGrid.append(parts.button);
  }
  mainCol.append(choices, briefing);

  let disposed = false;
  let busy = false;

  async function select(level: number): Promise<void> {
    const { max, selected } = manager.state.threat;
    if (busy || disposed || level > max) {
      if (level > max) playUiSound('error');
      return;
    }
    if (level === selected) return;
    busy = true;
    try {
      manager.selectThreat(level);
      await ctx.save();
      status.textContent = '';
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : text.threat.saveError;
      playUiSound('error');
    } finally {
      busy = false;
    }
    if (!disposed) refresh();
  }

  const buttons = threatLevels.map((level) => {
    const button = el('button', 'missions-panel__level ui-interactive');
    button.type = 'button';
    button.dataset.level = String(level.level);
    button.append(el('strong', 'ui-num', String(level.level)));
    // Pełny opis dla czytników i podpowiedzi; na kafelku widać tylko numer.
    const label = el(
      'span',
      'ui-sr',
      `${fill(text.threat.level, { level: level.level })} · ${level.name}`,
    );
    const note = el('span', 'ui-sr missions-panel__note');
    button.append(label, note);
    button.title = level.name;
    button.addEventListener('click', () => void select(level.level));
    bindUiFeedback(button, false);
    list.append(button);
    return { level, button, note };
  });

  const seedLabel = el('label', 'missions-panel__seed', text.seed.label);
  const seedInput = el('input', 'missions-panel__seed-input');
  seedInput.type = 'text';
  seedInput.placeholder = text.seed.placeholder;
  seedInput.autocomplete = 'off';
  seedLabel.append(seedInput);

  const start = uiButton({
    label: text.start,
    variant: 'primary',
    onClick: () => {
      const params = new URLSearchParams({
        scene: selectedMission?.level ? 'mission' : 'run',
        loadout: 'meta',
      });
      const seed = seedInput.value.trim();
      if (seed || !selectedMode) params.set('seed', seed || randomSeed());
      if (selectedMission) params.set('mission', selectedMission.id);
      if (selectedMode) params.set('mode', selectedMode);
      if (!selectedMission && !selectedMode && district.value === 'bulwar')
        params.set('district', 'bulwar');
      const squad = squadPicker.selected();
      if (!selectedMission?.level && squad.length > 0)
        params.set('squad', squadParam(squad));
      ctx.navigate(`?${params}`);
    },
  });
  start.classList.add('missions-panel__start');
  start.dataset.action = 'start-run';
  const setStartLabel = (label: string): void => {
    const node = start.querySelector('.ui-button__label');
    if (node) node.textContent = label;
    start.setAttribute('aria-label', label);
  };

  side.append(
    sector,
    districtLabel,
    heading,
    list,
    caption,
    details,
    squadPicker.root,
    status,
    seedLabel,
    start,
  );
  root.append(mainCol, side);

  function refresh(): void {
    bulwar.disabled = !bulwarUnlocked(manager.state.campaign.completed);
    lock.hidden = !bulwar.disabled;
    district.value = bulwar.disabled
      ? 'kurogane'
      : (loadSettings().lastDistrict ?? 'kurogane');
    if (!selectedMode) describe(selectedMission);
    squadPicker.refresh();
    const completed = manager.state.campaign.completed;
    const { max, selected } = manager.state.threat;
    const threatName = threatLevels[selected];
    const badge = fill(text.threatBadge, { level: selected });
    for (const parts of cards.values()) {
      parts.threat.textContent = badge;
      if (threatName) parts.threat.title = threatName.name;
    }
    for (const { mission, parts } of missionCards) {
      const missing = mission.requires.filter((id) => !completed.includes(id));
      const locked = !mission.level || missing.length > 0;
      parts.button.setAttribute('aria-disabled', String(locked));
      parts.button.dataset.state = !mission.level
        ? 'soon'
        : missing.length
          ? 'locked'
          : completed.includes(mission.id)
            ? 'completed'
            : 'available';
      parts.state.textContent = !mission.level
        ? missionText.soon
        : missing.length
          ? `${missionText.locked} · ${missionText.requires}${missing
              .map((id) => missionDefinitions.get(id)?.title ?? id)
              .join(', ')}`
          : completed.includes(mission.id)
            ? missionText.completed
            : missionText.available;
      parts.threat.hidden = locked;
    }
    for (const { level, button, note } of buttons) {
      const locked = level.level > max;
      button.setAttribute('aria-disabled', String(locked));
      button.setAttribute('aria-pressed', String(level.level === selected));
      button.dataset.state = locked
        ? 'locked'
        : level.level === selected
          ? 'selected'
          : 'available';
      note.textContent = locked
        ? fill(text.threat.locked, { level: level.level - 1 })
        : level.level === max && max > 0
          ? text.threat.recommended
          : '';
      if (note.textContent)
        button.title = `${level.name} · ${note.textContent}`;
      else button.title = level.name;
    }
    const current = threatLevels[selected];
    caption.textContent = current
      ? fill(text.levelCaption, { level: selected, name: current.name })
      : '';
    details.replaceChildren(
      ...(current ? detailLines(current) : []).map((line) =>
        el('li', undefined, line),
      ),
    );
  }

  refresh();
  return {
    root,
    refresh,
    dispose(): void {
      disposed = true;
      disposeDialogue();
      squadPicker.dispose();
      root.remove();
    },
    actions: [
      { keys: '{navigate}', label: uiText.navigate, decorative: true },
      { keys: '{confirm}', label: uiText.select, decorative: true },
    ],
  };
};
