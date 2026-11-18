import { z } from 'zod';
import type { ModeId } from '../../world/modeSchema';
import modeText from '../../data/ui/modes.pl.json';
import { missionDefinitions } from '../../world/missions';
import type { MissionDefinition } from '../../world/missionSchema';
import { dialogueLines } from '../missionUi';
import missionText from '../../data/ui/missionDialogue.pl.json';
import textData from '../../data/ui/missions.pl.json';
import { threatLevels } from '../../progression/threatSchema';
import type { ThreatLevel } from '../../progression/threatSchema';
import type { HubPanel, HubPanelFactory } from './hubPanel';
import './missionsPanel.css';

const text = z
  .object({
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

function coresText(count: number): string {
  const forms = text.threat.victoryCores;
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

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  content?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
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

/** Tablica misji (F4-10): karta sektora, wybór Poziomu zagrożenia, opcjonalny seed i start runu z meta. */
export const createMissionsPanel: HubPanelFactory = (ctx): HubPanel => {
  const { manager } = ctx;
  const root = el('div', 'missions-panel');
  root.dataset.panel = 'missions';

  const sector = el('section', 'missions-panel__sector');
  const sectorName = el('h2', 'missions-panel__sector-name', text.sector.name);
  const sectorDescription = el(
    'p',
    'missions-panel__sector-text',
    text.sector.description,
  );
  sector.append(sectorName, sectorDescription);
  const describe = (mission?: MissionDefinition) => {
    sectorName.textContent = mission?.title ?? text.sector.name;
    sectorDescription.textContent = mission?.summary ?? text.sector.description;
  };

  const heading = el('h3', 'missions-panel__heading', text.threat.heading);
  const list = el('div', 'missions-panel__levels');
  list.setAttribute('role', 'group');
  list.setAttribute('aria-label', text.threat.heading);
  const details = el('ul', 'missions-panel__details');
  details.setAttribute('aria-live', 'polite');
  const status = el('p', 'missions-panel__status');
  status.setAttribute('role', 'status');

  let selectedMission: MissionDefinition | undefined;
  let selectedMode: ModeId | undefined;
  const choices = el('section');
  choices.dataset.missionList = '';
  const briefing = el('section');
  briefing.dataset.missionBriefing = '';
  briefing.hidden = true;
  const missionButtons = [...missionDefinitions.values()]
    .sort((a, b) => a.number - b.number)
    .map((mission) => {
      const button = el('button', 'mission-choice');
      button.type = 'button';
      button.dataset.mission = mission.id;
      button.addEventListener('click', () => {
        selectedMission = mission;
        selectedMode = undefined;
        describe(mission);
        const back = el('button', 'mission-choice', missionText.back);
        back.type = 'button';
        back.addEventListener('click', () => {
          selectedMission = undefined;
          describe();
          briefing.hidden = true;
          choices.hidden = false;
          sector.hidden = false;
          heading.hidden = false;
          list.hidden = false;
          start.textContent = text.start;
          button.focus();
        });
        briefing.replaceChildren(
          el('h3', undefined, `${missionText.briefing} · ${mission.title}`),
          dialogueLines(mission.briefing),
          back,
        );
        if (mission.interlude) {
          const interlude = el('section', 'missions-panel__interlude');
          interlude.dataset.missionInterlude = '';
          interlude.append(
            el('h3', undefined, mission.interlude.title),
            dialogueLines(mission.interlude.lines),
          );
          briefing.prepend(interlude);
        }
        briefing.hidden = false;
        choices.hidden = true;
        sector.hidden = false;
        heading.hidden = true;
        list.hidden = true;
        start.textContent = missionText.start;
        briefing.tabIndex = -1;
        briefing.focus({ preventScroll: true });
        sector.scrollIntoView({ block: 'start' });
      });
      choices.append(button);
      return { mission, button };
    });
  const regular = el('button', 'mission-choice', missionText.regular);
  regular.type = 'button';
  regular.dataset.mission = 'regular';
  regular.addEventListener('click', () => {
    selectedMode = undefined;
    selectedMission = undefined;
    describe();
    briefing.hidden = true;
    start.textContent = text.start;
    start.focus();
  });
  choices.append(regular);
  if (ctx.missionSave) {
    const saved = ctx.missionSave;
    const resume = el(
      'button',
      'mission-choice',
      `${missionText.continueMission} · ${missionDefinitions.get(saved.missionId)?.title ?? saved.missionId}`,
    );
    resume.type = 'button';
    resume.dataset.action = 'continue-mission';
    resume.addEventListener('click', () =>
      ctx.navigate(
        `?scene=mission&mission=${encodeURIComponent(saved.missionId)}&continue=1`,
      ),
    );
    choices.prepend(resume);
  }
  choices.append(el('h3', 'missions-panel__heading', modeText.heading));
  const conquest = el('button', 'mission-choice', modeText.conquest);
  conquest.type = 'button';
  conquest.dataset.mode = 'conquest';
  conquest.addEventListener('click', () => {
    selectedMode = 'conquest';
    selectedMission = undefined;
    sectorName.textContent = modeText.conquest;
    sectorDescription.textContent = modeText.description;
    start.textContent = modeText.start;
    start.focus();
  });
  choices.append(conquest);
  const assault = el('button', 'mission-choice', modeText.assault.title);
  assault.type = 'button';
  assault.dataset.mode = 'assault';
  assault.addEventListener('click', () => {
    selectedMode = 'assault';
    selectedMission = undefined;
    sectorName.textContent = modeText.assault.title;
    sectorDescription.textContent = modeText.assault.description;
    start.textContent = modeText.assault.start;
    start.focus();
  });
  choices.append(assault);
  const heist = el('button', 'mission-choice', modeText.heist.title);
  heist.type = 'button';
  heist.dataset.mode = 'heist';
  heist.addEventListener('click', () => {
    selectedMode = 'heist';
    selectedMission = undefined;
    sectorName.textContent = modeText.heist.title;
    sectorDescription.textContent = modeText.heist.description;
    start.textContent = modeText.heist.start;
    start.focus();
  });
  choices.append(heist);
  for (const title of modeText.soon) {
    const button = el('button', 'mission-choice', title);
    button.type = 'button';
    button.disabled = true;
    choices.append(button);
  }
  let disposed = false;
  let busy = false;

  async function select(level: number): Promise<void> {
    const { max, selected } = manager.state.threat;
    if (busy || disposed || level > max || level === selected) return;
    busy = true;
    try {
      manager.selectThreat(level);
      await ctx.save();
      status.textContent = '';
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : text.threat.saveError;
    } finally {
      busy = false;
    }
    if (!disposed) refresh();
  }

  const buttons = threatLevels.map((level) => {
    const button = el('button', 'missions-panel__level');
    button.type = 'button';
    button.dataset.level = String(level.level);
    button.append(
      el(
        'strong',
        undefined,
        `${fill(text.threat.level, { level: level.level })} · ${level.name}`,
      ),
    );
    const note = el('span', 'missions-panel__note');
    button.append(note);
    button.addEventListener('click', () => void select(level.level));
    list.append(button);
    return { level, button, note };
  });

  const seedLabel = el('label', 'missions-panel__seed', text.seed.label);
  const seedInput = el('input');
  seedInput.type = 'text';
  seedInput.placeholder = text.seed.placeholder;
  seedInput.autocomplete = 'off';
  seedLabel.append(seedInput);

  const start = el('button', 'missions-panel__start', text.start);
  start.type = 'button';
  start.dataset.action = 'start-run';
  start.addEventListener('click', () => {
    const params = new URLSearchParams({
      scene: selectedMission?.level ? 'mission' : 'run',
      loadout: 'meta',
    });
    const seed = seedInput.value.trim();
    if (seed || !selectedMode) params.set('seed', seed || randomSeed());
    if (selectedMission) params.set('mission', selectedMission.id);
    if (selectedMode) params.set('mode', selectedMode);
    ctx.navigate(`?${params}`);
  });

  root.append(
    sector,
    choices,
    briefing,
    heading,
    list,
    details,
    status,
    seedLabel,
    start,
  );

  function refresh(): void {
    const completed = manager.state.campaign.completed;
    for (const { mission, button } of missionButtons) {
      const missing = mission.requires.filter((id) => !completed.includes(id));
      button.disabled = !mission.level || missing.length > 0;
      const state = !mission.level
        ? missionText.soon
        : missing.length
          ? `${missionText.locked} · ${missionText.requires}${missing.join(', ')}`
          : completed.includes(mission.id)
            ? missionText.completed
            : missionText.available;
      button.textContent = `${String(mission.number).padStart(2, '0')} · ${mission.title} — ${state}`;
    }
    const { max, selected } = manager.state.threat;
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
    }
    const current = threatLevels[selected];
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
      root.remove();
    },
  };
};
