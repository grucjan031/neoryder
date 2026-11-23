// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createMissionsPanel } from '../../src/ui/hub/missionsPanel';
import { MetaManager } from '../../src/progression/meta';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import { loadoutDefinitions } from '../../src/progression/loadout';
import { SAVE_VERSION, type MissionSave } from '../../src/core/save';
import { EventBus } from '../../src/core/events';
import { Hud } from '../../src/ui/hud';
import { MissionDirection, MissionHud } from '../../src/ui/missionUi';
import { MissionObjectives } from '../../src/world/missionObjectives';
import { missionDefinitions } from '../../src/world/missions';

afterEach(() => document.body.replaceChildren());

it('tablica udostępnia M01, blokuje M03, M04 i M06 (wymaga M04) i przekazuje kontynuację zapisanej misji', () => {
  const navigate = vi.fn();
  const missionSave: MissionSave = {
    saveVersion: SAVE_VERSION,
    attemptId: 'attempt',
    missionId: 'm01-maszty',
    levelId: 'm01-maszty',
    seed: 'ui',
    checkpointId: 'po-helixie',
    objectives: {},
    completedEncounters: [],
    elapsedS: 1,
    completed: false,
    loadout: loadoutDefinitions.get('classic')!,
    talents: [],
    implants: [],
    threatLevel: 0,
  };
  const panel = createMissionsPanel({
    manager: new MetaManager(createStarterMetaState()),
    missionSave,
    navigate,
    save: async () => {},
    close() {},
  });
  try {
    expect(
      panel.root
        .querySelector<HTMLButtonElement>('[data-mission="m01-maszty"]')!
        .getAttribute('aria-disabled'),
    ).toBe('false');
    for (const [id, status] of [
      ['m02-punkt-kontrolny', 'Zablokowana'],
      ['m03-list-przewozowy', 'Zablokowana'],
      ['m04-ladunek-klasy-k', 'Zablokowana'],
    ] as const) {
      const button = panel.root.querySelector<HTMLButtonElement>(
        `[data-mission="${id}"]`,
      )!;
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(button.textContent).toContain(status);
    }
    const foundry = panel.root.querySelector<HTMLButtonElement>(
      '[data-mission="m06-odlewnia"]',
    )!;
    expect(foundry.getAttribute('aria-disabled')).toBe('true');
    expect(foundry.textContent).not.toContain('Wkrótce');
    const resume = panel.root.querySelector<HTMLButtonElement>(
      '[data-action="continue-mission"]',
    )!;
    expect(resume.textContent).toContain('Kontynuuj misję');
    resume.click();
    expect(new URLSearchParams(navigate.mock.calls[0]![0])).toEqual(
      new URLSearchParams('scene=mission&mission=m01-maszty&continue=1'),
    );
  } finally {
    panel.dispose();
  }
});

it('HUD liniowy nie pokazuje ekranu śmierci, fal i interfejsu nagród runu', () => {
  const bus = new EventBus();
  const hud = new Hud(bus, {
    playerId: 1,
    deathScreen: false,
    showWaves: false,
  });
  try {
    bus.emit('wave_started', { wave: 1, count: 3 });
    bus.emit('player_died', { id: 1 });
    expect(document.querySelector<HTMLElement>('.hud__death')!.hidden).toBe(
      true,
    );
    expect(document.querySelector<HTMLElement>('.hud__wave')!.hidden).toBe(
      true,
    );
    expect(
      document.querySelector<HTMLElement>('.run-hud__credits')!.hidden,
    ).toBe(true);
    expect(
      document.querySelector<HTMLElement>('.run-hud__implants')!.hidden,
    ).toBe(true);
  } finally {
    hud.dispose();
  }
});

it('znacznik wskazuje aktualny cel i odległość, HUD pokazuje tylko jego postęp', () => {
  const mission = structuredClone(missionDefinitions.get('m01-maszty')!);
  const order = ['mast-1', 'mast-2', 'helix', 'mast-3', 'exit'];
  mission.objectives.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const model = new MissionObjectives(
    mission,
    order,
    {},
    { signal() {}, explode() {} },
    1.6,
    1,
    order,
  );
  const marker = new MissionDirection();
  const hud = new MissionHud(model, true);
  try {
    marker.update(model, {
      position: { x: -10, y: 0, z: 0 },
      yaw: -Math.PI / 2,
    });
    hud.step();
    expect(
      document.querySelector('[data-mission-direction]')!.textContent,
    ).toContain('Zniszcz maszt 1 · 10 m');
    expect(
      document.querySelectorAll('.mission-goals > div:not([hidden])'),
    ).toHaveLength(1);
    model.done('mast-1');
    marker.update(model, { position: { x: 0, y: 0, z: 0 }, yaw: 0 });
    hud.step();
    expect(
      document.querySelector('[data-mission-direction]')!.textContent,
    ).toContain('Zniszcz maszt 2');
    expect(
      document.querySelectorAll('.mission-goals > div:not([hidden])'),
    ).toHaveLength(1);
  } finally {
    marker.dispose();
    hud.dispose();
  }
});
